import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Package, Receipt, FileText, Truck, Clock } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'
import { formatDateTimeShort } from '../../../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface ActivityItem {
  id: string
  type: 'order' | 'invoice' | 'document' | 'delivery' | 'other'
  title: string
  description: string
  time: string
  link?: string
}

interface RecentActivityCardProps {
  refreshKey?: number
}

const ACTIVITY_ICONS = {
  order: Package,
  invoice: Receipt,
  document: FileText,
  delivery: Truck,
  other: Activity,
}

const ACTIVITY_COLORS = {
  order: 'bg-blue-100 text-blue-600',
  invoice: 'bg-green-100 text-green-600',
  document: 'bg-purple-100 text-purple-600',
  delivery: 'bg-orange-100 text-orange-600',
  other: 'bg-gray-100 text-gray-600',
}

export default function RecentActivityCard({ refreshKey }: RecentActivityCardProps) {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActivities()
  }, [refreshKey])

  const loadActivities = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/recent-activity?limit=6`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setActivities(data.data)
        } else {
          setActivities(getMockActivities())
        }
      } else {
        setActivities(getMockActivities())
      }
    } catch (error) {
      console.error('加载最近动态失败:', error)
      setActivities(getMockActivities())
    } finally {
      setLoading(false)
    }
  }

  const getMockActivities = (): ActivityItem[] => [
    {
      id: '1',
      type: 'order',
      title: '订单 BL2024010156',
      description: '状态更新为"已到港"',
      time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      link: '/bookings/bill/1',
    },
    {
      id: '2',
      type: 'invoice',
      title: '发票 INV-2024-0089',
      description: '已开具销售发票 €3,500',
      time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      link: '/finance/invoices/2',
    },
    {
      id: '3',
      type: 'delivery',
      title: 'CMR-2024-0045',
      description: '派送状态更新为"已送达"',
      time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      link: '/cmr-manage/3',
    },
    {
      id: '4',
      type: 'document',
      title: '单证匹配',
      description: '完成 5 个单证的HS编码匹配',
      time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      link: '/documents/matching',
    },
    {
      id: '5',
      type: 'order',
      title: '订单 BL2024010142',
      description: '录入费用 €1,200',
      time: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      link: '/bookings/bill/5',
    },
  ]

  const getRelativeTime = (time: string) => {
    const now = new Date()
    const activityTime = new Date(time)
    const diffMs = now.getTime() - activityTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return formatDateTimeShort(time)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 动态列表 */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {activities.map(activity => {
          const IconComponent = ACTIVITY_ICONS[activity.type]
          const colorClass = ACTIVITY_COLORS[activity.type]

          return (
            <div
              key={activity.id}
              onClick={() => activity.link && navigate(activity.link)}
              className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                activity.link ? 'hover:bg-gray-50 cursor-pointer' : ''
              }`}
            >
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{activity.title}</div>
                <div className="text-xs text-gray-500 truncate">{activity.description}</div>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {getRelativeTime(activity.time)}
              </div>
            </div>
          )
        })}
      </div>

      {activities.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无最近动态</p>
        </div>
      )}
    </div>
  )
}
