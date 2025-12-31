import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Check, X, Eye, RefreshCw, Clock, CheckCircle, XCircle, FileText, Settings, Save } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { PageContainer, ContentCard, LoadingSpinner, EmptyState } from '../components/ui'
import { getApiBaseUrl } from '../utils/api'
import { formatDateTime } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface User {
  id: string
  name: string
  username: string
  role: string
}

interface VoidApplication {
  id: string
  billId: string
  billNumber: string
  orderNumber?: string  // 订单号
  containerNumber: string
  reason: string
  status: string
  applicantId: string
  applicantName: string
  supervisorId: string | null
  supervisorName: string | null
  supervisorApprovedAt: string | null
  supervisorComment: string | null
  financeId: string | null
  financeName: string | null
  financeApprovedAt: string | null
  financeComment: string | null
  feesJson: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending_supervisor: { label: '待上级审批', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: Clock },
  pending_finance: { label: '待财务审批', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
  approved: { label: '已通过', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle },
}

export default function ApprovalList() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'approvals' | 'settings'>('approvals')
  const [applications, setApplications] = useState<VoidApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [selectedApp, setSelectedApp] = useState<VoidApplication | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // 配置相关状态
  const [users, setUsers] = useState<User[]>([])
  const [supervisorId, setSupervisorId] = useState('')
  const [financeId, setFinanceId] = useState('')
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)

  useEffect(() => {
    loadApplications()
    loadUsers()
    loadConfigs()
  }, [statusFilter])
  
  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users`)
      const data = await response.json()
      if (data.errCode === 200) {
        setUsers(data.data || [])
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }
  
  const loadConfigs = async () => {
    setConfigLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/system-configs`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        const configs = data.data
        const supervisor = configs.find((c: any) => c.key === 'void_supervisor_id')
        const finance = configs.find((c: any) => c.key === 'void_finance_id')
        if (supervisor) setSupervisorId(supervisor.value || '')
        if (finance) setFinanceId(finance.value || '')
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    } finally {
      setConfigLoading(false)
    }
  }
  
  const saveConfig = async (key: string, value: string) => {
    setConfigSaving(true)
    try {
      const response = await fetch(`${API_BASE}/api/system-configs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('配置已保存')
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      alert('保存失败')
    } finally {
      setConfigSaving(false)
    }
  }

  const loadApplications = async () => {
    setLoading(true)
    try {
      let url = '/api/void-applications'
      if (statusFilter === 'pending') {
        // 获取所有待审批的
        const [supervisor, finance] = await Promise.all([
          fetch(`${API_BASE}/api/void-applications?status=pending_supervisor`).then(r => r.json()),
          fetch(`${API_BASE}/api/void-applications?status=pending_finance`).then(r => r.json())
        ])
        const combined = [
          ...(supervisor.errCode === 200 ? supervisor.data : []),
          ...(finance.errCode === 200 ? finance.data : [])
        ]
        setApplications(combined)
        setLoading(false)
        return
      } else if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      if (data.errCode === 200) {
        setApplications(data.data || [])
      }
    } catch (error) {
      console.error('加载审批列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedApp) return
    setSubmitting(true)
    
    try {
      const response = await fetch(`${API_BASE}/api/void-applications/${selectedApp.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert(data.msg || '审批成功')
        setShowApproveModal(false)
        setComment('')
        setSelectedApp(null)
        loadApplications()
      } else {
        alert(data.msg || '审批失败')
      }
    } catch (error) {
      console.error('审批失败:', error)
      alert('审批失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedApp) return
    if (!comment.trim()) {
      alert('请填写拒绝原因')
      return
    }
    setSubmitting(true)
    
    try {
      const response = await fetch(`${API_BASE}/api/void-applications/${selectedApp.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert('已拒绝')
        setShowRejectModal(false)
        setComment('')
        setSelectedApp(null)
        loadApplications()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('拒绝失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const openApproveModal = (app: VoidApplication) => {
    setSelectedApp(app)
    setComment('')
    setShowApproveModal(true)
  }

  const openRejectModal = (app: VoidApplication) => {
    setSelectedApp(app)
    setComment('')
    setShowRejectModal(true)
  }

  const openDetailModal = (app: VoidApplication) => {
    setSelectedApp(app)
    setShowDetailModal(true)
  }

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, color: 'text-gray-600', bgColor: 'bg-gray-50', icon: Clock }
  }


  const parseFees = (feesJson: string | null) => {
    if (!feesJson) return []
    try {
      return JSON.parse(feesJson)
    } catch {
      return []
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="审批管理"
        icon={<ClipboardCheck className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system' },
          { label: '审批管理' }
        ]}
        tabs={[
          { label: '审批列表', path: 'approvals' },
          { label: '审批配置', path: 'settings' },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'approvals' | 'settings')}
        actionButtons={
          activeTab === 'approvals' ? (
            <button
              onClick={loadApplications}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          ) : null
        }
      />

      {activeTab === 'approvals' && (
        <ContentCard>
          {/* 筛选栏 */}
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
            <span className="text-sm text-gray-500">状态筛选:</span>
          {[
            { value: 'pending', label: '待审批' },
            { value: 'pending_supervisor', label: '待上级审批' },
            { value: 'pending_finance', label: '待财务审批' },
            { value: 'approved', label: '已通过' },
            { value: 'rejected', label: '已拒绝' },
            { value: 'all', label: '全部' },
          ].map(item => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === item.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="w-12 h-12" />}
            title="暂无审批记录"
            description="当前没有待处理的审批任务"
          />
        ) : (
          <div className="space-y-3">
            {applications.map(app => {
              const statusConfig = getStatusConfig(app.status)
              const StatusIcon = statusConfig.icon
              const canApprove = app.status === 'pending_supervisor' || app.status === 'pending_finance'
              
              return (
                <div
                  key={app.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {app.orderNumber && (
                          <span
                            className="font-semibold text-primary-600 hover:underline cursor-pointer"
                            onClick={() => navigate(`/bookings/bill/${app.billId}`)}
                          >
                            {app.orderNumber}
                          </span>
                        )}
                        <span
                          className={`${app.orderNumber ? 'text-gray-600' : 'font-semibold text-primary-600'} hover:underline cursor-pointer`}
                          onClick={() => navigate(`/bookings/bill/${app.billId}`)}
                        >
                          {app.billNumber}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="text-gray-400">作废原因:</span> {app.reason}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>申请人: {app.applicantName}</span>
                        <span>申请时间: {formatDateTime(app.createdAt)}</span>
                        {app.supervisorApprovedAt && (
                          <span>上级审批: {app.supervisorName} ({formatDateTime(app.supervisorApprovedAt)})</span>
                        )}
                        {app.financeApprovedAt && (
                          <span>财务审批: {app.financeName} ({formatDateTime(app.financeApprovedAt)})</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDetailModal(app)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {canApprove && (
                        <>
                          <button
                            onClick={() => openApproveModal(app)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            通过
                          </button>
                          <button
                            onClick={() => openRejectModal(app)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                            拒绝
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ContentCard>
      )}

      {/* 配置Tab */}
      {activeTab === 'settings' && (
        <ContentCard>
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900">作废审批人配置</h3>
            </div>
            
            {configLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-6">
                {/* 上级审批人 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    上级审批人
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    当提单有操作记录或费用时，作废申请首先由此人审批
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      value={supervisorId}
                      onChange={(e) => setSupervisorId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- 请选择 --</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.username}) - {user.role}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveConfig('void_supervisor_id', supervisorId)}
                      disabled={configSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                  </div>
                </div>
                
                {/* 财务审批人 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    财务审批人
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    上级审批通过后，由此人进行财务审批，通过后提单正式作废
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      value={financeId}
                      onChange={(e) => setFinanceId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- 请选择 --</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.username}) - {user.role}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveConfig('void_finance_id', financeId)}
                      disabled={configSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </button>
                  </div>
                </div>
                
                {/* 说明 */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">审批流程说明</h4>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>当提单有操作记录或费用记录时，点击作废需要填写原因并确认费用</li>
                    <li>提交后，申请进入"待上级审批"状态</li>
                    <li>上级审批通过后，进入"待财务审批"状态</li>
                    <li>财务审批通过后，提单正式作废</li>
                    <li>任一审批人拒绝，申请结束，提单恢复正常状态</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </ContentCard>
      )}

      {/* 详情模态框 */}
      {showDetailModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">申请详情</h3>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)] space-y-4">
              {selectedApp.orderNumber && (
                <div>
                  <label className="text-sm text-gray-500">订单号</label>
                  <p className="font-medium text-primary-600">{selectedApp.orderNumber}</p>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-500">提单号</label>
                <p className="font-medium">{selectedApp.billNumber}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">作废原因</label>
                <p className="font-medium">{selectedApp.reason}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">状态</label>
                <p className="font-medium">{getStatusConfig(selectedApp.status).label}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">申请人</label>
                <p className="font-medium">{selectedApp.applicantName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">申请时间</label>
                <p className="font-medium">{formatDateTime(selectedApp.createdAt)}</p>
              </div>
              
              {selectedApp.supervisorApprovedAt && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <label className="text-sm text-gray-500">上级审批</label>
                  <p className="font-medium">{selectedApp.supervisorName} - {formatDateTime(selectedApp.supervisorApprovedAt)}</p>
                  {selectedApp.supervisorComment && (
                    <p className="text-sm text-gray-600 mt-1">备注: {selectedApp.supervisorComment}</p>
                  )}
                </div>
              )}
              
              {selectedApp.financeApprovedAt && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <label className="text-sm text-gray-500">财务审批</label>
                  <p className="font-medium">{selectedApp.financeName} - {formatDateTime(selectedApp.financeApprovedAt)}</p>
                  {selectedApp.financeComment && (
                    <p className="text-sm text-gray-600 mt-1">备注: {selectedApp.financeComment}</p>
                  )}
                </div>
              )}
              
              {/* 费用信息 */}
              {selectedApp.feesJson && (
                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                    <FileText className="w-4 h-4" />
                    相关费用
                  </label>
                  <div className="space-y-2">
                    {parseFees(selectedApp.feesJson).map((fee: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{fee.feeName}</span>
                        <span className="text-sm font-medium">{fee.currency} {fee.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 审批通过模态框 */}
      {showApproveModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">确认审批通过</h3>
              <button onClick={() => setShowApproveModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                确定通过{selectedApp.orderNumber ? `订单 ${selectedApp.orderNumber}` : `提单 ${selectedApp.billNumber}`} 的作废申请吗？
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">审批备注（可选）</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入审批备注..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? '处理中...' : '确认通过'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 拒绝模态框 */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">确认拒绝</h3>
              <button onClick={() => setShowRejectModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                确定拒绝{selectedApp.orderNumber ? `订单 ${selectedApp.orderNumber}` : `提单 ${selectedApp.billNumber}`} 的作废申请吗？
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">拒绝原因 <span className="text-red-500">*</span></label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请输入拒绝原因..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting || !comment.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {submitting ? '处理中...' : '确认拒绝'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
