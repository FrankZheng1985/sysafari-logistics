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
  | { type: 'INIT'; payload: TabsState }

// 路由到标题的映射
const routeTitleMap: Record<string, string> = {
  '/': '首页',
  '/dashboard': '首页',
  '/bp-view': 'BP View',
  '/bp-view/history': 'BP 历史',
  '/bookings/labels': '打单管理',
  '/bookings/labels/pure': '纯标签',
  '/bookings/labels/search': '标签查询',
  '/bookings/labels/create-single': '创建单个标签',
  '/bookings/labels/create-batch': '批量创建标签',
  '/bookings/packages': '打包管理',
  '/bookings/bill': '提单管理',
  '/bookings/declarations': '报关管理',
  '/bookings/clearance': '清关文件',
  '/inspection': '查验概览',
  '/inspection/pending': '待查验',
  '/inspection/released': '已放行',
  '/tms': 'TMS概览',
  '/tms/pricing': '运费管理',
  '/tms/conditions': '条件管理',
  '/tms/exceptions': '异常管理',
  '/cmr-manage': 'TMS管理',
  '/last-mile': '最后里程',
  '/last-mile/carriers': '承运商管理',
  '/last-mile/zones': '区域管理',
  '/last-mile/rates': '运费表',
  '/last-mile/import': '运费导入',
  '/last-mile/shipments': '派送单',
  '/last-mile/quote': '快速报价',
  '/crm': 'CRM概览',
  '/crm/customers': '客户管理',
  '/crm/opportunities': '商机管理',
  '/crm/quotations': '报价管理',
  '/crm/contracts': '合同管理',
  '/crm/feedbacks': '客户反馈',
  '/crm/commission/rules': '佣金规则',
  '/crm/commission/records': '佣金记录',
  '/crm/commission/penalties': '罚款记录',
  '/crm/commission/settlements': '佣金结算',
  '/suppliers': '供应商概览',
  '/suppliers/list': '供应商列表',
  '/suppliers/manage': '供应商管理',
  '/suppliers/prices': '供应商价格',
  '/suppliers/import': '价格导入',
  '/finance': '财务概览',
  '/finance/invoices': '发票管理',
  '/finance/invoices/history': '发票历史',
  '/finance/invoices/create': '新建发票',
  '/finance/payments': '收付款',
  '/finance/fees': '费用管理',
  '/finance/reports': '报表分析',
  '/finance/order-report': '订单报表',
  '/finance/statements': '财务报表',
  '/finance/bank-accounts': '银行账户',
  '/finance/carrier-settlement': '承运商结算',
  '/documents': '单证概览',
  '/documents/import': '货物导入',
  '/documents/matching': 'HS匹配审核',
  '/documents/tax-calc': '税费计算',
  '/documents/supplement': '数据补充',
  '/documents/match-records': '匹配记录库',
  '/document-center': '文档中心',
  '/contracts': '合同管理',
  '/contracts/config': '合同模板配置',
  '/tools': '工具',
  '/tools/inquiry': '询价',
  '/tools/tariff-calculator': '关税计算',
  '/tools/shared-tax': '共享税号库',
  '/tools/product-pricing': '报价管理',
  '/system': '系统管理',
  '/system/menu-settings': '板块开关',
  '/system/user-manage': '用户管理',
  '/system/user-manage/permissions': '角色权限',
  '/system/user-binding': '用户绑定',
  '/system/security-settings': '安全设置',
  '/system/security-center': '安全中心',
  '/system/activity-logs': '活动日志',
  '/system/logo-manage': 'Logo管理',
  '/system/basic-data': '基础数据管理',
  '/system/tariff-rates': 'HS Code数据库',
  '/system/approvals': '审批工作台',
  '/system/approval-center': '审批中心',
  '/system/messages': '消息中心',
  '/system/alerts': '预警管理',
  '/system/info-center': '信息中心',
  '/system/api-integrations': 'API对接管理',
}

// 获取路由标题
export function getRouteTitle(path: string): string {
  // 精确匹配
  if (routeTitleMap[path]) {
    return routeTitleMap[path]
  }
  
  // 处理动态路由，如 /bookings/bill/:id
  const pathParts = path.split('/')
  
  // 处理详情页面
  if (pathParts[1] === 'bookings' && pathParts[2] === 'bill' && pathParts[3]) {
    return '提单详情'
  }
  if (pathParts[1] === 'cmr-manage' && pathParts[2]) {
    return 'CMR详情'
  }
  if (pathParts[1] === 'inspection' && pathParts[2]) {
    return '查验详情'
  }
  if (pathParts[1] === 'crm' && pathParts[2] === 'customers' && pathParts[3]) {
    return '客户详情'
  }
  if (pathParts[1] === 'finance' && pathParts[2] === 'invoices' && pathParts[3]) {
    if (pathParts[4] === 'edit') return '编辑发票'
    if (pathParts[4] === 'payment') return '登记付款'
    return '发票详情'
  }
  if (pathParts[1] === 'finance' && pathParts[2] === 'bill-details' && pathParts[3]) {
    return '订单详情'
  }
  if (pathParts[1] === 'contracts' && pathParts[2] === 'preview' && pathParts[3]) {
    return '合同预览'
  }
  
  return '页面'
}

// Storage key
const STORAGE_KEY = 'sysafari_tabs'

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

  return (
    <TabsContext.Provider value={{
      tabs: state.tabs,
      activeKey: state.activeKey,
      addTab,
      removeTab,
      removeOthers,
      removeAll,
      setActiveTab
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
