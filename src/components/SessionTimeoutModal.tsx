/**
 * 会话超时提醒弹窗组件
 * 在用户即将被登出前显示警告，允许用户延长会话
 */

import { useEffect, useState } from 'react'
import { Clock, AlertTriangle, LogOut } from 'lucide-react'
import { formatRemainingTime } from '../hooks/useSessionTimeout'

interface SessionTimeoutModalProps {
  isOpen: boolean
  remainingTime: number // 剩余秒数
  onExtend: () => void // 延长会话
  onLogout: () => void // 立即登出
}

export default function SessionTimeoutModal({
  isOpen,
  remainingTime,
  onExtend,
  onLogout,
}: SessionTimeoutModalProps) {
  const [isClosing, setIsClosing] = useState(false)

  // 当弹窗关闭时重置动画状态
  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false)
    }
  }, [isOpen])

  // 处理延长会话
  const handleExtend = () => {
    setIsClosing(true)
    setTimeout(() => {
      onExtend()
    }, 200)
  }

  // 处理立即登出
  const handleLogout = () => {
    setIsClosing(true)
    setTimeout(() => {
      onLogout()
    }, 200)
  }

  if (!isOpen) return null

  // 计算进度条百分比（60秒警告时间）
  const progressPercent = Math.min(100, (remainingTime / 60) * 100)
  
  // 根据剩余时间确定紧急程度
  const isUrgent = remainingTime <= 30

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-200 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* 弹窗内容 */}
      <div 
        className={`relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-200 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* 顶部警告条 */}
        <div className={`h-1.5 rounded-t-xl transition-colors ${
          isUrgent ? 'bg-red-500' : 'bg-amber-500'
        }`} />
        
        {/* 内容区域 */}
        <div className="p-6">
          {/* 图标和标题 */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-full ${
              isUrgent ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                isUrgent ? 'text-red-600' : 'text-amber-600'
              }`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                会话即将过期
              </h3>
              <p className="text-sm text-gray-500">
                由于长时间未操作，系统即将自动登出
              </p>
            </div>
          </div>

          {/* 倒计时显示 */}
          <div className={`flex items-center justify-center gap-2 py-6 rounded-lg mb-4 ${
            isUrgent ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            <Clock className={`w-8 h-8 ${
              isUrgent ? 'text-red-500 animate-pulse' : 'text-amber-500'
            }`} />
            <span className={`text-3xl font-bold font-mono ${
              isUrgent ? 'text-red-600' : 'text-amber-600'
            }`}>
              {formatRemainingTime(remainingTime)}
            </span>
          </div>

          {/* 进度条 */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${
                isUrgent ? 'bg-red-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>立即登出</span>
            </button>
            <button
              onClick={handleExtend}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <Clock className="w-4 h-4" />
              <span>继续使用</span>
            </button>
          </div>

          {/* 提示信息 */}
          <p className="text-xs text-gray-400 text-center mt-4">
            为保护您的账户安全，系统会在 15 分钟无操作后自动登出
          </p>
        </div>
      </div>
    </div>
  )
}

