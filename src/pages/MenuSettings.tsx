import { useState, useEffect } from 'react'
import { ToggleLeft, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { loadMenuSettingsAsync, saveMenuSettings, resetMenuSettings } from '../utils/menuSettings'

interface MenuItem {
  path: string
  label: string
  category: string
}

const menuItems: MenuItem[] = [
  { path: '/bookings/labels', label: '打单', category: '订单管理' },
  { path: '/bookings/packages', label: '打包', category: '订单管理' },
  { path: '/bookings/bill', label: '提单', category: '订单管理' },
  { path: '/bookings/declarations', label: '报关', category: '订单管理' },
  { path: '/last-mile', label: '最后里程', category: '其他模块' },
]

export default function MenuSettings() {
  const [settings, setSettings] = useState<Record<string, boolean>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // 异步加载设置
    const loadSettings = async () => {
      const currentSettings = await loadMenuSettingsAsync()
      setSettings(currentSettings)
    }
    loadSettings()

    // 监听设置变化事件
    const handleSettingsChange = async () => {
      const newSettings = await loadMenuSettingsAsync()
      setSettings(newSettings)
      setHasChanges(false)
    }

    window.addEventListener('menuSettingsChanged', handleSettingsChange)
    return () => {
      window.removeEventListener('menuSettingsChanged', handleSettingsChange)
    }
  }, [])

  const toggleMenuItem = (path: string) => {
    const newSettings = {
      ...settings,
      [path]: !settings[path],
    }
    setSettings(newSettings)
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveMenuSettings(settings)
      setHasChanges(false)
    } catch (error) {
      console.error('保存设置失败:', error)
      alert('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (confirm('确定要重置为默认设置吗？')) {
      try {
        await resetMenuSettings()
        const defaultSettings = await loadMenuSettingsAsync()
        setSettings(defaultSettings)
        setHasChanges(false)
      } catch (error) {
        console.error('重置设置失败:', error)
        alert('重置失败，请稍后重试')
      }
    }
  }

  // 按分类分组
  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, MenuItem[]>)

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="板块开关"
        icon={<ToggleLeft className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system/menu-settings' },
          { label: '板块开关' }
        ]}
        actionButtons={
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1 text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重置</span>
            </button>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            )}
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              您可以在这里控制各个板块的显示/隐藏。关闭的板块将不会在侧边栏中显示。
            </p>
          </div>

          {/* 订单管理板块 */}
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-3 py-2 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-900">{category}</h3>
              </div>
              <div className="p-3 space-y-3">
                {items.map((item) => {
                  const enabled = settings[item.path] !== false
                  return (
                    <div
                      key={item.path}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary-600"></div>
                        <span className="text-xs text-gray-900 font-medium">{item.label}</span>
                        <span className="text-xs text-gray-500">({item.path})</span>
                      </div>
                      <button
                        onClick={() => toggleMenuItem(item.path)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          enabled ? 'bg-primary-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 提示信息 */}
          {hasChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                您有未保存的更改，请点击"保存"按钮保存设置。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

