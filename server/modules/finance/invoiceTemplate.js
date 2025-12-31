/**
 * 发票模板配置
 * 
 * 包含PDF发票和Excel明细的模板定义
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 使用 Google Fonts CDN URL 加载中文字体（避免 Base64 嵌入导致 HTML 过大）
// 原本使用 Base64 嵌入 17MB 的字体文件会导致 Puppeteer 内存溢出
function getChineseFontURL() {
  // 使用 Google Fonts 的 Noto Sans SC
  return 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap'
}

// 公司信息配置
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

// 费用名称中英文映射
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
  '关税': 'Customs Duty',
  '增值税': 'VAT',
  '进口增值税': 'Import VAT',
  '反倾销税': 'Anti-dumping Duty',
  'HS CODE操作费': 'HS Code Handling Fee',
  'HS编码操作费': 'HS Code Handling Fee',
  
  // 代理费用
  '操作费': 'Handling Fee',
  '代理费': 'Agency Fee',
  '进口商代理费': 'Import Agency Fee',
  '出口商代理费': 'Export Agency Fee',
  '货代费': 'Freight Forwarder Fee',
  
  // 运输费用
  '提柜送仓费': 'Container Delivery Fee',
  '送货费': 'Delivery Fee',
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
  '装卸费': 'Loading/Unloading Fee',
  
  // 其他费用
  '保险费': 'Insurance Fee',
  '文件费': 'Documentation Fee',
  '港杂费': 'Port Charges',
  '查验费': 'Inspection Fee',
  '加班费': 'Overtime Fee',
  '滞港费': 'Demurrage Fee',
  '滞箱费': 'Detention Fee',
  '换单费': 'B/L Release Fee',
  '目的港费': 'Destination Charges',
  '起运港费': 'Origin Charges',
  '燃油附加费': 'Bunker Adjustment Factor',
  '其他费用': 'Other Charges',
  '杂费': 'Miscellaneous Charges',
  '服务费': 'Service Fee'
}

// 获取费用的英文名称
// 优先级：1. descriptionEn 字段  2. FEE_NAME_MAP 映射  3. 原名
function getFeeNameEnglish(chineseName, descriptionEn = null) {
  // 如果已有英文名称字段，优先使用
  if (descriptionEn && descriptionEn.trim()) {
    return descriptionEn.trim()
  }
  
  if (!chineseName) return 'Other Charges'
  if (FEE_NAME_MAP[chineseName]) {
    return FEE_NAME_MAP[chineseName]
  }
  for (const [cn, en] of Object.entries(FEE_NAME_MAP)) {
    if (chineseName.includes(cn)) {
      return en
    }
  }
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
    language = 'en'  // 发票语言，默认英文
  } = data

  const logoBase64 = getLogoBase64()
  const stampBase64 = getStampBase64()
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
    
    /* 合计区域 */
    .totals-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 15px;
    }
    .stamp {
      width: 80px;
      height: 80px;
      opacity: 0.8;
    }
    .totals {
      text-align: right;
    }
    .subtotal-row, .total-row {
      display: flex;
      justify-content: flex-end;
      gap: 40px;
      margin-bottom: 3px;
      font-size: 10px;
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
      ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo">` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">${COMPANY_INFO.name}</div>
      <div class="company-slogan">${COMPANY_INFO.slogan}</div>
      <div class="company-detail">Registration No: ${COMPANY_INFO.registrationNo}</div>
      <div class="company-detail">Address: ${COMPANY_INFO.address}</div>
    </div>
  </div>
  
  <!-- 客户和发票信息 -->
  <div class="info-section">
    <div class="bill-to">
      <div class="bill-to-label">Bill to:</div>
      <div class="bill-to-name">${customer.name || ''}</div>
      <div class="bill-to-address">${customer.address || ''}</div>
      ${containerNumbers && containerNumbers.length > 0 ? `
      <div class="container-info">
        <span class="container-label">Container No:</span> ${containerNumbers.join(', ')}
      </div>
      ` : ''}
    </div>
    <div class="invoice-info">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-detail">Invoice No: <span>${invoiceNumber}</span></div>
      <div class="invoice-detail">Invoice Date: ${formattedDate}</div>
      <div class="invoice-detail">Payment Terms: ${paymentDays ? `${paymentDays} Days` : 'Due on Receipt'}</div>
      ${formattedDueDate ? `<div class="invoice-detail">Due Date: ${formattedDueDate}</div>` : ''}
      ${exchangeRateText ? `<div class="invoice-detail">${exchangeRateText}</div>` : ''}
    </div>
  </div>
  
  <!-- 费用明细表 -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: ${isMultiContainerInvoice ? '55%' : '40%'}">Service Description</th>
        <th style="width: ${isMultiContainerInvoice ? '15%' : '15%'}" class="quantity">Quantity</th>
        ${isMultiContainerInvoice ? '' : '<th style="width: 20%" class="amount">Unit Value</th>'}
        <th style="width: ${isMultiContainerInvoice ? '30%' : '25%'}" class="amount">Amount ${currency}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>${getFeeName(item.description, item.descriptionEn, language)}</td>
        <td class="quantity">${item.quantity}</td>
        ${isMultiContainerInvoice ? '' : `<td class="amount">${formatNumber(item.unitValue)}</td>`}
        <td class="amount">${formatNumber(item.amount)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <!-- 合计区域 -->
  <div class="totals-section">
    <div>
      ${stampBase64 ? `<img src="${stampBase64}" class="stamp" alt="Stamp">` : ''}
    </div>
    <div class="totals">
      <div class="subtotal-row">
        <span>Sub Total</span>
        <span>${formatNumber(subtotal)} ${currency}</span>
      </div>
      <div class="total-row">
        <span>Total:</span>
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
      <div><span class="footer-label">${COMPANY_INFO.name}</span></div>
      <div><span class="footer-label">Registration No:</span> ${COMPANY_INFO.registrationNo}</div>
      <div><span class="footer-label">Address:</span> ${COMPANY_INFO.address}</div>
    </div>
    <div class="footer-right">
      <div><span class="footer-label">Account Holder's Name:</span> ${COMPANY_INFO.bank.accountName}</div>
      <div><span class="footer-label">Account Number:</span> ${COMPANY_INFO.bank.accountNumber}</div>
      <div><span class="footer-label">Bank's Name:</span> ${COMPANY_INFO.bank.bankName}</div>
      <div><span class="footer-label">Bank's Address:</span> ${COMPANY_INFO.bank.bankAddress}</div>
      <div><span class="footer-label">SWIFT Code:</span> ${COMPANY_INFO.bank.swiftCode}</div>
      <div><span class="footer-label">Clearing No:</span> ${COMPANY_INFO.bank.clearingNo}</div>
    </div>
  </div>
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
  generateInvoiceHTML
}
