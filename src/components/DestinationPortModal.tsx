import { useState, useEffect } from 'react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'
import { createDestinationPort, updateDestinationPort, getDestinationPortCountries, type DestinationPortItem, type CreateDestinationPortRequest, type UpdateDestinationPortRequest } from '../utils/api'

interface DestinationPortModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: DestinationPortItem | null // 编辑时传入数据，新增时为 null
}

export default function DestinationPortModal({
  visible,
  onClose,
  onSuccess,
  data,
}: DestinationPortModalProps) {
  const [formData, setFormData] = useState({
    portCode: '',
    portNameCn: '',
    portNameEn: '',
    country: '',
    countryCode: '',
    city: '',
    transportType: 'sea' as 'air' | 'sea' | 'rail' | 'truck',
    continent: '亚洲',
    description: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [countries, setCountries] = useState<Array<{ country: string; countryCode: string }>>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 加载国家列表
  useEffect(() => {
    if (visible) {
      loadCountries()
    }
  }, [visible])

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (data) {
        // 编辑模式：填充现有数据
        setFormData({
          portCode: data.portCode || '',
          portNameCn: data.portNameCn || '',
          portNameEn: data.portNameEn || '',
          country: data.country || '',
          countryCode: data.countryCode || '',
          city: data.city || '',
          transportType: data.transportType || 'sea',
          continent: data.continent || '亚洲',
          description: data.description || '',
          status: data.status || 'active',
        })
      } else {
        // 新增模式：重置表单
        setFormData({
          portCode: '',
          portNameCn: '',
          portNameEn: '',
          country: '',
          countryCode: '',
          city: '',
          transportType: 'sea',
          continent: '亚洲',
          description: '',
          status: 'active',
        })
      }
      setErrors({})
    }
  }, [visible, data])

  const loadCountries = async () => {
    try {
      const response = await getDestinationPortCountries()
      if (response.errCode === 200 && response.data) {
        setCountries(response.data)
      }
    } catch (err) {
      console.error('加载国家列表失败:', err)
    }
  }

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

    if (!formData.portCode.trim()) {
      newErrors.portCode = '代码为必填项'
    }

    if (!formData.portNameCn.trim()) {
      newErrors.portNameCn = '中文名称为必填项'
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
        const updateData: UpdateDestinationPortRequest = {
          portCode: formData.portCode,
          portNameCn: formData.portNameCn,
          portNameEn: formData.portNameEn,
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          transportType: formData.transportType,
          continent: formData.continent,
          description: formData.description,
          status: formData.status,
        }
        const response = await updateDestinationPort(data.id, updateData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建
        const createData: CreateDestinationPortRequest = {
          portCode: formData.portCode,
          portNameCn: formData.portNameCn,
          portNameEn: formData.portNameEn,
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          transportType: formData.transportType,
          continent: formData.continent,
          description: formData.description,
          status: formData.status,
        }
        const response = await createDestinationPort(createData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存目的地失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title={data ? '编辑目的地' : '新增目的地'}
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
        {/* 代码 */}
        <div>
          <label htmlFor="portCode" className="block text-xs font-medium text-gray-700 mb-1">
            代码 <span className="text-red-500">*</span>
          </label>
          <input
            id="portCode"
            type="text"
            value={formData.portCode}
            onChange={(e) => handleInputChange('portCode', e.target.value.toUpperCase())}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
              errors.portCode
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary-500'
            }`}
            placeholder="如：GBLON"
            title="代码"
            aria-label="代码"
            aria-required="true"
          />
          {errors.portCode && (
            <p className="mt-1 text-xs text-red-500">{errors.portCode}</p>
          )}
        </div>

        {/* 中文名称 */}
        <div>
          <label htmlFor="portNameCn" className="block text-xs font-medium text-gray-700 mb-1">
            中文名称 <span className="text-red-500">*</span>
          </label>
          <input
            id="portNameCn"
            type="text"
            value={formData.portNameCn}
            onChange={(e) => handleInputChange('portNameCn', e.target.value)}
            className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
              errors.portNameCn
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary-500'
            }`}
            placeholder="如：伦敦港"
            title="中文名称"
            aria-label="中文名称"
            aria-required="true"
          />
          {errors.portNameCn && (
            <p className="mt-1 text-xs text-red-500">{errors.portNameCn}</p>
          )}
        </div>

        {/* 英文名称 */}
        <div>
          <label htmlFor="portNameEn" className="block text-xs font-medium text-gray-700 mb-1">
            英文名称
          </label>
          <input
            id="portNameEn"
            type="text"
            value={formData.portNameEn}
            onChange={(e) => handleInputChange('portNameEn', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
            placeholder="如：London"
            title="英文名称"
            aria-label="英文名称"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              placeholder="如：英国"
              title="国家"
              aria-label="国家"
              list="countries-list"
            />
            <datalist id="countries-list">
              {countries.map((item, index) => (
                <option key={index} value={item.country} />
              ))}
            </datalist>
          </div>

          {/* 国家代码 */}
          <div>
            <label htmlFor="countryCode" className="block text-xs font-medium text-gray-700 mb-1">
              国家代码
            </label>
            <input
              id="countryCode"
              type="text"
              value={formData.countryCode}
              onChange={(e) => handleInputChange('countryCode', e.target.value.toUpperCase())}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
              placeholder="如：GB"
              title="国家代码"
              aria-label="国家代码"
            />
          </div>
        </div>

        {/* 城市 */}
        <div>
          <label htmlFor="city" className="block text-xs font-medium text-gray-700 mb-1">
            城市
          </label>
          <input
            id="city"
            type="text"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
            placeholder="如：伦敦"
            title="城市"
            aria-label="城市"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 运输类型 */}
          <div>
            <label htmlFor="transportType" className="block text-xs font-medium text-gray-700 mb-1">
              运输类型 <span className="text-red-500">*</span>
            </label>
            <select
              id="transportType"
              value={formData.transportType}
              onChange={(e) => handleInputChange('transportType', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
              title="运输类型"
              aria-label="运输类型"
            >
              <option value="air">空运</option>
              <option value="sea">海运</option>
              <option value="rail">铁运</option>
              <option value="truck">卡车运输</option>
            </select>
          </div>

          {/* 大洲 */}
          <div>
            <label htmlFor="continent" className="block text-xs font-medium text-gray-700 mb-1">
              大洲 <span className="text-red-500">*</span>
            </label>
            <select
              id="continent"
              value={formData.continent}
              onChange={(e) => handleInputChange('continent', e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
              title="大洲"
              aria-label="大洲"
            >
              <option value="亚洲">亚洲</option>
              <option value="欧洲">欧洲</option>
              <option value="北美洲">北美洲</option>
              <option value="南美洲">南美洲</option>
              <option value="非洲">非洲</option>
              <option value="大洋洲">大洋洲</option>
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
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
            placeholder="目的地描述信息"
            rows={3}
            title="描述"
            aria-label="描述"
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
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
            title="状态"
            aria-label="状态"
          >
            <option value="active">启用</option>
            <option value="inactive">禁用</option>
          </select>
        </div>
      </ModalContent>
    </DraggableModal>
  )
}
