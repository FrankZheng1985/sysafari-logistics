import { useState, useEffect } from 'react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'
import { createShippingCompany, updateShippingCompany, type ShippingCompany, type CreateShippingCompanyRequest, type UpdateShippingCompanyRequest } from '../utils/api'

interface ShippingCompanyModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: ShippingCompany | null // 编辑时传入数据，新增时为 null
}

export default function ShippingCompanyModal({
  visible,
  onClose,
  onSuccess,
  data,
}: ShippingCompanyModalProps) {
  const [formData, setFormData] = useState({
    companyName: '',
    companyCode: '',
    country: '',
    website: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (data) {
        // 编辑模式：填充现有数据
        setFormData({
          companyName: data.companyName || '',
          companyCode: data.companyCode || '',
          country: data.country || '',
          website: data.website || '',
        })
      } else {
        // 新增模式：重置表单
        setFormData({
          companyName: '',
          companyCode: '',
          country: '',
          website: '',
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

    if (!formData.companyName.trim()) {
      newErrors.companyName = '公司名称为必填项'
    }

    if (!formData.companyCode.trim()) {
      newErrors.companyCode = '公司代码为必填项'
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
        const updateData: UpdateShippingCompanyRequest = {
          companyName: formData.companyName,
          companyCode: formData.companyCode,
          country: formData.country,
          website: formData.website,
        }
        const response = await updateShippingCompany(data.id, updateData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建
        const createData: CreateShippingCompanyRequest = {
          companyName: formData.companyName,
          companyCode: formData.companyCode,
          country: formData.country,
          website: formData.website,
        }
        const response = await createShippingCompany(createData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存海运公司失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title={data ? '编辑船公司' : '新增船公司'}
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
      <ModalContent>
        <div className="grid grid-cols-2 gap-4">
          {/* 公司名称 */}
          <div>
            <label htmlFor="companyName" className="block text-xs font-medium text-gray-700 mb-1">
              公司名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                errors.companyName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              placeholder="如：中远海运"
              title="公司名称"
              aria-label="公司名称"
              aria-required="true"
            />
            {errors.companyName && (
              <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
            )}
          </div>

          {/* 公司代码 */}
          <div>
            <label htmlFor="companyCode" className="block text-xs font-medium text-gray-700 mb-1">
              公司代码 <span className="text-red-500">*</span>
            </label>
            <input
              id="companyCode"
              type="text"
              value={formData.companyCode}
              onChange={(e) => handleInputChange('companyCode', e.target.value.toUpperCase())}
              className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                errors.companyCode
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              placeholder="如：COSCO"
              title="公司代码"
              aria-label="公司代码"
              aria-required="true"
            />
            {errors.companyCode && (
              <p className="mt-1 text-xs text-red-500">{errors.companyCode}</p>
            )}
          </div>

          {/* 国家 */}
          <div>
            <label htmlFor="country" className="block text-xs font-medium text-gray-700 mb-1">
              国家
            </label>
            <input
              id="country"
              type="text"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
              placeholder="如：中国"
              title="国家"
              aria-label="国家"
            />
          </div>

          {/* 网站 */}
          <div>
            <label htmlFor="website" className="block text-xs font-medium text-gray-700 mb-1">
              网站
            </label>
            <input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
              placeholder="如：https://www.cosco.com"
              title="网站"
              aria-label="网站"
            />
          </div>
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
