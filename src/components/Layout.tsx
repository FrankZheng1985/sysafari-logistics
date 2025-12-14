import { ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isTestMode } = useAuth()

  return (
    <div className="flex h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 测试模式横幅 */}
        {isTestMode && (
          <div className="bg-orange-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
            <FlaskConical className="w-4 h-4" />
            <span>测试模式 - 当前显示的是模拟数据，仅供演示使用</span>
          </div>
        )}
        <Header />
        <main className="flex-1 overflow-y-auto bg-white" style={{ backgroundColor: '#ffffff' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

