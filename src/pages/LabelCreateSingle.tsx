import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Save, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function LabelCreateSingle() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    orderNumber: '',
    recipient: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'NL',
    weight: '',
    transferMethod: 'DECLARATION ONLY',
    remarks: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // 清除该字段的错误
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.orderNumber.trim()) {
      newErrors.orderNumber = '订单号不能为空'
    }
    if (!formData.recipient.trim()) {
      newErrors.recipient = '收件人不能为空'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = '电话不能为空'
    }
    if (!formData.address.trim()) {
      newErrors.address = '地址不能为空'
    }
    if (!formData.city.trim()) {
      newErrors.city = '城市不能为空'
    }
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = '邮编不能为空'
    }
    if (!formData.weight.trim()) {
      newErrors.weight = '重量不能为空'
    } else if (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0) {
      newErrors.weight = '请输入有效的重量（大于0的数字）'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)
    try {
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1000))
      
      alert('标签创建成功！')
      navigate('/bookings/labels')
    } catch (error) {
      console.error('创建失败:', error)
      alert('创建失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/bookings/labels')
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="单个创建标签"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打单', path: '/bookings/labels' },
          { label: '单个创建' }
        ]}
        actionButtons={
          <button
            onClick={handleCancel}
            className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 基本信息 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                基本信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    订单号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.orderNumber}
                    onChange={(e) => handleChange('orderNumber', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.orderNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入订单号"
                  />
                  {errors.orderNumber && (
                    <p className="mt-1 text-xs text-red-500">{errors.orderNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    转运方式 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.transferMethod}
                    onChange={(e) => handleChange('transferMethod', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                    title="转运方式"
                  >
                    <option value="DECLARATION ONLY">DECLARATION ONLY</option>
                    <option value="FULL CONTAINER">FULL CONTAINER</option>
                    <option value="LCL">LCL</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 收件人信息 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                收件人信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    收件人 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.recipient}
                    onChange={(e) => handleChange('recipient', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.recipient ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入收件人姓名"
                  />
                  {errors.recipient && (
                    <p className="mt-1 text-xs text-red-500">{errors.recipient}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    电话 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入电话号码"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    地址 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入详细地址"
                  />
                  {errors.address && (
                    <p className="mt-1 text-xs text-red-500">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    城市 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入城市"
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-red-500">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    邮编 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.postalCode ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入邮编"
                  />
                  {errors.postalCode && (
                    <p className="mt-1 text-xs text-red-500">{errors.postalCode}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    国家 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                    title="国家"
                  >
                    <option value="NL">Netherlands (NL)</option>
                    <option value="BE">Belgium (BE)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="FR">France (FR)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 其他信息 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-3 h-3 text-primary-600" />
                其他信息
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    重量 (KG) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.weight ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="请输入重量"
                  />
                  {errors.weight && (
                    <p className="mt-1 text-xs text-red-500">{errors.weight}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    备注
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => handleChange('remarks', e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                    placeholder="请输入备注信息（可选）"
                  />
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-3 pt-3 bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>取消</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? '创建中...' : '创建标签'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

