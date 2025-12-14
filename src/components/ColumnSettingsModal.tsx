import { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'

export interface ColumnConfig {
  key: string
  label: string
  visible: boolean
}

interface ColumnSettingsModalProps {
  visible: boolean
  onClose: () => void
  columns: ColumnConfig[]
  onSave: (columns: ColumnConfig[]) => void
  pageKey?: string
}

export default function ColumnSettingsModal({
  visible,
  onClose,
  columns: initialColumns,
  onSave,
}: ColumnSettingsModalProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns)

  useEffect(() => {
    if (visible) {
      setColumns(initialColumns)
    }
  }, [visible, initialColumns])

  const handleToggle = (key: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    )
  }

  const handleSave = () => {
    onSave(columns)
    onClose()
  }

  const handleReset = () => {
    const resetColumns = initialColumns.map((col) => ({ ...col, visible: true }))
    setColumns(resetColumns)
  }

  // 早期返回必须在所有hooks之后
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">列设置</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {columns.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => handleToggle(column.key)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 flex-1">{column.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="px-1.5 py-0.5 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            重置
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-1.5 py-0.5 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

