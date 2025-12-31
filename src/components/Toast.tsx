import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X, Download } from 'lucide-react'

// 全局复制提示函数（供不在 React 组件中使用）
let globalShowCopyToast: ((text: string) => void) | null = null

function setGlobalShowCopyToast(fn: ((text: string) => void) | null) {
  globalShowCopyToast = fn
}

/**
 * 通用复制到剪贴板函数
 * 可在整个系统中使用，会自动显示复制成功提示
 */
export async function copyToClipboard(text: string, e?: React.MouseEvent): Promise<boolean> {
  if (e) {
    e.stopPropagation()
  }
  if (!text || text === '-') return false
  
  try {
    await navigator.clipboard.writeText(text)
    // 显示全局提示
    if (globalShowCopyToast) {
      globalShowCopyToast(text)
    }
    return true
  } catch (err) {
    console.error('复制失败:', err)
    return false
  }
}

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'download'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void
  showDownloadSuccess: (fileName?: string) => void
  showCopySuccess: (text: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

// Toast 图标配置
const toastConfig: Record<ToastType, { icon: typeof CheckCircle; bgColor: string; textColor: string; borderColor: string }> = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-200'
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-200'
  },
  download: {
    icon: Download,
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-200'
  }
}

// 单个 Toast 组件
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = toastConfig[toast.type]
  const Icon = config.icon

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast.duration, onClose])

  return (
    <div 
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${config.bgColor} ${config.borderColor} animate-slide-in`}
      style={{ minWidth: '280px', maxWidth: '400px' }}
    >
      <Icon className={`w-5 h-5 ${config.textColor} flex-shrink-0`} />
      <p className={`text-sm ${config.textColor} flex-1`}>{toast.message}</p>
      <button 
        onClick={onClose}
        className={`${config.textColor} hover:opacity-70 flex-shrink-0`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Toast 容器
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onClose={() => removeToast(toast.id)} 
        />
      ))}
    </div>
  )
}

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, type, message, duration }])
  }, [])

  const showDownloadSuccess = useCallback((fileName?: string) => {
    const message = fileName 
      ? `文件 "${fileName}" 下载成功` 
      : '文件下载成功'
    showToast('download', message, 3000)
  }, [showToast])

  const showCopySuccess = useCallback((text: string) => {
    const displayText = text.length > 25 ? text.substring(0, 25) + '...' : text
    showToast('success', `已复制: ${displayText}`, 1500)
  }, [showToast])

  // 设置全局复制提示函数
  useEffect(() => {
    setGlobalShowCopyToast(showCopySuccess)
    return () => setGlobalShowCopyToast(null)
  }, [showCopySuccess])

  return (
    <ToastContext.Provider value={{ showToast, showDownloadSuccess, showCopySuccess }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

// Hook
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// 全局样式（添加到 index.css）
export const toastStyles = `
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
`

export default ToastProvider
