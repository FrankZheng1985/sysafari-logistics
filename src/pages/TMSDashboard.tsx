import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Truck, Package, Clock, CheckCircle, AlertTriangle, XCircle,
  TrendingUp, MapPin, Users, Calendar, ChevronRight,
  RefreshCw, ArrowUpRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface StepDistribution {
  step1: number
  step2: number
  step3: number
  step4: number
  step5: number
}

interface CMRStats {
  pending: number
  delivering: number
  delivered: number
  exception: number
  closed: number
  stepDistribution?: StepDistribution
}

interface RecentDelivery {
  id: string
  billNumber: string
  consignee: string
  deliveryStatus: string
  placeOfDelivery: string
  cmrCurrentStep: number
  updateTime: string
}

interface ServiceProvider {
  id: string
  providerName: string
  serviceType: string
  status: string
}

export default function TMSDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CMRStats | null>(null)
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>([])
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [todayStats, setTodayStats] = useState({
    started: 0,
    completed: 0,
    exceptions: 0
  })

  const tabs = [
    { label: 'TMS概览', path: '/tms' },
    { label: 'CMR管理', path: '/cmr-manage' },
    { label: '服务商管理', path: '/tms/service-providers' },
    { label: '运费管理', path: '/tms/pricing' },
  ]

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes, deliveringRes, providersRes] = await Promise.all([
        fetch(`${API_BASE}/api/cmr/stats`),
        fetch(`${API_BASE}/api/cmr/list?type=delivering&pageSize=5`),
        fetch(`${API_BASE}/api/service-providers?pageSize=5&status=active`)
      ])

      const [statsData, deliveringData, providersData] = await Promise.all([
        statsRes.json(),
        deliveringRes.json(),
        providersRes.json()
      ])

      if (statsData.errCode === 200) {
        // 映射API字段到前端期望的字段名
        setStats({
          pending: statsData.data?.undelivered || statsData.data?.pending || 0,
          delivering: statsData.data?.delivering || 0,
          delivered: statsData.data?.delivered || statsData.data?.archived || 0,
          exception: statsData.data?.exception || 0,
          closed: statsData.data?.closed || 0,
          stepDistribution: statsData.data?.stepDistribution
        })
      }
      
      if (deliveringData.errCode === 200) {
        setRecentDeliveries(deliveringData.data?.list || [])
      }
      
      if (providersData.errCode === 200) {
        setServiceProviders(providersData.data?.list || [])
      }

      // 今日统计使用实际数据（基于当前派送状态）
      setTodayStats({
        started: statsData.data?.delivering || 0,  // 派送中的数量
        completed: statsData.data?.delivered || 0,  // 已送达的数量
        exceptions: statsData.data?.exception || 0  // 异常数量
      })

    } catch (error) {
      console.error('获取TMS数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStepLabel = (step: number) => {
    const steps = ['未开始', '已提货', '运输中', '已到达', '卸货中', '已送达']
    return steps[step] || '未知'
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof Truck }> = {
      '未派送': { label: '待派送', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
      '派送中': { label: '派送中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Truck },
      '已送达': { label: '已送达', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      '订单异常': { label: '异常', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
      '异常关闭': { label: '已关闭', color: 'text-gray-400', bg: 'bg-gray-50', icon: XCircle },
    }
    return configs[status] || configs['未派送']
  }

  if (loading) {
    return (
      <div className="p-4">
        <PageHeader
          title="TMS运输管理"
          tabs={tabs}
          activeTab="/tms"
          onTabChange={(path) => navigate(path)}
        />
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="TMS运输管理"
        tabs={tabs}
        activeTab="/tms"
        onTabChange={(path) => navigate(path)}
      />

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 待派送 */}
        <div 
          className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/cmr-manage?type=pending')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-gray-100 text-xs mb-1">待派送</div>
          <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          <div className="mt-2 text-gray-200 text-xs">等待开始派送</div>
        </div>

        {/* 派送中 */}
        <div 
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/cmr-manage/delivering')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-blue-100 text-xs mb-1">派送中</div>
          <div className="text-2xl font-bold">{stats?.delivering || 0}</div>
          <div className="mt-2 text-blue-200 text-xs">正在配送途中</div>
        </div>

        {/* 已完成 */}
        <div 
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/cmr-manage/archived')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="text-green-100 text-xs mb-1">已送达</div>
          <div className="text-2xl font-bold">{stats?.delivered || 0}</div>
          <div className="mt-2 text-green-200 text-xs">成功送达</div>
        </div>

        {/* 异常订单 */}
        <div 
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/cmr-manage/exception')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-red-100 text-xs mb-1">异常订单</div>
          <div className="text-2xl font-bold">{stats?.exception || 0}</div>
          <div className="mt-2 text-red-200 text-xs">需要处理</div>
        </div>

        {/* 已关闭 */}
        <div 
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
          onClick={() => navigate('/tms/exceptions')}
        >
          <div className="absolute top-3 right-3 p-2 bg-white/20 rounded-lg">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="text-purple-100 text-xs mb-1">异常管理</div>
          <div className="text-2xl font-bold">{stats?.exception || 0}</div>
          <div className="mt-2 text-purple-200 text-xs">异常订单跟进</div>
        </div>
      </div>

      {/* 今日统计 & 效率指标 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            今日统计
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">今日开始派送</span>
              <span className="font-bold text-blue-600">{todayStats.started}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">今日完成送达</span>
              <span className="font-bold text-green-600">{todayStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">今日新增异常</span>
              <span className="font-bold text-red-600">{todayStats.exceptions}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            效率指标
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">准时送达率</span>
              <div className="flex items-center gap-1">
                {stats && (stats.delivered || 0) > 0 ? (
                  <>
                    <span className="font-bold text-green-600">
                      {(((stats.delivered || 0) / ((stats.delivered || 0) + (stats.exception || 0) || 1)) * 100).toFixed(1)}%
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  </>
                ) : (
                  <span className="text-sm text-gray-400">暂无数据</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">异常处理率</span>
              <div className="flex items-center gap-1">
                {stats && ((stats.exception || 0) + (stats.closed || 0)) > 0 ? (
                  <>
                    <span className="font-bold text-blue-600">
                      {(((stats.closed || 0) / ((stats.exception || 0) + (stats.closed || 0) || 1)) * 100).toFixed(1)}%
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  </>
                ) : (
                  <span className="text-sm text-gray-400">暂无数据</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">总派送订单</span>
              <span className="font-bold text-gray-900">{(stats?.delivering || 0) + (stats?.delivered || 0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            活跃服务商
          </h3>
          {serviceProviders.length > 0 ? (
            <div className="space-y-2">
              {serviceProviders.slice(0, 3).map(provider => (
                <div key={provider.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-900">{provider.providerName}</span>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">活跃</span>
                </div>
              ))}
              <button 
                onClick={() => navigate('/tms/service-providers')}
                className="w-full text-xs text-primary-600 hover:text-primary-700 text-center mt-2"
              >
                查看全部服务商
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-gray-400 text-sm mb-2">暂无服务商</div>
              <button 
                onClick={() => navigate('/tms/service-providers')}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                添加服务商
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 派送中订单列表 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-500" />
            派送中订单
          </h3>
          <button
            onClick={() => navigate('/cmr-manage/delivering')}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            查看全部 <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recentDeliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">提单号</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">收货人</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">目的地</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">派送进度</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">状态</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map(item => {
                  const statusConfig = getStatusConfig(item.deliveryStatus)
                  const StatusIcon = statusConfig.icon
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{item.billNumber}</td>
                      <td className="py-2 px-3 text-gray-600">{item.consignee || '-'}</td>
                      <td className="py-2 px-3 text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {item.placeOfDelivery || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {[1, 2, 3, 4, 5].map(step => (
                            <div
                              key={step}
                              className={`w-2 h-2 rounded-full ${
                                step <= (item.cmrCurrentStep || 0) ? 'bg-blue-500' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {getStepLabel(item.cmrCurrentStep || 0)}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => navigate(`/cmr-manage/${item.id}`)}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无派送中的订单
          </div>
        )}
      </div>

      {/* 派送进度分布 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          派送流程进度分布
        </h3>
        <div className="flex items-center justify-between gap-4">
          {[
            { step: 1, label: '已提货', color: 'bg-blue-500', key: 'step1' as const },
            { step: 2, label: '运输中', color: 'bg-cyan-500', key: 'step2' as const },
            { step: 3, label: '已到达', color: 'bg-emerald-500', key: 'step3' as const },
            { step: 4, label: '卸货中', color: 'bg-amber-500', key: 'step4' as const },
            { step: 5, label: '已送达', color: 'bg-green-500', key: 'step5' as const },
          ].map((item, index) => {
            const count = stats?.stepDistribution?.[item.key] || 0
            return (
              <div key={item.step} className="flex-1">
                <div className="text-center mb-2">
                  <div className={`w-10 h-10 mx-auto rounded-full ${item.color} flex items-center justify-center text-white font-bold`}>
                    {item.step}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">{item.label}</div>
                  <div className="text-base font-bold text-gray-700">{count} 单</div>
                </div>
                {index < 4 && (
                  <div className="absolute top-1/2 right-0 w-full h-0.5 bg-gray-200 -z-10" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

