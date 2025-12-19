import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, FileText, Eye, History,
  CheckCircle, XCircle, Download, FileSpreadsheet
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
  subtotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  currency: string
  status: string
  description: string
  createTime: string
  updateTime?: string
  pdfUrl?: string
  excelUrl?: string
}

interface HistoryStats {
  totalCount: number
  paidCount: number
  cancelledCount: number
  totalPaidAmount: number
}

export default function FinanceInvoiceHistory() {
  const navigate = useNavigate()
  
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<HistoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

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
  }, [page, filterType, filterStatus, searchValue])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      // 只查询已完成的发票（已付款和已取消）
      const statusFilter = filterStatus || 'paid,cancelled'
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        status: statusFilter,
        ...(filterType && { type: filterType }),
        ...(searchValue && { search: searchValue }),
      })
      
      const response = await fetch(`${API_BASE}/api/invoices?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setInvoices(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取历史发票列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/invoices/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        const salesStats = data.data?.sales || {}
        const purchaseStats = data.data?.purchase || {}
        setStats({
          totalCount: (salesStats.paidCount || 0) + (purchaseStats.paidCount || 0),
          paidCount: (salesStats.paidCount || 0) + (purchaseStats.paidCount || 0),
          cancelledCount: 0, // 后端可以扩展返回此数据
          totalPaidAmount: (salesStats.paidAmount || 0) + (purchaseStats.paidAmount || 0),
        })
      }
    } catch (error) {
      console.error('获取发票统计失败:', error)
    }
  }

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
      paid: { label: '已付款', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      cancelled: { label: '已取消', color: 'text-gray-400', bg: 'bg-gray-100', icon: XCircle },
    }
    return configs[status] || { label: status, color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText }
  }

  const formatDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const columns: Column<Invoice>[] = useMemo(() => [
    {
      key: 'invoiceNumber',
      label: '发票号',
      width: 150,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.invoiceNumber}</div>
          <div className="text-xs text-gray-400">{item.invoiceDate}</div>
        </div>
      )
    },
    {
      key: 'invoiceType',
      label: '类型',
      width: 100,
      render: (item) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          item.invoiceType === 'sales' 
            ? 'bg-blue-100 text-blue-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {item.invoiceType === 'sales' ? '销售发票' : '采购发票'}
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
          {item.billNumber && (
            <div className="text-xs text-gray-400">提单: {item.billNumber}</div>
          )}
        </div>
      )
    },
    {
      key: 'totalAmount',
      label: '金额',
      width: 120,
      align: 'right',
      render: (item) => (
        <div className="text-right">
          <div className="font-medium text-gray-900">{formatCurrency(item.totalAmount, item.currency)}</div>
          {item.taxAmount > 0 && (
            <div className="text-xs text-gray-400">含税 {formatCurrency(item.taxAmount, item.currency)}</div>
          )}
        </div>
      )
    },
    {
      key: 'paidAmount',
      label: '已付金额',
      width: 120,
      align: 'right',
      render: (item) => (
        <div className="text-right">
          <div className="font-medium text-green-600">
            {formatCurrency(item.paidAmount, item.currency)}
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 100,
      render: (item) => {
        const config = getStatusConfig(item.status)
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
      key: 'updateTime',
      label: '完成时间',
      width: 140,
      render: (item) => (
        <span className="text-xs text-gray-500">
          {formatDateTime(item.updateTime || item.createTime)}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 120,
      render: (item) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/finance/invoices/${item.id}`)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="查看"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {item.pdfUrl && (
            <button
              onClick={() => window.open(`${API_BASE}/api/invoices/${item.id}/pdf`, '_blank')}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="下载PDF发票"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {item.excelUrl && (
            <button
              onClick={() => window.open(`${API_BASE}/api/invoices/${item.id}/excel`, '_blank')}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title="下载Excel对账单"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ], [navigate])

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/invoices/history"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-gray-700">历史发票统计</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">已完成发票</div>
            <div className="text-lg font-semibold text-gray-900">{stats?.totalCount || 0} 张</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">已付款发票</div>
            <div className="text-lg font-semibold text-green-600">{stats?.paidCount || 0} 张</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">已取消发票</div>
            <div className="text-lg font-semibold text-gray-400">{stats?.cancelledCount || 0} 张</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">累计收款金额</div>
            <div className="text-lg font-semibold text-primary-600">{formatCurrency(stats?.totalPaidAmount || 0)}</div>
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
            <option value="sales">销售发票</option>
            <option value="purchase">采购发票</option>
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            <option value="paid">已付款</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
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
    </div>
  )
}
