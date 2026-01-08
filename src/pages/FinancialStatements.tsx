/**
 * 财务报表页面
 * 资产负债表、利润表、现金流量表、经营分析表
 */

import React, { useState, useEffect, useCallback } from 'react'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import {
  FileText,
  Download,
  RefreshCw,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  PieChart,
  BarChart3,
  Users,
  Package,
  Clock,
  History,
  Search,
  Eye,
  Loader2
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DateTimePicker from '../components/DateTimePicker'
import { formatDate } from '../utils/dateFormat'

// 报表类型
type ReportType = 'balance_sheet' | 'income_statement' | 'cash_flow' | 'business_analysis'

// 报表类型配置
const REPORT_TYPES: { key: ReportType; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'balance_sheet', label: '资产负债表', icon: <Wallet className="w-5 h-5" />, description: '反映企业在特定日期的财务状况' },
  { key: 'income_statement', label: '利润表', icon: <Receipt className="w-5 h-5" />, description: '反映企业一定期间的经营成果' },
  { key: 'cash_flow', label: '现金流量表', icon: <TrendingUp className="w-5 h-5" />, description: '反映企业现金流入流出情况' },
  { key: 'business_analysis', label: '经营分析', icon: <BarChart3 className="w-5 h-5" />, description: '全面分析企业经营状况' }
]

// 费用类别中文名
const FEE_CATEGORY_NAMES: Record<string, string> = {
  freight: '运费',
  customs: '关税',
  warehouse: '仓储费',
  insurance: '保险费',
  handling: '操作费',
  documentation: '文件费',
  other: '其他费用'
}

// 格式化金额
function formatCurrency(amount: number | string | null | undefined, currency = 'EUR'): string {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(num)
}

// 格式化百分比
function formatPercent(value: number | string | null | undefined): string {
  const num = Number(value) || 0
  return num.toFixed(2) + '%'
}


// 获取默认日期范围（本月）
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    startDate: firstDay.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0]
  }
}

// 资产负债表数据类型
interface BalanceSheetData {
  asOfDate: string
  assets: {
    bankBalance: number
    receivables: { total: number; overdue: number }
    total: number
  }
  liabilities: {
    payables: { total: number; overdue: number }
    total: number
  }
  netAssets: number
}

// 利润表数据类型
interface IncomeStatementData {
  periodStart: string
  periodEnd: string
  income: { byCategory: Record<string, number>; total: number }
  cost: { byCategory: Record<string, number>; total: number }
  grossProfit: number
  grossMargin: number
}

// 现金流量表数据类型
interface CashFlowData {
  periodStart: string
  periodEnd: string
  operatingActivities: { inflow: number; outflow: number; net: number }
  beginningBalance: number
  endingBalance: number
  netChange: number
}

// 经营分析数据类型
interface BusinessAnalysisData {
  periodStart: string
  periodEnd: string
  customerAnalysis: {
    totalCustomers: number
    newCustomers: number
    top5Contribution: number
    topCustomers: Array<{ rank: number; customerId: string; customerName: string; revenue: number; percentage: number }>
  }
  orderAnalysis: {
    totalOrders: number
    avgOrderAmount: number
    completionRate: number
    monthlyTrend: Array<{ month: string; orderCount: number }>
  }
  profitAnalysis: {
    totalIncome: number
    totalCost: number
    grossProfit: number
    grossMargin: number
    costBreakdown: Array<{ category: string; amount: number; percentage: number }>
  }
  receivablesAnalysis: {
    totalReceivables: number
    avgCollectionDays: number
    collectionRate: number
    aging: Array<{ range: string; amount: number }>
  }
  supplierAnalysis: {
    totalSuppliers: number
    totalPurchase: number
    topSuppliers: Array<{ rank: number; supplierId: string; supplierName: string; purchaseAmount: number }>
  }
  trendComparison: {
    current: { income: number; cost: number; grossProfit: number; orders: number }
    previous: { income: number; cost: number; grossProfit: number; orders: number }
    change: { income: number | null; cost: number | null; grossProfit: number | null; orders: number | null }
  }
}

