import { useState, useRef, useCallback, useEffect, ReactNode, MouseEvent } from 'react'
import { X, GripHorizontal } from 'lucide-react'

interface DraggableModalProps {
  visible: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string // 如: 'max-w-lg', 'max-w-2xl', 'max-w-4xl'
  footer?: ReactNode
  showCloseButton?: boolean
  className?: string
}

/**
 * 可拖拽模态框组件
 * 支持通过拖拽标题栏移动模态框位置
 */
export default function DraggableModal({
  visible,
  onClose,
  title,
  children,
  width = 'max-w-lg',
  footer,
  showCloseButton = true,
  className = '',
}: DraggableModalProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const modalRef = useRef<HTMLDivElement>(null)

  // 重置位置当模态框关闭或重新打开
  useEffect(() => {
    if (visible) {
      setPosition({ x: 0, y: 0 })
    }
  }, [visible])

  // 处理拖拽开始
  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // 只允许通过标题栏拖拽
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
      e.preventDefault()
    }
  }, [position])

  // 处理拖拽移动
  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // 限制模态框不能完全移出视口
      const modal = modalRef.current
      if (modal) {
        const rect = modal.getBoundingClientRect()
        const maxX = window.innerWidth - rect.width / 2
        const maxY = window.innerHeight - 50 // 至少保留50px可见
        const minX = -rect.width / 2
        const minY = -rect.height + 50
        
        setPosition({
          x: Math.max(minX, Math.min(maxX, newX)),
          y: Math.max(minY, Math.min(maxY, newY)),
        })
      } else {
        setPosition({ x: newX, y: newY })
      }
    }
  }, [isDragging, dragStart])

  // 处理拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 添加和移除全局事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'move'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={modalRef}
        className={`bg-white rounded-lg shadow-xl w-full ${width} mx-4 flex flex-col max-h-[90vh] ${className}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'move' : 'default',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 标题栏 - 可拖拽区域 */}
        <div className="modal-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg cursor-move select-none">
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* 底部按钮区域 */}
        {footer && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 模态框内容包装组件 - 用于统一内边距
 */
export function ModalContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  )
}

/**
 * 模态框按钮组件
 */
export function ModalButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  loading = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  loading?: boolean
  className?: string
}) {
  const baseClass = 'px-3 py-1.5 text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1'
  const variantClass = {
    default: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClass} ${variantClass[variant]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  )
}

