import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// 缓存的组件信息
interface CachedComponent {
  key: string          // 路由路径作为key
  element: ReactNode   // 缓存的React元素
  scrollTop: number    // 滚动位置
}

// Context 值类型
interface KeepAliveContextValue {
  // 缓存的组件列表
  cachedComponents: CachedComponent[]
  // 当前激活的路由
  activeKey: string
  // 缓存一个组件
  cacheComponent: (key: string, element: ReactNode) => void
  // 移除缓存
  removeCache: (key: string) => void
  // 清空所有缓存
  clearAllCache: () => void
  // 检查是否已缓存
  isCached: (key: string) => boolean
  // 需要缓存的路由列表
  keepAliveRoutes: string[]
}

const KeepAliveContext = createContext<KeepAliveContextValue | null>(null)

// 需要保持状态的路由列表
// 这些页面在切换时不会被卸载
const KEEP_ALIVE_ROUTES = [
  '/finance/invoices/create',  // 新建发票
  '/finance/invoices/\\d+/edit', // 编辑发票（正则匹配）
]

// 检查路由是否需要缓存
function shouldKeepAlive(path: string, routes: string[]): boolean {
  return routes.some(route => {
    // 支持正则匹配
    if (route.includes('\\')) {
      const regex = new RegExp(`^${route}$`)
      return regex.test(path)
    }
    return path === route || path.startsWith(route + '?')
  })
}

// Provider 组件
export function KeepAliveProvider({ children }: { children: ReactNode }) {
  const [cachedComponents, setCachedComponents] = useState<CachedComponent[]>([])
  const location = useLocation()
  const activeKey = location.pathname
  const scrollPositions = useRef<Record<string, number>>({})

  // 保存当前页面的滚动位置
  useEffect(() => {
    const handleScroll = () => {
      const mainContent = document.querySelector('main')
      if (mainContent && shouldKeepAlive(activeKey, KEEP_ALIVE_ROUTES)) {
        scrollPositions.current[activeKey] = mainContent.scrollTop
      }
    }

    const mainContent = document.querySelector('main')
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll)
      return () => mainContent.removeEventListener('scroll', handleScroll)
    }
  }, [activeKey])

  // 缓存组件
  const cacheComponent = useCallback((key: string, element: ReactNode) => {
    setCachedComponents(prev => {
      const exists = prev.find(c => c.key === key)
      if (exists) {
        // 更新已存在的缓存
        return prev.map(c => c.key === key ? { ...c, element } : c)
      }
      // 添加新缓存
      return [...prev, { key, element, scrollTop: 0 }]
    })
  }, [])

  // 移除缓存
  const removeCache = useCallback((key: string) => {
    setCachedComponents(prev => prev.filter(c => c.key !== key))
    delete scrollPositions.current[key]
  }, [])

  // 清空所有缓存
  const clearAllCache = useCallback(() => {
    setCachedComponents([])
    scrollPositions.current = {}
  }, [])

  // 检查是否已缓存
  const isCached = useCallback((key: string) => {
    return cachedComponents.some(c => c.key === key)
  }, [cachedComponents])

  return (
    <KeepAliveContext.Provider value={{
      cachedComponents,
      activeKey,
      cacheComponent,
      removeCache,
      clearAllCache,
      isCached,
      keepAliveRoutes: KEEP_ALIVE_ROUTES
    }}>
      {children}
    </KeepAliveContext.Provider>
  )
}

// Hook
export function useKeepAlive() {
  const context = useContext(KeepAliveContext)
  if (!context) {
    throw new Error('useKeepAlive must be used within a KeepAliveProvider')
  }
  return context
}

// 检查当前路由是否需要保持
export function useIsKeepAlivePage() {
  const location = useLocation()
  return shouldKeepAlive(location.pathname, KEEP_ALIVE_ROUTES)
}

// 导出工具函数
export { shouldKeepAlive, KEEP_ALIVE_ROUTES }

