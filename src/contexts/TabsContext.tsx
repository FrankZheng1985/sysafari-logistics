import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// 标签页接口
export interface Tab {
  key: string       // 路由路径
  title: string     // 标签标题
  closable: boolean // 是否可关闭
}

// 状态接口
interface TabsState {
  tabs: Tab[]
  activeKey: string
}

// Action 类型
type TabsAction =
  | { type: 'ADD_TAB'; payload: Tab }
  | { type: 'REMOVE_TAB'; payload: string }
  | { type: 'REMOVE_OTHERS' }
  | { type: 'REMOVE_ALL' }
  | { type: 'SET_ACTIVE'; payload: string }
  | { type: 'UPDATE_TAB_TITLE'; payload: { key: string; title: string } }
  | { type: 'REORDER_TABS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'INIT'; payload: TabsState }

// 路由到标题的映射（显示完整模块路径：父模块 - 子模块）
const routeTitleMap: Record<string, string> = {
  // 首页
  '/': '首页',
  '/dashboard': '系统概览',
  // 订单管理
  '/bookings/labels': '订单管理 - 打单',
  '/bookings/labels/pure': '订单管理 - 纯标签',
  '/bookings/labels/search': '订单管理 - 标签查询',
  '/bookings/labels/create-single': '订单管理 - 创建单个标签',
  '/bookings/labels/create-batch': '订单管理 - 批量创建标签',
  '/bookings/packages': '订单管理 - 打包',
  '/bookings/bill': '订单管理 - 提单',
  '/bookings/bill/history': '订单管理 - 历史订单',
  '/bookings/bill/draft': '订单管理 - 提单草稿',
  '/bookings/bill/void': '订单管理 - 已作废提单',
  '/bookings/declarations': '订单管理 - 报关',
  '/bookings/clearance': '订单管理 - 清关文件',
  // 单证管理
  '/documents': '单证管理 - 单证概览',
  '/documents/import': '单证管理 - 货物导入',
  '/documents/matching': '单证管理 - HS匹配审核',
  '/documents/tax-calc': '单证管理 - 税费计算',
  '/documents/supplement': '单证管理 - 数据补充',
  '/documents/match-records': '单证管理 - 匹配记录库',
  '/documents/sensitive-products': '单证管理 - 敏感产品库',
  '/document-center': '单证管理 - 文档中心',
  // 查验管理
  '/inspection': '查验管理 - 查验概览',
  '/inspection/pending': '查验管理 - 待查验',
  '/inspection/released': '查验管理 - 已放行',
  // TMS运输管理
  '/tms': 'TMS运输管理 - TMS概览',
  '/tms/pricing': 'TMS运输管理 - 运费管理',
  '/tms/conditions': 'TMS运输管理 - 条件管理',
  '/tms/exceptions': 'TMS运输管理 - 异常管理',
  '/cmr-manage': 'TMS运输管理 - TMS管理',
  '/cmr-manage/delivering': 'TMS运输管理 - 运输中',
  '/cmr-manage/exception': 'TMS运输管理 - 异常',
  '/cmr-manage/archived': 'TMS运输管理 - 已归档',
  '/last-mile': 'TMS运输管理 - 最后里程',
  '/last-mile/carriers': 'TMS运输管理 - 承运商管理',
  '/last-mile/zones': 'TMS运输管理 - 区域管理',
  '/last-mile/rates': 'TMS运输管理 - 运费表',
  '/last-mile/import': 'TMS运输管理 - 运费导入',
  '/last-mile/shipments': 'TMS运输管理 - 派送单',
  '/last-mile/quote': 'TMS运输管理 - 快速报价',
  '/last-mile/delivery': 'TMS运输管理 - 派送管理',
  // CRM客户管理
  '/crm': 'CRM客户管理 - CRM概览',
  '/crm/customers': 'CRM客户管理 - 客户管理',
  '/crm/customers/new': 'CRM客户管理 - 新建客户',
  '/crm/opportunities': 'CRM客户管理 - 商机管理',
  '/crm/quotations': 'CRM客户管理 - 报价管理',
  '/crm/contracts': 'CRM客户管理 - 合同管理',
  '/crm/feedbacks': 'CRM客户管理 - 客户反馈',
  '/crm/commission/rules': 'CRM客户管理 - 佣金规则',
  '/crm/commission/records': 'CRM客户管理 - 佣金记录',
  '/crm/commission/penalties': 'CRM客户管理 - 罚款记录',
  '/crm/commission/settlements': 'CRM客户管理 - 佣金结算',
  '/crm/business-info': 'CRM客户管理 - 经营信息',
  // 供应商管理
  '/suppliers': '供应商管理 - 供应商概览',
  '/suppliers/list': '供应商管理 - 供应商列表',
  '/suppliers/manage': '供应商管理 - 供应商管理',
  '/suppliers/prices': '供应商管理 - 供应商价格',
  '/suppliers/import': '供应商管理 - 价格导入',
  // 财务管理
  '/finance': '财务管理 - 财务概览',
  '/finance/invoices': '财务管理 - 发票管理',
  '/finance/invoices/history': '财务管理 - 发票历史',
  '/finance/invoices/create': '财务管理 - 新建发票',
  '/finance/payments': '财务管理 - 收付款',
  '/finance/fees': '财务管理 - 费用管理',
  '/finance/fee-approval': '财务管理 - 费用审批',
  '/finance/reports': '财务管理 - 报表分析',
  '/finance/order-report': '财务管理 - 订单报表',
  '/finance/statements': '财务管理 - 财务报表',
  '/finance/bank-accounts': '财务管理 - 银行账户',
  '/finance/carrier-settlement': '财务管理 - 承运商结算',
  '/finance/fee-approvals': '财务管理 - 费用审批',
  '/finance/commission': '财务管理 - 佣金管理',
  '/finance/commission/rules': '财务管理 - 佣金规则',
  '/finance/commission/records': '财务管理 - 佣金记录',
  '/finance/commission/penalties': '财务管理 - 罚款记录',
  '/finance/commission/settlements': '财务管理 - 佣金结算',
  '/supplement-fee': '财务管理 - 追加费用',
  // 合同管理
  '/contracts': '合同管理 - 合同概览',
  '/contracts/config': '合同管理 - 合同模板配置',
  // 工具
  '/tools': '工具 - 工具概览',
  '/tools/inquiry': '工具 - 服务费配置',
  '/tools/shared-tax': '工具 - 共享税号库',
  '/tools/product-pricing': '工具 - 产品定价',
  // 帮助中心
  '/help': '帮助中心 - 帮助概览',
  '/help/videos': '帮助中心 - 视频管理',
  // 系统管理
  '/system': '系统管理 - 系统概览',
  '/system/info-center': '系统管理 - 信息中心',
  '/system/data-import': '系统管理 - 数据导入',
  '/system/menu-settings': '系统管理 - 板块开关',
  '/system/user-manage': '系统管理 - 用户管理',
  '/system/user-manage/permissions': '系统管理 - 角色权限',
  '/system/user-binding': '系统管理 - 用户绑定',
  '/system/security-settings': '系统管理 - 安全设置',
  '/system/security-settings/logs': '系统管理 - 安全日志',
  '/system/security-center': '系统管理 - 安全管理中心',
  '/system/activity-logs': '系统管理 - 活动日志',
  '/system/logo-manage': '系统管理 - Logo 管理',
  '/system/basic-data': '系统管理 - 基础数据管理',
  '/system/basic-data/container': '系统管理 - 箱型管理',
  '/system/basic-data/port': '系统管理 - 港口管理',
  '/system/basic-data/destination': '系统管理 - 目的地管理',
  '/system/basic-data/country': '系统管理 - 国家管理',
  '/system/basic-data/fee-category': '系统管理 - 费用类目',
  '/system/basic-data/transport-method': '系统管理 - 运输方式',
  '/system/tariff-rates': '系统管理 - HS Code数据库',
  '/system/tariff-lookup': '系统管理 - 税率查询',
  '/system/invoice-templates': '系统管理 - 发票模板编辑',
  '/system/approvals': '系统管理 - 审批工作台',
  '/system/approval-center': '系统管理 - 审批中心',
  '/system/approval-settings': '系统管理 - 审批权限设置',
  '/system/messages': '系统管理 - 消息中心',
  '/system/alerts': '系统管理 - 预警管理',
  '/system/api-integrations': '系统管理 - API对接管理',
  '/system/subscriptions': '系统管理 - 服务订阅管理',
  // HS编码查询
  '/hs/search': 'HS Code - 编码查询',
  // 供应商比价
  '/suppliers/compare': '供应商管理 - 价格比较',
}

// 模块前缀映射（用于动态路由的回退）
const moduleNameMap: Record<string, string> = {
  'bookings': '订单管理',
  'documents': '单证管理',
  'document-center': '单证管理',
  'inspection': '查验管理',
  'tms': 'TMS运输管理',
  'cmr-manage': 'TMS运输管理',
  'last-mile': 'TMS运输管理',
  'crm': 'CRM客户管理',
  'suppliers': '供应商管理',
  'finance': '财务管理',
  'supplement-fee': '财务管理',
  'contracts': '合同管理',
  'tools': '工具',
  'help': '帮助中心',
  'system': '系统管理',
  'hs': 'HS Code',
}

// 获取路由标题
export function getRouteTitle(path: string): string {
  // 精确匹配
  if (routeTitleMap[path]) {
    return routeTitleMap[path]
  }
  
  // 处理动态路由，如 /bookings/bill/:id
  const pathParts = path.split('/').filter(Boolean) // 移除空字符串
  
  // 处理详情页面
  if (pathParts[0] === 'bookings' && pathParts[1] === 'bill' && pathParts[2]) {
    return '订单管理 - 提单详情'
  }
  if (pathParts[0] === 'cmr-manage' && pathParts[1]) {
    return 'TMS运输管理 - CMR详情'
  }
  if (pathParts[0] === 'inspection' && pathParts[1] && pathParts[1] !== 'pending' && pathParts[1] !== 'released') {
    return '查验管理 - 查验详情'
  }
  if (pathParts[0] === 'crm' && pathParts[1] === 'customers' && pathParts[2]) {
    if (pathParts[3] === 'edit') return 'CRM客户管理 - 编辑客户'
    return 'CRM客户管理 - 客户详情'
  }
  if (pathParts[0] === 'crm' && pathParts[1] === 'bill' && pathParts[2]) {
    return 'CRM客户管理 - 订单详情'
  }
  if (pathParts[0] === 'finance' && pathParts[1] === 'invoices' && pathParts[2]) {
    if (pathParts[3] === 'edit') return '财务管理 - 编辑发票'
    if (pathParts[3] === 'payment') return '财务管理 - 登记付款'
    return '财务管理 - 发票详情'
  }
  if (pathParts[0] === 'finance' && pathParts[1] === 'payments' && pathParts[2]) {
    return '财务管理 - 收付款详情'
  }
  if (pathParts[0] === 'finance' && pathParts[1] === 'bill-details' && pathParts[2]) {
    return '财务管理 - 订单详情'
  }
  if (pathParts[0] === 'contracts' && pathParts[1] === 'preview' && pathParts[2]) {
    return '合同管理 - 合同预览'
  }
  if (pathParts[0] === 'supplement-fee' && pathParts[1]) {
    return '财务管理 - 追加费用'
  }
  if (pathParts[0] === 'last-mile' && pathParts[1]) {
    return 'TMS运输管理 - 最后里程'
  }
  // HS编码详情页
  if (pathParts[0] === 'hs' && pathParts[1] && pathParts[1] !== 'search') {
    return `HS Code - ${pathParts[1]}`
  }
  
  // 使用模块前缀映射作为回退，生成更明确的标题
  const moduleName = moduleNameMap[pathParts[0]]
  if (moduleName) {
    // 尝试从路径中提取子页面名称
    const subPage = pathParts[1] || '概览'
    // 将英文路径转为更友好的显示
    const subPageMap: Record<string, string> = {
      'list': '列表',
      'detail': '详情',
      'edit': '编辑',
      'create': '新建',
      'new': '新建',
      'manage': '管理',
      'settings': '设置',
      'config': '配置',
      'import': '导入',
      'export': '导出',
      'search': '查询',
      'overview': '概览',
    }
    const displaySubPage = subPageMap[subPage] || subPage
    return `${moduleName} - ${displaySubPage}`
  }
  
  // 最后的回退：使用路径作为标题（避免显示简单的"页面"）
  return path.replace(/^\//, '').replace(/\//g, ' - ') || '首页'
}

// Storage key
const STORAGE_KEY = 'sysafari_tabs'

// 已弃用的路由（这些路由已被移除或合并，需要自动清理）
const DEPRECATED_ROUTES = [
  '/bp-view',
  '/bp-view/history',
]

// 首页标签
const HOME_TAB: Tab = {
  key: '/',
  title: '首页',
  closable: false
}

// 初始状态
const initialState: TabsState = {
  tabs: [HOME_TAB],
  activeKey: '/'
}

// Reducer
function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'INIT':
      return action.payload

    case 'ADD_TAB': {
      const exists = state.tabs.find(tab => tab.key === action.payload.key)
      if (exists) {
        // 已存在，只切换激活状态
        return { ...state, activeKey: action.payload.key }
      }
      // 添加新标签
      return {
        tabs: [...state.tabs, action.payload],
        activeKey: action.payload.key
      }
    }

    case 'REMOVE_TAB': {
      const index = state.tabs.findIndex(tab => tab.key === action.payload)
      if (index === -1) return state
      
      const tab = state.tabs[index]
      if (!tab.closable) return state // 不可关闭的标签
      
      const newTabs = state.tabs.filter(t => t.key !== action.payload)
      
      // 如果关闭的是当前激活标签，切换到相邻标签
      let newActiveKey = state.activeKey
      if (state.activeKey === action.payload) {
        // 优先切换到右侧标签，没有则切换到左侧
        if (index < newTabs.length) {
          newActiveKey = newTabs[index].key
        } else if (index > 0) {
          newActiveKey = newTabs[index - 1].key
        } else {
          newActiveKey = '/'
        }
      }
      
      return { tabs: newTabs, activeKey: newActiveKey }
    }

    case 'REMOVE_OTHERS': {
      // 保留首页和当前激活的标签
      const newTabs = state.tabs.filter(
        tab => !tab.closable || tab.key === state.activeKey
      )
      return { ...state, tabs: newTabs }
    }

    case 'REMOVE_ALL': {
      // 只保留首页
      return { tabs: [HOME_TAB], activeKey: '/' }
    }

    case 'SET_ACTIVE':
      return { ...state, activeKey: action.payload }

    case 'UPDATE_TAB_TITLE': {
      const { key, title } = action.payload
      const newTabs = state.tabs.map(tab => 
        tab.key === key ? { ...tab, title } : tab
      )
      return { ...state, tabs: newTabs }
    }

    case 'REORDER_TABS': {
      const { fromIndex, toIndex } = action.payload
      // 不能移动首页标签（index 0）
      if (fromIndex === 0 || toIndex === 0) return state
      if (fromIndex === toIndex) return state
      if (fromIndex < 0 || fromIndex >= state.tabs.length) return state
      if (toIndex < 0 || toIndex >= state.tabs.length) return state
      
      const newTabs = [...state.tabs]
      const [movedTab] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, movedTab)
      return { ...state, tabs: newTabs }
    }

    default:
      return state
  }
}

