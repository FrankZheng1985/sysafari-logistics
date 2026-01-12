/**
 * 信息中心页面
 * 整合聊天、审批、预警、系统通知功能
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatDateTime } from '../utils/dateFormat'
import { 
  MessageCircle, 
  Bell, 
  ClipboardCheck, 
  AlertTriangle,
  MessageSquare,
  Users,
  Plus,
  Settings,
  Search,
  RefreshCw,
  ChevronRight,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { ConversationList, ChatWindow, NewChatModal } from '../components/Chat'
import { useAuth } from '../contexts/AuthContext'
import { useSocket, type Conversation, type ChatMessage } from '../contexts/SocketContext'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { invalidateNotificationCache } from '../utils/apiCache'

const API_BASE = getApiBaseUrl()

// Tab 配置
type TabType = 'chat' | 'approval' | 'alert' | 'notification'

interface TabConfig {
  id: TabType
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

// 审批类型配置
const APPROVAL_TYPES: Record<string, { label: string; color: string }> = {
  order: { label: '订单审批', color: 'text-blue-600 bg-blue-100' },
  payment: { label: '付款申请', color: 'text-green-600 bg-green-100' },
  supplier: { label: '供应商审批', color: 'text-purple-600 bg-purple-100' },
  fee: { label: '费用审批', color: 'text-orange-600 bg-orange-100' },
}

// 审批状态配置
const APPROVAL_STATUS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: '待审批', color: 'text-amber-600 bg-amber-100', icon: Clock },
  approved: { label: '已通过', color: 'text-green-600 bg-green-100', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'text-red-600 bg-red-100', icon: XCircle },
}

// 预警级别配置
const ALERT_LEVELS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  danger: { label: '危险', color: 'text-red-600 bg-red-100', icon: AlertCircle },
  warning: { label: '警告', color: 'text-amber-600 bg-amber-100', icon: AlertTriangle },
  info: { label: '提醒', color: 'text-blue-600 bg-blue-100', icon: Info },
}

export default function InfoCenter() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { 
    isConnected, 
    onConversationUpdate, 
    onNotification,
    onNewMessage
  } = useSocket()
  
  // 当前Tab
  const currentTab = (searchParams.get('tab') as TabType) || 'chat'
  
  // 状态
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  
  // 统计数据
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [activeAlerts, setActiveAlerts] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  
  // 审批/预警/通知列表
  const [approvals, setApprovals] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Tab 配置
  const tabs: TabConfig[] = [
    { id: 'chat', label: '聊天', icon: MessageCircle, badge: unreadMessages },
    { id: 'approval', label: '审批', icon: ClipboardCheck, badge: pendingApprovals },
    { id: 'alert', label: '预警', icon: AlertTriangle, badge: activeAlerts },
    { id: 'notification', label: '通知', icon: Bell, badge: unreadNotifications },
  ]

  // 加载统计数据
  const fetchStats = async () => {
    if (!user?.id) return
    
    try {
      // 获取聊天未读数
      const chatRes = await fetch(`${API_BASE}/api/chat/unread-count?userId=${user.id}`)
      const chatData = await chatRes.json()
      if (chatData.errCode === 200) {
        setUnreadMessages(chatData.data?.count || 0)
      }
      
      // 获取通知概览
      const overviewRes = await fetch(`${API_BASE}/api/notifications/overview?userId=${user.id}`)
      const overviewData = await overviewRes.json()
      if (overviewData.errCode === 200) {
        setPendingApprovals(overviewData.data?.pendingApprovals || 0)
        setActiveAlerts(overviewData.data?.activeAlerts || 0)
        setUnreadNotifications(overviewData.data?.unreadMessages || 0)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  // 加载审批列表
  const fetchApprovals = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        approverId: user.id,
        status: 'pending',
        pageSize: '50'
      })
      
      const response = await fetch(`${API_BASE}/api/approvals?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setApprovals(data.data.list || [])
      }
    } catch (error) {
      console.error('加载审批列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载预警列表
  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: 'active',
        pageSize: '50'
      })
      
      const response = await fetch(`${API_BASE}/api/alerts/logs?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setAlerts(data.data.list || [])
      }
    } catch (error) {
      console.error('加载预警列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载通知列表
  const fetchNotifications = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        receiverId: user.id,
        pageSize: '50'
      })
      
      const response = await fetch(`${API_BASE}/api/messages?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setNotifications(data.data.list || [])
      }
    } catch (error) {
      console.error('加载通知列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理审批
  const handleApproval = async (approvalId: string, action: 'approve' | 'reject', rejectReason?: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/approvals/${approvalId}/process`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
          approverId: user?.id,
          approverName: user?.name || user?.username,
          rejectReason
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        fetchApprovals()
        fetchStats()
        // 清除通知缓存，让铃铛数量立即更新
        if (user?.id) {
          invalidateNotificationCache(user.id, user.role)
        }
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('处理审批失败:', error)
      alert('操作失败')
    }
  }

  // 处理预警
  const handleAlert = async (alertId: number, action: 'handle' | 'ignore') => {
    try {
      const endpoint = action === 'handle' 
        ? `/api/alerts/logs/${alertId}/handle`
        : `/api/alerts/logs/${alertId}/ignore`
        
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          handledBy: user?.name || user?.username
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        fetchAlerts()
        fetchStats()
        // 清除通知缓存，让铃铛数量立即更新
        if (user?.id) {
          invalidateNotificationCache(user.id, user.role)
        }
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('处理预警失败:', error)
      alert('操作失败')
    }
  }

  // 初始加载
  useEffect(() => {
    fetchStats()
  }, [user?.id])

  // Tab 切换时加载数据
  useEffect(() => {
    if (currentTab === 'approval') {
      fetchApprovals()
    } else if (currentTab === 'alert') {
      fetchAlerts()
    } else if (currentTab === 'notification') {
      fetchNotifications()
    }
  }, [currentTab, user?.id])

  // 监听 Socket 事件
  useEffect(() => {
    const unsubConv = onConversationUpdate(() => {
      fetchStats()
    })
    
    const unsubNotify = onNotification(() => {
      fetchStats()
      if (currentTab === 'notification') {
        fetchNotifications()
      }
    })
    
    return () => {
      unsubConv()
      unsubNotify()
    }
  }, [currentTab, onConversationUpdate, onNotification])

  // 切换 Tab
  const handleTabChange = (tabId: TabType) => {
    setSearchParams({ tab: tabId })
  }

  // 选择会话
  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation)
    setShowMobileChat(true)
  }

  // 新建聊天后的回调
  const handleChatCreated = async (conversationId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/chat/conversations/${conversationId}?userId=${user?.id}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        setActiveConversation(data.data)
        setShowMobileChat(true)
      }
    } catch (error) {
      console.error('获取会话失败:', error)
    }
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    
    return formatDateTime(dateStr)
  }

  // 渲染聊天页
  const renderChatTab = () => (
    <div className="flex h-[calc(100vh-180px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 会话列表 */}
      <div className={`w-80 flex-shrink-0 ${showMobileChat ? 'hidden lg:block' : ''}`}>
        <ConversationList
          activeConversationId={activeConversation?.id}
          onSelectConversation={handleSelectConversation}
          onNewChat={() => setShowNewChatModal(true)}
          unreadTotal={unreadMessages}
        />
      </div>
      
      {/* 聊天窗口 */}
      <div className={`flex-1 ${!activeConversation && !showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            onBack={() => {
              setShowMobileChat(false)
              setActiveConversation(null)
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">选择一个会话开始聊天</p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              发起新聊天
            </button>
          </div>
        )}
      </div>
      
      {/* 新建聊天弹窗 */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onChatCreated={handleChatCreated}
      />
    </div>
  )

  // 渲染审批页
  const renderApprovalTab = () => (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">待处理审批</span>
        <button
          onClick={fetchApprovals}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : approvals.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无待处理审批</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {approvals.map((approval) => {
            const typeConfig = APPROVAL_TYPES[approval.approval_type] || APPROVAL_TYPES.order
            
            return (
              <div key={approval.id} className="px-4 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {approval.title}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{approval.content}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>申请人: {approval.applicant_name}</span>
                      <span>{formatTime(approval.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleApproval(approval.id, 'approve')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('请输入驳回原因')
                        if (reason) {
                          handleApproval(approval.id, 'reject', reason)
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      驳回
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // 渲染预警页
  const renderAlertTab = () => (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">活跃预警</span>
        <button
          onClick={fetchAlerts}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : alerts.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无活跃预警</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {alerts.map((alert) => {
            const levelConfig = ALERT_LEVELS[alert.alert_level] || ALERT_LEVELS.warning
            const LevelIcon = levelConfig.icon
            
            return (
              <div key={alert.id} className="px-4 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${levelConfig.color}`}>
                      <LevelIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${levelConfig.color}`}>
                          {levelConfig.label}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">{alert.content}</p>
                      <span className="text-xs text-gray-400">{formatTime(alert.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleAlert(alert.id, 'handle')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      处理
                    </button>
                    <button
                      onClick={() => handleAlert(alert.id, 'ignore')}
                      className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      忽略
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // 渲染通知页
  const renderNotificationTab = () => (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">系统通知</span>
        <button
          onClick={fetchNotifications}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无通知</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                !notification.is_read ? 'bg-blue-50/30' : ''
              }`}
              onClick={() => {
                if (notification.related_type === 'approval') {
                  handleTabChange('approval')
                } else if (notification.related_type === 'alert') {
                  handleTabChange('alert')
                }
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-xs rounded ${
                  notification.type === 'approval' 
                    ? 'bg-blue-100 text-blue-600'
                    : notification.type === 'alert'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {notification.type === 'approval' ? '审批' : notification.type === 'alert' ? '预警' : '系统'}
                </span>
                <span className={`text-sm ${!notification.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                  {notification.title}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{notification.content}</p>
              <span className="text-xs text-gray-400 mt-1 block">{formatTime(notification.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="信息中心"
        icon={<MessageCircle className="w-6 h-6 text-primary-600" />}
        description={isConnected ? '实时通信已连接' : '连接中...'}
      />

      {/* Tab 导航 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                  isActive
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute top-2 right-1/4 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs bg-red-500 text-white rounded-full">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      {currentTab === 'chat' && renderChatTab()}
      {currentTab === 'approval' && renderApprovalTab()}
      {currentTab === 'alert' && renderAlertTab()}
      {currentTab === 'notification' && renderNotificationTab()}
    </div>
  )
}
