import { useState, useRef } from 'react'
import { X, GripVertical } from 'lucide-react'
import { useTabs } from '../contexts/TabsContext'

export default function TabsBar() {
  const { tabs, activeKey, setActiveTab, removeTab, removeOthers, removeAll, reorderTabs } = useTabs()
  
  // 拖拽状态
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  // 是否有可关闭的标签
  const hasClosableTabs = tabs.some(tab => tab.closable)
  // 是否有多个可关闭的标签（用于判断"关闭其他"按钮）
  const hasMultipleClosable = tabs.filter(tab => tab.closable).length > 1 || 
    (tabs.filter(tab => tab.closable).length === 1 && tabs.find(tab => tab.closable)?.key !== activeKey)

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    // 首页不能拖拽
    if (index === 0) {
      e.preventDefault()
      return
    }
    
    setDragIndex(index)
    dragNodeRef.current = e.currentTarget
    
    // 设置拖拽效果
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    
    // 延迟添加拖拽样式，避免立即显示
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.5'
      }
    }, 0)
  }

  // 拖拽结束
  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1'
    }
    
    // 执行重新排序
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      reorderTabs(dragIndex, dropIndex)
    }
    
    setDragIndex(null)
    setDropIndex(null)
    dragNodeRef.current = null
  }

  // 拖拽经过
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // 首页不能作为放置目标
    if (index === 0) return
    
    if (dragIndex !== null && index !== dragIndex) {
      setDropIndex(index)
    }
  }

  // 拖拽离开
  const handleDragLeave = () => {
    // 不立即清除，让视觉效果更平滑
  }

  // 放置
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    // 放置逻辑在 handleDragEnd 中处理
  }

  return (
    <div className="bg-white border-b border-gray-200 px-2 py-1.5 flex items-center justify-between min-w-0">
      {/* 标签列表 */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide min-w-0">
        {tabs.map((tab, index) => {
          const isDragging = dragIndex === index
          const isDropTarget = dropIndex === index && dragIndex !== null
          const canDrag = index !== 0 // 首页不能拖拽
          
          return (
            <div
              key={tab.key}
              draggable={canDrag}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => setActiveTab(tab.key)}
              className={`
                group flex items-center gap-1 px-2 py-1 rounded cursor-pointer
                text-xs whitespace-nowrap transition-all duration-150
                ${activeKey === tab.key
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }
                ${isDragging ? 'opacity-50' : ''}
                ${isDropTarget ? 'ring-2 ring-primary-400 ring-offset-1' : ''}
                ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}
              `}
            >
              {/* 拖拽手柄 - 仅可关闭的标签显示 */}
              {canDrag && (
                <GripVertical 
                  className={`
                    w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity
                    ${activeKey === tab.key ? 'text-white/70' : 'text-gray-400'}
                  `} 
                />
              )}
              
              <span className="max-w-[100px] sm:max-w-[150px] truncate" title={tab.title}>{tab.title}</span>
              
              {tab.closable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTab(tab.key)
                  }}
                  className={`
                    ml-0.5 p-0.5 rounded transition-colors flex-shrink-0
                    ${activeKey === tab.key
                      ? 'hover:bg-primary-400 text-white/70 hover:text-white'
                      : 'hover:bg-red-100 text-gray-400 hover:text-red-600'
                    }
                  `}
                  title="关闭"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* 批量操作按钮 */}
      {hasClosableTabs && (
        <div className="hidden sm:flex items-center gap-1 ml-2 flex-shrink-0 pl-2 border-l border-gray-200">
          {hasMultipleClosable && (
            <button
              onClick={removeOthers}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors whitespace-nowrap"
            >
              关闭其他
            </button>
          )}
          <button
            onClick={removeAll}
            className="px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors whitespace-nowrap"
          >
            关闭全部
          </button>
        </div>
      )}
    </div>
  )
}
