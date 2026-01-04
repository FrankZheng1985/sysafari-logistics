import { ReactNode, useRef, memo, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { shouldKeepAlive, KEEP_ALIVE_ROUTES } from '../contexts/KeepAliveContext'
import { useTabs } from '../contexts/TabsContext'
import CreateInvoice from '../pages/CreateInvoice'

interface KeepAliveOutletProps {
  children: ReactNode
}

// KeepAlive 页面配置
// key: 路由路径, value: 组件
const KEEP_ALIVE_COMPONENTS: Record<string, React.ComponentType> = {
  '/finance/invoices/create': CreateInvoice,
}

// 缓存的页面容器 - 使用 memo 防止不必要的重渲染
const KeepAlivePage = memo(({ 
  pageKey, 
  isActive,
  Component
}: { 
  pageKey: string
  isActive: boolean
  Component: React.ComponentType
}) => {
  return (
    <div
      className="keep-alive-page"
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%'
      }}
      data-keep-alive-key={pageKey}
    >
      <Component />
    </div>
  )
}, (prevProps, nextProps) => {
  // 只有 isActive 变化时才重新渲染容器
  // 组件内部状态不会因为这个而丢失
  return prevProps.isActive === nextProps.isActive && prevProps.pageKey === nextProps.pageKey
})

KeepAlivePage.displayName = 'KeepAlivePage'

/**
 * KeepAliveOutlet - 支持页面缓存的内容区域
 * 
 * 实现原理：
 * 1. KeepAlive 页面直接在此组件中渲染（不通过 React Router 的 Routes）
 * 2. 通过 display: none/block 来切换显示，组件不会被卸载
 * 3. 非 KeepAlive 页面正常通过 children（Routes 渲染的内容）显示
 * 
 * 这样可以确保：
 * - KeepAlive 组件只会被创建一次
 * - 切换页面时组件状态保持不变
 * - 关闭标签页时组件会被销毁
 */
export default function KeepAliveOutlet({ children }: KeepAliveOutletProps) {
  const location = useLocation()
  const { tabs } = useTabs()
  const currentPath = location.pathname
  const isCurrentKeepAlive = shouldKeepAlive(currentPath, KEEP_ALIVE_ROUTES)
  
  // 追踪哪些 KeepAlive 页面已经被访问过（需要渲染）
  const [mountedPages, setMountedPages] = useState<Set<string>>(new Set())
  const mountedPagesRef = useRef<Set<string>>(new Set())
  
  // 当访问 KeepAlive 页面时，将其添加到已挂载列表
  useEffect(() => {
    if (isCurrentKeepAlive && KEEP_ALIVE_COMPONENTS[currentPath]) {
      if (!mountedPagesRef.current.has(currentPath)) {
        mountedPagesRef.current.add(currentPath)
        setMountedPages(new Set(mountedPagesRef.current))
      }
    }
  }, [currentPath, isCurrentKeepAlive])
  
  // 当标签页关闭时，从已挂载列表中移除（销毁组件）
  useEffect(() => {
    const tabKeys = new Set(tabs.map(t => t.key))
    let hasChanges = false
    
    mountedPagesRef.current.forEach(pagePath => {
      if (!tabKeys.has(pagePath)) {
        mountedPagesRef.current.delete(pagePath)
        hasChanges = true
      }
    })
    
    if (hasChanges) {
      setMountedPages(new Set(mountedPagesRef.current))
    }
  }, [tabs])

  return (
    <>
      {/* 
        渲染所有已访问过的 KeepAlive 页面
        这些组件会一直保持挂载状态，只通过 display 切换显示
      */}
      {Array.from(mountedPages).map(pagePath => {
        const Component = KEEP_ALIVE_COMPONENTS[pagePath]
        if (!Component) return null
        
        return (
          <KeepAlivePage
            key={pagePath}
            pageKey={pagePath}
            isActive={pagePath === currentPath}
            Component={Component}
          />
        )
      })}
      
      {/* 
        非 KeepAlive 页面：正常渲染 Routes 的内容
        当前是 KeepAlive 页面时隐藏这部分
      */}
      <div 
        style={{ 
          display: isCurrentKeepAlive ? 'none' : 'block',
          height: '100%', 
          width: '100%' 
        }}
      >
        {children}
      </div>
    </>
  )
}
