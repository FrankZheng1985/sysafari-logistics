import { useState, useEffect, useRef } from 'react'
import { X, Receipt, Truck, Building2, Shield, Package, FileText, Settings, ArrowDownCircle, ArrowUpCircle, Plus, Check, Search, AlertCircle, Edit3 } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'
import DatePicker from './DatePicker'

const API_BASE = getApiBaseUrl()

// 费用来源类型
type FeeSourceType = 'product' | 'supplier_price' | 'manual'

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
  routeFrom?: string    // 起运地
  routeTo?: string      // 目的地
  returnPoint?: string  // 还柜点
  city?: string         // 城市
  country?: string      // 国家
  transportMode?: string // 运输方式
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

// 费用来源配置
const FEE_SOURCES = [
  { 
    value: 'product' as FeeSourceType, 
    label: '产品库', 
    icon: Package, 
    color: 'text-green-600', 
    bg: 'bg-green-50',
    borderColor: 'border-green-200',
    hoverBg: 'hover:bg-green-100',
    description: '从标准产品费用项中选择'
  },
  { 
    value: 'supplier_price' as FeeSourceType, 
    label: '供应商报价', 
    icon: Receipt, 
    color: 'text-orange-600', 
    bg: 'bg-orange-50',
    borderColor: 'border-orange-200',
    hoverBg: 'hover:bg-orange-100',
    description: '从供应商报价中选择'
  },
  { 
    value: 'manual' as FeeSourceType, 
    label: '手动录入', 
    icon: Edit3, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverBg: 'hover:bg-blue-100',
    description: '自定义费用项（需审批）'
  },
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
  
  // 费用来源相关状态
  const [feeSource, setFeeSource] = useState<FeeSourceType>('manual')
  const [isManualEntry, setIsManualEntry] = useState(true)
  const [selectedFeeItems, setSelectedFeeItems] = useState<Array<{
    id: string
    feeName: string
    category: string
    amount: number
    currency: string
    source: FeeSourceType
    sourceId?: string | number
  }>>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  
  // 供应商报价搜索和多选
  const [supplierPriceSearch, setSupplierPriceSearch] = useState('')
  const [selectedPriceIds, setSelectedPriceIds] = useState<number[]>([])
  
  // 供应商搜索防抖
  const supplierSearchRef = useRef<NodeJS.Timeout | null>(null)

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

  const loadSuppliers = async (search?: string) => {
    setLoadingSuppliers(true)
    try {
      // 增加 pageSize 到 500 获取更多供应商，并支持搜索
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const response = await fetch(`${API_BASE}/api/suppliers?pageSize=500&status=active${searchParam}`)
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
    } finally {
      setLoadingSuppliers(false)
    }
  }
  
  // 供应商搜索处理（带防抖）
  const handleSupplierSearchChange = (value: string) => {
    setSupplierSearch(value)
    setFormData(prev => ({ ...prev, supplierId: '', supplierName: '' }))
    setShowSupplierDropdown(true)
    
    // 防抖搜索
    if (supplierSearchRef.current) {
      clearTimeout(supplierSearchRef.current)
    }
    
    if (value.length >= 2) {
      supplierSearchRef.current = setTimeout(() => {
        loadSuppliers(value)
      }, 300)
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
    // 标记为从产品库选择，不需要审批
    setFeeSource('product')
    setIsManualEntry(false)
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
    // 标记为从供应商报价选择，不需要审批
    setFeeSource('supplier_price')
    setIsManualEntry(false)
    setShowSupplierPriceSelect(false)
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
      const url = editingFee ? `${API_BASE}/api/fees/${editingFee.id}` : `${API_BASE}/api/fees`
      const method = editingFee ? 'PUT' : 'POST'
      
      // 构建描述信息，包含费用来源
      let description = formData.description || ''
      if (isManualEntry && !editingFee) {
        description = `[手动录入-待审批] ${description}`.trim()
      }
      
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
          description: description,
          // 标记费用来源和审批状态
          feeSource: feeSource,
          needApproval: isManualEntry && !editingFee
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        // 如果是手动录入的新费用项，提示需要审批
        if (isManualEntry && !editingFee) {
          // 创建审批申请
          try {
            await fetch(`${API_BASE}/api/fee-item-approvals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                feeId: data.data?.id,
                feeName: formData.feeName,
                category: formData.category,
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                supplierId: formData.supplierId || null,
                supplierName: formData.supplierName || '',
                description: formData.description,
                status: 'pending'
              })
            })
          } catch (err) {
            console.log('创建审批记录失败（可能API未实现）:', err)
          }
        }
        
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.supplierName || supplierSearch}
                    onChange={(e) => handleSupplierSearchChange(e.target.value)}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="搜索供应商名称或编码..."
                    className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                  {loadingSuppliers && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {formData.supplierName && (
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, supplierId: '', supplierName: '' }))
                        setSupplierPrices([])
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {showSupplierDropdown && !formData.supplierName && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSuppliers.length > 0 ? (
                      <>
                        <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 border-b sticky top-0">
                          共 {filteredSuppliers.length} 个供应商
                        </div>
                        {filteredSuppliers.slice(0, 20).map(supplier => (
                          <div
                            key={supplier.id}
                            onClick={() => handleSupplierSelect(supplier)}
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-gray-900">{supplier.supplierName}</div>
                            <div className="text-xs text-gray-500">{supplier.supplierCode}</div>
                          </div>
                        ))}
                        {filteredSuppliers.length > 20 && (
                          <div className="px-3 py-2 text-xs text-gray-400 text-center bg-gray-50">
                            还有 {filteredSuppliers.length - 20} 个供应商，请输入关键字筛选
                          </div>
                        )}
                      </>
                    ) : supplierSearch.length >= 2 ? (
                      <div className="px-3 py-4 text-center">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm text-gray-500">未找到匹配的供应商</p>
                        <p className="text-xs text-gray-400 mt-1">请检查供应商名称或编码</p>
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-sm text-gray-400 text-center">
                        请输入至少2个字符搜索供应商
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.supplier && <p className="mt-1 text-xs text-red-500">{errors.supplier}</p>}
            </div>
          )}

          {/* 费用来源选择 - 根据费用类型显示不同选项 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              费用来源 <span className="text-red-500">*</span>
            </label>
            
            {/* 应收费用：产品库 + 手动录入 */}
            {formData.feeType === 'receivable' && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* 产品库选项 */}
                <button
                  type="button"
                  onClick={() => {
                    setFeeSource('product')
                    setIsManualEntry(false)
                    setShowProductSelect(true)
                  }}
                  className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    feeSource === 'product'
                      ? 'bg-green-50 text-green-600 border-green-500 ring-1 ring-green-500'
                      : 'border-gray-200 text-gray-600 hover:bg-green-50'
                  }`}
                >
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <Package className="w-4 h-4" />
                  <span className="font-medium text-xs">产品库</span>
                </button>
                
                {/* 手动录入选项 */}
                <button
                  type="button"
                  onClick={() => {
                    setFeeSource('manual')
                    setIsManualEntry(true)
                  }}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    feeSource === 'manual'
                      ? 'bg-blue-50 text-blue-600 border-blue-500 ring-1 ring-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-blue-50'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="font-medium text-xs">手动录入</span>
                </button>
              </div>
            )}
            
            {/* 应付费用：供应商报价 + 手动录入 */}
            {formData.feeType === 'payable' && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* 供应商报价选项 */}
                <button
                  type="button"
                  onClick={() => {
                    if (formData.supplierId) {
                      setFeeSource('supplier_price')
                      setIsManualEntry(false)
                      setShowSupplierPriceSelect(true)
                    }
                  }}
                  disabled={!formData.supplierId}
                  className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    feeSource === 'supplier_price'
                      ? 'bg-orange-50 text-orange-600 border-orange-500 ring-1 ring-orange-500'
                      : !formData.supplierId
                        ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                        : 'border-gray-200 text-gray-600 hover:bg-orange-50'
                  }`}
                >
                  {formData.supplierId && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  )}
                  <Receipt className="w-4 h-4" />
                  <span className="font-medium text-xs">供应商报价</span>
                </button>
                
                {/* 手动录入选项 */}
                <button
                  type="button"
                  onClick={() => {
                    setFeeSource('manual')
                    setIsManualEntry(true)
                  }}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    feeSource === 'manual'
                      ? 'bg-blue-50 text-blue-600 border-blue-500 ring-1 ring-blue-500'
                      : 'border-gray-200 text-gray-600 hover:bg-blue-50'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="font-medium text-xs">手动录入</span>
                </button>
              </div>
            )}
            
            {/* 费用来源说明 */}
            <div className="text-xs text-gray-500 mb-2">
              {formData.feeType === 'receivable' && feeSource === 'product' && (
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-green-500" />
                  从产品库选择标准费用项，价格自动填充
                </span>
              )}
              {formData.feeType === 'payable' && feeSource === 'supplier_price' && (
                <span className="flex items-center gap-1">
                  <Receipt className="w-3 h-3 text-orange-500" />
                  {formData.supplierId 
                    ? supplierPrices.length > 0 
                      ? `该供应商有 ${supplierPrices.length} 个报价项可选`
                      : '该供应商暂无报价数据，请手动录入'
                    : '请先选择供应商'
                  }
                </span>
              )}
              {feeSource === 'manual' && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  手动录入的新费用项需经理审批后才能成为常规费用
                </span>
              )}
            </div>
            
            {/* 快捷选择按钮 */}
            <div className="flex flex-wrap gap-2">
              {formData.feeType === 'receivable' && (
                <button
                  type="button"
                  onClick={() => {
                    setFeeSource('product')
                    setShowProductSelect(true)
                  }}
                  className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  从产品库选择
                </button>
              )}
              {formData.feeType === 'payable' && formData.supplierId && (
                <button
                  type="button"
                  onClick={() => {
                    setFeeSource('supplier_price')
                    setShowSupplierPriceSelect(true)
                  }}
                  className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${
                    supplierPrices.length > 0
                      ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  从供应商报价选择 {supplierPrices.length > 0 ? `(${supplierPrices.length})` : '(暂无)'}
                </button>
              )}
            </div>
          </div>

          {/* 费用分类 - 仅在手动录入时可选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              费用分类 <span className="text-red-500">*</span>
              {!isManualEntry && formData.feeName && (
                <span className="ml-2 text-green-600 text-xs font-normal">
                  (已从{feeSource === 'product' ? '产品库' : '供应商报价'}自动填充)
                </span>
              )}
              {!isManualEntry && !formData.feeName && (
                <span className="ml-2 text-gray-400 text-xs font-normal">
                  (请先选择费用来源或切换到手动录入)
                </span>
              )}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FEE_CATEGORIES.map(cat => {
                const Icon = cat.icon
                // 只有手动录入时才能选择费用分类
                const canSelect = isManualEntry || formData.feeName
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      if (canSelect) {
                        setFormData(prev => ({ ...prev, category: cat.value }))
                      }
                    }}
                    disabled={!canSelect}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      formData.category === cat.value
                        ? `${cat.bg} ${cat.color} border-current`
                        : !canSelect
                          ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                )
              })}
            </div>
            {!isManualEntry && !formData.feeName && (
              <p className="mt-1.5 text-xs text-gray-400">
                💡 费用分类会根据选择的费用项自动填充，或选择"手动录入"自定义
              </p>
            )}
          </div>

          {/* 费用名称和金额 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                费用名称 <span className="text-red-500">*</span>
                {isManualEntry && formData.feeName && (
                  <span className="ml-2 text-amber-500 text-xs font-normal">
                    (手动录入·需审批)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.feeName}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, feeName: e.target.value }))
                    // 用户手动输入费用名称时，标记为手动录入
                    if (e.target.value && feeSource !== 'product' && feeSource !== 'supplier_price') {
                      setIsManualEntry(true)
                    }
                  }}
                  placeholder={isManualEntry ? "请输入费用名称（新费用项需审批）" : "请输入费用名称"}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.feeName ? 'border-red-500' : 'border-gray-300'
                  } ${isManualEntry && formData.feeName ? 'border-amber-300 bg-amber-50' : ''}`}
                />
                {isManualEntry && formData.feeName && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                )}
              </div>
              {errors.feeName && <p className="mt-1 text-xs text-red-500">{errors.feeName}</p>}
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                金额 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
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
                  className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          {/* 手动录入提示 */}
          <div className="flex-1">
            {isManualEntry && formData.feeName && !editingFee && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span>手动录入的费用项将提交审批</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
                isManualEntry && formData.feeName && !editingFee
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </>
              ) : isManualEntry && formData.feeName && !editingFee ? (
                <>
                  <Check className="w-4 h-4" />
                  保存并提交审批
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
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
      {showSupplierPriceSelect && (() => {
        // 过滤搜索结果
        const filteredPrices = supplierPrices.filter(item => {
          if (!supplierPriceSearch) return true
          const search = supplierPriceSearch.toLowerCase()
          return (
            item.feeName?.toLowerCase().includes(search) ||
            item.feeNameEn?.toLowerCase().includes(search) ||
            item.routeFrom?.toLowerCase().includes(search) ||
            item.routeTo?.toLowerCase().includes(search) ||
            item.city?.toLowerCase().includes(search) ||
            item.returnPoint?.toLowerCase().includes(search)
          )
        })
        
        // 全选/取消全选
        const handleSelectAll = () => {
          if (selectedPriceIds.length === filteredPrices.length) {
            setSelectedPriceIds([])
          } else {
            setSelectedPriceIds(filteredPrices.map(p => p.id))
          }
        }
        
        // 切换单个选择
        const toggleSelect = (id: number) => {
          setSelectedPriceIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          )
        }
        
        // 批量添加选中的费用项
        const handleBatchAdd = async () => {
          const selectedItems = supplierPrices.filter(p => selectedPriceIds.includes(p.id))
          if (selectedItems.length === 0) return
          
          // 如果只选了一个，直接用原来的逻辑
          if (selectedItems.length === 1) {
            handleSelectSupplierPrice(selectedItems[0])
            setSelectedPriceIds([])
            setSupplierPriceSearch('')
            return
          }
          
          // 批量创建费用
          setSubmitting(true)
          try {
            for (const item of selectedItems) {
              await fetch(`${API_BASE}/api/fees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  billId: formData.billId || null,
                  billNumber: formData.billNumber || '',
                  customerId: null,
                  customerName: '',
                  supplierId: formData.supplierId || null,
                  supplierName: formData.supplierName || '',
                  feeType: 'payable',
                  category: item.feeCategory || 'other',
                  feeName: item.feeName,
                  amount: item.price || 0,
                  currency: item.currency || 'EUR',
                  feeDate: formData.feeDate,
                  description: `${item.routeFrom || ''} → ${item.city || item.routeTo || ''}`.trim(),
                  feeSource: 'supplier_price',
                  needApproval: false
                })
              })
            }
            onSuccess?.()
            onClose()
          } catch (error) {
            console.error('批量添加费用失败:', error)
            alert('批量添加失败')
          } finally {
            setSubmitting(false)
            setSelectedPriceIds([])
            setSupplierPriceSearch('')
          }
        }
        
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => {
              setShowSupplierPriceSelect(false)
              setSelectedPriceIds([])
              setSupplierPriceSearch('')
            }} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
              {/* 标题栏 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-600" />
                  从供应商报价选择
                  {selectedPriceIds.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">
                      已选 {selectedPriceIds.length} 项
                    </span>
                  )}
                </h3>
                <button onClick={() => {
                  setShowSupplierPriceSelect(false)
                  setSelectedPriceIds([])
                  setSupplierPriceSearch('')
                }} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              {/* 搜索和全选操作栏 */}
              <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  {/* 搜索框 */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={supplierPriceSearch}
                      onChange={(e) => setSupplierPriceSearch(e.target.value)}
                      placeholder="搜索费用名称、城市、邮编..."
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    {supplierPriceSearch && (
                      <button
                        onClick={() => setSupplierPriceSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {/* 全选按钮 */}
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 whitespace-nowrap"
                  >
                    {selectedPriceIds.length === filteredPrices.length && filteredPrices.length > 0 ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="mt-1.5 text-xs text-gray-500">
                  共 {filteredPrices.length} 条报价 {supplierPriceSearch && `(搜索结果)`}
                </div>
              </div>
              
              {/* 报价列表 */}
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
                {filteredPrices.length > 0 ? (
                  <div className="space-y-2">
                    {filteredPrices.map(item => {
                      const isSelected = selectedPriceIds.includes(item.id)
                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors ${
                            isSelected 
                              ? 'border-orange-400 bg-orange-50' 
                              : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                          }`}
                          onClick={() => toggleSelect(item.id)}
                        >
                          {/* 复选框 */}
                          <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          
                          {/* 内容 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm text-gray-900">{item.feeName}</span>
                              <span className="text-sm font-medium text-orange-600">
                                {item.currency} {item.price?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {item.feeNameEn && (
                              <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                            )}
                            {/* 显示路线信息 */}
                            {(item.routeFrom || item.routeTo || item.returnPoint || item.city) && (
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                {(item.routeFrom || item.routeTo || item.city) && (
                                  <span className="text-blue-600">
                                    📍 {item.routeFrom || '-'} → {item.city ? `${item.city}${item.routeTo ? ` (${item.routeTo})` : ''}` : item.routeTo || '-'}
                                  </span>
                                )}
                                {item.returnPoint && (
                                  <span className="text-green-600">
                                    🔄 还柜: {item.returnPoint}
                                  </span>
                                )}
                                {item.transportMode && (
                                  <span className="text-purple-600">
                                    🚛 {item.transportMode}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">{supplierPriceSearch ? '未找到匹配的报价' : '该供应商暂无报价数据'}</p>
                  </div>
                )}
              </div>
              
              {/* 底部操作栏 */}
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {selectedPriceIds.length > 0 
                    ? `已选择 ${selectedPriceIds.length} 项，合计 ${
                        supplierPrices
                          .filter(p => selectedPriceIds.includes(p.id))
                          .reduce((sum, p) => sum + (p.price || 0), 0)
                          .toLocaleString('de-DE', { minimumFractionDigits: 2 })
                      } EUR`
                    : '点击选择费用项，可多选'
                  }
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowSupplierPriceSelect(false)
                      setSelectedPriceIds([])
                      setSupplierPriceSearch('')
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleBatchAdd}
                    disabled={selectedPriceIds.length === 0 || submitting}
                    className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1.5 ${
                      selectedPriceIds.length > 0 
                        ? 'bg-orange-500 hover:bg-orange-600' 
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        添加中...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        添加 {selectedPriceIds.length > 0 ? `(${selectedPriceIds.length})` : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
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

