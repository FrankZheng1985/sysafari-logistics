import { ReactNode, useMemo } from 'react'
import { FlaskConical, AlertTriangle } from 'lucide-react'
import Sidebar, { SidebarProvider, MobileMenuOverlay } from './Sidebar'
import Header from './Header'
import TabsBar from './TabsBar'
import ContextualHelp from './ContextualHelp'
import KeepAliveOutlet from './KeepAliveOutlet'
import ImportProgressFloat from './ImportProgressFloat'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
}

// 判断是否是演示环境
export function isDemoEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  return hostname === 'demo.xianfeng-eu.com' || hostname.includes('demo.')
}

export default function Layout({ children }: LayoutProps) {
  const { isTestMode } = useAuth()
  
  // 检测是否是演示环境
  const isDemo = useMemo(() => isDemoEnvironment(), [])

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
        {/* 移动端遮罩层 */}
        <MobileMenuOverlay />
        
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* 演示环境横幅 - 始终显示在演示环境 */}
          {isDemo && (
            <div className="bg-orange-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium shadow-md">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">演示系统 - 此环境仅供演示和测试使用，数据可能会被定期清理</span>
              <span className="sm:hidden">演示系统</span>
            </div>
          )}
          {/* 测试模式横幅 - 仅在测试用户登录时显示（非演示环境下） */}
          {!isDemo && isTestMode && (
            <div className="bg-amber-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">测试模式 - 当前显示的是模拟数据，仅供演示使用</span>
              <span className="sm:hidden">测试模式</span>
            </div>
          )}
          <Header />
          <TabsBar />
          <main className="flex-1 overflow-y-auto bg-gray-50 overscroll-none">
            <KeepAliveOutlet>
              {children}
            </KeepAliveOutlet>
          </main>
        </div>
        {/* 全局上下文帮助按钮 */}
        <ContextualHelp />
        
        {/* 全局导入进度悬浮组件 - 支持多任务并行 */}
        <ImportProgressFloat />
      </div>
    </SidebarProvider>
  )
}
