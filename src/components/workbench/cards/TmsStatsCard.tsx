import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface TmsStats {
  pending: number
  delivering: number
  delivered: number
  exception: number
}

interface TmsStatsCardProps {
  refreshKey?: number
}

export default function TmsStatsCard({ refreshKey }: TmsStatsCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [stats, setStats] = useState<TmsStats>({
    pending: 0,
    delivering: 0,
    delivered: 0,
    exception: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/cmr/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setStats({
            pending: data.data.undelivered || data.data.pending || 0,
            delivering: data.data.delivering || 0,
            delivered: data.data.delivered || data.data.archived || 0,
            exception: data.data.exception || 0,
          })
        } else {
          setStats({ pending: 0, delivering: 0, delivered: 0, exception: 0 })
        }
      } else {
        setStats({ pending: 0, delivering: 0, delivered: 0, exception: 0 })
      }
    } catch (error) {
      console.error('加载运输统计失败:', error)
      setStats({ pending: 0, delivering: 0, delivered: 0, exception: 0 })
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

  const total = stats.pending + stats.delivering + stats.delivered + stats.exception

  return (
    <div className="space-y-3">
      {/* 状态分布 */}
      <div className="grid grid-cols-2 gap-2">
        <div 
          className="p-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => navigate('/cmr-manage?type=pending')}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">待派送</span>
          </div>
          <div className="text-lg font-semibold text-gray-700">{stats.pending}</div>
        </div>
        <div 
          className="p-2.5 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/cmr-manage/delivering')}
        >
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-blue-600">派送中</span>
          </div>
          <div className="text-lg font-semibold text-blue-700">{stats.delivering}</div>
        </div>
        <div 
          className="p-2.5 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => navigate('/cmr-manage/archived')}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-600">已送达</span>
          </div>
          <div className="text-lg font-semibold text-green-700">{stats.delivered}</div>
        </div>
        <div 
          className="p-2.5 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
          onClick={() => navigate('/cmr-manage/exception')}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-600">异常</span>
          </div>
          <div className="text-lg font-semibold text-red-700">{stats.exception}</div>
        </div>
      </div>

      {/* 送达率 */}
      {total > 0 && (
        <div className="p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">送达率</span>
            <span className="text-sm font-medium text-gray-900">
              {Math.round((stats.delivered / total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${(stats.delivered / total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
