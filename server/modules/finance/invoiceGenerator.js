/**
 * 发票生成器
 * 
 * 生成PDF发票和Excel明细，并上传到腾讯云COS或保存到本地
 */

import puppeteer from 'puppeteer'
import ExcelJS from 'exceljs'
import { generateInvoiceHTML, COMPANY_INFO, getLogoBase64, getStampBase64, getInvoiceTemplateFromDB, getInvoiceTemplateById, convertTemplateToCompanyInfo, preloadFeeNameEnCache } from './invoiceTemplate.js'
import { getDatabase } from '../../config/database.js'
import * as cosStorage from './cosStorage.js'
import { generateId } from '../../utils/id.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 本地文件存储目录
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../uploads/invoices')

// 确保本地存储目录存在
function ensureLocalStorageDir() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
  }
}

/**
 * 保存文件到本地
 */
async function saveFileLocally(buffer, filename) {
  ensureLocalStorageDir()
  const filePath = path.join(LOCAL_STORAGE_DIR, filename)
  fs.writeFileSync(filePath, buffer)
  return `/api/invoices/files/${filename}`
}

/**
 * 生成发票编号
 * 格式：INV + 年份(4位) + 序号(7位)
 * 每年1月1日重置序号
 */
export async function generateInvoiceNumber() {
  const db = getDatabase()
  const year = new Date().getFullYear()
  const prefix = `INV${year}`
  
  // 查询当年最大序号
  const result = await db.prepare(`
    SELECT invoice_number FROM invoices 
    WHERE invoice_number LIKE ? 
    ORDER BY invoice_number DESC 
    LIMIT 1
  `).get(`${prefix}%`)
  
  let seq = 1
  if (result && result.invoice_number) {
    // 提取序号部分（最后7位）
    const lastSeq = parseInt(result.invoice_number.slice(-7), 10)
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1
    }
  }
  
  // 生成新编号：INV + 年份 + 7位序号
  return `${prefix}${seq.toString().padStart(7, '0')}`
}

/**
 * 汇总费用数据（按费用类型）
 * 用于PDF发票
 */
export function summarizeFees(fees) {
  const summary = {}
  
  fees.forEach(fee => {
    const key = fee.fee_name || fee.feeName || 'Other'
    if (!summary[key]) {
      summary[key] = {
        description: key,
        descriptionEn: fee.fee_name_en || fee.feeNameEn || null, // 保存英文名称
        quantity: 0,
        totalAmount: 0,
        items: []
      }
    }
    summary[key].quantity += 1
    summary[key].totalAmount += parseFloat(fee.amount) || 0
    summary[key].items.push(fee)
  })
  
  // 转换为数组，计算平均单价
  return Object.values(summary).map(item => ({
    description: item.description,
    descriptionEn: item.descriptionEn, // 传递英文名称
    quantity: item.quantity,
    unitValue: item.quantity > 0 ? item.totalAmount / item.quantity : 0,
    amount: item.totalAmount
  }))
}

/**
 * 生成PDF发票
 */
export async function generatePDF(invoiceData) {
  // 预加载费用名称英文映射缓存
  await preloadFeeNameEnCache()
  
  console.log('[generatePDF] 开始生成 HTML...')
  const html = generateInvoiceHTML(invoiceData)
  console.log(`[generatePDF] HTML 生成完成, 长度: ${html?.length || 0}`)
  
  let browser = null
  try {
    console.log('[generatePDF] 正在启动 Puppeteer...')
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
    console.log('[generatePDF] Puppeteer 启动成功')
    
    const page = await browser.newPage()
    console.log('[generatePDF] 新页面创建成功')
    
    await page.setContent(html, { waitUntil: 'networkidle0' })
    console.log('[generatePDF] 页面内容设置成功')
    
    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    })
    console.log(`[generatePDF] PDF 生成成功, 大小: ${pdfData?.length || 0} bytes`)
    
    // 确保返回 Node.js Buffer（COS SDK 需要）
    return Buffer.from(pdfData)
  } catch (error) {
    console.error('[generatePDF] 生成 PDF 失败:', error.message || error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
      console.log('[generatePDF] 浏览器已关闭')
    }
  }
}

// 从数据库加载的费用名称英文映射缓存
let feeNameEnCache = null
let feeNameEnCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 缓存5分钟

/**
 * 从 service_fee_categories 表加载费用名称英文映射
 * 使用缓存避免频繁查询数据库
 */
async function loadFeeNameEnFromDB() {
  const now = Date.now()
  // 如果缓存有效，直接返回
  if (feeNameEnCache && (now - feeNameEnCacheTime) < CACHE_TTL) {
    return feeNameEnCache
  }
  
  try {
    const db = getDatabase()
    const result = await db.pool.query(`
      SELECT name, name_en 
      FROM service_fee_categories 
      WHERE name_en IS NOT NULL AND name_en != '' AND status = 'active'
    `)
    
    // 构建映射表
    const mapping = {}
    for (const row of result.rows) {
      if (row.name && row.name_en) {
        mapping[row.name] = row.name_en
      }
    }
    
    feeNameEnCache = mapping
    feeNameEnCacheTime = now
    console.log(`[loadFeeNameEnFromDB] 加载了 ${Object.keys(mapping).length} 个费用名称英文映射`)
    return mapping
  } catch (error) {
    console.error('[loadFeeNameEnFromDB] 加载费用名称英文映射失败:', error.message)
    return {}
  }
}

// 费用名称中英文映射（硬编码备用，当数据库查不到时使用）
const FEE_NAME_MAP = {
  // 基础费用
  '堆场费': 'Terminal Handling Charge',
  'THC费': 'Terminal Handling Charge',
  'THC': 'Terminal Handling Charge',
  '拖车费': 'Trucking Fee',
  '运费': 'Freight',
  '船公司运费': 'Ocean Freight',
  '海运费': 'Ocean Freight',
  
  // 清关相关
  '报关费': 'Customs Clearance Fee',
  '清关费': 'Customs Clearance Fee',
  '清关操作费': 'Customs Clearance Handling Fee',
  '清关等待费': 'Customs Clearance Waiting Fee',
  '关税': 'Customs Duty',
  '增值税': 'VAT',
  '进口增值税': 'Import VAT',
  '反倾销税': 'Anti-dumping Duty',
  'HS CODE操作费': 'HS Code Handling Fee',
  'HS编码操作费': 'HS Code Handling Fee',
  'HS CODE超10个费用': 'HS Code Excess Fee (Over 10)',
  '税号便费': 'Tax ID Handling Fee',
  '税号使用费': 'Tax ID Service Fee',
  '税号代理费': 'Tax ID Agency Fee',
  '税号费': 'Tax ID Fee',
  'T1费': 'T1 Transit Fee',
  
  // 代理费用
  '操作费': 'Handling Fee',
  '代理费': 'Agency Fee',
  '进口商代理费': 'Import Agency Fee',
  '进口代理费': 'Import Agency Fee',
  '出口商代理费': 'Export Agency Fee',
  '货代费': 'Freight Forwarder Fee',
  '公司服务费': 'Company Service Fee',
  
  // 运输费用
  '提柜送仓费': 'Container Delivery Fee',
  '送货费': 'Delivery Fee',
  '运输费': 'Transportation Fee',
  '卸货费': 'Unloading Fee',
  '卸货压车费': 'Unloading & Waiting Fee',
  '卡车等待费': 'Truck Waiting Fee',
  '等待费': 'Waiting Fee',
  '压车费': 'Waiting Fee',
  
  // 包价费用
  '包价一口价': 'Lump Sum Fee',
  '一口价': 'Lump Sum Fee',
  '包干费': 'Lump Sum Fee',
  
  // 仓储相关
  '仓储费': 'Warehousing Fee',
  '仓库费': 'Warehouse Fee',
  '堆存费': 'Storage Fee',
  '装卸费': 'Loading/Unloading Fee',
  
  // 港口费用
  '港杂费': 'Port Charges',
  '港杂': 'Port Charges',
  '港口费': 'Port Charges',
  
  // 其他费用
  '保险费': 'Insurance Fee',
  '文件费': 'Documentation Fee',
  '查验费': 'Inspection Fee',
  '扫描费': 'Scanning Fee',
  '加班费': 'Overtime Fee',
  '滞港费': 'Demurrage Fee',
  '滞箱费': 'Detention Fee',
  '换单费': 'B/L Release Fee',
  '目的港费': 'Destination Charges',
  '起运港费': 'Origin Charges',
  '燃油附加费': 'Bunker Adjustment Factor',
  '其他费用': 'Other Charges',
  '其他杂费': 'Other Miscellaneous Charges',
  '其他': 'Others',
  '杂费': 'Miscellaneous Charges',
  '服务费': 'Service Fee'
}

