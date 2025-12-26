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

// 默认费用分类（API 加载前的备用）
const DEFAULT_FEE_CATEGORIES = [
  { value: 'other', label: '其他服务', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100' },
]

// 根据类别代码匹配图标和颜色
const getCategoryStyle = (code: string) => {
  const lowerCode = code?.toLowerCase() || ''
  if (lowerCode.includes('transport') || lowerCode.includes('运输')) {
    return { icon: Truck, color: 'text-blue-600', bg: 'bg-blue-100' }
  }
  if (lowerCode.includes('clearance') || lowerCode.includes('customs') || lowerCode.includes('清关') || lowerCode.includes('报关')) {
    return { icon: Receipt, color: 'text-red-600', bg: 'bg-red-100' }
  }
  if (lowerCode.includes('warehouse') || lowerCode.includes('仓储')) {
    return { icon: Building2, color: 'text-orange-600', bg: 'bg-orange-100' }
  }
  if (lowerCode.includes('tax') || lowerCode.includes('税')) {
    return { icon: Shield, color: 'text-green-600', bg: 'bg-green-100' }
  }
  if (lowerCode.includes('document') || lowerCode.includes('文件')) {
    return { icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-100' }
  }
  if (lowerCode.includes('thc') || lowerCode.includes('港杂')) {
    return { icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' }
  }
  if (lowerCode.includes('exchange') || lowerCode.includes('换单')) {
    return { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100' }
  }
  if (lowerCode.includes('agency') || lowerCode.includes('代理')) {
    return { icon: Building2, color: 'text-amber-600', bg: 'bg-amber-100' }
  }
  if (lowerCode.includes('management') || lowerCode.includes('管理')) {
    return { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-100' }
  }
  return { icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100' }
}

interface FeeCategory {
  value: string
  label: string
  icon: any
  color: string
  bg: string
}

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
  
  // 已选择的费用项列表（待提交）
  const [pendingFeeItems, setPendingFeeItems] = useState<Array<{
    id: string
    feeName: string
    feeNameEn?: string
    category: string
    amount: number
    currency: string
    source: FeeSourceType
    sourceId?: number
    routeInfo?: string  // 路线信息
  }>>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  
  // 费用分类（从基础数据加载）
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>(DEFAULT_FEE_CATEGORIES)
  
  // 供应商报价搜索和多选
  const [supplierPriceSearch, setSupplierPriceSearch] = useState('')
  const [selectedPriceIds, setSelectedPriceIds] = useState<number[]>([])
  
  // 产品库搜索和多选
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductFees, setSelectedProductFees] = useState<Array<{
    productId: string
    productName: string
    feeItem: ProductFeeItem
  }>>([])
  
  // 供应商搜索防抖
  const supplierSearchRef = useRef<NodeJS.Timeout | null>(null)

  // 加载订单列表、供应商列表和费用分类
  useEffect(() => {
    if (visible) {
      loadBills()
      loadSuppliers()
      loadProducts()
      loadFeeCategories()
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
      // 编辑时如果有供应商，自动加载其报价
      if (editingFee.supplierId) {
        loadSupplierPrices(editingFee.supplierId)
      }
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
      // 清空供应商报价
      setSupplierPrices([])
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

  // 加载费用分类（从基础数据服务费类别）
  const loadFeeCategories = async () => {
    try {
      // 正确路径：masterdata 路由直接挂载在 /api 下
      const response = await fetch(`${API_BASE}/api/service-fee-categories?status=active`)
      const data = await response.json()
      // 兼容两种返回格式：data.data.list 或 data.data（直接数组）
      const list = data.data?.list || (Array.isArray(data.data) ? data.data : [])
      if (data.errCode === 200 && list.length > 0) {
        const categories = list.map((item: any) => {
          const style = getCategoryStyle(item.code || item.name)
          return {
            value: item.code || item.name,
            label: item.name,
            ...style
          }
        })
        if (categories.length > 0) {
          setFeeCategories(categories)
        }
      }
    } catch (error) {
      console.error('加载费用分类失败:', error)
    }
  }

  const loadSupplierPrices = async (supplierId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/${supplierId}/prices?pageSize=100`)
      const data = await response.json()
      // 兼容两种返回格式：data.data.list 或 data.data（直接数组）
      const list = data.data?.list || (Array.isArray(data.data) ? data.data : [])
      if (data.errCode === 200 && list.length > 0) {
        setSupplierPrices(list)
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

  // 批量提交待提交费用列表
  const handleBatchSubmit = async () => {
    if (pendingFeeItems.length === 0) return
    
    // 检查是否选择了供应商（应付费用必须）
    if (formData.feeType === 'payable' && !formData.supplierId) {
      alert('请先选择供应商')
      return
    }
    
    setSubmitting(true)
    let successCount = 0
    let failCount = 0
    
    try {
      for (const item of pendingFeeItems) {
        try {
          const response = await fetch(`${API_BASE}/api/fees`, {
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
              category: item.category || 'other',
              feeName: item.feeName,
              amount: item.amount,
              currency: item.currency || 'EUR',
              feeDate: formData.feeDate,
              description: item.routeInfo || '',
              feeSource: 'supplier_price',
              needApproval: false
            })
          })
          const data = await response.json()
          if (data.errCode === 200) {
            successCount++
          } else {
            failCount++
          }
        } catch (err) {
          failCount++
        }
      }
      
      if (successCount > 0) {
        setPendingFeeItems([])
        onSuccess?.()
        onClose()
      }
      
      if (failCount > 0) {
        alert(`成功 ${successCount} 条，失败 ${failCount} 条`)
      }
    } catch (error) {
      console.error('批量提交失败:', error)
      alert('批量提交失败')
    } finally {
      setSubmitting(false)
    }
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

          {/* 费用分类 - 仅在手动录入且无批量费用时显示 */}
          {pendingFeeItems.length === 0 && (
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
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                {feeCategories.map(cat => {
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
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all ${
                        formData.category === cat.value
                          ? `${cat.bg} ${cat.color} border-current`
                          : !canSelect
                            ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{cat.label}</span>
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
          )}

          {/* 费用名称和金额 - 仅在无批量费用时显示 */}
          {pendingFeeItems.length === 0 && (
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
          )}

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

          {/* 待提交费用列表 */}
          {pendingFeeItems.length > 0 && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" />
                  待提交费用 ({pendingFeeItems.length} 项)
                </label>
                <button
                  type="button"
                  onClick={() => setPendingFeeItems([])}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  清空全部
                </button>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {pendingFeeItems.map((item, index) => {
                  // 获取当前分类的样式
                  const categoryStyle = getCategoryStyle(item.category)
                  const CategoryIcon = categoryStyle.icon
                  
                  return (
                    <div key={item.id} className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                      {/* 第一行：费用名称和删除按钮 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium text-sm text-gray-900 truncate">{item.feeName}</span>
                          {item.amount === 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-600 rounded flex-shrink-0">需填金额</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingFeeItems(prev => prev.filter((_, i) => i !== index))
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* 路线信息 */}
                      {item.routeInfo && (
                        <div className="text-xs text-gray-500 truncate mb-2">{item.routeInfo}</div>
                      )}
                      
                      {/* 第二行：分类选择、币种和金额 */}
                      <div className="flex items-center gap-2">
                        {/* 费用分类选择 */}
                        <div className="flex items-center gap-1 flex-1">
                          <CategoryIcon className={`w-3.5 h-3.5 flex-shrink-0 ${categoryStyle.color}`} />
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const newItems = [...pendingFeeItems]
                              newItems[index].category = e.target.value
                              setPendingFeeItems(newItems)
                            }}
                            className={`flex-1 px-1.5 py-1 text-xs border rounded ${categoryStyle.bg} ${categoryStyle.color} border-gray-200`}
                          >
                            {feeCategories.map(cat => (
                              <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* 币种选择 */}
                        <select
                          value={item.currency}
                          onChange={(e) => {
                            const newItems = [...pendingFeeItems]
                            newItems[index].currency = e.target.value
                            setPendingFeeItems(newItems)
                          }}
                          className="px-1.5 py-1 text-xs border border-gray-200 rounded bg-white"
                        >
                          <option value="EUR">EUR</option>
                          <option value="CNY">CNY</option>
                          <option value="USD">USD</option>
                        </select>
                        
                        {/* 金额输入 */}
                        <input
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => {
                            const newItems = [...pendingFeeItems]
                            newItems[index].amount = parseFloat(e.target.value) || 0
                            setPendingFeeItems(newItems)
                          }}
                          className={`w-20 px-2 py-1 text-xs border rounded text-right ${
                            item.amount === 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                          }`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  合计: <span className="font-medium text-gray-900">
                    {pendingFeeItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR
                  </span>
                </span>
                {pendingFeeItems.some(item => item.amount === 0) && (
                  <span className="text-amber-500">⚠️ 有费用项金额为0，请确认</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          {/* 左侧提示 */}
          <div className="flex-1">
            {pendingFeeItems.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-orange-600">
                <Package className="w-4 h-4" />
                <span>将批量创建 {pendingFeeItems.length} 条费用记录</span>
              </div>
            ) : isManualEntry && formData.feeName && !editingFee ? (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span>手动录入的费用项将提交审批</span>
              </div>
            ) : null}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPendingFeeItems([])
                onClose()
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            
            {/* 批量提交按钮（有待提交费用时显示） */}
            {pendingFeeItems.length > 0 ? (
              <button
                onClick={handleBatchSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    提交中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    批量提交 ({pendingFeeItems.length})
                  </>
                )}
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {/* 产品费用项选择弹窗 - 支持多选 */}
      {showProductSelect && (
        <ProductFeeSelectModal
          products={products}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          selectedProductFees={selectedProductFees}
          setSelectedProductFees={setSelectedProductFees}
          loadProductFeeItems={loadProductFeeItems}
          feeCategories={feeCategories}
          onClose={() => {
            setShowProductSelect(false)
            setProductSearch('')
            setSelectedProductFees([])
          }}
          onBatchAdd={(items) => {
            // 将选中的产品费用项添加到待提交列表
            const newItems = items.map(item => ({
              id: `pending-product-${item.feeItem.id}-${Date.now()}`,
              feeName: item.feeItem.feeName,
              feeNameEn: item.feeItem.feeNameEn,
              category: item.feeItem.feeCategory || 'other',
              amount: item.feeItem.standardPrice || 0,
              currency: item.feeItem.currency || 'EUR',
              source: 'product' as FeeSourceType,
              sourceId: item.feeItem.id,
              routeInfo: `产品: ${item.productName}`
            }))
            
            // 过滤掉已添加的
            const existingSourceIds = pendingFeeItems.filter(p => p.source === 'product').map(p => p.sourceId)
            const filteredNewItems = newItems.filter(item => !existingSourceIds.includes(item.sourceId))
            
            if (filteredNewItems.length === 0) {
              alert('所选费用项已添加')
              return
            }
            
            setPendingFeeItems(prev => [...prev, ...filteredNewItems])
            setSelectedProductFees([])
            setProductSearch('')
            setShowProductSelect(false)
          }}
        />
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
        
        // 批量添加选中的费用项到待提交列表
        const handleBatchAdd = () => {
          const selectedItems = supplierPrices.filter(p => selectedPriceIds.includes(p.id))
          if (selectedItems.length === 0) return
          
          // 将选中的费用项添加到待提交列表
          const newItems = selectedItems.map(item => ({
            id: `pending-${item.id}-${Date.now()}`,
            feeName: item.feeName,
            feeNameEn: item.feeNameEn,
            category: item.feeCategory || 'other',
            amount: item.price || 0,
            currency: item.currency || 'EUR',
            source: 'supplier_price' as FeeSourceType,
            sourceId: item.id,
            routeInfo: [
              item.routeFrom,
              item.city ? `${item.city}${item.routeTo ? ` (${item.routeTo})` : ''}` : item.routeTo,
              item.returnPoint ? `还柜:${item.returnPoint}` : ''
            ].filter(Boolean).join(' → ')
          }))
          
          // 过滤掉已添加的（根据 sourceId 判断）
          const existingSourceIds = pendingFeeItems.map(p => p.sourceId)
          const filteredNewItems = newItems.filter(item => !existingSourceIds.includes(item.sourceId))
          
          if (filteredNewItems.length === 0) {
            alert('所选费用项已添加')
            return
          }
          
          setPendingFeeItems(prev => [...prev, ...filteredNewItems])
          setSelectedPriceIds([])
          setSupplierPriceSearch('')
          setShowSupplierPriceSelect(false)
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

// 产品费用项多选弹窗组件
function ProductFeeSelectModal({
  products,
  productSearch,
  setProductSearch,
  selectedProductFees,
  setSelectedProductFees,
  loadProductFeeItems,
  feeCategories,
  onClose,
  onBatchAdd
}: {
  products: Product[]
  productSearch: string
  setProductSearch: (value: string) => void
  selectedProductFees: Array<{ productId: string; productName: string; feeItem: ProductFeeItem }>
  setSelectedProductFees: (value: Array<{ productId: string; productName: string; feeItem: ProductFeeItem }>) => void
  loadProductFeeItems: (productId: string) => Promise<ProductFeeItem[]>
  feeCategories: FeeCategory[]
  onClose: () => void
  onBatchAdd: (items: Array<{ productId: string; productName: string; feeItem: ProductFeeItem }>) => void
}) {
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null)
  const [productFeeItemsMap, setProductFeeItemsMap] = useState<Record<string, ProductFeeItem[]>>({})
  const [expandedProducts, setExpandedProducts] = useState<string[]>([])
  
  // 过滤产品
  const filteredProducts = products.filter(product => {
    if (!productSearch) return true
    const search = productSearch.toLowerCase()
    return (
      product.productName?.toLowerCase().includes(search) ||
      product.productCode?.toLowerCase().includes(search)
    )
  })
  
  // 加载产品费用项
  const handleLoadFeeItems = async (productId: string) => {
    if (productFeeItemsMap[productId]) {
      // 已加载，切换展开状态
      setExpandedProducts(prev => 
        prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
      )
      return
    }
    
    setLoadingProductId(productId)
    try {
      const items = await loadProductFeeItems(productId)
      setProductFeeItemsMap(prev => ({ ...prev, [productId]: items }))
      setExpandedProducts(prev => [...prev, productId])
    } finally {
      setLoadingProductId(null)
    }
  }
  
  // 切换费用项选择
  const toggleFeeItem = (productId: string, productName: string, feeItem: ProductFeeItem) => {
    const isSelected = selectedProductFees.some(
      f => f.productId === productId && f.feeItem.id === feeItem.id
    )
    
    if (isSelected) {
      setSelectedProductFees(selectedProductFees.filter(
        f => !(f.productId === productId && f.feeItem.id === feeItem.id)
      ))
    } else {
      setSelectedProductFees([...selectedProductFees, { productId, productName, feeItem }])
    }
  }
  
  // 全选某产品下的所有费用项
  const selectAllFromProduct = (productId: string, productName: string) => {
    const feeItems = productFeeItemsMap[productId] || []
    const currentSelectedIds = selectedProductFees
      .filter(f => f.productId === productId)
      .map(f => f.feeItem.id)
    
    if (currentSelectedIds.length === feeItems.length) {
      // 取消全选
      setSelectedProductFees(selectedProductFees.filter(f => f.productId !== productId))
    } else {
      // 全选
      const newSelections = feeItems
        .filter(item => !currentSelectedIds.includes(item.id))
        .map(item => ({ productId, productName, feeItem: item }))
      setSelectedProductFees([...selectedProductFees, ...newSelections])
    }
  }
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-green-600" />
            从产品库选择费用项
            {selectedProductFees.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-600 rounded-full text-xs">
                已选 {selectedProductFees.length} 项
              </span>
            )}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        {/* 搜索栏 */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="搜索产品名称或代码..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {productSearch && (
              <button
                onClick={() => setProductSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-1.5 text-xs text-gray-500">
            共 {filteredProducts.length} 个产品 {productSearch && `(搜索结果)`}
          </div>
        </div>
        
        {/* 产品列表 */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-180px)]">
          {filteredProducts.length > 0 ? (
            <div className="space-y-2">
              {filteredProducts.map(product => {
                const isExpanded = expandedProducts.includes(product.id)
                const isLoading = loadingProductId === product.id
                const feeItems = productFeeItemsMap[product.id] || []
                const selectedCount = selectedProductFees.filter(f => f.productId === product.id).length
                
                return (
                  <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* 产品标题 */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => handleLoadFeeItems(product.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-sm text-gray-900">{product.productName}</span>
                        <span className="text-xs text-gray-400">{product.productCode}</span>
                        {selectedCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                            已选 {selectedCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isLoading && (
                          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                        <span className="text-gray-400 text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                    </div>
                    
                    {/* 费用项列表 */}
                    {isExpanded && (
                      <div className="p-2 border-t border-gray-100">
                        {feeItems.length > 0 ? (
                          <>
                            {/* 全选按钮 */}
                            <div className="flex items-center justify-between px-2 py-1 mb-2">
                              <span className="text-xs text-gray-500">共 {feeItems.length} 个费用项</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  selectAllFromProduct(product.id, product.productName)
                                }}
                                className="text-xs text-green-600 hover:text-green-700"
                              >
                                {selectedCount === feeItems.length ? '取消全选' : '全选'}
                              </button>
                            </div>
                            
                            {/* 费用项 */}
                            <div className="space-y-1">
                              {feeItems.map(item => {
                                const isSelected = selectedProductFees.some(
                                  f => f.productId === product.id && f.feeItem.id === item.id
                                )
                                
                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-start gap-3 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'border-green-400 bg-green-50'
                                        : 'border-gray-100 hover:border-green-300 hover:bg-green-50/50'
                                    }`}
                                    onClick={() => toggleFeeItem(product.id, product.productName, item)}
                                  >
                                    {/* 复选框 */}
                                    <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center ${
                                      isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                    }`}>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    
                                    {/* 内容 */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm text-gray-900">{item.feeName}</span>
                                        <span className="text-sm font-medium text-green-600">
                                          {item.currency} {item.standardPrice?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      {item.feeNameEn && (
                                        <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                                      )}
                                      {item.feeCategory && (
                                        <div className="mt-1 text-xs text-blue-600">
                                          分类: {feeCategories.find(c => c.value === item.feeCategory)?.label || item.feeCategory}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4 text-xs text-gray-400">暂无费用项</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">{productSearch ? '未找到匹配的产品' : '暂无产品数据'}</p>
            </div>
          )}
        </div>
        
        {/* 底部操作栏 */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {selectedProductFees.length > 0 
              ? `已选择 ${selectedProductFees.length} 项，合计 ${
                  selectedProductFees
                    .reduce((sum, f) => sum + (f.feeItem.standardPrice || 0), 0)
                    .toLocaleString('de-DE', { minimumFractionDigits: 2 })
                } EUR`
              : '点击展开产品，选择费用项，可多选'
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={() => onBatchAdd(selectedProductFees)}
              disabled={selectedProductFees.length === 0}
              className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1.5 ${
                selectedProductFees.length > 0
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              添加 {selectedProductFees.length > 0 ? `(${selectedProductFees.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

