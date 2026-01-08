import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, Info, CheckCircle, ChevronRight, Clock } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'
import { formatDateTimeShort } from '../../../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface Notification {
  id: string
  type: 'warning' | 'info' | 'success' | 'alert'
  title: string
  message: string
  time: string
  read: boolean
  link?: string
}

interface NotificationsCardProps {
  refreshKey?: number
}

const NOTIFICATION_ICONS = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  alert: Bell,
}

const NOTIFICATION_COLORS = {
  warning: 'bg-amber-100 text-amber-600',
  info: 'bg-blue-100 text-blue-600',
  success: 'bg-green-100 text-green-600',
  alert: 'bg-red-100 text-red-600',
}

export default function NotificationsCard({ refreshKey }: NotificationsCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [refreshKey])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/messages/list?pageSize=5&unreadOnly=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data?.list) {
          const mappedNotifications = data.data.list.map((msg: any) => ({
            id: msg.id,
            type: msg.type === 'warning' ? 'warning' : 
                  msg.type === 'alert' ? 'alert' :
                  msg.type === 'success' ? 'success' : 'info',
            title: msg.title,
            message: msg.content || msg.message,
            time: msg.createdAt || msg.time,
            read: msg.isRead || msg.read,
            link: msg.link,
          }))
          setNotifications(mappedNotifications)
        } else {
          setNotifications(getMockNotifications())
        }
      } else {
        setNotifications(getMockNotifications())
      }
    } catch (error) {
      console.error('加载通知失败:', error)
      setNotifications(getMockNotifications())
    } finally {
      setLoading(false)
    }
  }

  const getMockNotifications = (): Notification[] => [
    {
      id: '1',
      type: 'alert',
      title: '逾期提醒',
      message: '3张发票已逾期，请尽快处理',
      time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      read: false,
      link: '/finance/invoices?status=overdue',
    },
    {
      id: '2',
      type: 'warning',
      title: '运输异常',
      message: '订单 BL2024010123 派送异常',
      time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      read: false,
      link: '/tms/exceptions',
    },
    {
      id: '3',
      type: 'info',
      title: '系统通知',
      message: '新功能上线：工作台自定义',
      time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
    {
      id: '4',
      type: 'success',
      title: '收款确认',
      message: '客户A公司已付款 €5,000',
      time: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      read: true,
      link: '/finance/payments',
    },
  ]

  const getRelativeTime = (time: string) => {
    const now = new Date()
    const notifTime = new Date(time)
    const diffMs = now.getTime() - notifTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return formatDateTimeShort(time)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 未读数量 */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {unreadCount} 条未读消息
          </span>
          <button
            onClick={() => navigate('/system/messages')}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            全部已读
          </button>
        </div>
      )}

      {/* 通知列表 */}
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {notifications.map(notification => {
          const IconComponent = NOTIFICATION_ICONS[notification.type]
          const colorClass = NOTIFICATION_COLORS[notification.type]

          return (
            <div
              key={notification.id}
              onClick={() => notification.link && navigate(notification.link)}
              className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                notification.link ? 'hover:bg-gray-50 cursor-pointer' : ''
              } ${!notification.read ? 'bg-blue-50/50' : ''}`}
            >
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                    {notification.title}
                  </span>
                  {!notification.read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">{notification.message}</div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Clock className="w-3 h-3" />
                  {getRelativeTime(notification.time)}
                </div>
              </div>
              {notification.link && (
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
              )}
            </div>
          )
        })}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无新通知</p>
        </div>
      )}

      {/* 查看全部 */}
      <button
        onClick={() => navigate('/system/messages')}
        className="w-full py-2 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
      >
        查看全部消息 →
      </button>
    </div>
  )
}
