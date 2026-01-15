import React, { ReactNode, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Filter, ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from 'lucide-react'

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
  filterValueGetter?: (record: T) => string  // 自定义筛选值获取函数，用于动态生成筛选选项
  width?: string | number
  minWidth?: number  // 最小宽度（用于可调节列宽）
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'  // 兼容旧格式
  resizable?: boolean  // 单列是否可调节宽度，默认跟随全局设置
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
  // 展开行支持
  expandable?: {
    expandedRowKeys?: string[]  // 展开的行 keys
    expandedRowRender?: (record: T) => ReactNode  // 展开行内容渲染
  }
  // 列宽调节支持
  tableKey?: string  // 表格唯一标识，用于保存列宽设置
  resizable?: boolean  // 是否启用列宽调节，默认 false
}

// 列宽存储 key 前缀
const COLUMN_WIDTH_STORAGE_PREFIX = 'table_column_widths_'

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
  expandable,
  tableKey,
  resizable = false,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)
  const [filterStates, setFilterStates] = useState<Record<string, string[]>>(initialFilters || {})
  const [currentPage, setCurrentPage] = useState(1)
  
  // 当 initialFilters 变化时同步到 filterStates（用于标签页切换等场景）
  useEffect(() => {
    setFilterStates(initialFilters || {})
  }, [initialFilters])
  const [pageSize, setPageSize] = useState(pagination?.pageSize || 20)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>(
    rowSelection?.selectedRowKeys || []
  )
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null)
  
  // 列宽调节状态
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (!tableKey) return {}
    try {
      const saved = localStorage.getItem(COLUMN_WIDTH_STORAGE_PREFIX + tableKey)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(0)
  
  // 当筛选状态变化时，通知父组件（使用 ref 避免依赖回调导致循环）
  const onFilterChangeRef = useRef(onFilterChange)
  onFilterChangeRef.current = onFilterChange
  
  useEffect(() => {
    if (onFilterChangeRef.current) {
      onFilterChangeRef.current(filterStates)
    }
  }, [filterStates])
  
  // 保存列宽到 localStorage
  useEffect(() => {
    if (tableKey && Object.keys(columnWidths).length > 0) {
      try {
        localStorage.setItem(COLUMN_WIDTH_STORAGE_PREFIX + tableKey, JSON.stringify(columnWidths))
      } catch (e) {
        console.warn('Failed to save column widths:', e)
      }
    }
  }, [columnWidths, tableKey])
  
  // 开始调整列宽
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string, currentWidth: number) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = currentWidth
  }, [])
  
  // 处理鼠标移动（调整列宽）
  useEffect(() => {
    if (!resizingColumn) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current
      const newWidth = Math.max(50, Math.min(600, resizeStartWidth.current + diff))
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth
      }))
    }
    
    const handleMouseUp = () => {
      setResizingColumn(null)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn])
  
  // 获取列宽
  const getColumnWidth = useCallback((column: Column<T>): number | string | undefined => {
    // 如果有保存的宽度，使用保存的
    if (columnWidths[column.key]) {
      return columnWidths[column.key]
    }
    // 否则使用列配置的宽度
    return column.width
  }, [columnWidths])

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

    // Apply search filter - 支持多关键词搜索（空格/逗号/分号分隔）
    if (searchValue && searchValue.trim()) {
      const columnsToSearch = searchableColumns || columns.filter(col => col.filterable !== false).map(col => col.key)
      
      // 将搜索词按分隔符拆分，过滤空值
      const keywords = searchValue.split(/[\s,;，；]+/).filter(k => k.trim().length > 0).map(k => k.toLowerCase().trim())
      
      if (keywords.length === 0) {
        // 没有有效关键词，不过滤
      } else if (keywords.length === 1) {
        // 单关键词：原有逻辑
        const searchLower = keywords[0]
        result = result.filter((record) => {
          return columnsToSearch.some((columnKey) => {
            const cellValue = String(record[columnKey] || '')
            return cellValue.toLowerCase().includes(searchLower)
          })
        })
      } else {
        // 多关键词：任意一个关键词匹配即可（OR 逻辑，与后端一致）
        result = result.filter((record) => {
          return keywords.some((keyword) => {
            return columnsToSearch.some((columnKey) => {
              const cellValue = String(record[columnKey] || '')
              return cellValue.toLowerCase().includes(keyword)
            })
          })
        })
      }
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

  // 同步外部传入的当前页（服务器端分页时）
  useEffect(() => {
    const externalPage = pagination?.current || pagination?.page
    if (externalPage && externalPage !== currentPage) {
      setCurrentPage(externalPage)
    }
  }, [pagination?.current, pagination?.page])

  // 同步外部传入的 pageSize
  useEffect(() => {
    if (pagination?.pageSize && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize)
    }
  }, [pagination?.pageSize])

  // Filter visible columns (必须在所有早期返回之前)
  const visibleCols = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) {
      return columns
    }
    return columns.filter((col) => visibleColumns.includes(col.key))
  }, [columns, visibleColumns])

  // 计算固定列的 left 偏移量
  const fixedLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {}
    let currentOffset = 0
    
    // 如果有选择列，先预留选择列的宽度
    if (rowSelection) {
      currentOffset = compact ? 32 : 40
    }
    
    visibleCols.forEach((col) => {
      if (col.fixed === 'left') {
        offsets[col.key] = currentOffset
        // 获取列宽度，默认 120px
        const colWidth = typeof col.width === 'number' ? col.width : 
                         typeof col.width === 'string' ? parseInt(col.width) || 120 : 120
        currentOffset += colWidth
      }
    })
    
    return offsets
  }, [visibleCols, rowSelection, compact])

  // 检查是否有固定列
  const hasFixedLeftColumns = useMemo(() => {
    return visibleCols.some(col => col.fixed === 'left')
  }, [visibleCols])

  // 获取最后一个固定列的 key
  const lastFixedLeftColumnKey = useMemo(() => {
    const fixedLeftCols = visibleCols.filter(col => col.fixed === 'left')
    return fixedLeftCols.length > 0 ? fixedLeftCols[fixedLeftCols.length - 1].key : null
  }, [visibleCols])

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
    
    // 统计数据中每个值的数量
    const valueCounts = new Map<string, number>()
    data.forEach(record => {
      // 如果定义了 filterValueGetter，使用它获取筛选值；否则使用原始字段值
      const rawValue = column.filterValueGetter ? column.filterValueGetter(record) : record[column.key]
      if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
        const trimmedValue = String(rawValue).trim()
        if (trimmedValue === '') return
        valueCounts.set(trimmedValue, (valueCounts.get(trimmedValue) || 0) + 1)
      }
    })
    
    let filterOptions: { text: string; value: string }[] = []
    
    if (column.filters && column.filters.length > 0) {
      // 有预定义的 filters，但只显示数据中实际存在的值
      // 同时使用 onFilter 函数来匹配数据（如果有的话）
      filterOptions = column.filters
        .map(filter => {
          // 计算匹配该筛选值的数据数量
          let count = 0
          if (column.onFilter) {
            // 使用自定义的 onFilter 函数来计算匹配数量
            count = data.filter(record => column.onFilter!(filter.value, record)).length
          } else {
            // 直接按值匹配
            count = valueCounts.get(filter.value) || 0
          }
          return { ...filter, count }
        })
        .filter(filter => filter.count > 0) // 只显示有数据的选项
        .map(filter => ({
          text: `${filter.text}（${filter.count}）`,
          value: filter.value
        }))
    } else if (column.filterable) {
      // 没有预定义 filters，从数据中动态生成筛选选项
      filterOptions = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1]) // 按数量降序
        .map(([value, count]) => ({ 
          text: `${value}（${count}）`, 
          value 
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

  // 判断是否为服务器端分页：当 pagination.total 大于本地数据量时，说明是服务器端分页
  const isServerSidePagination = pagination && pagination.total !== undefined && pagination.total > sortedData.length
  
  // 服务器端分页时直接使用传入的数据，客户端分页时使用切片后的数据
  const displayData = isServerSidePagination ? sortedData : (pagination ? paginatedData : sortedData)
  
  // 服务器端分页时使用传入的 total，客户端分页时使用本地数据长度
  const total = isServerSidePagination ? (pagination?.total || 0) : sortedData.length
  const totalPages = pagination ? Math.ceil(total / pageSize) : 1

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = Object.values(filterStates).some(arr => arr.length > 0)

  // Close filter dropdown when clicking outside
  const handleClickOutside = () => {
    setOpenFilterDropdown(null)
  }

  return (
    <div className="flex flex-col h-full" onClick={handleClickOutside}>
      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead className="bg-gray-50">
            <tr>
              {/* Selection column */}
              {rowSelection && (
                <th 
                  className={`${compact ? 'px-2 py-1.5' : 'px-3 py-3.5'} text-left ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 ${hasFixedLeftColumns ? 'sticky left-0 z-20 bg-gray-50' : ''}`} 
                  style={{ 
                    width: compact ? '32px' : '40px',
                    ...(hasFixedLeftColumns ? { minWidth: compact ? '32px' : '40px' } : {})
                  }}
                >
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
              {visibleCols.map((column, colIndex) => {
                const hasFilter = column.filterable || column.filters || column.dateFilterable
                const activeFilters = filterStates[column.key] || []
                const isFixedLeft = column.fixed === 'left'
                const isLastFixedLeft = column.key === lastFixedLeftColumnKey
                const colWidth = getColumnWidth(column)
                const isColumnResizable = resizable && (column.resizable !== false)
                const isLastColumn = colIndex === visibleCols.length - 1

                return (
                  <th
                    key={column.key}
                    className={`${compact ? 'px-2 py-1.5' : 'px-3 py-3'} text-left ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 relative ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                        ? 'text-right'
                        : ''
                    } ${isFixedLeft ? 'sticky z-20 bg-gray-50' : ''} ${isLastFixedLeft ? 'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[1px] after:bg-gray-300 after:shadow-[2px_0_4px_rgba(0,0,0,0.1)]' : ''} ${resizingColumn === column.key ? 'select-none' : ''}`}
                    style={{
                      ...(colWidth ? { width: colWidth, minWidth: column.minWidth || 50 } : {}),
                      ...(isFixedLeft ? { left: fixedLeftOffsets[column.key] || 0 } : {})
                    }}
                  >
                    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
                      <span className="truncate">{column.label || column.title}</span>
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
                    {/* 列宽调节手柄 */}
                    {isColumnResizable && !isLastColumn && (
                      <div
                        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 transition-colors group ${resizingColumn === column.key ? 'bg-primary-500' : 'bg-transparent hover:bg-primary-300'}`}
                        onMouseDown={(e) => handleResizeStart(e, column.key, typeof colWidth === 'number' ? colWidth : parseInt(String(colWidth)) || 100)}
                        title="拖拽调整列宽"
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="w-3 h-3 text-gray-400" />
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.length === 0 ? (
              <tr>
                <td 
                  colSpan={visibleCols.length + (rowSelection ? 1 : 0)} 
                  className="text-center py-12"
                >
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <div className="text-5xl mb-3">📦</div>
                    <div className="text-base mb-1">暂无数据</div>
                    {hasActiveFilters && (
                      <>
                        <div className="text-sm text-gray-500 mb-3">当前筛选条件下没有匹配的数据</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilterStates({})
                          }}
                          className="px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                        >
                          清除筛选条件
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : displayData.map((item, index) => {
              const key = getRowKey(item, index)
              const isSelected = selectedRowKeys.includes(key)
              const rowProps = onRow?.(item, index) || {}
              const isExpanded = expandable?.expandedRowKeys?.includes(key)
              const colCount = visibleCols.length + (rowSelection ? 1 : 0)

              return (
                <React.Fragment key={key}>
                  <tr
                    className={`hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-primary-50' : ''
                    } ${rowProps.className || ''}`}
                    onClick={rowProps.onClick}
                  >
                    {/* Selection cell */}
                    {rowSelection && (
                      <td 
                        className={`${compact ? 'px-2 py-1.5' : 'px-3 py-4'} whitespace-nowrap ${hasFixedLeftColumns ? 'sticky left-0 z-10 bg-white' : ''}`} 
                        style={{ 
                          width: compact ? '32px' : '40px',
                          ...(hasFixedLeftColumns ? { minWidth: compact ? '32px' : '40px' } : {})
                        }}
                      >
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
                    {visibleCols.map((column) => {
                      const isFixedLeft = column.fixed === 'left'
                      const isLastFixedLeft = column.key === lastFixedLeftColumnKey
                      
                      return (
                        <td
                          key={column.key}
                          className={`${compact ? 'px-2 py-1.5' : 'px-3 py-3'} whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'} text-gray-900 ${
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                              ? 'text-right'
                              : ''
                          } ${isFixedLeft ? 'sticky z-10 bg-white' : ''} ${isLastFixedLeft ? 'after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[1px] after:bg-gray-200' : ''}`}
                          style={{
                            ...(column.width ? { width: column.width, minWidth: column.width } : {}),
                            ...(isFixedLeft ? { left: fixedLeftOffsets[column.key] || 0 } : {})
                          }}
                        >
                          {column.render ? column.render(item[column.key], item) : item[column.key]}
                        </td>
                      )
                    })}
                  </tr>
                  {/* 展开行 */}
                  {isExpanded && expandable?.expandedRowRender && (
                    <tr className="bg-gray-50">
                      <td colSpan={colCount} className="px-4 py-3">
                        {expandable.expandedRowRender(item)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            {pagination.showTotal ? (
              <span className="text-sm text-gray-700">
                {pagination.showTotal(total)}
              </span>
            ) : (
              <span className="text-sm text-gray-500">共 {total} 条</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pagination.showSizeChanger && (
              <select
                value={pageSize}
                onChange={(e) => {
                  const newPageSize = Number(e.target.value)
                  setPageSize(newPageSize)
                  setCurrentPage(1)
                  // 服务器端分页时通知父组件
                  if (isServerSidePagination && pagination.onChange) {
                    pagination.onChange(1, newPageSize)
                  }
                }}
                className="px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                title="每页显示条数"
              >
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
                <option value={100}>100 条/页</option>
              </select>
            )}
            <button
              onClick={() => {
                const newPage = Math.max(1, currentPage - 1)
                setCurrentPage(newPage)
                // 服务器端分页时通知父组件
                if (isServerSidePagination && pagination.onChange) {
                  pagination.onChange(newPage, pageSize)
                }
              }}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="text-sm text-gray-700">
              第 {currentPage} / {totalPages} 页
            </span>
            <button
              onClick={() => {
                const newPage = Math.min(totalPages, currentPage + 1)
                setCurrentPage(newPage)
                // 服务器端分页时通知父组件
                if (isServerSidePagination && pagination.onChange) {
                  pagination.onChange(newPage, pageSize)
                }
              }}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
