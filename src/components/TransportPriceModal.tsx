import { useState, useEffect } from 'react'
import { X, Truck, MapPin, DollarSign, Calendar, FileText } from 'lucide-react'
import { getTransportMethodNames } from '../utils/api'

// 运输价格项目类型
export interface TransportPriceItem {
  id: string
  name: string
  origin: string
  destination: string
  transportType: string
  distance: number        // 公里数
  pricePerKm: number      // 公里单价
  totalPrice: number      // 运输总价 = 公里数 × 公里单价
  currency: string
  validFrom: string
  validTo: string
  description: string
  isActive: boolean
}

interface TransportPriceModalProps {
  visible: boolean
  onClose: () => void
  onSave: (data: TransportPriceItem) => void
  editData?: TransportPriceItem | null
}

const currencyOptions = ['EUR', 'USD', 'CNY', 'GBP']

export default function TransportPriceModal({ visible, onClose, onSave, editData }: TransportPriceModalProps) {
  const [formData, setFormData] = useState<Partial<TransportPriceItem>>({
    name: '',
    origin: '',
    destination: '',
    transportType: '',
    distance: 0,
    pricePerKm: 0,
    totalPrice: 0,
    currency: 'EUR',
    validFrom: '',
    validTo: '',
    description: '',
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [transportTypes, setTransportTypes] = useState<string[]>([])

  // 加载运输方式列表
  useEffect(() => {
    const loadTransportMethods = async () => {
      try {
        const response = await getTransportMethodNames()
        if (response.errCode === 200 && response.data) {
          const data = response.data
          setTransportTypes(data)
          // 如果没有编辑数据且有运输方式，设置默认值
          if (!editData && data.length > 0) {
            setFormData(prev => ({ ...prev, transportType: data[0] }))
          }
        }
      } catch (err) {
        console.error('加载运输方式失败:', err)
        // 使用备用默认值
        setTransportTypes(['卡车', '空运', '海运', '铁路', '快递'])
      }
    }
    if (visible) {
      loadTransportMethods()
    }
  }, [visible, editData])

  // 当编辑数据变化时，更新表单
  useEffect(() => {
    if (editData) {
      setFormData(editData)
    } else {
      setFormData({
        name: '',
        origin: '',
        destination: '',
        transportType: transportTypes.length > 0 ? transportTypes[0] : '',
        distance: 0,
        pricePerKm: 0,
        totalPrice: 0,
        currency: 'EUR',
        validFrom: '',
        validTo: '',
        description: '',
        isActive: true,
      })
    }
    setErrors({})
  }, [editData, visible, transportTypes])

  // 当公里数或公里单价变化时，自动计算运输总价
  const handleDistanceChange = (value: number) => {
    const newFormData = { ...formData, distance: value }
    if (value > 0 && formData.pricePerKm && formData.pricePerKm > 0) {
      newFormData.totalPrice = value * formData.pricePerKm
    }
    setFormData(newFormData)
  }

  const handlePricePerKmChange = (value: number) => {
    const newFormData = { ...formData, pricePerKm: value }
    if (formData.distance && formData.distance > 0 && value > 0) {
      newFormData.totalPrice = formData.distance * value
    }
    setFormData(newFormData)
  }

  // 当运输总价变化时，反推公里单价
  const handleTotalPriceChange = (value: number) => {
    const newFormData = { ...formData, totalPrice: value }
    if (formData.distance && formData.distance > 0 && value > 0) {
      newFormData.pricePerKm = value / formData.distance
    }
    setFormData(newFormData)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name?.trim()) {
      newErrors.name = '请输入价格名称'
    }
    if (!formData.origin?.trim()) {
      newErrors.origin = '请输入启运地'
    }
    if (!formData.destination?.trim()) {
      newErrors.destination = '请输入目的地'
    }
    if (!formData.distance || formData.distance <= 0) {
      newErrors.distance = '请输入有效的公里数'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    // 计算：如果有公里数和公里单价，计算运输总价；如果有公里数和运输总价，反推公里单价
    const finalDistance = Number(formData.distance) || 0
    let finalPricePerKm = Number(formData.pricePerKm) || 0
    let finalTotalPrice = Number(formData.totalPrice) || 0
    
    if (finalDistance > 0 && finalPricePerKm > 0 && finalTotalPrice === 0) {
      finalTotalPrice = finalDistance * finalPricePerKm
    } else if (finalDistance > 0 && finalTotalPrice > 0 && finalPricePerKm === 0) {
      finalPricePerKm = finalTotalPrice / finalDistance
    }

    const data: TransportPriceItem = {
      id: editData?.id || Date.now().toString(),
      name: formData.name || '',
      origin: formData.origin || '',
      destination: formData.destination || '',
      transportType: formData.transportType || '卡车',
      distance: finalDistance,
      pricePerKm: finalPricePerKm,
      totalPrice: finalTotalPrice,
      currency: formData.currency || 'EUR',
      validFrom: formData.validFrom || '',
      validTo: formData.validTo || '',
      description: formData.description || '',
      isActive: formData.isActive !== false,
    }

    onSave(data)
    onClose()
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {editData ? '编辑运输价格' : '新增运输价格'}
              </h2>
              <p className="text-xs text-gray-500">维护运输线路和价格信息</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-3 space-y-3">
          {/* 基本信息 */}
          <div className="bg-gray-50 rounded p-3">
            <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1">
              <FileText className="w-3 h-3 text-primary-600" />
              基本信息
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  价格名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="如：德国境内-标准派送"
                />
                {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">运输方式</label>
                <select
                  value={formData.transportType || '卡车'}
                  onChange={(e) => setFormData({ ...formData, transportType: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  {transportTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">计价币种</label>
                <select
                  value={formData.currency || 'EUR'}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  {currencyOptions.map(cur => (
                    <option key={cur} value={cur}>{cur}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 路线信息 */}
          <div className="bg-blue-50 rounded p-3">
            <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-600" />
              路线信息
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  启运地 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.origin || ''}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white ${
                    errors.origin ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="如：汉堡港"
                />
                {errors.origin && <p className="text-xs text-red-500 mt-0.5">{errors.origin}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  目的地 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.destination || ''}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white ${
                    errors.destination ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="如：德国全境"
                />
                {errors.destination && <p className="text-xs text-red-500 mt-0.5">{errors.destination}</p>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="px-2 py-0.5 bg-white rounded border border-gray-200">{formData.origin || '启运地'}</span>
                <span className="text-primary-600">→</span>
                <span className="px-2 py-0.5 bg-white rounded border border-gray-200">{formData.destination || '目的地'}</span>
              </div>
            </div>
          </div>

          {/* 价格信息 */}
          <div className="bg-green-50 rounded p-3">
            <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-green-600" />
              价格信息
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  公里数 (KM) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.distance || ''}
                  onChange={(e) => handleDistanceChange(parseFloat(e.target.value) || 0)}
                  className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white ${
                    errors.distance ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.distance && <p className="text-xs text-red-500 mt-0.5">{errors.distance}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  公里单价 ({formData.currency || 'EUR'}/KM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pricePerKm || ''}
                  onChange={(e) => handlePricePerKmChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-0.5">输入后自动计算总价</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  运输总价 ({formData.currency || 'EUR'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalPrice || ''}
                  onChange={(e) => handleTotalPriceChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-400 mt-0.5">输入后自动反推单价</p>
              </div>
            </div>
            <div className="mt-2 p-2 bg-white rounded border border-green-200">
              <p className="text-xs text-gray-600">
                <strong>计费公式：</strong>运输总价 = 公里数 × 公里单价 = {formData.distance || 0} × {(formData.pricePerKm || 0).toFixed(2)} = <strong className="text-green-600">{((formData.distance || 0) * (formData.pricePerKm || 0)).toFixed(2)} {formData.currency || 'EUR'}</strong>
              </p>
            </div>
          </div>

          {/* 有效期和备注 */}
          <div className="bg-orange-50 rounded p-3">
            <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-orange-600" />
              有效期与备注
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">生效日期</label>
                <input
                  type="date"
                  value={formData.validFrom || ''}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">失效日期</label>
                <input
                  type="date"
                  value={formData.validTo || ''}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">备注说明</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white resize-none"
                  rows={2}
                  placeholder="价格备注信息..."
                />
              </div>
            </div>
          </div>

          {/* 状态开关 */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded">
            <div>
              <span className="text-xs font-medium text-gray-700">启用状态</span>
              <p className="text-xs text-gray-500">关闭后此价格将不在报价中使用</p>
            </div>
            <button
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                formData.isActive ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  formData.isActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs font-medium transition-colors"
          >
            {editData ? '保存修改' : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  )
}
