/**
 * 消息中心页面
 * 展示所有消息，支持筛选和标记已读
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  MessageSquare, 
  Bell, 
  ClipboardCheck, 
  AlertTriangle,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  RefreshCw,
  ChevronRight,
  Mail,
  MailOpen
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Message {
  id: string
  type: string
  title: string
  content: string
  sender_name: string
  is_read: number
  created_at: string
  related_type: string
  related_id: string
}

interface MessageListResponse {
  list: Message[]
  total: number
  page: number
  pageSize: number
}

// 消息类型配置
const MESSAGE_TYPES = [
  { value: 'all', label: '全部', icon: Bell },
  { value: 'system', label: '系统通知', icon: MessageSquare },
  { value: 'approval', label: '审批消息', icon: ClipboardCheck },
  { value: 'alert', label: '预警消息', icon: AlertTriangle },
]

export default function MessageCenter() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [activeType, setActiveType] = useState('all')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const tabs = [
    { label: '消息中心', path: '/system/messages' },
    { label: '审批工作台', path: '/system/approvals' },
    { label: '预警管理', path: '/system/alerts' },
  ]

  // 加载消息列表
  const fetchMessages = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        receiverId: user.id,
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (activeType !== 'all') {
        params.append('type', activeType)
      }
      
      if (showUnreadOnly) {
        params.append('isRead', 'false')
      }
      
      const response = await fetch(`${API_BASE}/api/messages?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setMessages(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 标记单条已读
  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/messages/${id}/read`, { method: 'PUT' })
      fetchMessages()
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  // 批量标记已读
  const markSelectedAsRead = async () => {
    if (selectedIds.length === 0) return
    
    try {
      await fetch(`${API_BASE}/api/messages/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      })
      setSelectedIds([])
      fetchMessages()
    } catch (error) {
      console.error('批量标记已读失败:', error)
    }
  }

  // 全部标记已读
  const markAllAsRead = async () => {
    if (!user?.id) return
    
    try {
      await fetch(`${API_BASE}/api/messages/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: user.id })
      })
      fetchMessages()
    } catch (error) {
      console.error('全部标记已读失败:', error)
    }
  }

  // 删除消息
  const deleteMessage = async (id: string) => {
    if (!confirm('确定删除这条消息吗？')) return
    
    try {
      await fetch(`${API_BASE}/api/messages/${id}`, { method: 'DELETE' })
      fetchMessages()
    } catch (error) {
      console.error('删除消息失败:', error)
    }
  }

  // 处理消息点击
  const handleMessageClick = (message: Message) => {
    // 标记已读
    if (!message.is_read) {
      markAsRead(message.id)
    }
    
    // 根据类型跳转
    if (message.related_type === 'approval') {
      navigate('/system/approvals')
    } else if (message.related_type === 'alert') {
      navigate('/system/alerts')
    } else if (message.related_type === 'order') {
      navigate(`/bill-details/${message.related_id}`)
    } else if (message.related_type === 'invoice') {
      navigate(`/finance/invoices/${message.related_id}`)
    }
  }

  // 切换选中状态
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === messages.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(messages.map(m => m.id))
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [user?.id, page, pageSize, activeType, showUnreadOnly])

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取消息类型样式
  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'approval':
        return { bgColor: 'bg-blue-100', textColor: 'text-blue-600', label: '审批' }
      case 'alert':
        return { bgColor: 'bg-red-100', textColor: 'text-red-600', label: '预警' }
      default:
        return { bgColor: 'bg-gray-100', textColor: 'text-gray-600', label: '系统' }
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="消息中心"
        icon={<Bell className="w-6 h-6 text-primary-600" />}
        tabs={tabs}
        activeTab="/system/messages"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {/* 左侧：类型筛选 */}
          <div className="flex items-center gap-2">
            {MESSAGE_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  onClick={() => { setActiveType(type.value); setPage(1) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeType === type.value
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{type.label}</span>
                </button>
              )
            })}
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(e) => { setShowUnreadOnly(e.target.checked); setPage(1) }}
                className="w-4 h-4 text-primary-600 rounded border-gray-300"
              />
              仅显示未读
            </label>
            
            <button
              onClick={fetchMessages}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={markSelectedAsRead}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Check className="w-4 h-4" />
                标记已读 ({selectedIds.length})
              </button>
            )}

            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <CheckCheck className="w-4 h-4" />
              全部已读
            </button>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* 表头 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
          <input
            type="checkbox"
            checked={messages.length > 0 && selectedIds.length === messages.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 text-primary-600 rounded border-gray-300"
          />
          <span className="text-sm text-gray-500">
            共 {total} 条消息
            {selectedIds.length > 0 && ` · 已选 ${selectedIds.length} 条`}
          </span>
        </div>

        {/* 消息列表 */}
        {loading ? (
          <div className="py-12 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
            暂无消息
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((message) => {
              const typeStyle = getTypeStyle(message.type)
              return (
                <div
                  key={message.id}
                  className={`px-4 py-3 flex items-start gap-4 hover:bg-gray-50 transition-colors ${
                    !message.is_read ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {/* 选择框 */}
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(message.id)}
                    onChange={() => toggleSelect(message.id)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 mt-1"
                  />

                  {/* 已读状态图标 */}
                  <div className="mt-0.5">
                    {message.is_read ? (
                      <MailOpen className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Mail className="w-5 h-5 text-blue-500" />
                    )}
                  </div>

                  {/* 消息内容 */}
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleMessageClick(message)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded ${typeStyle.bgColor} ${typeStyle.textColor}`}>
                        {typeStyle.label}
                      </span>
                      <span className={`text-sm ${!message.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {message.title}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{message.content}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span>{formatTime(message.created_at)}</span>
                      {message.sender_name && <span>来自: {message.sender_name}</span>}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    {!message.is_read && (
                      <button
                        onClick={() => markAsRead(message.id)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="标记已读"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMessage(message.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMessageClick(message)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="查看详情"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
              第 {page} / {totalPages} 页
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
    </div>
  )
}
