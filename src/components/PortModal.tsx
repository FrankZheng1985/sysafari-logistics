import { useState, useEffect } from 'react'
import DraggableModal, { ModalContent, ModalButton } from './DraggableModal'
import { createPortOfLoading, updatePortOfLoading, getPortCountries, getMainPortsOfLoadingList, type PortOfLoadingItem, type CreatePortRequest, type UpdatePortRequest } from '../utils/api'

interface PortModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: PortOfLoadingItem | null // 编辑时传入数据，新增时为 null
  transportType?: 'air' | 'sea' | 'rail' | 'truck' // 运输类型，用于新增时设置默认值
}

export default function PortModal({
  visible,
  onClose,
  onSuccess,
  data,
  transportType = 'sea',
}: PortModalProps) {
  const [formData, setFormData] = useState({
    portCode: '',
    portNameCn: '',
    portNameEn: '',
    country: '',
    countryCode: '',
    city: '',
    description: '',
    transportType: 'sea' as 'air' | 'sea' | 'rail' | 'truck',
    portType: 'main' as 'main' | 'terminal',
    parentPortCode: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [countries, setCountries] = useState<Array<{ country: string; countryCode: string }>>([])
  const [mainPorts, setMainPorts] = useState<PortOfLoadingItem[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const loadMainPorts = async (transportTypeToUse?: 'air' | 'sea' | 'rail' | 'truck') => {
    try {
      const typeToUse = transportTypeToUse || formData.transportType
      const response = await getMainPortsOfLoadingList(typeToUse)
      if (response.errCode === 200 && response.data) {
        setMainPorts(response.data)
      }
    } catch (err) {
      console.error('加载主港口列表失败:', err)
    }
  }

  // 加载国家列表和主港口列表
  useEffect(() => {
    if (visible) {
      loadCountries()
      // 如果是新增模式，使用传入的 transportType；如果是编辑模式，使用 formData.transportType
      const typeToUse = data ? formData.transportType : transportType
      loadMainPorts(typeToUse)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, formData.transportType, transportType, data])

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
          description: data.description || '',
          transportType: data.transportType || 'sea',
          portType: data.portType || 'main',
          parentPortCode: data.parentPortCode || '',
          status: data.status || 'active',
        })
      } else {
        // 新增模式：重置表单，使用传入的 transportType 或默认值
        setFormData({
          portCode: '',
          portNameCn: '',
          portNameEn: '',
          country: '',
          countryCode: '',
          city: '',
          description: '',
          transportType: transportType,
          portType: 'main',
          parentPortCode: '',
          status: 'active',
        })
      }
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, data])

  const loadCountries = async () => {
    try {
      const response = await getPortCountries()
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
      newErrors.portCode = '港口代码为必填项'
    }

    if (!formData.portNameCn.trim()) {
      newErrors.portNameCn = '中文名称为必填项'
    }

    // 如果选择的是码头，则必须选择父港口
    if (formData.portType === 'terminal' && !formData.parentPortCode) {
      newErrors.parentPortCode = '选择码头时必须选择父港口'
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
        const updateData: UpdatePortRequest = {
          portCode: formData.portCode,
          portNameCn: formData.portNameCn,
          portNameEn: formData.portNameEn,
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          description: formData.description,
          transportType: formData.transportType,
          portType: formData.portType,
          parentPortCode: formData.portType === 'terminal' ? formData.parentPortCode : undefined,
          status: formData.status,
        }
        const response = await updatePortOfLoading(data.id, updateData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建
        const createData: CreatePortRequest = {
          portCode: formData.portCode,
          portNameCn: formData.portNameCn,
          portNameEn: formData.portNameEn,
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          description: formData.description,
          transportType: formData.transportType,
          portType: formData.portType,
          parentPortCode: formData.portType === 'terminal' ? formData.parentPortCode : undefined,
          status: formData.status,
        }
        const response = await createPortOfLoading(createData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存起运港失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DraggableModal
      visible={visible}
      onClose={onClose}
      title={data ? '编辑起运港' : '新增起运港'}
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
        {/* 港口代码 */}
        <div>
          <label htmlFor="portCode" className="block text-xs font-medium text-gray-700 mb-1">
            港口代码 <span className="text-red-500">*</span>
          </label>
          <input
            id="portCode"
            type="text"
            value={formData.portCode}
            onChange={(e) => handleInputChange('portCode', e.target.value.toUpperCase())}
            className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
              errors.portCode
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary-500'
            }`}
            placeholder="如：CNSHA"
            title="港口代码"
            aria-label="港口代码"
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
            className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 bg-white text-gray-900 ${
              errors.portNameCn
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary-500'
            }`}
            placeholder="如：上海港"
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
            placeholder="如：Shanghai"
            title="英文名称"
            aria-label="英文名称"
          />
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
            placeholder="如：CN"
            title="国家代码"
            aria-label="国家代码"
          />
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
            placeholder="如：上海"
            title="城市"
            aria-label="城市"
          />
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
            placeholder="起运港描述信息"
            rows={3}
            title="描述"
            aria-label="描述"
          />
        </div>

        {/* 港口类型 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            港口类型
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="portType"
                value="main"
                checked={formData.portType === 'main'}
                onChange={(e) => handleInputChange('portType', e.target.value)}
                className="w-3 h-3 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-700">主港口</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="portType"
                value="terminal"
                checked={formData.portType === 'terminal'}
                onChange={(e) => handleInputChange('portType', e.target.value)}
                className="w-3 h-3 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-700">码头</span>
            </label>
          </div>
        </div>

        {/* 父港口（仅当选择码头时显示） */}
        {formData.portType === 'terminal' && (
          <div>
            <label htmlFor="parentPortCode" className="block text-xs font-medium text-gray-700 mb-1">
              父港口 <span className="text-red-500">*</span>
            </label>
            <select
              id="parentPortCode"
              value={formData.parentPortCode}
              onChange={(e) => handleInputChange('parentPortCode', e.target.value)}
              className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                errors.parentPortCode
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              title="父港口"
              aria-label="父港口"
              aria-required="true"
            >
              <option value="">请选择父港口</option>
              {mainPorts
                .filter(port => port.status === 'active' && port.transportType === formData.transportType)
                .map(port => (
                  <option key={port.id} value={port.portCode}>
                    {port.portNameCn} ({port.portCode})
                  </option>
                ))}
            </select>
            {errors.parentPortCode && (
              <p className="mt-1 text-xs text-red-500">{errors.parentPortCode}</p>
            )}
          </div>
        )}

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