// 获取费用的英文名称
// 优先级：1. fee_name_en 字段  2. service_fee_categories 表  3. FEE_NAME_MAP 映射  4. 原名
async function getFeeNameEnglish(chineseName, feeNameEn = null) {
  // 如果已有英文名称字段，优先使用
  if (feeNameEn && feeNameEn.trim()) {
    return feeNameEn.trim()
  }
  
  if (!chineseName) return 'Other Charges'
  
  // 1. 优先从 service_fee_categories 数据库查询
  const dbMapping = await loadFeeNameEnFromDB()
  if (dbMapping[chineseName]) {
    return dbMapping[chineseName]
  }
  
  // 2. 尝试数据库部分匹配
  for (const [cn, en] of Object.entries(dbMapping)) {
    if (chineseName.includes(cn) || (cn.includes(chineseName) && chineseName.length >= 2)) {
      return en
    }
  }
  
  // 3. 尝试硬编码映射表直接匹配
  if (FEE_NAME_MAP[chineseName]) {
    return FEE_NAME_MAP[chineseName]
  }
  
  // 4. 尝试硬编码映射表部分匹配
  for (const [cn, en] of Object.entries(FEE_NAME_MAP)) {
    // 费用名包含映射 key（如 "港杂费" 包含 "港杂"）
    if (chineseName.includes(cn)) {
      return en
    }
    // 映射 key 包含费用名（如 "港杂费" 的 key 包含费用名 "港杂"）
    if (cn.includes(chineseName) && chineseName.length >= 2) {
      return en
    }
  }
  
  // 5. 如果已经是英文，直接返回
  if (/^[a-zA-Z\s\/]+$/.test(chineseName)) {
    return chineseName
  }
  
  return chineseName // 没有匹配则返回原名
}

// 根据语言获取费用名称
// language: 'en' = 英文, 'zh' = 中文
async function getFeeNameByLanguage(chineseName, feeNameEn = null, language = 'en') {
  if (language === 'zh') {
    // 中文：优先显示中文名称
    if (chineseName && chineseName.trim()) {
      return chineseName.trim()
    }
    // 如果没有中文名，尝试从英文映射回中文
    if (feeNameEn) {
      for (const [cn, en] of Object.entries(FEE_NAME_MAP)) {
        if (en === feeNameEn) {
          return cn
        }
      }
      return feeNameEn // 没有映射则返回英文名
    }
    return '其他费用'
  } else {
    // 英文：使用已有的英文获取逻辑（现在是异步的）
    return await getFeeNameEnglish(chineseName, feeNameEn)
  }
}

// 格式化日期为简单格式
function formatExcelDate(dateStr) {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return dateStr
  }
}

/**
 * 生成Excel明细（Statement of Account）
 * @param {Object} data - 数据对象
 * @param {string} data.customerName - 客户名称
 * @param {string} data.date - 日期
 * @param {Array} data.items - 费用项目列表
 * @param {number} data.total - 总金额
 * @param {string} data.currency - 货币类型，默认 EUR
 * @param {string} data.containerNo - 集装箱号
 * @param {string} data.language - 语言，'en' = 英文（默认），'zh' = 中文
 */
export async function generateExcel(data) {
  const {
    customerName,
    date,
    items,
    total,
    currency = 'EUR',
    containerNo = '',  // 集装箱号
    language = 'en'    // 语言，默认英文，与发票保持一致
  } = data
  
  const formattedDate = formatExcelDate(date)
  
  // 根据语言定义标签文本
  const labels = language === 'zh' ? {
    title: '对 账 单',
    sheetName: '对账单',
    customer: '客户',
    date: '日期',
    containerNo: '集装箱号',
    billNo: '提单号',
    feeType: '费用类型',
    amount: `金额 ${currency}`,
    discount: '优惠',
    finalAmount: `最终金额 ${currency}`,
    total: '合计:'
  } : {
    title: 'STATEMENT OF ACCOUNT',
    sheetName: 'Statement of Account',
    customer: 'Customer',
    date: 'Date',
    containerNo: 'CONTAINER NO',
    billNo: 'BILL NO',
    feeType: 'FEE TYPE',
    amount: `Amount ${currency}`,
    discount: 'Discount',
    finalAmount: `Final ${currency}`,
    total: 'Total:'
  }
  
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Xianfeng International Logistics'
  workbook.created = new Date()
  
  const worksheet = workbook.addWorksheet(labels.sheetName)
  
  // 设置列宽
  worksheet.columns = [
    { header: labels.containerNo, key: 'containerNo', width: 18 },
    { header: labels.billNo, key: 'billNo', width: 18 },
    { header: labels.feeType, key: 'feeType', width: 25 },
    { header: labels.amount, key: 'amount', width: 14 },
    { header: labels.discount, key: 'discount', width: 12 },
    { header: labels.finalAmount, key: 'finalAmount', width: 14 }
  ]
  
  // 标题行
  worksheet.mergeCells('A1:F1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = labels.title
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center' }
  
  // 客户信息行
  worksheet.mergeCells('A3:C3')
  worksheet.getCell('A3').value = `${labels.customer}: ${customerName}`
  worksheet.getCell('A3').font = { bold: true }
  
  worksheet.mergeCells('D3:F3')
  worksheet.getCell('D3').value = `${labels.date}: ${formattedDate}`
  worksheet.getCell('D3').font = { bold: true }
  
  // 表头行
  const headerRow = worksheet.getRow(5)
  headerRow.values = [labels.containerNo, labels.billNo, labels.feeType, labels.amount, labels.discount, labels.finalAmount]
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  
  // 数据行
  let rowIndex = 6
  let currentContainerNo = ''
  let currentBillNo = ''
  
  for (const item of items) {
    const row = worksheet.getRow(rowIndex)
    
    // 获取集装箱号
    const itemContainerNo = item.containerNumber || containerNo || ''
    
    // 如果是同一个柜号/提单，不重复显示
    const showContainerNo = itemContainerNo !== currentContainerNo
    const showBillNo = item.billNumber !== currentBillNo
    
    if (showContainerNo) currentContainerNo = itemContainerNo
    if (showBillNo) currentBillNo = item.billNumber
    
    // 根据语言获取费用名称
    const feeName = await getFeeNameByLanguage(
      item.feeName || item.fee_name, 
      item.fee_name_en || item.feeNameEn, 
      language
    )

    const itemAmount = parseFloat(item.amount) || 0
    const itemDiscount = parseFloat(item.discountAmount) || 0
    const itemFinalAmount = item.finalAmount !== undefined 
      ? parseFloat(item.finalAmount) 
      : (itemAmount - itemDiscount)

    row.values = [
      showContainerNo ? itemContainerNo : '',
      showBillNo ? item.billNumber : '',
      feeName,
      itemAmount,
      itemDiscount !== 0 ? itemDiscount : '',
      itemFinalAmount
    ]
    
    // 设置边框
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
    
    // 金额右对齐
    row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(4).numFmt = '#,##0.00'
    row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(5).numFmt = '#,##0.00'
    // 优惠列用橙色
    if (itemDiscount !== 0) {
      row.getCell(5).font = { color: { argb: 'FFE67E22' } }
    }
    row.getCell(6).alignment = { horizontal: 'right' }
    row.getCell(6).numFmt = '#,##0.00'
    
    rowIndex++
  }
  
  // 合计行
  const totalRow = worksheet.getRow(rowIndex)
  totalRow.values = ['', '', '', '', labels.total, total]
  totalRow.font = { bold: true }
  totalRow.getCell(5).alignment = { horizontal: 'right' }
  totalRow.getCell(6).alignment = { horizontal: 'right' }
  totalRow.getCell(6).numFmt = '#,##0.00'
  totalRow.eachCell(cell => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })
  
  // 生成Buffer - 确保返回 Node.js Buffer（COS SDK 需要）
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 从费用记录生成发票数据
 */
export async function prepareInvoiceData(feeIds, customerId) {
  const db = getDatabase()
  // 获取费用记录
  const placeholders = feeIds.map(() => '?').join(',')
  const fees = await db.prepare(`
    SELECT f.*, b.container_number, b.bill_number
    FROM fees f
    LEFT JOIN bills_of_lading b ON f.bill_id = b.id
    WHERE f.id IN (${placeholders})
    ORDER BY b.container_number, f.fee_name
  `).all(...feeIds)
  
  if (!fees || fees.length === 0) {
    throw new Error('未找到费用记录')
  }
  
  // 获取客户信息
  let customer = null
  if (customerId) {
    customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId)
  }
  if (!customer && fees[0].customer_id) {
    customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(fees[0].customer_id)
  }
  
  // 提取柜号列表
  const containerNumbers = [...new Set(fees.map(f => f.container_number).filter(Boolean))]
  
  // 汇总费用（用于PDF显示）
  const summarizedItems = summarizeFees(fees)
  
  // 原始费用明细（不合并，每个费用一行，用于发票详情显示）
  const originalItems = fees.map(fee => ({
    description: fee.fee_name || fee.feeName || 'Other',
    descriptionEn: fee.fee_name_en || fee.feeNameEn || null,
    quantity: 1,
    unitValue: parseFloat(fee.amount) || 0,
    amount: parseFloat(fee.amount) || 0,
    containerNumber: fee.container_number,
    billNumber: fee.bill_number
  }))
  
  // 计算总金额
  const total = fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0)
  
  return {
    customer: {
      id: customer?.id,
      // 发票优先使用公司全称(company_name)，如果没有则使用客户名称(customer_name)
      name: customer?.company_name || customer?.customer_name || fees[0].customer_name || '',
      address: customer?.address || ''
    },
    containerNumbers,
    fees,
    summarizedItems,
    originalItems,
    total,
    currency: fees[0]?.currency || 'EUR'
  }
}

