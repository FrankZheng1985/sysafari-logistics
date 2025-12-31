import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Truck, Package, MapPin, FileSpreadsheet, Calculator,
  Upload, ArrowRight, TrendingUp, Clock, CheckCircle,
  AlertCircle, BarChart3
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface DashboardStats {
  carriers: {
    total: number
    active: number
  }
  rateCards: {
    total: number
    active: number
  }
  shipments: {
    total: number
    pending: number
    inTransit: number
    delivered: number
  }
}

// ==================== 功能模块配置 ====================

const MODULES = [
  {
    key: 'carriers',
    title: '承运商管理',
    description: '管理海外快递和卡车公司',
    icon: Truck,
    path: '/last-mile/carriers',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    key: 'zones',
    title: 'Zone配置',
    description: '配置承运商的服务区域',
    icon: MapPin,
    path: '/last-mile/zones',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600'
  },
  {
    key: 'rates',
    title: '费率卡管理',
    description: '管理采购价和销售价',
    icon: FileSpreadsheet,
    path: '/last-mile/rates',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600'
  },
  {
    key: 'import',
    title: '报价导入',
    description: '导入Excel报价表',
    icon: Upload,
    path: '/last-mile/import',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-600'
  },
  {
    key: 'shipments',
    title: '运单管理',
    description: '打单、面单、轨迹查询',
    icon: Package,
    path: '/last-mile/shipments',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600'
  },
  {
    key: 'quote',
    title: '快速报价',
    description: '计算运费和比价',
    icon: Calculator,
    path: '/last-mile/quote',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600'
  }
]

// ==================== 主组件 ====================

export default function LastMileDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // 获取统计数据
  const fetchStats = async () => {
    setLoading(true)
    try {
      // 并行获取各项数据
      const [carriersRes, rateCardsRes, shipmentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/last-mile/carriers?pageSize=1`),
        fetch(`${API_BASE}/api/last-mile/rate-cards?pageSize=1`),
        fetch(`${API_BASE}/api/last-mile/shipments?pageSize=1`)
      ])

      const [carriersData, rateCardsData, shipmentsData] = await Promise.all([
        carriersRes.json(),
        rateCardsRes.json(),
        shipmentsRes.json()
      ])

      setStats({
        carriers: {
          total: carriersData.errCode === 200 ? carriersData.data.total : 0,
          active: carriersData.errCode === 200 ? carriersData.data.total : 0
        },
        rateCards: {
          total: rateCardsData.errCode === 200 ? rateCardsData.data.total : 0,
          active: rateCardsData.errCode === 200 ? rateCardsData.data.total : 0
        },
        shipments: {
          total: shipmentsData.errCode === 200 ? shipmentsData.data.total : 0,
          pending: 0,
          inTransit: 0,
          delivered: 0
        }
      })
    } catch (error) {
      console.error('获取统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="最后里程"
        description="管理海外派送承运商、费率和运单"
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">承运商</div>
              <div className="text-2xl font-bold mt-1">
                {loading ? '-' : stats?.carriers.total || 0}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {stats?.carriers.active || 0} 个启用
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">费率卡</div>
              <div className="text-2xl font-bold mt-1">
                {loading ? '-' : stats?.rateCards.total || 0}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {stats?.rateCards.active || 0} 个有效
              </div>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">运单总数</div>
              <div className="text-2xl font-bold mt-1">
                {loading ? '-' : stats?.shipments.total || 0}
              </div>
              <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                本月新增
              </div>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">运输中</div>
              <div className="text-2xl font-bold mt-1 text-yellow-600">
                {loading ? '-' : stats?.shipments.inTransit || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                待送达
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 功能模块 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900">功能模块</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            {MODULES.map(module => {
              const Icon = module.icon
              return (
                <Link
                  key={module.key}
                  to={module.path}
                  className="group block p-5 border rounded-lg hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${module.bgColor} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-6 h-6 ${module.textColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 group-hover:text-blue-600">
                        {module.title}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {module.description}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* 快捷操作和提示 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 快速开始 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900">快速开始</h3>
          </div>
          <div className="p-4 space-y-3">
            <Link
              to="/last-mile/carriers"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">添加承运商</div>
                <div className="text-xs text-gray-500">配置DHL、DPD等快递公司</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>

            <Link
              to="/last-mile/zones"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">配置Zone区域</div>
                <div className="text-xs text-gray-500">设置邮编和国家对应的Zone</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>

            <Link
              to="/last-mile/import"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">导入报价表</div>
                <div className="text-xs text-gray-500">上传Excel自动解析费率</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>

            <Link
              to="/last-mile/quote"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 bg-pink-100 rounded flex items-center justify-center">
                <span className="text-pink-600 font-bold">4</span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">开始报价</div>
                <div className="text-xs text-gray-500">快速计算运费和比价</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* 系统状态 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900">系统状态</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">数据库连接正常</span>
              </div>
              <span className="text-xs text-green-600">正常</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-gray-700">费率计算服务</span>
              </div>
              <span className="text-xs text-green-600">正常</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">API打单服务</span>
              </div>
              <span className="text-xs text-gray-500">未配置</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">轨迹同步服务</span>
              </div>
              <span className="text-xs text-gray-500">未配置</span>
            </div>
          </div>

          <div className="p-4 border-t">
            <div className="text-xs text-gray-500">
              提示：API打单和轨迹同步需要在承运商管理中配置API密钥
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