// Context
interface TabsContextValue {
  tabs: Tab[]
  activeKey: string
  addTab: (path: string, title?: string) => void
  removeTab: (key: string) => void
  removeOthers: () => void
  removeAll: () => void
  setActiveTab: (key: string) => void
  updateTabTitle: (key: string, title: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

// Provider
export function TabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tabsReducer, initialState)
  const navigate = useNavigate()
  const location = useLocation()

  // 从 sessionStorage 恢复状态
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as TabsState
        
        // 过滤掉已弃用的路由标签页
        parsed.tabs = parsed.tabs.filter(tab => {
          const isDeprecated = DEPRECATED_ROUTES.some(route => 
            tab.key === route || tab.key.startsWith(route + '/')
          )
          if (isDeprecated) {
            console.log(`[TabsContext] 移除已弃用的标签页: ${tab.key}`)
          }
          return !isDeprecated
        })
        
        // 如果当前激活的标签页是已弃用的路由，切换到首页
        if (DEPRECATED_ROUTES.some(route => 
          parsed.activeKey === route || parsed.activeKey.startsWith(route + '/')
        )) {
          parsed.activeKey = '/'
        }
        
        // 确保首页标签存在且不可关闭
        const hasHome = parsed.tabs.some(tab => tab.key === '/')
        if (!hasHome) {
          parsed.tabs.unshift(HOME_TAB)
        } else {
          // 确保首页不可关闭
          const homeIndex = parsed.tabs.findIndex(tab => tab.key === '/')
          if (homeIndex !== -1) {
            parsed.tabs[homeIndex].closable = false
          }
        }
        dispatch({ type: 'INIT', payload: parsed })
      }
    } catch (e) {
      console.error('Failed to restore tabs:', e)
    }
  }, [])

  // 保存状态到 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save tabs:', e)
    }
  }, [state])

  // 监听路由变化，自动添加标签
  useEffect(() => {
    const path = location.pathname
    // 跳过登录页
    if (path === '/login') return
    
    const title = getRouteTitle(path)
    const isHome = path === '/' || path === '/dashboard'
    
    dispatch({
      type: 'ADD_TAB',
      payload: {
        key: isHome ? '/' : path,
        title,
        closable: !isHome
      }
    })
  }, [location.pathname])

  // 添加标签
  const addTab = useCallback((path: string, title?: string) => {
    const isHome = path === '/' || path === '/dashboard'
    dispatch({
      type: 'ADD_TAB',
      payload: {
        key: isHome ? '/' : path,
        title: title || getRouteTitle(path),
        closable: !isHome
      }
    })
    navigate(path)
  }, [navigate])

  // 关闭标签
  const removeTab = useCallback((key: string) => {
    const tab = state.tabs.find(t => t.key === key)
    if (!tab || !tab.closable) return
    
    dispatch({ type: 'REMOVE_TAB', payload: key })
    
    // 如果关闭的是当前标签，需要导航到新的激活标签
    if (state.activeKey === key) {
      const index = state.tabs.findIndex(t => t.key === key)
      const newTabs = state.tabs.filter(t => t.key !== key)
      let newPath = '/'
      if (index < newTabs.length) {
        newPath = newTabs[index].key
      } else if (index > 0) {
        newPath = newTabs[index - 1].key
      }
      navigate(newPath)
    }
  }, [state.tabs, state.activeKey, navigate])

  // 关闭其他
  const removeOthers = useCallback(() => {
    dispatch({ type: 'REMOVE_OTHERS' })
  }, [])

  // 关闭全部
  const removeAll = useCallback(() => {
    dispatch({ type: 'REMOVE_ALL' })
    navigate('/')
  }, [navigate])

  // 切换标签
  const setActiveTab = useCallback((key: string) => {
    dispatch({ type: 'SET_ACTIVE', payload: key })
    navigate(key)
  }, [navigate])

  // 更新标签标题
  const updateTabTitle = useCallback((key: string, title: string) => {
    dispatch({ type: 'UPDATE_TAB_TITLE', payload: { key, title } })
  }, [])

  // 重新排序标签（拖拽）
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_TABS', payload: { fromIndex, toIndex } })
  }, [])

  return (
    <TabsContext.Provider value={{
      tabs: state.tabs,
      activeKey: state.activeKey,
      addTab,
      removeTab,
      removeOthers,
      removeAll,
      setActiveTab,
      updateTabTitle,
      reorderTabs
    }}>
      {children}
    </TabsContext.Provider>
  )
}

// Hook
export function useTabs() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('useTabs must be used within a TabsProvider')
  }
  return context
}
