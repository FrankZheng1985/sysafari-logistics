import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Download, TrendingUp, TrendingDown, 
  DollarSign, PieChart, BarChart3, FileText,
  ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface ReportData {
  summary: {
    totalIncome: number
    totalExpense: number
    netProfit: number
    profitMargin: number
  }
  receivables: {
    total: number
    current: number
    overdue: number
  }
  payables: {
    total: number
    current: number
    overdue: number
  }
  cashFlow: {
    inflow: number
    outflow: number
    net: number
  }
  monthlyData: Array<{
    month: string
    income: number
    expense: number
    profit: number
  }>
  categoryBreakdown: Array<{
    category: string
    amount: number
    percentage: number
  }>
  topCustomers: Array<{
    name: string
    revenue: number
    transactions: number
  }>
}

export default function FinanceReports() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [reportType, setReportType] = useState<'overview' | 'profit' | 'cashflow' | 'receivables'>('overview')

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '历史记录', path: '/finance/invoices/history' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

   
  useEffect(() => {
    fetchReportData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })
      
      // 并行获取各类数据
      const [overviewRes, invoiceRes, paymentRes, feeRes] = await Promise.all([
        fetch(`${API_BASE}/api/finance/overview?${params}`),
        fetch(`${API_BASE}/api/invoices/stats?${params}`),
        fetch(`${API_BASE}/api/payments/stats?${params}`),
        fetch(`${API_BASE}/api/fees/stats?${params}`)
      ])

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [overview, invoiceStats, paymentStats, feeStats] = await Promise.all([
        overviewRes.json(),
        invoiceRes.json(),
        paymentRes.json(),
        feeRes.json()
      ])

      // 构建报表数据
      const data: ReportData = {
        summary: {
          totalIncome: paymentStats.data?.income?.total || 0,
          totalExpense: paymentStats.data?.expense?.total || 0,
          netProfit: (paymentStats.data?.income?.total || 0) - (paymentStats.data?.expense?.total || 0),
          profitMargin: paymentStats.data?.income?.total > 0 
            ? (((paymentStats.data?.income?.total || 0) - (paymentStats.data?.expense?.total || 0)) / (paymentStats.data?.income?.total || 1) * 100)
            : 0
        },
        receivables: {
          total: invoiceStats.data?.sales?.totalAmount || 0,
          current: invoiceStats.data?.sales?.unpaidAmount || 0,
          overdue: 0 // 需要额外计算
        },
        payables: {
          total: invoiceStats.data?.purchase?.totalAmount || 0,
          current: invoiceStats.data?.purchase?.unpaidAmount || 0,
          overdue: 0
        },
        cashFlow: {
          inflow: paymentStats.data?.income?.total || 0,
          outflow: paymentStats.data?.expense?.total || 0,
          net: paymentStats.data?.netCashFlow || 0
        },
        monthlyData: generateMonthlyData(),
        categoryBreakdown: (feeStats.data?.byCategory || []).map((c: any) => ({
          category: getCategoryName(c.category),
          amount: c.total,
          percentage: feeStats.data?.totalAmount > 0 ? (c.total / feeStats.data.totalAmount * 100) : 0
        })),
        topCustomers: [] // 需要额外API
      }

      setReportData(data)
    } catch (error) {
      console.error('获取报表数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateMonthlyData = () => {
    // 生成模拟月度数据
    const months = []
    const currentDate = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      months.push({
        month: `${date.getMonth() + 1}月`,
        income: Math.floor(Math.random() * 100000) + 50000,
        expense: Math.floor(Math.random() * 60000) + 30000,
        profit: 0
      })
    }
    months.forEach(m => m.profit = m.income - m.expense)
    return months
  }

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      freight: '运费',
      customs: '关税',
      warehouse: '仓储费',
      insurance: '保险费',
      handling: '操作费',
      documentation: '文件费',
      other: '其他'
    }
    return names[category] || category
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const handleExport = () => {
    // 导出报表为CSV
    if (!reportData) return

    const rows = [
      ['财务报表'],
      [`报表期间: ${dateRange.startDate} 至 ${dateRange.endDate}`],
      [],
      ['收支汇总'],
      ['总收入', formatCurrency(reportData.summary.totalIncome)],
      ['总支出', formatCurrency(reportData.summary.totalExpense)],
      ['净利润', formatCurrency(reportData.summary.netProfit)],
      ['利润率', formatPercent(reportData.summary.profitMargin)],
      [],
      ['应收账款'],
      ['总额', formatCurrency(reportData.receivables.total)],
      ['待收', formatCurrency(reportData.receivables.current)],
      [],
      ['应付账款'],
      ['总额', formatCurrency(reportData.payables.total)],
      ['待付', formatCurrency(reportData.payables.current)],
    ]

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `财务报表_${dateRange.startDate}_${dateRange.endDate}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="p-4">
        <PageHeader
          title="财务管理"
          tabs={tabs}
          activeTab="/finance/reports"
          onTabChange={(path) => navigate(path)}
        />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/reports"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-4">
          {/* 日期范围选择 */}
          <div className="flex items-center gap-2">
            <DatePicker
              value={dateRange.startDate}
              onChange={(value) => setDateRange(prev => ({ ...prev, startDate: value }))}
              placeholder="开始日期"
            />
            <span className="text-gray-400 text-xs">至</span>
            <DatePicker
              value={dateRange.endDate}
              onChange={(value) => setDateRange(prev => ({ ...prev, endDate: value }))}
              placeholder="结束日期"
            />
          </div>

          {/* 快捷日期按钮 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const now = new Date()
                setDateRange({
                  startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
              }}
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              本月
            </button>
            <button
              onClick={() => {
                const now = new Date()
                setDateRange({
                  startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
              }}
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              近三月
            </button>
            <button
              onClick={() => {
                const now = new Date()
                setDateRange({
                  startDate: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
              }}
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              本年
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReportData}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            <Download className="w-3.5 h-3.5" />
            导出报表
          </button>
        </div>
      </div>

      {/* 报表类型切换 */}
      <div className="flex gap-2">
        {[
          { key: 'overview', label: '综合概览', icon: BarChart3 },
          { key: 'profit', label: '利润分析', icon: TrendingUp },
          { key: 'cashflow', label: '现金流量', icon: DollarSign },
          { key: 'receivables', label: '应收应付', icon: FileText },
        ].map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setReportType(item.key as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                reportType === item.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* ========== 综合概览 ========== */}
      {reportType === 'overview' && (
        <>
          {/* 核心指标 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-1">总收入</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(reportData?.summary.totalIncome || 0)}
                  </div>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-1">总支出</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(reportData?.summary.totalExpense || 0)}
                  </div>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <ArrowDownRight className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-1">净利润</div>
                  <div className={`text-xl font-bold ${(reportData?.summary.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(reportData?.summary.netProfit || 0)}
                  </div>
                </div>
                <div className={`p-2 rounded-lg ${(reportData?.summary.netProfit || 0) >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                  <TrendingUp className={`w-5 h-5 ${(reportData?.summary.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 mb-1">利润率</div>
                  <div className={`text-xl font-bold ${(reportData?.summary.profitMargin || 0) >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                    {formatPercent(reportData?.summary.profitMargin || 0)}
                  </div>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <PieChart className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* 费用分类 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-500" />
              费用分类分析
            </h3>
            {reportData?.categoryBreakdown && reportData.categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {reportData.categoryBreakdown.map((item, index) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-purple-500', 'bg-cyan-500', 'bg-gray-500']
                  return (
                    <div key={item.category} className="flex items-center gap-3">
                      <div className="w-20 text-sm text-gray-600">{item.category}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                        <div 
                          className={`h-full ${colors[index % colors.length]} transition-all duration-500`}
                          style={{ width: `${item.percentage}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          <span className="text-xs font-medium text-white drop-shadow">{formatPercent(item.percentage)}</span>
                          <span className="text-xs text-gray-700">{formatCurrency(item.amount)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                暂无费用数据
              </div>
            )}
          </div>

          {/* 概览简要 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4">
              <h4 className="text-sm font-medium text-green-800 mb-2">应收概况</h4>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(reportData?.receivables.total || 0)}</div>
              <div className="text-xs text-green-600 mt-1">待收：{formatCurrency(reportData?.receivables.current || 0)}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 p-4">
              <h4 className="text-sm font-medium text-orange-800 mb-2">应付概况</h4>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(reportData?.payables.total || 0)}</div>
              <div className="text-xs text-orange-600 mt-1">待付：{formatCurrency(reportData?.payables.current || 0)}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">现金净流</h4>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(reportData?.cashFlow.net || 0)}</div>
              <div className="text-xs text-blue-600 mt-1">流入 - 流出</div>
            </div>
          </div>
        </>
      )}

      {/* ========== 利润分析 ========== */}
      {reportType === 'profit' && (
        <>
          {/* 利润核心指标 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">总收入</div>
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatCurrency(reportData?.summary.totalIncome || 0)}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                  <ArrowUpRight className="w-3 h-3" />
                  收款总额
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">总支出</div>
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {formatCurrency(reportData?.summary.totalExpense || 0)}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-red-600">
                  <ArrowDownRight className="w-3 h-3" />
                  付款总额
                </div>
              </div>
            </div>
            <div className={`bg-white rounded-lg border-2 p-6 ${(reportData?.summary.netProfit || 0) >= 0 ? 'border-blue-500' : 'border-red-500'}`}>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">净利润</div>
                <div className={`text-3xl font-bold mb-2 ${(reportData?.summary.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(reportData?.summary.netProfit || 0)}
                </div>
                <div className={`flex items-center justify-center gap-1 text-xs ${(reportData?.summary.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  <TrendingUp className="w-3 h-3" />
                  利润率: {formatPercent(reportData?.summary.profitMargin || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* 利润计算明细 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              利润计算明细
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">营业收入</div>
                    <div className="text-xs text-gray-500">收款总额</div>
                  </div>
                </div>
                <div className="text-xl font-bold text-green-600">
                  + {formatCurrency(reportData?.summary.totalIncome || 0)}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">营业成本</div>
                    <div className="text-xs text-gray-500">付款总额</div>
                  </div>
                </div>
                <div className="text-xl font-bold text-red-600">
                  - {formatCurrency(reportData?.summary.totalExpense || 0)}
                </div>
              </div>

              <div className="border-t-2 border-dashed border-gray-200 pt-4">
                <div className={`flex items-center justify-between p-4 rounded-lg ${(reportData?.summary.netProfit || 0) >= 0 ? 'bg-blue-50' : 'bg-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(reportData?.summary.netProfit || 0) >= 0 ? 'bg-blue-100' : 'bg-gray-200'}`}>
                      <DollarSign className={`w-5 h-5 ${(reportData?.summary.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">净利润</div>
                      <div className="text-xs text-gray-500">收入 - 成本</div>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${(reportData?.summary.netProfit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    = {formatCurrency(reportData?.summary.netProfit || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 月度利润趋势 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              月度利润趋势
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">月份</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">收入</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">支出</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">利润</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData?.monthlyData.map((item) => (
                    <tr key={item.month} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900">{item.month}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(item.income)}</td>
                      <td className="py-2 px-3 text-right text-red-600">{formatCurrency(item.expense)}</td>
                      <td className={`py-2 px-3 text-right font-medium ${item.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(item.profit)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.profit >= 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />盈利
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                            <ArrowDownRight className="w-3 h-3 mr-0.5" />亏损
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========== 现金流量 ========== */}
      {reportType === 'cashflow' && (
        <>
          {/* 现金流量核心 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              现金流量表
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl text-center border border-green-200">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                  <ArrowUpRight className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-xs text-gray-500 mb-2">现金流入</div>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(reportData?.cashFlow.inflow || 0)}
                </div>
                <div className="mt-3 text-xs text-green-600 bg-green-100 rounded-full py-1 px-3 inline-block">
                  收到的客户付款
                </div>
              </div>
              
              <div className="p-6 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl text-center border border-red-200">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                  <ArrowDownRight className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-xs text-gray-500 mb-2">现金流出</div>
                <div className="text-3xl font-bold text-red-600">
                  {formatCurrency(reportData?.cashFlow.outflow || 0)}
                </div>
                <div className="mt-3 text-xs text-red-600 bg-red-100 rounded-full py-1 px-3 inline-block">
                  支付给供应商
                </div>
              </div>
              
              <div className={`p-6 rounded-xl text-center border-2 ${(reportData?.cashFlow.net || 0) >= 0 ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300' : 'bg-gray-50 border-gray-300'}`}>
                <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${(reportData?.cashFlow.net || 0) >= 0 ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  <DollarSign className={`w-6 h-6 ${(reportData?.cashFlow.net || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`} />
                </div>
                <div className="text-xs text-gray-500 mb-2">净现金流</div>
                <div className={`text-3xl font-bold ${(reportData?.cashFlow.net || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {formatCurrency(reportData?.cashFlow.net || 0)}
                </div>
                <div className={`mt-3 text-xs rounded-full py-1 px-3 inline-block ${(reportData?.cashFlow.net || 0) >= 0 ? 'text-blue-600 bg-blue-100' : 'text-gray-600 bg-gray-200'}`}>
                  {(reportData?.cashFlow.net || 0) >= 0 ? '正向流动' : '负向流动'}
                </div>
              </div>
            </div>
          </div>

          {/* 现金流量计算公式 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4">现金流量计算</h3>
            <div className="flex items-center justify-center gap-4 text-lg">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-500">流入</div>
                <div className="font-bold text-green-600">{formatCurrency(reportData?.cashFlow.inflow || 0)}</div>
              </div>
              <span className="text-2xl text-gray-400">-</span>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-xs text-gray-500">流出</div>
                <div className="font-bold text-red-600">{formatCurrency(reportData?.cashFlow.outflow || 0)}</div>
              </div>
              <span className="text-2xl text-gray-400">=</span>
              <div className={`text-center p-4 rounded-lg ${(reportData?.cashFlow.net || 0) >= 0 ? 'bg-blue-50' : 'bg-gray-100'}`}>
                <div className="text-xs text-gray-500">净流量</div>
                <div className={`font-bold ${(reportData?.cashFlow.net || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {formatCurrency(reportData?.cashFlow.net || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* 月度现金流 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              月度现金流动
            </h3>
            <div className="space-y-3">
              {reportData?.monthlyData.map((item) => (
                <div key={item.month} className="flex items-center gap-4">
                  <div className="w-12 text-sm font-medium text-gray-600">{item.month}</div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="h-6 bg-green-100 rounded relative overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-green-500"
                        style={{ width: `${Math.min(100, item.income / 1000)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-green-700">
                        流入 {formatCurrency(item.income)}
                      </span>
                    </div>
                    <div className="h-6 bg-red-100 rounded relative overflow-hidden">
                      <div 
                        className="absolute inset-y-0 left-0 bg-red-500"
                        style={{ width: `${Math.min(100, item.expense / 1000)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-red-700">
                        流出 {formatCurrency(item.expense)}
                      </span>
                    </div>
                  </div>
                  <div className={`w-24 text-right text-sm font-bold ${item.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ========== 应收应付 ========== */}
      {reportType === 'receivables' && (
        <>
          {/* 应收应付对比 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 应收账款 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                应收账款
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">应收总额</div>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(reportData?.receivables.total || 0)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">待收款项</div>
                    <div className="text-lg font-bold text-yellow-600">{formatCurrency(reportData?.receivables.current || 0)}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">已收回款</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency((reportData?.receivables.total || 0) - (reportData?.receivables.current || 0))}
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">回款进度</span>
                    <span className="text-xs font-medium text-blue-600">
                      {reportData?.receivables.total 
                        ? formatPercent((reportData.receivables.total - reportData.receivables.current) / reportData.receivables.total * 100)
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                      style={{ 
                        width: `${reportData?.receivables.total 
                          ? ((reportData.receivables.total - reportData.receivables.current) / reportData.receivables.total * 100) 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 应付账款 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-orange-500" />
                应付账款
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">应付总额</div>
                  <div className="text-2xl font-bold text-orange-600">{formatCurrency(reportData?.payables.total || 0)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">待付款项</div>
                    <div className="text-lg font-bold text-red-600">{formatCurrency(reportData?.payables.current || 0)}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">已付款项</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency((reportData?.payables.total || 0) - (reportData?.payables.current || 0))}
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">付款进度</span>
                    <span className="text-xs font-medium text-orange-600">
                      {reportData?.payables.total 
                        ? formatPercent((reportData.payables.total - reportData.payables.current) / reportData.payables.total * 100)
                        : '0%'}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all"
                      style={{ 
                        width: `${reportData?.payables.total 
                          ? ((reportData.payables.total - reportData.payables.current) / reportData.payables.total * 100) 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 账款对比汇总 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              账款对比汇总
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">项目</th>
                    <th className="text-right py-3 px-4 font-medium text-blue-600">应收</th>
                    <th className="text-right py-3 px-4 font-medium text-orange-600">应付</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">差额</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">总额</td>
                    <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(reportData?.receivables.total || 0)}</td>
                    <td className="py-3 px-4 text-right text-orange-600">{formatCurrency(reportData?.payables.total || 0)}</td>
                    <td className={`py-3 px-4 text-right font-medium ${(reportData?.receivables.total || 0) - (reportData?.payables.total || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency((reportData?.receivables.total || 0) - (reportData?.payables.total || 0))}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">待处理</td>
                    <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(reportData?.receivables.current || 0)}</td>
                    <td className="py-3 px-4 text-right text-orange-600">{formatCurrency(reportData?.payables.current || 0)}</td>
                    <td className={`py-3 px-4 text-right font-medium ${(reportData?.receivables.current || 0) - (reportData?.payables.current || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency((reportData?.receivables.current || 0) - (reportData?.payables.current || 0))}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">已完成</td>
                    <td className="py-3 px-4 text-right text-blue-600">
                      {formatCurrency((reportData?.receivables.total || 0) - (reportData?.receivables.current || 0))}
                    </td>
                    <td className="py-3 px-4 text-right text-orange-600">
                      {formatCurrency((reportData?.payables.total || 0) - (reportData?.payables.current || 0))}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-600">
                      {formatCurrency(
                        ((reportData?.receivables.total || 0) - (reportData?.receivables.current || 0)) - 
                        ((reportData?.payables.total || 0) - (reportData?.payables.current || 0))
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 净应收/应付 */}
          <div className={`p-6 rounded-lg text-center ${
            (reportData?.receivables.current || 0) - (reportData?.payables.current || 0) >= 0 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
              : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'
          }`}>
            <div className="text-sm text-gray-600 mb-2">
              净待收/付 = 待收账款 - 待付账款
            </div>
            <div className={`text-4xl font-bold ${
              (reportData?.receivables.current || 0) - (reportData?.payables.current || 0) >= 0 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {formatCurrency((reportData?.receivables.current || 0) - (reportData?.payables.current || 0))}
            </div>
            <div className={`mt-2 text-sm ${
              (reportData?.receivables.current || 0) - (reportData?.payables.current || 0) >= 0 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {(reportData?.receivables.current || 0) - (reportData?.payables.current || 0) >= 0 
                ? '资金充裕，可支配资金为正' 
                : '资金紧张，需要尽快催收'}
            </div>
          </div>
        </>
      )}

    </div>
  )
}

