/**
 * 发票模板配置
 * 
 * 包含PDF发票和Excel明细的模板定义
 * 支持从数据库读取动态模板配置
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import { getDatabase } from '../../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 使用 Google Fonts CDN URL 加载中文字体（避免 Base64 嵌入导致 HTML 过大）
// 原本使用 Base64 嵌入 17MB 的字体文件会导致 Puppeteer 内存溢出
function getChineseFontURL() {
  // 使用 Google Fonts 的 Noto Sans SC
  return 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap'
}

// 默认公司信息配置（当数据库没有模板时使用）
export const COMPANY_INFO = {
  name: 'Xianfeng International Logistics',
  slogan: 'PRECISION LOGISTICS, TRUSTED CHOICE',
  registrationNo: '77224366-000-10-24-A',
  address: 'No. RM 725,7/F.,Liven House 61-63 King Yip Street, Kwun Tong Hong Kong, China',
  
  // 银行信息
  bank: {
    accountName: 'Xianfeng International Logistics',
    accountNumber: '015-150-68-100225',
    bankName: 'The Bank of East Asia, Limited',
    bankAddress: '10 Des Voeux Road, Central, Hong Kong',
    swiftCode: 'BEASKHHH',
    clearingNo: '015 (for local interbank transfers)'
  }
}

/**
 * 根据模版ID从数据库获取发票模板
 * @param {number|null} templateId - 模板ID，null则获取默认模板
 * @param {string} language - 语言代码，如 'en', 'zh'
 * @returns {Promise<Object|null>} 模板内容（包含语言内容和图片URL）
 */
export async function getInvoiceTemplateById(templateId, language = 'en') {
  try {
    const db = getDatabase()
    
    // 如果没有指定 templateId，使用默认模板
    let template
    if (templateId) {
      template = await db.prepare(`
        SELECT content, languages, logo_url, stamp_url 
        FROM invoice_templates 
        WHERE id = ? AND is_deleted = false
        LIMIT 1
      `).get(templateId)
    }
    
    // 如果指定的模板不存在，回退到默认模板
    if (!template) {
      template = await db.prepare(`
        SELECT content, languages, logo_url, stamp_url 
        FROM invoice_templates 
        WHERE is_default = true AND is_deleted = false 
        LIMIT 1
      `).get()
    }
    
    if (!template) {
      return null
    }
    
    const content = template.content
    let langContent = null
    
    // 获取指定语言的内容
    if (content && content[language]) {
      langContent = content[language]
    } else if (content) {
      // 降级策略：优先英语，其次中文
      if (content['en']) langContent = content['en']
      else if (content['zh']) langContent = content['zh']
      else {
        // 返回第一个可用的语言
        const availableLangs = Object.keys(content)
        if (availableLangs.length > 0) {
          langContent = content[availableLangs[0]]
        }
      }
    }
    
    if (!langContent) {
      return null
    }
    
    // 添加图片URL到返回结果
    return {
      ...langContent,
      logoUrl: template.logo_url,
      stampUrl: template.stamp_url
    }
  } catch (error) {
    console.error('根据ID获取发票模板失败:', error)
    return null
  }
}

/**
 * 从数据库获取默认发票模板
 * @param {string} language - 语言代码，如 'en', 'zh'
 * @returns {Promise<Object|null>} 模板内容（包含语言内容和图片URL）
 */
export async function getInvoiceTemplateFromDB(language = 'en') {
  try {
    const db = getDatabase()
    const template = await db.prepare(`
      SELECT content, languages, logo_url, stamp_url 
      FROM invoice_templates 
      WHERE is_default = true AND is_deleted = false 
      LIMIT 1
    `).get()
    
    if (!template) {
      return null
    }
    
    const content = template.content
    let langContent = null
    
    // 获取指定语言的内容
    if (content && content[language]) {
      langContent = content[language]
    } else if (content) {
      // 降级策略：优先英语，其次中文
      if (content['en']) langContent = content['en']
      else if (content['zh']) langContent = content['zh']
      else {
        // 返回第一个可用的语言
        const availableLangs = Object.keys(content)
        if (availableLangs.length > 0) {
          langContent = content[availableLangs[0]]
        }
      }
    }
    
    if (!langContent) {
      return null
    }
    
    // 添加图片URL到返回结果
    return {
      ...langContent,
      logoUrl: template.logo_url,
      stampUrl: template.stamp_url
    }
  } catch (error) {
    console.error('从数据库获取发票模板失败:', error)
    return null
  }
}

