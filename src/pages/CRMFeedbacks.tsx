import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Trash2, X, 
  AlertTriangle, ThumbsUp, HelpCircle, Lightbulb,
  Clock, CheckCircle, AlertCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Feedback {
  id: string
  feedbackNumber: string
  customerId: string
  customerName: string
  contactName: string
  feedbackType: string
  subject: string
  content: string
  priority: string
  source: string
  billNumber: string
  assignedName: string
  status: string
  resolution: string
  resolvedAt: string | null
  createTime: string
}

interface FeedbackStats {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  highPriority: number
}

interface Customer {
  id: string
  customerName: string
}

export default function CRMFeedbacks() {
  const navigate = useNavigate()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [resolution, setResolution] = useState('')
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    feedbackType: 'inquiry',
    subject: '',
    content: '',
    priority: 'medium',
    source: '',
    billNumber: ''
  })

   
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, filterType, filterStatus])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterType) params.append('type', filterType)
      if (filterStatus) params.append('status', filterStatus)

      const [fbRes, statsRes, custRes] = await Promise.all([
        fetch(`${API_BASE}/api/feedbacks?${params}`),
        fetch(`${API_BASE}/api/feedbacks/stats`),
        fetch(`${API_BASE}/api/customers?pageSize=100`)
      ])

      const [fbData, statsData, custData] = await Promise.all([
        fbRes.json(),
        statsRes.json(),
        custRes.json()
      ])
      
      if (fbData.errCode === 200) {
        setFeedbacks(fbData.data.list || [])
        setTotal(fbData.data.total || 0)
      }
      if (statsData.errCode === 200) setStats(statsData.data)
      if (custData.errCode === 200) setCustomers(custData.data.list || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setFormData({
      customerId: '',
      customerName: '',
      feedbackType: 'inquiry',
      subject: '',
      content: '',
      priority: 'medium',
      source: '',
      billNumber: ''
    })
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.subject || !formData.content) {
      alert('请填写主题和内容')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.errCode === 200) {
        setShowModal(false)
        loadData()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/feedbacks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  const handleResolve = async () => {
    if (!selectedFeedback || !resolution) {
      alert('请输入解决方案')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/feedbacks/${selectedFeedback.id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        setShowResolveModal(false)
        setResolution('')
        setSelectedFeedback(null)
        loadData()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('解决失败:', error)
    }
  }

  const handleDelete = async (item: Feedback) => {
    if (!confirm(`确定要删除反馈"${item.subject}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/feedbacks/${item.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const getTypeInfo = (type: string) => {
    const typeMap: Record<string, { label: string; icon: any; color: string; bg: string }> = {
      complaint: { label: '投诉', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
      suggestion: { label: '建议', icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-100' },
      inquiry: { label: '咨询', icon: HelpCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
      praise: { label: '表扬', icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-100' }
    }
    return typeMap[type] || typeMap.inquiry
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: any; color: string; bg: string }> = {
      open: { label: '待处理', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
      processing: { label: '处理中', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
      resolved: { label: '已解决', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
      closed: { label: '已关闭', icon: CheckCircle, color: 'text-gray-600', bg: 'bg-gray-100' }
    }
    return statusMap[status] || statusMap.open
  }

  const getPriorityInfo = (priority: string) => {
    const priorityMap: Record<string, { label: string; color: string }> = {
      low: { label: '低', color: 'text-gray-500' },
      medium: { label: '中', color: 'text-blue-500' },
      high: { label: '高', color: 'text-orange-500' },
      urgent: { label: '紧急', color: 'text-red-500' }
    }
    return priorityMap[priority] || priorityMap.medium
  }

  const columns: Column<Feedback>[] = useMemo(() => [
    {
      key: 'feedbackNumber',
      label: '反馈编号',
      width: 130,
      render: (item) => (
        <span className="text-primary-600 font-medium text-xs">{item.feedbackNumber}</span>
      )
    },
    {
      key: 'feedbackType',
      label: '类型',
      width: 80,
      render: (item) => {
        const info = getTypeInfo(item.feedbackType)
        const Icon = info.icon
        return (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            <Icon className="w-3 h-3" />
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'subject',
      label: '主题',
      width: 200,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 text-xs line-clamp-1">{item.subject}</div>
          <div className="text-[10px] text-gray-500 line-clamp-1">{item.content}</div>
        </div>
      )
    },
    {
      key: 'customerName',
      label: '客户',
      width: 120,
      render: (item) => (
        <span className="text-xs text-gray-700">{item.customerName || '-'}</span>
      )
    },
    {
      key: 'priority',
      label: '优先级',
      width: 70,
      render: (item) => {
        const info = getPriorityInfo(item.priority)
        return (
          <span className={`text-xs font-medium ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'assignedName',
      label: '处理人',
      width: 80,
      render: (item) => (
        <span className="text-xs text-gray-600">{item.assignedName || '-'}</span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 90,
      render: (item) => {
        const info = getStatusInfo(item.status)
        const Icon = info.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            <Icon className="w-3 h-3" />
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'createTime',
      label: '创建时间',
      width: 100,
      render: (item) => (
        <span className="text-xs text-gray-500">
          {item.createTime ? new Date(item.createTime).toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 160,
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.status === 'open' && (
            <button
              onClick={() => handleUpdateStatus(item.id, 'processing')}
              className="px-2 py-1 text-[10px] bg-amber-50 text-amber-600 rounded hover:bg-amber-100"
            >
              处理
            </button>
          )}
          {(item.status === 'open' || item.status === 'processing') && (
            <button
              onClick={() => {
                setSelectedFeedback(item)
                setShowResolveModal(true)
              }}
              className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
            >
              解决
            </button>
          )}
          <button 
            onClick={() => handleDelete(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/feedbacks"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">总反馈</div>
          <div className="text-xl font-bold text-gray-900">{stats?.total || 0}</div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-100 p-3">
          <div className="flex items-center gap-1 text-xs text-red-600 mb-1">
            <AlertTriangle className="w-3 h-3" />
            投诉
          </div>
          <div className="text-xl font-bold text-red-700">{stats?.byType.complaint || 0}</div>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-100 p-3">
          <div className="flex items-center gap-1 text-xs text-amber-600 mb-1">
            <Lightbulb className="w-3 h-3" />
            建议
          </div>
          <div className="text-xl font-bold text-amber-700">{stats?.byType.suggestion || 0}</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-3">
          <div className="flex items-center gap-1 text-xs text-blue-600 mb-1">
            <HelpCircle className="w-3 h-3" />
            咨询
          </div>
          <div className="text-xl font-bold text-blue-700">{stats?.byType.inquiry || 0}</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-100 p-3">
          <div className="flex items-center gap-1 text-xs text-green-600 mb-1">
            <ThumbsUp className="w-3 h-3" />
            表扬
          </div>
          <div className="text-xl font-bold text-green-700">{stats?.byType.praise || 0}</div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索反馈编号、主题、客户..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            <option value="complaint">投诉</option>
            <option value="suggestion">建议</option>
            <option value="inquiry">咨询</option>
            <option value="praise">表扬</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            <option value="open">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="closed">已关闭</option>
          </select>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          新建反馈
        </button>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={feedbacks}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">共 {total} 条记录</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 新建反馈弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[560px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">新建反馈</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value)
                      setFormData({
                        ...formData, 
                        customerId: e.target.value,
                        customerName: customer?.customerName || ''
                      })
                    }}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">请选择客户</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">反馈类型</label>
                  <select
                    value={formData.feedbackType}
                    onChange={(e) => setFormData({...formData, feedbackType: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="inquiry">咨询</option>
                    <option value="suggestion">建议</option>
                    <option value="complaint">投诉</option>
                    <option value="praise">表扬</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">优先级</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">来源</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({...formData, source: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="如：电话、邮件、在线"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">主题 *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="请输入反馈主题"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">内容 *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={4}
                  placeholder="请详细描述反馈内容"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">关联提单号</label>
                <input
                  type="text"
                  value={formData.billNumber}
                  onChange={(e) => setFormData({...formData, billNumber: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="如有相关提单，请输入提单号"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 解决反馈弹窗 */}
      {showResolveModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[480px]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">解决反馈</h3>
              <button 
                onClick={() => {
                  setShowResolveModal(false)
                  setSelectedFeedback(null)
                  setResolution('')
                }} 
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">反馈主题</div>
                <div className="text-sm text-gray-900">{selectedFeedback.subject}</div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">解决方案 *</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={4}
                  placeholder="请输入解决方案和处理结果"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setShowResolveModal(false)
                  setSelectedFeedback(null)
                  setResolution('')
                }}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                className="px-4 py-2 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                确认解决
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

