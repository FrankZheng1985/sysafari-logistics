import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createContainerCode, updateContainerCode, getShippingCompanies, type ContainerCodeItem, type CreateContainerCodeRequest, type UpdateContainerCodeRequest, type ShippingCompany } from '../utils/api'

interface ContainerCodeModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: ContainerCodeItem | null // 编辑时传入数据，新增时为 null
}

export default function ContainerCodeModal({
  visible,
  onClose,
  onSuccess,
  data,
}: ContainerCodeModalProps) {
  const [formData, setFormData] = useState({
    containerCode: '',
    description: '',
    shippingCompanyId: '',
  })
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 加载海运公司列表
  useEffect(() => {
    if (visible) {
      loadShippingCompanies()
    }
  }, [visible])

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (data) {
        // 编辑模式：填充现有数据
        setFormData({
          containerCode: data.containerCode || '',
          description: data.description || '',
          shippingCompanyId: data.shippingCompanyId || '',
        })
      } else {
        // 新增模式：重置表单
        setFormData({
          containerCode: '',
          description: '',
          shippingCompanyId: '',
        })
      }
      setErrors({})
    }
  }, [visible, data])

  const loadShippingCompanies = async () => {
    try {
      const response = await getShippingCompanies()
      if (response.errCode === 200 && response.data) {
        setShippingCompanies(response.data)
      }
    } catch (err) {
      console.error('加载海运公司列表失败:', err)
    }
  }

  // 早期返回必须在所有hooks之后
  if (!visible) return null

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

    if (!formData.containerCode.trim()) {
      newErrors.containerCode = '集装箱代码为必填项'
    } else if (!/^[A-Z0-9]+$/.test(formData.containerCode)) {
      newErrors.containerCode = '集装箱代码只能包含大写字母和数字'
    }

    if (!formData.shippingCompanyId) {
      newErrors.shippingCompanyId = '海运公司为必填项'
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
        const updateData: UpdateContainerCodeRequest = {
          containerCode: formData.containerCode.trim().toUpperCase(),
          description: formData.description.trim(),
          shippingCompanyId: formData.shippingCompanyId,
        }
        await updateContainerCode(data.id, updateData)
      } else {
        // 创建
        const createData: CreateContainerCodeRequest = {
          containerCode: formData.containerCode.trim().toUpperCase(),
          description: formData.description.trim(),
          shippingCompanyId: formData.shippingCompanyId,
        }
        await createContainerCode(createData)
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('保存集装箱代码失败:', error)
      alert(error.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            {data ? '编辑集装箱代码' : '新增集装箱代码'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="关闭"
            aria-label="关闭对话框"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {/* 海运公司 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              海运公司 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.shippingCompanyId}
              onChange={(e) => handleInputChange('shippingCompanyId', e.target.value)}
              className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                errors.shippingCompanyId ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={!!data} // 编辑时禁用海运公司修改
            >
              <option value="">请选择海运公司</option>
              {shippingCompanies.map((company) => (
                <option key={company.id} value={String(company.id)}>
                  {company.companyName} ({company.companyCode})
                </option>
              ))}
            </select>
            {errors.shippingCompanyId && (
              <p className="mt-1 text-xs text-red-500">{errors.shippingCompanyId}</p>
            )}
            {data && (
              <p className="mt-1 text-xs text-gray-500">海运公司创建后不可修改</p>
            )}
          </div>

          {/* 集装箱代码 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              集装箱代码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.containerCode}
              onChange={(e) => handleInputChange('containerCode', e.target.value.toUpperCase())}
              className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                errors.containerCode ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="请输入集装箱代码（如：COSU）"
            />
            {errors.containerCode && (
              <p className="mt-1 text-xs text-red-500">{errors.containerCode}</p>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
              placeholder="请输入描述（可选）"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
