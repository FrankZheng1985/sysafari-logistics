import { useState, useCallback, useEffect } from 'react'

export interface ColumnWidth {
  [key: string]: number
}

const STORAGE_KEY_PREFIX = 'table_column_widths_'

/**
 * 列宽调节 Hook
 * @param tableKey 表格唯一标识，用于保存列宽设置
 * @param defaultWidths 默认列宽配置
 */
export function useResizableColumns(
  tableKey: string,
  defaultWidths: ColumnWidth = {}
) {
  // 从 localStorage 加载保存的列宽
  const loadSavedWidths = (): ColumnWidth => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + tableKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Failed to load column widths:', e)
    }
    return defaultWidths
  }

  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(loadSavedWidths)
  const [isResizing, setIsResizing] = useState(false)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)

  // 保存列宽到 localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      try {
        localStorage.setItem(
          STORAGE_KEY_PREFIX + tableKey,
          JSON.stringify(columnWidths)
        )
      } catch (e) {
        console.warn('Failed to save column widths:', e)
      }
    }
  }, [columnWidths, tableKey])

  // 开始调整列宽
  const startResize = useCallback((columnKey: string, startX: number) => {
    setIsResizing(true)
    setResizingColumn(columnKey)
    return startX
  }, [])

  // 调整列宽
  const updateWidth = useCallback((columnKey: string, newWidth: number) => {
    // 最小宽度 50px，最大宽度 500px
    const clampedWidth = Math.max(50, Math.min(500, newWidth))
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: clampedWidth
    }))
  }, [])

  // 结束调整列宽
  const endResize = useCallback(() => {
    setIsResizing(false)
    setResizingColumn(null)
  }, [])

  // 重置列宽
  const resetWidths = useCallback(() => {
    setColumnWidths(defaultWidths)
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + tableKey)
    } catch (e) {
      console.warn('Failed to remove column widths:', e)
    }
  }, [defaultWidths, tableKey])

  // 获取列宽（如果没有保存，返回 undefined 使用默认值）
  const getColumnWidth = useCallback((columnKey: string): number | undefined => {
    return columnWidths[columnKey]
  }, [columnWidths])

  return {
    columnWidths,
    isResizing,
    resizingColumn,
    startResize,
    updateWidth,
    endResize,
    resetWidths,
    getColumnWidth,
  }
}

export default useResizableColumns
