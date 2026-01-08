import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, TrendingUp, TrendingDown, Users, Package, 
  Receipt, ArrowUpRight, ArrowDownRight 
} from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface CompanyStats {
  monthlyOrders: number
  monthlyOrdersGrowth: number
  monthlyRevenue: number
  monthlyRevenueGrowth: number
  totalCustomers: number
  newCustomers: number
  orderCompletionRate: number
  customerSatisfaction: number
}

interface CompanyOverviewCardProps {
  refreshKey?: number
}

export default function CompanyOverviewCard({ refreshKey }: CompanyOverviewCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [stats, setStats] = useState<CompanyStats>({
    monthlyOrders: 0,
    monthlyOrdersGrowth: 0,
    monthlyRevenue: 0,
    monthlyRevenueGrowth: 0,
    totalCustomers: 0,
    newCustomers: 0,
    orderCompletionRate: 0,
    customerSatisfaction: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCompanyStats()
  }, [refreshKey])

  const loadCompanyStats = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/company-overview`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setStats(data.data)
        } else {
          setStats(getEmptyStats())
        }
      } else {
        setStats(getEmptyStats())
      }
    } catch (error) {
      console.error('加载公司概览失败:', error)
      setStats(getEmptyStats())
    } finally {
      setLoading(false)
    }
  }

  const getEmptyStats = (): CompanyStats => ({
    monthlyOrders: 0,
    monthlyOrdersGrowth: 0,
    monthlyRevenue: 0,
    monthlyRevenueGrowth: 0,
    totalCustomers: 0,
    newCustomers: 0,
    orderCompletionRate: 0,
    customerSatisfaction: 0,
  })

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
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 本月订单 */}
        <div 
          className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/bookings/bill')}
        >
          <div className="flex items-center justify-between mb-1">
            <Package className="w-5 h-5 text-blue-200" />
            {stats.monthlyOrdersGrowth >= 0 ? (
              <div className="flex items-center gap-0.5 text-green-200">
                <ArrowUpRight className="w-3 h-3" />
                <span className="text-xs">+{stats.monthlyOrdersGrowth}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 text-red-200">
                <ArrowDownRight className="w-3 h-3" />
                <span className="text-xs">{stats.monthlyOrdersGrowth}%</span>
              </div>
            )}
          </div>
          <div className="text-2xl font-bold">{stats.monthlyOrders}</div>
          <div className="text-xs text-blue-200">本月订单</div>
        </div>

        {/* 本月收入 */}
        <div 
          className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/finance/reports')}
        >
          <div className="flex items-center justify-between mb-1">
            <Receipt className="w-5 h-5 text-green-200" />
            {stats.monthlyRevenueGrowth >= 0 ? (
              <div className="flex items-center gap-0.5 text-green-200">
                <ArrowUpRight className="w-3 h-3" />
                <span className="text-xs">+{stats.monthlyRevenueGrowth}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 text-red-200">
                <ArrowDownRight className="w-3 h-3" />
                <span className="text-xs">{stats.monthlyRevenueGrowth}%</span>
              </div>
            )}
          </div>
          <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
          <div className="text-xs text-green-200">本月收入</div>
        </div>

        {/* 客户总数 */}
        <div 
          className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/crm/customers')}
        >
          <div className="flex items-center justify-between mb-1">
            <Users className="w-5 h-5 text-purple-200" />
            <div className="flex items-center gap-0.5 text-green-200">
              <ArrowUpRight className="w-3 h-3" />
              <span className="text-xs">+{stats.newCustomers}</span>
            </div>
          </div>
          <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          <div className="text-xs text-purple-200">客户总数</div>
        </div>

        {/* 订单完成率 */}
        <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
          <div className="flex items-center justify-between mb-1">
            <TrendingUp className="w-5 h-5 text-orange-200" />
            <span className="text-xs text-orange-200">目标: 95%</span>
          </div>
          <div className="text-2xl font-bold">{stats.orderCompletionRate}%</div>
          <div className="text-xs text-orange-200">完成率</div>
        </div>
      </div>

      {/* KPI 指标 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">订单完成率</span>
            <span className="text-sm font-medium text-gray-900">{stats.orderCompletionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                stats.orderCompletionRate >= 90 ? 'bg-green-500' :
                stats.orderCompletionRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${stats.orderCompletionRate}%` }}
            />
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">客户满意度</span>
            <span className="text-sm font-medium text-gray-900">{stats.customerSatisfaction}/5.0</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <div
                key={star}
                className={`w-4 h-4 rounded-sm ${
                  star <= Math.floor(stats.customerSatisfaction) 
                    ? 'bg-amber-400' 
                    : star - 0.5 <= stats.customerSatisfaction
                      ? 'bg-gradient-to-r from-amber-400 to-gray-200'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/finance/reports')}
          className="flex-1 px-3 py-2 text-xs text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
        >
          查看详细报表
        </button>
        <button
          onClick={() => navigate('/system/activity-logs')}
          className="flex-1 px-3 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          系统活动日志
        </button>
      </div>
    </div>
  )
}
