import { ReactNode, useState, useEffect } from 'react'
import { Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// 面包屑项可以是字符串或包含 label 和 path 的对象
type BreadcrumbItem = string | { label: string; path?: string }

interface PageHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  tabs?: { label: string; path: string; count?: number }[]
  activeTab?: string
  onTabChange?: (path: string) => void
  searchPlaceholder?: string
  defaultSearchValue?: string
  onSearch?: (value: string) => void
  actionButtons?: ReactNode
  summary?: ReactNode
  onSettingsClick?: () => void
  onRefresh?: () => void
}

export default function PageHeader({
  title,
  icon,
  breadcrumbs,
  tabs,
  activeTab,
  onTabChange,
  searchPlaceholder,
  defaultSearchValue = '',
  onSearch,
  actionButtons,
  summary,
  onSettingsClick,
  onRefresh,
}: PageHeaderProps) {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState(defaultSearchValue)

  // 当 defaultSearchValue 变化时同步更新
  useEffect(() => {
    setSearchValue(defaultSearchValue)
  }, [defaultSearchValue])

  // 获取面包屑的显示文本
  const getBreadcrumbLabel = (item: BreadcrumbItem): string => {
    return typeof item === 'string' ? item : item.label
  }

  // 获取面包屑的路径（如果有）
  const getBreadcrumbPath = (item: BreadcrumbItem): string | undefined => {
    return typeof item === 'string' ? undefined : item.path
  }

  // 处理面包屑点击
  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    const path = getBreadcrumbPath(item)
    if (path) {
      navigate(path)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    onSearch?.(value)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch?.(searchValue)
    }
  }

  return (
    <div className="p-2 border-b border-gray-200 bg-white shadow-sm">
      {breadcrumbs && (
        <div className="text-xs text-gray-500 mb-1 flex flex-wrap items-center gap-0.5">
          {breadcrumbs.map((crumb, index) => {
            const label = getBreadcrumbLabel(crumb)
            const path = getBreadcrumbPath(crumb)
            const isLast = index === breadcrumbs.length - 1
            const isClickable = !!path && !isLast

            return (
              <span key={index} className="flex items-center">
                {index > 0 && <span className="mx-0.5">/</span>}
                {isClickable ? (
                  <span
                    onClick={() => handleBreadcrumbClick(crumb)}
                    className="flex hover:text-primary-600 hover:underline cursor-pointer transition-colors"
                  >
                    {label}
                  </span>
                ) : (
                  <span className={isLast ? 'text-gray-900 font-medium' : ''}>
                    {label}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {icon && <div className="scale-75">{icon}</div>}
          <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
        </div>
      </div>
      {tabs && tabs.length > 0 && (
        <div className="flex gap-0.5 mb-1 border-b border-gray-200 -mx-2 px-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => onTabChange?.(tab.path)}
              title={tab.label}
              aria-label={tab.label}
              className={`px-2 py-1 text-xs font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.path
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-[10px] font-normal">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {summary && <div className="text-xs text-gray-600 font-medium">{summary}</div>}
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          {searchPlaceholder && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-1 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
                placeholder={searchPlaceholder}
                className="w-full pl-6 pr-1.5 py-0.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all text-xs text-gray-900 placeholder:text-gray-400"
              />
            </div>
          )}
          {actionButtons}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="刷新"
              aria-label="刷新"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {/* C 字母主体 - 接近完整的圆形，开口很小 */}
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c5.5 0 10-4.5 10-10" />
                {/* 右上角的箭头 - 从 C 的顶部延伸出来，指向顺时针方向 */}
                <path d="M12 2l1.2 1.2" />
                <path d="M13.2 2l-1.2 1.2" />
              </svg>
            </button>
          )}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="列设置"
              aria-label="列设置"
            >
              <Settings className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

