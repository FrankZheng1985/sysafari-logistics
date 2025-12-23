import React, { ReactNode, useState, useMemo, useEffect, useRef } from 'react'
import { Filter, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type SortOrder = 'asc' | 'desc' | null

export interface Column<T> {
  key: string
  label?: string
  title?: string  // 兼容旧格式
  render?: (value: any, record: T) => ReactNode  // 支持 antd 风格的 (value, record) 格式
  sorter?: boolean | ((a: T, b: T) => number)
  filterable?: boolean
  dateFilterable?: boolean  // 日期筛选（按年月日）
  dateField?: string  // 日期字段名（用于从 record 中获取日期值）
  filters?: { text: string; value: string }[]
  onFilter?: (value: string, record: T) => boolean
  width?: string | number
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'  // 兼容旧格式
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  rowKey?: string | ((record: T, index: number) => string)
  searchValue?: string
  searchableColumns?: string[]
  visibleColumns?: string[]
  pagination?: {
    pageSize?: number
    showSizeChanger?: boolean
    showTotal?: (total: number) => ReactNode
    current?: number
    page?: number
    total?: number
    onChange?: (page: number, pageSize?: number) => void
  }
  rowSelection?: {
    type?: 'checkbox' | 'radio'
    selectedRowKeys?: string[]
    onChange?: (selectedRowKeys: string[], selectedRows: T[]) => void
  }
  onRow?: (record: T, index: number) => {
    onClick?: () => void
    className?: string
  }
  compact?: boolean // 紧凑模式，缩小字体和间距
  emptyText?: string // 空数据时的提示文字
  onRowClick?: (record: T, index: number) => void // 行点击事件
  // 筛选状态持久化支持
  initialFilters?: Record<string, string[]> // 初始筛选状态
  onFilterChange?: (filters: Record<string, string[]>) => void // 筛选状态变化回调
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  rowKey = 'id',
  searchValue = '',
  searchableColumns,
  visibleColumns,
  pagination,
  rowSelection,
  onRow,
  compact = false,
  initialFilters,
  onFilterChange,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)
  const [filterStates, setFilterStates] = useState<Record<string, string[]>>(initialFilters || {})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(pagination?.pageSize || 20)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>(
    rowSelection?.selectedRowKeys || []
  )
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null)
  
  // 当筛选状态变化时，通知父组件（使用 ref 避免依赖回调导致循环）
  const onFilterChangeRef = useRef(onFilterChange)
  onFilterChangeRef.current = onFilterChange
  
  useEffect(() => {
    if (onFilterChangeRef.current) {
      onFilterChangeRef.current(filterStates)
    }
  }, [filterStates])

  // Get row key
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record, index)
    }
    return record[rowKey] || String(index)
  }

  // Filter data
  const filteredData = useMemo(() => {
    let result = [...data]

    // Apply search filter
    if (searchValue && searchValue.trim()) {
      const searchLower = searchValue.toLowerCase().trim()
      const columnsToSearch = searchableColumns || columns.filter(col => col.filterable !== false).map(col => col.key)
      
      result = result.filter((record) => {
        return columnsToSearch.some((columnKey) => {
          const column = columns.find((col) => col.key === columnKey)
          if (column && column.render) {
            // For columns with custom render, try to get the text content
            const cellValue = String(record[columnKey] || '')
            return cellValue.toLowerCase().includes(searchLower)
          }
          const cellValue = String(record[columnKey] || '')
          return cellValue.toLowerCase().includes(searchLower)
        })
      })
    }

    // Apply column filters
    Object.keys(filterStates).forEach((columnKey) => {
      const column = columns.find((col) => col.key === columnKey)
      if (column && filterStates[columnKey].length > 0) {
        result = result.filter((record) => {
          // 日期筛选逻辑
          if (column.dateFilterable) {
            const dateField = column.dateField || column.key
            const dateValue = record[dateField]
            if (!dateValue) return false
            
            const dateStr = String(dateValue)
            const match = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
            if (!match) return false
            
            const [, year, month, day] = match
            const filterYear = filterStates[columnKey].find(f => f.startsWith('year:'))?.replace('year:', '')
            const filterMonth = filterStates[columnKey].find(f => f.startsWith('month:'))?.replace('month:', '')
            const filterDay = filterStates[columnKey].find(f => f.startsWith('day:'))?.replace('day:', '')
            
            if (filterYear && year !== filterYear) return false
            if (filterMonth && month.padStart(2, '0') !== filterMonth) return false
            if (filterDay && day.padStart(2, '0') !== filterDay) return false
            
            return true
          }
          
          if (column.onFilter) {
            return filterStates[columnKey].some((value) =>
              column.onFilter!(value, record)
            )
          }
          // 对数据值进行标准化处理（trim），与筛选选项生成逻辑保持一致
          const cellValue = String(record[columnKey] || '').trim()
          return filterStates[columnKey].some((filterValue) =>
            cellValue === filterValue // 精确匹配（已标准化的值）
          )
        })
      }
    })

    return result
  }, [data, filterStates, columns, searchValue, searchableColumns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortOrder) return filteredData

    const column = columns.find((col) => col.key === sortColumn)
    if (!column || !column.sorter) return filteredData

    const sorted = [...filteredData].sort((a, b) => {
      let result: number
      if (typeof column.sorter === 'function') {
        result = column.sorter(a, b)
      } else {
        // Default string/number comparison
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]
        
        // 空值处理：空值、null、undefined、'-' 始终排在最后
        const aEmpty = aVal === null || aVal === undefined || aVal === '' || aVal === '-'
        const bEmpty = bVal === null || bVal === undefined || bVal === '' || bVal === '-'
        
        if (aEmpty && bEmpty) return 0
        if (aEmpty) return 1  // a 为空，排后面
        if (bEmpty) return -1 // b 为空，排后面
        
        if (aVal < bVal) result = -1
        else if (aVal > bVal) result = 1
        else result = 0
      }
      // 根据排序方向调整结果
      return sortOrder === 'desc' ? -result : result
    })

    return sorted
  }, [filteredData, sortColumn, sortOrder, columns])

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return sortedData.slice(start, end)
  }, [sortedData, currentPage, pageSize, pagination])

  // Reset to first page when search value changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchValue])

  // Filter visible columns (必须在所有早期返回之前)
  const visibleCols = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) {
      return columns
    }
    return columns.filter((col) => visibleColumns.includes(col.key))
  }, [columns, visibleColumns])

  // 早期返回必须在所有hooks之后
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  // Handle sort
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else if (sortOrder === 'desc') {
        setSortColumn(null)
        setSortOrder(null)
      } else {
        setSortOrder('asc')
      }
    } else {
      setSortColumn(columnKey)
      setSortOrder('asc')
    }
  }

  // Handle filter
  const handleFilter = (columnKey: string, values: string[]) => {
    setFilterStates((prev) => ({
      ...prev,
      [columnKey]: values,
    }))
    setCurrentPage(1) // Reset to first page when filtering
    // Optionally close dropdown after filtering
    // setOpenFilterDropdown(null)
  }

  // Handle row selection
  const handleSelectRow = (rowKey: string, _record: T) => {
    if (!rowSelection) return

    let newSelectedKeys: string[]
    if (rowSelection.type === 'radio') {
      newSelectedKeys = [rowKey]
    } else {
      if (selectedRowKeys.includes(rowKey)) {
        newSelectedKeys = selectedRowKeys.filter((key) => key !== rowKey)
      } else {
        newSelectedKeys = [...selectedRowKeys, rowKey]
      }
    }

    setSelectedRowKeys(newSelectedKeys)
    const selectedRows = sortedData.filter((record) =>
      newSelectedKeys.includes(getRowKey(record, sortedData.indexOf(record)))
    )
    rowSelection.onChange?.(newSelectedKeys, selectedRows)
  }

  // Handle select all
  const handleSelectAll = () => {
    if (!rowSelection || rowSelection.type === 'radio') return

    const allKeys = paginatedData.map((record, index) =>
      getRowKey(record, index)
    )
    const allSelected = allKeys.every((key) => selectedRowKeys.includes(key))

    let newSelectedKeys: string[]
    if (allSelected) {
      newSelectedKeys = selectedRowKeys.filter(
        (key) => !allKeys.includes(key)
      )
    } else {
      newSelectedKeys = Array.from(
        new Set([...selectedRowKeys, ...allKeys])
      )
    }

    setSelectedRowKeys(newSelectedKeys)
    const selectedRows = sortedData.filter((record) =>
      newSelectedKeys.includes(getRowKey(record, sortedData.indexOf(record)))
    )
    rowSelection.onChange?.(newSelectedKeys, selectedRows)
  }

  // Render sort icon
  const renderSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />
    }
    if (sortOrder === 'asc') {
      return <ChevronUp className="w-4 h-4 text-primary-600" />
    }
    return <ChevronDown className="w-4 h-4 text-primary-600" />
  }

  // 日期筛选下拉框
  const renderDateFilterDropdown = (column: Column<T>) => {
    const dateField = column.dateField || column.key
    const activeFilters = filterStates[column.key] || []
    
    // 从数据中提取所有日期并解析年月日
    const years = new Set<string>()
    const months = new Set<string>()
    const days = new Set<string>()
    
    data.forEach(record => {
      const dateValue = record[dateField]
      if (dateValue) {
        const dateStr = String(dateValue)
        // 支持 YYYY-MM-DD 或 YYYY/MM/DD 格式
        const match = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
        if (match) {
          years.add(match[1])
          months.add(match[2].padStart(2, '0'))
          days.add(match[3].padStart(2, '0'))
        }
      }
    })
    
    // 解析当前筛选状态
    const currentYear = activeFilters.find(f => f.startsWith('year:'))?.replace('year:', '') || ''
    const currentMonth = activeFilters.find(f => f.startsWith('month:'))?.replace('month:', '') || ''
    const currentDay = activeFilters.find(f => f.startsWith('day:'))?.replace('day:', '') || ''
    
    const hasFilter = currentYear || currentMonth || currentDay
    
    const handleDateFilterChange = (type: 'year' | 'month' | 'day', value: string) => {
      const newFilters = activeFilters.filter(f => !f.startsWith(`${type}:`))
      if (value) {
        newFilters.push(`${type}:${value}`)
      }
      handleFilter(column.key, newFilters)
    }
    
    return (
      <div
        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 清除筛选按钮 */}
        <div className="border-b border-gray-200 p-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleFilter(column.key, [])
              setOpenFilterDropdown(null)
            }}
            disabled={!hasFilter}
            className={`w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${
              hasFilter
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            取消筛选
          </button>
        </div>
        
        {/* 年月日选择 */}
        <div className="p-3 space-y-2">
          {/* 年份选择 */}
          <div className="flex items-center gap-2">
            <label htmlFor={`date-filter-year-${column.key}`} className="text-xs text-gray-500 w-8">年</label>
            <select
              id={`date-filter-year-${column.key}`}
              value={currentYear}
              onChange={(e) => handleDateFilterChange('year', e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              title="选择年份"
            >
              <option value="">全部</option>
              {Array.from(years).sort().reverse().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          {/* 月份选择 */}
          <div className="flex items-center gap-2">
            <label htmlFor={`date-filter-month-${column.key}`} className="text-xs text-gray-500 w-8">月</label>
            <select
              id={`date-filter-month-${column.key}`}
              value={currentMonth}
              onChange={(e) => handleDateFilterChange('month', e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              title="选择月份"
            >
              <option value="">全部</option>
              {Array.from(months).sort().map(month => (
                <option key={month} value={month}>{parseInt(month)}月</option>
              ))}
            </select>
          </div>
          
          {/* 日期选择 */}
          <div className="flex items-center gap-2">
            <label htmlFor={`date-filter-day-${column.key}`} className="text-xs text-gray-500 w-8">日</label>
            <select
              id={`date-filter-day-${column.key}`}
              value={currentDay}
              onChange={(e) => handleDateFilterChange('day', e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              title="选择日期"
            >
              <option value="">全部</option>
              {Array.from(days).sort().map(day => (
                <option key={day} value={day}>{parseInt(day)}日</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  // Render filter dropdown
  const renderFilterDropdown = (column: Column<T>) => {
    // 日期筛选
    if (column.dateFilterable) {
      return renderDateFilterDropdown(column)
    }
    
    if (!column.filterable && !column.filters) return null

    const activeFilters = filterStates[column.key] || []
    
    // 如果有预定义的 filters，使用它们；否则从数据中动态生成
    let filterOptions = column.filters || []
    
    if (filterOptions.length === 0 && column.filterable) {
      // 从完整数据中动态生成筛选选项（去重 + 计数）
      // 使用 Map 存储：key 为标准化后的值（用于去重），value 为 { displayText, count, originalValue }
      const valueCounts = new Map<string, { displayText: string; count: number; originalValue: string }>()
      
      data.forEach(record => {
        const rawValue = record[column.key]
        if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
          // 标准化处理：去除前后空格
          const trimmedValue = String(rawValue).trim()
          if (trimmedValue === '') return
          
          // 使用小写作为去重 key（可选，如需区分大小写可去掉 toLowerCase）
          const normalizedKey = trimmedValue
          
          if (valueCounts.has(normalizedKey)) {
            // 已存在，增加计数
            const existing = valueCounts.get(normalizedKey)!
            existing.count++
          } else {
            // 新值，初始化
            valueCounts.set(normalizedKey, {
              displayText: trimmedValue,
              count: 1,
              originalValue: trimmedValue
            })
          }
        }
      })
      
      // 转换为筛选选项数组，按数量降序排列
      filterOptions = Array.from(valueCounts.values())
        .sort((a, b) => b.count - a.count) // 按数量降序
        .map(item => ({ 
          text: `${item.displayText}（${item.count}）`, 
          value: item.originalValue 
        }))
    }

    return (
      <div
        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 清除筛选按钮 - 始终显示在顶部 */}
        <div className="border-b border-gray-200 p-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleFilter(column.key, [])
              setOpenFilterDropdown(null)
            }}
            disabled={activeFilters.length === 0}
            className={`w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${
              activeFilters.length > 0
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            取消筛选 {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto">
          {filterOptions.length > 0 ? (
            filterOptions.map((filter) => {
              const isChecked = activeFilters.includes(filter.value)
              return (
                <label
                  key={filter.value}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation()
                      const newFilters = e.target.checked
                        ? [...activeFilters, filter.value]
                        : activeFilters.filter((v) => v !== filter.value)
                      handleFilter(column.key, newFilters)
                    }}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer filter-checkbox flex-shrink-0"
                    title={`筛选: ${filter.text}`}
                  />
                  <span className="text-sm text-gray-700 break-words">{filter.text}</span>
                </label>
              )
            })
          ) : (
            <div className="px-2 py-1 text-sm text-gray-500">
              暂无过滤选项
            </div>
          )}
        </div>
      </div>
    )
  }

  const displayData = pagination ? paginatedData : sortedData
  const total = sortedData.length
  const totalPages = pagination ? Math.ceil(total / pageSize) : 1

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
        <div className="text-6xl mb-4">📦</div>
        <div className="text-lg">暂无数据</div>
      </div>
    )
  }

  // Close filter dropdown when clicking outside
  const handleClickOutside = () => {
    setOpenFilterDropdown(null)
  }

  return (
    <div className="flex flex-col h-full" onClick={handleClickOutside}>
      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Selection column */}
              {rowSelection && (
                <th className={`${compact ? 'px-2 py-1.5' : 'px-4 py-3.5'} text-left ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200`}>
                  {rowSelection.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={
                        displayData.length > 0 &&
                        displayData.every((record, index) =>
                          selectedRowKeys.includes(
                            getRowKey(record, index)
                          )
                        )
                      }
                      onChange={handleSelectAll}
                      className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-primary-600 border-gray-300 rounded focus:ring-primary-500`}
                      title="全选/取消全选"
                    />
                  ) : (
                    <span className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} block`} />
                  )}
                </th>
              )}

              {/* Data columns */}
              {visibleCols.map((column) => {
                const hasFilter = column.filterable || column.filters || column.dateFilterable
                const activeFilters = filterStates[column.key] || []

                return (
                  <th
                    key={column.key}
                    className={`${compact ? 'px-2 py-1.5' : 'px-6 py-3.5'} text-left ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 relative ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                        ? 'text-right'
                        : ''
                    }`}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
                      <span>{column.label || column.title}</span>
                      <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
                        {column.sorter && (
                          <button
                            onClick={() => handleSort(column.key)}
                            className={`${compact ? 'p-0' : 'p-0.5'} hover:bg-gray-200 rounded transition-colors`}
                            title="排序"
                          >
                            {compact ? (
                              <ChevronsUpDown className="w-3 h-3 text-gray-400" />
                            ) : (
                              renderSortIcon(column.key)
                            )}
                          </button>
                        )}
                        {hasFilter && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenFilterDropdown(
                                  openFilterDropdown === column.key ? null : column.key
                                )
                              }}
                              className={`${compact ? 'p-0' : 'p-0.5'} hover:bg-gray-200 rounded transition-colors ${
                                activeFilters.length > 0
                                  ? 'text-primary-600'
                                  : 'text-gray-400'
                              }`}
                              title="过滤"
                            >
                              <Filter className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                            </button>
                            {openFilterDropdown === column.key && renderFilterDropdown(column)}
                          </div>
                        )}
                      </div>
                    </div>
                    {activeFilters.length > 0 && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-primary-600 rounded-full"></div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((item, index) => {
              const key = getRowKey(item, index)
              const isSelected = selectedRowKeys.includes(key)
              const rowProps = onRow?.(item, index) || {}

              return (
                <tr
                  key={key}
                  className={`hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-primary-50' : ''
                  } ${rowProps.className || ''}`}
                  onClick={rowProps.onClick}
                >
                  {/* Selection cell */}
                  {rowSelection && (
                    <td className={`${compact ? 'px-2 py-1.5' : 'px-4 py-4'} whitespace-nowrap`}>
                      <input
                        type={rowSelection.type || 'checkbox'}
                        checked={isSelected}
                        onChange={() => handleSelectRow(key, item)}
                        className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-primary-600 border-gray-300 rounded focus:ring-primary-500`}
                        title="选择此行"
                      />
                    </td>
                  )}

                  {/* Data cells */}
                  {visibleCols.map((column) => (
                    <td
                      key={column.key}
                      className={`${compact ? 'px-2 py-1.5' : 'px-6 py-4'} whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'} text-gray-900 ${
                        column.align === 'center'
                          ? 'text-center'
                          : column.align === 'right'
                          ? 'text-right'
                          : ''
                      }`}
                    >
                      {column.render ? column.render(item[column.key], item) : item[column.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            {pagination.showTotal && (
              <span className="text-sm text-gray-700">
                {pagination.showTotal(total)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-sm text-gray-700">
              第 {currentPage} / {totalPages} 页
            </span>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
                {pagination.showSizeChanger && (
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                    title="每页显示条数"
                  >
                    <option value={20}>20 条/页</option>
                    <option value={50}>50 条/页</option>
                    <option value={100}>100 条/页</option>
                  </select>
                )}
          </div>
        </div>
      )}
    </div>
  )
}
