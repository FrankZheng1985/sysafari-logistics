import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createAirPort, updateAirPort, getAirPortCountries, type AirPortItem, type CreateAirPortRequest, type UpdateAirPortRequest } from '../utils/api'

interface AirPortModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: AirPortItem | null // 编辑时传入数据，新增时为 null
}

export default function AirPortModal({
  visible,
  onClose,
  onSuccess,
  data,
}: AirPortModalProps) {
  const [formData, setFormData] = useState({
    portCode: '',
    portNameCn: '',
    portNameEn: '',
    country: '',
    countryCode: '',
    city: '',
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
          description: '',
          status: 'active',
        })
      }
      setErrors({})
    }
  }, [visible, data])

  const loadCountries = async () => {
    try {
      const response = await getAirPortCountries()
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
        const updateData: UpdateAirPortRequest = {
          portCode: formData.portCode,
          portNameCn: formData.portNameCn,
          portNameEn: formData.portNameEn,
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          description: formData.description,
          status: formData.status,
        }
        const response = await updateAirPort(data.id, updateData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建
        const createData: CreateAirPortRequest = {
          portCode: formData.portCode,
          portNameCn: formData.portNameCn,
          portNameEn: formData.portNameEn,
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          description: formData.description,
          status: formData.status,
        }
        const response = await createAirPort(createData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存空运港失败:', err)
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
            {data ? '编辑空运港' : '新增空运港'}
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
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.portCode
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：PEK"
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
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.portNameCn
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：北京首都国际机场"
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
                placeholder="如：Beijing Capital International Airport"
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
                placeholder="如：北京"
                title="城市"
                aria-label="城市"
              />
            </div>

            {/* 描述 */}
            <div className="col-span-2">
              <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="描述信息"
                rows={3}
                title="描述"
                aria-label="描述"
              />
            </div>

            {/* 状态 */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                状态
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 cursor-pointer">
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
                <label className="flex items-center gap-1 cursor-pointer">
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