// 报表历史记录类型
interface ReportHistory {
  id: string
  reportType: string
  reportName: string
  periodStart: string | null
  periodEnd: string | null
  asOfDate: string | null
  pdfUrl: string | null
  createdByName: string | null
  createdAt: string
}

export default function FinancialStatements() {
  // 当前选中的报表类型
  const [activeTab, setActiveTab] = useState<ReportType>('balance_sheet')
  // 日期选择
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [dateRange, setDateRange] = useState(getDefaultDateRange())
  // 报表数据
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null)
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null)
  const [businessAnalysis, setBusinessAnalysis] = useState<BusinessAnalysisData | null>(null)
  // 加载状态
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  // 历史记录
  const [showHistory, setShowHistory] = useState(false)
  const [historyData, setHistoryData] = useState<ReportHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // 获取报表数据
  const fetchReportData = useCallback(async () => {
    setLoading(true)
    try {
      let url = ''
      const params = new URLSearchParams()

      switch (activeTab) {
        case 'balance_sheet':
          params.set('asOfDate', asOfDate)
          url = `/api/finance/reports/balance-sheet?${params}`
          break
        case 'income_statement':
          params.set('startDate', dateRange.startDate)
          params.set('endDate', dateRange.endDate)
          url = `/api/finance/reports/income-statement?${params}`
          break
        case 'cash_flow':
          params.set('startDate', dateRange.startDate)
          params.set('endDate', dateRange.endDate)
          url = `/api/finance/reports/cash-flow?${params}`
          break
        case 'business_analysis':
          params.set('startDate', dateRange.startDate)
          params.set('endDate', dateRange.endDate)
          url = `/api/finance/reports/business-analysis?${params}`
          break
      }

      const res = await fetch(url)
      const json = await res.json()

      if (json.errCode === 200 && json.data) {
        switch (activeTab) {
          case 'balance_sheet':
            setBalanceSheet(json.data)
            break
          case 'income_statement':
            setIncomeStatement(json.data)
            break
          case 'cash_flow':
            setCashFlow(json.data)
            break
          case 'business_analysis':
            setBusinessAnalysis(json.data)
            break
        }
      } else {
        console.error('API 返回错误:', json.msg || json.message)
      }
    } catch (error) {
      console.error('获取报表数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, asOfDate, dateRange])

  // 获取历史记录
  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/finance/reports/history?reportType=${activeTab}`)
      const json = await res.json()
      if (json.errCode === 200 && json.data) {
        setHistoryData(json.data.list || [])
      }
    } catch (error) {
      console.error('获取历史记录失败:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  // 生成 PDF 报表
  const generatePDF = async () => {
    setGenerating(true)
    try {
      const body: Record<string, string> = {}
      if (activeTab === 'balance_sheet') {
        body.asOfDate = asOfDate
      } else {
        body.startDate = dateRange.startDate
        body.endDate = dateRange.endDate
      }

      const res = await fetch(`/api/finance/reports/${activeTab}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body)
      })

      const json = await res.json()

      if (json.errCode === 200 && json.data?.pdfUrl) {
        // 打开 PDF
        window.open(json.data.pdfUrl, '_blank')
        // 刷新历史记录
        if (showHistory) {
          fetchHistory()
        }
      } else {
        alert(json.msg || json.message || '生成报表失败')
      }
    } catch (error) {
      console.error('生成报表失败:', error)
      alert('生成报表失败')
    } finally {
      setGenerating(false)
    }
  }

  // 切换报表类型时重新获取数据
  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // 显示历史记录时获取
  useEffect(() => {
    if (showHistory) {
      fetchHistory()
    }
  }, [showHistory, activeTab])

  // 渲染资产负债表
  const renderBalanceSheet = () => {
    if (!balanceSheet) return <div className="text-center py-10 text-gray-500">暂无数据</div>

    return (
      <div className="space-y-6">
        {/* 资产 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <h3 className="text-base font-semibold text-blue-800">一、资产</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-2/3">项目</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额 (EUR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-700">流动资产</td>
                <td className="px-4 py-3"></td>
              </tr>
              <tr>
                <td className="px-4 py-3 pl-8 text-gray-600">银行存款</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.assets.bankBalance)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 pl-8 text-gray-600">应收账款</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.assets.receivables.total)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 pl-12 text-gray-400 text-sm">其中：逾期应收</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">{formatCurrency(balanceSheet.assets.receivables.overdue)}</td>
              </tr>
              <tr className="bg-blue-50 font-semibold">
                <td className="px-4 py-3 text-blue-800">资产合计</td>
                <td className="px-4 py-3 text-right font-mono text-blue-800">{formatCurrency(balanceSheet.assets.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 负债 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
            <h3 className="text-base font-semibold text-orange-800">二、负债</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-2/3">项目</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额 (EUR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-700">流动负债</td>
                <td className="px-4 py-3"></td>
              </tr>
              <tr>
                <td className="px-4 py-3 pl-8 text-gray-600">应付账款</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(balanceSheet.liabilities.payables.total)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 pl-12 text-gray-400 text-sm">其中：逾期应付</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">{formatCurrency(balanceSheet.liabilities.payables.overdue)}</td>
              </tr>
              <tr className="bg-orange-50 font-semibold">
                <td className="px-4 py-3 text-orange-800">负债合计</td>
                <td className="px-4 py-3 text-right font-mono text-orange-800">{formatCurrency(balanceSheet.liabilities.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 净资产 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h3 className="text-base font-semibold text-green-800">三、净资产</h3>
          </div>
          <table className="w-full">
            <tbody>
              <tr className="bg-green-50 font-semibold">
                <td className="px-4 py-4 text-green-800 w-2/3">净资产（资产 - 负债）</td>
                <td className="px-4 py-4 text-right font-mono text-xl text-green-700">{formatCurrency(balanceSheet.netAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 渲染利润表
  const renderIncomeStatement = () => {
    if (!incomeStatement) return <div className="text-center py-10 text-gray-500">暂无数据</div>

    const incomeEntries = Object.entries(incomeStatement.income.byCategory || {})
    const costEntries = Object.entries(incomeStatement.cost.byCategory || {})

    return (
      <div className="space-y-6">
        {/* 营业收入 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h3 className="text-base font-semibold text-green-800">一、营业收入</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-2/3">项目</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额 (EUR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incomeEntries.map(([category, amount]) => (
                <tr key={category}>
                  <td className="px-4 py-3 pl-8 text-gray-600">{FEE_CATEGORY_NAMES[category] || category}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(amount)}</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-semibold">
                <td className="px-4 py-3 text-green-800">收入小计</td>
                <td className="px-4 py-3 text-right font-mono text-green-700">{formatCurrency(incomeStatement.income.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 营业成本 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <h3 className="text-base font-semibold text-red-800">二、营业成本</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-2/3">项目</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额 (EUR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costEntries.map(([category, amount]) => (
                <tr key={category}>
                  <td className="px-4 py-3 pl-8 text-gray-600">{FEE_CATEGORY_NAMES[category] || category}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(amount)}</td>
                </tr>
              ))}
              <tr className="bg-red-50 font-semibold">
                <td className="px-4 py-3 text-red-800">成本小计</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{formatCurrency(incomeStatement.cost.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 利润 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <h3 className="text-base font-semibold text-blue-800">三、利润</h3>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              <tr className="font-semibold">
                <td className="px-4 py-4 text-gray-700 w-2/3">毛利润</td>
                <td className={`px-4 py-4 text-right font-mono text-xl ${incomeStatement.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(incomeStatement.grossProfit)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">毛利率</td>
                <td className="px-4 py-3 text-right font-mono text-blue-600">{formatPercent(incomeStatement.grossMargin)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 渲染现金流量表
  const renderCashFlow = () => {
    if (!cashFlow) return <div className="text-center py-10 text-gray-500">暂无数据</div>

    return (
      <div className="space-y-6">
        {/* 经营活动现金流 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <h3 className="text-base font-semibold text-blue-800">一、经营活动产生的现金流量</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-2/3">项目</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金额 (EUR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 pl-8 text-gray-600">销售收款</td>
                <td className="px-4 py-3 text-right font-mono text-green-600">{formatCurrency(cashFlow.operatingActivities.inflow)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 pl-8 text-gray-600">采购付款</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">({formatCurrency(cashFlow.operatingActivities.outflow)})</td>
              </tr>
              <tr className="bg-blue-50 font-semibold">
                <td className="px-4 py-3 text-blue-800">经营活动净现金流</td>
                <td className={`px-4 py-3 text-right font-mono ${cashFlow.operatingActivities.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(cashFlow.operatingActivities.net)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 现金余额变动 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <h3 className="text-base font-semibold text-green-800">二、现金余额变动</h3>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 text-gray-600 w-2/3">期初现金余额</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(cashFlow.beginningBalance)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-600">本期现金净增加额</td>
                <td className={`px-4 py-3 text-right font-mono ${cashFlow.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.netChange >= 0 ? '+' : ''}{formatCurrency(cashFlow.netChange)}
                </td>
              </tr>
              <tr className="bg-green-50 font-semibold">
                <td className="px-4 py-3 text-green-800">期末现金余额</td>
                <td className="px-4 py-3 text-right font-mono text-xl text-green-700">{formatCurrency(cashFlow.endingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 渲染经营分析表
  const renderBusinessAnalysis = () => {
    if (!businessAnalysis) return <div className="text-center py-10 text-gray-500">暂无数据</div>

    const { customerAnalysis, orderAnalysis, profitAnalysis, receivablesAnalysis, supplierAnalysis, trendComparison } = businessAnalysis

    return (
      <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{customerAnalysis.totalCustomers}</p>
                <p className="text-xs text-gray-500">客户总数</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{orderAnalysis.totalOrders}</p>
                <p className="text-xs text-gray-500">订单总量</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{formatPercent(profitAnalysis.grossMargin)}</p>
                <p className="text-xs text-gray-500">毛利率</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{receivablesAnalysis.avgCollectionDays} 天</p>
                <p className="text-xs text-gray-500">平均收款周期</p>
              </div>
            </div>
          </div>
        </div>

        {/* 客户分析 & 订单分析 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 客户分析 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-blue-800">客户分析</h3>
              <span className="text-sm text-blue-600">TOP5贡献占比: {formatPercent(customerAnalysis.top5Contribution)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">排名</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">客户名称</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">收入</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">占比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {customerAnalysis.topCustomers.slice(0, 5).map((c) => (
                  <tr key={c.customerId || c.rank}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        c.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        c.rank === 2 ? 'bg-gray-300 text-gray-700' :
                        c.rank === 3 ? 'bg-orange-400 text-orange-900' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {c.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{c.customerName || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(c.revenue)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatPercent(c.percentage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 订单分析 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-green-800">订单分析</h3>
              <span className="text-sm text-green-600">完成率: {formatPercent(orderAnalysis.completionRate)}</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{orderAnalysis.totalOrders}</p>
                  <p className="text-xs text-gray-500">订单总量</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{formatCurrency(orderAnalysis.avgOrderAmount)}</p>
                  <p className="text-xs text-gray-500">平均订单金额</p>
                </div>
              </div>
              {orderAnalysis.monthlyTrend.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">月度趋势</p>
                  <div className="space-y-1">
                    {orderAnalysis.monthlyTrend.slice(-6).map((m) => (
                      <div key={m.month} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16">{m.month}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-green-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, (m.orderCount / Math.max(...orderAnalysis.monthlyTrend.map(t => t.orderCount))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-600 w-8 text-right">{m.orderCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 应收账款分析 & 供应商分析 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 应收账款分析 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-orange-800">应收账款分析</h3>
              <span className="text-sm text-orange-600">回款率: {formatPercent(receivablesAnalysis.collectionRate)}</span>
            </div>
            <div className="p-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center mb-4">
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(receivablesAnalysis.totalReceivables)}</p>
                <p className="text-xs text-gray-500">应收账款总额</p>
              </div>
              <p className="text-xs text-gray-500 mb-2">账龄分析</p>
              <div className="space-y-2">
                {receivablesAnalysis.aging.map((a) => (
                  <div key={a.range} className="flex items-center justify-between">
                    <span className={`text-sm ${a.range === '90+' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {a.range === '90+' ? '90天以上' : a.range + '天'}
                    </span>
                    <span className={`font-mono text-sm ${a.range === '90+' ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatCurrency(a.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 供应商分析 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-purple-800">供应商分析</h3>
              <span className="text-sm text-purple-600">供应商: {supplierAnalysis.totalSuppliers} 家</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">排名</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">供应商名称</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">采购额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {supplierAnalysis.topSuppliers.slice(0, 5).map((s) => (
                  <tr key={s.supplierId || s.rank}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        s.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        s.rank === 2 ? 'bg-gray-300 text-gray-700' :
                        s.rank === 3 ? 'bg-orange-400 text-orange-900' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {s.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{s.supplierName || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(s.purchaseAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 趋势对比 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
            <h3 className="text-base font-semibold text-indigo-800">趋势对比分析（与上期对比）</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-sm">
                <th className="px-4 py-3 text-left font-medium text-gray-600">指标</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">本期</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">上期</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">环比变化</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 text-gray-700">营业收入</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(trendComparison.current.income)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{formatCurrency(trendComparison.previous.income)}</td>
                <td className={`px-4 py-3 text-right font-mono ${(trendComparison.change.income || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendComparison.change.income !== null ? (
                    <span className="flex items-center justify-end gap-1">
                      {trendComparison.change.income >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {trendComparison.change.income >= 0 ? '+' : ''}{formatPercent(trendComparison.change.income)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">营业成本</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(trendComparison.current.cost)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{formatCurrency(trendComparison.previous.cost)}</td>
                <td className={`px-4 py-3 text-right font-mono ${(trendComparison.change.cost || 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendComparison.change.cost !== null ? (
                    <span className="flex items-center justify-end gap-1">
                      {trendComparison.change.cost >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {trendComparison.change.cost >= 0 ? '+' : ''}{formatPercent(trendComparison.change.cost)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">毛利润</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(trendComparison.current.grossProfit)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{formatCurrency(trendComparison.previous.grossProfit)}</td>
                <td className={`px-4 py-3 text-right font-mono ${(trendComparison.change.grossProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendComparison.change.grossProfit !== null ? (
                    <span className="flex items-center justify-end gap-1">
                      {trendComparison.change.grossProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {trendComparison.change.grossProfit >= 0 ? '+' : ''}{formatPercent(trendComparison.change.grossProfit)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-700">订单量</td>
                <td className="px-4 py-3 text-right font-mono">{trendComparison.current.orders}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-500">{trendComparison.previous.orders}</td>
                <td className={`px-4 py-3 text-right font-mono ${(trendComparison.change.orders || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trendComparison.change.orders !== null ? (
                    <span className="flex items-center justify-end gap-1">
                      {trendComparison.change.orders >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {trendComparison.change.orders >= 0 ? '+' : ''}{formatPercent(trendComparison.change.orders)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 渲染历史记录
  const renderHistory = () => {
    if (historyLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-500">加载中...</span>
        </div>
      )
    }

    if (historyData.length === 0) {
      return <div className="text-center py-10 text-gray-500">暂无历史记录</div>
    }

    return (
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-sm">
            <th className="px-4 py-3 text-left font-medium text-gray-600">报表名称</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">报告期间</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">生成人</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">生成时间</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {historyData.map((report) => (
            <tr key={report.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-700">{report.reportName}</td>
              <td className="px-4 py-3 text-gray-600">
                {report.asOfDate
                  ? `截止 ${formatDate(report.asOfDate)}`
                  : `${formatDate(report.periodStart)} - ${formatDate(report.periodEnd)}`}
              </td>
              <td className="px-4 py-3 text-gray-600">{report.createdByName || '-'}</td>
              <td className="px-4 py-3 text-gray-500 text-sm">{formatDateTime(report.createdAt)}</td>
              <td className="px-4 py-3 text-center">
                {report.pdfUrl && (
                  <button
                    onClick={() => window.open(report.pdfUrl!, '_blank')}
                    className="text-blue-600 hover:text-blue-800"
                    title="查看/下载"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <PageHeader
        title="财务报表"
        description="资产负债表、利润表、现金流量表、经营分析"
      />

      <div className="flex-1 overflow-auto p-4">
        {/* 报表类型选择 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-4">
          {/* 第一行：报表类型选择 */}
          <div className="flex items-center gap-3 mb-4">
            {REPORT_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => setActiveTab(type.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === type.key
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span className={activeTab === type.key ? 'text-white' : 'text-gray-500'}>{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>

          {/* 分割线 */}
          <div className="border-t border-gray-100 my-4"></div>

          {/* 第二行：日期选择和操作按钮 */}
          <div className="flex items-center justify-between">
            {/* 日期选择 */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 font-medium">
                {activeTab === 'balance_sheet' ? '截止日期' : '报告期间'}
              </span>
              {activeTab === 'balance_sheet' ? (
                <div className="w-40">
                  <DateTimePicker
                    value={asOfDate}
                    onChange={setAsOfDate}
                    showTime={false}
                    placeholder="选择截止日期"
                    title="截止日期"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-40">
                    <DateTimePicker
                      value={dateRange.startDate}
                      onChange={(value) => setDateRange({ ...dateRange, startDate: value })}
                      showTime={false}
                      placeholder="开始日期"
                      title="开始日期"
                    />
                  </div>
                  <span className="text-gray-400 text-sm">至</span>
                  <div className="w-40">
                    <DateTimePicker
                      value={dateRange.endDate}
                      onChange={(value) => setDateRange({ ...dateRange, endDate: value })}
                      showTime={false}
                      placeholder="结束日期"
                      title="结束日期"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchReportData}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50 border border-gray-200 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>

              <button
                onClick={generatePDF}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 shadow-sm transition-all"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                导出 PDF
              </button>

              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors border ${
                  showHistory 
                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                }`}
              >
                <History className="w-4 h-4" />
                历史记录
              </button>
            </div>
          </div>

          {/* 报表说明 */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <FileText className="w-4 h-4 text-gray-400" />
            {REPORT_TYPES.find(t => t.key === activeTab)?.description}
          </div>
        </div>

        {/* 历史记录面板 */}
        {showHistory && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-gray-700">历史报表</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            {renderHistory()}
          </div>
        )}

        {/* 报表内容 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-500">加载报表数据...</span>
          </div>
        ) : (
          <>
            {activeTab === 'balance_sheet' && renderBalanceSheet()}
            {activeTab === 'income_statement' && renderIncomeStatement()}
            {activeTab === 'cash_flow' && renderCashFlow()}
            {activeTab === 'business_analysis' && renderBusinessAnalysis()}
          </>
        )}
      </div>
    </div>
  )
}
