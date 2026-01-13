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
  ChevronLeft,
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
  MessageCircle,
  Clock,
  CheckCircle,
  CreditCard,
  Upload,
  Calculator,
  FilePlus,
  Link2,
  AlertTriangle,
  CalendarClock,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import clsx from 'clsx'
import { loadMenuSettingsAsync } from '../utils/menuSettings'
import { getApiBaseUrl } from '../utils/api'
import { getCachedSystemSettings, invalidateSystemSettings } from '../utils/apiCache'
import { useAuth } from '../contexts/AuthContext'

// 侧边栏折叠状态 Context
interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  isMobileOpen: boolean
  setIsMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // 从 localStorage 读取折叠状态
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed')
      return saved === 'true'
    }
    return false
  })
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  // 保存折叠状态到 localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])
  
  // 监听窗口大小变化，小屏幕自动折叠
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true)
      }
    }
    
    // 初始化检查
    handleResize()
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

const API_BASE = getApiBaseUrl()

// 菜单权限映射：定义每个菜单路径需要的权限
const MENU_PERMISSIONS: Record<string, string[]> = {
  '/workbench': [], // 所有用户都可以访问工作台
  '/dashboard': ['dashboard:view'],
  '/bp-view': ['bp:view'],
  '/bookings': ['bill:view', 'bill:create', 'bill:edit'],
  '/bookings/bill': ['bill:view'],
  '/bookings/labels': ['bill:view'],
  '/bookings/packages': ['bill:view'],
  '/bookings/declarations': ['bill:view'],
  '/documents': ['document:view', 'document:import', 'document:match'],
  '/documents/sensitive-products': ['document:sensitive_products'],
  '/inspection': ['inspection:view', 'inspection:operate'],
  '/tms': ['cmr:view', 'cmr:operate'],
  '/crm': ['crm:view', 'crm:customer_manage', 'crm:opportunity_manage'],
  '/crm/business-info': ['crm:business_info'],
  '/suppliers': ['supplier:view', 'supplier:manage'],
  '/finance': ['finance:view', 'finance:invoice_view', 'finance:payment_view'],
  '/finance/commission': ['finance:commission_manage'],
  '/finance/carrier-settlement': ['finance:carrier_settlement'],
  '/tools': ['product:view', 'system:tariff_rate'],
  '/system': [
    'system:user', 'system:menu', 'system:basic_data', 'system:security',
    'system:tariff_rate', 'system:message', 'system:data_import', 
    'system:activity_log', 'system:logo', 'system:api_integrations',
    'system:approval_settings'
  ],
  '/system/tariff-rates': ['system:tariff_rate'],
  '/system/info-center': ['system:message'],
  '/system/data-import': ['system:data_import'],
  '/system/approval-settings': ['system:approval_settings'],
  '/system/logo-manage': ['system:logo'],
  '/system/api-integrations': ['system:api_integrations'],
  // 新增：系统管理子菜单权限定义
  '/system/menu-settings': ['system:menu'],
  '/system/user-manage': ['system:user'],
  '/system/security-center': ['system:security'],
  '/system/basic-data': ['system:basic_data'],
}

interface MenuItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    path: '/workbench',
    label: '我的工作台',
    icon: LayoutDashboard,
  },
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
    ],
  },
  {
    path: '/documents',
    label: '单证管理',
    icon: FileCheck,
    children: [
      { path: '/documents', label: '单证概览', icon: ClipboardList },
      { path: '/documents/import', label: '货物导入', icon: Upload },
      { path: '/documents/matching', label: 'HS匹配审核', icon: CheckCircle },
      { path: '/documents/tax-calc', label: '税费计算', icon: Calculator },
      { path: '/documents/supplement', label: '数据补充', icon: FilePlus },
      { path: '/documents/match-records', label: '匹配记录库', icon: FileCheck },
      { path: '/documents/sensitive-products', label: '敏感产品库', icon: AlertTriangle },
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
      { path: '/crm/business-info', label: '工商信息库', icon: Database },
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
      { path: '/finance/statements', label: '财务报表', icon: FileText },
      { path: '/finance/commission', label: '提成管理', icon: TrendingUp },
    ],
  },
  {
    path: '/tools',
    label: '工具',
    icon: Settings,
    children: [
      { path: '/tools/product-pricing', label: '产品定价', icon: FileText },
      { path: '/tools/shared-tax', label: '共享税号库', icon: FileText },
    ],
  },
  {
    path: '/system',
    label: '系统管理',
    icon: Settings,
    // 子菜单已移至系统管理页面卡片模式显示
  },
]

