import { useState, useEffect } from 'react'
import { X, Receipt, Truck, Building2, Shield, Package, FileText, Settings, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
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
  // 预设费用类型
  defaultFeeType?: 'receivable' | 'payable'
}

interface Fee {
  id?: string
  billId: string | null
  billNumber: string
  customerId: string | null
  customerName: string
  supplierId?: string | null
  supplierName?: string
  feeType?: 'receivable' | 'payable'
  category: string
  feeName: string
  amount: number
  currency: string
  feeDate: string
  description: string
}

interface Supplier {
  id: string
  supplierName: string
  supplierCode: string
}

interface Product {
  id: string
  productCode: string
  productName: string
  feeItems?: ProductFeeItem[]
}

interface ProductFeeItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string
  standardPrice: number
  currency: string
}

interface SupplierPriceItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string
  price: number
  currency: string
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
  defaultCustomerName,
  defaultFeeType
}: FeeModalProps) {
  const [formData, setFormData] = useState({
    billId: defaultBillId || '',
    billNumber: defaultBillNumber || '',
    customerId: defaultCustomerId || '',
    customerName: defaultCustomerName || '',
    supplierId: '',
    supplierName: '',
    feeType: defaultFeeType || 'receivable' as 'receivable' | 'payable',
    category: 'handling',
    feeName: '',
    amount: '',
    currency: 'EUR',
    feeDate: new Date().toISOString().split('T')[0],
    description: ''
  })
  
  const [bills, setBills] = useState<Bill[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierPrices, setSupplierPrices] = useState<SupplierPriceItem[]>([])
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [showProductSelect, setShowProductSelect] = useState(false)
  const [showSupplierPriceSelect, setShowSupplierPriceSelect] = useState(false)
  const [billSearch, setBillSearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 加载订单列表和供应商列表
  useEffect(() => {
    if (visible) {
      loadBills()
      loadSuppliers()
      loadProducts()
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
        supplierId: editingFee.supplierId || '',
        supplierName: editingFee.supplierName || '',
        feeType: editingFee.feeType || 'receivable',
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
        supplierId: '',
        supplierName: '',
        feeType: defaultFeeType || 'receivable',
        category: 'handling',
        feeName: '',
        amount: '',
        currency: 'EUR',
        feeDate: new Date().toISOString().split('T')[0],
        description: ''
      })
    }
    setErrors({})
  }, [editingFee, visible, defaultBillId, defaultBillNumber, defaultCustomerId, defaultCustomerName, defaultFeeType])

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

  const loadSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/suppliers?pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setSuppliers(data.data.list.map((s: any) => ({
          id: s.id,
          supplierName: s.supplierName || s.supplier_name || '',
          supplierCode: s.supplierCode || s.supplier_code || ''
        })))
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error)
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

  const handleSupplierSelect = (supplier: Supplier) => {
    setFormData(prev => ({
      ...prev,
      supplierId: supplier.id,
      supplierName: supplier.supplierName
    }))
    setShowSupplierDropdown(false)
    setSupplierSearch('')
    // 加载该供应商的报价
    loadSupplierPrices(supplier.id)
  }

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/products?isActive=1&pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setProducts(data.data.list)
      }
    } catch (error) {
      console.error('加载产品列表失败:', error)
    }
  }

  const loadSupplierPrices = async (supplierId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/${supplierId}/prices?pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setSupplierPrices(data.data.list)
      } else {
        setSupplierPrices([])
      }
    } catch (error) {
      console.error('加载供应商报价失败:', error)
      setSupplierPrices([])
    }
  }

  const loadProductFeeItems = async (productId: string): Promise<ProductFeeItem[]> => {
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.feeItems) {
        return data.data.feeItems
      }
    } catch (error) {
      console.error('加载产品费用项失败:', error)
    }
    return []
  }

  const handleSelectProductFee = async (productId: string, feeItem: ProductFeeItem) => {
    setFormData(prev => ({
      ...prev,
      category: feeItem.feeCategory || 'other',
      feeName: feeItem.feeName,
      amount: String(feeItem.standardPrice || ''),
      currency: feeItem.currency || 'EUR'
    }))
    setShowProductSelect(false)
  }

  const handleSelectSupplierPrice = (priceItem: SupplierPriceItem) => {
    setFormData(prev => ({
      ...prev,
      category: priceItem.feeCategory || 'other',
      feeName: priceItem.feeName,
      amount: String(priceItem.price || ''),
      currency: priceItem.currency || 'EUR'
    }))
    setShowSupplierPriceSelect(false)
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
    
    // 应付费用需要选择供应商
    if (formData.feeType === 'payable' && !formData.supplierId) {
      newErrors.supplier = '请选择供应商'
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
          customerId: formData.feeType === 'receivable' ? (formData.customerId || null) : null,
          customerName: formData.feeType === 'receivable' ? (formData.customerName || '') : '',
          supplierId: formData.feeType === 'payable' ? (formData.supplierId || null) : null,
          supplierName: formData.feeType === 'payable' ? (formData.supplierName || '') : '',
          feeType: formData.feeType,
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

  const filteredSuppliers = suppliers.filter(supplier => {
    if (!supplierSearch) return true
    const search = supplierSearch.toLowerCase()
    return (
      supplier.supplierName.toLowerCase().includes(search) ||
      supplier.supplierCode?.toLowerCase().includes(search)
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
          {/* 费用类型选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              费用类型 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  feeType: 'receivable',
                  supplierId: '',
                  supplierName: ''
                }))}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  formData.feeType === 'receivable'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-green-300'
                }`}
              >
                <ArrowDownCircle className="w-5 h-5" />
                <span className="font-medium">应收费用</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  feeType: 'payable',
                  customerId: '',
                  customerName: ''
                }))}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  formData.feeType === 'payable'
                    ? 'bg-orange-50 border-orange-500 text-orange-700'
                    : 'border-gray-200 text-gray-600 hover:border-orange-300'
                }`}
              >
                <ArrowUpCircle className="w-5 h-5" />
                <span className="font-medium">应付费用</span>
              </button>
            </div>
          </div>

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
            {formData.feeType === 'receivable' && formData.customerName && (
              <div className="mt-1 text-xs text-gray-500">
                客户：{formData.customerName}
              </div>
            )}
          </div>

          {/* 供应商选择（仅应付费用） */}
          {formData.feeType === 'payable' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                供应商 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.supplierName || supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value)
                    setFormData(prev => ({ ...prev, supplierId: '', supplierName: '' }))
                    setShowSupplierDropdown(true)
                  }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  placeholder="搜索供应商..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
                {formData.supplierName && (
                  <button
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      supplierId: '', 
                      supplierName: ''
                    }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                
                {showSupplierDropdown && !formData.supplierName && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSuppliers.length > 0 ? (
                      filteredSuppliers.slice(0, 10).map(supplier => (
                        <div
                          key={supplier.id}
                          onClick={() => handleSupplierSelect(supplier)}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <div className="font-medium text-sm">{supplier.supplierName}</div>
                          <div className="text-xs text-gray-500">
                            {supplier.supplierCode}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-400 text-center">
                        无匹配供应商
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.supplier && <p className="mt-1 text-xs text-red-500">{errors.supplier}</p>}
            </div>
          )}

          {/* 费用来源选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              费用来源
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.feeType === 'receivable' && products.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowProductSelect(true)}
                  className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-1"
                >
                  <Package className="w-3.5 h-3.5" />
                  从产品库选择
                </button>
              )}
              {formData.feeType === 'payable' && formData.supplierId && supplierPrices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSupplierPriceSelect(true)}
                  className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  从供应商报价选择
                </button>
              )}
            </div>
            
            {/* 快速选择 */}
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

      {/* 产品费用项选择弹窗 */}
      {showProductSelect && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowProductSelect(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                从产品库选择费用项
              </h3>
              <button onClick={() => setShowProductSelect(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(70vh-60px)]">
              {products.map(product => (
                <ProductFeeSelector
                  key={product.id}
                  product={product}
                  onSelect={(feeItem) => handleSelectProductFee(product.id, feeItem)}
                  loadFeeItems={loadProductFeeItems}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 供应商报价选择弹窗 */}
      {showSupplierPriceSelect && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSupplierPriceSelect(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" />
                从供应商报价选择
              </h3>
              <button onClick={() => setShowSupplierPriceSelect(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(70vh-60px)]">
              {supplierPrices.length > 0 ? (
                <div className="space-y-2">
                  {supplierPrices.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSupplierPrice(item)}
                      className="w-full text-left px-3 py-2 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900">{item.feeName}</span>
                        <span className="text-sm font-medium text-orange-600">
                          {item.currency} {item.price?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {item.feeNameEn && (
                        <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">该供应商暂无报价数据</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 产品费用项选择子组件
function ProductFeeSelector({ 
  product, 
  onSelect, 
  loadFeeItems 
}: { 
  product: Product
  onSelect: (feeItem: ProductFeeItem) => void
  loadFeeItems: (productId: string) => Promise<ProductFeeItem[]>
}) {
  const [expanded, setExpanded] = useState(false)
  const [feeItems, setFeeItems] = useState<ProductFeeItem[]>([])
  const [loading, setLoading] = useState(false)

  const handleExpand = async () => {
    if (!expanded && feeItems.length === 0) {
      setLoading(true)
      const items = await loadFeeItems(product.id)
      setFeeItems(items)
      setLoading(false)
    }
    setExpanded(!expanded)
  }

  return (
    <div className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-green-600" />
          <span className="font-medium text-sm text-gray-900">{product.productName}</span>
          <span className="text-xs text-gray-400">{product.productCode}</span>
        </div>
        <span className="text-gray-400">
          {expanded ? '▼' : '▶'}
        </span>
      </button>
      
      {expanded && (
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="text-center py-3 text-xs text-gray-400">加载中...</div>
          ) : feeItems.length > 0 ? (
            feeItems.map(item => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left px-3 py-2 border border-gray-100 rounded hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">{item.feeName}</span>
                  <span className="text-sm font-medium text-green-600">
                    {item.currency} {item.standardPrice?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {item.feeNameEn && (
                  <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-3 text-xs text-gray-400">暂无费用项</div>
          )}
        </div>
      )}
    </div>
  )
}

