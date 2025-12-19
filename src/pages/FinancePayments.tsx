import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, ArrowUpRight, ArrowDownRight, Trash2,
  CreditCard, Building2, Banknote, Wallet, X, FileText, Loader2
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Payment {
  id: string
  paymentNumber: string
  paymentType: 'income' | 'expense'
  paymentDate: string
  paymentMethod: string
  invoiceId: string | null
  invoiceNumber: string
  customerId: string | null
  customerName: string
  amount: number
  currency: string
  bankAccount: string
  referenceNumber: string
  description: string
  status: string
  createTime: string
}

interface PaymentStats {
  income: { count: number; total: number }
  expense: { count: number; total: number }
  netCashFlow: number
}

export default function FinancePayments() {
  const navigate = useNavigate()
  
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'income' | 'expense'>('income')
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState('')

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
    fetchPayments()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterType, filterMethod, searchValue])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(filterType && { type: filterType }),
        ...(filterMethod && { method: filterMethod }),
        ...(searchValue && { search: searchValue }),
      })
      
      const response = await fetch(`${API_BASE}/api/payments?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setPayments(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取付款记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('获取付款统计失败:', error)
    }
  }

  const fetchInvoices = async (type: 'sales' | 'purchase') => {
    setInvoiceLoading(true)
    try {
      // 获取所有未付清的发票 (status=unpaid_all 查询 unpaid 和 partial 状态，包含逾期)
      const response = await fetch(`${API_BASE}/api/invoices?type=${type}&status=unpaid_all&pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200) {
        setInvoices(data.data?.list || [])
      }
    } catch (error) {
      console.error('获取发票列表失败:', error)
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleOpenPaymentModal = (mode: 'income' | 'expense') => {
    setPaymentMode(mode)
    setInvoiceSearch('')
    setShowInvoiceSelector(true)
    // 收款 -> 销售发票; 付款 -> 采购发票
    fetchInvoices(mode === 'income' ? 'sales' : 'purchase')
  }

  const handleSelectInvoice = (invoiceId: string) => {
    setShowInvoiceSelector(false)
    navigate(`/finance/invoices/${invoiceId}/payment`)
  }

  const filteredInvoices = invoices.filter(inv => {
    if (!invoiceSearch) return true
    const search = invoiceSearch.toLowerCase()
    return (
      inv.invoiceNumber?.toLowerCase().includes(search) ||
      inv.customerName?.toLowerCase().includes(search) ||
      inv.supplierName?.toLowerCase().includes(search)
    )
  })

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条付款记录吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/payments/${id}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.errCode === 200) {
        fetchPayments()
        fetchStats()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除付款记录失败:', error)
      alert('删除失败')
    }
  }

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getMethodConfig = (method: string) => {
    const configs: Record<string, { label: string; icon: typeof CreditCard }> = {
      bank_transfer: { label: '银行转账', icon: Building2 },
      cash: { label: '现金', icon: Banknote },
      check: { label: '支票', icon: CreditCard },
      credit_card: { label: '信用卡', icon: CreditCard },
      wechat: { label: '微信支付', icon: Wallet },
      alipay: { label: '支付宝', icon: Wallet },
      other: { label: '其他', icon: CreditCard },
    }
    return configs[method] || configs.other
  }

  const columns: Column<Payment>[] = useMemo(() => [
    {
      key: 'paymentNumber',
      label: '付款单号',
      width: 150,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.paymentNumber}</div>
          <div className="text-xs text-gray-400">{item.paymentDate}</div>
        </div>
      )
    },
    {
      key: 'paymentType',
      label: '类型',
      width: 100,
      render: (item) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          item.paymentType === 'income' 
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {item.paymentType === 'income' ? (
            <><ArrowUpRight className="w-3 h-3" /> 收款</>
          ) : (
            <><ArrowDownRight className="w-3 h-3" /> 付款</>
          )}
        </span>
      )
    },
    {
      key: 'customerName',
      label: '客户/供应商',
      width: 150,
      render: (item) => (
        <div>
          <div className="text-sm text-gray-900">{item.customerName || '-'}</div>
          {item.invoiceNumber && (
            <div className="text-xs text-gray-400">发票: {item.invoiceNumber}</div>
          )}
        </div>
      )
    },
    {
      key: 'amount',
      label: '金额',
      width: 120,
      align: 'right',
      render: (item) => (
        <div className={`text-right font-medium ${
          item.paymentType === 'income' ? 'text-green-600' : 'text-red-600'
        }`}>
          {item.paymentType === 'income' ? '+' : '-'}{formatCurrency(item.amount, item.currency)}
        </div>
      )
    },
    {
      key: 'paymentMethod',
      label: '支付方式',
      width: 120,
      render: (item) => {
        const config = getMethodConfig(item.paymentMethod)
        const Icon = config.icon
        return (
          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        )
      }
    },
    {
      key: 'referenceNumber',
      label: '参考号',
      width: 150,
      render: (item) => (
        <span className="text-xs text-gray-600">{item.referenceNumber || '-'}</span>
      )
    },
    {
      key: 'description',
      label: '说明',
      width: 200,
      render: (item) => (
        <span className="text-xs text-gray-500 truncate block max-w-[200px]">
          {item.description || '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 80,
      render: (item) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleDelete(item.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/payments"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 收款统计 */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">收款</span>
          </div>
          <div className="text-2xl font-bold text-green-700">
            {formatCurrency(stats?.income?.total || 0)}
          </div>
          <div className="text-xs text-green-600 mt-1">
            {stats?.income?.count || 0} 笔记录
          </div>
        </div>

        {/* 付款统计 */}
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">付款</span>
          </div>
          <div className="text-2xl font-bold text-red-700">
            {formatCurrency(stats?.expense?.total || 0)}
          </div>
          <div className="text-xs text-red-600 mt-1">
            {stats?.expense?.count || 0} 笔记录
          </div>
        </div>

        {/* 净现金流 */}
        <div className={`rounded-lg p-4 ${(stats?.netCashFlow || 0) >= 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className={`w-5 h-5 ${(stats?.netCashFlow || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`} />
            <span className={`text-sm font-medium ${(stats?.netCashFlow || 0) >= 0 ? 'text-blue-700' : 'text-gray-700'}`}>
              净现金流
            </span>
          </div>
          <div className={`text-2xl font-bold ${(stats?.netCashFlow || 0) >= 0 ? 'text-blue-700' : 'text-gray-700'}`}>
            {formatCurrency(stats?.netCashFlow || 0)}
          </div>
          <div className={`text-xs mt-1 ${(stats?.netCashFlow || 0) >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
            收款 - 付款
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索付款单号、客户名..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            <option value="income">收款</option>
            <option value="expense">付款</option>
          </select>

          {/* 支付方式筛选 */}
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部方式</option>
            <option value="bank_transfer">银行转账</option>
            <option value="cash">现金</option>
            <option value="check">支票</option>
            <option value="credit_card">信用卡</option>
            <option value="wechat">微信支付</option>
            <option value="alipay">支付宝</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenPaymentModal('income')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            记录收款
          </button>
          <button
            onClick={() => handleOpenPaymentModal('expense')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <ArrowDownRight className="w-4 h-4" />
            记录付款
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          rowKey="id"
        />
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">
            共 {total} 条记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-xs text-gray-600">
              第 {page} / {Math.ceil(total / pageSize)} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 发票选择模态框 */}
      {showInvoiceSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowInvoiceSelector(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            {/* 标题栏 */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              paymentMode === 'income' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center gap-2">
                {paymentMode === 'income' ? (
                  <ArrowUpRight className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-600" />
                )}
                <h3 className={`text-base font-semibold ${
                  paymentMode === 'income' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {paymentMode === 'income' ? '选择发票进行收款' : '选择发票进行付款'}
                </h3>
              </div>
              <button 
                onClick={() => setShowInvoiceSelector(false)}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                title="关闭"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 搜索框 */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索发票号、客户名..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>
            </div>

            {/* 发票列表 */}
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {invoiceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">加载中...</span>
                </div>
              ) : filteredInvoices.length > 0 ? (
                <div className="space-y-2">
                  {filteredInvoices.map(invoice => {
                    const unpaid = Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0)
                    return (
                      <button
                        key={invoice.id}
                        onClick={() => handleSelectInvoice(invoice.id)}
                        className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                          </div>
                          <span className={`text-sm font-semibold ${
                            paymentMode === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            待{paymentMode === 'income' ? '收' : '付'}: {formatCurrency(unpaid, invoice.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{invoice.customerName || invoice.supplierName || '-'}</span>
                          <span>总额: {formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    {paymentMode === 'income' ? '暂无待收款的销售发票' : '暂无待付款的采购发票'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    请先在发票管理中创建发票
                  </p>
                </div>
              )}
            </div>

            {/* 底部提示 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                选择一张发票后，将跳转到收款登记页面
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

