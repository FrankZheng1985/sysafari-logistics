import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardCheck, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Package,
  FileText, Search, Shield, Eye
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface InspectionStats {
  pending: number
  released: number
  total: number
  inspecting: number
  passed: number
  failed: number
}

interface RecentInspection {
  id: string
  billNumber: string
  containerNumber: string
  inspection: string
  inspectionStatus: string
  shipper: string
  consignee: string
  pieces: number
  weight: number
  createdAt: string
}

// ==================== 常量定义 ====================

const INSPECTION_STATUS: Record<string, { label: string; color: string; bgColor: string }> = {
  '待查验': { label: '待查验', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  '查验中': { label: '查验中', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  '已放行': { label: '已放行', color: 'text-green-700', bgColor: 'bg-green-100' },
  '查验通过': { label: '查验通过', color: 'text-green-700', bgColor: 'bg-green-100' },
  '查验不通过': { label: '查验不通过', color: 'text-red-700', bgColor: 'bg-red-100' },
  '-': { label: '无需查验', color: 'text-gray-500', bgColor: 'bg-gray-100' },
}

// ==================== 主组件 ====================

export default function InspectionDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<InspectionStats>({
    pending: 0,
    released: 0,
    total: 0,
    inspecting: 0,
    passed: 0,
    failed: 0
  })
  const [recentInspections, setRecentInspections] = useState<RecentInspection[]>([])
  const [loading, setLoading] = useState(true)

  const tabs = [
    { label: '查验概览', path: '/inspection' },
    { label: '待查验', path: '/inspection/pending' },
    { label: '已放行', path: '/inspection/released' },
  ]

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 获取待查验统计
      const pendingRes = await fetch(`${API_BASE}/api/inspection/list?type=pending&pageSize=1`)
      const pendingData = await pendingRes.json()
      
      // 获取已放行统计
      const releasedRes = await fetch(`${API_BASE}/api/inspection/list?type=released&pageSize=1`)
      const releasedData = await releasedRes.json()
      
      // 获取最近查验记录
      const recentRes = await fetch(`${API_BASE}/api/inspection/list?type=pending&pageSize=5`)
      const recentData = await recentRes.json()

      if (pendingData.errCode === 200 && releasedData.errCode === 200) {
        const pendingCount = Number(pendingData.data?.stats?.pending || pendingData.data?.total || 0)
        const releasedCount = Number(releasedData.data?.stats?.released || releasedData.data?.total || 0)
        
        setStats({
          pending: pendingCount,
          released: releasedCount,
          total: pendingCount + releasedCount,
          inspecting: 0,
          passed: releasedCount,
          failed: 0
        })
      }

      if (recentData.errCode === 200) {
        setRecentInspections(recentData.data?.list || [])
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status: string) => {
    return INSPECTION_STATUS[status] || INSPECTION_STATUS['-']
  }

  // 快捷操作卡片
  const quickActions = [
    {
      title: '待查验列表',
      description: '查看需要处理的查验任务',
      icon: Clock,
      color: 'bg-amber-500',
      count: stats.pending,
      onClick: () => navigate('/inspection/pending'),
    },
    {
      title: '已放行列表',
      description: '查看已完成查验的记录',
      icon: CheckCircle,
      color: 'bg-green-500',
      count: stats.released,
      onClick: () => navigate('/inspection/released'),
    },
    {
      title: '查验记录搜索',
      description: '按条件搜索查验记录',
      icon: Search,
      color: 'bg-blue-500',
      onClick: () => navigate('/inspection/pending'),
    },
    {
      title: '查验统计报表',
      description: '查看查验数据统计',
      icon: TrendingUp,
      color: 'bg-purple-500',
      onClick: () => navigate('/inspection/pending'),
    },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="查验管理"
        icon={<ClipboardCheck className="w-6 h-6 text-primary-600" />}
        tabs={tabs}
        activeTab="/inspection"
        onTabChange={(path) => navigate(path)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">加载中...</span>
        </div>
      ) : (
        <>
          {/* 统计概览 - 响应式网格 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 待查验 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">待查验</p>
                  <p className="text-2xl font-semibold text-amber-600 mt-1">{stats.pending}</p>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs">
                <span className="text-amber-600">需要处理</span>
              </div>
            </div>

            {/* 已放行 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">已放行</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{stats.released}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs">
                <span className="text-green-600">查验完成</span>
              </div>
            </div>

            {/* 查验中 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">查验中</p>
                  <p className="text-2xl font-semibold text-blue-600 mt-1">{stats.inspecting}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs">
                <span className="text-blue-600">正在进行</span>
              </div>
            </div>

            {/* 总计 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">总查验数</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-gray-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs">
                <span className="text-gray-500">累计记录</span>
              </div>
            </div>
          </div>

          {/* 快捷操作 - 响应式网格 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center`}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    {action.count !== undefined && (
                      <span className="text-lg font-semibold text-gray-900">{action.count}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </div>
                <h3 className="mt-3 text-sm font-medium text-gray-900">{action.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{action.description}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* 查验状态分布 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">查验状态分布</h3>
              <div className="space-y-3">
                {[
                  { key: 'pending', label: '待查验', value: stats.pending, color: 'bg-amber-500' },
                  { key: 'inspecting', label: '查验中', value: stats.inspecting, color: 'bg-blue-500' },
                  { key: 'released', label: '已放行', value: stats.released, color: 'bg-green-500' },
                  { key: 'failed', label: '查验不通过', value: stats.failed, color: 'bg-red-500' },
                ].map((item) => {
                  const total = stats.total || 1
                  const percentage = (item.value / total) * 100
                  return (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="text-gray-900 font-medium">{item.value}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`${item.color} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 待处理查验 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">待处理查验</h3>
                <button
                  onClick={() => navigate('/inspection/pending')}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  查看全部 →
                </button>
              </div>
              
              {recentInspections.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  暂无待查验数据
                </div>
              ) : (
                <div className="space-y-3">
                  {recentInspections.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/inspection/${item.id}`)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.billNumber}</div>
                          <div className="text-xs text-gray-500">
                            {item.containerNumber || '暂无柜号'} · {item.pieces || 0}件
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusConfig(item.inspection).bgColor} ${getStatusConfig(item.inspection).color}`}>
                          {getStatusConfig(item.inspection).label}
                        </span>
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 查验流程说明 */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">查验处理流程</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">1. 接收通知</p>
                <p className="text-xs text-gray-500 mt-1">海关下发查验通知</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">2. 预约查验</p>
                <p className="text-xs text-gray-500 mt-1">安排查验时间</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">3. 现场查验</p>
                <p className="text-xs text-gray-500 mt-1">海关进行查验</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto">
                  <ClipboardCheck className="w-6 h-6 text-cyan-600" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">4. 查验结果</p>
                <p className="text-xs text-gray-500 mt-1">获取查验结论</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">5. 放行处理</p>
                <p className="text-xs text-gray-500 mt-1">完成放行手续</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
