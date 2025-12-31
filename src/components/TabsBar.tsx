import { X } from 'lucide-react'
import { useTabs } from '../contexts/TabsContext'

export default function TabsBar() {
  const { tabs, activeKey, setActiveTab, removeTab, removeOthers, removeAll } = useTabs()

  // 是否有可关闭的标签
  const hasClosableTabs = tabs.some(tab => tab.closable)
  // 是否有多个可关闭的标签（用于判断"关闭其他"按钮）
  const hasMultipleClosable = tabs.filter(tab => tab.closable).length > 1 || 
    (tabs.filter(tab => tab.closable).length === 1 && tabs.find(tab => tab.closable)?.key !== activeKey)

  return (
    <div className="bg-white border-b border-gray-200 px-2 py-1.5 flex items-center justify-between">
      {/* 标签列表 */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              group flex items-center gap-1 px-3 py-1 rounded cursor-pointer
              text-xs whitespace-nowrap transition-all duration-150
              ${activeKey === tab.key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }
            `}
          >
            <span>{tab.title}</span>
            {tab.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(tab.key)
                }}
                className={`
                  ml-0.5 p-0.5 rounded transition-colors
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
        ))}
      </div>

      {/* 批量操作按钮 */}
      {hasClosableTabs && (
        <div className="flex items-center gap-1 ml-2 flex-shrink-0 pl-2 border-l border-gray-200">
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