// 自动收起延迟时间（毫秒）
const AUTO_COLLAPSE_DELAY = 15000

// 移动端菜单遮罩组件
export function MobileMenuOverlay() {
  const { isMobileOpen, setIsMobileOpen } = useSidebar()
  
  if (!isMobileOpen) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 z-30 lg:hidden"
      onClick={() => setIsMobileOpen(false)}
    />
  )
}

// 移动端菜单按钮组件
export function MobileMenuButton() {
  const { isMobileOpen, setIsMobileOpen } = useSidebar()
  
  return (
    <button
      onClick={() => setIsMobileOpen(!isMobileOpen)}
      className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
      aria-label="切换菜单"
    >
      {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </button>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { hasAnyPermission, isAdmin, isManager } = useAuth()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [menuSettings, setMenuSettings] = useState<Record<string, boolean>>({})
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  
  // 获取侧边栏折叠状态
  const sidebarContext = useContext(SidebarContext)
  const isCollapsed = sidebarContext?.isCollapsed ?? false
  const setIsCollapsed = sidebarContext?.setIsCollapsed ?? (() => {})
  const isMobileOpen = sidebarContext?.isMobileOpen ?? false
  const setIsMobileOpen = sidebarContext?.setIsMobileOpen ?? (() => {})
  
  // 存储每个父级菜单的自动收起定时器
  const collapseTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  
  // 清理定时器
  const clearCollapseTimer = useCallback((parentPath: string) => {
    if (collapseTimersRef.current[parentPath]) {
      clearTimeout(collapseTimersRef.current[parentPath])
      delete collapseTimersRef.current[parentPath]
    }
  }, [])
  
  // 设置自动收起定时器
  const setAutoCollapseTimer = useCallback((parentPath: string) => {
    // 先清除已有的定时器
    clearCollapseTimer(parentPath)
    
    // 设置新的定时器，15秒后自动收起
    collapseTimersRef.current[parentPath] = setTimeout(() => {
      setExpandedItems(prev => prev.filter(p => p !== parentPath))
      delete collapseTimersRef.current[parentPath]
    }, AUTO_COLLAPSE_DELAY)
  }, [clearCollapseTimer])
  
  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(collapseTimersRef.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

  // 检查用户是否有权限访问某个菜单
  const canAccessMenu = (path: string): boolean => {
    // 管理员和经理可以访问所有菜单
    if (isAdmin() || isManager()) return true
    
    // 获取该菜单需要的权限
    const requiredPermissions = MENU_PERMISSIONS[path]
    if (!requiredPermissions || requiredPermissions.length === 0) {
      // 如果没有定义权限要求，默认允许访问
      return true
    }
    
    // 检查用户是否有任意一个所需权限
    return hasAnyPermission(requiredPermissions)
  }

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

  // 加载 Logo（使用缓存）
  useEffect(() => {
    const loadLogo = async (forceRefresh = false) => {
      try {
        // 如果强制刷新，先清除缓存
        if (forceRefresh) {
          invalidateSystemSettings('systemLogo')
        }
        const data = await getCachedSystemSettings('systemLogo', API_BASE)
        if (data.errCode === 200 && data.data?.systemLogo) {
          setLogoUrl(data.data.systemLogo)
        } else {
          setLogoUrl(null)
        }
      } catch (error) {
        console.debug('加载Logo失败:', error)
        setLogoUrl(null)
      }
    }

    loadLogo()

    // 监听 Logo 变化事件（强制刷新）
    const handleLogoChange = () => {
      loadLogo(true)
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
    } else if (item.path === '/documents') {
      navigate('/documents')
    }
  }

  // 处理子菜单点击，设置自动收起定时器
  const handleChildClick = (parentPath: string) => {
    // 点击子菜单后，设置15秒后自动收起父级菜单
    setAutoCollapseTimer(parentPath)
  }

  const renderMenuItem = (item: MenuItem, level = 0, parentPath?: string) => {
    const hasChildren = item.children && item.children.length > 0
    const expanded = isExpanded(item.path)

    // 折叠状态下的菜单项（只显示图标）
    if (isCollapsed && level === 0) {
      return (
        <div key={item.path} className="relative group">
          <NavLink
            to={hasChildren ? '#' : item.path}
            onClick={(e) => {
              if (hasChildren) {
                e.preventDefault()
                handleParentClick(item)
              } else {
                setIsMobileOpen(false)
              }
            }}
            className={({ isActive }) =>
              clsx(
                'flex items-center justify-center p-2 transition-colors rounded mx-1',
                isActive && !hasChildren
                  ? 'bg-primary-100 text-primary-700'
                  : 'hover:bg-gray-100 text-gray-600'
              )
            }
            title={item.label}
          >
            <item.icon className="w-4 h-4" />
          </NavLink>
          {/* 悬停显示子菜单 */}
          {hasChildren && (
            <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">{item.label}</div>
              {item.children
                ?.filter((child) => {
                  if (!canAccessMenu(child.path)) return false
                  if (item.path === '/bookings') {
                    if (Object.keys(menuSettings).length === 0) return true
                    return menuSettings[child.path] !== false
                  }
                  return true
                })
                .map((child) => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      )
                    }
                  >
                    <child.icon className="w-3 h-3" />
                    <span>{child.label}</span>
                  </NavLink>
                ))}
            </div>
          )}
        </div>
      )
    }

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
                    // 检查用户权限
                    if (!canAccessMenu(child.path)) {
                      return false
                    }
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
                  .map((child) => renderMenuItem(child, level + 1, item.path))}
              </div>
            )}
          </>
        ) : (
          <NavLink
            to={item.path}
            onClick={() => {
              if (parentPath) handleChildClick(parentPath)
              setIsMobileOpen(false)
            }}
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
    <aside 
      className={clsx(
        'bg-white border-r border-gray-200 flex-col shadow-sm z-40 transition-all duration-300',
        // 桌面端：根据折叠状态显示不同宽度
        isCollapsed ? 'lg:w-14' : 'lg:w-48',
        // 移动端：默认隐藏（hidden），打开时显示（flex）；桌面端始终显示
        'fixed lg:relative h-full w-48',
        // 移动端使用 hidden/flex 控制显示，桌面端始终 flex
        isMobileOpen ? 'flex' : 'hidden lg:flex'
      )}
    >
      {/* Logo 区域 */}
      <div className={clsx('border-b border-gray-200', isCollapsed ? 'p-2' : 'p-2')}>
        <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-1.5')}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="系统 Logo"
              className="w-6 h-6 object-contain flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
          )}
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-gray-900 whitespace-nowrap">BP Logistics</div>
              <div className="text-[10px] text-gray-500">V{__APP_VERSION__}</div>
            </div>
          )}
        </div>
      </div>
      
      {/* 菜单区域 */}
      <nav className="flex-1 overflow-y-auto py-1">
        {menuItems
          .filter(item => {
            // 检查顶级菜单项的开关状态
            if (menuSettings[item.path] === false) {
              return false
            }
            // 检查用户权限
            if (!canAccessMenu(item.path)) {
              return false
            }
            return true
          })
          .map(item => renderMenuItem(item))}
      </nav>
      
      {/* 底部区域：帮助 + 折叠按钮 */}
      <div className={clsx('border-t border-gray-200 bg-gray-50', isCollapsed ? 'p-1' : 'p-2')}>
        {/* 帮助链接 */}
        <NavLink
          to="/help"
          onClick={() => setIsMobileOpen(false)}
          className={({ isActive }) =>
            clsx(
              'flex items-center text-xs transition-colors rounded',
              isCollapsed ? 'justify-center p-2' : 'gap-1 px-2 py-1',
              isActive
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )
          }
          title={isCollapsed ? '帮助' : undefined}
        >
          <HelpCircle className="w-3 h-3" />
          {!isCollapsed && <span>帮助</span>}
        </NavLink>
        
        {/* 折叠/展开按钮 - 仅桌面端显示 */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={clsx(
            'hidden lg:flex items-center text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded mt-1',
            isCollapsed ? 'justify-center p-2 w-full' : 'gap-1 px-2 py-1 w-full'
          )}
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <>
              <ChevronLeft className="w-3 h-3" />
              <span>收起</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

