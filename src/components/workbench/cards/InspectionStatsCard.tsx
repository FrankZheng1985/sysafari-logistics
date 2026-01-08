import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Clock, CheckCircle, Shield } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface InspectionStats {
  pending: number
  inspecting: number
  released: number
  total: number
}

interface InspectionStatsCardProps {
  refreshKey?: number
}

export default function InspectionStatsCard({ refreshKey }: InspectionStatsCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [stats, setStats] = useState<InspectionStats>({
    pending: 0,
    inspecting: 0,
    released: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      // 使用工作台专用API
      const response = await fetch(`${API_BASE}/api/workbench/inspection-stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setStats({
            pending: data.data.pending || 0,
            inspecting: data.data.inspecting || 0,
            released: data.data.released || 0,
            total: data.data.total || 0,
          })
        } else {
          setStats({ pending: 0, inspecting: 0, released: 0, total: 0 })
        }
      } else {
        setStats({ pending: 0, inspecting: 0, released: 0, total: 0 })
      }
    } catch (error) {
      console.error('加载查验统计失败:', error)
      setStats({ pending: 0, inspecting: 0, released: 0, total: 0 })
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
      {/* 状态分布 */}
      <div className="grid grid-cols-3 gap-2">
        <div 
          className="p-2 bg-amber-50 rounded-lg text-center cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/inspection/pending')}
        >
          <Clock className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <div className="text-lg font-semibold text-amber-700">{stats.pending}</div>
          <div className="text-xs text-amber-600">待查验</div>
        </div>
        <div 
          className="p-2 bg-blue-50 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/inspection/pending')}
        >
          <Shield className="w-4 h-4 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-semibold text-blue-700">{stats.inspecting}</div>
          <div className="text-xs text-blue-600">查验中</div>
        </div>
        <div 
          className="p-2 bg-green-50 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => navigate('/inspection/released')}
        >
          <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <div className="text-lg font-semibold text-green-700">{stats.released}</div>
          <div className="text-xs text-green-600">已放行</div>
        </div>
      </div>

      {/* 放行率 */}
      {stats.total > 0 && (
        <div className="p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">放行率</span>
            <span className="text-sm font-medium text-gray-900">
              {Math.round((stats.released / stats.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="h-1.5 rounded-full bg-green-500 transition-all"
              style={{ width: `${(stats.released / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
