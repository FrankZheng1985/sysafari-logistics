import { ReactNode, useMemo } from 'react'
import { FlaskConical, AlertTriangle, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import TabsBar from './TabsBar'
import ContextualHelp from './ContextualHelp'
import KeepAliveOutlet from './KeepAliveOutlet'
import { useAuth } from '../contexts/AuthContext'
import { useImport } from '../contexts/ImportContext'

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
  const navigate = useNavigate()
  const { state: importState } = useImport()
  
  // 检测是否是演示环境
  const isDemo = useMemo(() => isDemoEnvironment(), [])

  return (
    <div className="flex h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 演示环境横幅 - 始终显示在演示环境 */}
        {isDemo && (
          <div className="bg-orange-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium shadow-md">
            <AlertTriangle className="w-4 h-4" />
            <span>演示系统 - 此环境仅供演示和测试使用，数据可能会被定期清理</span>
          </div>
        )}
        {/* 测试模式横幅 - 仅在测试用户登录时显示（非演示环境下） */}
        {!isDemo && isTestMode && (
          <div className="bg-amber-500 text-white py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
            <FlaskConical className="w-4 h-4" />
            <span>测试模式 - 当前显示的是模拟数据，仅供演示使用</span>
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
      
      {/* 全局导入进度提示 - 位置调整避免与帮助按钮重叠 */}
      {importState.uploading && (
        <div 
          role="button"
          tabIndex={0}
          className="fixed bottom-20 right-6 z-[9999] bg-white rounded-lg shadow-lg border border-primary-200 p-4 max-w-xs cursor-pointer hover:shadow-xl transition-shadow select-none"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('点击导入进度提示')
            navigate('/documents/import')
          }}
        >
          <div className="flex items-start gap-3 pointer-events-none">
            <RefreshCw className="w-5 h-5 text-primary-500 animate-spin flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">正在解析文件...</p>
              <p className="text-xs text-gray-500 mt-1">
                {importState.previewFileName || '正在读取数据和图片'}
              </p>
              {importState.selectedBill && (
                <p className="text-xs text-green-600 mt-1">
                  提单: {importState.selectedBill.billNumber}
                </p>
              )}
              <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                点击查看导入页面
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 导入完成提示 - 当有预览数据但不在导入页面时显示 */}
      {importState.showPreview && !importState.uploading && !window.location.pathname.includes('/documents/import') && (
        <div 
          role="button"
          tabIndex={0}
          className="fixed bottom-20 right-6 z-[9999] bg-white rounded-lg shadow-lg border border-green-200 p-4 max-w-xs cursor-pointer hover:shadow-xl transition-shadow select-none"
          style={{ pointerEvents: 'auto' }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('点击导入完成提示')
            navigate('/documents/import')
          }}
        >
          <div className="flex items-start gap-3 pointer-events-none">
            <FileSpreadsheet className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">文件解析完成</p>
              <p className="text-xs text-gray-500 mt-1">
                共 {importState.previewData.length} 条记录等待确认
              </p>
              <p className="text-xs text-green-600 mt-2 font-medium">
                点击查看预览 →
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

