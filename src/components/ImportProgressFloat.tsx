import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, RefreshCw, Check, X, ChevronUp, ChevronDown, Upload, FileCheck } from 'lucide-react'
import { ImportContext, type ImportTask } from '../contexts/ImportContext'

export default function ImportProgressFloat() {
  const navigate = useNavigate()
  const importContext = useContext(ImportContext)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  
  // 安全检查：如果 Context 不可用（如 HMR 期间），不渲染组件
  if (!importContext) {
    return null
  }
  
  const { state } = importContext

  // 获取正在处理的任务（解析中或导入中）
  const processingTasks = state.tasks.filter(
    task => task.status === 'parsing' || task.status === 'importing'
  )

  // 获取最近完成的任务（5秒内）
  const recentCompletedTasks = state.tasks.filter(
    task => task.status === 'completed' && 
    new Date().getTime() - task.createdAt.getTime() < 30000 // 30秒内
  )

  // 获取错误的任务
  const errorTasks = state.tasks.filter(task => task.status === 'error')

  // 获取待预览的任务
  const previewTasks = state.tasks.filter(task => task.status === 'preview')

  // 如果没有需要显示的任务，不渲染组件
  const totalDisplayTasks = processingTasks.length + recentCompletedTasks.length + errorTasks.length + previewTasks.length
  if (totalDisplayTasks === 0) {
    return null
  }

  const getStatusIcon = (task: ImportTask) => {
    switch (task.status) {
      case 'parsing':
        return <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
      case 'importing':
        return <Upload className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
      case 'preview':
        return <FileCheck className="w-3.5 h-3.5 text-amber-500" />
      case 'completed':
        return <Check className="w-3.5 h-3.5 text-green-500" />
      case 'error':
        return <X className="w-3.5 h-3.5 text-red-500" />
      default:
        return <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  const getStatusText = (task: ImportTask) => {
    switch (task.status) {
      case 'parsing':
        return '解析中...'
      case 'importing':
        return '导入中...'
      case 'preview':
        return '待确认'
      case 'completed':
        return '已完成'
      case 'error':
        return '失败'
      default:
        return '等待中'
    }
  }

  const getStatusColor = (task: ImportTask) => {
    switch (task.status) {
      case 'parsing':
        return 'text-blue-600'
      case 'importing':
        return 'text-purple-600'
      case 'preview':
        return 'text-amber-600'
      case 'completed':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  // 最小化状态
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-primary-600" />
          <span className="text-xs font-medium text-gray-700">
            {processingTasks.length > 0 ? (
              <>
                <span className="text-primary-600">{processingTasks.length}</span> 个任务处理中
              </>
            ) : previewTasks.length > 0 ? (
              <>
                <span className="text-amber-600">{previewTasks.length}</span> 个待确认
              </>
            ) : (
              '导入任务'
            )}
          </span>
          {processingTasks.length > 0 && (
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          )}
        </button>
      </div>
    )
  }

  // 所有要显示的任务
  const displayTasks = [...processingTasks, ...previewTasks, ...errorTasks, ...recentCompletedTasks]

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* 头部 */}
        <div 
          className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-medium text-gray-700">
              导入任务
              {processingTasks.length > 0 && (
                <span className="ml-1 text-primary-600">
                  ({processingTasks.length} 处理中)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsMinimized(true)
              }}
              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
              title="最小化"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* 任务列表 */}
        {isExpanded && (
          <div className="max-h-64 overflow-y-auto">
            {displayTasks.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                暂无任务
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate('/documents/import')}
                  >
                    <div className="flex items-start gap-2">
                      {getStatusIcon(task)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-900 truncate">
                            {task.selectedBill?.billNumber || '未绑定提单'}
                          </span>
                          <span className={`text-[10px] ${getStatusColor(task)}`}>
                            {getStatusText(task)}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                          {task.fileName || '未选择文件'}
                        </div>
                        {task.progress && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {task.progress}
                          </div>
                        )}
                        {task.error && (
                          <div className="text-[10px] text-red-500 mt-0.5">
                            {task.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        {isExpanded && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => navigate('/documents/import')}
              className="w-full text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              查看全部任务 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
