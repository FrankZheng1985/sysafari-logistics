import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  CheckCircle, X, Clock, Eye, AlertTriangle, RefreshCw,
  Package, DollarSign, ChevronDown, ChevronRight, User
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'
import { formatDate, formatDateTime } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface PendingFee {
  id: string
  feeNumber: string
  billId: string
  billNumber: string
  orderNumber?: string
  containerNumber?: string
  customerId: string
  customerName: string
  feeName: string
  feeType: 'receivable' | 'payable'
  category: string
  amount: number
  currency: string
  feeDate: string
  description?: string
  notes?: string
  isSupplementary: boolean
  approvalStatus: string
  approvalSubmittedAt: string
  approvalSubmittedBy: string
  approvalSubmittedByName: string
  createTime: string
}

interface PendingFeeData {
  list: PendingFee[]
  total: number
  page: number
  pageSize: number
}

export default function FinanceFeeApproval() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PendingFeeData | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [approving, setApproving] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingFeeId, setRejectingFeeId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '历史记录', path: '/finance/invoices/history' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '费用审批', path: '/finance/fee-approval' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

  useEffect(() => {
    fetchPendingFees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search])

  const fetchPendingFees = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (search) {
        params.append('search', search)
      }
      
      const response = await fetch(`${API_BASE}/api/fees/pending-approval?${params}`)
      const result = await response.json()
      
      if (result.errCode === 200) {
        setData(result.data)
      }
    } catch (error) {
      console.error('获取待审批费用列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (feeId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/fees/${feeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const result = await response.json()
      
      if (result.errCode === 200) {
        alert('审批通过')
        fetchPendingFees()
        setSelectedIds(prev => prev.filter(id => id !== feeId))
      } else {
        alert(`操作失败: ${result.msg || '未知错误'}`)
      }
    } catch (error) {
      console.error('审批失败:', error)
      alert('操作失败，请稍后重试')
    }
  }

  const handleReject = async () => {
    if (!rejectingFeeId || !rejectReason.trim()) {
      alert('请填写拒绝原因')
      return
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/fees/${rejectingFeeId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      })
      
      const result = await response.json()
      
      if (result.errCode === 200) {
        alert('已拒绝')
        setShowRejectModal(false)
        setRejectingFeeId(null)
        setRejectReason('')
        fetchPendingFees()
        setSelectedIds(prev => prev.filter(id => id !== rejectingFeeId))
      } else {
        alert(`操作失败: ${result.msg || '未知错误'}`)
      }
    } catch (error) {
      console.error('拒绝失败:', error)
      alert('操作失败，请稍后重试')
    }
  }

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) {
      alert('请选择要审批的费用')
      return
    }
    
    if (!confirm(`确定要批量审批通过 ${selectedIds.length} 条费用吗？`)) {
      return
    }
    
    setApproving(true)
    try {
      const response = await fetch(`${API_BASE}/api/fees/batch-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      
      const result = await response.json()
      
      if (result.errCode === 200) {
        alert(result.msg || '批量审批完成')
        setSelectedIds([])
        fetchPendingFees()
      } else {
        alert(`操作失败: ${result.msg || '未知错误'}`)
      }
    } catch (error) {
      console.error('批量审批失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setApproving(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }


  const columns: Column<PendingFee>[] = useMemo(() => [
    {
      key: 'checkbox',
      label: '',
      width: 40,
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(prev => [...prev, record.id])
            } else {
              setSelectedIds(prev => prev.filter(id => id !== record.id))
            }
          }}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      )
    },
    {
      key: 'orderInfo',
      label: '订单信息',
      width: 180,
      render: (_, record) => (
        <div>
          <div className="text-xs font-medium text-gray-900">
            {record.orderNumber || record.billNumber || '-'}
          </div>
          {record.containerNumber && (
            <div className="text-[10px] text-gray-500">{record.containerNumber}</div>
          )}
          <div className="text-[10px] text-gray-400">{record.customerName}</div>
        </div>
      )
    },
    {
      key: 'feeName',
      label: '费用名称',
      width: 150,
      render: (_, record) => (
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium ${
            record.feeType === 'payable' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {record.feeType === 'payable' ? '付' : '收'}
          </span>
          <span className="text-xs text-gray-900">{record.feeName}</span>
        </div>
      )
    },
    {
      key: 'amount',
      label: '金额',
      width: 120,
      render: (_, record) => (
        <span className={`text-xs font-medium ${
          record.feeType === 'payable' ? 'text-orange-600' : 'text-blue-600'
        }`}>
          {formatCurrency(record.amount, record.currency)}
        </span>
      )
    },
    {
      key: 'feeDate',
      label: '费用日期',
      width: 100,
      render: (_, record) => (
        <span className="text-xs text-gray-600">{formatDate(record.feeDate)}</span>
      )
    },
    {
      key: 'submitter',
      label: '提交人',
      width: 120,
      render: (_, record) => (
        <div>
          <div className="text-xs text-gray-900">{record.approvalSubmittedByName || '-'}</div>
          <div className="text-[10px] text-gray-400">{formatDateTime(record.approvalSubmittedAt)}</div>
        </div>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 150,
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/finance/bill-details/${record.billId}?source=finance`)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="查看订单"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleApprove(record.id)}
            className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
          >
            通过
          </button>
          <button
            onClick={() => {
              setRejectingFeeId(record.id)
              setShowRejectModal(true)
            }}
            className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
          >
            拒绝
          </button>
        </div>
      )
    }
  ], [selectedIds, navigate])

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="追加费用审批"
        description="审批待确认的追加费用"
        tabs={tabs}
        activeTab="/finance/fee-approval"
        onTabChange={(path) => navigate(path)}
      />

      {/* 筛选和操作栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-gray-600">
                待审批：<span className="font-medium text-amber-600">{data?.total || 0}</span> 条
              </span>
            </div>
            <input
              type="text"
              placeholder="搜索订单号、客户名称、费用名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchApprove}
                disabled={approving}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              >
                {approving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                批量通过 ({selectedIds.length})
              </button>
            )}
            <button
              onClick={fetchPendingFees}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={data?.list || []}
          loading={loading}
          emptyText="暂无待审批的追加费用"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: data?.total || 0,
            onChange: (p, ps) => {
              setPage(p)
              if (ps) setPageSize(ps)
            }
          }}
        />
      </div>

      {/* 拒绝原因弹窗 */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/30" 
            onClick={() => {
              setShowRejectModal(false)
              setRejectingFeeId(null)
              setRejectReason('')
            }} 
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">拒绝原因</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectingFeeId(null)
                  setRejectReason('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请输入拒绝原因..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectingFeeId(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

