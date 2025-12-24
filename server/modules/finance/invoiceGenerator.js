/**
 * 发票生成器
 * 
 * 生成PDF发票和Excel明细，并上传到腾讯云COS或保存到本地
 */

import puppeteer from 'puppeteer'
import ExcelJS from 'exceljs'
import { generateInvoiceHTML, COMPANY_INFO, getLogoBase64, getStampBase64 } from './invoiceTemplate.js'
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
  const html = generateInvoiceHTML(invoiceData)
  
  let browser = null
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
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
    
    // 确保返回 Node.js Buffer（COS SDK 需要）
    return Buffer.from(pdfData)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// 费用名称中英文映射
const FEE_NAME_MAP = {
  '堆场费': 'Terminal Handling Charge',
  '拖车费': 'Trucking Fee',
  '船公司运费': 'Ocean Freight',
  '海运费': 'Ocean Freight',
  '报关费': 'Customs Clearance Fee',
  '清关费': 'Customs Clearance Fee',
  '仓储费': 'Warehousing Fee',
  '装卸费': 'Loading/Unloading Fee',
  '保险费': 'Insurance Fee',
  '文件费': 'Documentation Fee',
  '操作费': 'Handling Fee',
  '代理费': 'Agency Fee',
  '港杂费': 'Port Charges',
  '查验费': 'Inspection Fee',
  '加班费': 'Overtime Fee',
  '滞港费': 'Demurrage Fee',
  '滞箱费': 'Detention Fee',
  '换单费': 'B/L Release Fee',
  '目的港费': 'Destination Charges',
  '起运港费': 'Origin Charges',
  '燃油附加费': 'Bunker Adjustment Factor',
  '其他费用': 'Other Charges'
}

