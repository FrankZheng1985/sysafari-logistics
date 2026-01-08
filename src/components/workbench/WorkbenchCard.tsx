import { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { CardId } from '../../hooks/useWorkbenchConfig'

interface WorkbenchCardProps {
  id: CardId
  title: string
  icon: string
  size?: 'small' | 'medium' | 'large'
  children: ReactNode
}

export default function WorkbenchCard({ 
  id, 
  title, 
  icon, 
  size = 'small',
  children 
}: WorkbenchCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  // 根据尺寸决定跨列数
  const sizeClass = {
    small: '',
    medium: 'md:col-span-2',
    large: 'md:col-span-2 lg:col-span-3 xl:col-span-4',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative group bg-white rounded-lg border border-gray-200 shadow-sm
        ${sizeClass[size]}
        ${isDragging ? 'shadow-xl ring-2 ring-primary-400 scale-[1.02]' : 'hover:shadow-md'}
        transition-shadow
      `}
    >
      {/* 卡片头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        </div>
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className={`
            p-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all duration-200
            ${isDragging 
              ? 'bg-primary-100 text-primary-600' 
              : 'bg-gray-50 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600'
            }
          `}
          title="拖拽调整位置"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
      
      {/* 卡片内容 */}
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
