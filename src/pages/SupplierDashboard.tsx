import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, TrendingUp, Star, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Users,
  Wallet, FileText, Phone
} from 'lucide-react'
import PageHeader from '../components/PageHeader'

// ==================== 类型定义 ====================

interface SupplierStats {
  total: number
  active: number
  inactive: number
  pending: number
  blacklist: number
  vip: number
  levelA: number
  levelB: number
  levelC: number
  newSupplier: number
}

interface RecentSupplier {
  id: string
  supplierCode: string
  supplierName: string
  supplierType: string
  level: string
  status: string
  contactPerson: string
  contactPhone: string
  createdAt: string
}

// ==================== 常量定义 ====================

const SUPPLIER_TYPES: Record<string, string> = {
  manufacturer: '生产厂家',
  trader: '贸易商',
  agent: '代理商',
  distributor: '分销商',
  other: '其他',
}

const SUPPLIER_LEVELS: Record<string, { label: string; color: string }> = {
  vip: { label: 'VIP', color: 'bg-purple-100 text-purple-700' },
  a: { label: 'A级', color: 'bg-blue-100 text-blue-700' },
  b: { label: 'B级', color: 'bg-cyan-100 text-cyan-700' },
  c: { label: 'C级', color: 'bg-gray-100 text-gray-600' },
  new: { label: '新供应商', color: 'bg-amber-100 text-amber-700' },
}

const SUPPLIER_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'bg-green-100 text-green-700' },
  inactive: { label: '停用', color: 'bg-gray-100 text-gray-500' },
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-700' },
  blacklist: { label: '黑名单', color: 'bg-red-100 text-red-700' },
}

// ==================== 主组件 ====================

export default function SupplierDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<SupplierStats | null>(null)
  const [recentSuppliers, setRecentSuppliers] = useState<RecentSupplier[]>([])
  const [loading, setLoading] = useState(true)

  const tabs = [
    { label: '供应商概览', path: '/suppliers' },
    { label: '供应商列表', path: '/suppliers/list' },
  ]

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 获取统计数据
      const statsRes = await fetch('/api/suppliers/stats')
      const statsData = await statsRes.json()
      if (statsData.errCode === 200) {
        setStats(statsData.data)
      }

      // 获取最近添加的供应商
      const recentRes = await fetch('/api/suppliers?page=1&pageSize=5')
      const recentData = await recentRes.json()
      if (recentData.errCode === 200) {
        setRecentSuppliers(recentData.data?.list || [])
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLevelConfig = (level: string) => {
    return SUPPLIER_LEVELS[level] || SUPPLIER_LEVELS.new
  }

  const getStatusConfig = (status: string) => {
    return SUPPLIER_STATUS[status] || SUPPLIER_STATUS.active
  }

  const getTypeLabel = (type: string) => {
    return SUPPLIER_TYPES[type] || type
  }

  // 快捷操作卡片
  const quickActions = [
    {
      title: '新增供应商',
      description: '添加新的供应商信息',
      icon: Building2,
      color: 'bg-primary-500',
      onClick: () => navigate('/suppliers/list?action=add'),
    },
    {
      title: '供应商列表',
      description: '查看和管理所有供应商',
      icon: FileText,
      color: 'bg-blue-500',
      onClick: () => navigate('/suppliers/list'),
    },
    {
      title: 'VIP供应商',
      description: '查看VIP级别供应商',
      icon: Star,
      color: 'bg-purple-500',
      onClick: () => navigate('/suppliers/list?level=vip'),
    },
    {
      title: '待审核',
      description: '处理待审核的供应商',
      icon: Clock,
      color: 'bg-amber-500',
      onClick: () => navigate('/suppliers/list?status=pending'),
    },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="供应商管理"
        icon={<Building2 className="w-6 h-6 text-primary-600" />}
        tabs={tabs}
        activeTab="/suppliers"
        onTabChange={(path) => navigate(path)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-600">加载中...</span>
        </div>
      ) : (
        <>
          {/* 统计概览 */}
          <div className="grid grid-cols-5 gap-4">
            {/* 总供应商 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">总供应商</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{stats?.total || 0}</p>
                </div>
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs">
                <span className="text-green-600 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  活跃 {stats?.active || 0}
                </span>
              </div>
            </div>

            {/* VIP供应商 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">VIP供应商</p>
                  <p className="text-2xl font-semibold text-purple-600 mt-1">{stats?.vip || 0}</p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                占比 {stats?.total ? ((stats.vip / stats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>

            {/* A级供应商 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">A级供应商</p>
                  <p className="text-2xl font-semibold text-blue-600 mt-1">{stats?.levelA || 0}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                B级 {stats?.levelB || 0} / C级 {stats?.levelC || 0}
              </div>
            </div>

            {/* 待审核 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">待审核</p>
                  <p className="text-2xl font-semibold text-amber-600 mt-1">{stats?.pending || 0}</p>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                需要处理
              </div>
            </div>

            {/* 黑名单 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">黑名单</p>
                  <p className="text-2xl font-semibold text-red-600 mt-1">{stats?.blacklist || 0}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                停用 {stats?.inactive || 0}
              </div>
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="grid grid-cols-4 gap-4">
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
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
                <h3 className="mt-3 text-sm font-medium text-gray-900">{action.title}</h3>
                <p className="mt-1 text-xs text-gray-500">{action.description}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 供应商级别分布 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">供应商级别分布</h3>
              <div className="space-y-3">
                {[
                  { key: 'vip', label: 'VIP', value: stats?.vip || 0, color: 'bg-purple-500' },
                  { key: 'a', label: 'A级', value: stats?.levelA || 0, color: 'bg-blue-500' },
                  { key: 'b', label: 'B级', value: stats?.levelB || 0, color: 'bg-cyan-500' },
                  { key: 'c', label: 'C级', value: stats?.levelC || 0, color: 'bg-gray-400' },
                  { key: 'new', label: '新供应商', value: stats?.newSupplier || 0, color: 'bg-amber-500' },
                ].map((item) => {
                  const total = stats?.total || 1
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

            {/* 最近添加的供应商 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">最近添加的供应商</h3>
                <button
                  onClick={() => navigate('/suppliers/list')}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  查看全部 →
                </button>
              </div>
              
              {recentSuppliers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  暂无供应商数据
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      onClick={() => navigate('/suppliers/list')}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{supplier.supplierName}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{supplier.supplierCode}</span>
                            <span>·</span>
                            <span>{getTypeLabel(supplier.supplierType)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getLevelConfig(supplier.level).color}`}>
                          {getLevelConfig(supplier.level).label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusConfig(supplier.status).color}`}>
                          {getStatusConfig(supplier.status).label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 状态统计 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">供应商状态统计</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-green-600">{stats?.active || 0}</p>
                <p className="text-xs text-gray-500">启用</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6 text-gray-500" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-600">{stats?.inactive || 0}</p>
                <p className="text-xs text-gray-500">停用</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-amber-600">{stats?.pending || 0}</p>
                <p className="text-xs text-gray-500">待审核</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-red-600">{stats?.blacklist || 0}</p>
                <p className="text-xs text-gray-500">黑名单</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
