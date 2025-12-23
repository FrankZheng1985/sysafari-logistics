import { 
  CheckCircle, XCircle, Clock, FileText, User, Shield,
  Loader2, Search, RefreshCw, Eye, Check, X, AlertCircle,
  ChevronDown, Calendar, Filter
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../contexts/AuthContext'

// API 基础地址
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

// 类型定义
interface ApprovalRequest {
  id: number
  requestNo: string
  requestType: string
  requestTitle: string
  requestData: any
  targetUserId?: number
  targetUserName?: string
  requesterId: number
  requesterName: string
  requesterRole: string
  requesterDepartment?: string
  approverId?: number
  approverName?: string
  approverRole?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  approvalComment?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
}

interface ApprovalHistory {
  id: number
  requestId: number
  action: string
  actionName: string
  operatorId: number
  operatorName: string
  operatorRole: string
  comment?: string
  oldStatus?: string
  newStatus?: string
  createdAt: string
}

type TabType = 'pending' | 'my' | 'all'

// 请求类型映射
const REQUEST_TYPE_MAP: Record<string, { label: string, icon: any, color: string }> = {
  user_create: { label: '创建用户', icon: User, color: 'bg-blue-100 text-blue-700' },
  user_update: { label: '修改用户', icon: User, color: 'bg-blue-100 text-blue-700' },
  user_delete: { label: '删除用户', icon: User, color: 'bg-red-100 text-red-700' },
  role_change: { label: '变更角色', icon: Shield, color: 'bg-purple-100 text-purple-700' },
  permission_grant: { label: '授予权限', icon: Shield, color: 'bg-green-100 text-green-700' },
  permission_revoke: { label: '撤销权限', icon: Shield, color: 'bg-orange-100 text-orange-700' },
  finance_operation: { label: '财务操作', icon: FileText, color: 'bg-yellow-100 text-yellow-700' },
  data_export: { label: '数据导出', icon: FileText, color: 'bg-gray-100 text-gray-700' },
  system_config: { label: '系统配置', icon: Shield, color: 'bg-red-100 text-red-700' },
  other: { label: '其他', icon: FileText, color: 'bg-gray-100 text-gray-700' }
}

// 状态映射
const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  pending: { label: '待审批', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: '已通过', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700', icon: X },
  expired: { label: '已过期', color: 'bg-gray-100 text-gray-500', icon: Clock }
}

// 优先级映射
const PRIORITY_MAP: Record<string, { label: string, color: string }> = {
  low: { label: '低', color: 'text-gray-500' },
  normal: { label: '普通', color: 'text-blue-500' },
  high: { label: '高', color: 'text-orange-500' },
  urgent: { label: '紧急', color: 'text-red-500 font-bold' }
}

export default function ApprovalCenter() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [pendingCount, setPendingCount] = useState(0)
  
  // 筛选
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [searchText, setSearchText] = useState('')
  
  // 详情弹窗
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [requestHistory, setRequestHistory] = useState<ApprovalHistory[]>([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  
  // 审批操作
  const [approving, setApproving] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  // 检查用户是否有审批权限
  const canApprove = user?.role === 'admin' || user?.role === 'boss' || (user as any)?.canApprove

  // 加载数据
  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      let url = `${API_BASE_URL}/api/approvals`
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize)
      })
      
      if (activeTab === 'pending') {
        url = `${API_BASE_URL}/api/approvals/pending`
      } else if (activeTab === 'my') {
        url = `${API_BASE_URL}/api/approvals/my`
      }
      
      if (filterStatus) params.append('status', filterStatus)
      if (filterType) params.append('requestType', filterType)
      if (searchText) params.append('search', searchText)
      
      const response = await fetch(`${url}?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        setRequests(data.data.list || data.data)
        setPagination(prev => ({ ...prev, total: data.data.total || data.data.length }))
      }
    } catch (error) {
      console.error('加载审批列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, pagination.page, pagination.pageSize, filterStatus, filterType, searchText])

  // 加载待审批数量
  const loadPendingCount = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/approvals/pending/count`)
      const data = await response.json()
      if (data.errCode === 200) {
        setPendingCount(data.data.count)
      }
    } catch (error) {
      console.error('加载待审批数量失败:', error)
    }
  }, [])

  // 加载审批历史
  const loadRequestHistory = async (requestId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/approvals/${requestId}`)
      const data = await response.json()
      if (data.errCode === 200) {
        setRequestHistory(data.data.history || [])
      }
    } catch (error) {
      console.error('加载审批历史失败:', error)
    }
  }

  useEffect(() => {
    loadRequests()
    loadPendingCount()
  }, [loadRequests, loadPendingCount])

  // 查看详情
  const handleViewDetail = async (request: ApprovalRequest) => {
    setSelectedRequest(request)
    await loadRequestHistory(request.id)
    setShowDetailModal(true)
  }

  // 审批通过
  const handleApprove = async () => {
    if (!selectedRequest) return
    
    setApproving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/approvals/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: approvalComment })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert('审批通过')
        setShowApproveModal(false)
        setShowDetailModal(false)
        setApprovalComment('')
        loadRequests()
        loadPendingCount()
      } else {
        alert(data.msg || '审批失败')
      }
    } catch (error) {
      console.error('审批通过失败:', error)
      alert('审批失败')
    } finally {
      setApproving(false)
    }
  }

  // 审批拒绝
  const handleReject = async () => {
    if (!selectedRequest) return
    if (!rejectionReason.trim()) {
      alert('请填写拒绝原因')
      return
    }
    
    setApproving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/approvals/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert('已拒绝该请求')
        setShowRejectModal(false)
        setShowDetailModal(false)
        setRejectionReason('')
        loadRequests()
        loadPendingCount()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('审批拒绝失败:', error)
      alert('操作失败')
    } finally {
      setApproving(false)
    }
  }

  // 取消请求
  const handleCancel = async (request: ApprovalRequest) => {
    if (!confirm('确定要取消该审批请求吗？')) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/approvals/${request.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '用户主动取消' })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert('已取消该请求')
        loadRequests()
      } else {
        alert(data.msg || '取消失败')
      }
    } catch (error) {
      console.error('取消请求失败:', error)
      alert('取消失败')
    }
  }

  // 表格列定义
  const columns = [
    {
      key: 'requestNo',
      label: '审批单号',
      sorter: true,
      render: (_value: unknown, record: ApprovalRequest) => (
        <span className="font-mono text-xs text-primary-600 cursor-pointer hover:underline" 
              onClick={() => handleViewDetail(record)}>
          {record.requestNo}
        </span>
      )
    },
    {
      key: 'requestType',
      label: '类型',
      sorter: true,
      render: (_value: unknown, record: ApprovalRequest) => {
        const typeInfo = REQUEST_TYPE_MAP[record.requestType] || REQUEST_TYPE_MAP.other
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        )
      }
    },
    {
      key: 'requestTitle',
      label: '标题',
      sorter: true,
      render: (_value: unknown, record: ApprovalRequest) => (
        <div className="max-w-[200px] truncate" title={record.requestTitle}>
          {record.requestTitle}
        </div>
      )
    },
    {
      key: 'requesterName',
      label: '申请人',
      sorter: true,
      render: (_value: unknown, record: ApprovalRequest) => (
        <div className="text-xs">
          <div>{record.requesterName}</div>
          <div className="text-gray-400">{record.requesterDepartment || '-'}</div>
        </div>
      )
    },
    {
      key: 'priority',
      label: '优先级',
      sorter: (a: ApprovalRequest, b: ApprovalRequest) => {
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
        return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0)
      },
      render: (_value: unknown, record: ApprovalRequest) => {
        const priorityInfo = PRIORITY_MAP[record.priority] || PRIORITY_MAP.normal
        return (
          <span className={`text-xs ${priorityInfo.color}`}>
            {priorityInfo.label}
          </span>
        )
      }
    },
    {
      key: 'status',
      label: '状态',
      sorter: true,
      render: (_value: unknown, record: ApprovalRequest) => {
        const statusInfo = STATUS_MAP[record.status] || STATUS_MAP.pending
        const StatusIcon = statusInfo.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusInfo.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusInfo.label}
          </span>
        )
      }
    },
    {
      key: 'createdAt',
      label: '申请时间',
      sorter: (a: ApprovalRequest, b: ApprovalRequest) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      },
      render: (_value: unknown, record: ApprovalRequest) => (
        <span className="text-xs text-gray-600">
          {new Date(record.createdAt).toLocaleString('zh-CN')}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value: unknown, record: ApprovalRequest) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewDetail(record)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="查看详情"
          >
            <Eye className="w-4 h-4" />
          </button>
          {record.status === 'pending' && canApprove && (
            <>
              <button
                onClick={() => {
                  setSelectedRequest(record)
                  setShowApproveModal(true)
                }}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="通过"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSelectedRequest(record)
                  setShowRejectModal(true)
                }}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="拒绝"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {record.status === 'pending' && String(record.requesterId) === String(user?.id) && (
            <button
              onClick={() => handleCancel(record)}
              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
              title="取消"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  // Tab 配置
  const tabs = [
    { key: 'pending', label: '待审批', count: pendingCount },
    { key: 'my', label: '我的申请', count: 0 },
    { key: 'all', label: '全部', count: 0 }
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="审批工作台"
        icon={<CheckCircle className="w-5 h-5 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system' },
          { label: '审批工作台' }
        ]}
        actionButtons={
          <button
            onClick={() => { loadRequests(); loadPendingCount() }}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        }
      />

      {/* Tab 导航 */}
      <div className="border-b border-gray-200 px-4">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as TabType)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className={`px-4 py-2 text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索审批单号、标题..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-48 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            />
            <button
              onClick={() => loadRequests()}
              className="px-2 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
              title="搜索"
              aria-label="搜索"
            >
              <Search className="w-3 h-3" />
            </button>
          </div>
          
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            title="筛选类型"
            aria-label="筛选类型"
          >
            <option value="">全部类型</option>
            {Object.entries(REQUEST_TYPE_MAP).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
          
          {activeTab === 'all' && (
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              title="筛选状态"
              aria-label="筛选状态"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_MAP).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 列表区域 */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-600">加载中...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>暂无审批记录</p>
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={requests} compact />
            
            {/* 分页 */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">
                共 <span className="font-medium">{pagination.total}</span> 条记录
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-700">
                  第 {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                >
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                  <option value={100}>100 条/页</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">审批详情</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded" title="关闭" aria-label="关闭">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">审批单号</label>
                  <p className="font-mono text-sm">{selectedRequest.requestNo}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">状态</label>
                  <p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${STATUS_MAP[selectedRequest.status]?.color}`}>
                      {STATUS_MAP[selectedRequest.status]?.label}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">类型</label>
                  <p className="text-sm">{REQUEST_TYPE_MAP[selectedRequest.requestType]?.label}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">优先级</label>
                  <p className={`text-sm ${PRIORITY_MAP[selectedRequest.priority]?.color}`}>
                    {PRIORITY_MAP[selectedRequest.priority]?.label}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">标题</label>
                  <p className="text-sm">{selectedRequest.requestTitle}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">申请人</label>
                  <p className="text-sm">{selectedRequest.requesterName} ({selectedRequest.requesterDepartment || '-'})</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">申请时间</label>
                  <p className="text-sm">{new Date(selectedRequest.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                {selectedRequest.approverName && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500">审批人</label>
                      <p className="text-sm">{selectedRequest.approverName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">审批时间</label>
                      <p className="text-sm">
                        {selectedRequest.approvedAt ? new Date(selectedRequest.approvedAt).toLocaleString('zh-CN') : '-'}
                      </p>
                    </div>
                  </>
                )}
                {selectedRequest.approvalComment && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">审批意见</label>
                    <p className="text-sm text-green-600">{selectedRequest.approvalComment}</p>
                  </div>
                )}
                {selectedRequest.rejectionReason && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">拒绝原因</label>
                    <p className="text-sm text-red-600">{selectedRequest.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* 请求数据 */}
              {selectedRequest.requestData && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">请求数据</label>
                  <pre className="p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedRequest.requestData, null, 2)}
                  </pre>
                </div>
              )}

              {/* 审批历史 */}
              <div>
                <label className="text-xs text-gray-500 block mb-2">审批历史</label>
                <div className="space-y-2">
                  {requestHistory.map((h, idx) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{h.actionName}</span>
                          <span className="text-gray-400">by {h.operatorName}</span>
                          <span className="text-gray-400">
                            {new Date(h.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {h.comment && <p className="text-gray-600 mt-0.5">{h.comment}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            {selectedRequest.status === 'pending' && canApprove && (
              <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  拒绝
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  通过
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 通过确认弹窗 */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">确认审批通过</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要通过【{selectedRequest.requestTitle}】的审批请求吗？
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">审批意见（可选）</label>
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="请输入审批意见..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowApproveModal(false); setApprovalComment('') }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={approving}
              >
                取消
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {approving ? '处理中...' : '确认通过'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 拒绝确认弹窗 */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">确认拒绝</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要拒绝【{selectedRequest.requestTitle}】的审批请求吗？
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">
                拒绝原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="请输入拒绝原因..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason('') }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={approving}
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={approving || !rejectionReason.trim()}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {approving ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