// 获取费用的英文名称
// 优先级：1. fee_name_en 字段  2. FEE_NAME_MAP 映射  3. 原名
function getFeeNameEnglish(chineseName, feeNameEn = null) {
  // 如果已有英文名称字段，优先使用
  if (feeNameEn && feeNameEn.trim()) {
    return feeNameEn.trim()
  }
  
  if (!chineseName) return 'Other Charges'
  
  // 尝试直接匹配映射表
  if (FEE_NAME_MAP[chineseName]) {
    return FEE_NAME_MAP[chineseName]
  }
  // 尝试部分匹配
  for (const [cn, en] of Object.entries(FEE_NAME_MAP)) {
    if (chineseName.includes(cn)) {
      return en
    }
  }
  // 如果已经是英文，直接返回
  if (/^[a-zA-Z\s\/]+$/.test(chineseName)) {
    return chineseName
  }
  return chineseName // 没有匹配则返回原名
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
 */
export async function generateExcel(data) {
  const {
    customerName,
    date,
    items,
    total,
    currency = 'EUR',
    containerNo = ''  // 集装箱号
  } = data
  
  const formattedDate = formatExcelDate(date)
  
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Xianfeng International Logistics'
  workbook.created = new Date()
  
  const worksheet = workbook.addWorksheet('Statement of Account')
  
  // 设置列宽
  worksheet.columns = [
    { header: 'CONTAINER NO', key: 'containerNo', width: 20 },
    { header: 'BILL NO', key: 'billNo', width: 20 },
    { header: 'FEE TYPE', key: 'feeType', width: 30 },
    { header: `Amount ${currency}`, key: 'amount', width: 15 }
  ]
  
  // 标题行
  worksheet.mergeCells('A1:D1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'STATEMENT OF ACCOUNT'
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center' }
  
  // 客户信息行
  worksheet.mergeCells('A3:B3')
  worksheet.getCell('A3').value = `Customer: ${customerName}`
  worksheet.getCell('A3').font = { bold: true }
  
  worksheet.mergeCells('C3:D3')
  worksheet.getCell('C3').value = `Date: ${formattedDate}`
  worksheet.getCell('C3').font = { bold: true }
  
  // 表头行
  const headerRow = worksheet.getRow(5)
  headerRow.values = ['CONTAINER NO', 'BILL NO', 'FEE TYPE', `Amount ${currency}`]
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
  
  items.forEach(item => {
    const row = worksheet.getRow(rowIndex)
    
    // 获取集装箱号
    const itemContainerNo = item.containerNumber || containerNo || ''
    
    // 如果是同一个柜号/提单，不重复显示
    const showContainerNo = itemContainerNo !== currentContainerNo
    const showBillNo = item.billNumber !== currentBillNo
    
    if (showContainerNo) currentContainerNo = itemContainerNo
    if (showBillNo) currentBillNo = item.billNumber
    
    // 获取英文费用名称（优先使用 fee_name_en 字段）
    const feeNameEn = getFeeNameEnglish(item.feeName || item.fee_name, item.fee_name_en || item.feeNameEn)

    row.values = [
      showContainerNo ? itemContainerNo : '',
      showBillNo ? item.billNumber : '',
      feeNameEn,
      parseFloat(item.amount) || 0
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
    
    rowIndex++
  })
  
  // 合计行
  const totalRow = worksheet.getRow(rowIndex)
  totalRow.values = ['', '', 'Total:', total]
  totalRow.font = { bold: true }
  totalRow.getCell(3).alignment = { horizontal: 'right' }
  totalRow.getCell(4).alignment = { horizontal: 'right' }
  totalRow.getCell(4).numFmt = '#,##0.00'
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
  // 获取费用记录（包含 fee_name_en 字段）
  const placeholders = feeIds.map(() => '?').join(',')
  const fees = await db.prepare(`
    SELECT f.*, f.fee_name_en, b.container_number, b.bill_number
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
  
  // 汇总费用
  const summarizedItems = summarizeFees(fees)
  
  // 计算总金额
  const total = fees.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0)
  
  return {
    customer: {
      id: customer?.id,
      name: customer?.customer_name || customer?.company_name || fees[0].customer_name || '',
      address: customer?.address || ''
    },
    containerNumbers,
    fees,
    summarizedItems,
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
  const excelData = {
    customerName: invoiceData.customer.name,
    date: invoiceDate,
    items: invoiceData.fees.map(f => ({
      containerNumber: f.container_number,
      billNumber: f.bill_number,
      feeName: f.fee_name,
      amount: f.amount
    })),
    total: invoiceData.total,
    currency: invoiceData.currency
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
    JSON.stringify(invoiceData.summarizedItems),
    JSON.stringify(feeIds),
    pdfUrl,
    excelUrl,
    pdfUrl ? now : null,
    excelUrl ? now : null,
    'issued',
    now,
    now
  )
  
  // 7. 更新费用记录的发票状态
  for (const feeId of feeIds) {
    await db.prepare(`
      UPDATE fees SET 
        invoice_status = 'invoiced',
        invoice_number = ?,
        invoice_date = ?,
        updated_at = ?
      WHERE id = ?
    `).run(invoiceNumber, invoiceDate, now, feeId)
  }
  
  return {
    id: invoiceId,
    invoiceNumber,
    invoiceDate,
    customer: invoiceData.customer,
    containerNumbers: invoiceData.containerNumbers,
    items: invoiceData.summarizedItems,
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

  if (feeIds.length > 0) {
    // 有关联费用记录，使用费用数据（但要过滤费用类型）
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
  } else if (invoice.bill_id) {
    // fee_ids 为空但有 bill_id，直接从 fees 表获取费用（过滤费用类型）
    fees = await db.prepare(`
      SELECT f.*, b.container_number, b.bill_number
      FROM fees f
      LEFT JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE f.bill_id = ? 
        AND (f.fee_type = ? OR f.fee_type IS NULL)
      ORDER BY f.fee_name
    `).all(invoice.bill_id, targetFeeType)
    console.log(`[regenerateInvoiceFiles] 从 bill_id 获取到 ${fees.length} 条${targetFeeType}费用`)
    
    if (fees.length > 0) {
      // 按费用类型分组合并
      const feeGroups = {}
      fees.forEach(fee => {
        const feeName = fee.fee_name || 'Other'
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = {
            description: feeName,
            descriptionEn: fee.fee_name_en || null, // 保存英文名称
            quantity: 0,
            totalAmount: 0
          }
        }
        feeGroups[feeName].quantity += 1
        feeGroups[feeName].totalAmount += parseFloat(fee.amount) || 0
      })
      
      items = Object.values(feeGroups).map(group => ({
        description: group.description,
        descriptionEn: group.descriptionEn, // 传递英文名称用于 PDF 翻译
        quantity: group.quantity,
        unitValue: group.totalAmount / group.quantity,
        amount: group.totalAmount
      }))
    }
  }
  
  // 如果还是没有费用数据，尝试其他方式
  if (items.length === 0) {
    // 尝试从 items 字段读取
    let parsedItems = []
    try {
      parsedItems = JSON.parse(invoice.items || '[]')
    } catch {
      parsedItems = []
    }

    if (parsedItems.length > 0) {
      // 从 items 字段获取费用明细
      const feeGroups = {}
      parsedItems.forEach(item => {
        const feeName = item.description?.trim() || item.fee_name?.trim() || '费用'
        const amount = parseFloat(item.amount) || 0
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = {
            description: feeName,
            quantity: 0,
            totalAmount: 0
          }
        }
        feeGroups[feeName].quantity += 1
        feeGroups[feeName].totalAmount += amount
      })

      items = Object.values(feeGroups).map(group => ({
        description: group.description,
        quantity: group.quantity,
        unitValue: group.totalAmount / group.quantity,
        amount: group.totalAmount
      }))
    } else {
      // 最后的后备方案
      items = [{
        description: '服务费',
        quantity: 1,
        unitValue: parseFloat(invoice.total_amount) || 0,
        amount: parseFloat(invoice.total_amount) || 0
      }]
    }
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

  // 获取客户地址（如果发票中没有，从 customers 表获取）
  let customerAddress = invoice.customer_address || ''
  if (!customerAddress && invoice.customer_id) {
    const customer = await db.prepare('SELECT address, city, country_code FROM customers WHERE id = ?').get(invoice.customer_id)
    if (customer) {
      const addressParts = [customer.address, customer.city, customer.country_code].filter(Boolean)
      customerAddress = addressParts.join(', ')
    }
  }

  // 生成PDF
  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date || null,
    paymentDays: paymentDays,
    customer: {
      name: invoice.customer_name,
      address: customerAddress
    },
    containerNumbers,
    items,
    subtotal: invoiceData ? invoiceData.total : (parseFloat(invoice.subtotal) || parseFloat(invoice.total_amount) || 0),
    total: invoiceData ? invoiceData.total : (parseFloat(invoice.total_amount) || 0),
    currency: invoice.currency || 'EUR',
    exchangeRate: parseFloat(invoice.exchange_rate) || 1
  }

  const pdfBuffer = await generatePDF(pdfData)

  // 生成Excel
  // 获取集装箱号
  let excelContainerNo = ''
  if (containerNumbers && containerNumbers.length > 0) {
    excelContainerNo = containerNumbers[0]
  }

  // 获取提单号
  let blNumber = ''
  if (invoice.bill_id) {
    const billInfo = await db.prepare('SELECT bill_number FROM bills_of_lading WHERE id = ?').get(invoice.bill_id)
    if (billInfo) {
      blNumber = billInfo.bill_number || ''
    }
  }

  // Excel 数据也按费用类型合并
  let excelItems = []
  if (fees && fees.length > 0) {
    // 有原始费用记录，按费用类型分组合并
    const feeGroups = {}
    fees.forEach(f => {
      const feeName = f.fee_name || 'Other'
      if (!feeGroups[feeName]) {
        feeGroups[feeName] = {
          containerNo: f.container_number || excelContainerNo,
          billNumber: f.bill_number || blNumber,
          feeName: feeName,
          amount: 0
        }
      }
      feeGroups[feeName].amount += parseFloat(f.amount) || 0
    })
    excelItems = Object.values(feeGroups)
  } else {
    // 使用已合并的 items
    excelItems = items.map(item => ({
      containerNo: excelContainerNo,
      billNumber: blNumber,
      feeName: item.description,
      amount: item.amount
    }))
  }

  const excelData = {
    customerName: invoice.customer_name || '',
    date: invoice.invoice_date,
    containerNo: excelContainerNo,
    items: excelItems,
    total: invoiceData ? invoiceData.total : (parseFloat(invoice.total_amount) || 0),
    currency: invoice.currency || 'EUR'
  }

  console.log(`[regenerateInvoiceFiles] 开始生成 Excel...`)
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
  
  // 更新发票记录（包括 items 字段，使前端能正确显示费用明细金额）
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
    // 更新 items 字段，保存费用明细数据
    if (items && items.length > 0) {
      updateFields.push('items = ?')
      updateValues.push(JSON.stringify(items))
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

    // 解析 items 数据（从 description 字段或传入的 items）
    // 按费用类型合并同类费用
    let items = []
    if (invoiceData.items && Array.isArray(invoiceData.items)) {
      // 按费用类型分组合并
      const feeGroups = {}
      invoiceData.items.forEach(item => {
        const feeName = item.description || 'Other'
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = {
            description: feeName,
            quantity: 0,
            totalAmount: 0
          }
        }
        feeGroups[feeName].quantity += (item.quantity || 1)
        feeGroups[feeName].totalAmount += parseFloat(item.amount) || 0
      })
      // 转换为数组
      items = Object.values(feeGroups).map(group => ({
        description: group.description,
        quantity: group.quantity,
        unitValue: group.totalAmount / group.quantity,
        amount: group.totalAmount
      }))
    } else if (invoice.description) {
      // 从 description 字段解析（格式：desc1; desc2; desc3）
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
    let containerNumbers = []
    if (invoice.bill_id) {
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

    // 准备PDF数据
    const pdfData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date || null,
      paymentDays: paymentDays,
      customer: {
        name: invoice.customer_name || '',
        address: invoice.customer_address || ''
      },
      containerNumbers,
      items,
      subtotal: parseFloat(invoice.subtotal) || parseFloat(invoice.total_amount) || 0,
      total: parseFloat(invoice.total_amount) || 0,
      currency: invoice.currency || 'EUR',
      exchangeRate: parseFloat(invoice.exchange_rate) || 1
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
    const excelContainerNo = containerNumbers.length > 0 ? containerNumbers[0] : ''
    
    // 获取提单号
    let blNumber = ''
    if (invoice.bill_id) {
      const billInfo = await db.prepare('SELECT bill_number FROM bills_of_lading WHERE id = ?').get(invoice.bill_id)
      if (billInfo) {
        blNumber = billInfo.bill_number || ''
      }
    }

    // Excel 数据也按费用类型合并
    let excelItems = []
    if (invoiceData.items && Array.isArray(invoiceData.items)) {
      const feeGroups = {}
      invoiceData.items.forEach(item => {
        const feeName = item.description || 'Other'
        if (!feeGroups[feeName]) {
          feeGroups[feeName] = 0
        }
        feeGroups[feeName] += parseFloat(item.amount) || 0
      })
      excelItems = Object.entries(feeGroups).map(([feeName, amount]) => ({
        containerNo: excelContainerNo,
        billNumber: blNumber,
        feeName: feeName,
        amount: amount
      }))
    }

    const excelData = {
      customerName: invoice.customer_name || '',
      date: invoice.invoice_date,
      containerNo: excelContainerNo,
      items: excelItems,
      total: parseFloat(invoice.total_amount) || 0,
      currency: invoice.currency || 'EUR'
    }

    // 生成Excel
    let excelBuffer = null
    try {
      console.log('[发票文件生成] 正在生成Excel...')
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
