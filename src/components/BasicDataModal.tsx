import { useState, useEffect } from 'react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'
import { createBasicData, updateBasicData, type BasicDataItem, type CreateBasicDataRequest, type UpdateBasicDataRequest } from '../utils/api'

interface BasicDataModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: BasicDataItem | null // 编辑时传入数据，新增时为 null
}

export default function BasicDataModal({
  visible,
  onClose,
  onSuccess,
  data,
}: BasicDataModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (data) {
        // 编辑模式：填充现有数据
        setFormData({
          name: data.name || '',
          code: data.code || '',
          category: data.category || '',
          description: data.description || '',
          status: data.status || 'active',
        })
      } else {
        // 新增模式：重置表单
        setFormData({
          name: '',
          code: '',
          category: '',
          description: '',
          status: 'active',
        })
      }
      setErrors({})
    }
  }, [visible, data])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '名称为必填项'
    }

    if (!formData.code.trim()) {
      newErrors.code = '代码为必填项'
    } else if (!/^[A-Z0-9_]+$/.test(formData.code)) {
      newErrors.code = '代码只能包含大写字母、数字和下划线'
    }

    if (!formData.category.trim()) {
      newErrors.category = '分类为必填项'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      if (data) {
        // 更新
        const updateData: UpdateBasicDataRequest = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          category: formData.category.trim(),
          description: formData.description.trim(),
          status: formData.status,
        }
        await updateBasicData(data.id, updateData)
      } else {
        // 创建
        const createData: CreateBasicDataRequest = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          category: formData.category.trim(),
          description: formData.description.trim(),
          status: formData.status,
        }
        await createBasicData(createData)
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('保存基础数据失败:', error)
      alert(error.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title={data ? '编辑基础数据' : '新增基础数据'}
      width="max-w-2xl"
      footer={
        <>
          <ModalButton onClick={onClose} disabled={loading}>
            取消
          </ModalButton>
          <ModalButton 
            onClick={handleSubmit} 
            variant="primary" 
            disabled={loading}
            loading={loading}
          >
            保存
          </ModalButton>
        </>
      }
    >
      <ModalContent className="space-y-4">
        {/* 名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="请输入名称"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* 代码 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            代码 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.code ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="请输入代码（大写字母、数字、下划线）"
            disabled={!!data} // 编辑时禁用代码修改
          />
          {errors.code && (
            <p className="mt-1 text-sm text-red-500">{errors.code}</p>
          )}
          {data && (
            <p className="mt-1 text-xs text-gray-500">代码创建后不可修改</p>
          )}
        </div>

        {/* 分类 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            分类 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.category ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="请输入分类（如：运输方式、地理位置等）"
          />
          {errors.category && (
            <p className="mt-1 text-sm text-red-500">{errors.category}</p>
          )}
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            描述
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
            placeholder="请输入描述（可选）"
          />
        </div>

        {/* 状态 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            状态
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="active"
                checked={formData.status === 'active'}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-gray-700">启用</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="inactive"
                checked={formData.status === 'inactive'}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-gray-700">禁用</span>
            </label>
          </div>
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
