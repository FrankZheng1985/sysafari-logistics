import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Search, Plus, FileText, Edit2, Trash2, Eye,
  CheckCircle, Clock, AlertTriangle, XCircle,
  Download, FileSpreadsheet, CreditCard
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

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
      width: 150,
      sorter: true,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900">{record.invoiceNumber}</div>
          <div className="text-xs text-gray-400">{record.invoiceDate}</div>
        </div>
      )
    },
    {
      key: 'invoiceType',
      label: '类型',
      width: 100,
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
      width: 150,
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <div>
          <div className="text-sm text-gray-900">{record.customerName || '-'}</div>
          {record.containerNumbers && record.containerNumbers.length > 0 && (
            <div className="text-xs text-gray-400">柜号: {record.containerNumbers.join(', ')}</div>
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
      width: 100,
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
            {record.dueDate}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      width: 180,
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
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
              title="登记收款"
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
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/invoices"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 销售发票统计 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-blue-700">销售发票（应收）</span>
            <span className="text-xs text-blue-600">{(stats?.sales?.pendingCount || 0) + (stats?.sales?.overdueCount || 0)} 张</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">总金额</div>
              <div className="text-sm font-medium text-gray-900">{formatCurrency(stats?.sales?.totalAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">已收款</div>
              <div className="text-sm font-medium text-green-600">{formatCurrency(stats?.sales?.paidAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">未收款</div>
              <div className="text-sm font-medium text-red-600">{formatCurrency(stats?.sales?.unpaidAmount || 0)}</div>
            </div>
          </div>
        </div>

        {/* 采购发票统计 */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-orange-700">采购发票（应付）</span>
            <span className="text-xs text-orange-600">{(stats?.purchase?.pendingCount || 0) + (stats?.purchase?.overdueCount || 0)} 张</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">总金额</div>
              <div className="text-sm font-medium text-gray-900">{formatCurrency(stats?.purchase?.totalAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">已付款</div>
              <div className="text-sm font-medium text-green-600">{formatCurrency(stats?.purchase?.paidAmount || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">未付款</div>
              <div className="text-sm font-medium text-red-600">{formatCurrency(stats?.purchase?.unpaidAmount || 0)}</div>
            </div>
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
              placeholder="搜索发票号、客户名..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadInvoices()}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
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
        </div>

        <button
          onClick={() => navigate('/finance/invoices/create')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建发票
        </button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          rowKey="id"
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
    </div>
  )
}

