// 菜单项开关管理工具

import { getSystemSettings, saveSystemSetting } from './api'

export interface MenuItemConfig {
  path: string
  label: string
  enabled: boolean
}

const STORAGE_KEY = 'menuSettings'

// 默认配置
const defaultConfig: Record<string, boolean> = {
  '/bookings/labels': false, // 打单 - 默认关闭
  '/bookings/packages': true, // 打包 - 默认开启
  '/bookings/bill': true, // 提单 - 默认开启
  '/bookings/declarations': true, // 报关 - 默认开启
  '/last-mile': true, // 最后里程 - 默认开启
}

// 内存缓存
let cachedSettings: Record<string, boolean> | null = null

// 获取所有菜单项配置（同步版本，使用缓存）
export function getMenuSettings(): Record<string, boolean> {
  if (cachedSettings) {
    return { ...cachedSettings }
  }
  // 如果没有缓存，返回默认配置并触发异步加载
  loadMenuSettingsAsync()
  return { ...defaultConfig }
}

// 异步加载菜单设置
export async function loadMenuSettingsAsync(): Promise<Record<string, boolean>> {
  try {
    const response = await getSystemSettings(STORAGE_KEY)
    if (response.errCode === 200 && response.data && response.data[STORAGE_KEY]) {
      const settings = response.data[STORAGE_KEY]
      const mergedSettings = { ...defaultConfig, ...settings }
      cachedSettings = mergedSettings
      return mergedSettings
    }
  } catch (error) {
    console.error('Failed to load menu settings from API:', error)
  }
  const defaultSettings = { ...defaultConfig }
  cachedSettings = defaultSettings
  return defaultSettings
}

// 保存菜单项配置
export async function saveMenuSettings(settings: Record<string, boolean>): Promise<void> {
  try {
    await saveSystemSetting(STORAGE_KEY, settings, '菜单项开关配置')
    cachedSettings = settings
    // 触发自定义事件，通知侧边栏更新
    window.dispatchEvent(new CustomEvent('menuSettingsChanged'))
  } catch (error) {
    console.error('Failed to save menu settings:', error)
    throw error
  }
}

// 获取单个菜单项的开关状态（同步版本，使用缓存）
export function isMenuItemEnabled(path: string): boolean {
  const settings = getMenuSettings()
  return settings[path] !== false // 默认开启（如果未设置）
}

// 设置单个菜单项的开关状态
export async function setMenuItemEnabled(path: string, enabled: boolean): Promise<void> {
  const settings = getMenuSettings()
  settings[path] = enabled
  await saveMenuSettings(settings)
}

// 重置为默认配置
export async function resetMenuSettings(): Promise<void> {
  await saveMenuSettings({ ...defaultConfig })
}

// 初始化加载设置（在应用启动时调用）
export function initMenuSettings(): void {
  loadMenuSettingsAsync().catch(console.error)
}