/**
 * 完整的发票生成流程
 * 1. 生成发票编号
 * 2. 准备发票数据
 * 3. 生成PDF和Excel
 * 4. 上传到COS
 * 5. 保存发票记录
 */
export async function createInvoiceWithFiles(feeIds, customerId, options = {}) {
  const db = getDatabase()
  // 1. 生成发票编号
  const invoiceNumber = await generateInvoiceNumber()
  const invoiceDate = new Date().toISOString().split('T')[0]
  
  // 2. 准备发票数据
  const invoiceData = await prepareInvoiceData(feeIds, customerId)
  
  // 3. 生成PDF
  const pdfData = {
    invoiceNumber,
    invoiceDate,
    customer: invoiceData.customer,
    containerNumbers: invoiceData.containerNumbers,
    items: invoiceData.summarizedItems,
    subtotal: invoiceData.total,
    total: invoiceData.total,
    currency: invoiceData.currency,
    exchangeRate: invoiceData.exchangeRate || 1
  }

  const pdfBuffer = await generatePDF(pdfData)

  // 4. 生成Excel
  // 获取发票语言设置（从 options 或使用默认英文）
  const invoiceLanguage = options.language || 'en'
  
  const excelData = {
    customerName: invoiceData.customer.name,
    date: invoiceDate,
    items: invoiceData.fees.map(f => ({
      containerNumber: f.container_number,
      billNumber: f.bill_number,
      feeName: f.fee_name,
      feeNameEn: f.fee_name_en,
      amount: f.amount
    })),
    total: invoiceData.total,
    currency: invoiceData.currency,
    language: invoiceLanguage  // 账单语言与发票保持一致
  }
  
  const excelBuffer = await generateExcel(excelData)
  
  // 5. 上传到COS并记录到文档管理
  let pdfUrl = null
  let excelUrl = null
  let pdfDocumentId = null
  
  const cosConfig = cosStorage.checkCosConfig()
  if (cosConfig.configured) {
    try {
      // 使用统一文档服务上传发票PDF
      const documentService = await import('../../../services/documentService.js')
      
      const docResult = await documentService.uploadInvoice({
        fileBuffer: pdfBuffer,
        fileName: `${invoiceNumber}.pdf`,
        invoiceNumber,
        billId: invoiceData.fees[0]?.bill_id,
        billNumber: invoiceData.fees[0]?.bill_number,
        customerId: invoiceData.customer.id,
        customerName: invoiceData.customer.name
      })
      
      pdfUrl = docResult.cosUrl
      pdfDocumentId = docResult.documentId
      console.log('✅ 发票PDF已同步到文档管理:', pdfDocumentId)
      
      // Excel对账单继续使用原COS存储（不需要进文档管理）
      excelUrl = await cosStorage.uploadStatementExcel(excelBuffer, invoiceNumber)
    } catch (error) {
      console.error('上传到COS失败:', error)
      // 继续执行，即使上传失败也保存发票记录
    }
  } else {
    console.warn('COS未配置，跳过文件上传')
  }
  
  // 6. 保存发票记录
  const invoiceId = generateId()
  const now = new Date().toISOString()
  
  await db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, invoice_type, customer_id, customer_name, customer_address,
      container_numbers, invoice_date, subtotal, total_amount, currency, items, fee_ids,
      pdf_url, excel_url, pdf_generated_at, excel_generated_at, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceId,
    invoiceNumber,
    'sales',
    invoiceData.customer.id || null,
    invoiceData.customer.name,
    invoiceData.customer.address,
    JSON.stringify(invoiceData.containerNumbers),
    invoiceDate,
    invoiceData.total,
    invoiceData.total,
    invoiceData.currency,
    JSON.stringify(invoiceData.originalItems),
    JSON.stringify(feeIds),
    pdfUrl,
    excelUrl,
    pdfUrl ? now : null,
    excelUrl ? now : null,
    'issued',
    now,
    now
  )
  
  // 7. 更新费用记录的发票状态（支持部分开票）
  for (const feeId of feeIds) {
    try {
      // 获取当前费用信息
      const fee = await db.prepare(`SELECT amount, invoiced_amount FROM fees WHERE id = ?`).get(feeId)
      if (!fee) {
        console.warn(`[createInvoiceWithFiles] 费用 ${feeId} 未找到`)
        continue
      }
      
      const feeAmount = parseFloat(fee.amount) || 0
      const currentInvoicedAmount = parseFloat(fee.invoiced_amount) || 0
      const newInvoicedAmount = currentInvoicedAmount + feeAmount // 本次开票金额 = 费用全额
      
      // 🔥 只有当累计开票金额 >= 费用金额时，才标记为已完全开票
      const newInvoiceStatus = newInvoicedAmount >= feeAmount ? 'invoiced' : 'partial_invoiced'
      
      await db.prepare(`
        UPDATE fees SET 
          invoiced_amount = ?,
          invoice_status = ?,
          invoice_number = CASE 
            WHEN invoice_number IS NULL OR invoice_number = '' THEN ?
            ELSE invoice_number || ',' || ?
          END,
          invoice_date = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        newInvoicedAmount,
        newInvoiceStatus,
        invoiceNumber, invoiceNumber,
        invoiceDate,
        now,
        feeId
      )
      console.log(`[createInvoiceWithFiles] 成功更新费用 ${feeId}: 累计开票 ${newInvoicedAmount}/${feeAmount}, 状态 ${newInvoiceStatus}`)
    } catch (e) {
      console.error(`[createInvoiceWithFiles] 更新费用 ${feeId} 开票状态失败:`, e)
    }
  }
  
  return {
    id: invoiceId,
    invoiceNumber,
    invoiceDate,
    customer: invoiceData.customer,
    containerNumbers: invoiceData.containerNumbers,
    items: invoiceData.originalItems,
    feeDetails: invoiceData.fees,
    total: invoiceData.total,
    currency: invoiceData.currency,
    pdfUrl,
    excelUrl,
    pdfDocumentId, // 文档管理系统中的ID
    status: 'issued'
  }
}

/**
 * 重新生成发票文件（不创建新发票）
 */
export async function regenerateInvoiceFiles(invoiceId) {
  const db = getDatabase()
  console.log(`[regenerateInvoiceFiles] 开始处理发票: ${invoiceId}`)
  
  // 获取发票记录
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId)
  if (!invoice) {
    throw new Error('发票不存在')
  }
  console.log(`[regenerateInvoiceFiles] 发票类型: ${invoice.invoice_type}, 编号: ${invoice.invoice_number}`)

  // 根据发票类型确定要筛选的费用类型
  // sales = 销售发票(应收) -> fee_type = 'receivable'
  // purchase = 采购发票(应付) -> fee_type = 'payable'
  const targetFeeType = invoice.invoice_type === 'purchase' ? 'payable' : 'receivable'
  console.log(`[regenerateInvoiceFiles] 目标费用类型: ${targetFeeType}`)

  // 尝试解析fee_ids
  let feeIds = []
  try {
    feeIds = JSON.parse(invoice.fee_ids || '[]')
  } catch {
    feeIds = []
  }

  let items = []
  let invoiceData = null
  let fees = [] // 存储原始费用记录，用于 Excel

  // 【重要】优先使用 items 字段，因为它包含用户保存的完整数据（包括手动添加的项目）
  // 只有在 items 为空时，才从 fees 表或 bill_id 获取数据
  let parsedItems = []
  try {
    parsedItems = JSON.parse(invoice.items || '[]')
  } catch {
    parsedItems = []
  }

  if (parsedItems.length > 0) {
    // 从 items 字段获取费用明细（包含手动添加的项目）
    console.log(`[regenerateInvoiceFiles] 从 items 字段获取到 ${parsedItems.length} 条费用明细`)
    const feeGroups = {}
    parsedItems.forEach(item => {
      const feeName = item.description?.trim() || item.fee_name?.trim() || '费用'
      const amount = parseFloat(item.amount) || 0
      const discountAmt = parseFloat(item.discountAmount) || 0
      const finalAmt = item.finalAmount !== undefined 
        ? parseFloat(item.finalAmount) 
        : (amount - discountAmt)
      if (!feeGroups[feeName]) {
        feeGroups[feeName] = {
          description: feeName,
          quantity: 0,
          totalAmount: 0,
          totalDiscount: 0,
          totalFinal: 0
        }
      }
      feeGroups[feeName].quantity += (item.quantity || 1)
      feeGroups[feeName].totalAmount += amount
      feeGroups[feeName].totalDiscount += discountAmt
      feeGroups[feeName].totalFinal += finalAmt
    })

    items = Object.values(feeGroups).map(group => ({
      description: group.description,
      quantity: group.quantity,
      unitValue: group.totalAmount / group.quantity,
      amount: group.totalAmount,
      discountAmount: group.totalDiscount,
      finalAmount: group.totalFinal
    }))
    console.log(`[regenerateInvoiceFiles] 合并后 items: ${items.length} 条`)
    
    // 同时获取 fees 用于 Excel（如果有的话）
    if (feeIds.length > 0) {
      const placeholders = feeIds.map(() => '?').join(',')
      fees = await db.prepare(`
        SELECT f.*, b.container_number, b.bill_number
        FROM fees f
        LEFT JOIN bills_of_lading b ON f.bill_id = b.id
        WHERE f.id IN (${placeholders}) 
          AND (f.fee_type = ? OR f.fee_type IS NULL)
        ORDER BY f.fee_name
      `).all(...feeIds, targetFeeType)
    }
  } else if (feeIds.length > 0) {
    // items 为空，有关联费用记录，使用费用数据（但要过滤费用类型）
    const placeholders = feeIds.map(() => '?').join(',')
    fees = await db.prepare(`
      SELECT f.*, b.container_number, b.bill_number
      FROM fees f
      LEFT JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE f.id IN (${placeholders}) 
        AND (f.fee_type = ? OR f.fee_type IS NULL)
      ORDER BY f.fee_name
    `).all(...feeIds, targetFeeType)
    
    if (fees.length > 0) {
      items = summarizeFees(fees)
    }
    console.log(`[regenerateInvoiceFiles] 从 fee_ids 获取到 ${fees.length} 条${targetFeeType}费用`)
  } else if (invoice.bill_number || invoice.bill_id) {
    // items 和 fee_ids 都为空，从关联的提单获取费用
    // 支持多个提单（bill_number 逗号分隔）
    let billIds = []
    
    if (invoice.bill_number && invoice.bill_number.includes(',')) {
      // 多个提单号，需要查找对应的 billId
      const billNumbers = invoice.bill_number.split(',').map(bn => bn.trim()).filter(Boolean)
      console.log(`[regenerateInvoiceFiles] 发票关联多个提单: ${billNumbers.join(', ')}`)
      
      for (const billNumber of billNumbers) {
        const bill = await db.prepare('SELECT id FROM bills_of_lading WHERE bill_number = ?').get(billNumber)
        if (bill) {
          billIds.push(bill.id)
        }
      }
      console.log(`[regenerateInvoiceFiles] 找到 ${billIds.length} 个有效的 billId`)
  } else if (invoice.bill_id) {
      billIds = [invoice.bill_id]
    }
    
    // 从所有关联的 billId 获取费用
    if (billIds.length > 0) {
      const placeholders = billIds.map(() => '?').join(',')
    fees = await db.prepare(`
      SELECT f.*, b.container_number, b.bill_number
      FROM fees f
      LEFT JOIN bills_of_lading b ON f.bill_id = b.id
        WHERE f.bill_id IN (${placeholders}) 
        AND (f.fee_type = ? OR f.fee_type IS NULL)
      ORDER BY f.fee_name
      `).all(...billIds, targetFeeType)
      console.log(`[regenerateInvoiceFiles] 从 ${billIds.length} 个 billId 获取到 ${fees.length} 条${targetFeeType}费用`)
    }
    
    if (fees.length > 0) {
      // 按费用类型分组合并（用于 PDF 显示）
      const feeGroups = {}
      fees.forEach(fee => {
        const feeName = fee.fee_name || 'Other'
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = {
            description: feeName,
            descriptionEn: fee.fee_name_en || null,
            quantity: 0,
            totalAmount: 0
          }
        }
        feeGroups[feeName].quantity += 1
        feeGroups[feeName].totalAmount += parseFloat(fee.amount) || 0
      })
      
      // 计算总优惠金额（subtotal - total）
      const invoiceSubtotal = parseFloat(invoice.subtotal) || 0
      const invoiceTotal = parseFloat(invoice.total_amount) || 0
      const totalDiscount = invoiceSubtotal - invoiceTotal
      
      console.log(`[regenerateInvoiceFiles] 计算优惠: subtotal=${invoiceSubtotal}, total=${invoiceTotal}, totalDiscount=${totalDiscount}`)
      
      // 如果有优惠，分配到特定费用类型（税号使用费、进口商代理费等）
      let discountByFeeType = {}
      if (totalDiscount > 0.01) {
        const targetFeeKeywords = ['税号', '进口商代理', '代理费']
        const eligibleFeeTypes = Object.keys(feeGroups).filter(feeName =>
          targetFeeKeywords.some(keyword => feeName.includes(keyword))
        )
        
        console.log(`[regenerateInvoiceFiles] 优惠分配目标费用类型:`, eligibleFeeTypes)
        
        if (eligibleFeeTypes.length > 0) {
          // 平均分配到各个目标费用类型
          const discountPerFeeType = totalDiscount / eligibleFeeTypes.length
          eligibleFeeTypes.forEach(feeName => {
            discountByFeeType[feeName] = discountPerFeeType
          })
        }
      }
      
      items = Object.values(feeGroups).map(group => {
        const discountAmt = discountByFeeType[group.description] || 0
        const finalAmt = group.totalAmount - discountAmt
        console.log(`[regenerateInvoiceFiles] "${group.description}": amount=${group.totalAmount}, discount=${discountAmt}, final=${finalAmt}`)
        return {
          description: group.description,
          descriptionEn: group.descriptionEn,
          quantity: group.quantity,
          unitValue: group.totalAmount / group.quantity,
          amount: group.totalAmount,
          discountAmount: discountAmt,
          finalAmount: finalAmt
        }
      })
    }
  }
  
  // 如果还是没有费用数据，使用后备方案
  if (items.length === 0) {
    items = [{
      description: '服务费',
      quantity: 1,
      unitValue: parseFloat(invoice.total_amount) || 0,
      amount: parseFloat(invoice.total_amount) || 0
    }]
    console.log(`[regenerateInvoiceFiles] 使用后备方案，生成默认费用项`)
  }

  // 获取关联订单的柜号
  let containerNumbers = []
  try {
    containerNumbers = JSON.parse(invoice.container_numbers || '[]')
  } catch {
    containerNumbers = []
  }
  
  if (containerNumbers.length === 0 && invoice.bill_id) {
    const bill = await db.prepare('SELECT container_number FROM bills_of_lading WHERE id = ?').get(invoice.bill_id)
    if (bill && bill.container_number) {
      containerNumbers.push(bill.container_number)
    }
  }

  // 计算账期天数（如果有到期日期）
  let paymentDays = null
  if (invoice.due_date && invoice.invoice_date) {
    const invoiceDateObj = new Date(invoice.invoice_date)
    const dueDateObj = new Date(invoice.due_date)
    paymentDays = Math.ceil((dueDateObj.getTime() - invoiceDateObj.getTime()) / (1000 * 60 * 60 * 24))
    if (paymentDays <= 0) paymentDays = null
  }

  // 获取客户信息（如果发票中没有，从 customers 表获取）
  let customerAddress = invoice.customer_address || ''
  let customerName = invoice.customer_name || ''
  const invoiceLanguage = invoice.language || 'en'
  
  if (invoice.customer_id) {
    const customer = await db.prepare('SELECT company_name, company_name_en, customer_name, address, city, country_code FROM customers WHERE id = ?').get(invoice.customer_id)
    if (customer) {
      // 根据发票语言选择客户名称
      if (invoiceLanguage === 'en') {
        // 英文发票：优先使用英文公司名称
        customerName = customer.company_name_en || customer.company_name || customer.customer_name || customerName
      } else {
        // 中文发票：使用中文公司名称
        customerName = customer.company_name || customer.customer_name || customerName
      }
      if (!customerAddress) {
        // 根据发票语言获取国家名称
        let countryName = customer.country_code || ''
        if (customer.country_code) {
          // 先按国家代码查询，如果找不到再按中文名称查询
          let country = await db.prepare('SELECT country_name_cn, country_name_en FROM countries WHERE country_code = ?').get(customer.country_code)
          if (!country) {
            country = await db.prepare('SELECT country_name_cn, country_name_en FROM countries WHERE country_name_cn = ?').get(customer.country_code)
          }
          if (country) {
            countryName = invoiceLanguage === 'en' ? (country.country_name_en || customer.country_code) : (country.country_name_cn || customer.country_code)
          }
        }
        const addressParts = [customer.address, customer.city, countryName].filter(Boolean)
        customerAddress = addressParts.join(', ')
      }
    }
  }

  // 从数据库获取发票模板配置
  const invoiceLang = invoice.language || 'en'
  // 获取发票模版配置
  let companyInfo = null
  try {
    // 优先使用发票指定的模版ID，否则使用默认模版
    const templateId = invoice.template_id || null
    const dbTemplate = await getInvoiceTemplateById(templateId, invoiceLang)
    if (dbTemplate) {
      companyInfo = convertTemplateToCompanyInfo(dbTemplate)
      console.log(`[regenerateInvoiceFiles] 从数据库获取到发票模板配置，模版ID: ${templateId || '默认'}, 语言: ${invoiceLang}`)
    } else {
      console.log(`[regenerateInvoiceFiles] 数据库没有模板配置，使用默认配置`)
    }
  } catch (templateError) {
    console.error('[regenerateInvoiceFiles] 获取发票模板失败:', templateError.message)
  }

  // 生成PDF
  // subtotal = 优惠前金额（明细合计），total = 优惠后金额（最终金额）
  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date || null,
    paymentDays: paymentDays,
    customer: {
      name: customerName,
      address: customerAddress
    },
    containerNumbers,
    items,
    subtotal: parseFloat(invoice.subtotal) || parseFloat(invoice.total_amount) || 0,
    total: parseFloat(invoice.total_amount) || 0,
    currency: invoice.currency || 'EUR',
    exchangeRate: parseFloat(invoice.exchange_rate) || 1,
    language: invoiceLang,  // 发票语言
    companyInfo  // 从数据库获取的公司信息模板
  }

  console.log(`[regenerateInvoiceFiles] 准备生成 PDF, items 数量: ${items.length}, 客户: ${pdfData.customer.name}, 语言: ${pdfData.language}`)
  console.log(`[regenerateInvoiceFiles] 开始生成 PDF...`)
  const pdfBuffer = await generatePDF(pdfData)
  console.log(`[regenerateInvoiceFiles] PDF 生成成功, 大小: ${pdfBuffer?.length || 0} bytes`)

  // 生成Excel
  // Excel 显示所有原始费用（不合并），每项都有自己的集装箱号和提单号
  let excelItems = []
  
  // 计算总优惠金额（subtotal - total）
  const invoiceSubtotal = parseFloat(invoice.subtotal) || 0
  const invoiceTotal = parseFloat(invoice.total_amount) || 0
  const totalDiscountForExcel = invoiceSubtotal - invoiceTotal
  
  // 【重要】优先使用 parsedItems（从 items 字段解析的原始数据），包含手动添加的项目
  // 同时尝试从发票的 containerNumbers 和 billNumber 字段获取默认值
  const defaultContainerNo = containerNumbers.length > 0 ? containerNumbers[0] : ''
  const defaultBillNo = invoice.bill_number || ''
  
  // 检查 parsedItems 是否是汇总数据（没有 containerNumber 或者有 quantity > 1）
  const isAggregatedItems = parsedItems && parsedItems.length > 0 && 
    parsedItems.every(item => !item.containerNumber) && 
    parsedItems.some(item => (item.quantity || 1) > 1)
  
  // 如果 items 是汇总数据且有关联的 bill_id，尝试从 fees 表获取明细
  let detailedFeesFromDb = []
  if (isAggregatedItems && invoice.bill_id) {
    const billIds = invoice.bill_id.split(',').map(id => id.trim()).filter(Boolean)
    
    // 获取 items 中的费用名称列表
    const itemFeeNames = parsedItems.map(item => item.description?.trim()).filter(Boolean)
    
    if (billIds.length > 0) {
      // 从 fees 表获取这些 bill_id 对应的详细费用
      // 【重要】必须按费用类型筛选，避免销售发票获取到应付费用导致重复
      const placeholders = billIds.map(() => '?').join(',')
      const feesQuery = `
        SELECT f.fee_name, f.amount, b.container_number, b.bill_number
        FROM fees f
        JOIN bills_of_lading b ON f.bill_id = b.id
        WHERE b.id IN (${placeholders})
          AND (f.fee_type = ? OR f.fee_type IS NULL)
        ORDER BY b.container_number, f.fee_name
      `
      const allFees = await db.prepare(feesQuery).all(...billIds, targetFeeType)
      
      // 只保留 items 中存在的费用类型（修复运算符优先级问题）
      detailedFeesFromDb = allFees.filter(f => 
        itemFeeNames.some(name => (f.fee_name && f.fee_name.includes(name)) || (name && name.includes(f.fee_name)))
      )
      
      console.log(`[regenerateInvoiceFiles] 从 fees 表获取明细: 查询到 ${allFees.length} 条, 过滤后 ${detailedFeesFromDb.length} 条 (费用类型: ${targetFeeType})`)
    }
  }
  
  if (detailedFeesFromDb.length > 0) {
    // 使用从 fees 表获取的详细数据（按集装箱展开的明细）
    console.log(`[regenerateInvoiceFiles] Excel 使用 fees 表明细数据，共 ${detailedFeesFromDb.length} 条`)
    excelItems = detailedFeesFromDb.map(f => ({
      containerNumber: f.container_number || '',
      billNumber: f.bill_number || '',
      feeName: f.fee_name || 'Other',
      feeNameEn: null,
      amount: parseFloat(f.amount) || 0,
      discountAmount: 0,
      finalAmount: parseFloat(f.amount) || 0
    }))
    // 按集装箱号排序
    excelItems.sort((a, b) => (a.containerNumber || '').localeCompare(b.containerNumber || ''))
  } else if (parsedItems && parsedItems.length > 0) {
    // 使用 items 字段的数据（包含手动添加的项目）
    console.log(`[regenerateInvoiceFiles] Excel 使用 items 字段数据，共 ${parsedItems.length} 条`)
    excelItems = parsedItems.map(item => ({
      // 如果 item 没有 containerNumber，使用发票的默认值
      containerNumber: item.containerNumber || defaultContainerNo || '',
      billNumber: item.billNumber || defaultBillNo || '',
      feeName: item.description || 'Other',
      feeNameEn: item.descriptionEn || null,
      amount: parseFloat(item.amount) || 0,
      discountAmount: parseFloat(item.discountAmount) || 0,
      finalAmount: item.finalAmount !== undefined 
        ? parseFloat(item.finalAmount) 
        : (parseFloat(item.amount) || 0) - (parseFloat(item.discountAmount) || 0)
    }))
    // 按集装箱号排序
    excelItems.sort((a, b) => (a.containerNumber || '').localeCompare(b.containerNumber || ''))
  } else if (fees && fees.length > 0) {
    // items 为空，使用 fees 表数据
    console.log(`[regenerateInvoiceFiles] Excel 使用 fees 表数据，共 ${fees.length} 条`)
    
    // 统计每个费用类型出现的次数
    const feeTypeCounts = {}
    fees.forEach(f => {
      const feeName = f.fee_name || 'Other'
      feeTypeCounts[feeName] = (feeTypeCounts[feeName] || 0) + 1
    })
    
    // 计算优惠分配
    let discountByFeeType = {}
    if (totalDiscountForExcel > 0.01) {
      const targetFeeKeywords = ['税号', '进口商代理', '代理费']
      const eligibleFeeTypes = Object.keys(feeTypeCounts).filter(feeName =>
        targetFeeKeywords.some(keyword => feeName.includes(keyword))
      )
      
      if (eligibleFeeTypes.length > 0) {
        // 平均分配到各个目标费用类型
        const discountPerFeeType = totalDiscountForExcel / eligibleFeeTypes.length
        eligibleFeeTypes.forEach(feeName => {
          // 再按该费用类型的数量平均分配到每一行
          const count = feeTypeCounts[feeName] || 1
          discountByFeeType[feeName] = discountPerFeeType / count
        })
      }
    }
    
    excelItems = fees.map(f => {
      const feeName = f.fee_name || 'Other'
      const amount = parseFloat(f.amount) || 0
      const discountAmt = discountByFeeType[feeName] || 0
      
      return {
        containerNumber: f.container_number || '',
        billNumber: f.bill_number || '',
        feeName: feeName,
        feeNameEn: f.fee_name_en || null,
        amount: amount,
        discountAmount: discountAmt,
        finalAmount: amount - discountAmt
      }
    })
    // 按集装箱号排序，让同一个柜子的费用显示在一起
    excelItems.sort((a, b) => (a.containerNumber || '').localeCompare(b.containerNumber || ''))
  } else {
    // 最后使用已处理的 items 数据
    excelItems = items.map(item => ({
      containerNumber: item.containerNumber || '',
      billNumber: item.billNumber || '',
      feeName: item.description,
      feeNameEn: item.descriptionEn || null,
      amount: item.amount,
      discountAmount: item.discountAmount || 0,
      finalAmount: item.finalAmount || item.amount
    }))
  }

  // 获取客户全称（优先使用 company_name，否则使用 customer_name）
  let customerFullName = invoice.customer_name || ''
  if (invoice.customer_id) {
    const customer = await db.prepare('SELECT company_name, customer_name FROM customers WHERE id = ?').get(invoice.customer_id)
    if (customer) {
      // 优先使用公司全称 company_name，如果没有则用 customer_name
      customerFullName = customer.company_name || customer.customer_name || invoice.customer_name || ''
    }
  }

  const excelData = {
    customerName: customerFullName,
    date: invoice.invoice_date,
    items: excelItems,
    total: invoiceData ? invoiceData.total : (parseFloat(invoice.total_amount) || 0),
    currency: invoice.currency || 'EUR',
    language: invoice.language || 'en'  // 账单语言与发票保持一致
  }

  console.log(`[regenerateInvoiceFiles] 开始生成 Excel, 客户全称: ${customerFullName}, 语言: ${excelData.language}`)
  const excelBuffer = await generateExcel(excelData)
  console.log(`[regenerateInvoiceFiles] Excel 生成成功, 大小: ${excelBuffer?.length || 0} bytes`)

  // 上传到COS或保存到本地
  let pdfUrl = null
  let excelUrl = null
  
  const cosConfig = cosStorage.checkCosConfig()
  console.log(`[regenerateInvoiceFiles] COS 配置状态: ${cosConfig.configured ? '已配置' : '未配置'}`)
  
  if (cosConfig.configured) {
    // 尝试上传到 COS
    try {
      console.log(`[regenerateInvoiceFiles] 正在上传 PDF 到 COS...`)
      pdfUrl = await cosStorage.uploadInvoicePDF(pdfBuffer, invoice.invoice_number)
      console.log(`[regenerateInvoiceFiles] PDF 上传成功: ${pdfUrl}`)
    } catch (pdfError) {
      console.error('[regenerateInvoiceFiles] PDF上传到COS失败:', pdfError.message || pdfError)
    }
    
    try {
      console.log(`[regenerateInvoiceFiles] 正在上传 Excel 到 COS...`)
      excelUrl = await cosStorage.uploadStatementExcel(excelBuffer, invoice.invoice_number)
      console.log(`[regenerateInvoiceFiles] Excel 上传成功: ${excelUrl}`)
    } catch (excelError) {
      console.error('[regenerateInvoiceFiles] Excel上传到COS失败:', excelError.message || excelError)
    }
    
    // 如果 COS 上传失败，尝试本地存储
    if (!pdfUrl || !excelUrl) {
      console.log(`[regenerateInvoiceFiles] COS 上传部分失败，尝试本地存储...`)
      try {
        if (!pdfUrl) {
          pdfUrl = await saveFileLocally(pdfBuffer, `${invoice.invoice_number}.pdf`)
          console.log(`[regenerateInvoiceFiles] PDF 本地保存成功: ${pdfUrl}`)
        }
        if (!excelUrl) {
          excelUrl = await saveFileLocally(excelBuffer, `${invoice.invoice_number}_statement.xlsx`)
          console.log(`[regenerateInvoiceFiles] Excel 本地保存成功: ${excelUrl}`)
        }
      } catch (localError) {
        console.error('[regenerateInvoiceFiles] 本地存储也失败:', localError.message || localError)
      }
    }
  } else {
    // COS未配置，使用本地存储
    console.log(`[regenerateInvoiceFiles] 使用本地存储...`)
    try {
      pdfUrl = await saveFileLocally(pdfBuffer, `${invoice.invoice_number}.pdf`)
      console.log(`[regenerateInvoiceFiles] PDF 本地保存成功: ${pdfUrl}`)
      excelUrl = await saveFileLocally(excelBuffer, `${invoice.invoice_number}_statement.xlsx`)
      console.log(`[regenerateInvoiceFiles] Excel 本地保存成功: ${excelUrl}`)
    } catch (error) {
      console.error('[regenerateInvoiceFiles] 本地存储失败:', error.message || error)
    }
  }
  
  // 更新发票记录（只更新文件URL，不覆盖原始 items 数据）
  // 【重要】不要更新 items 字段！items 包含原始的详细费用数据（含 containerNumber、billNumber）
  // 如果覆盖成合并后的 items，会丢失这些重要信息
  try {
    const updateFields = []
    const updateValues = []
    
    if (pdfUrl) {
      updateFields.push('pdf_url = ?')
      updateValues.push(pdfUrl)
    }
    if (excelUrl) {
      updateFields.push('excel_url = ?')
      updateValues.push(excelUrl)
    }
    
    if (updateFields.length > 0) {
      updateValues.push(invoiceId)
      await db.prepare(`UPDATE invoices SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues)
      console.log(`[发票文件生成] 数据库已更新: ${updateFields.join(', ')}`)
    }
  } catch (dbError) {
    console.error('更新数据库失败:', dbError)
  }
  
  return {
    id: invoiceId,
    invoiceNumber: invoice.invoice_number,
    pdfUrl,
    excelUrl,
    items
  }
}

