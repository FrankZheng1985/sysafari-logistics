import { ReactNode, useState } from 'react'
import { Edit2, Save, X, Plus, Trash2 } from 'lucide-react'

export interface EditableColumn<T> {
  key: string
  label: string
  editable?: boolean
  render?: (value: any, record: T, index: number) => ReactNode
  renderEdit?: (
    value: any,
    record: T,
    index: number,
    onChange: (value: any) => void
  ) => ReactNode
  rules?: Array<{
    required?: boolean
    message?: string
    validator?: (value: any, record: T) => boolean | string
  }>
  width?: string | number
  align?: 'left' | 'center' | 'right'
}

export interface EditableTableProps<T> {
  columns: EditableColumn<T>[]
  data: T[]
  rowKey?: string | ((record: T, index: number) => string)
  onChange?: (data: T[]) => void
  onSave?: (record: T, index: number) => Promise<void> | void
  onDelete?: (record: T, index: number) => Promise<void> | void
  onAdd?: (newRecord: T) => Promise<void> | void
  loading?: boolean
  showAddButton?: boolean
  addButtonText?: string
  addButtonPosition?: 'top' | 'bottom'
}

export default function EditableTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey = 'id',
  onChange,
  onSave,
  onDelete,
  onAdd,
  loading = false,
  showAddButton = true,
  addButtonText = '添加一行数据',
  addButtonPosition = 'bottom',
}: EditableTableProps<T>) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<T>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get row key
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record, index)
    }
    return record[rowKey] || `row-${index}`
  }

  // Start editing
  const startEdit = (record: T, index: number) => {
    const key = getRowKey(record, index)
    setEditingKey(key)
    setEditingData({ ...record })
    setErrors({})
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingKey(null)
    setEditingData({})
    setErrors({})
  }

  // Validate field
  const validateField = (
    column: EditableColumn<T>,
    value: any,
    record: T
  ): string | null => {
    if (!column.rules) return null

    for (const rule of column.rules) {
      if (rule.required && (value === undefined || value === null || value === '')) {
        return rule.message || `${column.label} 是必填项`
      }
      if (rule.validator) {
        const result = rule.validator(value, record)
        if (result !== true) {
          return typeof result === 'string' ? result : rule.message || `${column.label} 验证失败`
        }
      }
    }
    return null
  }

  // Validate all fields
  const validateAll = (record: T): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    columns.forEach((column) => {
      if (column.editable && column.rules) {
        const value = record[column.key]
        const error = validateField(column, value, record)
        if (error) {
          newErrors[column.key] = error
          isValid = false
        }
      }
    })

    setErrors(newErrors)
    return isValid
  }

  // Save editing
  const saveEdit = async (index: number) => {
    if (!editingKey) return

    const updatedRecord = { ...data[index], ...editingData } as T

    if (!validateAll(updatedRecord)) {
      return
    }

    try {
      if (onSave) {
        await onSave(updatedRecord, index)
      }

      const newData = [...data]
      newData[index] = updatedRecord
      onChange?.(newData)

      setEditingKey(null)
      setEditingData({})
      setErrors({})
    } catch (error) {
      console.error('保存失败:', error)
    }
  }

  // Handle field change
  const handleFieldChange = (columnKey: string, value: any) => {
    setEditingData((prev) => ({
      ...prev,
      [columnKey]: value,
    }))

    // Clear error for this field
    if (errors[columnKey]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[columnKey]
        return newErrors
      })
    }
  }

  // Add new row
  const handleAdd = async () => {
    const newRecord = {} as T
    columns.forEach((col) => {
      if (col.editable) {
        (newRecord as any)[col.key] = undefined
      } else {
        // 保持非可编辑字段的默认值
        (newRecord as any)[col.key] = undefined
      }
    })

    // 生成临时 ID
    const tempId = `new-${Date.now()}`
    if (typeof rowKey === 'string') {
      (newRecord as any)[rowKey] = tempId
    }

    // 先添加到数据中
    const newData = [...data, newRecord]
    onChange?.(newData)

    // 然后进入编辑模式
    const key = getRowKey(newRecord, newData.length - 1)
    setEditingKey(key)
    setEditingData(newRecord)

    if (onAdd) {
      try {
        await onAdd(newRecord)
      } catch (error) {
        console.error('添加失败:', error)
        // 如果添加失败，可以回滚
      }
    }
  }

  // Delete row
  const handleDelete = async (record: T, index: number) => {
    if (!confirm('确定要删除这一行吗？')) {
      return
    }

    try {
      if (onDelete) {
        await onDelete(record, index)
      }

      const newData = data.filter((_, i) => i !== index)
      onChange?.(newData)

      if (editingKey === getRowKey(record, index)) {
        cancelEdit()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  // Render cell content
  const renderCell = (
    column: EditableColumn<T>,
    record: T,
    index: number
  ): ReactNode => {
    const key = getRowKey(record, index)
    const isEditing = editingKey === key
    const value = isEditing ? editingData[column.key] : record[column.key]
    const error = errors[column.key]

    if (isEditing && column.editable) {
      return (
        <div className="space-y-1">
          {column.renderEdit ? (
            column.renderEdit(value, record, index, (newValue) =>
              handleFieldChange(column.key, newValue)
            )
          ) : (
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldChange(column.key, e.target.value)}
              className={`w-full px-2 py-1 border rounded text-xs bg-white ${
                error
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              } focus:outline-none focus:ring-1`}
            />
          )}
          {error && (
            <div className="text-xs text-red-500">{error}</div>
          )}
        </div>
      )
    }

    return column.render
      ? column.render(value, record, index)
      : value
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xs text-gray-500">加载中...</div>
      </div>
    )
  }

  const addButton = showAddButton && (
    <button
      onClick={handleAdd}
      className="flex items-center gap-1 px-1.5 py-0.5 mb-3 text-xs text-primary-600 border border-primary-600 rounded hover:bg-primary-50 transition-colors"
    >
      <Plus className="w-3 h-3" />
      <span>{addButtonText}</span>
    </button>
  )

  return (
    <div className="space-y-4">
      {addButtonPosition === 'top' && addButton}
      
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-2 py-1.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200 ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                      ? 'text-right'
                      : ''
                  }`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
              <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record, index) => {
              const key = getRowKey(record, index)
              const isEditing = editingKey === key

              return (
                <tr
                  key={key}
                  className={`hover:bg-gray-50 transition-colors ${
                    isEditing ? 'bg-blue-50' : ''
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-2 py-1.5 text-xs text-gray-900 ${
                        column.align === 'center'
                          ? 'text-center'
                          : column.align === 'right'
                          ? 'text-right'
                          : ''
                      }`}
                    >
                      {renderCell(column, record, index)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(index)}
                            className="text-green-600 hover:text-green-700 p-0.5 rounded hover:bg-green-50 transition-colors"
                            title="保存"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-gray-600 hover:text-gray-700 p-0.5 rounded hover:bg-gray-100 transition-colors"
                            title="取消"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(record, index)}
                            className="text-primary-600 hover:text-primary-700 p-0.5 rounded hover:bg-primary-50 transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(record, index)}
                            className="text-red-600 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {addButtonPosition === 'bottom' && addButton}

      {data.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-xs">暂无数据</div>
          {showAddButton && (
            <button
              onClick={handleAdd}
              className="mt-3 flex items-center gap-1 px-1.5 py-0.5 text-xs text-primary-600 border border-primary-600 rounded hover:bg-primary-50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>{addButtonText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

