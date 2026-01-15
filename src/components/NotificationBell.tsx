/**
 * 通知铃铛组件
 * 显示未读消息、待审批、活跃预警的数量
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '../utils/dateFormat'
import { 
  Bell, 
  MessageSquare, 
  ClipboardCheck, 
  AlertTriangle,
  ChevronRight,
  Check,
  X,
  FileQuestion
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { getCachedNotificationOverview, invalidateNotificationCache } from '../utils/apiCache'

const API_BASE = getApiBaseUrl()

interface NotificationOverview {
  unreadMessages: number
  pendingApprovals: number
  activeAlerts: number
  pendingInquiries?: number
  total: number
}

interface Message {
  id: string
  type: string
  title: string
  content: string
  is_read: number
  created_at: string
  related_type: string
  related_id: string
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [overview, setOverview] = useState<NotificationOverview>({
    unreadMessages: 0,
    pendingApprovals: 0,
    activeAlerts: 0,
    total: 0
  })
  const [recentMessages, setRecentMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 获取通知概览数据（使用缓存）
  const fetchOverview = useCallback(async (forceRefresh = false) => {
    if (!user?.id || !user?.role) return
    
    try {
      // 如果强制刷新，先清除缓存（传递角色以精确清除）
      if (forceRefresh) {
        invalidateNotificationCache(user.id, user.role)
      }
      // 传递用户角色，用于权限过滤
      const data = await getCachedNotificationOverview(user.id, API_BASE, user.role)
      if (data.errCode === 200) {
        setOverview(data.data)
      }
    } catch (error) {
      console.debug('获取通知概览失败:', error)
    }
  }, [user?.id, user?.role])

  // 获取最近消息
  const fetchRecentMessages = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/messages/recent?receiverId=${user.id}&limit=5`)
      const data = await response.json()
      if (data.errCode === 200) {
        setRecentMessages(data.data || [])
      }
    } catch (error) {
      console.error('获取最近消息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 标记消息已读
  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`${API_BASE}/api/messages/${messageId}/read`, { method: 'PUT' })
      // 清除缓存并刷新数据
      fetchOverview(true)
      fetchRecentMessages()
    } catch (error) {
      console.debug('标记已读失败:', error)
    }
  }

  // 标记全部已读
  const markAllAsRead = async () => {
    if (!user?.id) return
    
    try {
      await fetch(`${API_BASE}/api/messages/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ receiverId: user.id })
      })
      // 清除缓存并刷新数据
      fetchOverview(true)
      fetchRecentMessages()
    } catch (error) {
      console.debug('标记全部已读失败:', error)
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
      navigate(`/bookings/bill/${message.related_id}`)
    } else if (message.related_type === 'invoice') {
      navigate(`/finance/invoices/${message.related_id}`)
    } else {
      navigate('/system/messages')
    }
    
    setShowDropdown(false)
  }

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // 初始加载和定时刷新（仅在页面可见时轮询）
  useEffect(() => {
    fetchOverview()
    
    let interval: ReturnType<typeof setInterval> | null = null
    
    // 页面可见性变化处理
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面不可见，停止轮询
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      } else {
        // 页面变为可见，立即刷新并恢复轮询
        fetchOverview(true) // 强制刷新
        if (!interval) {
          interval = setInterval(() => fetchOverview(true), 60000)
        }
      }
    }
    
    // 初始设置轮询（每60秒刷新一次）
    if (!document.hidden) {
      interval = setInterval(() => fetchOverview(true), 60000)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id, fetchOverview])

  // 展开时加载最近消息
  useEffect(() => {
    if (showDropdown) {
      fetchRecentMessages()
    }
  }, [showDropdown])

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    
    return formatDate(dateStr)
  }

  // 获取消息类型图标和颜色
  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'approval':
        return { icon: ClipboardCheck, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' }
      case 'alert':
        return { icon: AlertTriangle, bgColor: 'bg-red-100', iconColor: 'text-red-600' }
      default:
        return { icon: MessageSquare, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' }
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 铃铛按钮 */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="通知中心"
      >
        <Bell className="w-5 h-5" />
        {overview.total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
            {overview.total > 99 ? '99+' : overview.total}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {showDropdown && (
        <div className="fixed right-4 top-14 lg:top-16 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[100]">
          {/* 头部 */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">通知中心</h3>
            {overview.unreadMessages > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                全部已读
              </button>
            )}
          </div>

          {/* 统计概览 */}
          <div className="grid grid-cols-4 gap-2 p-3 border-b border-gray-100">
            <button
              onClick={() => { navigate('/system/messages'); setShowDropdown(false) }}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-lg font-semibold text-gray-900">{overview.unreadMessages}</span>
              </div>
              <span className="text-xs text-gray-500">消息</span>
            </button>
            <button
              onClick={() => { navigate('/crm/quotations'); setShowDropdown(false) }}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-1">
                <FileQuestion className="w-4 h-4 text-amber-500" />
                <span className="text-lg font-semibold text-gray-900">{overview.pendingInquiries || 0}</span>
              </div>
              <span className="text-xs text-gray-500">询价</span>
            </button>
            <button
              onClick={() => { navigate('/system/approvals'); setShowDropdown(false) }}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-1">
                <ClipboardCheck className="w-4 h-4 text-orange-500" />
                <span className="text-lg font-semibold text-gray-900">{overview.pendingApprovals}</span>
              </div>
              <span className="text-xs text-gray-500">审批</span>
            </button>
            <button
              onClick={() => { navigate('/system/alerts'); setShowDropdown(false) }}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-lg font-semibold text-gray-900">{overview.activeAlerts}</span>
              </div>
              <span className="text-xs text-gray-500">预警</span>
            </button>
          </div>

          {/* 最近消息列表 */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-gray-400 text-sm">加载中...</div>
            ) : recentMessages.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">暂无新消息</div>
            ) : (
              recentMessages.map((message) => {
                const style = getMessageStyle(message.type)
                const Icon = style.icon
                return (
                  <div
                    key={message.id}
                    onClick={() => handleMessageClick(message)}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${
                      !message.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 ${style.bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${style.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${!message.is_read ? 'font-medium text-gray-900' : 'text-gray-700'} truncate`}>
                          {message.title}
                        </span>
                        {!message.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{message.content}</p>
                      <span className="text-xs text-gray-400 mt-1">{formatTime(message.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* 底部 */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => { navigate('/system/messages'); setShowDropdown(false) }}
              className="w-full text-center text-sm text-primary-600 hover:text-primary-700 py-1 flex items-center justify-center gap-1"
            >
              查看全部消息
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