/**
 * 获取发票文件的临时下载URL
 */
export async function getInvoiceDownloadUrl(invoiceId, fileType = 'pdf') {
  const db = getDatabase()
  const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId)
  if (!invoice) {
    throw new Error('发票不存在')
  }

  const url = fileType === 'excel' ? invoice.excel_url : invoice.pdf_url
  if (!url) {
    throw new Error(`发票${fileType === 'excel' ? 'Excel' : 'PDF'}文件不存在`)
  }

  // 如果是本地文件路径（以/api/开头），返回相对路径
  if (url.startsWith('/api/')) {
    return url
  }

  // 如果COS配置了，生成带签名的临时URL
  const cosConfig = cosStorage.checkCosConfig()
  if (cosConfig.configured) {
    const key = cosStorage.extractKeyFromUrl(url)
    if (key) {
      return await cosStorage.getSignedUrl(key, 3600) // 1小时有效
    }
  }

  // 否则返回原始URL
  return url
}

/**
 * 为新创建的发票生成PDF和Excel文件
 * @param {string} invoiceId - 发票ID
 * @param {object} invoiceData - 发票数据（从前端传入的创建数据）
 * @returns {Promise<{pdfUrl: string|null, excelUrl: string|null}>}
 */
export async function generateFilesForNewInvoice(invoiceId, invoiceData) {
  const db = getDatabase()
  console.log(`[发票文件生成] 开始为发票 ${invoiceId} 生成文件...`)
  try {
    // 获取完整的发票记录
    const invoice = await db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId)
    if (!invoice) {
      console.error('[发票文件生成] 失败: 发票不存在', invoiceId)
      return { pdfUrl: null, excelUrl: null }
    }
    console.log(`[发票文件生成] 找到发票: ${invoice.invoice_number}`)

    // 解析 items 数据
    // 优先级：1. 数据库中的 invoice.items 字段  2. 传入的 invoiceData.items  3. description 字段
    let items = []
    let rawItems = null
    
    // 首先尝试从数据库的 items 字段获取（这是最完整的数据）
    if (invoice.items) {
      try {
        rawItems = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items
        console.log(`[发票文件生成] 从数据库 items 字段获取到 ${rawItems?.length || 0} 条记录`)
      } catch (e) {
        console.log('[发票文件生成] 解析数据库 items 字段失败:', e.message)
      }
    }
    
    // 如果数据库没有，尝试从传入的 invoiceData 获取
    if (!rawItems && invoiceData.items) {
      try {
        rawItems = typeof invoiceData.items === 'string' ? JSON.parse(invoiceData.items) : invoiceData.items
        console.log(`[发票文件生成] 从传入数据获取到 ${rawItems?.length || 0} 条记录`)
      } catch (e) {
        console.log('[发票文件生成] 解析传入 items 失败:', e.message)
      }
    }
    
    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
      // 按费用类型分组合并
      const feeGroups = {}
      rawItems.forEach(item => {
        const feeName = item.description || 'Other'
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = {
            description: feeName,
            quantity: 0,
            totalAmount: 0
          }
        }
        // 使用 finalAmount 或 amount 字段
        const itemAmount = parseFloat(item.finalAmount) || parseFloat(item.amount) || 0
        feeGroups[feeName].quantity += (item.quantity || 1)
        feeGroups[feeName].totalAmount += itemAmount
      })
      // 转换为数组
      items = Object.values(feeGroups).map(group => ({
        description: group.description,
        quantity: group.quantity,
        unitValue: group.totalAmount / group.quantity,
        amount: group.totalAmount
      }))
      console.log(`[发票文件生成] 合并后 items: ${items.length} 条`)
    } else if (invoice.description) {
      // 备选方案：从 description 字段解析（格式：desc1; desc2; desc3）
      console.log('[发票文件生成] 使用 description 字段解析费用')
      const descriptions = invoice.description.split(';').filter(s => s.trim())
      // 按费用类型分组
      const feeGroups = {}
      const amountPerItem = invoice.total_amount / descriptions.length
      descriptions.forEach(desc => {
        const feeName = desc.trim()
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = {
            description: feeName,
            quantity: 0,
            totalAmount: 0
          }
        }
        feeGroups[feeName].quantity += 1
        feeGroups[feeName].totalAmount += amountPerItem
      })
      items = Object.values(feeGroups).map(group => ({
        description: group.description,
        quantity: group.quantity,
        unitValue: group.totalAmount / group.quantity,
        amount: group.totalAmount
      }))
    }

    // 获取关联订单的集装箱号
    // 优先使用发票记录中已保存的 container_numbers 字段
    let containerNumbers = []
    if (invoice.container_numbers) {
      try {
        const parsed = typeof invoice.container_numbers === 'string' 
          ? JSON.parse(invoice.container_numbers) 
          : invoice.container_numbers
        if (Array.isArray(parsed) && parsed.length > 0) {
          containerNumbers = parsed.filter(Boolean)
        }
      } catch (e) {
        console.log('[发票文件生成] 解析 container_numbers 失败:', e.message)
      }
    }
    
    // 如果没有从发票记录获取到，尝试从 items 中提取
    if (containerNumbers.length === 0 && invoiceData.items && Array.isArray(invoiceData.items)) {
      const containerSet = new Set()
      invoiceData.items.forEach(item => {
        if (item.containerNumber) {
          containerSet.add(item.containerNumber)
        }
      })
      containerNumbers = Array.from(containerSet)
    }
    
    // 最后备选：从关联的 bill_id 获取
    if (containerNumbers.length === 0 && invoice.bill_id) {
      const bill = await db.prepare('SELECT container_number FROM bills_of_lading WHERE id = ?').get(invoice.bill_id)
      if (bill && bill.container_number) {
        containerNumbers.push(bill.container_number)
      }
    }

    // 计算账期天数（如果有到期日期）
    let paymentDays = null
    if (invoice.due_date && invoice.invoice_date) {
      const invoiceDateObj = new Date(invoice.invoice_date)
      const dueDateObj = new Date(invoice.due_date)
      paymentDays = Math.ceil((dueDateObj.getTime() - invoiceDateObj.getTime()) / (1000 * 60 * 60 * 24))
      if (paymentDays <= 0) paymentDays = null
    }

    // 根据发票语言获取客户名称
    const invoiceLanguage = invoice.language || 'en'
    let customerName = invoice.customer_name || ''
    let customerAddress = invoice.customer_address || ''
    
    if (invoice.customer_id) {
      const customer = await db.prepare('SELECT company_name, company_name_en, customer_name, address, city, country_code FROM customers WHERE id = ?').get(invoice.customer_id)
      if (customer) {
        // 根据发票语言选择客户名称
        if (invoiceLanguage === 'en') {
          // 英文发票：优先使用英文公司名称
          customerName = customer.company_name_en || customer.company_name || customer.customer_name || customerName
        } else {
          // 中文发票：使用中文公司名称
          customerName = customer.company_name || customer.customer_name || customerName
        }
        if (!customerAddress) {
          // 根据发票语言获取国家名称
          let countryName = customer.country_code || ''
          if (customer.country_code) {
            // 先按国家代码查询，如果找不到再按中文名称查询
            let country = await db.prepare('SELECT country_name_cn, country_name_en FROM countries WHERE country_code = ?').get(customer.country_code)
            if (!country) {
              country = await db.prepare('SELECT country_name_cn, country_name_en FROM countries WHERE country_name_cn = ?').get(customer.country_code)
            }
            if (country) {
              countryName = invoiceLanguage === 'en' ? (country.country_name_en || customer.country_code) : (country.country_name_cn || customer.country_code)
            }
          }
          const addressParts = [customer.address, customer.city, countryName].filter(Boolean)
          customerAddress = addressParts.join(', ')
        }
      }
    }

    // 从数据库获取发票模板配置
    // 优先使用发票指定的模版ID，否则使用默认模版
    let companyInfo = null
    try {
      const templateId = invoice.template_id || null
      const dbTemplate = await getInvoiceTemplateById(templateId, invoiceLanguage)
      if (dbTemplate) {
        companyInfo = convertTemplateToCompanyInfo(dbTemplate)
        console.log(`[发票文件生成] 从数据库获取到发票模板配置，模版ID: ${templateId || '默认'}, 语言: ${invoiceLanguage}`)
      } else {
        console.log(`[发票文件生成] 数据库没有模板配置，使用默认配置`)
      }
    } catch (templateError) {
      console.error('[发票文件生成] 获取发票模板失败:', templateError.message)
    }

    // 准备PDF数据
    const pdfData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date || null,
      paymentDays: paymentDays,
      customer: {
        name: customerName,
        address: customerAddress
      },
      containerNumbers,
      items,
      subtotal: parseFloat(invoice.subtotal) || parseFloat(invoice.total_amount) || 0,
      total: parseFloat(invoice.total_amount) || 0,
      currency: invoice.currency || 'EUR',
      exchangeRate: parseFloat(invoice.exchange_rate) || 1,
      language: invoiceLanguage,
      companyInfo  // 从数据库获取的公司信息模板
    }

    // 生成PDF
    let pdfBuffer = null
    try {
      console.log('[发票文件生成] 正在生成PDF...')
      pdfBuffer = await generatePDF(pdfData)
      console.log('[发票文件生成] PDF生成成功，大小:', pdfBuffer?.length || 0, 'bytes')
    } catch (pdfError) {
      console.error('[发票文件生成] 生成PDF失败:', pdfError.message || pdfError)
    }

    // 准备Excel数据
    // 获取集装箱号和提单号
    const excelContainerNo = containerNumbers.length > 0 ? containerNumbers.join(', ') : ''
    
    // 获取提单号（优先使用发票记录中的 bill_number 字段）
    let blNumber = invoice.bill_number || ''
    if (!blNumber && invoice.bill_id) {
      const billInfo = await db.prepare('SELECT bill_number FROM bills_of_lading WHERE id = ?').get(invoice.bill_id)
      if (billInfo) {
        blNumber = billInfo.bill_number || ''
      }
    }

    // Excel 数据使用已解析的 items（复用上面的 rawItems）
    // 【重要】不要分组合并，保留每个费用项的集装箱号和提单号
    let excelItems = []
    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
      // 保留每个费用项的明细，不合并
      excelItems = rawItems.map(item => ({
        containerNumber: item.containerNumber || excelContainerNo || '',
        billNumber: item.billNumber || blNumber || '',
        feeName: item.description || 'Other',
        feeNameEn: item.descriptionEn || null,
        amount: parseFloat(item.amount) || 0,
        discountAmount: parseFloat(item.discountAmount) || 0,
        finalAmount: item.finalAmount !== undefined 
          ? parseFloat(item.finalAmount) 
          : (parseFloat(item.amount) || 0) - (parseFloat(item.discountAmount) || 0)
      }))
      // 按集装箱号排序，让同一个柜子的费用显示在一起
      excelItems.sort((a, b) => (a.containerNumber || '').localeCompare(b.containerNumber || ''))
    } else if (items.length > 0) {
      // 使用已处理的 items（从 description 解析的）
      excelItems = items.map(item => ({
        containerNumber: item.containerNumber || excelContainerNo || '',
        billNumber: item.billNumber || blNumber || '',
        feeName: item.description,
        feeNameEn: item.descriptionEn || null,
        amount: item.amount,
        discountAmount: item.discountAmount || 0,
        finalAmount: item.finalAmount || item.amount
      }))
    }

    const excelData = {
      customerName: invoice.customer_name || '',
      date: invoice.invoice_date,
      containerNo: excelContainerNo,
      items: excelItems,
      total: parseFloat(invoice.total_amount) || 0,
      currency: invoice.currency || 'EUR',
      language: invoiceLanguage  // 账单语言与发票保持一致
    }

    // 生成Excel
    let excelBuffer = null
    try {
      console.log(`[发票文件生成] 正在生成Excel, 语言: ${invoiceLanguage}...`)
      excelBuffer = await generateExcel(excelData)
      console.log('[发票文件生成] Excel生成成功，大小:', excelBuffer?.length || 0, 'bytes')
    } catch (excelError) {
      console.error('[发票文件生成] 生成Excel失败:', excelError.message || excelError)
    }

    // 上传到COS或保存到本地
    let pdfUrl = null
    let excelUrl = null

    const cosConfig = cosStorage.checkCosConfig()
    if (cosConfig.configured) {
      // 使用COS云存储
      try {
        if (pdfBuffer) {
          pdfUrl = await cosStorage.uploadInvoicePDF(pdfBuffer, invoice.invoice_number)
        }
        if (excelBuffer) {
          excelUrl = await cosStorage.uploadStatementExcel(excelBuffer, invoice.invoice_number)
        }
      } catch (uploadError) {
        console.error('上传到COS失败:', uploadError)
      }
    } else {
      // COS未配置，使用本地存储
      console.log('[发票文件生成] COS未配置，使用本地文件存储')
      try {
        if (pdfBuffer) {
          pdfUrl = await saveFileLocally(pdfBuffer, `${invoice.invoice_number}.pdf`)
          console.log('[发票文件生成] PDF已保存到本地:', pdfUrl)
        }
        if (excelBuffer) {
          excelUrl = await saveFileLocally(excelBuffer, `${invoice.invoice_number}_statement.xlsx`)
          console.log('[发票文件生成] Excel已保存到本地:', excelUrl)
        }
      } catch (localError) {
        console.error('[发票文件生成] 本地存储失败:', localError.message || localError)
      }
    }

    // 更新发票记录的文件URL
    console.log('[发票文件生成] 准备更新数据库，pdfUrl:', pdfUrl, 'excelUrl:', excelUrl)
    if (pdfUrl || excelUrl) {
      try {
        // 简化SQL，只更新URL字段
        if (pdfUrl && excelUrl) {
          await db.prepare(`
            UPDATE invoices SET pdf_url = ?, excel_url = ? WHERE id = ?
          `).run(pdfUrl, excelUrl, invoiceId)
          console.log('[发票文件生成] PDF和Excel URL已更新到数据库')
        } else if (pdfUrl) {
          await db.prepare(`
            UPDATE invoices SET pdf_url = ? WHERE id = ?
          `).run(pdfUrl, invoiceId)
          console.log('[发票文件生成] PDF URL已更新到数据库')
        } else if (excelUrl) {
          await db.prepare(`
            UPDATE invoices SET excel_url = ? WHERE id = ?
          `).run(excelUrl, invoiceId)
          console.log('[发票文件生成] Excel URL已更新到数据库')
        }
      } catch (dbError) {
        console.error('[发票文件生成] 更新数据库失败:', dbError.message || dbError)
      }
    }

    return { pdfUrl, excelUrl }
  } catch (error) {
    console.error('生成发票文件失败:', error)
    return { pdfUrl: null, excelUrl: null }
  }
}

export default {
  generateInvoiceNumber,
  summarizeFees,
  generatePDF,
  generateExcel,
  prepareInvoiceData,
  createInvoiceWithFiles,
  regenerateInvoiceFiles,
  getInvoiceDownloadUrl,
  generateFilesForNewInvoice
}
