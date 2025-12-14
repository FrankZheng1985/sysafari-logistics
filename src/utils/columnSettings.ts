export interface ColumnConfig {
  key: string
  label: string
  visible: boolean
}

const STORAGE_PREFIX = 'column_settings_'

export function getColumnSettings(pageKey: string): Record<string, boolean> | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${pageKey}`)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load column settings:', error)
  }
  return null
}

export function saveColumnSettings(pageKey: string, settings: Record<string, boolean>): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${pageKey}`, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save column settings:', error)
  }
}

export function getColumnConfigs(
  pageKey: string,
  columns: { key: string; label: string }[]
): ColumnConfig[] {
  const savedSettings = getColumnSettings(pageKey)
  
  return columns.map((col) => ({
    key: col.key,
    label: col.label,
    visible: savedSettings?.[col.key] !== undefined ? savedSettings[col.key] : true,
  }))
}

export function saveColumnConfigs(pageKey: string, configs: ColumnConfig[]): void {
  const settings: Record<string, boolean> = {}
  configs.forEach((config) => {
    settings[config.key] = config.visible
  })
  saveColumnSettings(pageKey, settings)
}

