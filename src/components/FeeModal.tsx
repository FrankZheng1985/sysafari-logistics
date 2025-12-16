import { useState, useEffect } from 'react'
import { X, Receipt, Truck, Building2, Shield, Package, FileText, Settings } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'
import DatePicker from './DatePicker'

const API_BASE = getApiBaseUrl()

interface FeeModalProps {
  visible: boolean
  onClose: () => void
  onSuccess?: () => void
  editingFee?: Fee | null
  // 预填订单信息（从订单详情页面打开时）
  defaultBillId?: string
  defaultBillNumber?: string
  defaultCustomerId?: string
  defaultCustomerName?: string
}

interface Fee {
  id?: string
  billId: string | null
  billNumber: string
  customerId: string | null
  customerName: string
  category: string
  feeName: string
  amount: number
  currency: string
  feeDate: string
  description: string
}

interface Bill {
  id: string
  billNumber: string
  containerNumber: string
  customerName: string
  customerId: string
}

const FEE_CATEGORIES = [
  { value: 'freight', label: '运费', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'customs', label: '关税', icon: Receipt, color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'warehouse', label: '仓储费', icon: Building2, color: 'text-orange-600', bg: 'bg-orange-100' },
  { value: 'insurance', label: '保险费', icon: Shield, color: 'text-green-600', bg: 'bg-green-100' },
  { value: 'handling', label: '操作费', icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' },
  { value: 'documentation', label: '文件费', icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  { value: 'other', label: '其他费用', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100' },
]

const QUICK_FEE_ITEMS = [
  { category: 'freight', name: '海运费', amount: 0 },
  { category: 'freight', name: '内陆运费', amount: 0 },
  { category: 'customs', name: '进口关税', amount: 0 },
  { category: 'customs', name: '增值税', amount: 0 },
  { category: 'handling', name: '报关费', amount: 150 },
  { category: 'handling', name: '查验费', amount: 200 },
  { category: 'handling', name: '换单费', amount: 50 },
  { category: 'warehouse', name: '仓储费', amount: 0 },
  { category: 'documentation', name: '文件费', amount: 30 },
  { category: 'insurance', name: '保险费', amount: 0 },
]

export default function FeeModal({
  visible,
  onClose,
  onSuccess,
  editingFee,
  defaultBillId,
  defaultBillNumber,
  defaultCustomerId,
  defaultCustomerName
}: FeeModalProps) {
  const [formData, setFormData] = useState({
    billId: defaultBillId || '',
    billNumber: defaultBillNumber || '',
    customerId: defaultCustomerId || '',
    customerName: defaultCustomerName || '',
    category: 'handling',
    feeName: '',
    amount: '',
    currency: 'EUR',
    feeDate: new Date().toISOString().split('T')[0],
    description: ''
  })
  
  const [bills, setBills] = useState<Bill[]>([])
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const [billSearch, setBillSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 加载订单列表
  useEffect(() => {
    if (visible) {
      loadBills()
    }
  }, [visible])

  // 编辑时填充表单
  useEffect(() => {
    if (editingFee) {
      setFormData({
        billId: editingFee.billId || '',
        billNumber: editingFee.billNumber || '',
        customerId: editingFee.customerId || '',
        customerName: editingFee.customerName || '',
        category: editingFee.category || 'handling',
        feeName: editingFee.feeName || '',
        amount: String(editingFee.amount || ''),
        currency: editingFee.currency || 'EUR',
        feeDate: editingFee.feeDate || new Date().toISOString().split('T')[0],
        description: editingFee.description || ''
      })
    } else {
      // 新增时使用默认值
      setFormData({
        billId: defaultBillId || '',
        billNumber: defaultBillNumber || '',
        customerId: defaultCustomerId || '',
        customerName: defaultCustomerName || '',
        category: 'handling',
        feeName: '',
        amount: '',
        currency: 'EUR',
        feeDate: new Date().toISOString().split('T')[0],
        description: ''
      })
    }
    setErrors({})
  }, [editingFee, visible, defaultBillId, defaultBillNumber, defaultCustomerId, defaultCustomerName])

  const loadBills = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/bills?pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setBills(data.data.list.map((b: any) => ({
          id: b.id,
          billNumber: b.billNumber,
          containerNumber: b.containerNumber,
          customerName: b.customerName || '',
          customerId: b.customerId || ''
        })))
      }
    } catch (error) {
      console.error('加载订单列表失败:', error)
    }
  }

  const handleBillSelect = (bill: Bill) => {
    setFormData(prev => ({
      ...prev,
      billId: bill.id,
      billNumber: bill.billNumber,
      customerId: bill.customerId,
      customerName: bill.customerName
    }))
    setShowBillDropdown(false)
    setBillSearch('')
  }

  const handleQuickFeeSelect = (item: typeof QUICK_FEE_ITEMS[0]) => {
    setFormData(prev => ({
      ...prev,
      category: item.category,
      feeName: item.name,
      amount: item.amount > 0 ? String(item.amount) : prev.amount
    }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.feeName.trim()) {
      newErrors.feeName = '请输入费用名称'
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = '请输入有效金额'
    }
    
    if (!formData.feeDate) {
      newErrors.feeDate = '请选择费用日期'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setSubmitting(true)
    try {
      const url = editingFee ? `/api/fees/${editingFee.id}` : '/api/fees'
      const method = editingFee ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: formData.billId || null,
          billNumber: formData.billNumber || '',
          customerId: formData.customerId || null,
          customerName: formData.customerName || '',
          category: formData.category,
          feeName: formData.feeName,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          feeDate: formData.feeDate,
          description: formData.description
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        onSuccess?.()
        onClose()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存费用失败:', error)
      alert('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredBills = bills.filter(bill => {
    if (!billSearch) return true
    const search = billSearch.toLowerCase()
    return (
      bill.billNumber.toLowerCase().includes(search) ||
      bill.containerNumber?.toLowerCase().includes(search) ||
      bill.customerName?.toLowerCase().includes(search)
    )
  })

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            {editingFee ? '编辑费用' : '新增费用'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 关联订单 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              关联订单（可选）
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.billNumber || billSearch}
                onChange={(e) => {
                  setBillSearch(e.target.value)
                  setFormData(prev => ({ ...prev, billId: '', billNumber: '' }))
                  setShowBillDropdown(true)
                }}
                onFocus={() => setShowBillDropdown(true)}
                placeholder="搜索提单号..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
              {formData.billNumber && (
                <button
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    billId: '', 
                    billNumber: '',
                    customerId: '',
                    customerName: ''
                  }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              {showBillDropdown && !formData.billNumber && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredBills.length > 0 ? (
                    filteredBills.slice(0, 10).map(bill => (
                      <div
                        key={bill.id}
                        onClick={() => handleBillSelect(bill)}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="font-medium text-sm">{bill.billNumber}</div>
                        <div className="text-xs text-gray-500">
                          {bill.containerNumber} | {bill.customerName || '未关联客户'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-400 text-center">
                      无匹配订单
                    </div>
                  )}
                </div>
              )}
            </div>
            {formData.customerName && (
              <div className="mt-1 text-xs text-gray-500">
                客户：{formData.customerName}
              </div>
            )}
          </div>

          {/* 快速选择费用项 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              快速选择
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_FEE_ITEMS.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleQuickFeeSelect(item)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    formData.feeName === item.name 
                      ? 'bg-primary-100 border-primary-500 text-primary-700'
                      : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* 费用分类 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              费用分类 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FEE_CATEGORIES.map(cat => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      formData.category === cat.value
                        ? `${cat.bg} ${cat.color} border-current`
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 费用名称和金额 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                费用名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.feeName}
                onChange={(e) => setFormData(prev => ({ ...prev, feeName: e.target.value }))}
                placeholder="请输入费用名称"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.feeName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.feeName && <p className="mt-1 text-xs text-red-500">{errors.feeName}</p>}
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                金额 <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="px-2 py-2 text-sm border border-r-0 border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                >
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className={`flex-1 px-3 py-2 text-sm border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
            </div>
          </div>

          {/* 费用日期 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              费用日期 <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={formData.feeDate}
              onChange={(value) => setFormData(prev => ({ ...prev, feeDate: value }))}
              placeholder="选择费用日期"
            />
            {errors.feeDate && <p className="mt-1 text-xs text-red-500">{errors.feeDate}</p>}
          </div>

          {/* 说明 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              说明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="备注信息..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

