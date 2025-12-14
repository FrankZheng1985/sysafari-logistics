import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createCountry, updateCountry, getCountryContinents, type CountryItem, type CreateCountryRequest, type UpdateCountryRequest } from '../utils/api'

interface CountryModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  data?: CountryItem | null // 编辑时传入数据，新增时为 null
}

export default function CountryModal({
  visible,
  onClose,
  onSuccess,
  data,
}: CountryModalProps) {
  const [formData, setFormData] = useState({
    countryCode: '',
    countryNameCn: '',
    countryNameEn: '',
    continent: '',
    region: '',
    capital: '',
    currencyCode: '',
    currencyName: '',
    phoneCode: '',
    timezone: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  })
  const [continents, setContinents] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // 加载大洲列表
  useEffect(() => {
    if (visible) {
      loadContinents()
    }
  }, [visible])

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (data) {
        // 编辑模式：填充现有数据
        setFormData({
          countryCode: data.countryCode || '',
          countryNameCn: data.countryNameCn || '',
          countryNameEn: data.countryNameEn || '',
          continent: data.continent || '',
          region: data.region || '',
          capital: data.capital || '',
          currencyCode: data.currencyCode || '',
          currencyName: data.currencyName || '',
          phoneCode: data.phoneCode || '',
          timezone: data.timezone || '',
          description: data.description || '',
          status: data.status || 'active',
        })
      } else {
        // 新增模式：重置表单
        setFormData({
          countryCode: '',
          countryNameCn: '',
          countryNameEn: '',
          continent: '',
          region: '',
          capital: '',
          currencyCode: '',
          currencyName: '',
          phoneCode: '',
          timezone: '',
          description: '',
          status: 'active',
        })
      }
      setErrors({})
    }
  }, [visible, data])

  const loadContinents = async () => {
    try {
      const response = await getCountryContinents()
      if (response.errCode === 200 && response.data) {
        setContinents(response.data)
      }
    } catch (err) {
      console.error('加载大洲列表失败:', err)
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

    if (!formData.countryCode.trim()) {
      newErrors.countryCode = '国家代码为必填项'
    }

    if (!formData.countryNameCn.trim()) {
      newErrors.countryNameCn = '中文名称为必填项'
    }

    if (!formData.countryNameEn.trim()) {
      newErrors.countryNameEn = '英文名称为必填项'
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
        const updateData: UpdateCountryRequest = {
          countryCode: formData.countryCode,
          countryNameCn: formData.countryNameCn,
          countryNameEn: formData.countryNameEn,
          continent: formData.continent,
          region: formData.region,
          capital: formData.capital,
          currencyCode: formData.currencyCode,
          currencyName: formData.currencyName,
          phoneCode: formData.phoneCode,
          timezone: formData.timezone,
          description: formData.description,
          status: formData.status,
        }
        const response = await updateCountry(data.id, updateData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建
        const createData: CreateCountryRequest = {
          countryCode: formData.countryCode,
          countryNameCn: formData.countryNameCn,
          countryNameEn: formData.countryNameEn,
          continent: formData.continent,
          region: formData.region,
          capital: formData.capital,
          currencyCode: formData.currencyCode,
          currencyName: formData.currencyName,
          phoneCode: formData.phoneCode,
          timezone: formData.timezone,
          description: formData.description,
          status: formData.status,
        }
        const response = await createCountry(createData)
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存国家失败:', err)
      alert(err.message || '保存失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {data ? '编辑国家' : '新增国家'}
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
                placeholder="如：CN"
                title="国家代码"
                aria-label="国家代码"
                aria-required="true"
              />
              {errors.countryCode && (
                <p className="mt-1 text-xs text-red-500">{errors.countryCode}</p>
              )}
            </div>

            {/* 中文名称 */}
            <div>
              <label htmlFor="countryNameCn" className="block text-xs font-medium text-gray-700 mb-1">
                中文名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="countryNameCn"
                type="text"
                value={formData.countryNameCn}
                onChange={(e) => handleInputChange('countryNameCn', e.target.value)}
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.countryNameCn
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：中国"
                title="中文名称"
                aria-label="中文名称"
                aria-required="true"
              />
              {errors.countryNameCn && (
                <p className="mt-1 text-xs text-red-500">{errors.countryNameCn}</p>
              )}
            </div>

            {/* 英文名称 */}
            <div>
              <label htmlFor="countryNameEn" className="block text-xs font-medium text-gray-700 mb-1">
                英文名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="countryNameEn"
                type="text"
                value={formData.countryNameEn}
                onChange={(e) => handleInputChange('countryNameEn', e.target.value)}
                className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 ${
                  errors.countryNameEn
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="如：China"
                title="英文名称"
                aria-label="英文名称"
                aria-required="true"
              />
              {errors.countryNameEn && (
                <p className="mt-1 text-xs text-red-500">{errors.countryNameEn}</p>
              )}
            </div>

            {/* 大洲 */}
            <div>
              <label htmlFor="continent" className="block text-xs font-medium text-gray-700 mb-1">
                大洲
              </label>
              <select
                id="continent"
                value={formData.continent}
                onChange={(e) => handleInputChange('continent', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                title="大洲"
                aria-label="大洲"
              >
                <option value="">请选择大洲</option>
                {continents.map((continent) => (
                  <option key={continent} value={continent}>
                    {continent}
                  </option>
                ))}
                <option value="亚洲">亚洲</option>
                <option value="欧洲">欧洲</option>
                <option value="北美洲">北美洲</option>
                <option value="南美洲">南美洲</option>
                <option value="非洲">非洲</option>
                <option value="大洋洲">大洋洲</option>
                <option value="南极洲">南极洲</option>
              </select>
            </div>

            {/* 地区 */}
            <div>
              <label htmlFor="region" className="block text-xs font-medium text-gray-700 mb-1">
                地区
              </label>
              <input
                id="region"
                type="text"
                value={formData.region}
                onChange={(e) => handleInputChange('region', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="如：东亚"
                title="地区"
                aria-label="地区"
              />
            </div>

            {/* 首都 */}
            <div>
              <label htmlFor="capital" className="block text-xs font-medium text-gray-700 mb-1">
                首都
              </label>
              <input
                id="capital"
                type="text"
                value={formData.capital}
                onChange={(e) => handleInputChange('capital', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="如：北京"
                title="首都"
                aria-label="首都"
              />
            </div>

            {/* 货币代码 */}
            <div>
              <label htmlFor="currencyCode" className="block text-xs font-medium text-gray-700 mb-1">
                货币代码
              </label>
              <input
                id="currencyCode"
                type="text"
                value={formData.currencyCode}
                onChange={(e) => handleInputChange('currencyCode', e.target.value.toUpperCase())}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="如：CNY"
                title="货币代码"
                aria-label="货币代码"
              />
            </div>

            {/* 货币名称 */}
            <div>
              <label htmlFor="currencyName" className="block text-xs font-medium text-gray-700 mb-1">
                货币名称
              </label>
              <input
                id="currencyName"
                type="text"
                value={formData.currencyName}
                onChange={(e) => handleInputChange('currencyName', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="如：人民币"
                title="货币名称"
                aria-label="货币名称"
              />
            </div>

            {/* 电话区号 */}
            <div>
              <label htmlFor="phoneCode" className="block text-xs font-medium text-gray-700 mb-1">
                电话区号
              </label>
              <input
                id="phoneCode"
                type="text"
                value={formData.phoneCode}
                onChange={(e) => handleInputChange('phoneCode', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="如：+86"
                title="电话区号"
                aria-label="电话区号"
              />
            </div>

            {/* 时区 */}
            <div>
              <label htmlFor="timezone" className="block text-xs font-medium text-gray-700 mb-1">
                时区
              </label>
              <input
                id="timezone"
                type="text"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-gray-900"
                placeholder="如：UTC+8"
                title="时区"
                aria-label="时区"
              />
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
              placeholder="国家描述信息"
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