/**
 * 将数据库模板格式转换为发票生成器需要的格式
 * @param {Object} dbTemplate - 数据库模板内容
 * @returns {Object} 转换后的公司信息格式
 */
export function convertTemplateToCompanyInfo(dbTemplate) {
  if (!dbTemplate) {
    return COMPANY_INFO
  }
  
  return {
    name: dbTemplate.companyName || COMPANY_INFO.name,
    slogan: dbTemplate.companySlogan || COMPANY_INFO.slogan || 'PRECISION LOGISTICS, TRUSTED CHOICE',
    registrationNo: dbTemplate.registrationNumber || COMPANY_INFO.registrationNo,
    address: [
      dbTemplate.companyAddress,
      dbTemplate.companyCity,
      dbTemplate.companyPostcode,
      dbTemplate.companyCountry
    ].filter(Boolean).join(', ') || COMPANY_INFO.address,
    phone: dbTemplate.companyPhone || '',
    email: dbTemplate.companyEmail || '',
    website: dbTemplate.companyWebsite || '',
    taxNumber: dbTemplate.taxNumber || '',
    
    // 银行信息
    bank: {
      accountName: dbTemplate.accountName || COMPANY_INFO.bank.accountName,
      accountNumber: dbTemplate.accountNumber || COMPANY_INFO.bank.accountNumber,
      bankName: dbTemplate.bankName || COMPANY_INFO.bank.bankName,
      bankAddress: dbTemplate.bankAddress || COMPANY_INFO.bank.bankAddress,
      swiftCode: dbTemplate.swiftCode || COMPANY_INFO.bank.swiftCode,
      clearingNo: dbTemplate.sortCode || COMPANY_INFO.bank.clearingNo
    },
    
    // 发票标签（用于多语言）
    labels: {
      invoice: dbTemplate.labelInvoice || 'INVOICE',
      invoiceNumber: dbTemplate.labelInvoiceNumber || 'Invoice No',
      date: dbTemplate.labelDate || 'Invoice Date',
      dueDate: dbTemplate.labelDueDate || 'Due Date',
      billTo: dbTemplate.labelBillTo || 'Bill to',
      description: dbTemplate.labelDescription || 'Service Description',
      quantity: dbTemplate.labelQuantity || 'Quantity',
      unitPrice: dbTemplate.labelUnitPrice || 'Unit Value',
      amount: dbTemplate.labelAmount || 'Amount',
      subtotal: dbTemplate.labelSubtotal || 'Sub Total',
      tax: dbTemplate.labelTax || 'Tax',
      total: dbTemplate.labelTotal || 'Total',
      bankDetails: dbTemplate.labelBankDetails || 'Bank Details',
      paymentTerms: dbTemplate.labelPaymentTerms || 'Payment Terms',
      containerNo: dbTemplate.labelContainerNo || 'Container No',
      discount: dbTemplate.labelDiscount || 'Discount',
      final: dbTemplate.labelFinal || 'Final',
      paymentDate: dbTemplate.labelPaymentDate || 'Payment Date'
    },
    
    // 发票条款
    paymentTerms: dbTemplate.paymentTerms || '',
    footerNote: dbTemplate.footerNote || '',
    thankYouMessage: dbTemplate.thankYouMessage || '',
    
    // 图片URL
    logoUrl: dbTemplate.logoUrl || null,
    stampUrl: dbTemplate.stampUrl || null
  }
}

// 颜色配置
export const COLORS = {
  primary: '#E67E22',      // 橙色 - 公司名称和标题
  secondary: '#333333',    // 深灰色 - 正文
  light: '#666666',        // 浅灰色 - 辅助文字
  border: '#DDDDDD',       // 边框色
  headerBg: '#F8F8F8',     // 表头背景
  warning: '#C0392B'       // 红色 - 付款提示
}

