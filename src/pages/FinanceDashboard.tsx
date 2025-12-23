import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, TrendingDown, Receipt,
  FileText, CreditCard, AlertTriangle, CheckCircle,
  Clock, ChevronRight, ArrowUpRight, ArrowDownRight,
  Wallet, PieChart
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface FinanceOverview {
  invoices: {
    sales: {
      totalCount: number
      totalAmount: number
      paidAmount: number
      unpaidAmount: number
      pendingCount: number
      paidCount: number
      overdueCount: number
    }
    purchase: {
      totalCount: number
      totalAmount: number
      paidAmount: number
      unpaidAmount: number
      pendingCount: number
      paidCount: number
      overdueCount: number
    }
    balance: {
      receivable: number
      payable: number
      net: number
    }
  }
  payments: {
    income: { count: number; total: number }
    expense: { count: number; total: number }
    netCashFlow: number
  }
  fees: {
    byCategory: Array<{ category: string; count: number; total: number }>
    totalAmount: number
  }
  summary: {
    receivable: number
    payable: number
    netCashFlow: number
    totalFees: number
  }
}

export default function FinanceDashboard() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [loading, setLoading] = useState(true)

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
    fetchOverview()
  }, [])

  const fetchOverview = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/api/finance/overview`)
      const data = await response.json()
      if (data.errCode === 200) {
        setOverview(data.data)
      }
    } catch (error) {
      console.error('获取财务概览失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      freight: '运费',
      transport: '运输费',
      customs: '关税',
      duty: '进口税',
      tax: '增值税',
      warehouse: '仓储费',
      storage: '仓储费',
      insurance: '保险费',
      handling: '操作费',
      documentation: '文件费',
      port: '港口费',
      service: '服务费',
      package: '包装费',
      other: '其他费用'
    }
    return names[category] || category
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance"
        onTabChange={(path) => navigate(path)}
      />

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 应收账款 */}
        <div 
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/finance/invoices?type=sales')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-blue-100 text-xs mb-1">应收账款</div>
          <div className="text-xl font-bold">{formatCurrency(overview?.summary?.receivable || 0)}</div>
          <div className="mt-2 text-blue-100 text-xs flex items-center gap-1">
            <span>{overview?.invoices?.sales?.pendingCount || 0} 张待收</span>
            {(overview?.invoices?.sales?.overdueCount || 0) > 0 && (
              <span className="text-yellow-200">· {overview?.invoices?.sales?.overdueCount} 张逾期</span>
            )}
          </div>
        </div>

        {/* 应付账款 */}
        <div 
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/finance/invoices?type=purchase')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="text-orange-100 text-xs mb-1">应付账款</div>
          <div className="text-xl font-bold">{formatCurrency(overview?.summary?.payable || 0)}</div>
          <div className="mt-2 text-orange-100 text-xs flex items-center gap-1">
            <span>{overview?.invoices?.purchase?.pendingCount || 0} 张待付</span>
            {(overview?.invoices?.purchase?.overdueCount || 0) > 0 && (
              <span className="text-yellow-200">· {overview?.invoices?.purchase?.overdueCount} 张逾期</span>
            )}
          </div>
        </div>

        {/* 净现金流 */}
        <div 
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/finance/payments')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="text-green-100 text-xs mb-1">净现金流</div>
          <div className="text-xl font-bold">{formatCurrency(overview?.summary?.netCashFlow || 0)}</div>
          <div className="mt-2 text-green-100 text-xs space-y-0.5">
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              收 {formatCurrency(overview?.payments?.income?.total || 0)}
            </div>
            <div className="flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" />
              付 {formatCurrency(overview?.payments?.expense?.total || 0)}
            </div>
          </div>
        </div>

        {/* 总费用 */}
        <div 
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/finance/fees')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="text-purple-100 text-xs mb-1">总费用支出</div>
          <div className="text-xl font-bold">{formatCurrency(overview?.summary?.totalFees || 0)}</div>
          <div className="mt-2 text-purple-100 text-xs">
            共 {overview?.fees?.byCategory?.reduce((sum, c) => sum + c.count, 0) || 0} 笔费用记录
          </div>
        </div>
      </div>

      {/* 详情区域 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 发票统计 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              发票统计
            </h3>
            <button
              onClick={() => navigate('/finance/invoices')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* 销售发票 */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => navigate('/finance/invoices?type=sales')}
                  className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
                >
                  销售发票（应收）
                </button>
                <button
                  onClick={() => navigate('/finance/invoices?type=sales')}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {overview?.invoices?.sales?.totalCount || 0} 张
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <button 
                  onClick={() => navigate('/finance/invoices?type=sales&status=paid')}
                  className="flex items-center gap-1 hover:text-green-700 hover:bg-green-100 px-1.5 py-0.5 rounded transition-colors"
                >
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  已收 {overview?.invoices?.sales?.paidCount || 0}
                </button>
                <button 
                  onClick={() => navigate('/finance/invoices?type=sales&status=pending')}
                  className="flex items-center gap-1 hover:text-yellow-700 hover:bg-yellow-100 px-1.5 py-0.5 rounded transition-colors"
                >
                  <Clock className="w-3 h-3 text-yellow-500" />
                  待收 {overview?.invoices?.sales?.pendingCount || 0}
                </button>
                <button 
                  onClick={() => navigate('/finance/invoices?type=sales&status=overdue')}
                  className="flex items-center gap-1 hover:text-red-700 hover:bg-red-100 px-1.5 py-0.5 rounded transition-colors"
                >
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  逾期 {overview?.invoices?.sales?.overdueCount || 0}
                </button>
              </div>
              <div className="mt-2 text-sm">
                <span className="text-gray-500">总额</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatCurrency(overview?.invoices?.sales?.totalAmount || 0)}
                </span>
              </div>
            </div>

            {/* 采购发票 */}
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => navigate('/finance/invoices?type=purchase')}
                  className="text-sm font-medium text-orange-700 hover:text-orange-900 hover:underline"
                >
                  采购发票（应付）
                </button>
                <button
                  onClick={() => navigate('/finance/invoices?type=purchase')}
                  className="text-sm text-orange-600 hover:text-orange-800 hover:underline"
                >
                  {overview?.invoices?.purchase?.totalCount || 0} 张
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <button 
                  onClick={() => navigate('/finance/invoices?type=purchase&status=paid')}
                  className="flex items-center gap-1 hover:text-green-700 hover:bg-green-100 px-1.5 py-0.5 rounded transition-colors"
                >
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  已付 {overview?.invoices?.purchase?.paidCount || 0}
                </button>
                <button 
                  onClick={() => navigate('/finance/invoices?type=purchase&status=pending')}
                  className="flex items-center gap-1 hover:text-yellow-700 hover:bg-yellow-100 px-1.5 py-0.5 rounded transition-colors"
                >
                  <Clock className="w-3 h-3 text-yellow-500" />
                  待付 {overview?.invoices?.purchase?.pendingCount || 0}
                </button>
                <button 
                  onClick={() => navigate('/finance/invoices?type=purchase&status=overdue')}
                  className="flex items-center gap-1 hover:text-red-700 hover:bg-red-100 px-1.5 py-0.5 rounded transition-colors"
                >
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  逾期 {overview?.invoices?.purchase?.overdueCount || 0}
                </button>
              </div>
              <div className="mt-2 text-sm">
                <span className="text-gray-500">总额</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatCurrency(overview?.invoices?.purchase?.totalAmount || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 费用分类 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-gray-500" />
              费用分类
            </h3>
            <button
              onClick={() => navigate('/finance/fees')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {overview?.fees?.byCategory && overview.fees.byCategory.length > 0 ? (
            <div className="space-y-2">
              {overview.fees.byCategory.map((item, index) => (
                <div key={item.category} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: [
                        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
                        '#8B5CF6', '#EC4899', '#6B7280'
                      ][index % 7] 
                    }}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{getCategoryName(item.category)}</span>
                    <div className="text-sm">
                      <span className="text-gray-400 mr-2">{item.count}笔</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无费用数据
            </div>
          )}
        </div>
      </div>

      {/* 收付款流水 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-500" />
            收付款统计
          </h3>
          <button
            onClick={() => navigate('/finance/payments')}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            查看全部 <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">收款</span>
            </div>
            <div className="text-xl font-bold text-green-700">
              {formatCurrency(overview?.payments?.income?.total || 0)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              {overview?.payments?.income?.count || 0} 笔记录
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">付款</span>
            </div>
            <div className="text-xl font-bold text-red-700">
              {formatCurrency(overview?.payments?.expense?.total || 0)}
            </div>
            <div className="text-xs text-red-600 mt-1">
              {overview?.payments?.expense?.count || 0} 笔记录
            </div>
          </div>

          <div className={`rounded-lg p-4 ${(overview?.payments?.netCashFlow || 0) >= 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className={`w-4 h-4 ${(overview?.payments?.netCashFlow || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`} />
              <span className={`text-sm font-medium ${(overview?.payments?.netCashFlow || 0) >= 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                净现金流
              </span>
            </div>
            <div className={`text-xl font-bold ${(overview?.payments?.netCashFlow || 0) >= 0 ? 'text-blue-700' : 'text-gray-700'}`}>
              {formatCurrency(overview?.payments?.netCashFlow || 0)}
            </div>
            <div className={`text-xs mt-1 ${(overview?.payments?.netCashFlow || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
              收款 - 付款
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

