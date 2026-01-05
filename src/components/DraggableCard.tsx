import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { ReactNode } from 'react'

interface DraggableCardProps {
  id: string
  children: ReactNode
  className?: string
  disabled?: boolean
  darkMode?: boolean // 用于深色背景卡片
}

export default function DraggableCard({ id, children, className = '', disabled = false, darkMode = false }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${className} ${isDragging ? 'shadow-2xl ring-2 ring-primary-400 scale-[1.02]' : ''}`}
    >
      {/* 拖拽手柄 */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className={`absolute top-2 right-2 z-10 p-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all duration-200
            ${isDragging 
              ? darkMode 
                ? 'bg-white/30 text-white' 
                : 'bg-primary-100 text-primary-600'
              : darkMode
                ? 'bg-white/10 text-white/60 opacity-0 group-hover:opacity-100 hover:bg-white/20 hover:text-white'
                : 'bg-gray-100/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600'
            }`}
          title="拖拽调整位置"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {children}
    </div>
  )
}

