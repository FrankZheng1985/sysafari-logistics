/**
 * 审批工作台页面
 * 展示待审批列表，支持审批操作
 * 支持业务审批和统一审批两种数据源
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateTime } from '../utils/dateFormat'
import { getAuthHeaders } from '../utils/api'
import { 
  ClipboardCheck, 
  Check,
  X,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Wallet,
  Building2,
  Package,
  Eye,
  Filter,
  Truck,
  User,
  Trash2,
  Shield,
  Settings,
  ExternalLink,
  Calendar,
  Hash,
  MessageSquare
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { getApiBaseUrl } from '../utils/api'
import { invalidateNotificationCache } from '../utils/apiCache'

const API_BASE = getApiBaseUrl()

interface Approval {
  id: string
  approval_no?: string
  approval_type: string
  category?: string
  business_id: string
  business_table?: string
  title: string
  content: string
  amount: number
  currency?: string
  applicant_id: string
  applicant_name: string
  applicant_role?: string
  approver_id: string
  approver_name: string
  status: string
  remark: string
  reject_reason?: string
  rejection_reason?: string
  approval_comment?: string
  created_at: string
  processed_at?: string
  approved_at?: string
  rejected_at?: string
  request_data?: {
    billNumber?: string
    billId?: string
    containerNumber?: string
    fee?: {
      billId?: string
      billNumber?: string
      [key: string]: unknown
    }
  }
}

// 审批类型配置（业务审批）
const APPROVAL_TYPES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  order: { label: '订单审批', icon: Package, color: 'text-blue-600 bg-blue-100' },
  payment: { label: '付款申请', icon: Wallet, color: 'text-green-600 bg-green-100' },
  supplier: { label: '供应商审批', icon: Building2, color: 'text-purple-600 bg-purple-100' },
  fee: { label: '费用审批', icon: FileText, color: 'text-orange-600 bg-orange-100' },
  inquiry: { label: '客户询价', icon: Truck, color: 'text-teal-600 bg-teal-100' },
  void: { label: '作废审批', icon: FileText, color: 'text-red-600 bg-red-100' },
  contract: { label: '合同审批', icon: FileText, color: 'text-indigo-600 bg-indigo-100' },
  // 统一审批类型
  USER_CREATE: { label: '用户创建', icon: User, color: 'text-blue-600 bg-blue-100' },
  USER_DELETE: { label: '用户删除', icon: Trash2, color: 'text-red-600 bg-red-100' },
  ROLE_CHANGE: { label: '角色变更', icon: Shield, color: 'text-purple-600 bg-purple-100' },
  PERMISSION_CHANGE: { label: '权限变更', icon: Settings, color: 'text-amber-600 bg-amber-100' },
  SUPPLIER_DELETE: { label: '供应商删除', icon: Trash2, color: 'text-red-600 bg-red-100' },
  FEE_SUPPLEMENT: { label: '追加费用', icon: Wallet, color: 'text-orange-600 bg-orange-100' },
  ORDER_MODIFY: { label: '订单修改', icon: Package, color: 'text-blue-600 bg-blue-100' },
  PAYMENT_REQUEST: { label: '付款申请', icon: Wallet, color: 'text-green-600 bg-green-100' },
  PORTAL_BILL_SUBMIT: { label: '客户提单审核', icon: Truck, color: 'text-cyan-600 bg-cyan-100' },
}

// 审批状态配置
const APPROVAL_STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: '待审批', color: 'text-amber-600 bg-amber-100', icon: Clock },
  approved: { label: '已通过', color: 'text-green-600 bg-green-100', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'text-red-600 bg-red-100', icon: XCircle },
}

// 有审批权限的角色
const APPROVER_ROLES = ['admin', 'boss', 'finance_manager', 'finance', 'czjl', 'manager']

// 根据用户角色获取可见的审批类型
function getVisibleApprovalTypes(userRole: string | undefined): string[] {
  // admin 和 boss 可以看到所有审批类型
  if (['admin', 'boss'].includes(userRole || '')) {
    return ['order', 'payment', 'supplier', 'fee', 'inquiry', 'void', 'contract']
  }
  
  // 财务角色可以看到财务相关审批
  if (['finance_manager', 'finance'].includes(userRole || '')) {
    return ['payment', 'fee', 'void']
  }
  
  // 经理角色可以看到订单、供应商、客户询价审批
  if (['manager', 'czjl'].includes(userRole || '')) {
    return ['order', 'supplier', 'inquiry', 'contract']
  }
  
  // 操作员角色只能看到订单审批
  if (['operator', 'do'].includes(userRole || '')) {
    return ['order']
  }
  
  return []
}

// 检查用户是否有审批权限
function canApprove(userRole: string | undefined, approvalType: string): boolean {
  // 财务相关审批类型（包括新的统一审批类型）
  const financeApprovalTypes = ['payment', 'fee', 'void', 'FEE_SUPPLEMENT']
  
  // 财务角色（包括 finance 和 finance_manager）可以审批财务相关
  if (['finance', 'finance_manager'].includes(userRole || '') && financeApprovalTypes.includes(approvalType)) {
    return true
  }
  
  // admin 可以审批所有类型
  if (userRole === 'admin') {
    return true
  }
  
  // boss 可以审批非财务日常的审批（追加费用等由财务处理）
  if (userRole === 'boss' && !['FEE_SUPPLEMENT'].includes(approvalType)) {
    return true
  }
  
  // 操作经理可以审批订单、供应商、客户询价
  if (['manager', 'czjl'].includes(userRole || '') && ['order', 'supplier', 'inquiry', 'contract'].includes(approvalType)) {
    return true
  }
  
  return false
}

// 数据源类型
type DataSource = 'legacy' | 'unified'

// 统计数据接口
interface ApprovalStats {
  pending: number
  approved: number
  rejected: number
  total: number
}

export default function ApprovalWorkbench() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [activeStatus, setActiveStatus] = useState('pending')
  const [activeType, setActiveType] = useState('all')
  
  // 数据源切换（legacy: 旧业务审批, unified: 统一审批）
  const [dataSource, setDataSource] = useState<DataSource>('unified')
  
  // 统计数据
  const [stats, setStats] = useState<ApprovalStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  })
  
  // 审批弹窗状态
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [currentApproval, setCurrentApproval] = useState<Approval | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [remark, setRemark] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // 查看详情弹窗状态
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailApproval, setDetailApproval] = useState<Approval | null>(null)

  const tabs = [
    { label: '消息中心', path: '/system/messages' },
    { label: '审批工作台', path: '/system/approvals' },
    { label: '预警管理', path: '/system/alerts' },
  ]

  // 检查当前用户是否有审批权限
  const hasApprovalPermission = APPROVER_ROLES.includes(user?.role || '')
  
  // 获取当前用户可见的审批类型
  const visibleTypes = getVisibleApprovalTypes(user?.role)

  // 加载统计数据
  const fetchStats = async () => {
    try {
      if (dataSource === 'unified') {
        const response = await fetch(`${API_BASE}/api/unified-approvals/stats`, {
          headers: getAuthHeaders()
        })
        const data = await response.json()
        if (data.errCode === 200) {
          setStats(data.data)
        }
      } else {
        // 业务审批暂时从列表数据计算
        // TODO: 添加业务审批的统计接口
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  // 加载审批列表
  const fetchApprovals = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      
      // 传递用户角色和ID用于权限过滤
      if (user?.id) {
        params.append('userId', user.id)
        params.append('approverId', user.id)
      }
      if (user?.role) {
        params.append('userRole', user.role)
      }
      
      if (activeStatus !== 'all') {
        params.append('status', activeStatus)
      }
      
      if (activeType !== 'all') {
        params.append('approvalType', activeType)
      }
      
      // 根据数据源选择不同的 API
      const apiUrl = dataSource === 'unified' 
        ? `${API_BASE}/api/unified-approvals?${params}`
        : `${API_BASE}/api/approvals?${params}`
      
      const response = await fetch(apiUrl, {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        setApprovals(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载审批列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 打开审批弹窗
  const openApprovalModal = (approval: Approval, action: 'approve' | 'reject') => {
    setCurrentApproval(approval)
    setApprovalAction(action)
    setRemark('')
    setRejectReason('')
    setShowApprovalModal(true)
  }

  // 提交审批
  const submitApproval = async () => {
    if (!currentApproval || !user?.id) return
    
    // 检查权限
    if (!canApprove(user?.role, currentApproval.approval_type)) {
      alert('您没有权限审批此类型的请求')
      return
    }
    
    if (approvalAction === 'reject' && !rejectReason.trim()) {
      alert('请填写驳回原因')
      return
    }
    
    setSubmitting(true)
    try {
      let response: Response
      
      if (dataSource === 'unified') {
        // 统一审批 API
        const apiUrl = approvalAction === 'approve'
          ? `${API_BASE}/api/unified-approvals/${currentApproval.id}/approve`
          : `${API_BASE}/api/unified-approvals/${currentApproval.id}/reject`
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(
            approvalAction === 'approve'
              ? { comment: remark }
              : { reason: rejectReason }
          )
        })
      } else {
        // 旧业务审批 API
        response = await fetch(`${API_BASE}/api/approvals/${currentApproval.id}/process`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            status: approvalAction === 'approve' ? 'approved' : 'rejected',
            approverId: user.id,
            approverName: user.name || user.username,
            approverRole: user.role,
            remark: remark,
            rejectReason: rejectReason
          })
        })
      }
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert(approvalAction === 'approve' ? '审批通过成功' : '审批驳回成功')
        setShowApprovalModal(false)
        fetchApprovals()
        // 清除通知缓存，让铃铛数量立即更新
        if (user?.id) {
          invalidateNotificationCache(user.id, user.role)
        }
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('审批操作失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 打开查看详情弹窗
  const openDetailModal = (approval: Approval) => {
    setDetailApproval(approval)
    setShowDetailModal(true)
  }

  // 跳转到关联业务页面
  const goToBusinessPage = (approval: Approval) => {
    const type = approval.approval_type
    const businessId = approval.business_id
    const requestData = approval.request_data
    
    // 订单相关审批 - business_id 就是提单ID
    if (['order', 'ORDER_MODIFY', 'void'].includes(type) && businessId) {
      navigate(`/bookings/bill/${businessId}`)
      return
    }
    
    // 追加费用审批 - business_id 是费用ID，需要从 request_data 获取提单ID
    if (type === 'FEE_SUPPLEMENT') {
      const billId = requestData?.fee?.billId || requestData?.billId
      if (billId) {
        navigate(`/bookings/bill/${billId}`)
        return
      }
      // 如果没有提单ID，跳转到费用管理页面
      navigate('/finance/fees')
      return
    }
    
    // 普通费用审批 - business_id 是提单ID
    if (type === 'fee' && businessId) {
      navigate(`/bookings/bill/${businessId}`)
      return
    }
    
    // 付款相关审批
    if (['payment', 'PAYMENT_REQUEST'].includes(type) && businessId) {
      navigate(`/finance/invoices/${businessId}`)
      return
    }
    
    // 供应商相关审批
    if (['supplier', 'SUPPLIER_DELETE'].includes(type)) {
      navigate('/suppliers/list')
      return
    }
    
    // 用户相关审批
    if (['USER_CREATE', 'USER_DELETE', 'ROLE_CHANGE', 'PERMISSION_CHANGE'].includes(type)) {
      navigate('/system/users')
      return
    }
    
    // 询价审批
    if (type === 'inquiry') {
      navigate('/crm/quotations')
      return
    }
    
    // 合同审批
    if (type === 'contract') {
      navigate('/crm/contracts')
      return
    }
    
    // 默认情况：如果有业务ID，尝试跳转到提单详情
    if (businessId) {
      navigate(`/bookings/bill/${businessId}`)
    }
  }

  useEffect(() => {
    fetchApprovals()
  }, [user?.id, page, pageSize, activeStatus, activeType, dataSource])

  // 加载统计数据
  useEffect(() => {
    fetchStats()
  }, [user?.id, dataSource])

  // 格式化时间
  const formatTime = (dateStr: string) => {
    return formatDateTime(dateStr)
  }

  // 格式化金额
  const formatAmount = (amount: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="审批工作台"
        icon={<ClipboardCheck className="w-6 h-6 text-primary-600" />}
        tabs={tabs}
        activeTab="/system/approvals"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(APPROVAL_STATUS).map(([key, config]) => {
          const Icon = config.icon
          // 从 stats 获取各状态的数量
          const count = stats[key as keyof ApprovalStats] || 0
          return (
            <button
              key={key}
              onClick={() => { setActiveStatus(key); setPage(1) }}
              className={`bg-white rounded-lg border p-4 text-left transition-all ${
                activeStatus === key 
                  ? 'border-primary-300 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{config.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {count}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </button>
          )
        })}
        <button
          onClick={() => { setActiveStatus('all'); setPage(1) }}
          className={`bg-white rounded-lg border p-4 text-left transition-all ${
            activeStatus === 'all' 
              ? 'border-primary-300 shadow-sm' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">全部</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {stats.total}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-600">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
        </button>
      </div>

      {/* 筛选和列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* 筛选栏 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 数据源切换 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setDataSource('unified'); setPage(1) }}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  dataSource === 'unified'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                统一审批
              </button>
              <button
                onClick={() => { setDataSource('legacy'); setPage(1) }}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  dataSource === 'legacy'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                业务审批
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">类型:</span>
              <select
                value={activeType}
                onChange={(e) => { setActiveType(e.target.value); setPage(1) }}
                className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">全部类型</option>
                {/* 只显示用户有权查看的审批类型 */}
                {visibleTypes.map((key) => {
                  const config = APPROVAL_TYPES[key]
                  return config ? <option key={key} value={key}>{config.label}</option> : null
                })}
              </select>
            </div>
          </div>
          <button
            onClick={fetchApprovals}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 审批列表 */}
        {loading ? (
          <div className="py-12 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
            暂无审批记录
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {approvals.map((approval) => {
              const typeConfig = APPROVAL_TYPES[approval.approval_type] || APPROVAL_TYPES.order
              const statusConfig = APPROVAL_STATUS[approval.status] || APPROVAL_STATUS.pending
              const TypeIcon = typeConfig.icon
              const StatusIcon = statusConfig.icon
              
              return (
                <div key={approval.id} className="px-4 py-4">
                  <div className="flex items-start justify-between">
                    {/* 左侧信息 */}
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {approval.approval_no && (
                            <span className="text-xs text-gray-400 font-mono">{approval.approval_no}</span>
                          )}
                          <span className={`px-2 py-0.5 text-xs rounded ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          {/* 追加费用显示应付/应收标签 */}
                          {approval.approval_type === 'FEE_SUPPLEMENT' && approval.request_data?.fee?.feeType && (
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              approval.request_data.fee.feeType === 'payable' 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {approval.request_data.fee.feeType === 'payable' ? '应付' : '应收'}
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-900">{approval.title}</span>
                          <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{approval.content}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>申请人: {approval.applicant_name || '-'}</span>
                          {approval.amount && <span>金额: {formatAmount(approval.amount)}</span>}
                          <span>提交时间: {formatTime(approval.created_at)}</span>
                        </div>
                        {/* 显示集装箱号（如果存在） */}
                        {approval.request_data?.containerNumber && (
                          <div className="mt-1 text-xs text-gray-400">
                            <span>集装箱号: <span className="font-mono text-gray-600">{approval.request_data.containerNumber}</span></span>
                          </div>
                        )}
                        {approval.status !== 'pending' && (
                          <div className="mt-2 text-xs text-gray-400">
                            <span>审批人: {approval.approver_name || '-'}</span>
                            <span className="ml-4">处理时间: {formatTime(approval.processed_at || approval.approved_at || approval.rejected_at)}</span>
                            {(approval.reject_reason || approval.rejection_reason) && (
                              <span className="ml-4 text-red-500">驳回原因: {approval.reject_reason || approval.rejection_reason}</span>
                            )}
                            {approval.approval_comment && (
                              <span className="ml-4 text-gray-500">审批意见: {approval.approval_comment}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧操作 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDetailModal(approval)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                        查看
                      </button>
                      {/* 只有待审批状态且用户有权限时才显示审批按钮 */}
                      {approval.status === 'pending' && canApprove(user?.role, approval.approval_type) && (
                        <>
                          <button
                            onClick={() => openApprovalModal(approval, 'approve')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                            通过
                          </button>
                          <button
                            onClick={() => openApprovalModal(approval, 'reject')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                            驳回
                          </button>
                        </>
                      )}
                      {/* 如果用户没有权限，显示等待审批提示 */}
                      {approval.status === 'pending' && !canApprove(user?.role, approval.approval_type) && (
                        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-50 rounded">等待审批</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              第 {page} / {totalPages} 页，共 {total} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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

      {/* 审批弹窗 */}
      {showApprovalModal && currentApproval && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {approvalAction === 'approve' ? '确认通过' : '确认驳回'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">审批项目</label>
                <p className="text-sm text-gray-600">{currentApproval.title}</p>
              </div>
              
              {approvalAction === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    驳回原因 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="请填写驳回原因"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="可选，填写审批备注"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={submitApproval}
                disabled={submitting}
                className={`px-4 py-2 text-sm text-white rounded-lg ${
                  approvalAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {submitting ? '处理中...' : (approvalAction === 'approve' ? '确认通过' : '确认驳回')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看详情弹窗 */}
      {showDetailModal && detailApproval && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* 标题栏 */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {(() => {
                  const typeConfig = APPROVAL_TYPES[detailApproval.approval_type] || APPROVAL_TYPES.order
                  const TypeIcon = typeConfig.icon
                  return (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                  )
                })()}
                <div>
                  <h3 className="text-lg font-medium text-gray-900">审批详情</h3>
                  {detailApproval.approval_no && (
                    <p className="text-xs text-gray-400 font-mono">{detailApproval.approval_no}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* 状态和类型 */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const typeConfig = APPROVAL_TYPES[detailApproval.approval_type] || APPROVAL_TYPES.order
                    const statusConfig = APPROVAL_STATUS[detailApproval.status] || APPROVAL_STATUS.pending
                    const StatusIcon = statusConfig.icon
                    return (
                      <>
                        <span className={`px-3 py-1 text-sm rounded-lg ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        {/* 追加费用显示应付/应收标签 */}
                        {detailApproval.approval_type === 'FEE_SUPPLEMENT' && detailApproval.request_data?.fee?.feeType && (
                          <span className={`px-3 py-1 text-sm rounded-lg ${
                            detailApproval.request_data.fee.feeType === 'payable' 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {detailApproval.request_data.fee.feeType === 'payable' ? '应付' : '应收'}
                          </span>
                        )}
                        <span className={`px-3 py-1 text-sm rounded-lg flex items-center gap-1.5 ${statusConfig.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusConfig.label}
                        </span>
                      </>
                    )
                  })()}
                </div>

                {/* 基本信息 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">审批标题</p>
                      <p className="text-sm text-gray-900 font-medium">{detailApproval.title}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">审批内容</p>
                      <p className="text-sm text-gray-700">{detailApproval.content || '-'}</p>
                    </div>
                  </div>
                  {detailApproval.amount > 0 && (
                    <div className="flex items-start gap-3">
                      <Wallet className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">涉及金额</p>
                        <p className="text-sm text-gray-900 font-medium">
                          {formatAmount(detailApproval.amount)} {detailApproval.currency || 'EUR'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 申请人信息 */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    申请信息
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-blue-600/70 mb-1">申请人</p>
                      <p className="text-blue-900">{detailApproval.applicant_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600/70 mb-1">提交时间</p>
                      <p className="text-blue-900">{formatTime(detailApproval.created_at)}</p>
                    </div>
                  </div>
                  {detailApproval.request_data?.containerNumber && (
                    <div>
                      <p className="text-xs text-blue-600/70 mb-1">集装箱号</p>
                      <p className="text-blue-900 font-mono">{detailApproval.request_data.containerNumber}</p>
                    </div>
                  )}
                  {detailApproval.request_data?.billNumber && (
                    <div>
                      <p className="text-xs text-blue-600/70 mb-1">提单号</p>
                      <p className="text-blue-900 font-mono">{detailApproval.request_data.billNumber}</p>
                    </div>
                  )}
                </div>

                {/* 审批信息（如果已处理） */}
                {detailApproval.status !== 'pending' && (
                  <div className={`rounded-lg p-4 space-y-3 ${
                    detailApproval.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <h4 className={`text-sm font-medium flex items-center gap-2 ${
                      detailApproval.status === 'approved' ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {detailApproval.status === 'approved' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      审批结果
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className={`text-xs mb-1 ${
                          detailApproval.status === 'approved' ? 'text-green-600/70' : 'text-red-600/70'
                        }`}>审批人</p>
                        <p className={detailApproval.status === 'approved' ? 'text-green-900' : 'text-red-900'}>
                          {detailApproval.approver_name || '-'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs mb-1 ${
                          detailApproval.status === 'approved' ? 'text-green-600/70' : 'text-red-600/70'
                        }`}>处理时间</p>
                        <p className={detailApproval.status === 'approved' ? 'text-green-900' : 'text-red-900'}>
                          {formatTime(detailApproval.processed_at || detailApproval.approved_at || detailApproval.rejected_at)}
                        </p>
                      </div>
                    </div>
                    {(detailApproval.reject_reason || detailApproval.rejection_reason) && (
                      <div>
                        <p className="text-xs text-red-600/70 mb-1">驳回原因</p>
                        <p className="text-red-900">
                          {detailApproval.reject_reason || detailApproval.rejection_reason}
                        </p>
                      </div>
                    )}
                    {detailApproval.approval_comment && (
                      <div>
                        <p className={`text-xs mb-1 ${
                          detailApproval.status === 'approved' ? 'text-green-600/70' : 'text-red-600/70'
                        }`}>审批意见</p>
                        <p className={detailApproval.status === 'approved' ? 'text-green-900' : 'text-red-900'}>
                          {detailApproval.approval_comment}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 关联业务 */}
                {(detailApproval.business_id || detailApproval.request_data?.fee?.billId) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-3">
                      <Hash className="w-4 h-4" />
                      关联业务
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {detailApproval.approval_type === 'FEE_SUPPLEMENT' ? (
                          <span>提单: <span className="font-mono">{detailApproval.request_data?.fee?.billId || '-'}</span></span>
                        ) : (
                          <span className="font-mono">{detailApproval.business_id}</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          // 获取正确的跳转 ID
                          let targetId = detailApproval.business_id
                          if (detailApproval.approval_type === 'FEE_SUPPLEMENT') {
                            targetId = detailApproval.request_data?.fee?.billId || ''
                          }
                          if (targetId) {
                            setShowDetailModal(false)
                            // 使用正确的路由路径 /bookings/bill/:id
                            navigate(`/bookings/bill/${targetId}`)
                          } else {
                            alert('无法获取关联业务ID')
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        跳转到订单详情
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
              <div className="text-xs text-gray-400">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                创建于 {formatTime(detailApproval.created_at)}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  关闭
                </button>
                {detailApproval.status === 'pending' && canApprove(user?.role, detailApproval.approval_type) && (
                  <>
                    <button
                      onClick={() => {
                        setShowDetailModal(false)
                        openApprovalModal(detailApproval, 'reject')
                      }}
                      className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      驳回
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailModal(false)
                        openApprovalModal(detailApproval, 'approve')
                      }}
                      className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      通过
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
