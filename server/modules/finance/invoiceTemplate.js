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

// PDF发票HTML模板
export function generateInvoiceHTML(data) {
  const {
    invoiceNumber,
    invoiceDate,
    customer,
    containerNumbers,
    items,
    subtotal,
    total,
    currency = 'EUR'
  } = data

  const logoBase64 = getLogoBase64()
  const stampBase64 = getStampBase64()

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* 头部区域 */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 2px solid ${COLORS.primary};
      padding-bottom: 20px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 80px;
      height: 80px;
    }
    .company-info {
      text-align: right;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${COLORS.primary};
      margin-bottom: 5px;
    }
    .company-slogan {
      font-size: 10px;
      font-style: italic;
      color: ${COLORS.light};
      margin-bottom: 5px;
    }
    .company-detail {
      font-size: 10px;
      color: ${COLORS.light};
      margin-bottom: 2px;
    }
    
    /* 客户和发票信息区域 */
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
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
      font-family: 'Courier New', monospace;
      margin-bottom: 5px;
    }
    .bill-to-address {
      font-size: 11px;
      font-family: 'Courier New', monospace;
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
      font-size: 36px;
      font-weight: bold;
      color: ${COLORS.primary};
      margin-bottom: 15px;
    }
    .invoice-detail {
      font-size: 11px;
      color: ${COLORS.secondary};
      margin-bottom: 5px;
    }
    .invoice-detail span {
      font-weight: normal;
    }
    
    /* 费用明细表 */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table th {
      background-color: ${COLORS.headerBg};
      border: 1px solid ${COLORS.border};
      padding: 10px;
      text-align: left;
      font-size: 11px;
      font-weight: bold;
    }
    .items-table td {
      border: 1px solid ${COLORS.border};
      padding: 10px;
      font-size: 11px;
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
      margin-bottom: 30px;
    }
    .stamp {
      width: 100px;
      height: 100px;
      opacity: 0.8;
    }
    .totals {
      text-align: right;
    }
    .subtotal-row, .total-row {
      display: flex;
      justify-content: flex-end;
      gap: 50px;
      margin-bottom: 5px;
    }
    .total-row {
      font-size: 16px;
      font-weight: bold;
      border-top: 2px solid ${COLORS.secondary};
      padding-top: 10px;
      margin-top: 10px;
    }
    
    /* 付款提示 */
    .payment-notice {
      border-left: 4px solid ${COLORS.warning};
      padding-left: 15px;
      margin-bottom: 30px;
      color: ${COLORS.warning};
      font-weight: bold;
    }
    
    /* 底部信息 */
    .footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid ${COLORS.border};
      padding-top: 20px;
      font-size: 10px;
      color: ${COLORS.secondary};
    }
    .footer-left, .footer-right {
      line-height: 1.8;
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
      <div class="invoice-detail">Invoice No:<br><span>${invoiceNumber}</span></div>
      <div class="invoice-detail">Invoice Date: ${invoiceDate}</div>
    </div>
  </div>
  
  <!-- 费用明细表 -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40%">Service Description</th>
        <th style="width: 15%" class="quantity">Quantity</th>
        <th style="width: 20%" class="amount">Unit Value</th>
        <th style="width: 25%" class="amount">Amount ${currency}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td class="quantity">${item.quantity}</td>
        <td class="amount">${formatNumber(item.unitValue)}</td>
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
