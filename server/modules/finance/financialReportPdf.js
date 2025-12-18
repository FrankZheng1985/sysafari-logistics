/**
 * 财务报表 PDF 生成器
 * 
 * 生成资产负债表、利润表、现金流量表、经营分析表的 PDF
 * 并上传到腾讯云 COS
 */

import puppeteer from 'puppeteer'
import * as cosStorage from './cosStorage.js'
import { generateId } from '../../utils/id.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 本地文件存储目录
const LOCAL_STORAGE_DIR = path.join(__dirname, '../../uploads/reports')

// 确保本地存储目录存在
function ensureLocalStorageDir() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
  }
}

// 公司信息
const COMPANY_INFO = {
  name: 'BP Logistics GmbH',
  address: 'Musterstraße 123, 20095 Hamburg, Germany',
  phone: '+49 40 123456',
  email: 'info@bplogistics.de',
  website: 'www.bplogistics.de',
  taxId: 'DE123456789'
}

// 报表类型名称
const REPORT_NAMES = {
  balance_sheet: '资产负债表',
  income_statement: '利润表',
  cash_flow: '现金流量表',
  business_analysis: '经营分析报告'
}

// 费用类别中文名
const FEE_CATEGORY_NAMES = {
  freight: '运费',
  customs: '关税',
  warehouse: '仓储费',
  insurance: '保险费',
  handling: '操作费',
  documentation: '文件费',
  other: '其他费用'
}

/**
 * 格式化金额
 */
function formatCurrency(amount, currency = 'EUR') {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(num)
}

/**
 * 格式化百分比
 */
