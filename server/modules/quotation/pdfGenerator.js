/**
 * 报价单PDF生成器
 * 基于公司模板生成专业报价单
 */

/**
 * 生成报价单HTML模板
 * @param {Object} quotation - 报价单数据
 * @param {Object} company - 公司信息
 * @returns {string} HTML字符串
 */
export function generateQuotationHtml(quotation, company = {}) {
  const {
    quoteNumber = '',
    customerName = '',
    customerAddress = '',
    quoteDate = '',
    validUntil = '',
    currency = 'EUR',
    items = [],
    subtotal = 0,
    totalAmount = 0,
    terms = '',
    notes = ''
  } = quotation

  const {
    companyName = 'BP Logistics',
    companyNameEn = 'BP Logistics International',
    registrationNo = '',
    address = '',
    phone = '',
    email = '',
    logoUrl = ''
  } = company

  // 格式化金额
  const formatAmount = (amount, curr = currency) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: curr
    }).format(amount || 0)
  }

  // 分组费用项
  const groupedItems = {}
  items.forEach(item => {
    const category = item.category || '服务费用'
    if (!groupedItems[category]) {
      groupedItems[category] = []
    }
    groupedItems[category].push(item)
  })

  // 生成费用项HTML
  const generateItemsHtml = () => {
    if (Object.keys(groupedItems).length === 0) {
      // 无分组，直接显示
      return items.map((item, index) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${item.name || ''}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${item.nameEn || ''}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.unit || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity || 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatAmount(item.price)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 500;">${formatAmount(item.amount)}</td>
        </tr>
      `).join('')
    }

    // 按分组显示
    return Object.entries(groupedItems).map(([category, categoryItems]) => `
      <tr>
        <td colspan="6" style="padding: 10px 12px; background: #f97316; color: white; font-weight: 600;">
          ${category}
        </td>
      </tr>
      ${categoryItems.map(item => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${item.name || ''}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${item.nameEn || ''}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.unit || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantity || 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatAmount(item.price)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 500;">${formatAmount(item.amount)}</td>
        </tr>
      `).join('')}
    `).join('')
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>报价单 - ${quoteNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      background: white;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #f97316;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #f97316, #ea580c);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 18px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .company-slogan {
      font-size: 11px;
      color: #666;
      letter-spacing: 1px;
    }
    .company-info {
      text-align: right;
      font-size: 11px;
      color: #666;
    }
    .company-info p {
      margin: 2px 0;
    }
    .title-section {
      text-align: center;
      margin-bottom: 25px;
    }
    .title {
      font-size: 22px;
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
      padding: 15px;
      background: #fef3e2;
      border-radius: 8px;
    }
    .info-item {
      display: flex;
    }
    .info-label {
      font-weight: 500;
      color: #666;
      width: 80px;
    }
    .info-value {
      color: #333;
      font-weight: 500;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      overflow: hidden;
    }
    .items-table th {
      background: #f97316;
      color: white;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
    }
    .items-table th:nth-child(4),
    .items-table th:nth-child(5),
    .items-table th:nth-child(6) {
      text-align: right;
    }
    .items-table th:nth-child(3),
    .items-table th:nth-child(4) {
      text-align: center;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 25px;
    }
    .totals-box {
      width: 250px;
      background: #fff7ed;
      border: 1px solid #fdba74;
      border-radius: 8px;
      padding: 15px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
    }
    .total-row.grand {
      border-top: 2px solid #f97316;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: bold;
      color: #ea580c;
    }
    .terms-section {
      margin-bottom: 20px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .terms-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .terms-content {
      color: #666;
      font-size: 11px;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 200px;
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      height: 40px;
      margin-bottom: 5px;
    }
    .signature-label {
      font-size: 11px;
      color: #666;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 头部 -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">BP</div>
        <div>
          <div class="company-name">${companyName}</div>
          <div class="company-slogan">PRECISION LOGISTICS, TRUSTED CHOICE</div>
        </div>
      </div>
      <div class="company-info">
        ${registrationNo ? `<p>Registration No: ${registrationNo}</p>` : ''}
        ${address ? `<p>${address}</p>` : ''}
        ${phone ? `<p>Tel: ${phone}</p>` : ''}
        ${email ? `<p>Email: ${email}</p>` : ''}
      </div>
    </div>

    <!-- 标题 -->
    <div class="title-section">
      <div class="title">报 价 单</div>
      <div class="subtitle">QUOTATION</div>
    </div>

    <!-- 基本信息 -->
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">报价单号：</span>
        <span class="info-value">${quoteNumber}</span>
      </div>
      <div class="info-item">
        <span class="info-label">报价日期：</span>
        <span class="info-value">${quoteDate}</span>
      </div>
      <div class="info-item">
        <span class="info-label">客户名称：</span>
        <span class="info-value">${customerName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">有效期至：</span>
        <span class="info-value">${validUntil || '-'}</span>
      </div>
      ${customerAddress ? `
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">客户地址：</span>
        <span class="info-value">${customerAddress}</span>
      </div>
      ` : ''}
    </div>

    <!-- 报价明细 -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 22%;">服务项目</th>
          <th style="width: 22%;">Service Item</th>
          <th style="width: 10%; text-align: center;">单位</th>
          <th style="width: 10%; text-align: center;">数量</th>
          <th style="width: 18%; text-align: right;">单价</th>
          <th style="width: 18%; text-align: right;">金额</th>
        </tr>
      </thead>
      <tbody>
        ${generateItemsHtml()}
      </tbody>
    </table>

    <!-- 金额汇总 -->
    <div class="totals">
      <div class="totals-box">
        <div class="total-row">
          <span>小计 Subtotal</span>
          <span>${formatAmount(subtotal)}</span>
        </div>
        <div class="total-row grand">
          <span>合计 Total</span>
          <span>${formatAmount(totalAmount)}</span>
        </div>
      </div>
    </div>

    <!-- 条款说明 -->
    ${terms || notes ? `
    <div class="terms-section">
      <div class="terms-title">条款说明 / Terms & Conditions</div>
      <div class="terms-content">${terms || notes}</div>
    </div>
    ` : `
    <div class="terms-section">
      <div class="terms-title">条款说明 / Terms & Conditions</div>
      <div class="terms-content">
1. 本报价单有效期为自报价日起30天内有效。
2. 价格为含服务费的最终价格，不含相关税费。
3. 如有疑问，请及时与我们联系。
      </div>
    </div>
    `}

    <!-- 签章区 -->
    <div class="footer">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">客户签章 / Customer</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">公司签章 / Company</div>
      </div>
    </div>
  </div>
</body>
</html>
`
}

/**
 * 使用 Puppeteer 生成 PDF（如果可用）
 * @param {string} html - HTML内容
 * @returns {Promise<Buffer|null>} PDF Buffer 或 null
 */
export async function generatePdfFromHtml(html) {
  try {
    // 尝试动态导入 puppeteer
    const puppeteer = await import('puppeteer').catch(() => null)
    
    if (!puppeteer) {
      console.log('Puppeteer not available, returning HTML only')
      return null
    }

    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    })
    
    await browser.close()
    return pdf
  } catch (error) {
    console.error('PDF generation failed:', error.message)
    return null
  }
}

export default {
  generateQuotationHtml,
  generatePdfFromHtml
}
