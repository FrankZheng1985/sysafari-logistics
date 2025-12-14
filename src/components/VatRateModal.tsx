import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createVatRate, updateVatRate, type VatRate, type CreateVatRateRequest, type UpdateVatRateRequest } from '../utils/api'

interface VatRateModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: VatRate | null // 编辑时传入数据，新增时为 null
}

export default function VatRateModal({
  visible,
  onClose,
  onSuccess,
  data,
}: VatRateModalProps) {
  const [formData, setFormData] = useState({
    countryCode: '',
    countryName: '',
    standardRate: 19,
    reducedRate: 0,
    superReducedRate: 0,
    parkingRate: 0,
    description: '',
    effectiveDate: '',
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
          countryCode: data.countryCode || '',
          countryName: data.countryName || '',
          standardRate: data.standardRate || 0,
          reducedRate: data.reducedRate || 0,
          superReducedRate: data.superReducedRate || 0,
          parkingRate: data.parkingRate || 0,
          description: data.description || '',
          effectiveDate: data.effectiveDate || '',
          status: data.status || 'active',
        })
      } else {
        // 新增模式：重置表单
        setFormData({
          countryCode: '',
          countryName: '',
          standardRate: 19,
          reducedRate: 0,
          superReducedRate: 0,
          parkingRate: 0,
          description: '',
          effectiveDate: '',
          status: 'active',
        })
      }
      setErrors({})
    }
  }, [visible, data])

  const handleInputChange = (field: string, value: any) => {
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.countryCode.trim()) {
      newErrors.countryCode = '国家代码为必填项'
    }

    if (!formData.countryName.trim()) {
      newErrors.countryName = '国家名称为必填项'
    }

    if (formData.standardRate < 0 || formData.standardRate > 100) {
      newErrors.standardRate = '标准税率必须在0-100之间'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      return
    }

    setLoading(true)
    try {
      if (data) {
        // 更新
        const updateData: UpdateVatRateRequest = {
          countryCode: formData.countryCode,
          countryName: formData.countryName,
          standardRate: formData.standardRate,
          reducedRate: formData.reducedRate,
          superReducedRate: formData.superReducedRate,
          parkingRate: formData.parkingRate,
          description: formData.description,
          effectiveDate: formData.effectiveDate,
          status: formData.status,
        }
        const response = await updateVatRate(data.id, updateData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建
        const createData: CreateVatRateRequest = {
          countryCode: formData.countryCode,
          countryName: formData.countryName,
          standardRate: formData.standardRate,
          reducedRate: formData.reducedRate,
          superReducedRate: formData.superReducedRate,
          parkingRate: formData.parkingRate,
          description: formData.description,
          effectiveDate: formData.effectiveDate,
          status: formData.status,
        }
        const response = await createVatRate(createData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存增值税率失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {data ? '编辑增值税率' : '新增增值税率'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="关闭"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* 国家代码 */}
            <div>
              <label htmlFor="countryCode" className="block text-xs font-medium text-gray-700 mb-1">
                国家代码 <span className="text-red-500">*</span>
              </label>
              <input
                id="countryCode"
                type="text"
                value={formData.countryCode}
                onChange={(e) => handleInputChange('countryCode', e.target.value.toUpperCase())}
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.countryCode
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：DE"
                maxLength={3}
              />
              {errors.countryCode && (
                <p className="mt-1 text-xs text-red-500">{errors.countryCode}</p>
              )}
            </div>

            {/* 国家名称 */}
            <div>
              <label htmlFor="countryName" className="block text-xs font-medium text-gray-700 mb-1">
                国家名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="countryName"
                type="text"
                value={formData.countryName}
                onChange={(e) => handleInputChange('countryName', e.target.value)}
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.countryName
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：德国"
              />
              {errors.countryName && (
                <p className="mt-1 text-xs text-red-500">{errors.countryName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 标准税率 */}
            <div>
              <label htmlFor="standardRate" className="block text-xs font-medium text-gray-700 mb-1">
                标准税率 (%) <span className="text-red-500">*</span>
              </label>
              <input
                id="standardRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.standardRate}
                onChange={(e) => handleInputChange('standardRate', parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.standardRate
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：19"
              />
              {errors.standardRate && (
                <p className="mt-1 text-xs text-red-500">{errors.standardRate}</p>
              )}
            </div>

            {/* 优惠税率 */}
            <div>
              <label htmlFor="reducedRate" className="block text-xs font-medium text-gray-700 mb-1">
                优惠税率 (%)
              </label>
              <input
                id="reducedRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.reducedRate}
                onChange={(e) => handleInputChange('reducedRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="如：7"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 超级优惠税率 */}
            <div>
              <label htmlFor="superReducedRate" className="block text-xs font-medium text-gray-700 mb-1">
                超级优惠税率 (%)
              </label>
              <input
                id="superReducedRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.superReducedRate}
                onChange={(e) => handleInputChange('superReducedRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="如：5.5"
              />
            </div>

            {/* 停车税率 */}
            <div>
              <label htmlFor="parkingRate" className="block text-xs font-medium text-gray-700 mb-1">
                停车税率 (%)
              </label>
              <input
                id="parkingRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.parkingRate}
                onChange={(e) => handleInputChange('parkingRate', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="如：12"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 生效日期 */}
            <div>
              <label htmlFor="effectiveDate" className="block text-xs font-medium text-gray-700 mb-1">
                生效日期
              </label>
              <input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => handleInputChange('effectiveDate', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* 状态 */}
            <div>
              <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">
                状态
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
              描述
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="增值税率描述信息"
              rows={3}
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

