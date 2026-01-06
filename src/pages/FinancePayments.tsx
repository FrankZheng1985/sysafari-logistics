import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, ArrowUpRight, ArrowDownRight, Trash2, Eye,
  CreditCard, Building2, Banknote, Wallet, X, FileText, Loader2, CheckSquare, Square,
  ChevronDown, ChevronRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import DateTimePicker from '../components/DateTimePicker'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 关联发票信息
interface LinkedInvoice {
  id: string
  invoiceNumber: string
  customerName: string
  totalAmount: number
  paidAmount: number
  currency: string
  status: string
  containerNumbers: string[]
}

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
  containerNumbers: string[]  // 集装箱号数组（所有关联发票的合并）
  invoiceCount?: number  // 关联发票数量（支持多发票核销）
  invoices?: LinkedInvoice[]  // 关联发票列表（展开显示用）
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
  const [pageSize, setPageSize] = useState(20)
  
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false)
  const [paymentMode, setPaymentMode] = useState<'income' | 'expense'>('income')
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  
  // 多选核销状态
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [showBatchPayment, setShowBatchPayment] = useState(false)
  const [batchPaymentData, setBatchPaymentData] = useState({
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    bankAccount: '',
    description: ''
  })
  const [batchPaymentLoading, setBatchPaymentLoading] = useState(false)
  
  // 展开行状态（显示关联发票）
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  
  // 切换展开/收起
  const toggleRowExpand = (paymentId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(paymentId)) {
        next.delete(paymentId)
      } else {
        next.add(paymentId)
      }
      return next
    })
  }

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
  }, [page, pageSize, filterType, filterMethod, searchValue])

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
    setSelectedInvoices([])  // 清空选择
    setShowInvoiceSelector(true)
    // 收款 -> 销售发票; 付款 -> 采购发票
    fetchInvoices(mode === 'income' ? 'sales' : 'purchase')
  }

  const handleSelectInvoice = (invoiceId: string) => {
    setShowInvoiceSelector(false)
    navigate(`/finance/invoices/${invoiceId}/payment`)
  }

  // 多选相关函数
  const handleToggleInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    )
  }

  const handleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  const getSelectedInvoicesTotal = () => {
    return filteredInvoices
      .filter(inv => selectedInvoices.includes(inv.id))
      .reduce((sum, inv) => sum + (Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)), 0)
  }

  const getSelectedInvoicesCurrency = () => {
    const selected = filteredInvoices.find(inv => selectedInvoices.includes(inv.id))
    return selected?.currency || 'EUR'
  }

  const handleOpenBatchPayment = () => {
    if (selectedInvoices.length === 0) {
      alert('请先选择要核销的发票')
      return
    }
    setShowBatchPayment(true)
    setBatchPaymentData({
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      bankAccount: '',
      description: `批量${paymentMode === 'income' ? '收款' : '付款'} - ${selectedInvoices.length} 张发票`
    })
  }

  const handleBatchPaymentSubmit = async () => {
    if (selectedInvoices.length === 0) return
    
    setBatchPaymentLoading(true)
    try {
      // 逐个为选中的发票创建收款记录
      const selectedInvoiceData = filteredInvoices.filter(inv => selectedInvoices.includes(inv.id))
      
      for (const invoice of selectedInvoiceData) {
        const unpaidAmount = Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0)
        
        const paymentData = {
          paymentType: paymentMode,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: unpaidAmount,
          currency: invoice.currency || 'EUR',
          paymentMethod: batchPaymentData.paymentMethod,
          paymentDate: batchPaymentData.paymentDate,
          referenceNumber: batchPaymentData.referenceNumber,
          bankAccount: batchPaymentData.bankAccount,
          description: batchPaymentData.description || `核销发票 ${invoice.invoiceNumber}`
        }
        
        const response = await fetch(`${API_BASE}/api/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        })
        
        const data = await response.json()
        if (data.errCode !== 200) {
          throw new Error(`发票 ${invoice.invoiceNumber} 核销失败: ${data.msg}`)
        }
      }
      
      alert(`成功核销 ${selectedInvoices.length} 张发票`)
      setShowBatchPayment(false)
      setShowInvoiceSelector(false)
      setSelectedInvoices([])
      fetchPayments()
      fetchStats()
    } catch (error: any) {
      console.error('批量核销失败:', error)
      alert(error.message || '批量核销失败')
    } finally {
      setBatchPaymentLoading(false)
    }
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
      width: '14%',
      sorter: true,
      render: (_value, record) => {
        const hasMultipleInvoices = record.invoiceCount && record.invoiceCount > 1
        const isExpanded = expandedRows.has(record.id)
        
        return (
          <div className="flex items-center gap-2">
            {/* 展开按钮 - 只在有多张发票时显示 */}
            {hasMultipleInvoices ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleRowExpand(record.id)
                }}
                className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600 transition-colors"
                title={isExpanded ? '收起发票' : '展开发票'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-5" /> // 占位符保持对齐
            )}
            <div>
              <div className="font-medium text-gray-900">{record.paymentNumber}</div>
              <div className="text-xs text-gray-400">{record.paymentDate}</div>
            </div>
          </div>
        )
      }
    },
    {
      key: 'paymentType',
      label: '类型',
      width: '7%',
      sorter: true,
      filters: [
        { text: '收款', value: 'income' },
        { text: '付款', value: 'expense' },
      ],
      onFilter: (value, record) => record.paymentType === value,
      render: (_value, record) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          record.paymentType === 'income' 
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {record.paymentType === 'income' ? (
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
      width: '14%',
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <div>
          <div className="text-sm text-gray-900">{record.customerName || '-'}</div>
          {record.invoiceNumber && (
            <div className="text-xs text-gray-400">
              发票: {record.invoiceNumber}
              {record.invoiceCount && record.invoiceCount > 1 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                  共{record.invoiceCount}张
                </span>
              )}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'containerNumbers',
      label: '集装箱号',
      width: '12%',
      render: (_value, record) => {
        const containers = record.containerNumbers || []
        if (containers.length === 0) {
          return <span className="text-xs text-gray-400">-</span>
        }
        // 只显示第一个，其他用 +N 表示，鼠标悬停显示全部
        const allContainersText = containers.join(', ')
        return (
          <div className="truncate cursor-default" title={allContainersText}>
            <div className="text-xs text-gray-900 truncate">
              {containers[0]}
            </div>
            {containers.length > 1 && (
              <div className="text-xs text-blue-600 font-medium">
                +{containers.length - 1} 个
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'amount',
      label: '金额',
      width: '10%',
      align: 'right',
      sorter: (a, b) => a.amount - b.amount,
      render: (_value, record) => (
        <div className={`text-right font-medium ${
          record.paymentType === 'income' ? 'text-green-600' : 'text-red-600'
        }`}>
          {record.paymentType === 'income' ? '+' : '-'}{formatCurrency(record.amount, record.currency)}
        </div>
      )
    },
    {
      key: 'paymentMethod',
      label: '支付方式',
      width: '9%',
      render: (_value, record) => {
        const config = getMethodConfig(record.paymentMethod)
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
      width: '12%',
      render: (_value, record) => (
        <span className="text-xs text-gray-600 truncate block">{record.referenceNumber || '-'}</span>
      )
    },
    {
      key: 'description',
      label: '说明',
      width: '15%',
      render: (_value, record) => (
        <span className="text-xs text-gray-500 truncate block">
          {record.description || '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: '7%',
      render: (_value, record) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => navigate(`/finance/payments/${record.id}`)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="查看详情"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(record.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [expandedRows])

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
              onKeyDown={(e) => e.key === 'Enter' && fetchPayments()}
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
          expandable={{
            expandedRowKeys: Array.from(expandedRows),
            expandedRowRender: (record) => {
              if (!record.invoices || record.invoices.length <= 1) return null
              
              return (
                <div className="pl-8 pr-4">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    关联发票 ({record.invoices.length}张)
                  </div>
                  <div className="space-y-2">
                    {record.invoices.map((inv: LinkedInvoice) => (
                      <div key={inv.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</div>
                            <div className="text-xs text-gray-500">{inv.customerName || '-'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* 集装箱号 */}
                          {inv.containerNumbers && inv.containerNumbers.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {inv.containerNumbers.map((cn, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                                >
                                  {cn}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* 金额 */}
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {Number(inv.totalAmount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €
                            </div>
                            <div className={`text-xs ${inv.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                              {inv.status === 'paid' ? '已核销' : '部分核销'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          }}
        />
      </div>

      {/* 分页 */}
      {total > 0 && (
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
              第 {page} / {Math.ceil(total / pageSize) || 1} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
              title="每页显示条数"
            >
              <option value={20}>20 条/页</option>
              <option value={50}>50 条/页</option>
              <option value={100}>100 条/页</option>
            </select>
          </div>
        </div>
      )}

      {/* 发票选择模态框 */}
      {showInvoiceSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowInvoiceSelector(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
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

            {/* 搜索框和全选 */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索发票号、客户名..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>
                {filteredInvoices.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    {selectedInvoices.length === filteredInvoices.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    全选
                  </button>
                )}
              </div>
              {/* 已选统计 */}
              {selectedInvoices.length > 0 && (
                <div className={`mt-3 flex items-center justify-between p-2 rounded-lg ${
                  paymentMode === 'income' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <span className={`text-sm font-medium ${
                    paymentMode === 'income' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    已选 {selectedInvoices.length} 张发票
                  </span>
                  <span className={`text-sm font-bold ${
                    paymentMode === 'income' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    合计: {formatCurrency(getSelectedInvoicesTotal(), getSelectedInvoicesCurrency())}
                  </span>
                </div>
              )}
            </div>

            {/* 发票列表 */}
            <div className="overflow-y-auto max-h-[45vh] p-4">
              {invoiceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">加载中...</span>
                </div>
              ) : filteredInvoices.length > 0 ? (
                <div className="space-y-2">
                  {filteredInvoices.map(invoice => {
                    const unpaid = Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0)
                    const isSelected = selectedInvoices.includes(invoice.id)
                    return (
                      <div
                        key={invoice.id}
                        className={`flex items-center gap-3 px-4 py-3 border rounded-lg transition-colors cursor-pointer ${
                          isSelected 
                            ? paymentMode === 'income' 
                              ? 'border-green-400 bg-green-50' 
                              : 'border-red-400 bg-red-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {/* 复选框 */}
                        <button
                          onClick={() => handleToggleInvoice(invoice.id)}
                          className="flex-shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className={`w-5 h-5 ${
                              paymentMode === 'income' ? 'text-green-600' : 'text-red-600'
                            }`} />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        
                        {/* 发票信息 */}
                        <div 
                          className="flex-1 min-w-0"
                          onClick={() => handleToggleInvoice(invoice.id)}
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
                        </div>
                        
                        {/* 单独核销按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectInvoice(invoice.id)
                          }}
                          className="flex-shrink-0 px-2 py-1 text-xs text-primary-600 hover:bg-primary-100 rounded transition-colors"
                        >
                          单独核销
                      </button>
                      </div>
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

            {/* 底部操作栏 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                点击复选框多选，或点击"单独核销"处理单张发票
              </p>
              {selectedInvoices.length > 0 && (
                <button
                  onClick={handleOpenBatchPayment}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    paymentMode === 'income' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  批量核销 ({selectedInvoices.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* 批量核销模态框 */}
      {showBatchPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowBatchPayment(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* 标题栏 */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              paymentMode === 'income' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center gap-2">
                <CheckSquare className={`w-5 h-5 ${
                  paymentMode === 'income' ? 'text-green-600' : 'text-red-600'
                }`} />
                <h3 className={`text-base font-semibold ${
                  paymentMode === 'income' ? 'text-green-700' : 'text-red-700'
                }`}>
                  批量{paymentMode === 'income' ? '收款' : '付款'}核销
                </h3>
              </div>
              <button 
                onClick={() => setShowBatchPayment(false)}
                className="p-1 hover:bg-white/50 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 核销信息 */}
            <div className="p-4 space-y-4">
              {/* 汇总信息 */}
              <div className={`p-3 rounded-lg ${
                paymentMode === 'income' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">核销发票数</span>
                  <span className="font-semibold">{selectedInvoices.length} 张</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">
                    {paymentMode === 'income' ? '收款' : '付款'}总额
                  </span>
                  <span className={`text-lg font-bold ${
                    paymentMode === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(getSelectedInvoicesTotal(), getSelectedInvoicesCurrency())}
                  </span>
                </div>
              </div>

              {/* 支付方式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支付方式</label>
                <select
                  value={batchPaymentData.paymentMethod}
                  onChange={(e) => setBatchPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="bank_transfer">银行转账</option>
                  <option value="cash">现金</option>
                  <option value="check">支票</option>
                  <option value="credit_card">信用卡</option>
                  <option value="wechat">微信支付</option>
                  <option value="alipay">支付宝</option>
                </select>
              </div>

              {/* 付款日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {paymentMode === 'income' ? '收款' : '付款'}日期
                </label>
                <DateTimePicker
                  value={batchPaymentData.paymentDate}
                  onChange={(value) => setBatchPaymentData(prev => ({ ...prev, paymentDate: value }))}
                  showTime={false}
                  placeholder="选择日期"
                />
              </div>

              {/* 参考号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">参考号/流水号</label>
                <input
                  type="text"
                  value={batchPaymentData.referenceNumber}
                  onChange={(e) => setBatchPaymentData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                  placeholder="可选，如银行流水号"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={batchPaymentData.description}
                  onChange={(e) => setBatchPaymentData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBatchPayment(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchPaymentSubmit}
                disabled={batchPaymentLoading}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  paymentMode === 'income' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {batchPaymentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    确认核销
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

