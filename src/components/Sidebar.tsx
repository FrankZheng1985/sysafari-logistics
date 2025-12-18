import { NavLink, useNavigate } from 'react-router-dom'
import { 
  Package, 
  FileText, 
  ClipboardList,
  ClipboardCheck,
  FileCheck,
  Truck,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Users,
  Image,
  ToggleLeft,
  Database,
  Shield,
  UserCircle,
  Wallet,
  Monitor,
  Home,
  Building2,
  TrendingUp,
  MessageSquare,
  Clock,
  CheckCircle,
  CreditCard
} from 'lucide-react'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { loadMenuSettingsAsync } from '../utils/menuSettings'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface MenuItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    path: '/dashboard',
    label: '系统概览',
    icon: Home,
  },
  {
    path: '/bp-view',
    label: 'BP View',
    icon: Monitor,
  },
  {
    path: '/bookings',
    label: '订单管理',
    icon: Package,
    children: [
      { path: '/bookings/labels', label: '打单', icon: FileText },
      { path: '/bookings/packages', label: '打包', icon: Package },
      { path: '/bookings/bill', label: '提单', icon: FileText },
      { path: '/bookings/declarations', label: '报关', icon: ClipboardList },
      { path: '/bookings/clearance', label: '单证管理', icon: FileCheck },
    ],
  },
  {
    path: '/inspection',
    label: '查验管理',
    icon: ClipboardCheck,
    children: [
      { path: '/inspection', label: '查验概览', icon: ClipboardList },
      { path: '/inspection/pending', label: '待查验', icon: Clock },
      { path: '/inspection/released', label: '已放行', icon: CheckCircle },
    ],
  },
  {
    path: '/tms',
    label: 'TMS运输管理',
    icon: Truck,
    children: [
      { path: '/tms', label: 'TMS概览', icon: ClipboardList },
      { path: '/cmr-manage', label: 'TMS管理', icon: Truck },
      { path: '/tms/pricing', label: '运费管理', icon: Wallet },
      { path: '/tms/conditions', label: '条件管理', icon: ClipboardCheck },
      { path: '/last-mile', label: '最后里程', icon: Truck },
    ],
  },
  {
    path: '/crm',
    label: 'CRM客户管理',
    icon: UserCircle,
    children: [
      { path: '/crm', label: 'CRM概览', icon: ClipboardList },
      { path: '/crm/customers', label: '客户管理', icon: Users },
      { path: '/crm/opportunities', label: '商机管理', icon: TrendingUp },
      { path: '/crm/quotations', label: '报价管理', icon: FileText },
      { path: '/crm/contracts', label: '合同管理', icon: FileCheck },
      { path: '/crm/feedbacks', label: '客户反馈', icon: MessageSquare },
    ],
  },
  {
    path: '/suppliers',
    label: '供应商管理',
    icon: Building2,
    children: [
      { path: '/suppliers', label: '供应商概览', icon: ClipboardList },
      { path: '/suppliers/list', label: '供应商列表', icon: Building2 },
    ],
  },
  {
    path: '/finance',
    label: '财务管理',
    icon: Wallet,
    children: [
      { path: '/finance', label: '财务概览', icon: ClipboardList },
      { path: '/finance/invoices', label: '发票管理', icon: FileText },
      { path: '/finance/payments', label: '收付款', icon: Wallet },
      { path: '/finance/fees', label: '费用管理', icon: CreditCard },
      { path: '/finance/reports', label: '报表分析', icon: TrendingUp },
    ],
  },
  {
    path: '/tools',
    label: '工具',
    icon: Settings,
    children: [
      { path: '/tools/product-pricing', label: '报价管理', icon: FileText },
      { path: '/tools/tariff-calculator', label: '关税计算', icon: FileText },
      { path: '/tools/shared-tax', label: '共享税号库', icon: FileText },
    ],
  },
  {
    path: '/system',
    label: '系统管理',
    icon: Settings,
    children: [
      { path: '/system/messages', label: '消息中心', icon: MessageSquare },
      { path: '/system/approvals', label: '审批工作台', icon: ClipboardCheck },
      { path: '/system/alerts', label: '预警管理', icon: Clock },
      { path: '/system/menu-settings', label: '板块开关', icon: ToggleLeft },
      { path: '/system/user-manage', label: '用户管理', icon: Users },
      { path: '/system/security-settings', label: '安全设置', icon: Shield },
      { path: '/system/logo-manage', label: 'Logo 管理', icon: Image },
      { path: '/system/basic-data', label: '基础数据管理', icon: Database },
      { path: '/system/tariff-rates', label: '税率管理', icon: FileText },
    ],
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const [expandedItems, setExpandedItems] = useState<string[]>(['/bookings', '/tools', '/system', '/crm', '/tms', '/suppliers', '/inspection', '/finance'])
  const [menuSettings, setMenuSettings] = useState<Record<string, boolean>>({})
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // 加载菜单设置并监听变化
  useEffect(() => {
    const loadSettings = async () => {
      // 先从后端异步加载设置
      const savedSettings = await loadMenuSettingsAsync()
      
      const settings: Record<string, boolean> = {}
      // 检查所有可配置的菜单项
      const configurableMenuItems = [
        '/bookings/labels',
        '/bookings/packages',
        '/bookings/bill',
        '/bookings/declarations',
        '/bookings/clearance',
        '/last-mile',
      ]
      configurableMenuItems.forEach((path) => {
        // 使用从后端加载的设置
        settings[path] = savedSettings[path] !== false
      })
      setMenuSettings(settings)
    }

    loadSettings()

    // 监听设置变化事件
    const handleSettingsChange = () => {
      loadSettings()
    }

    window.addEventListener('menuSettingsChanged', handleSettingsChange)
    return () => {
      window.removeEventListener('menuSettingsChanged', handleSettingsChange)
    }
  }, [])

  // 加载 Logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/system-settings?key=systemLogo`)
        const data = await res.json()
        if (data.errCode === 200 && data.data?.systemLogo) {
          setLogoUrl(data.data.systemLogo)
        } else {
          setLogoUrl(null)
        }
      } catch (error) {
        console.error('加载Logo失败:', error)
        setLogoUrl(null)
      }
    }

    loadLogo()

    // 监听 Logo 变化事件
    const handleLogoChange = () => {
      loadLogo()
    }

    window.addEventListener('logoChanged', handleLogoChange)
    return () => {
      window.removeEventListener('logoChanged', handleLogoChange)
    }
  }, [])

  const toggleExpand = (path: string) => {
    setExpandedItems(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    )
    // 点击"订单管理"时跳转到提单页面
    if (path === '/bookings') {
      navigate('/bookings/bill')
    }
  }

  const isExpanded = (path: string) => expandedItems.includes(path)

  // 处理有子菜单的父级点击
  const handleParentClick = (item: MenuItem) => {
    toggleExpand(item.path)
    // 对于有子菜单的模块，点击时导航到对应的概览页面
    if (item.path === '/tools') {
      navigate('/tools')
    } else if (item.path === '/system') {
      navigate('/system')
    } else if (item.path === '/crm') {
      navigate('/crm')
    } else if (item.path === '/suppliers') {
      navigate('/suppliers')
    } else if (item.path === '/tms') {
      navigate('/tms')
    } else if (item.path === '/inspection') {
      navigate('/inspection')
    } else if (item.path === '/finance') {
      navigate('/finance')
    }
  }

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const expanded = isExpanded(item.path)

    return (
      <div key={item.path}>
        {hasChildren ? (
          <>
            <button
              onClick={() => handleParentClick(item)}
              className={clsx(
                'w-full flex items-center gap-1 px-2 py-1 text-xs hover:bg-gray-100 transition-colors rounded mx-1',
                level > 0 && 'pl-4'
              )}
            >
              {expanded ? (
                <ChevronDown className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-500" />
              )}
              <item.icon className="w-3 h-3 text-gray-600" />
              <span className="text-gray-700">{item.label}</span>
            </button>
            {expanded && (
              <div className="ml-2">
                {item.children
                  ?.filter((child) => {
                    // 如果是订单管理下的菜单项，检查开关状态
                    if (item.path === '/bookings') {
                      // 如果 menuSettings 为空或未初始化，使用默认值（开启）
                      if (Object.keys(menuSettings).length === 0) {
                        return true
                      }
                      // 检查设置，如果为 true 或 undefined（未设置），则显示
                      return menuSettings[child.path] !== false
                    }
                    return true
                  })
                  .map((child) => renderMenuItem(child, level + 1))}
              </div>
            )}
          </>
        ) : (
          <NavLink
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded mx-1',
                level > 0 && 'pl-4',
                isActive
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'hover:bg-gray-100 text-gray-700'
              )
            }
          >
            <item.icon className={clsx('w-3 h-3', level > 0 && 'w-2.5 h-2.5')} />
            <span>{item.label}</span>
          </NavLink>
        )}
      </div>
    )
  }

  return (
    <aside className="w-48 bg-white border-r border-gray-200 flex flex-col shadow-sm z-20">
      <div className="p-2 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="系统 Logo"
              className="w-6 h-6 object-contain"
            />
          ) : (
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold">S</span>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-gray-900">BP Logistics</div>
            <div className="text-[10px] text-gray-500">V1.0.0</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-1">
        {menuItems
          .filter(item => {
            // 检查顶级菜单项的开关状态
            if (menuSettings[item.path] === false) {
              return false
            }
            return true
          })
          .map(item => renderMenuItem(item))}
      </nav>
      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <NavLink
          to="/help"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-1 text-xs transition-colors rounded px-2 py-1',
              isActive
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )
          }
        >
          <HelpCircle className="w-3 h-3" />
          <span>帮助</span>
        </NavLink>
      </div>
    </aside>
  )
}