// 获取Logo图片的Base64编码
export function getLogoBase64() {
  try {
    const logoPath = join(__dirname, '../../assets/logo.png')
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath)
      return `data:image/png;base64,${logoBuffer.toString('base64')}`
    }
  } catch (error) {
    console.error('读取Logo失败:', error)
  }
  return null
}

// 获取公章图片的Base64编码
export function getStampBase64() {
  try {
    const stampPath = join(__dirname, '../../assets/stamp.png')
    if (fs.existsSync(stampPath)) {
      const stampBuffer = fs.readFileSync(stampPath)
      return `data:image/png;base64,${stampBuffer.toString('base64')}`
    }
  } catch (error) {
    console.error('读取公章失败:', error)
  }
  return null
}

// 格式化日期为简单格式 (如: 2025-12-17)
function formatInvoiceDate(dateStr) {
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

// 从数据库加载的费用名称英文映射缓存
let feeNameEnCache = null
let feeNameEnCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 缓存5分钟

/**
 * 从 service_fee_categories 表加载费用名称英文映射（同步版本，使用缓存）
 */
function getFeeNameEnFromCache(chineseName) {
  if (!feeNameEnCache || !chineseName) return null
  
  // 直接匹配
  if (feeNameEnCache[chineseName]) {
    return feeNameEnCache[chineseName]
  }
  
  // 部分匹配
  for (const [cn, en] of Object.entries(feeNameEnCache)) {
    if (chineseName.includes(cn) || (cn.includes(chineseName) && chineseName.length >= 2)) {
      return en
    }
  }
  
  return null
}

/**
 * 预加载费用名称英文映射缓存
 * 应在生成发票前调用
 */
export async function preloadFeeNameEnCache() {
  const now = Date.now()
  if (feeNameEnCache && (now - feeNameEnCacheTime) < CACHE_TTL) {
    return // 缓存仍有效
  }
  
  try {
    const db = getDatabase()
    const result = await db.pool.query(`
      SELECT name, name_en 
      FROM service_fee_categories 
      WHERE name_en IS NOT NULL AND name_en != '' AND status = 'active'
    `)
    
    const mapping = {}
    for (const row of result.rows) {
      if (row.name && row.name_en) {
        mapping[row.name] = row.name_en
      }
    }
    
    feeNameEnCache = mapping
    feeNameEnCacheTime = now
    console.log(`[preloadFeeNameEnCache] 预加载了 ${Object.keys(mapping).length} 个费用名称英文映射`)
  } catch (error) {
    console.error('[preloadFeeNameEnCache] 预加载失败:', error.message)
  }
}

// 费用名称中英文映射表（硬编码备用）
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
// 优先级：1. descriptionEn 字段  2. service_fee_categories 表  3. FEE_NAME_MAP 映射  4. 原名
function getFeeNameEnglish(chineseName, descriptionEn = null) {
  // 如果已有英文名称字段，优先使用
  if (descriptionEn && descriptionEn.trim()) {
    return descriptionEn.trim()
  }
  
  if (!chineseName) return 'Other Charges'
  
  // 1. 优先从 service_fee_categories 数据库缓存查询
  const dbNameEn = getFeeNameEnFromCache(chineseName)
  if (dbNameEn) {
    return dbNameEn
  }
  
  // 2. 尝试硬编码映射表直接匹配
  if (FEE_NAME_MAP[chineseName]) {
    return FEE_NAME_MAP[chineseName]
  }
  
  // 3. 尝试硬编码映射表部分匹配
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
  
  // 4. 如果已经是英文，直接返回
  if (/^[a-zA-Z\s\/]+$/.test(chineseName)) {
    return chineseName
  }
  
  return chineseName
}

// 根据语言获取费用名称
// language: 'en' = 英文, 'zh' = 中文
function getFeeName(chineseName, descriptionEn, language = 'en') {
  if (language === 'zh') {
    // 中文发票：优先使用原始的中文名称
    return chineseName || descriptionEn || 'Other Charges'
  } else {
    // 英文发票：使用翻译后的英文名称
    return getFeeNameEnglish(chineseName, descriptionEn)
  }
}

// PDF发票HTML模板
// language: 'en' = 英文发票, 'zh' = 中文发票（仅影响费用品名显示）
// companyInfo: 可选，从数据库获取的公司信息模板
export function generateInvoiceHTML(data) {
  const {
    invoiceNumber,
    invoiceDate,
    dueDate,
    paymentDays,
    customer,
    containerNumbers,
    items,
    subtotal,
    total,
    currency = 'EUR',
    exchangeRate = 1,
    language = 'en',  // 发票语言，默认英文
    companyInfo = null  // 从数据库获取的公司信息模板
  } = data

  // 使用传入的公司信息或默认配置
  const company = companyInfo || COMPANY_INFO
  const labels = company.labels || {}

  // 优先使用数据库配置的图片URL，如果没有则使用本地文件
  let logoHtml = ''
  let stampHtml = ''
  
  if (company.logoUrl) {
    // 使用数据库配置的Logo URL（需要完整URL）
    const logoFullUrl = company.logoUrl.startsWith('http') 
      ? company.logoUrl 
      : `${process.env.API_BASE_URL || 'http://localhost:3001'}${company.logoUrl}`
    logoHtml = `<img src="${logoFullUrl}" class="logo" alt="Logo">`
  } else {
    // 使用本地文件
    const logoBase64 = getLogoBase64()
    if (logoBase64) {
      logoHtml = `<img src="${logoBase64}" class="logo" alt="Logo">`
    }
  }
  
  if (company.stampUrl) {
    // 使用数据库配置的公章 URL
    const stampFullUrl = company.stampUrl.startsWith('http') 
      ? company.stampUrl 
      : `${process.env.API_BASE_URL || 'http://localhost:3001'}${company.stampUrl}`
    stampHtml = `<img src="${stampFullUrl}" class="stamp" alt="Stamp">`
  } else {
    // 使用本地文件
    const stampBase64 = getStampBase64()
    if (stampBase64) {
      stampHtml = `<img src="${stampBase64}" class="stamp" alt="Stamp">`
    }
  }
  
  const chineseFontURL = getChineseFontURL()
  const formattedDate = formatInvoiceDate(invoiceDate)
  const formattedDueDate = formatInvoiceDate(dueDate)
  
  // 格式化汇率显示
  const exchangeRateText = currency !== 'CNY' && exchangeRate !== 1 
    ? `Exchange Rate: 1 ${currency} = ${exchangeRate.toFixed(4)} CNY`
    : ''

  // 使用 Google Fonts 加载中文字体（避免 Base64 嵌入导致 HTML 过大）
  const fontFamily = "'Noto Sans SC', 'Microsoft YaHei', 'SimHei', Arial, sans-serif"

  // 检查是否有多个集装箱合并（任意项的 quantity > 1 表示是合并发票）
  const isMultiContainerInvoice = items.some(item => item.quantity > 1)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="${chineseFontURL}" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: ${fontFamily};
      font-size: 11px;
      color: #333;
      padding: 8px 30px 15px 30px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* 头部区域 */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      border-bottom: 2px solid ${COLORS.primary};
      padding-bottom: 8px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 70px;
      height: 70px;
    }
    .company-info {
      text-align: right;
    }
    .company-name {
      font-size: 20px;
      font-weight: bold;
      color: ${COLORS.primary};
      margin-bottom: 3px;
    }
    .company-slogan {
      font-size: 9px;
      font-style: italic;
      color: ${COLORS.light};
      margin-bottom: 3px;
    }
    .company-detail {
      font-size: 9px;
      color: ${COLORS.light};
      margin-bottom: 1px;
    }
    
    /* 客户和发票信息区域 */
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .bill-to {
      flex: 1;
    }
    .bill-to-label {
      font-size: 11px;
      color: ${COLORS.light};
      margin-bottom: 5px;
    }
    .bill-to-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .bill-to-address {
      font-size: 11px;
      color: ${COLORS.secondary};
      margin-bottom: 10px;
    }
    .container-info {
      font-size: 11px;
      margin-top: 10px;
    }
    .container-label {
      font-weight: bold;
    }
    
    .invoice-info {
      text-align: right;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      color: ${COLORS.primary};
      margin-bottom: 8px;
    }
    .invoice-detail {
      font-size: 10px;
      color: ${COLORS.secondary};
      margin-bottom: 3px;
    }
    .invoice-detail span {
      font-weight: normal;
    }
    
    /* 费用明细表 */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .items-table th {
      background-color: ${COLORS.headerBg};
      border: 1px solid ${COLORS.border};
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: bold;
    }
    .items-table td {
      border: 1px solid ${COLORS.border};
      padding: 5px 8px;
      font-size: 10px;
    }
    .items-table .amount {
      text-align: right;
    }
    .items-table .quantity {
      text-align: center;
    }
    .items-table .discount-col {
      color: ${COLORS.primary};
    }
    
    /* 合计区域 */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      margin-bottom: 15px;
      gap: 20px;
    }
    .stamp {
      width: 70px;
      height: 70px;
      opacity: 0.8;
      margin-top: 5px;
    }
    .totals {
      text-align: right;
    }
    .subtotal-row, .total-row, .discount-row {
      display: flex;
      justify-content: flex-end;
      gap: 40px;
      margin-bottom: 3px;
      font-size: 10px;
    }
    .discount-row {
      color: ${COLORS.primary};
    }
    .total-row {
      font-size: 13px;
      font-weight: bold;
      border-top: 2px solid ${COLORS.secondary};
      padding-top: 6px;
      margin-top: 6px;
    }
    
    /* 付款提示 */
    .payment-notice {
      border-left: 3px solid ${COLORS.warning};
      padding-left: 10px;
      margin-bottom: 15px;
      color: ${COLORS.warning};
      font-weight: bold;
      font-size: 10px;
    }
    
    /* 底部信息 */
    .footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid ${COLORS.border};
      padding-top: 10px;
      font-size: 9px;
      color: ${COLORS.secondary};
    }
    .footer-left, .footer-right {
      line-height: 1.6;
    }
    .footer-label {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <!-- 头部 -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
    </div>
    <div class="company-info">
      <div class="company-name">${company.name}</div>
      <div class="company-slogan">${company.slogan || 'PRECISION LOGISTICS, TRUSTED CHOICE'}</div>
      <div class="company-detail">Registration No: ${company.registrationNo}</div>
      <div class="company-detail">Address: ${company.address}</div>
      ${company.taxNumber ? `<div class="company-detail">VAT: ${company.taxNumber}</div>` : ''}
    </div>
  </div>
  
  <!-- 客户和发票信息 -->
  <div class="info-section">
    <div class="bill-to">
      <div class="bill-to-label">${labels.billTo || 'Bill to'}:</div>
      <div class="bill-to-name">${customer.name || ''}</div>
      <div class="bill-to-address">${customer.address || ''}</div>
      ${containerNumbers && containerNumbers.length > 0 ? `
      <div class="container-info">
        <span class="container-label">${labels.containerNo || 'Container No'}:</span> ${containerNumbers.join(', ')}
      </div>
      ` : ''}
    </div>
    <div class="invoice-info">
      <div class="invoice-title">${labels.invoice || 'INVOICE'}</div>
      <div class="invoice-detail">${labels.invoiceNumber || 'Invoice No'}: <span>${invoiceNumber}</span></div>
      <div class="invoice-detail">${labels.date || 'Invoice Date'}: ${formattedDate}</div>
      <div class="invoice-detail">${labels.paymentTerms || 'Payment Terms'}: ${paymentDays ? `${paymentDays} Days` : 'Due on Receipt'}</div>
      ${formattedDueDate ? `<div class="invoice-detail">${labels.dueDate || 'Due Date'}: ${formattedDueDate}</div>` : ''}
      ${exchangeRateText ? `<div class="invoice-detail">${exchangeRateText}</div>` : ''}
    </div>
  </div>
  
  <!-- 费用明细表 -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: ${isMultiContainerInvoice ? '45%' : '35%'}">${labels.description || 'Service Description'}</th>
        <th style="width: 10%" class="quantity">${labels.quantity || 'Quantity'}</th>
        ${isMultiContainerInvoice ? '' : `<th style="width: 15%" class="amount">${labels.unitPrice || 'Unit Value'}</th>`}
        <th style="width: ${isMultiContainerInvoice ? '20%' : '20%'}" class="amount">${labels.amount || 'Amount'} ${currency}</th>
        <th style="width: ${isMultiContainerInvoice ? '12%' : '12%'}" class="amount discount-col">${labels.discount || 'Discount'}</th>
        <th style="width: ${isMultiContainerInvoice ? '13%' : '18%'}" class="amount">${labels.final || 'Final'}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => {
        const discountAmt = Number(item.discountAmount) || 0
        const finalAmt = item.finalAmount !== undefined ? Number(item.finalAmount) : (Number(item.amount) - discountAmt)
        return `
      <tr>
        <td>${getFeeName(item.description, item.descriptionEn, language)}</td>
        <td class="quantity">${item.quantity}</td>
        ${isMultiContainerInvoice ? '' : `<td class="amount">${formatNumber(item.unitValue)}</td>`}
        <td class="amount">${formatNumber(item.amount)}</td>
        <td class="amount discount-col">${discountAmt !== 0 ? '-' + formatNumber(discountAmt) : '-'}</td>
        <td class="amount">${formatNumber(finalAmt)}</td>
      </tr>
      `}).join('')}
    </tbody>
  </table>
  
  <!-- 合计区域 -->
  <div class="totals-section">
    <div class="stamp-container">
      ${stampHtml}
    </div>
    <div class="totals">
      <div class="subtotal-row">
        <span>${labels.subtotal || 'Sub Total'}</span>
        <span>${formatNumber(subtotal)} ${currency}</span>
      </div>
      ${subtotal > total ? `
      <div class="discount-row">
        <span>${labels.discount || 'Discount'}</span>
        <span>-${formatNumber(subtotal - total)} ${currency}</span>
      </div>
      ` : ''}
      <div class="total-row">
        <span>${labels.total || 'Total'}:</span>
        <span>${formatNumber(total)} ${currency}</span>
      </div>
    </div>
  </div>
  
  <!-- 付款提示 -->
  <div class="payment-notice">
    When making payment please state invoice no
  </div>
  
  <!-- 底部信息 -->
  <div class="footer">
    <div class="footer-left">
      <div><span class="footer-label">${company.name}</span></div>
      <div><span class="footer-label">Registration No:</span> ${company.registrationNo}</div>
      <div><span class="footer-label">Address:</span> ${company.address}</div>
      ${company.taxNumber ? `<div><span class="footer-label">VAT:</span> ${company.taxNumber}</div>` : ''}
    </div>
    <div class="footer-right">
      <div><span class="footer-label">Account Holder's Name:</span> ${company.bank.accountName}</div>
      <div><span class="footer-label">Account Number:</span> ${company.bank.accountNumber}</div>
      <div><span class="footer-label">Bank's Name:</span> ${company.bank.bankName}</div>
      ${company.bank.bankAddress ? `<div><span class="footer-label">Bank's Address:</span> ${company.bank.bankAddress}</div>` : ''}
      ${company.bank.swiftCode ? `<div><span class="footer-label">SWIFT Code:</span> ${company.bank.swiftCode}</div>` : ''}
      ${company.bank.clearingNo ? `<div><span class="footer-label">Clearing No:</span> ${company.bank.clearingNo}</div>` : ''}
    </div>
  </div>
  
  <!-- 付款条款和感谢语 -->
  ${(() => {
    // 根据账期天数动态生成付款条款
    let dynamicPaymentTerms = ''
    if (paymentDays) {
      dynamicPaymentTerms = language === 'zh' 
        ? `请于发票日期起${paymentDays}天内付款`
        : `Payment due within ${paymentDays} days of invoice date`
    }
    const showTerms = dynamicPaymentTerms || company.thankYouMessage
    return showTerms ? `
    <div style="margin-top: 10px; text-align: center; font-size: 9px; color: #666;">
      ${dynamicPaymentTerms ? `<p style="margin-bottom: 3px;">${dynamicPaymentTerms}</p>` : ''}
      ${company.thankYouMessage ? `<p style="font-weight: bold;">${company.thankYouMessage}</p>` : ''}
    </div>
    ` : ''
  })()}
</body>
</html>
`
}

// 格式化数字
function formatNumber(num) {
  if (num === null || num === undefined) return '0.00'
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default {
  COMPANY_INFO,
  COLORS,
  getLogoBase64,
  getStampBase64,
  generateInvoiceHTML,
  getInvoiceTemplateFromDB,
  convertTemplateToCompanyInfo
}
