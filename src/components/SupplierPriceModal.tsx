import { useState, useEffect } from 'react'
import { X, Languages, Loader2 } from 'lucide-react'
import DateTimePicker from './DateTimePicker'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface SupplierPrice {
  id?: number
  supplierId: string
  category: string
  name: string
  nameEn: string
  unit: string
  unitPrice: number
  currency: string
  validFrom: string
  validUntil: string
  isActive: boolean
  notes: string
}

interface SupplierPriceModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  supplierId: string
  data?: SupplierPrice | null
}

// 费用类别选项
const CATEGORY_OPTIONS = [
  '运输服务',
  '港口服务',
  '报关服务',
  '仓储服务',
  '文件费',
  '管理费',
  '其他服务'
]

export default function SupplierPriceModal({
  visible,
  onClose,
  onSuccess,
  supplierId,
  data
}: SupplierPriceModalProps) {
  const [formData, setFormData] = useState<SupplierPrice>({
    supplierId: '',
    category: '',
    name: '',
    nameEn: '',
    unit: '次',
    unitPrice: 0,
    currency: 'EUR',
    validFrom: '',
    validUntil: '',
    isActive: true,
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)

  useEffect(() => {
    if (data) {
      setFormData({
        ...data,
        supplierId,
        validFrom: data.validFrom ? data.validFrom.split('T')[0] : '',
        validUntil: data.validUntil ? data.validUntil.split('T')[0] : ''
      })
    } else {
      setFormData({
        supplierId,
        category: '',
        name: '',
        nameEn: '',
        unit: '次',
        unitPrice: 0,
        currency: 'EUR',
        validFrom: '',
        validUntil: '',
        isActive: true,
        notes: ''
      })
    }
    setErrors({})
  }, [data, visible, supplierId])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.category.trim()) {
      newErrors.category = '请选择费用类别'
    }
    if (!formData.name.trim()) {
      newErrors.name = '请输入费用名称'
    }
    if (formData.unitPrice <= 0) {
      newErrors.unitPrice = '单价必须大于0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 翻译费用名称
  const handleTranslate = async () => {
    if (!formData.name.trim()) {
      setErrors({ ...errors, name: '请先输入费用名称' })
      return
    }

    setTranslating(true)
    try {
      const response = await fetch(`${API_BASE}/api/translate/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name: formData.name })
      })
      const result = await response.json()
      
      if (result.errCode === 200 && result.data?.translated) {
        setFormData(prev => ({ ...prev, nameEn: result.data.translated }))
      } else {
        alert('翻译失败，请手动输入')
      }
    } catch (error) {
      console.error('翻译失败:', error)
      alert('翻译失败，请手动输入')
    } finally {
      setTranslating(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      // 修复：使用更严格的判断方式，避免 id 为假值时误判
      const isEditing = Boolean(data && data.id)
      const url = isEditing 
        ? `${API_BASE}/api/suppliers/${supplierId}/prices/${data!.id}`
        : `${API_BASE}/api/suppliers/${supplierId}/prices`
      
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          category: formData.category,
          name: formData.name,
          nameEn: formData.nameEn,
          unit: formData.unit,
          unitPrice: formData.unitPrice,
          currency: formData.currency,
          validFrom: formData.validFrom || null,
          validUntil: formData.validUntil || null,
          isActive: formData.isActive,
          notes: formData.notes
        })
      })

      const result = await response.json()
      
      if (result.errCode === 200) {
        onSuccess()
        onClose()
      } else {
        alert(result.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {data?.id ? '编辑采购价' : '新增采购价'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-4">
          {/* 费用类别 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              费用类别 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">请选择</option>
              {CATEGORY_OPTIONS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          {/* 费用名称（中文） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              费用名称（中文） <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="如：海运费"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* 费用名称（英文） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              费用名称（英文）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.nameEn}
                onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="如：Ocean Freight"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleTranslate}
                disabled={translating || !formData.name.trim()}
                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="自动翻译"
              >
                {translating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Languages className="w-4 h-4" />
                )}
                翻译
              </button>
            </div>
          </div>

          {/* 单价和单位 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                单价 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.unitPrice ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.unitPrice && <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
              <input
                type="text"
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                placeholder="如：次、票、柜"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 货币 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">货币</label>
            <select
              value={formData.currency}
              onChange={e => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="EUR">EUR - 欧元</option>
              <option value="USD">USD - 美元</option>
              <option value="CNY">CNY - 人民币</option>
              <option value="GBP">GBP - 英镑</option>
            </select>
          </div>

          {/* 有效期 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">有效期开始</label>
              <DateTimePicker
                value={formData.validFrom}
                onChange={(value) => setFormData({ ...formData, validFrom: value })}
                showTime={false}
                placeholder="选择开始日期"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">有效期结束</label>
              <DateTimePicker
                value={formData.validUntil}
                onChange={(value) => setFormData({ ...formData, validUntil: value })}
                showTime={false}
                placeholder="选择结束日期"
              />
            </div>
          </div>

          {/* 状态 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">启用</label>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="可选备注信息"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {data?.id ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
