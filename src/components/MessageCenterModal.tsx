/**
 * 消息中心模态框
 * 整合聊天、审批、预警、通知功能
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { 
  X,
  MessageCircle, 
  ClipboardCheck, 
  AlertTriangle,
  Bell,
  RefreshCw,
  Check,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  Plus,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket, type Conversation } from '../contexts/SocketContext'
import { ConversationList, ChatWindow, NewChatModal } from './Chat'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

type TabType = 'chat' | 'approval' | 'alert' | 'notification'

interface MessageCenterModalProps {
  visible: boolean
  onClose: () => void
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

export default function MessageCenterModal({ visible, onClose }: MessageCenterModalProps) {
  const { user } = useAuth()
  const { onConversationUpdate, onNotification } = useSocket()
  
  const [currentTab, setCurrentTab] = useState<TabType>('chat')
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // 统计数据
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [activeAlerts, setActiveAlerts] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  
  // 列表数据
  const [approvals, setApprovals] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Tab 配置
  const tabs = [
    { id: 'chat' as TabType, label: '聊天', icon: MessageCircle, badge: unreadMessages },
    { id: 'approval' as TabType, label: '审批', icon: ClipboardCheck, badge: pendingApprovals },
    { id: 'alert' as TabType, label: '预警', icon: AlertTriangle, badge: activeAlerts },
    { id: 'notification' as TabType, label: '通知', icon: Bell, badge: unreadNotifications },
  ]

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const chatRes = await fetch(`${API_BASE}/api/chat/unread-count?userId=${user.id}`)
      const chatData = await chatRes.json()
      if (chatData.errCode === 200) {
        setUnreadMessages(chatData.data?.count || 0)
      }
      
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
  }, [user?.id])

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
      const params = new URLSearchParams({ status: 'active', pageSize: '50' })
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
      const params = new URLSearchParams({ receiverId: user.id, pageSize: '50' })
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
  const handleApproval = async (approvalId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`${API_BASE}/api/approvals/${approvalId}/process`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : 'rejected',
          approverId: user?.id,
          approverName: user?.name || user?.username
        })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        fetchApprovals()
        fetchStats()
      }
    } catch (error) {
      console.error('处理审批失败:', error)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handledBy: user?.name || user?.username })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        fetchAlerts()
        fetchStats()
      }
    } catch (error) {
      console.error('处理预警失败:', error)
    }
  }

  // 初始加载
  useEffect(() => {
    if (visible) {
      fetchStats()
    }
  }, [visible, fetchStats])

  // Tab 切换时加载数据
  useEffect(() => {
    if (!visible) return
    if (currentTab === 'approval') fetchApprovals()
    else if (currentTab === 'alert') fetchAlerts()
    else if (currentTab === 'notification') fetchNotifications()
  }, [currentTab, visible, user?.id])

  // 监听实时更新
  useEffect(() => {
    if (!visible) return
    const unsubConv = onConversationUpdate(() => fetchStats())
    const unsubNotif = onNotification(() => fetchStats())
    return () => { unsubConv(); unsubNotif() }
  }, [visible, onConversationUpdate, onNotification, fetchStats])

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return date.toLocaleDateString()
  }

  if (!visible) return null

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 99999 }}>
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 模态框 */}
      <div className="relative bg-white rounded-xl shadow-2xl flex overflow-hidden" style={{ width: 900, height: 600 }}>
        {/* 左侧 Tab 栏 */}
        {!sidebarCollapsed && (
          <div className="w-16 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-4 flex-shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = currentTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => { setCurrentTab(tab.id); setActiveConversation(null) }}
                  className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-2 transition-all ${
                    isActive 
                      ? 'bg-primary-500 text-white' 
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                  title={tab.label}
                >
                  <Icon className="w-5 h-5" />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              {/* 左侧菜单折叠按钮 */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={`p-2 rounded-lg transition-colors ${
                  sidebarCollapsed 
                    ? 'bg-primary-100 text-primary-600 hover:bg-primary-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={sidebarCollapsed ? '展开菜单' : '收起菜单'}
              >
                {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {tabs.find(t => t.id === currentTab)?.label}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {currentTab === 'chat' && (
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                  title="发起聊天"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 主内容 */}
          <div className="flex-1 overflow-hidden">
            {currentTab === 'chat' && (
              <div className="h-full flex">
                {/* 会话列表 */}
                <div className={`${activeConversation ? 'w-72 border-r border-gray-200' : 'w-full'} h-full`}>
                  <ConversationList
                    onSelect={(conv) => setActiveConversation(conv)}
                    selectedId={activeConversation?.id}
                  />
                </div>
                {/* 聊天窗口 */}
                {activeConversation && (
                  <div className="flex-1 h-full">
                    <ChatWindow
                      conversation={activeConversation}
                      onBack={() => setActiveConversation(null)}
                    />
                  </div>
                )}
              </div>
            )}

            {currentTab === 'approval' && (
              <div className="h-full overflow-y-auto p-4">
                {loading ? (
                  <div className="py-12 text-center text-gray-400">加载中...</div>
                ) : approvals.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无待审批项</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvals.map((item) => (
                      <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.title}</div>
                            <div className="text-sm text-gray-500 mt-1">{item.content}</div>
                            <div className="text-xs text-gray-400 mt-2">
                              {item.requester_name} · {formatTime(item.created_at)}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleApproval(item.id, 'approve')}
                              className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                            >
                              通过
                            </button>
                            <button
                              onClick={() => handleApproval(item.id, 'reject')}
                              className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                            >
                              驳回
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentTab === 'alert' && (
              <div className="h-full overflow-y-auto p-4">
                {loading ? (
                  <div className="py-12 text-center text-gray-400">加载中...</div>
                ) : alerts.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无活跃预警</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((item) => {
                      const levelConfig = ALERT_LEVELS[item.alert_level] || ALERT_LEVELS.warning
                      const LevelIcon = levelConfig.icon
                      return (
                        <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${levelConfig.color.split(' ')[1]}`}>
                              <LevelIcon className={`w-5 h-5 ${levelConfig.color.split(' ')[0]}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs rounded ${levelConfig.color}`}>
                                  {levelConfig.label}
                                </span>
                                <span className="font-medium text-gray-900">{item.title}</span>
                              </div>
                              <div className="text-sm text-gray-500 mt-1">{item.content}</div>
                              <div className="text-xs text-gray-400 mt-2">{formatTime(item.created_at)}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAlert(item.id, 'handle')}
                                className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                              >
                                处理
                              </button>
                              <button
                                onClick={() => handleAlert(item.id, 'ignore')}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
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
            )}

            {currentTab === 'notification' && (
              <div className="h-full overflow-y-auto p-4">
                {loading ? (
                  <div className="py-12 text-center text-gray-400">加载中...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无通知</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border cursor-pointer hover:bg-gray-50 ${
                          !item.is_read ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            item.type === 'approval' ? 'bg-blue-100 text-blue-600' :
                            item.type === 'alert' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {item.type === 'approval' ? '审批' : item.type === 'alert' ? '预警' : '系统'}
                          </span>
                          <span className={`text-sm ${!item.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                            {item.title}
                          </span>
                          {!item.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.content}</p>
                        <span className="text-xs text-gray-400 mt-1">{formatTime(item.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新建聊天弹窗 */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onCreated={(conv) => {
            setActiveConversation(conv)
            setShowNewChatModal(false)
          }}
        />
      )}
    </div>,
    document.body
  )
}
