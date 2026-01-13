import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Search, Plus, FileText, Edit2, Trash2, Eye,
  CheckCircle, Clock, AlertTriangle, XCircle,
  Download, FileSpreadsheet, CreditCard, X, Loader2
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import DateTimePicker from '../components/DateTimePicker'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface BankAccount {
  id: string
  accountName: string
  bankName: string
  currency: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceType: 'sales' | 'purchase'
  invoiceDate: string
  dueDate: string | null
  customerId: string | null
  customerName: string
  billId: string | null
  billNumber: string
  containerNumbers?: string[]
  subtotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  currency: string
  status: string
  description: string
  createTime: string
  pdfUrl?: string
  excelUrl?: string
}

interface InvoiceStats {
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
}

export default function FinanceInvoices() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState(searchParams.get('type') || '')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '')
  
  // 多选核销状态
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [showBatchPayment, setShowBatchPayment] = useState(false)
  const [batchPaymentData, setBatchPaymentData] = useState({
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    bankAccountId: '',
    description: ''
  })
  const [batchPaymentLoading, setBatchPaymentLoading] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  
  // 当 URL 参数变化时更新筛选状态
  useEffect(() => {
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
    setFilterType(type)
    setFilterStatus(status)
  }, [searchParams])
  
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
    fetchInvoices()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filterType, filterStatus, searchValue])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      // 默认排除已收款和已取消的发票，这些显示在历史记录页面
      const defaultStatus = 'draft,pending,partial,overdue'
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(filterType && { type: filterType }),
        status: filterStatus || defaultStatus, // 未选择状态时排除已收款/已取消
        ...(searchValue && { search: searchValue }),
      })
      
      const response = await fetch(`${API_BASE}/api/invoices?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setInvoices(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取发票列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/invoices/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('获取发票统计失败:', error)
    }
  }

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/bank-accounts`)
      const data = await response.json()
      if (data.errCode === 200) {
        setBankAccounts(data.data || [])
      }
    } catch (error) {
      console.error('获取银行账户失败:', error)
    }
  }

  // 获取选中发票的汇总信息
  const getSelectedInvoicesSummary = () => {
    const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id))
    const totalUnpaid = selectedInvoices.reduce((sum, inv) => 
      sum + (Number(inv.totalAmount) - Number(inv.paidAmount)), 0
    )
    const currencies = [...new Set(selectedInvoices.map(inv => inv.currency || 'EUR'))]
    return { count: selectedInvoices.length, totalUnpaid, currencies }
  }

  // 打开批量核销弹窗
  const handleOpenBatchPayment = () => {
    if (selectedInvoiceIds.length === 0) {
      alert('请先选择要核销的发票')
      return
    }
    
    // 检查选中的发票是否都是同一类型
    const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id))
    const types = [...new Set(selectedInvoices.map(inv => inv.invoiceType))]
    if (types.length > 1) {
      alert('请选择同一类型的发票进行批量核销（销售发票或采购发票）')
      return
    }
    
    // 检查是否有已收款/已付款的发票
    const hasPaidInvoice = selectedInvoices.some(inv => inv.status === 'paid')
    if (hasPaidInvoice) {
      alert('选中的发票中包含已收款/已付款的发票，请取消选择后重试')
      return
    }
    
    fetchBankAccounts()
    setShowBatchPayment(true)
    const invoiceType = types[0]
    setBatchPaymentData({
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      bankAccountId: '',
      description: `批量${invoiceType === 'sales' ? '收款' : '付款'} - ${selectedInvoiceIds.length} 张发票`
    })
  }

  // 提交批量核销
  const handleBatchPaymentSubmit = async () => {
    if (selectedInvoiceIds.length === 0) return
    
    if (batchPaymentData.paymentMethod === 'bank_transfer' && !batchPaymentData.bankAccountId) {
      alert('请选择银行账户')
      return
    }
    
    setBatchPaymentLoading(true)
    try {
      const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id))
      const selectedBank = bankAccounts.find(a => String(a.id) === batchPaymentData.bankAccountId)
      
      // 计算合并后的总金额
      const totalAmount = selectedInvoices.reduce((sum, inv) => {
        return sum + (Number(inv.totalAmount) - Number(inv.paidAmount))
      }, 0)
      
      // 获取第一张发票的基础信息
      const firstInvoice = selectedInvoices[0]
      
      // 收集所有发票ID和发票号
      const invoiceIds = selectedInvoices.map(inv => inv.id)
      const invoiceNumbers = selectedInvoices.map(inv => inv.invoiceNumber)
      
      // 创建一条合并的收款记录
      const paymentData = {
        paymentType: firstInvoice.invoiceType === 'sales' ? 'income' : 'expense',
        // 主发票ID（用于兼容旧数据）
        invoiceId: firstInvoice.id,
        invoiceNumber: invoiceNumbers.join(', '),
        // 多发票支持
        invoiceIds: invoiceIds,
        customerName: firstInvoice.customerName,
        customerId: firstInvoice.customerId,
        amount: totalAmount,
        currency: firstInvoice.currency || 'EUR',
        paymentMethod: batchPaymentData.paymentMethod,
        paymentDate: batchPaymentData.paymentDate,
        referenceNumber: batchPaymentData.referenceNumber,
        bankAccount: selectedBank ? `${selectedBank.accountName} (${selectedBank.bankName})` : '',
        description: batchPaymentData.description || `批量核销 ${selectedInvoices.length} 张发票`,
        status: 'completed'
      }
      
      const response = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(paymentData)
      })
      
      const data = await response.json()
      if (data.errCode !== 200) {
        throw new Error(`批量核销失败: ${data.msg}`)
      }
      
      alert(`成功核销 ${selectedInvoiceIds.length} 张发票，合计金额: ${totalAmount.toLocaleString('de-DE', { style: 'currency', currency: firstInvoice.currency || 'EUR' })}`)
      setShowBatchPayment(false)
      setSelectedInvoiceIds([])
      fetchInvoices()
      fetchStats()
    } catch (error: any) {
      console.error('批量核销失败:', error)
      alert(error.message || '批量核销失败')
    } finally {
      setBatchPaymentLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这张发票吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/invoices/${id}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.errCode === 200) {
        fetchInvoices()
        fetchStats()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除发票失败:', error)
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

  const getStatusConfig = (status: string, invoiceType?: string) => {
    // 根据发票类型区分：销售发票用"收款"，采购发票用"付款"
    const isSales = invoiceType === 'sales'
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
      draft: { label: '草稿', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
      pending: { label: isSales ? '待收款' : '待付款', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock },
      partial: { label: isSales ? '部分收款' : '部分付款', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
      paid: { label: isSales ? '已收款' : '已付款', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      overdue: { label: '已逾期', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
      cancelled: { label: '已取消', color: 'text-gray-400', bg: 'bg-gray-50', icon: XCircle },
    }
    return configs[status] || configs.pending
  }

  const columns: Column<Invoice>[] = useMemo(() => [
    {
      key: 'invoiceNumber',
      label: '发票号',
      width: 160,
      sorter: true,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.invoiceNumber}</div>
          <div className="text-xs text-gray-400">{formatDate(record.invoiceDate)}</div>
        </div>
      )
    },
    {
      key: 'invoiceType',
      label: '类型',
      width: 80,
      sorter: true,
      filters: [
        { text: '销售发票', value: 'sales' },
        { text: '采购发票', value: 'purchase' },
      ],
      onFilter: (value, record) => record.invoiceType === value,
      render: (_value, record) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          record.invoiceType === 'sales' 
            ? 'bg-blue-100 text-blue-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {record.invoiceType === 'sales' ? '销售发票' : '采购发票'}
        </span>
      )
    },
    {
      key: 'customerName',
      label: '客户/供应商',
      width: 140,
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <div className="text-sm text-gray-900 truncate" title={record.customerName || '-'}>
          {record.customerName || '-'}
        </div>
      )
    },
    {
      key: 'containerNumbers',
      label: '集装箱号/提单号',
      width: 280,
      render: (_value, record) => (
        <div className="max-w-[260px]">
          {record.containerNumbers && record.containerNumbers.length > 0 ? (
            <div className="text-xs text-gray-900 truncate" title={record.containerNumbers.join(', ')}>
              {record.containerNumbers.join(', ')}
            </div>
          ) : record.billNumber ? (
            <div className="text-xs text-gray-500 truncate" title={record.billNumber}>
              {record.billNumber}
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      key: 'totalAmount',
      label: '金额',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (_value, record) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">{formatCurrency(record.totalAmount, record.currency)}</div>
          {record.taxAmount > 0 && (
            <div className="text-xs text-gray-400">含税 {formatCurrency(record.taxAmount, record.currency)}</div>
          )}
        </div>
      )
    },
    {
      key: 'paidAmount',
      label: '已付金额',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.paidAmount - b.paidAmount,
      render: (_value, record) => (
        <div className="text-right">
          <div className={`font-medium ${record.paidAmount >= record.totalAmount ? 'text-green-600' : 'text-gray-900'}`}>
            {formatCurrency(record.paidAmount, record.currency)}
          </div>
          {record.paidAmount < record.totalAmount && (
            <div className="text-xs text-red-500">
              未付 {formatCurrency(record.totalAmount - record.paidAmount, record.currency)}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 100,
      sorter: true,
      filters: [
        { text: '草稿', value: 'draft' },
        { text: filterType === 'sales' ? '待收款' : filterType === 'purchase' ? '待付款' : '待收/付款', value: 'pending' },
        { text: filterType === 'sales' ? '部分收款' : filterType === 'purchase' ? '部分付款' : '部分收/付款', value: 'partial' },
        { text: '已逾期', value: 'overdue' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (_value, record) => {
        const config = getStatusConfig(record.status, record.invoiceType)
        const Icon = config.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        )
      }
    },
    {
      key: 'dueDate',
      label: '到期日',
      width: 130,
      sorter: (a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0
        return dateA - dateB
      },
      render: (_value, record) => {
        if (!record.dueDate) return <span className="text-gray-400">-</span>
        const isOverdue = new Date(record.dueDate) < new Date() && record.status !== 'paid'
        return (
          <span className={isOverdue ? 'text-red-500' : 'text-gray-600'}>
            {formatDate(record.dueDate)}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      width: 160,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/finance/invoices/${record.id}`)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="查看"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {record.pdfUrl && (
            <button
              onClick={() => window.open(`${API_BASE}/api/invoices/${record.id}/pdf`, '_blank')}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="下载PDF发票"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {record.excelUrl && (
            <button
              onClick={() => window.open(`${API_BASE}/api/invoices/${record.id}/excel`, '_blank')}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title="下载Excel对账单"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
          )}
          {record.status !== 'paid' && record.status !== 'cancelled' && (
            <button
              onClick={() => navigate(`/finance/invoices/${record.id}/payment`)}
              className={`p-1.5 text-gray-400 rounded transition-colors ${
                record.invoiceType === 'sales' 
                  ? 'hover:text-amber-600 hover:bg-amber-50' 
                  : 'hover:text-orange-600 hover:bg-orange-50'
              }`}
              title={record.invoiceType === 'sales' ? '登记收款' : '登记付款'}
            >
              <CreditCard className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => navigate(`/finance/invoices/${record.id}/edit`)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="编辑"
            disabled={record.status === 'paid'}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(record.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="删除"
            disabled={record.paidAmount > 0}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, filterType])

  return (
    <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/invoices"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 - 响应式网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
        {/* 销售发票统计 */}
        <div className="bg-blue-50 rounded-lg p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2 lg:mb-3">
            <span className="text-xs lg:text-sm font-medium text-blue-700">销售发票（应收）</span>
            <span className="text-xs text-blue-600">{(stats?.sales?.pendingCount || 0) + (stats?.sales?.overdueCount || 0)} 张</span>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            <div>
              <div className="text-xs text-gray-500">总金额</div>
              <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">{formatCurrency(stats?.sales?.totalAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">已收款</div>
              <div className="text-xs lg:text-sm font-medium text-green-600 truncate">{formatCurrency(stats?.sales?.paidAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">未收款</div>
              <div className="text-xs lg:text-sm font-medium text-red-600 truncate">{formatCurrency(stats?.sales?.unpaidAmount || 0)}</div>
            </div>
          </div>
        </div>

        {/* 采购发票统计 */}
        <div className="bg-orange-50 rounded-lg p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2 lg:mb-3">
            <span className="text-xs lg:text-sm font-medium text-orange-700">采购发票（应付）</span>
            <span className="text-xs text-orange-600">{(stats?.purchase?.pendingCount || 0) + (stats?.purchase?.overdueCount || 0)} 张</span>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            <div>
              <div className="text-xs text-gray-500">总金额</div>
              <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">{formatCurrency(stats?.purchase?.totalAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">已付款</div>
              <div className="text-xs lg:text-sm font-medium text-green-600 truncate">{formatCurrency(stats?.purchase?.paidAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">未付款</div>
              <div className="text-xs lg:text-sm font-medium text-red-600 truncate">{formatCurrency(stats?.purchase?.unpaidAmount || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 - 响应式布局 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between bg-white rounded-lg border border-gray-200 p-2 lg:p-3 gap-2 lg:gap-3">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-[180px] lg:min-w-[200px] lg:flex-none lg:w-auto">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索发票号、客户名..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value)
              setSearchParams(e.target.value ? { type: e.target.value } : {})
            }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="筛选发票类型"
          >
            <option value="">全部类型</option>
            <option value="sales">销售发票</option>
            <option value="purchase">采购发票</option>
          </select>

          {/* 状态筛选 - 已收款的发票在历史记录页面查看 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="筛选发票状态"
          >
            <option value="">待处理</option>
            <option value="draft">草稿</option>
            <option value="pending">{filterType === 'sales' ? '待收款' : filterType === 'purchase' ? '待付款' : '待收/付款'}</option>
            <option value="partial">{filterType === 'sales' ? '部分收款' : filterType === 'purchase' ? '部分付款' : '部分收/付款'}</option>
            <option value="overdue">已逾期</option>
          </select>
          
          {/* 批量登记收款/付款按钮 */}
          <button
            onClick={handleOpenBatchPayment}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              selectedInvoiceIds.length > 0 
                ? filterType === 'purchase'
                  ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                  : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' 
                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
            disabled={selectedInvoiceIds.length === 0}
          >
            <CreditCard className="w-4 h-4" />
            {filterType === 'purchase' ? '批量登记付款' : filterType === 'sales' ? '批量登记收款' : '批量登记收款'}
            {selectedInvoiceIds.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                filterType === 'purchase' ? 'bg-orange-200 text-orange-800' : 'bg-amber-200 text-amber-800'
              }`}>
                {selectedInvoiceIds.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 导出按钮 */}
          <button
            onClick={() => {
              // 构建导出参数
              const defaultStatus = 'draft,pending,partial,overdue'
              const params = new URLSearchParams({
                ...(filterType && { type: filterType }),
                status: filterStatus || defaultStatus,
                ...(searchValue && { search: searchValue }),
                export: 'true'
              })
              window.open(`${API_BASE}/api/invoices/export?${params}`, '_blank')
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-orange-600 text-xs font-medium rounded-lg border border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>

          <button
            onClick={() => navigate('/finance/invoices/create')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建发票
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          rowKey="id"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedInvoiceIds,
            onChange: (selectedRowKeys) => {
              setSelectedInvoiceIds(selectedRowKeys)
            }
          }}
        />
      </div>
      
      {/* 选中发票汇总信息 */}
      {selectedInvoiceIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-4 z-50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">已选择</span>
            <span className="text-sm font-medium text-primary-600">{getSelectedInvoicesSummary().count}</span>
            <span className="text-sm text-gray-600">张发票</span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">待核销金额</span>
            <span className="text-sm font-medium text-amber-600">
              {formatCurrency(getSelectedInvoicesSummary().totalUnpaid)}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <button
            onClick={() => setSelectedInvoiceIds([])}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            取消选择
          </button>
          <button
            onClick={handleOpenBatchPayment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            批量核销
          </button>
        </div>
      )}

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

      {/* 批量核销弹窗 */}
      {showBatchPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                批量{invoices.find(inv => selectedInvoiceIds.includes(inv.id))?.invoiceType === 'sales' ? '收款' : '付款'}核销
              </h3>
              <button
                onClick={() => setShowBatchPayment(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* 选中发票列表 */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
              <div className="text-xs text-gray-500 mb-2">选中的发票 ({selectedInvoiceIds.length})</div>
              <div className="space-y-2">
                {invoices.filter(inv => selectedInvoiceIds.includes(inv.id)).map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                      <span className="text-gray-500 ml-2">{invoice.customerName}</span>
                    </div>
                    <span className="text-amber-600 font-medium">
                      {formatCurrency(Number(invoice.totalAmount) - Number(invoice.paidAmount), invoice.currency)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">合计待核销金额</span>
                <span className="text-base font-semibold text-amber-600">
                  {formatCurrency(getSelectedInvoicesSummary().totalUnpaid)}
                </span>
              </div>
            </div>
            
            {/* 核销表单 */}
            <div className="px-6 py-4 space-y-4">
              {/* 收款方式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {invoices.find(inv => selectedInvoiceIds.includes(inv.id))?.invoiceType === 'sales' ? '收款' : '付款'}方式
                </label>
                <select
                  value={batchPaymentData.paymentMethod}
                  onChange={(e) => setBatchPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="bank_transfer">银行转账</option>
                  <option value="cash">现金</option>
                  <option value="check">支票</option>
                  <option value="credit_card">信用卡</option>
                  <option value="wechat">微信支付</option>
                  <option value="alipay">支付宝</option>
                  <option value="other">其他</option>
                </select>
              </div>
              
              {/* 银行账户（银行转账时显示） */}
              {batchPaymentData.paymentMethod === 'bank_transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    银行账户 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={batchPaymentData.bankAccountId}
                    onChange={(e) => setBatchPaymentData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">请选择银行账户</option>
                    {bankAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.accountName} ({account.bankName}) - {account.currency}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* 收款日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {invoices.find(inv => selectedInvoiceIds.includes(inv.id))?.invoiceType === 'sales' ? '收款' : '付款'}日期
                </label>
                <DateTimePicker
                  value={batchPaymentData.paymentDate}
                  onChange={(value) => setBatchPaymentData(prev => ({ ...prev, paymentDate: value }))}
                  showTime={false}
                  placeholder="选择日期"
                />
              </div>
              
              {/* 参考号/交易号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">参考号/交易号</label>
                <input
                  type="text"
                  value={batchPaymentData.referenceNumber}
                  onChange={(e) => setBatchPaymentData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                  placeholder="银行流水号、交易单号等"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={batchPaymentData.description}
                  onChange={(e) => setBatchPaymentData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            
            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowBatchPayment(false)}
                disabled={batchPaymentLoading}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchPaymentSubmit}
                disabled={batchPaymentLoading || (batchPaymentData.paymentMethod === 'bank_transfer' && !batchPaymentData.bankAccountId)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchPaymentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    核销中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    确认核销 ({selectedInvoiceIds.length} 张)
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

