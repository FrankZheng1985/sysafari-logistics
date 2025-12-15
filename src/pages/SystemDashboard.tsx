import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Truck, Users, DollarSign,
  FileText, TrendingUp, Clock, CheckCircle,
  AlertTriangle, ArrowUpRight, RefreshCw,
  ChevronRight, Activity, BarChart3, Lock
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// 模块权限配置
const MODULE_PERMISSIONS = {
  order: ['bill:view', 'bill:view_all', 'bill:create'],
  tms: ['cmr:view', 'cmr:operate'],
  crm: ['crm:view', 'crm:manage'],
  finance: ['finance:view', 'finance:manage'],
  inspection: ['inspection:view', 'inspection:operate'],
}

interface DashboardStats {
  orders: {
    total: number
    pending: number
    inProgress: number
    completed: number
    trend: number
  }
  tms: {
    pending: number
    delivering: number
    delivered: number
    exception: number
  }
  crm: {
    customers: number
    opportunities: number
    wonAmount: number
    pendingFeedbacks: number
  }
  finance: {
    receivable: number
    payable: number
    netCashFlow: number
    totalFees: number
  }
}

interface RecentActivity {
  id: string
  type: 'order' | 'tms' | 'crm' | 'finance'
  action: string
  description: string
  time: string
  user: string
}

