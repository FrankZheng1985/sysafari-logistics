import { useState, useEffect } from 'react'
import { X, Tag } from 'lucide-react'
import { 
  createServiceFeeCategory, 
  updateServiceFeeCategory, 
  ServiceFeeCategory 
} from '../utils/api'

interface ServiceFeeCategoryModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: ServiceFeeCategory | null
}

export default function ServiceFeeCategoryModal({
  visible,
  onClose,
  onSuccess,
  data
}: ServiceFeeCategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    code: '',
    description: '',
    sortOrder: 0,
    status: 'active' as 'active' | 'inactive',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name,
        nameEn: data.nameEn || '',
        code: data.code,
        description: data.description || '',
        sortOrder: data.sortOrder || 0,
        status: data.status || 'active',
      })
    } else {
      setFormData({
        name: '',
        nameEn: '',
        code: '',
        description: '',
        sortOrder: 0,
        status: 'active',
      })
    }
    setErrors({})
  }, [data, visible])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = '请输入类别名称'
    }
    if (!formData.code.trim()) {
      newErrors.code = '请输入类别代码'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      if (data) {
        // 编辑模式
        const response = await updateServiceFeeCategory(data.id, {
          name: formData.name,
          nameEn: formData.nameEn,
          code: formData.code.toUpperCase(),
          description: formData.description,
          sortOrder: formData.sortOrder,
          status: formData.status,
        })
        if (response.errCode !== 200) {
          throw new Error(response.msg || '更新失败')
        }
      } else {
        // 新增模式
        const response = await createServiceFeeCategory({
          name: formData.name,
          nameEn: formData.nameEn,
          code: formData.code.toUpperCase(),
          description: formData.description,
          sortOrder: formData.sortOrder,
          status: formData.status,
        })
        if (response.errCode !== 200) {
          throw new Error(response.msg || '创建失败')
        }
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('保存类别失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded flex items-center justify-center">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              {data ? '编辑服务费类别' : '新增服务费类别'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              类别名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="如：报关服务"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              英文名称
            </label>
            <input
              type="text"
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              placeholder="如：Customs Clearance"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              类别代码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white ${
                errors.code ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="如：CUSTOMS"
            />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">排序</label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              placeholder="数字越小越靠前"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white resize-none"
              rows={2}
              placeholder="类别描述..."
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">状态</label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                formData.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  formData.status === 'active' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : (data ? '保存修改' : '确认添加')}
          </button>
        </div>
      </div>
    </div>
  )
}

