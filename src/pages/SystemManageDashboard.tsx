import { useNavigate } from 'react-router-dom'
import { 
  Settings, Users, Shield, Image, Database, FileText,
  ToggleLeft, ArrowRight, Activity, Server, Lock, Key, Link2
} from 'lucide-react'

interface SystemCard {
  path: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
}

const systemModules: SystemCard[] = [
  {
    path: '/system/menu-settings',
    label: '板块开关',
    description: '控制系统各功能模块的显示与隐藏',
    icon: ToggleLeft,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
  {
    path: '/system/user-manage',
    label: '用户管理',
    description: '管理系统用户账号、角色和权限分配',
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100',
  },
  {
    path: '/system/security-settings',
    label: '安全设置',
    description: '配置密码策略、登录安全和访问控制',
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100',
  },
  {
    path: '/system/logo-manage',
    label: 'Logo 管理',
    description: '上传和管理系统 Logo 图片',
    icon: Image,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
  },
  {
    path: '/system/basic-data',
    label: '基础数据管理',
    description: '管理港口、国家、费用类别等基础数据',
    icon: Database,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
  },
  {
    path: '/system/tariff-rates',
    label: 'HS Code数据库',
    description: '配置和管理各类税率信息',
    icon: FileText,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100',
  },
  {
    path: '/system/api-integrations',
    label: 'API对接管理',
    description: '管理已对接的第三方API服务和基础设施',
    icon: Link2,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100',
  },
]

// 系统状态信息
const systemStatus = [
  { label: '系统版本', value: 'V1.0.0', icon: Server, color: 'text-blue-600' },
  { label: '活跃用户', value: '5', icon: Users, color: 'text-green-600' },
  { label: '安全状态', value: '正常', icon: Lock, color: 'text-green-600' },
]

export default function SystemManageDashboard() {
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Settings className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">系统管理</h1>
            <p className="text-sm text-gray-500">系统配置和管理功能</p>
          </div>
        </div>

        {/* 系统状态 */}
        <div className="grid grid-cols-3 gap-4">
          {systemStatus.map((item) => (
            <div key={item.label} className="bg-white rounded-lg shadow border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{item.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-gray-50 ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 功能模块 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Key className="w-4 h-4" />
            管理功能
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {systemModules.map((module) => (
              <div
                key={module.path}
                onClick={() => navigate(module.path)}
                className={`${module.bgColor} rounded-xl p-4 cursor-pointer transition-all hover:shadow-md group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-white shadow-sm ${module.color}`}>
                    <module.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{module.label}</h3>
                <p className="text-xs text-gray-600 line-clamp-2">{module.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            快捷操作
          </h3>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/system/user-manage')}
              className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
            >
              添加用户
            </button>
            <button
              onClick={() => navigate('/system/basic-data')}
              className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              管理基础数据
            </button>
            <button
              onClick={() => navigate('/system/security-settings')}
              className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              安全配置
            </button>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 bg-gradient-to-r from-gray-50 to-blue-50">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Shield className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">安全提示</h3>
              <p className="text-sm text-gray-600 mt-1">
                请定期检查用户权限配置，确保系统安全。建议启用强密码策略和登录保护功能。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

