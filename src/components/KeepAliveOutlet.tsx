import { ReactNode, useEffect, useRef, memo, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useKeepAlive, shouldKeepAlive, KEEP_ALIVE_ROUTES } from '../contexts/KeepAliveContext'
import { useTabs } from '../contexts/TabsContext'

interface KeepAliveOutletProps {
  children: ReactNode
}

// 缓存的页面容器
const CachedPage = memo(({ 
  pageKey, 
  isActive, 
  children 
}: { 
  pageKey: string
  isActive: boolean
  children: ReactNode 
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // 恢复滚动位置
  useLayoutEffect(() => {
    if (isActive && containerRef.current) {
      // 页面激活时，确保内容可见
      containerRef.current.style.display = 'block'
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className="keep-alive-page"
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%'
      }}
      data-keep-alive-key={pageKey}
    >
      {children}
    </div>
  )
})

CachedPage.displayName = 'CachedPage'

/**
 * KeepAliveOutlet - 支持页面缓存的内容区域
 * 
 * 对于配置在 KEEP_ALIVE_ROUTES 中的路由，切换时不会卸载组件，
 * 而是通过 display: none 隐藏，保持组件状态。
 */
export default function KeepAliveOutlet({ children }: KeepAliveOutletProps) {
  const location = useLocation()
  const { cachedComponents, cacheComponent, removeCache } = useKeepAlive()
  const { tabs } = useTabs()
  const currentPath = location.pathname
  const isCurrentKeepAlive = shouldKeepAlive(currentPath, KEEP_ALIVE_ROUTES)
  const prevPathRef = useRef(currentPath)

  // 当路由变化时，缓存需要保持的页面
  useEffect(() => {
    if (isCurrentKeepAlive && children) {
      // 当前页面需要缓存，添加到缓存列表
      cacheComponent(currentPath, children)
    }
    prevPathRef.current = currentPath
  }, [currentPath, isCurrentKeepAlive, children, cacheComponent])

  // 当标签页关闭时，清除对应的缓存
  useEffect(() => {
    const tabKeys = tabs.map(t => t.key)
    cachedComponents.forEach(cached => {
      // 如果缓存的页面对应的标签不存在了，清除缓存
      if (!tabKeys.includes(cached.key)) {
        removeCache(cached.key)
      }
    })
  }, [tabs, cachedComponents, removeCache])

  // 渲染缓存的组件和当前组件
  return (
    <>
      {/* 渲染所有缓存的 KeepAlive 页面 */}
      {cachedComponents.map(cached => (
        <CachedPage
          key={cached.key}
          pageKey={cached.key}
          isActive={cached.key === currentPath}
        >
          {cached.element}
        </CachedPage>
      ))}
      
      {/* 如果当前页面不需要缓存，正常渲染 */}
      {!isCurrentKeepAlive && (
        <div style={{ height: '100%', width: '100%' }}>
          {children}
        </div>
      )}
    </>
  )
}

