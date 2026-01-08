import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface OrderStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  todayNew: number
}

interface OrderStatsCardProps {
  refreshKey?: number
}

export default function OrderStatsCard({ refreshKey }: OrderStatsCardProps) {
  const navigate = useNavigate()
  const { getAccessToken, isManager, isAdmin } = useAuth()
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    todayNew: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      // 使用专门的订单统计 API
      const res = await fetch(`${API_BASE}/api/workbench/order-stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.errCode === 200 && data.data) {
          setStats({
            total: data.data.total || 0,
            pending: data.data.pending || 0,
            inProgress: data.data.inProgress || 0,
            completed: data.data.completed || 0,
            todayNew: data.data.todayNew || 0,
          })
        }
      }
    } catch (error) {
      console.error('加载订单统计失败:', error)
      setStats({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        todayNew: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 主要指标 */}
      <div 
        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
        onClick={() => navigate('/bookings/bill')}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs text-blue-600">
              {isManager() || isAdmin() ? '全部订单' : '我的订单'}
            </div>
            <div className="text-xl font-bold text-blue-700">{stats.total}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">+{stats.todayNew}</span>
          </div>
          <div className="text-xs text-gray-500">今日新增</div>
        </div>
      </div>

      {/* 状态分布 */}
      <div className="grid grid-cols-3 gap-2">
        <div 
          className="p-2 bg-amber-50 rounded-lg text-center cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/bookings/bill?status=pending')}
        >
          <Clock className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <div className="text-lg font-semibold text-amber-700">{stats.pending}</div>
          <div className="text-xs text-amber-600">待处理</div>
        </div>
        <div 
          className="p-2 bg-blue-50 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/bookings/bill?status=in_progress')}
        >
          <Package className="w-4 h-4 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-semibold text-blue-700">{stats.inProgress}</div>
          <div className="text-xs text-blue-600">进行中</div>
        </div>
        <div 
          className="p-2 bg-green-50 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => navigate('/bp-view/history')}
        >
          <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <div className="text-lg font-semibold text-green-700">{stats.completed}</div>
          <div className="text-xs text-green-600">已完成</div>
        </div>
      </div>
    </div>
  )
}
