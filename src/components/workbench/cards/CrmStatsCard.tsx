import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Target, TrendingUp, Star } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface CrmStats {
  totalCustomers: number
  vipCustomers: number
  activeOpportunities: number
  pipelineValue: number
  winRate: number
}

interface CrmStatsCardProps {
  refreshKey?: number
}

export default function CrmStatsCard({ refreshKey }: CrmStatsCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [stats, setStats] = useState<CrmStats>({
    totalCustomers: 0,
    vipCustomers: 0,
    activeOpportunities: 0,
    pipelineValue: 0,
    winRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [refreshKey])

  const loadStats = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const [custRes, oppRes] = await Promise.all([
        fetch(`${API_BASE}/api/customers/stats`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/opportunities/stats`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ])

      let customerData = null
      let opportunityData = null

      if (custRes.ok) {
        const data = await custRes.json()
        if (data.errCode === 200) customerData = data.data
      }

      if (oppRes.ok) {
        const data = await oppRes.json()
        if (data.errCode === 200) opportunityData = data.data
      }

      setStats({
        totalCustomers: customerData?.total || 0,
        vipCustomers: customerData?.byLevel?.vip || 0,
        activeOpportunities: opportunityData?.total || 0,
        pipelineValue: opportunityData?.pipelineValue || 0,
        winRate: typeof opportunityData?.winRate === 'string' 
          ? parseFloat(opportunityData.winRate) 
          : (opportunityData?.winRate || 0),
      })
    } catch (error) {
      console.error('加载CRM统计失败:', error)
      setStats({
        totalCustomers: 0,
        vipCustomers: 0,
        activeOpportunities: 0,
        pipelineValue: 0,
        winRate: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `€${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `€${(amount / 1000).toFixed(0)}K`
    }
    return `€${amount}`
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
      {/* 客户统计 */}
      <div className="grid grid-cols-2 gap-2">
        <div 
          className="p-2.5 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
          onClick={() => navigate('/crm/customers')}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-blue-600">客户总数</span>
          </div>
          <div className="text-lg font-semibold text-blue-700">{stats.totalCustomers}</div>
        </div>
        <div 
          className="p-2.5 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/crm/customers?level=vip')}
        >
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-600">VIP客户</span>
          </div>
          <div className="text-lg font-semibold text-amber-700">{stats.vipCustomers}</div>
        </div>
      </div>

      {/* 商机统计 */}
      <div 
        className="p-2.5 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
        onClick={() => navigate('/crm/opportunities')}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600">进行中商机</span>
            </div>
            <div className="text-lg font-semibold text-green-700">{stats.activeOpportunities}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">管道价值</div>
            <div className="text-sm font-medium text-gray-900">{formatCurrency(stats.pipelineValue)}</div>
          </div>
        </div>
      </div>

      {/* 转化率 */}
      {stats.winRate > 0 && (
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-600">商机转化率</span>
          </div>
          <span className="text-sm font-medium text-green-600">{stats.winRate}%</span>
        </div>
      )}
    </div>
  )
}