function formatPercent(value) {
  const num = Number(value) || 0
  return num.toFixed(2) + '%'
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

/**
 * 生成报表 HTML 基础样式
 */
function getBaseStyles() {
  return `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif;
        font-size: 12px;
        color: #333;
        line-height: 1.5;
        padding: 20mm;
        background: white;
      }
      .report-header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #1a56db;
      }
      .company-name {
        font-size: 24px;
        font-weight: bold;
        color: #1a56db;
        margin-bottom: 5px;
      }
      .company-info {
        font-size: 10px;
        color: #666;
        margin-bottom: 15px;
      }
      .report-title {
        font-size: 20px;
        font-weight: bold;
        color: #333;
        margin-top: 15px;
      }
      .report-period {
        font-size: 12px;
        color: #666;
        margin-top: 5px;
      }
      .section {
        margin-bottom: 25px;
      }
      .section-title {
        font-size: 14px;
        font-weight: bold;
        color: #1a56db;
        padding: 8px 12px;
        background: #f0f5ff;
        border-left: 4px solid #1a56db;
        margin-bottom: 15px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
      }
      th, td {
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }
      th {
        background: #f9fafb;
        font-weight: 600;
        color: #374151;
      }
      .text-right {
        text-align: right;
      }
      .text-center {
        text-align: center;
      }
      .amount {
        font-family: 'Courier New', monospace;
        text-align: right;
      }
      .total-row {
        font-weight: bold;
        background: #f0f5ff;
      }
      .total-row td {
        border-top: 2px solid #1a56db;
        border-bottom: 2px solid #1a56db;
      }
      .highlight {
        color: #1a56db;
        font-weight: bold;
      }
      .negative {
        color: #dc2626;
      }
      .positive {
        color: #16a34a;
      }
      .indent {
        padding-left: 30px;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        font-size: 10px;
        color: #666;
        text-align: center;
      }
      .sub-table {
        margin-left: 20px;
        width: calc(100% - 20px);
      }
      .sub-table th, .sub-table td {
        padding: 6px 10px;
        font-size: 11px;
      }
      .chart-placeholder {
        height: 150px;
        background: #f9fafb;
        border: 1px dashed #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
        margin: 15px 0;
      }
      @media print {
        body {
          padding: 15mm;
        }
        .page-break {
          page-break-before: always;
        }
      }
    </style>
  `
}

/**
 * 生成报表头部 HTML
 */
function generateReportHeader(reportType, periodInfo) {
  const reportName = REPORT_NAMES[reportType] || '财务报表'
  let periodText = ''
  
  if (periodInfo.asOfDate) {
    periodText = `截止日期：${formatDate(periodInfo.asOfDate)}`
  } else if (periodInfo.periodStart && periodInfo.periodEnd) {
    periodText = `报告期间：${formatDate(periodInfo.periodStart)} 至 ${formatDate(periodInfo.periodEnd)}`
  }
  
  return `
    <div class="report-header">
      <div class="company-name">${COMPANY_INFO.name}</div>
      <div class="company-info">
        ${COMPANY_INFO.address} | Tel: ${COMPANY_INFO.phone} | ${COMPANY_INFO.email}
      </div>
      <div class="report-title">${reportName}</div>
      <div class="report-period">${periodText}</div>
      <div class="report-period">生成时间：${new Date().toLocaleString('zh-CN')}</div>
    </div>
  `
}

/**
 * 生成报表底部 HTML
 */
function generateReportFooter() {
  return `
    <div class="footer">
      <p>本报表由 BP Logistics 物流管理系统自动生成</p>
      <p>如有疑问请联系：${COMPANY_INFO.email}</p>
    </div>
  `
}

/**
 * 生成资产负债表 HTML
 */
function generateBalanceSheetHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
    </head>
    <body>
      ${generateReportHeader('balance_sheet', { asOfDate: data.asOfDate })}
      
      <div class="section">
        <div class="section-title">一、资产</div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">项目</th>
              <th class="text-right" style="width: 40%">金额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>流动资产</strong></td>
              <td></td>
            </tr>
            <tr>
              <td class="indent">银行存款</td>
              <td class="amount">${formatCurrency(data.assets.bankBalance)}</td>
            </tr>
            <tr>
              <td class="indent">应收账款</td>
              <td class="amount">${formatCurrency(data.assets.receivables.total)}</td>
            </tr>
            <tr>
              <td class="indent" style="padding-left: 50px; color: #666;">其中：逾期应收</td>
              <td class="amount negative">${formatCurrency(data.assets.receivables.overdue)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>资产合计</strong></td>
              <td class="amount highlight">${formatCurrency(data.assets.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">二、负债</div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">项目</th>
              <th class="text-right" style="width: 40%">金额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>流动负债</strong></td>
              <td></td>
            </tr>
            <tr>
              <td class="indent">应付账款</td>
              <td class="amount">${formatCurrency(data.liabilities.payables.total)}</td>
            </tr>
            <tr>
              <td class="indent" style="padding-left: 50px; color: #666;">其中：逾期应付</td>
              <td class="amount negative">${formatCurrency(data.liabilities.payables.overdue)}</td>
            </tr>
            <tr class="total-row">
              <td><strong>负债合计</strong></td>
              <td class="amount">${formatCurrency(data.liabilities.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">三、净资产</div>
        <table>
          <tbody>
            <tr class="total-row">
              <td style="width: 60%"><strong>净资产（资产 - 负债）</strong></td>
              <td class="amount highlight" style="width: 40%; font-size: 16px;">
                ${formatCurrency(data.netAssets)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${generateReportFooter()}
    </body>
    </html>
  `
}

/**
 * 生成利润表 HTML
 */
function generateIncomeStatementHTML(data) {
  const incomeCategories = Object.entries(data.income.byCategory || {})
  const costCategories = Object.entries(data.cost.byCategory || {})
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
    </head>
    <body>
      ${generateReportHeader('income_statement', { periodStart: data.periodStart, periodEnd: data.periodEnd })}
      
      <div class="section">
        <div class="section-title">一、营业收入</div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">项目</th>
              <th class="text-right" style="width: 40%">金额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            ${incomeCategories.map(([category, amount]) => `
              <tr>
                <td class="indent">${FEE_CATEGORY_NAMES[category] || category}</td>
                <td class="amount">${formatCurrency(amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td><strong>收入小计</strong></td>
              <td class="amount highlight">${formatCurrency(data.income.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">二、营业成本</div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">项目</th>
              <th class="text-right" style="width: 40%">金额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            ${costCategories.map(([category, amount]) => `
              <tr>
                <td class="indent">${FEE_CATEGORY_NAMES[category] || category}</td>
                <td class="amount">${formatCurrency(amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td><strong>成本小计</strong></td>
              <td class="amount">${formatCurrency(data.cost.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">三、利润</div>
        <table>
          <tbody>
            <tr class="total-row">
              <td style="width: 60%"><strong>毛利润</strong></td>
              <td class="amount ${data.grossProfit >= 0 ? 'positive' : 'negative'}" style="width: 40%; font-size: 16px;">
                ${formatCurrency(data.grossProfit)}
              </td>
            </tr>
            <tr>
              <td><strong>毛利率</strong></td>
              <td class="amount highlight">${formatPercent(data.grossMargin)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${generateReportFooter()}
    </body>
    </html>
  `
}

/**
 * 生成现金流量表 HTML
 */
function generateCashFlowHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
    </head>
    <body>
      ${generateReportHeader('cash_flow', { periodStart: data.periodStart, periodEnd: data.periodEnd })}
      
      <div class="section">
        <div class="section-title">一、经营活动产生的现金流量</div>
        <table>
          <thead>
            <tr>
              <th style="width: 60%">项目</th>
              <th class="text-right" style="width: 40%">金额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="indent">销售收款</td>
              <td class="amount positive">${formatCurrency(data.operatingActivities.inflow)}</td>
            </tr>
            <tr>
              <td class="indent">采购付款</td>
              <td class="amount negative">(${formatCurrency(data.operatingActivities.outflow)})</td>
            </tr>
            <tr class="total-row">
              <td><strong>经营活动净现金流</strong></td>
              <td class="amount ${data.operatingActivities.net >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(data.operatingActivities.net)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">二、现金余额变动</div>
        <table>
          <tbody>
            <tr>
              <td style="width: 60%">期初现金余额</td>
              <td class="amount" style="width: 40%">${formatCurrency(data.beginningBalance)}</td>
            </tr>
            <tr>
              <td>本期现金净增加额</td>
              <td class="amount ${data.netChange >= 0 ? 'positive' : 'negative'}">
                ${data.netChange >= 0 ? '+' : ''}${formatCurrency(data.netChange)}
              </td>
            </tr>
            <tr class="total-row">
              <td><strong>期末现金余额</strong></td>
              <td class="amount highlight" style="font-size: 16px;">${formatCurrency(data.endingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${generateReportFooter()}
    </body>
    </html>
  `
}

/**
 * 生成经营分析表 HTML
 */
function generateBusinessAnalysisHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
      <style>
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-card {
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1a56db;
        }
        .stat-label {
          font-size: 11px;
          color: #666;
          margin-top: 5px;
        }
        .rank-badge {
          display: inline-block;
          width: 24px;
          height: 24px;
          line-height: 24px;
          text-align: center;
          border-radius: 50%;
          font-size: 12px;
          font-weight: bold;
        }
        .rank-1 { background: #ffd700; color: #333; }
        .rank-2 { background: #c0c0c0; color: #333; }
        .rank-3 { background: #cd7f32; color: #fff; }
        .rank-other { background: #e5e7eb; color: #666; }
        .change-positive { color: #16a34a; }
        .change-negative { color: #dc2626; }
      </style>
    </head>
    <body>
      ${generateReportHeader('business_analysis', { periodStart: data.periodStart, periodEnd: data.periodEnd })}
      
      <!-- 客户分析 -->
      <div class="section">
        <div class="section-title">一、客户分析</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.customerAnalysis.totalCustomers}</div>
            <div class="stat-label">客户总数（家）</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.customerAnalysis.newCustomers}</div>
            <div class="stat-label">新增客户（家）</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatPercent(data.customerAnalysis.top5Contribution)}</div>
            <div class="stat-label">TOP5客户贡献占比</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 10%">排名</th>
              <th style="width: 50%">客户名称</th>
              <th class="text-right" style="width: 25%">收入 (EUR)</th>
              <th class="text-right" style="width: 15%">占比</th>
            </tr>
          </thead>
          <tbody>
            ${(data.customerAnalysis.topCustomers || []).slice(0, 5).map(c => `
              <tr>
                <td class="text-center">
                  <span class="rank-badge ${c.rank <= 3 ? 'rank-' + c.rank : 'rank-other'}">${c.rank}</span>
                </td>
                <td>${c.customerName || '-'}</td>
                <td class="amount">${formatCurrency(c.revenue)}</td>
                <td class="amount">${formatPercent(c.percentage)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- 订单分析 -->
      <div class="section">
        <div class="section-title">二、订单分析</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.orderAnalysis.totalOrders}</div>
            <div class="stat-label">订单总量（单）</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(data.orderAnalysis.avgOrderAmount)}</div>
            <div class="stat-label">平均订单金额</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatPercent(data.orderAnalysis.completionRate)}</div>
            <div class="stat-label">订单完成率</div>
          </div>
        </div>
        
        ${data.orderAnalysis.monthlyTrend && data.orderAnalysis.monthlyTrend.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>月份</th>
              <th class="text-right">订单量</th>
            </tr>
          </thead>
          <tbody>
            ${data.orderAnalysis.monthlyTrend.map(m => `
              <tr>
                <td>${m.month}</td>
                <td class="amount">${m.orderCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </div>
      
      <div class="page-break"></div>
      
      <!-- 盈利能力分析 -->
      <div class="section">
        <div class="section-title">三、盈利能力分析</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(data.profitAnalysis.totalIncome)}</div>
            <div class="stat-label">营业收入</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(data.profitAnalysis.grossProfit)}</div>
            <div class="stat-label">毛利润</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatPercent(data.profitAnalysis.grossMargin)}</div>
            <div class="stat-label">毛利率</div>
          </div>
        </div>
        
        ${data.profitAnalysis.costBreakdown && data.profitAnalysis.costBreakdown.length > 0 ? `
        <p style="margin: 10px 0; color: #666;">成本构成：</p>
        <table>
          <thead>
            <tr>
              <th style="width: 50%">费用类别</th>
              <th class="text-right" style="width: 30%">金额 (EUR)</th>
              <th class="text-right" style="width: 20%">占比</th>
            </tr>
          </thead>
          <tbody>
            ${data.profitAnalysis.costBreakdown.map(c => `
              <tr>
                <td>${FEE_CATEGORY_NAMES[c.category] || c.category}</td>
                <td class="amount">${formatCurrency(c.amount)}</td>
                <td class="amount">${formatPercent(c.percentage)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </div>
      
      <!-- 应收账款分析 -->
      <div class="section">
        <div class="section-title">四、应收账款分析</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(data.receivablesAnalysis.totalReceivables)}</div>
            <div class="stat-label">应收账款总额</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.receivablesAnalysis.avgCollectionDays} 天</div>
            <div class="stat-label">平均收款周期</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatPercent(data.receivablesAnalysis.collectionRate)}</div>
            <div class="stat-label">回款率</div>
          </div>
        </div>
        
        ${data.receivablesAnalysis.aging && data.receivablesAnalysis.aging.length > 0 ? `
        <p style="margin: 10px 0; color: #666;">账龄分析：</p>
        <table>
          <thead>
            <tr>
              <th style="width: 50%">账龄</th>
              <th class="text-right" style="width: 50%">金额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            ${data.receivablesAnalysis.aging.map(a => `
              <tr>
                <td>${a.range === '90+' ? '90天以上' : a.range + '天'}</td>
                <td class="amount ${a.range === '90+' ? 'negative' : ''}">${formatCurrency(a.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </div>
      
      <!-- 供应商分析 -->
      <div class="section">
        <div class="section-title">五、供应商分析</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.supplierAnalysis.totalSuppliers}</div>
            <div class="stat-label">供应商总数（家）</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(data.supplierAnalysis.totalPurchase)}</div>
            <div class="stat-label">采购总额</div>
          </div>
        </div>
        
        ${data.supplierAnalysis.topSuppliers && data.supplierAnalysis.topSuppliers.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th style="width: 10%">排名</th>
              <th style="width: 60%">供应商名称</th>
              <th class="text-right" style="width: 30%">采购额 (EUR)</th>
            </tr>
          </thead>
          <tbody>
            ${data.supplierAnalysis.topSuppliers.slice(0, 5).map(s => `
              <tr>
                <td class="text-center">
                  <span class="rank-badge ${s.rank <= 3 ? 'rank-' + s.rank : 'rank-other'}">${s.rank}</span>
                </td>
                <td>${s.supplierName || '-'}</td>
                <td class="amount">${formatCurrency(s.purchaseAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </div>
      
      <!-- 趋势对比分析 -->
      <div class="section">
        <div class="section-title">六、趋势对比分析（与上期对比）</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%">指标</th>
              <th class="text-right" style="width: 25%">本期</th>
              <th class="text-right" style="width: 25%">上期</th>
              <th class="text-right" style="width: 25%">环比变化</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>营业收入</td>
              <td class="amount">${formatCurrency(data.trendComparison.current.income)}</td>
              <td class="amount">${formatCurrency(data.trendComparison.previous.income)}</td>
              <td class="amount ${(data.trendComparison.change.income || 0) >= 0 ? 'change-positive' : 'change-negative'}">
                ${data.trendComparison.change.income !== null ? (data.trendComparison.change.income >= 0 ? '+' : '') + formatPercent(data.trendComparison.change.income) : '-'}
              </td>
            </tr>
            <tr>
              <td>营业成本</td>
              <td class="amount">${formatCurrency(data.trendComparison.current.cost)}</td>
              <td class="amount">${formatCurrency(data.trendComparison.previous.cost)}</td>
              <td class="amount ${(data.trendComparison.change.cost || 0) <= 0 ? 'change-positive' : 'change-negative'}">
                ${data.trendComparison.change.cost !== null ? (data.trendComparison.change.cost >= 0 ? '+' : '') + formatPercent(data.trendComparison.change.cost) : '-'}
              </td>
            </tr>
            <tr>
              <td>毛利润</td>
              <td class="amount">${formatCurrency(data.trendComparison.current.grossProfit)}</td>
              <td class="amount">${formatCurrency(data.trendComparison.previous.grossProfit)}</td>
              <td class="amount ${(data.trendComparison.change.grossProfit || 0) >= 0 ? 'change-positive' : 'change-negative'}">
                ${data.trendComparison.change.grossProfit !== null ? (data.trendComparison.change.grossProfit >= 0 ? '+' : '') + formatPercent(data.trendComparison.change.grossProfit) : '-'}
              </td>
            </tr>
            <tr>
              <td>订单量</td>
              <td class="amount">${data.trendComparison.current.orders}</td>
              <td class="amount">${data.trendComparison.previous.orders}</td>
              <td class="amount ${(data.trendComparison.change.orders || 0) >= 0 ? 'change-positive' : 'change-negative'}">
                ${data.trendComparison.change.orders !== null ? (data.trendComparison.change.orders >= 0 ? '+' : '') + formatPercent(data.trendComparison.change.orders) : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${generateReportFooter()}
    </body>
    </html>
  `
}

/**
 * 生成 PDF
 */
export async function generateReportPDF(reportType, data) {
  let html = ''
  
  switch (reportType) {
    case 'balance_sheet':
      html = generateBalanceSheetHTML(data)
      break
    case 'income_statement':
      html = generateIncomeStatementHTML(data)
      break
    case 'cash_flow':
      html = generateCashFlowHTML(data)
      break
    case 'business_analysis':
      html = generateBusinessAnalysisHTML(data)
      break
    default:
      throw new Error('未知的报表类型: ' + reportType)
  }
  
  // 使用 Puppeteer 生成 PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    })
    
    return pdfBuffer
  } finally {
    await browser.close()
  }
}

/**
 * 生成并上传报表 PDF 到腾讯云 COS
 */
export async function generateAndUploadReport(reportType, data, options = {}) {
  const { createdBy, createdByName } = options
  
  // 生成 PDF
  const pdfBuffer = await generateReportPDF(reportType, data)
  
  // 生成文件名
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const reportName = REPORT_NAMES[reportType] || reportType
  const filename = `${reportName}_${timestamp}.pdf`
  const cosKey = `reports/${reportType}/${filename}`
  
  let pdfUrl = null
  let pdfKey = null
  
  // 尝试上传到腾讯云 COS
  try {
    const uploadResult = await cosStorage.uploadFile(pdfBuffer, cosKey, 'application/pdf')
    pdfUrl = uploadResult.url
    pdfKey = cosKey
    console.log('报表已上传到腾讯云 COS:', pdfUrl)
  } catch (error) {
    console.warn('上传到腾讯云失败，保存到本地:', error.message)
    // 保存到本地
    ensureLocalStorageDir()
    const localPath = path.join(LOCAL_STORAGE_DIR, filename)
    fs.writeFileSync(localPath, pdfBuffer)
    pdfUrl = `/api/finance/reports/files/${filename}`
    pdfKey = filename
  }
  
  return {
    pdfUrl,
    pdfKey,
    pdfBuffer,
    reportName,
    filename
  }
}

// 导出 REPORT_NAMES 常量
export { REPORT_NAMES }

// 默认导出
export default {
  generateReportPDF,
  generateAndUploadReport,
  REPORT_NAMES
}
