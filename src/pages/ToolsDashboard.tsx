import { useNavigate } from 'react-router-dom'
import { 
  FileText, Calculator, CreditCard, MapPin, Package, 
  Table, Component, Settings, Wrench, ArrowRight,
  TrendingUp, Globe, BarChart3, Building2
} from 'lucide-react'

interface ToolCard {
  path: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
}

const tools: ToolCard[] = [
  {
    path: '/tools/inquiry',
    label: '报价管理',
    description: '创建和管理客户报价单，支持多币种和多服务类型',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
  {
    path: '/tools/tariff-calculator',
    label: '关税计算',
    description: '快速计算进口关税、增值税和其他费用',
    icon: Calculator,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100',
  },
  {
    path: '/tools/payment',
    label: '付款&发票',
    description: '管理付款记录和发票，跟踪账款状态',
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
  },
  {
    path: '/tools/commodity-code',
    label: '海关编码',
    description: '查询和管理HS编码，支持智能搜索',
    icon: Globe,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100',
  },
  {
    path: '/tools/shared-tax',
    label: '共享税号库',
    description: '公司级税号管理，可分享给客户使用',
    icon: Building2,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
  },
  {
    path: '/tools/productCare',
    label: '品类库',
    description: '产品分类管理，支持多级分类结构',
    icon: Package,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100',
  },
  {
    path: '/tools/editable-table',
    label: '可编辑表格',
    description: '数据表格编辑工具，支持批量操作',
    icon: Table,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 hover:bg-cyan-100',
  },
  {
    path: '/tools/components-demo',
    label: '组件示例',
    description: '系统UI组件展示和使用示例',
    icon: Component,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 hover:bg-pink-100',
  },
]

// 快捷统计数据（可后续接入真实数据）
const quickStats = [
  { label: '本月报价', value: '28', trend: '+12%', icon: TrendingUp, color: 'text-blue-600' },
  { label: '待处理发票', value: '5', trend: '', icon: FileText, color: 'text-orange-600' },
  { label: '关税计算次数', value: '156', trend: '+8%', icon: BarChart3, color: 'text-green-600' },
]

export default function ToolsDashboard() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Wrench className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">工具中心</h1>
            <p className="text-sm text-gray-500">常用工具和辅助功能</p>
          </div>
        </div>

        {/* 快捷统计 */}
        <div className="grid grid-cols-3 gap-4">
          {quickStats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  {stat.trend && (
                    <p className="text-xs text-green-600 mt-1">{stat.trend} 较上月</p>
                  )}
                </div>
                <div className={`p-3 rounded-full bg-gray-50 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 工具卡片网格 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            所有工具
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {tools.map((tool) => (
              <div
                key={tool.path}
                onClick={() => navigate(tool.path)}
                className={`${tool.bgColor} rounded-xl p-4 cursor-pointer transition-all hover:shadow-md group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-white shadow-sm ${tool.color}`}>
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{tool.label}</h3>
                <p className="text-xs text-gray-600 line-clamp-2">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 使用提示 */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 bg-gradient-to-r from-primary-50 to-blue-50">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Settings className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">提示</h3>
              <p className="text-sm text-gray-600 mt-1">
                这些工具可以帮助您更高效地处理日常业务。如需添加新工具或定制功能，请联系系统管理员。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

