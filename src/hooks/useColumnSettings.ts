import { useState, useEffect, useMemo, useRef } from 'react'
import { ColumnConfig, getColumnConfigs, saveColumnConfigs } from '../utils/columnSettings'
import { Column } from '../components/DataTable'

export function useColumnSettings<T>(
  pageKey: string,
  columns: Column<T>[]
) {
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([])
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  
  // 使用 ref 来追踪上一次的列 keys，避免因为 columns 引用变化导致无限循环
  const prevColumnKeysRef = useRef<string>('')
  const columnKeys = columns.map(col => col.key).join(',')

  // 初始化列配置
  useEffect(() => {
    // 只有当 pageKey 或 columns 的 key 实际变化时才更新
    if (prevColumnKeysRef.current === columnKeys && columnConfigs.length > 0) {
      return
    }
    prevColumnKeysRef.current = columnKeys
    
    const configs = getColumnConfigs(
      pageKey,
      columns.map((col) => ({ key: col.key, label: col.label || col.key }))
    )
    setColumnConfigs(configs)
  }, [pageKey, columnKeys, columns, columnConfigs.length])

  // 获取可见的列
  const visibleColumns = useMemo(() => {
    return columnConfigs.filter((config) => config.visible).map((config) => config.key)
  }, [columnConfigs])

  const handleSettingsClick = () => {
    setSettingsModalVisible(true)
  }

  const handleSaveColumnSettings = (configs: ColumnConfig[]) => {
    setColumnConfigs(configs)
    saveColumnConfigs(pageKey, configs)
  }

  return {
    columnConfigs,
    visibleColumns,
    settingsModalVisible,
    setSettingsModalVisible,
    handleSettingsClick,
    handleSaveColumnSettings,
  }
}

