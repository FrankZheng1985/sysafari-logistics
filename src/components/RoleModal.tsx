import { useState, useEffect } from 'react'
import { X, Shield } from 'lucide-react'

interface RoleModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  role?: {
    roleCode: string
    roleName: string
    description?: string
    status?: string
  } | null
}

// 预设颜色选项
const colorOptions = [
  { code: 'red', label: '红色', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  { code: 'blue', label: '蓝色', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { code: 'green', label: '绿色', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  { code: 'yellow', label: '黄色', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  { code: 'purple', label: '紫色', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { code: 'orange', label: '橙色', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { code: 'gray', label: '灰色', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
]

// API 基础地址
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

export default function RoleModal({
  visible,
  onClose,
  onSuccess,
  role,
}: RoleModalProps) {
  const [formData, setFormData] = useState({
    roleCode: '',
    roleName: '',
    description: '',
    colorCode: 'blue',
    status: 'active',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (role) {
        setFormData({
          roleCode: role.roleCode || '',
          roleName: role.roleName || '',
          description: role.description || '',
          colorCode: 'blue',
          status: role.status || 'active',
        })
      } else {
        setFormData({
          roleCode: '',
          roleName: '',
          description: '',
          colorCode: 'blue',
          status: 'active',
        })
      }
      setErrors({})
    }
  }, [visible, role])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.roleCode.trim()) {
      newErrors.roleCode = '角色代码为必填项'
    } else if (!/^[a-z_]+$/.test(formData.roleCode)) {
      newErrors.roleCode = '角色代码只能包含小写字母和下划线'
    }
    
    if (!formData.roleName.trim()) {
      newErrors.roleName = '角色名称为必填项'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      const url = role 
        ? `${API_BASE_URL}/api/roles/${role.roleCode}`
        : `${API_BASE_URL}/api/roles`
      
      const response = await fetch(url, {
        method: role ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleCode: formData.roleCode,
          roleName: formData.roleName,
          description: formData.description,
          colorCode: formData.colorCode,
          status: formData.status,
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        onSuccess()
        onClose()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (err: any) {
      console.error('保存角色失败:', err)
      alert(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  const selectedColor = colorOptions.find(c => c.code === formData.colorCode) || colorOptions[1]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              {role ? '编辑角色' : '添加角色'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 角色代码 */}
          <div>
            <label htmlFor="roleCode" className="block text-xs font-medium text-gray-700 mb-1">
              角色代码 <span className="text-red-500">*</span>
            </label>
            <input
              id="roleCode"
              type="text"
              value={formData.roleCode}
              onChange={(e) => handleInputChange('roleCode', e.target.value.toLowerCase())}
              disabled={!!role}
              className={`w-full px-2 py-1.5 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                errors.roleCode
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              } ${role ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              placeholder="如：sales_manager"
            />
            {errors.roleCode && (
              <p className="mt-1 text-[10px] text-red-500">{errors.roleCode}</p>
            )}
            <p className="mt-1 text-[10px] text-gray-400">只能包含小写字母和下划线，创建后不可修改</p>
          </div>

          {/* 角色名称 */}
          <div>
            <label htmlFor="roleName" className="block text-xs font-medium text-gray-700 mb-1">
              角色名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="roleName"
              type="text"
              value={formData.roleName}
              onChange={(e) => handleInputChange('roleName', e.target.value)}
              className={`w-full px-2 py-1.5 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                errors.roleName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              placeholder="如：销售经理"
            />
            {errors.roleName && (
              <p className="mt-1 text-[10px] text-red-500">{errors.roleName}</p>
            )}
          </div>

          {/* 角色描述 */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
              角色描述
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
              placeholder="描述该角色的职责和权限范围"
              rows={2}
            />
          </div>

          {/* 标签颜色 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              标签颜色
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(color => (
                <button
                  key={color.code}
                  type="button"
                  onClick={() => handleInputChange('colorCode', color.code)}
                  className={`px-2 py-1 rounded text-xs border transition-all ${color.bg} ${color.text} ${color.border} ${
                    formData.colorCode === color.code ? 'ring-2 ring-offset-1 ring-primary-500' : ''
                  }`}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>

          {/* 预览 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              预览效果
            </label>
            <div className="p-2 bg-gray-50 rounded border border-gray-200">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${selectedColor.bg} ${selectedColor.text} ${selectedColor.border}`}>
                {formData.roleName || '角色名称'}
              </span>
              <span className="ml-2 text-[10px] text-gray-400">
                ({formData.roleCode || 'role_code'})
              </span>
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              状态
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={formData.status === 'active'}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-3 h-3 text-primary-600"
                />
                <span className="text-xs text-gray-700">启用</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="inactive"
                  checked={formData.status === 'inactive'}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-3 h-3 text-primary-600"
                />
                <span className="text-xs text-gray-700">禁用</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

