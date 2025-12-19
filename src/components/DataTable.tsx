import { ReactNode, useState, useMemo, useEffect } from 'react'
import { Filter, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type SortOrder = 'asc' | 'desc' | null

export interface Column<T> {
  key: string
  label: string
  render?: (item: T) => ReactNode
  sorter?: boolean | ((a: T, b: T) => number)
  filterable?: boolean
  filters?: { text: string; value: string }[]
  onFilter?: (value: string, record: T) => boolean
  width?: string | number
  align?: 'left' | 'center' | 'right'
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
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>(null)
  const [filterStates, setFilterStates] = useState<Record<string, string[]>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(pagination?.pageSize || 10)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>(
    rowSelection?.selectedRowKeys || []
  )
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null)

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
          if (column.onFilter) {
            return filterStates[columnKey].some((value) =>
              column.onFilter!(value, record)
            )
          }
          const cellValue = String(record[columnKey] || '')
          return filterStates[columnKey].some((value) =>
            cellValue.toLowerCase().includes(value.toLowerCase())
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
      if (typeof column.sorter === 'function') {
        return column.sorter(a, b)
      }
      // Default string/number comparison
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
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

  // Render filter dropdown
  const renderFilterDropdown = (column: Column<T>) => {
    if (!column.filterable && !column.filters) return null

    const activeFilters = filterStates[column.key] || []
    const filterOptions = column.filters || []

    return (
      <div
        className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]"
        onClick={(e) => e.stopPropagation()}
      >
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
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{filter.text}</span>
                </label>
              )
            })
          ) : (
            <div className="px-2 py-1 text-sm text-gray-500">
              暂无过滤选项
            </div>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="border-t border-gray-200 p-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleFilter(column.key, [])
              }}
              className="w-full text-xs text-primary-600 hover:text-primary-700"
            >
              清除过滤
            </button>
          </div>
        )}
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
                    />
                  ) : (
                    <span className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} block`} />
                  )}
                </th>
              )}

              {/* Data columns */}
              {visibleCols.map((column) => {
                const hasFilter = column.filterable || column.filters
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
                      <span>{column.label}</span>
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
                      {column.render ? column.render(item) : item[column.key]}
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
              >
                <option value={10}>10 条/页</option>
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