export default function SystemDashboard() {
  const navigate = useNavigate()
  const { hasAnyPermission, isAdmin, isManager } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())

  // 检查模块访问权限
  const canAccessModule = (module: keyof typeof MODULE_PERMISSIONS): boolean => {
    if (isAdmin() || isManager()) return true
    return hasAnyPermission(MODULE_PERMISSIONS[module])
  }

  // 处理卡片点击
  const handleCardClick = (module: keyof typeof MODULE_PERMISSIONS, path: string) => {
    if (canAccessModule(module)) {
      navigate(path)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    
    // 更新时间
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    
    return () => clearInterval(timer)
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // 并行获取各模块数据
      const [billStatsRes, cmrRes, financeRes, customerRes, opportunityRes, feedbackRes] = await Promise.all([
        fetch('/api/bills/stats').then(r => r.json()).catch(() => ({ data: {} })),
        fetch('/api/cmr/stats').then(r => r.json()).catch(() => ({ data: {} })),
        fetch('/api/finance/overview').then(r => r.json()).catch(() => ({ data: {} })),
        fetch('/api/customers/stats').then(r => r.json()).catch(() => ({ data: { total: 0 } })),
        fetch('/api/opportunities/stats').then(r => r.json()).catch(() => ({ data: { total: 0, wonValue: 0 } })),
        fetch('/api/feedbacks/stats').then(r => r.json()).catch(() => ({ data: { byStatus: { open: 0, processing: 0 } } }))
      ])

      // 从 /api/bills/stats 获取真实统计数据
      const billStats = billStatsRes.data || {}
      // 订单状态分布：
      // - 待处理: 未到港 + 未清关
      // - 进行中: 已到港(未清关) + 查验中 + 派送中
      // - 已完成: 已送达
      const pending = (billStats.notArrived || 0) + (billStats.notCleared || 0)
      const inProgress = (billStats.inspecting || 0) + (billStats.delivering || 0)
      const completed = billStats.delivered || 0
      const total = billStats.total || billStats.active || 0

      // 构建统计数据
      const dashboardStats: DashboardStats = {
        orders: {
          total: total,
          pending: pending,
          inProgress: inProgress,
          completed: completed,
          trend: 0 // 趋势需要历史数据计算，暂时设为0
        },
        tms: {
          pending: cmrRes.data?.undelivered || cmrRes.data?.pending || 0,
          delivering: cmrRes.data?.delivering || 0,
          delivered: cmrRes.data?.archived || cmrRes.data?.delivered || 0,
          exception: cmrRes.data?.exception || 0
        },
        crm: {
          customers: customerRes.data?.totalCount || customerRes.data?.total || 0,
          opportunities: opportunityRes.data?.totalCount || opportunityRes.data?.total || 0,
          wonAmount: opportunityRes.data?.wonAmount || opportunityRes.data?.wonValue || 0,
          pendingFeedbacks: (feedbackRes.data?.pendingCount || feedbackRes.data?.byStatus?.open || 0) + (feedbackRes.data?.processingCount || feedbackRes.data?.byStatus?.processing || 0)
        },
        finance: {
          receivable: financeRes.data?.summary?.receivable || 0,
          payable: financeRes.data?.summary?.payable || 0,
          netCashFlow: financeRes.data?.summary?.netCashFlow || 0,
          totalFees: financeRes.data?.summary?.totalFees || 0
        }
      }

      setStats(dashboardStats)

      // 清空最近活动（需要从数据库获取真实操作日志，暂时置空）
      setRecentActivities([])

    } catch (error) {
      console.error('获取仪表盘数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return <Package className="w-4 h-4 text-blue-500" />
      case 'tms': return <Truck className="w-4 h-4 text-green-500" />
      case 'crm': return <Users className="w-4 h-4 text-purple-500" />
      case 'finance': return <DollarSign className="w-4 h-4 text-amber-500" />
      default: return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-primary-600" />
            系统概览
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {currentTime.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          刷新数据
        </button>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 订单管理 */}
        <div 
          className={`bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white transition-all relative ${
            canAccessModule('order') ? 'cursor-pointer hover:shadow-lg' : 'opacity-80'
          }`}
          onClick={() => handleCardClick('order', '/bookings/bill')}
        >
          {!canAccessModule('order') && (
            <div className="absolute top-2 right-2">
              <Lock className="w-4 h-4 text-white/60" />
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-blue-100 text-sm mb-1">订单管理</div>
              <div className="text-3xl font-bold">{stats?.orders.total || 0}</div>
              <div className="mt-3 flex items-center gap-4 text-xs text-blue-100">
                <span>待处理: {stats?.orders.pending}</span>
                <span>进行中: {stats?.orders.inProgress}</span>
              </div>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
          </div>
          {stats?.orders.trend && stats.orders.trend > 0 && (
            <div className="mt-3 flex items-center gap-1 text-xs text-blue-100">
              <ArrowUpRight className="w-3 h-3" />
              较上周增长 {stats.orders.trend}%
            </div>
          )}
        </div>

        {/* TMS运输 */}
        <div 
          className={`bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white transition-all relative ${
            canAccessModule('tms') ? 'cursor-pointer hover:shadow-lg' : 'opacity-80'
          }`}
          onClick={() => handleCardClick('tms', '/tms')}
        >
          {!canAccessModule('tms') && (
            <div className="absolute top-2 right-2">
              <Lock className="w-4 h-4 text-white/60" />
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-emerald-100 text-sm mb-1">TMS运输</div>
              <div className="text-3xl font-bold">{(stats?.tms.pending || 0) + (stats?.tms.delivering || 0)}</div>
              <div className="mt-3 flex items-center gap-4 text-xs text-emerald-100">
                <span>待派送: {stats?.tms.pending}</span>
                <span>派送中: {stats?.tms.delivering}</span>
              </div>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <Truck className="w-6 h-6" />
            </div>
          </div>
          {stats?.tms.exception && stats.tms.exception > 0 && (
            <div className="mt-3 flex items-center gap-1 text-xs text-yellow-200">
              <AlertTriangle className="w-3 h-3" />
              {stats.tms.exception} 个异常订单需处理
            </div>
          )}
        </div>

        {/* CRM客户 */}
        <div 
          className={`bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white transition-all relative ${
            canAccessModule('crm') ? 'cursor-pointer hover:shadow-lg' : 'opacity-80'
          }`}
          onClick={() => handleCardClick('crm', '/crm')}
        >
          {!canAccessModule('crm') && (
            <div className="absolute top-2 right-2">
              <Lock className="w-4 h-4 text-white/60" />
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-purple-100 text-sm mb-1">CRM客户</div>
              <div className="text-3xl font-bold">{stats?.crm.customers || 0}</div>
              <div className="mt-3 flex items-center gap-4 text-xs text-purple-100">
                <span>机会: {stats?.crm.opportunities}</span>
                <span>成交: {formatCurrency(stats?.crm.wonAmount || 0)}</span>
              </div>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
          </div>
          {stats?.crm.pendingFeedbacks && stats.crm.pendingFeedbacks > 0 && (
            <div className="mt-3 flex items-center gap-1 text-xs text-purple-100">
              <Clock className="w-3 h-3" />
              {stats.crm.pendingFeedbacks} 个待处理反馈
            </div>
          )}
        </div>

        {/* 财务管理 */}
        <div 
          className={`bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white transition-all relative ${
            canAccessModule('finance') ? 'cursor-pointer hover:shadow-lg' : 'opacity-80'
          }`}
          onClick={() => handleCardClick('finance', '/finance')}
        >
          {!canAccessModule('finance') && (
            <div className="absolute top-2 right-2">
              <Lock className="w-4 h-4 text-white/60" />
            </div>
          )}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-amber-100 text-sm mb-1">财务管理</div>
              <div className="text-2xl font-bold">{formatCurrency(stats?.finance.netCashFlow || 0)}</div>
              <div className="mt-3 flex items-center gap-4 text-xs text-amber-100">
                <span>应收: {formatCurrency(stats?.finance.receivable || 0)}</span>
              </div>
            </div>
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-amber-100">
            应付: {formatCurrency(stats?.finance.payable || 0)}
          </div>
        </div>
      </div>

      {/* 中间区域 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 快捷入口 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            快捷入口
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '提单管理', path: '/bookings/bill', icon: FileText, color: 'bg-blue-50 text-blue-600', module: 'order' as const },
              { label: 'CMR管理', path: '/cmr-manage', icon: Truck, color: 'bg-green-50 text-green-600', module: 'tms' as const },
              { label: '客户管理', path: '/crm/customers', icon: Users, color: 'bg-purple-50 text-purple-600', module: 'crm' as const },
              { label: '财务报表', path: '/finance/reports', icon: BarChart3, color: 'bg-amber-50 text-amber-600', module: 'finance' as const },
              { label: '查验明细', path: '/inspection-overview', icon: CheckCircle, color: 'bg-cyan-50 text-cyan-600', module: 'inspection' as const },
              { label: '服务商', path: '/tms/service-providers', icon: Package, color: 'bg-pink-50 text-pink-600', module: 'tms' as const },
            ].filter(item => canAccessModule(item.module)).map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all text-left"
                >
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-gray-700">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 订单状态分布 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            订单状态分布
          </h3>
          <div className="space-y-3">
            {[
              { label: '待处理', count: stats?.orders.pending || 0, color: 'bg-yellow-500', total: stats?.orders.total || 1 },
              { label: '进行中', count: stats?.orders.inProgress || 0, color: 'bg-blue-500', total: stats?.orders.total || 1 },
              { label: '已完成', count: stats?.orders.completed || 0, color: 'bg-green-500', total: stats?.orders.total || 1 },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} transition-all duration-500`}
                    style={{ width: `${(item.count / item.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* TMS状态 */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-3">TMS派送状态</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{stats?.tms.pending || 0}</div>
                <div className="text-xs text-gray-500">待派送</div>
              </div>
              <div className="flex-1 text-center p-2 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{stats?.tms.delivering || 0}</div>
                <div className="text-xs text-gray-500">派送中</div>
              </div>
              <div className="flex-1 text-center p-2 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{stats?.tms.delivered || 0}</div>
                <div className="text-xs text-gray-500">已送达</div>
              </div>
              <div className="flex-1 text-center p-2 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">{stats?.tms.exception || 0}</div>
                <div className="text-xs text-gray-500">异常</div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近活动 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              最近活动
            </h3>
            <button 
              className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
              onClick={() => navigate('/system/activity-logs')}
            >
              查看全部
            </button>
          </div>
          <div className="space-y-3">
            {recentActivities.map(activity => (
              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="p-1.5 bg-gray-100 rounded-lg">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{activity.action}</span>
                    <span className="text-xs text-gray-400">{activity.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 border border-primary-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">系统运行正常</div>
              <div className="text-xs text-gray-500">所有模块运行状态良好，数据同步正常</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/system/menu-settings')}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            系统设置 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

