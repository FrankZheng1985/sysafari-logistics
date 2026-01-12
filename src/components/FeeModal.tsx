import { useState, useEffect, useRef } from 'react'
import { X, Receipt, Truck, Building2, Shield, Package, FileText, Settings, ArrowDownCircle, ArrowUpCircle, Plus, Check, Search, AlertCircle, Edit3, ChevronRight, ChevronDown } from 'lucide-react'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import DatePicker from './DatePicker'

const API_BASE = getApiBaseUrl()

// 费用来源类型
type FeeSourceType = 'product' | 'supplier_price' | 'quotation' | 'manual'

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
  // 预填货物信息（用于按KG/CBM自动计算费用）
  defaultWeight?: number
  defaultVolume?: number
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
  unit: string          // 计费单位: KG=按公斤, CBM=按体积, 票=按票, 柜=按柜
  standardPrice: number // 单价
  currency: string
  // 路线信息（从关联的供应商报价获取）
  routeFrom?: string    // 起运地
  routeTo?: string      // 目的地邮编
  returnPoint?: string  // 还柜点
  city?: string         // 城市
  country?: string      // 国家
  transportMode?: string // 运输方式
}

interface SupplierPriceItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string          // 计费单位: KG=按公斤, CBM=按体积, 票=按票, 柜=按柜
  price: number         // 单价
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
  weight: number  // 货物重量（KG）
  volume: number  // 货物体积（CBM）
}

// 报价单费用项
interface QuotationFeeItem {
  id: string
  name: string
  nameEn?: string
  description?: string
  quantity: number
  unit: string
  price: number
  amount: number
  feeCategory: string
}

// 客户已确认的报价单
interface CustomerQuotation {
  id: string
  quoteNumber: string
  customerName: string
  subject: string
  quoteDate: string
  validUntil?: string
  totalAmount: number
  currency: string
  status: string
  createdByName?: string
  items: QuotationFeeItem[]
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
  parentId?: string | null
  level?: number
}

// 分组后的费用分类（按一级分类分组）
interface FeeCategoryGroup {
  parent: FeeCategory
  children: FeeCategory[]
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
    description: '自定义费用项'
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
  defaultWeight,
  defaultVolume,
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
    description: '',
    // 订单货物信息（用于自动计算费用）
    weight: 0,   // 货物重量（KG）
    volume: 0,   // 货物体积（CBM）
    // 当前选择的计费单位
    currentUnit: '' as string,
    // 单价（用于显示和固定金额计算）
    unitPrice: 0,
    // 是否使用固定金额（而非按重量/体积自动计算）
    useFixedAmount: false
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
  // 分组后的费用分类
  const [feeCategoryGroups, setFeeCategoryGroups] = useState<FeeCategoryGroup[]>([])
  
  // 手动录入时的多选费用分类状态
  const [selectedManualCategories, setSelectedManualCategories] = useState<Array<{
    id: string
    value: string
    label: string
    feeName: string
    amount: string
    currency: string
    description: string
  }>>([])
  
  // 费用分类分组展开/收起状态（存储展开的分组value）- 默认收起
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Set<string>>(new Set())
  
  // 费用分类自动收起定时器（展开后15秒自动收起）
  const categoryCollapseTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
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
  
  // 报价单相关状态
  const [customerQuotations, setCustomerQuotations] = useState<CustomerQuotation[]>([])
  const [showQuotationSelect, setShowQuotationSelect] = useState(false)
  const [quotationSearch, setQuotationSearch] = useState('')
  const [selectedQuotationFees, setSelectedQuotationFees] = useState<Array<{
    quotationId: string
    quoteNumber: string
    feeItem: QuotationFeeItem
  }>>([])
  const [loadingQuotations, setLoadingQuotations] = useState(false)
  
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
  
  // 清理费用分类自动收起的定时器
  useEffect(() => {
    return () => {
      // 组件卸载或弹窗关闭时清除所有定时器
      categoryCollapseTimersRef.current.forEach(timer => clearTimeout(timer))
      categoryCollapseTimersRef.current.clear()
    }
  }, [])
  
  // 弹窗关闭时重置展开状态和清除定时器
  useEffect(() => {
    if (!visible) {
      setExpandedCategoryGroups(new Set())
      categoryCollapseTimersRef.current.forEach(timer => clearTimeout(timer))
      categoryCollapseTimersRef.current.clear()
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
        description: '',
        weight: defaultWeight || 0,   // 使用传入的重量数据
        volume: defaultVolume || 0,   // 使用传入的体积数据
        currentUnit: '',
        unitPrice: 0,
        useFixedAmount: false
      })
      // 清空供应商报价
      setSupplierPrices([])
    }
    // 清空多选费用分类状态
    setSelectedManualCategories([])
    setErrors({})
  }, [editingFee, visible, defaultBillId, defaultBillNumber, defaultCustomerId, defaultCustomerName, defaultWeight, defaultVolume, defaultFeeType])

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
          customerId: b.customerId || '',
          weight: Number(b.weight) || 0,  // 货物重量（KG）
          volume: Number(b.volume) || 0   // 货物体积（CBM）
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
    setFormData(prev => {
      // 如果已有费用项且是按重量/体积计费，自动重新计算金额
      const newFormData = {
        ...prev,
        billId: bill.id,
        billNumber: bill.billNumber,
        customerId: bill.customerId,
        customerName: bill.customerName,
        weight: bill.weight || 0,
        volume: bill.volume || 0
      }
      
      // 如果当前费用项是按KG或CBM计费，自动重新计算金额
      if (prev.currentUnit && prev.amount) {
        const unitPrice = parseFloat(prev.amount) / (prev.weight || 1) // 还原单价
        if (prev.currentUnit.toUpperCase() === 'KG' && bill.weight > 0) {
          // 按重量计费
          newFormData.amount = (unitPrice * bill.weight).toFixed(2)
        } else if (prev.currentUnit.toUpperCase() === 'CBM' && bill.volume > 0) {
          // 按体积计费
          newFormData.amount = (unitPrice * bill.volume).toFixed(2)
        }
      }
      
      return newFormData
    })
    setShowBillDropdown(false)
    setBillSearch('')
    
    // 加载该客户的已确认报价单（用于应收费用选择）
    if (bill.customerId) {
      loadCustomerQuotations(bill.customerId)
    }
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

  // 加载客户已确认的报价单
  const loadCustomerQuotations = async (customerId: string) => {
    if (!customerId) {
      setCustomerQuotations([])
      return
    }
    
    setLoadingQuotations(true)
    try {
      const response = await fetch(`${API_BASE}/api/crm/customers/${customerId}/confirmed-quotations`)
      const data = await response.json()
      if (data.errCode === 200 && Array.isArray(data.data)) {
        setCustomerQuotations(data.data)
      } else {
        setCustomerQuotations([])
      }
    } catch (error) {
      console.error('加载客户报价单失败:', error)
      setCustomerQuotations([])
    } finally {
      setLoadingQuotations(false)
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
        // 建立 ID -> 原始数据 的映射
        const idMap: Record<string, any> = {}
        list.forEach((item: any) => {
          idMap[String(item.id)] = item
        })
        
        // 转换为 FeeCategory 格式，保留原始 id
        const categories: (FeeCategory & { id: string })[] = list.map((item: any) => {
          const style = getCategoryStyle(item.code || item.name)
          return {
            id: String(item.id),
            value: item.code || item.name,
            label: item.name,
            parentId: item.parentId ? String(item.parentId) : null,
            level: item.level || 1,
            ...style
          }
        })
        
        // 分离一级分类和二级分类
        const parentCategories = categories.filter(c => !c.parentId || c.level === 1)
        const childCategories = categories.filter(c => c.parentId && c.level === 2)
        
        // 构建分组结构
        const groups: FeeCategoryGroup[] = parentCategories.map(parent => {
          // 找到该父级下的所有子分类
          const children = childCategories.filter(child => child.parentId === parent.id)
          return { parent, children }
        }).filter(group => group.children.length > 0) // 只保留有子分类的组
        
        if (categories.length > 0) {
          setFeeCategories(categories)
        }
        if (groups.length > 0) {
          setFeeCategoryGroups(groups)
          // 默认收起所有分组（不设置任何展开项）
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

  // 计算按单位计费的金额
  const calculateAmountByUnit = (unitPrice: number, unit: string, weight: number, volume: number): number => {
    const upperUnit = (unit || '').toUpperCase()
    if (upperUnit === 'KG' && weight > 0) {
      // 按公斤计费
      return unitPrice * weight
    } else if (upperUnit === 'CBM' && volume > 0) {
      // 按体积计费
      return unitPrice * volume
    }
    // 其他单位（票、柜等）直接返回单价
    return unitPrice
  }
  
  // 判断是否为按量计费的单位
  const isQuantityBasedUnit = (unit: string): boolean => {
    const upperUnit = (unit || '').toUpperCase()
    return upperUnit === 'KG' || upperUnit === 'CBM'
  }

  const handleSelectProductFee = async (productId: string, feeItem: ProductFeeItem) => {
    setFormData(prev => {
      // 如果是编辑模式或用户已有金额，则保留原金额
      const currentAmount = prev.amount
      const hasExistingAmount = currentAmount && parseFloat(currentAmount) > 0
      const shouldPreserveAmount = editingFee || hasExistingAmount
      
      // 计算金额：如果是按KG或CBM计费，且有关联订单的重量/体积，自动计算
      const unitPrice = feeItem.standardPrice || 0
      let calculatedAmount = unitPrice
      const unit = feeItem.unit || ''
      
      if (!shouldPreserveAmount && isQuantityBasedUnit(unit)) {
        calculatedAmount = calculateAmountByUnit(unitPrice, unit, prev.weight, prev.volume)
      }
      
      return {
        ...prev,
        category: feeItem.feeCategory || 'other',
        feeName: feeItem.feeName,
        // 保留原有金额或使用计算后的金额
        amount: shouldPreserveAmount ? currentAmount : String(calculatedAmount),
        currency: feeItem.currency || 'EUR',
        currentUnit: unit,  // 记录当前计费单位
        unitPrice: unitPrice,  // 保存单价
        useFixedAmount: false  // 默认使用自动计算
      }
    })
    // 标记为从产品库选择，不需要审批
    setFeeSource('product')
    setIsManualEntry(false)
    setShowProductSelect(false)
  }

  const handleSelectSupplierPrice = (priceItem: SupplierPriceItem) => {
    setFormData(prev => {
      // 如果是编辑模式或用户已有金额，则保留原金额
      const currentAmount = prev.amount
      const hasExistingAmount = currentAmount && parseFloat(currentAmount) > 0
      const shouldPreserveAmount = editingFee || hasExistingAmount
      
      // 计算金额：如果是按KG或CBM计费，且有关联订单的重量/体积，自动计算
      const unitPrice = priceItem.price || 0
      let calculatedAmount = unitPrice
      const unit = priceItem.unit || ''
      
      if (!shouldPreserveAmount && isQuantityBasedUnit(unit)) {
        calculatedAmount = calculateAmountByUnit(unitPrice, unit, prev.weight, prev.volume)
      }
      
      return {
        ...prev,
        category: priceItem.feeCategory || 'other',
        feeName: priceItem.feeName,
        // 保留原有金额或使用计算后的金额
        amount: shouldPreserveAmount ? currentAmount : String(calculatedAmount),
        currency: priceItem.currency || 'EUR',
        currentUnit: unit,  // 记录当前计费单位
        unitPrice: unitPrice,  // 保存单价
        useFixedAmount: false  // 默认使用自动计算
      }
    })
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
    
    if (!formData.amount || parseFloat(formData.amount) === 0) {
      newErrors.amount = '请输入有效金额（可为负数）'
    }
    
    if (!formData.feeDate) {
      newErrors.feeDate = '请选择费用日期'
    }
    
    // 应付费用需要选择供应商
    if (formData.feeType === 'payable' && !formData.supplierId) {
      newErrors.supplier = '请选择供应商'
    }
    
    setErrors(newErrors)
    
    // 如果有验证错误，显示提示
    if (Object.keys(newErrors).length > 0) {
      const errorMessages = Object.values(newErrors).join('\n')
      alert(errorMessages)
      return false
    }
    
    return true
  }

  // 批量提交待提交费用列表
  const handleBatchSubmit = async () => {
    if (pendingFeeItems.length === 0) return
    
    // 检查必填项：应付费用必须选择供应商，应收费用必须选择客户
    if (formData.feeType === 'payable' && !formData.supplierId) {
      alert('请先选择供应商')
      return
    }
    if (formData.feeType === 'receivable' && !formData.customerId) {
      alert('请先选择客户')
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
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              billId: formData.billId || null,
              billNumber: formData.billNumber || '',
              // 根据费用类型传递正确的客户/供应商信息
              customerId: formData.feeType === 'receivable' ? (formData.customerId || null) : null,
              customerName: formData.feeType === 'receivable' ? (formData.customerName || '') : '',
              supplierId: formData.feeType === 'payable' ? (formData.supplierId || null) : null,
              supplierName: formData.feeType === 'payable' ? (formData.supplierName || '') : '',
              feeType: formData.feeType,  // 使用用户选择的费用类型
              category: item.category || 'other',
              feeName: item.feeName,
              amount: item.amount,
              currency: item.currency || 'EUR',
              feeDate: formData.feeDate,
              description: item.routeInfo || '',
              feeSource: formData.feeType === 'receivable' ? 'product' : 'supplier_price',
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
    // 多选费用分类时的批量提交
    if (isManualEntry && selectedManualCategories.length > 1) {
      // 验证多选费用项
      const invalidItems = selectedManualCategories.filter(item => !item.feeName || !item.amount || parseFloat(item.amount) === 0)
      if (invalidItems.length > 0) {
        alert(`请填写完整所有费用项的名称和金额`)
        return
      }
      
      // 检查必填项：应付费用必须选择供应商，应收费用必须选择客户
      if (formData.feeType === 'payable' && !formData.supplierId) {
        alert('请先选择供应商')
        return
      }
      if (formData.feeType === 'receivable' && !formData.customerId) {
        alert('请先选择客户')
        return
      }
      
      setSubmitting(true)
      let successCount = 0
      let failCount = 0
      
      try {
        for (const item of selectedManualCategories) {
          try {
            const description = item.description || ''
            const response = await fetch(`${API_BASE}/api/fees`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({
                billId: formData.billId || null,
                billNumber: formData.billNumber || '',
                customerId: formData.feeType === 'receivable' ? (formData.customerId || null) : null,
                customerName: formData.feeType === 'receivable' ? (formData.customerName || '') : '',
                supplierId: formData.feeType === 'payable' ? (formData.supplierId || null) : null,
                supplierName: formData.feeType === 'payable' ? (formData.supplierName || '') : '',
                feeType: formData.feeType,
                category: item.value,
                feeName: item.feeName,
                amount: parseFloat(item.amount),
                currency: item.currency,
                feeDate: formData.feeDate,
                description: description,
                feeSource: 'manual',
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
          setSelectedManualCategories([])
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
      return
    }
    
    if (!validateForm()) return
    
    setSubmitting(true)
    try {
      // 修复：使用 editingFee 对象存在性判断是更新还是创建
      // 与系统中其他页面保持一致的判断方式
      const isEditing = Boolean(editingFee && editingFee.id)
      const url = isEditing ? `${API_BASE}/api/fees/${editingFee!.id}` : `${API_BASE}/api/fees`
      const method = isEditing ? 'PUT' : 'POST'
      
      // 调试日志：帮助排查编辑变新增问题
      console.log('[FeeModal] 提交模式:', isEditing ? '编辑(PUT)' : '新增(POST)', {
        editingFee: editingFee,
        editingFeeId: editingFee?.id,
        url,
        method
      })
      
      // 构建描述信息
      const description = formData.description || ''
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
          // 标记费用来源
          feeSource: feeSource,
          needApproval: false
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        // 清空多选状态
        setSelectedManualCategories([])
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
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" title="关闭">
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
              {defaultBillId ? '关联订单' : '关联订单（可选）'}
            </label>
            
            {/* 如果传入了默认订单ID，显示为只读模式 */}
            {defaultBillId ? (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary-600" />
                  <span className="font-medium text-sm text-gray-900">{formData.billNumber}</span>
                </div>
                {formData.customerName && (
                  <div className="mt-1 text-xs text-gray-500">
                    客户：{formData.customerName}
                  </div>
                )}
              </div>
            ) : (
              /* 没有传入默认订单时，显示可选择的搜索框 */
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
                    title="清除选择"
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
            )}
            
            {/* 非只读模式下显示客户信息 */}
            {!defaultBillId && formData.feeType === 'receivable' && formData.customerName && (
              <div className="mt-1 text-xs text-gray-500">
                客户：{formData.customerName}
              </div>
            )}
            {/* 显示订单货物信息（重量/体积） */}
            {formData.billId && (formData.weight > 0 || formData.volume > 0) && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-blue-600 font-medium">📦 货物信息：</span>
                  {formData.weight > 0 && (
                    <span className="text-gray-700">
                      重量 <span className="font-medium text-blue-700">{formData.weight.toLocaleString('de-DE')} KG</span>
                    </span>
                  )}
                  {formData.volume > 0 && (
                    <span className="text-gray-700">
                      体积 <span className="font-medium text-blue-700">{formData.volume.toLocaleString('de-DE', { minimumFractionDigits: 2 })} CBM</span>
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-blue-500">
                  💡 选择按KG/CBM计费的费用项时，系统将自动计算金额
                </div>
              </div>
            )}
            {/* 订单没有重量/体积数据时的提示 */}
            {formData.billId && formData.weight === 0 && formData.volume === 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <span>⚠️</span>
                  <span>该订单未录入重量/体积数据，按KG/CBM计费的费用项无法自动计算，请手动输入金额或先完善订单信息</span>
                </div>
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
                      title="清除供应商"
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
            
            {/* 应收费用：产品库 + 报价单 + 手动录入 */}
            {formData.feeType === 'receivable' && (
              <div className="grid grid-cols-3 gap-2 mb-3">
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
                
                {/* 报价单选项 */}
                <button
                  type="button"
                  onClick={() => {
                    if (formData.customerId) {
                      setFeeSource('quotation')
                      setIsManualEntry(false)
                      setShowQuotationSelect(true)
                    }
                  }}
                  disabled={!formData.customerId}
                  className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    feeSource === 'quotation'
                      ? 'bg-purple-50 text-purple-600 border-purple-500 ring-1 ring-purple-500'
                      : !formData.customerId
                        ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                        : 'border-gray-200 text-gray-600 hover:bg-purple-50'
                  }`}
                >
                  {formData.customerId && customerQuotations.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                  )}
                  <FileText className="w-4 h-4" />
                  <span className="font-medium text-xs">报价单</span>
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
              {formData.feeType === 'receivable' && feeSource === 'quotation' && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-purple-500" />
                  {formData.customerId 
                    ? customerQuotations.length > 0 
                      ? `该客户有 ${customerQuotations.length} 份已确认报价单可选`
                      : loadingQuotations 
                        ? '正在加载报价单...'
                        : '该客户暂无已确认报价单'
                    : '请先选择关联订单'
                  }
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
                <span className="flex items-center gap-1 text-blue-600">
                  手动录入自定义费用项
                </span>
              )}
            </div>
            
            {/* 快捷选择按钮 */}
            <div className="flex flex-wrap gap-2">
              {formData.feeType === 'receivable' && (
                <>
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
                  {formData.customerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setFeeSource('quotation')
                        setShowQuotationSelect(true)
                      }}
                      className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${
                        customerQuotations.length > 0
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      从报价单选择 {customerQuotations.length > 0 ? `(${customerQuotations.length})` : '(暂无)'}
                    </button>
                  )}
                </>
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
                  <span className="ml-2 text-green-600 text-xs font-normal flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                    已从{feeSource === 'product' ? '产品库' : '供应商报价'}绑定，不可修改
                  </span>
                )}
                {isManualEntry && (
                  <span className="ml-2 text-amber-500 text-xs font-normal">
                    (手动录入可选择分类)
                  </span>
                )}
                {!isManualEntry && !formData.feeName && (
                  <span className="ml-2 text-gray-400 text-xs font-normal">
                    (请先选择费用来源或切换到手动录入)
                  </span>
                )}
              </label>
              
              {/* 非手动录入且有费用名称时，只读显示分类 */}
              {!isManualEntry && formData.feeName && formData.category ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  {(() => {
                    const selectedCat = feeCategories.find(c => c.value === formData.category) || {
                      icon: Settings,
                      label: formData.category,
                      color: 'text-gray-600',
                      bg: 'bg-gray-100'
                    }
                    const Icon = selectedCat.icon
                    return (
                      <>
                        <div className={`p-1.5 rounded-lg ${selectedCat.bg}`}>
                          <Icon className={`w-4 h-4 ${selectedCat.color}`} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{selectedCat.label}</div>
                          <div className="text-xs text-gray-500">分类已锁定，如需修改请到报价管理维护</div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : (
                /* 手动录入或未选择费用时，显示分类选择（按父子级分组，支持多选） */
                <div className="max-h-[320px] overflow-y-auto">
                  {feeCategoryGroups.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {feeCategoryGroups.map(group => {
                        const isExpanded = expandedCategoryGroups.has(group.parent.value)
                        const selectedCount = group.children.filter(cat => 
                          selectedManualCategories.some(s => s.value === cat.value)
                        ).length
                        
                        return (
                          <div key={group.parent.value} className={`${isExpanded ? 'col-span-3' : ''}`}>
                            {/* 一级分类标题 - 可点击展开/收起 */}
                            <button
                              type="button"
                              onClick={() => {
                                const groupValue = group.parent.value
                                
                                setExpandedCategoryGroups(prev => {
                                  const newSet = new Set(prev)
                                  if (newSet.has(groupValue)) {
                                    // 收起时清除该分组的定时器
                                    const existingTimer = categoryCollapseTimersRef.current.get(groupValue)
                                    if (existingTimer) {
                                      clearTimeout(existingTimer)
                                      categoryCollapseTimersRef.current.delete(groupValue)
                                    }
                                    newSet.delete(groupValue)
                                  } else {
                                    // 展开时设置15秒后自动收起
                                    newSet.add(groupValue)
                                    
                                    // 清除之前的定时器（如果有）
                                    const existingTimer = categoryCollapseTimersRef.current.get(groupValue)
                                    if (existingTimer) {
                                      clearTimeout(existingTimer)
                                    }
                                    
                                    // 设置新的15秒定时器
                                    const timer = setTimeout(() => {
                                      setExpandedCategoryGroups(prevSet => {
                                        const updatedSet = new Set(prevSet)
                                        updatedSet.delete(groupValue)
                                        return updatedSet
                                      })
                                      categoryCollapseTimersRef.current.delete(groupValue)
                                    }, 15000) // 15秒后自动收起
                                    
                                    categoryCollapseTimersRef.current.set(groupValue, timer)
                                  }
                                  return newSet
                                })
                              }}
                              className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors ${group.parent.color}`}
                            >
                              <div className="flex items-center gap-1">
                                {isExpanded ? (
                                  <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                )}
                                {(() => {
                                  const Icon = group.parent.icon
                                  return <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                })()}
                                <span className="truncate">{group.parent.label}</span>
                                <span className="text-gray-400 font-normal flex-shrink-0">({group.children.length})</span>
                              </div>
                              {selectedCount > 0 && (
                                <span className="px-1 py-0.5 bg-primary-100 text-primary-700 rounded text-[10px] flex-shrink-0">
                                  已选 {selectedCount}
                                </span>
                              )}
                            </button>
                            {/* 二级分类按钮 - 支持多选，展开时显示 */}
                            {isExpanded && (
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mt-1.5 pl-4 pb-2 border-b border-gray-100">
                                {group.children.map(cat => {
                                  const canSelect = isManualEntry
                                  const isSelected = selectedManualCategories.some(s => s.value === cat.value)
                                  return (
                                    <button
                                      key={cat.value}
                                      type="button"
                                      onClick={() => {
                                        if (canSelect) {
                                          if (isSelected) {
                                            // 取消选择
                                            setSelectedManualCategories(prev => prev.filter(s => s.value !== cat.value))
                                          } else {
                                            // 添加选择，费用名称自动填写为分类名称
                                            setSelectedManualCategories(prev => [...prev, {
                                              id: `manual-${cat.value}-${Date.now()}`,
                                              value: cat.value,
                                              label: cat.label,
                                              feeName: cat.label,  // 自动填写费用名称
                                              amount: '',
                                              currency: 'EUR',
                                              description: ''
                                            }])
                                          }
                                          // 同时更新单选状态（兼容）
                                          setFormData(prev => ({ 
                                            ...prev, 
                                            category: cat.value,
                                            feeName: cat.label  // 自动填写费用名称
                                          }))
                                        }
                                      }}
                                      disabled={!canSelect}
                                      className={`flex items-center justify-center px-2 py-1.5 rounded border text-xs transition-all truncate ${
                                        isSelected
                                          ? `${cat.bg} ${cat.color} border-current font-medium ring-2 ring-offset-1 ring-current`
                                          : !canSelect
                                            ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                      }`}
                                      title={`${cat.label}${isSelected ? ' (已选择)' : ''}`}
                                    >
                                      {isSelected && <Check className="w-3 h-3 mr-1 flex-shrink-0" />}
                                      {cat.label}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* 兜底：如果没有分组数据，显示平铺列表 */
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {feeCategories.filter(c => c.level === 2 || !c.parentId).map(cat => {
                        const Icon = cat.icon
                        const canSelect = isManualEntry
                        const isSelected = selectedManualCategories.some(s => s.value === cat.value)
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              if (canSelect) {
                                if (isSelected) {
                                  setSelectedManualCategories(prev => prev.filter(s => s.value !== cat.value))
                                } else {
                                  setSelectedManualCategories(prev => [...prev, {
                                    id: `manual-${cat.value}-${Date.now()}`,
                                    value: cat.value,
                                    label: cat.label,
                                    feeName: cat.label,
                                    amount: '',
                                    currency: 'EUR',
                                    description: ''
                                  }])
                                }
                                setFormData(prev => ({ 
                                  ...prev, 
                                  category: cat.value,
                                  feeName: cat.label
                                }))
                              }
                            }}
                            disabled={!canSelect}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all ${
                              isSelected
                                ? `${cat.bg} ${cat.color} border-current ring-2 ring-offset-1 ring-current`
                                : !canSelect
                                  ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{cat.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {!isManualEntry && !formData.feeName && (
                <p className="mt-1.5 text-xs text-gray-400">
                  💡 费用分类会根据选择的费用项自动绑定，或选择"手动录入"自定义
                </p>
              )}
            </div>
          )}

          {/* 费用名称和金额 - 仅在无批量费用时显示 */}
          {pendingFeeItems.length === 0 && (
            <>
              {/* 多选费用分类时显示多个输入框 */}
              {isManualEntry && selectedManualCategories.length > 1 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-700">
                      已选择 <span className="text-primary-600 font-bold">{selectedManualCategories.length}</span> 项费用
                      <span className="ml-2 text-blue-500 text-xs font-normal">(手动录入)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedManualCategories([])}
                      className="text-xs text-gray-500 hover:text-red-500"
                    >
                      清空全部
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {selectedManualCategories.map((item, index) => {
                      const catStyle = getCategoryStyle(item.value)
                      return (
                        <div key={item.id} className={`p-3 rounded-lg border ${catStyle.bg} border-gray-200`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${catStyle.color}`}>
                                {index + 1}. {item.label}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedManualCategories(prev => prev.filter(s => s.id !== item.id))}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                              title="移除"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-12 gap-2">
                            {/* 费用名称 */}
                            <div className="col-span-5">
                              <input
                                type="text"
                                value={item.feeName}
                                onChange={(e) => {
                                  setSelectedManualCategories(prev => prev.map(s => 
                                    s.id === item.id ? { ...s, feeName: e.target.value } : s
                                  ))
                                }}
                                placeholder="费用名称"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            
                            {/* 币种 */}
                            <div className="col-span-2">
                              <select
                                value={item.currency}
                                onChange={(e) => {
                                  setSelectedManualCategories(prev => prev.map(s => 
                                    s.id === item.id ? { ...s, currency: e.target.value } : s
                                  ))
                                }}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                                title="选择币种"
                              >
                                <option value="EUR">EUR</option>
                                <option value="CNY">CNY</option>
                                <option value="USD">USD</option>
                              </select>
                            </div>
                            
                            {/* 金额 */}
                            <div className="col-span-3">
                              <input
                                type="number"
                                step="0.01"
                                value={item.amount}
                                onChange={(e) => {
                                  setSelectedManualCategories(prev => prev.map(s => 
                                    s.id === item.id ? { ...s, amount: e.target.value } : s
                                  ))
                                }}
                                placeholder="0.00"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                            
                            {/* 说明（可选） */}
                            <div className="col-span-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => {
                                  setSelectedManualCategories(prev => prev.map(s => 
                                    s.id === item.id ? { ...s, description: e.target.value } : s
                                  ))
                                }}
                                placeholder="备注"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* 单选或未选择时显示原有的单个输入框 */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      费用名称 <span className="text-red-500">*</span>
                      {isManualEntry && formData.feeName && (
                        <span className="ml-2 text-blue-500 text-xs font-normal">
                          (手动录入)
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
                        placeholder="请输入费用名称"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors.feeName ? 'border-red-500' : 'border-gray-300'
                        } ${isManualEntry && formData.feeName ? 'border-blue-300 bg-blue-50' : ''}`}
                      />
                    </div>
                    {errors.feeName && <p className="mt-1 text-xs text-red-500">{errors.feeName}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      金额 <span className="text-red-500">*</span>
                    </label>
                    
                    {/* 当选择了费用项时，显示计费方式选择 */}
                    {formData.feeName && (
                      <div className="mb-2 flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-600">计费方式：</span>
                        {/* 按量计费（KG/CBM）显示自动计算选项 */}
                        {formData.currentUnit && isQuantityBasedUnit(formData.currentUnit) && (
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="amountType"
                              checked={!formData.useFixedAmount}
                              onChange={() => {
                                // 切换为自动计算，重新计算金额
                                const weight = formData.weight || 0
                                const volume = formData.volume || 0
                                const unitPrice = formData.unitPrice || 0
                                let calculatedAmount = unitPrice
                                if (formData.currentUnit.toUpperCase() === 'KG' && weight > 0) {
                                  calculatedAmount = unitPrice * weight
                                } else if (formData.currentUnit.toUpperCase() === 'CBM' && volume > 0) {
                                  calculatedAmount = unitPrice * volume
                                }
                                setFormData(prev => ({ 
                                  ...prev, 
                                  useFixedAmount: false,
                                  amount: calculatedAmount > 0 ? calculatedAmount.toFixed(2) : prev.amount
                                }))
                              }}
                              className="mr-1"
                            />
                            <span className={`text-xs ${!formData.useFixedAmount ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                              按{formData.currentUnit.toUpperCase()}自动计算
                            </span>
                          </label>
                        )}
                        {/* 非按量计费时显示标准价格选项 */}
                        {(!formData.currentUnit || !isQuantityBasedUnit(formData.currentUnit)) && (
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="amountType"
                              checked={!formData.useFixedAmount}
                              onChange={() => {
                                // 切换为标准价格
                                const unitPrice = formData.unitPrice || 0
                                setFormData(prev => ({ 
                                  ...prev, 
                                  useFixedAmount: false,
                                  amount: unitPrice > 0 ? unitPrice.toFixed(2) : prev.amount
                                }))
                              }}
                              className="mr-1"
                            />
                            <span className={`text-xs ${!formData.useFixedAmount ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                              标准价格
                            </span>
                          </label>
                        )}
                        {/* 固定金额选项始终显示 */}
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="amountType"
                            checked={formData.useFixedAmount}
                            onChange={() => setFormData(prev => ({ ...prev, useFixedAmount: true }))}
                            className="mr-1"
                          />
                          <span className={`text-xs ${formData.useFixedAmount ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                            固定金额
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                        title="选择币种"
                      >
                        <option value="EUR">EUR</option>
                        <option value="CNY">CNY</option>
                        <option value="USD">USD</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value, useFixedAmount: true }))}
                        placeholder="0.00"
                        className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors.amount ? 'border-red-500' : 'border-gray-300'
                        } ${formData.currentUnit && isQuantityBasedUnit(formData.currentUnit) && !formData.useFixedAmount ? 'bg-green-50 border-green-300' : ''}`}
                      />
                    </div>
                    
                    {/* 显示计算说明 */}
                    {formData.feeName && !formData.useFixedAmount && (
                      <p className="mt-1 text-xs text-green-600">
                        {formData.currentUnit && isQuantityBasedUnit(formData.currentUnit) && formData.billId && formData.amount && (
                          <>
                            {formData.currentUnit.toUpperCase() === 'KG' && formData.weight > 0 && (
                              <>✓ 自动计算：{formData.unitPrice?.toFixed(4) || '0'} × {formData.weight.toLocaleString('de-DE')} KG = {parseFloat(formData.amount).toFixed(2)}</>
                            )}
                            {formData.currentUnit.toUpperCase() === 'CBM' && formData.volume > 0 && (
                              <>✓ 自动计算：{formData.unitPrice?.toFixed(4) || '0'} × {formData.volume.toLocaleString('de-DE')} CBM = {parseFloat(formData.amount).toFixed(2)}</>
                            )}
                            {((formData.currentUnit.toUpperCase() === 'KG' && formData.weight === 0) || 
                              (formData.currentUnit.toUpperCase() === 'CBM' && formData.volume === 0)) && (
                              <span className="text-amber-600">⚠️ 订单缺少{formData.currentUnit.toUpperCase() === 'KG' ? '重量' : '体积'}数据，请选择固定金额</span>
                            )}
                          </>
                        )}
                        {(!formData.currentUnit || !isQuantityBasedUnit(formData.currentUnit)) && formData.unitPrice > 0 && (
                          <>✓ 标准价格：{formData.currency} {formData.unitPrice?.toFixed(2)}</>
                        )}
                      </p>
                    )}
                    {formData.feeName && formData.useFixedAmount && (
                      <p className="mt-1 text-xs text-orange-600">
                        ✓ 使用固定金额（手动输入）
                      </p>
                    )}
                    {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
                  </div>
                </div>
              )}
            </>
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
              <div className="flex items-center justify-between mb-2">
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
              <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <span>💡</span>
                <span>金额可直接修改（点击输入框输入固定金额）</span>
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
                          title="删除费用项"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* 路线信息 */}
                      {item.routeInfo && (
                        <div className="text-xs text-gray-500 truncate mb-2">{item.routeInfo}</div>
                      )}
                      
                      {/* 第二行：分类显示（只读）、币种和金额 */}
                      <div className="flex items-center gap-2">
                        {/* 费用分类 - 从产品库/供应商报价选择的费用分类锁定不可修改 */}
                        <div className="flex items-center gap-1 flex-1">
                          <CategoryIcon className={`w-3.5 h-3.5 flex-shrink-0 ${categoryStyle.color}`} />
                          {item.source === 'manual' ? (
                            /* 手动录入的费用可以选择分类 */
                            <select
                              value={item.category}
                              onChange={(e) => {
                                const newItems = [...pendingFeeItems]
                                newItems[index].category = e.target.value
                                setPendingFeeItems(newItems)
                              }}
                              className={`flex-1 px-1.5 py-1 text-xs border rounded ${categoryStyle.bg} ${categoryStyle.color} border-gray-200`}
                              title="选择费用分类"
                            >
                              {feeCategories.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                          ) : (
                            /* 从产品库/供应商报价选择的费用，分类只读显示 */
                            <div className={`flex-1 px-1.5 py-1 text-xs rounded ${categoryStyle.bg} ${categoryStyle.color} flex items-center gap-1`}>
                              <span>{feeCategories.find(c => c.value === item.category)?.label || item.category}</span>
                              <span className="text-[10px] opacity-70">🔒</span>
                            </div>
                          )}
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
                          title="选择币种"
                        >
                          <option value="EUR">EUR</option>
                          <option value="CNY">CNY</option>
                          <option value="USD">USD</option>
                        </select>
                        
                        {/* 金额输入 - 可直接修改为任意固定金额 */}
                        <div className="flex items-center gap-1">
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
                            title="可直接修改为任意金额"
                          />
                          <span className="text-gray-400 text-[10px]" title="可直接输入固定金额">✏️</span>
                        </div>
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
            ) : isManualEntry && selectedManualCategories.length > 1 ? (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Package className="w-4 h-4" />
                <span>将批量创建 {selectedManualCategories.length} 条费用记录</span>
              </div>
            ) : null}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPendingFeeItems([])
                setSelectedManualCategories([])
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
            ) : isManualEntry && selectedManualCategories.length > 1 ? (
              /* 多选费用分类时的批量保存按钮 */
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedManualCategories.some(item => !item.feeName || !item.amount)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    提交中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    批量保存 ({selectedManualCategories.length})
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    保存中...
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
          weight={formData.weight}
          volume={formData.volume}
          hasBillSelected={!!formData.billId}
          onClose={() => {
            setShowProductSelect(false)
            setProductSearch('')
            setSelectedProductFees([])
          }}
          onBatchAdd={(items) => {
            // 获取原有金额（编辑模式下或用户已输入金额时）
            const originalAmount = formData.amount ? parseFloat(formData.amount) : 0
            const hasOriginalAmount = originalAmount > 0
            
            // 将选中的产品费用项添加到待提交列表
            const newItems = items.map((item, index) => {
              // 计算金额：如果是按KG或CBM计费，且有关联订单的重量/体积，自动计算
              let calculatedAmount = item.feeItem.standardPrice || 0
              const unit = item.feeItem.unit || ''
              
              if (isQuantityBasedUnit(unit)) {
                calculatedAmount = calculateAmountByUnit(item.feeItem.standardPrice || 0, unit, formData.weight, formData.volume)
              }
              
              return {
                id: `pending-product-${item.feeItem.id}-${Date.now()}`,
                feeName: item.feeItem.feeName,
                feeNameEn: item.feeItem.feeNameEn,
                category: item.feeItem.feeCategory || 'other',
                // 编辑模式或有原有金额时：第一个费用项使用原有金额，其他使用计算后的金额
                amount: (hasOriginalAmount && index === 0) ? originalAmount : calculatedAmount,
                currency: item.feeItem.currency || 'EUR',
                source: 'product' as FeeSourceType,
                sourceId: item.feeItem.id,
                routeInfo: `产品: ${item.productName}`
              }
            })
            
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

      {/* 报价单费用选择弹窗 */}
      {showQuotationSelect && (
        <QuotationFeeSelectModal
          quotations={customerQuotations}
          quotationSearch={quotationSearch}
          setQuotationSearch={setQuotationSearch}
          selectedQuotationFees={selectedQuotationFees}
          setSelectedQuotationFees={setSelectedQuotationFees}
          feeCategories={feeCategories}
          weight={formData.weight}
          volume={formData.volume}
          hasBillSelected={!!formData.billId}
          onClose={() => {
            setShowQuotationSelect(false)
            setQuotationSearch('')
            setSelectedQuotationFees([])
          }}
          onBatchAdd={(items) => {
            // 获取原有金额（编辑模式下或用户已输入金额时）
            const originalAmount = formData.amount ? parseFloat(formData.amount) : 0
            const hasOriginalAmount = originalAmount > 0
            
            // 将选中的报价单费用项添加到待提交列表
            const newItems = items.map((item, index) => {
              // 计算金额：如果是按KG或CBM计费，且有关联订单的重量/体积，自动计算
              let calculatedAmount = item.feeItem.amount || item.feeItem.price * item.feeItem.quantity || 0
              const unit = item.feeItem.unit || ''
              
              if (isQuantityBasedUnit(unit)) {
                calculatedAmount = calculateAmountByUnit(item.feeItem.price || 0, unit, formData.weight, formData.volume)
              }
              
              return {
                id: `pending-quotation-${item.feeItem.id}-${Date.now()}`,
                feeName: item.feeItem.name,
                feeNameEn: item.feeItem.nameEn,
                category: item.feeItem.feeCategory || 'other',
                // 编辑模式或有原有金额时：第一个费用项使用原有金额，其他使用计算后的金额
                amount: (hasOriginalAmount && index === 0) ? originalAmount : calculatedAmount,
                currency: 'EUR',
                source: 'quotation' as FeeSourceType,
                sourceId: item.feeItem.id,
                routeInfo: `报价单: ${item.quoteNumber}`
              }
            })
            
            // 过滤掉已添加的
            const existingSourceIds = pendingFeeItems.filter(p => p.source === 'quotation').map(p => p.sourceId)
            const filteredNewItems = newItems.filter(item => !existingSourceIds.includes(item.sourceId))
            
            if (filteredNewItems.length === 0) {
              alert('所选费用项已添加')
              return
            }
            
            setPendingFeeItems(prev => [...prev, ...filteredNewItems])
            setSelectedQuotationFees([])
            setQuotationSearch('')
            setShowQuotationSelect(false)
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
          
          // 获取原有金额（编辑模式下或用户已输入金额时）
          const originalAmount = formData.amount ? parseFloat(formData.amount) : 0
          const hasOriginalAmount = originalAmount > 0
          
          // 将选中的费用项添加到待提交列表
          const newItems = selectedItems.map((item, index) => {
            // 计算金额：如果是按KG或CBM计费，且有关联订单的重量/体积，自动计算
            let calculatedAmount = item.price || 0
            const unit = item.unit || ''
            
            if (isQuantityBasedUnit(unit)) {
              calculatedAmount = calculateAmountByUnit(item.price || 0, unit, formData.weight, formData.volume)
            }
            
            // 构建路线信息，包含计费单位
            const routeParts = [
              item.routeFrom,
              item.city ? `${item.city}${item.routeTo ? ` (${item.routeTo})` : ''}` : item.routeTo,
              item.returnPoint ? `还柜:${item.returnPoint}` : ''
            ].filter(Boolean)
            
            // 如果是按量计费，添加计算说明
            let routeInfo = routeParts.join(' → ')
            if (isQuantityBasedUnit(unit) && (formData.weight > 0 || formData.volume > 0)) {
              const quantity = unit.toUpperCase() === 'KG' ? formData.weight : formData.volume
              const unitLabel = unit.toUpperCase() === 'KG' ? 'KG' : 'CBM'
              routeInfo += routeInfo ? ` | ${item.price}×${quantity}${unitLabel}` : `${item.price}×${quantity}${unitLabel}`
            }
            
            return {
              id: `pending-${item.id}-${Date.now()}`,
              feeName: item.feeName,
              feeNameEn: item.feeNameEn,
              category: item.feeCategory || 'other',
              // 编辑模式或有原有金额时：第一个费用项使用原有金额，其他使用计算后的金额
              amount: (hasOriginalAmount && index === 0) ? originalAmount : calculatedAmount,
              currency: item.currency || 'EUR',
              source: 'supplier_price' as FeeSourceType,
              sourceId: item.id,
              routeInfo
            }
          })
          
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
                }} className="p-1 hover:bg-gray-100 rounded" title="关闭">
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
                        title="清除搜索"
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
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900">{item.feeName}</span>
                                {/* 显示计费单位 */}
                                {item.unit && (
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                                    isQuantityBasedUnit(item.unit) 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    /{item.unit}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium text-orange-600">
                                  {item.currency} {item.price?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                  {item.unit && `/${item.unit}`}
                                </span>
                                {/* 如果是按量计费且有订单信息，显示预估金额 */}
                                {isQuantityBasedUnit(item.unit) && formData.billId && (formData.weight > 0 || formData.volume > 0) && (
                                  <div className="text-xs text-green-600">
                                    ≈ {item.currency} {calculateAmountByUnit(item.price || 0, item.unit, formData.weight, formData.volume).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
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
// 计算按单位计费的金额（ProductFeeSelectModal 内部使用）
const calcAmountByUnit = (unitPrice: number, unit: string, weight: number, volume: number): number => {
  const upperUnit = (unit || '').toUpperCase()
  if (upperUnit === 'KG' && weight > 0) {
    return unitPrice * weight
  } else if (upperUnit === 'CBM' && volume > 0) {
    return unitPrice * volume
  }
  return unitPrice
}

// 判断是否为按量计费的单位（ProductFeeSelectModal 内部使用）
const isQtyBasedUnit = (unit: string): boolean => {
  const upperUnit = (unit || '').toUpperCase()
  return upperUnit === 'KG' || upperUnit === 'CBM'
}

function ProductFeeSelectModal({
  products,
  productSearch,
  setProductSearch,
  selectedProductFees,
  setSelectedProductFees,
  loadProductFeeItems,
  feeCategories,
  weight,
  volume,
  hasBillSelected,
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
  weight: number        // 订单货物重量（KG）
  volume: number        // 订单货物体积（CBM）
  hasBillSelected: boolean  // 是否已选择订单
  onClose: () => void
  onBatchAdd: (items: Array<{ productId: string; productName: string; feeItem: ProductFeeItem }>) => void
}) {
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null)
  const [productFeeItemsMap, setProductFeeItemsMap] = useState<Record<string, ProductFeeItem[]>>({})
  const [expandedProducts, setExpandedProducts] = useState<string[]>([])
  const [feeItemSearch, setFeeItemSearch] = useState('')  // 费用项搜索
  
  // 检查费用项是否匹配搜索词
  const feeItemMatchesSearch = (item: ProductFeeItem, search: string): boolean => {
    return (
      item.feeName?.toLowerCase().includes(search) ||
      item.feeNameEn?.toLowerCase().includes(search) ||
      item.routeFrom?.toLowerCase().includes(search) ||
      item.routeTo?.toLowerCase().includes(search) ||
      item.city?.toLowerCase().includes(search) ||
      item.country?.toLowerCase().includes(search) ||
      item.returnPoint?.toLowerCase().includes(search)
    )
  }
  
  // 检查搜索词是否匹配产品名称/代码
  const productMatchesSearch = (product: Product, search: string): boolean => {
    return (
      product.productName?.toLowerCase().includes(search) ||
      product.productCode?.toLowerCase().includes(search)
    )
  }
  
  // 过滤产品：
  // 1. 如果搜索词匹配产品名称/代码，显示该产品
  // 2. 如果搜索词匹配已加载的费用项，显示该产品
  // 3. 如果没有产品名称匹配，但有费用项数据还没加载，显示所有产品（让用户展开搜索）
  const filteredProducts = products.filter(product => {
    if (!productSearch) return true
    const search = productSearch.toLowerCase()
    
    // 检查产品名称/代码是否匹配
    if (productMatchesSearch(product, search)) return true
    
    // 检查已加载的费用项是否有匹配的路线信息
    const feeItems = productFeeItemsMap[product.id] || []
    if (feeItems.length > 0 && feeItems.some(item => feeItemMatchesSearch(item, search))) {
      return true
    }
    
    // 如果该产品的费用项还没加载，保留该产品让用户可以展开查看
    if (feeItems.length === 0) {
      return true
    }
    
    return false
  })
  
  // 过滤费用项（支持搜索费用名称、起运地、目的地、邮编、还柜点）
  const filterFeeItems = (items: ProductFeeItem[]): ProductFeeItem[] => {
    if (!feeItemSearch) return items
    const search = feeItemSearch.toLowerCase()
    return items.filter(item => feeItemMatchesSearch(item, search))
  }
  
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
  
  // 全选某产品下的所有费用项（使用过滤后的列表）
  const selectAllFromProduct = (productId: string, productName: string) => {
    const allFeeItems = productFeeItemsMap[productId] || []
    const feeItems = filterFeeItems(allFeeItems)  // 使用过滤后的费用项
    const currentSelectedIds = selectedProductFees
      .filter(f => f.productId === productId)
      .map(f => f.feeItem.id)
    
    // 判断是否所有过滤后的费用项都已选中
    const filteredItemIds = feeItems.map(item => item.id)
    const allFilteredSelected = filteredItemIds.every(id => currentSelectedIds.includes(id))
    
    if (allFilteredSelected && feeItems.length > 0) {
      // 取消选择过滤后的费用项
      setSelectedProductFees(selectedProductFees.filter(
        f => !(f.productId === productId && filteredItemIds.includes(f.feeItem.id))
      ))
    } else {
      // 全选过滤后的费用项
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
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" title="关闭">
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
              onChange={(e) => {
                setProductSearch(e.target.value)
                setFeeItemSearch(e.target.value)  // 同步设置费用项搜索
              }}
              placeholder="搜索产品、费用项、起运地、目的地、邮编、还柜点..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {productSearch && (
              <button
                onClick={() => {
                  setProductSearch('')
                  setFeeItemSearch('')
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="清除搜索"
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
                const allFeeItems = productFeeItemsMap[product.id] || []
                const feeItems = filterFeeItems(allFeeItems)  // 应用费用项搜索过滤
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
                              <span className="text-xs text-gray-500">
                                共 {feeItems.length} 个费用项
                                {feeItemSearch && allFeeItems.length !== feeItems.length && (
                                  <span className="text-gray-400"> (总计 {allFeeItems.length})</span>
                                )}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  selectAllFromProduct(product.id, product.productName)
                                }}
                                className="text-xs text-green-600 hover:text-green-700"
                              >
                                {selectedCount === feeItems.length && feeItems.length > 0 ? '取消全选' : '全选'}
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
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm text-gray-900">{item.feeName}</span>
                                          {/* 显示计费单位 */}
                                          {item.unit && (
                                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                                              isQtyBasedUnit(item.unit) 
                                                ? 'bg-blue-100 text-blue-700' 
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              /{item.unit}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <span className="text-sm font-medium text-green-600">
                                            {item.currency} {item.standardPrice?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                            {item.unit && `/${item.unit}`}
                                          </span>
                                          {/* 如果是按量计费且有订单信息，显示预估金额 */}
                                          {isQtyBasedUnit(item.unit) && hasBillSelected && (weight > 0 || volume > 0) && (
                                            <div className="text-xs text-blue-600">
                                              ≈ {item.currency} {calcAmountByUnit(item.standardPrice || 0, item.unit, weight, volume).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                            </div>
                                          )}
                                        </div>
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
                                      {item.feeCategory && (
                                        <div className="mt-1 text-xs text-gray-500">
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

// 报价单费用项多选弹窗组件
function QuotationFeeSelectModal({
  quotations,
  quotationSearch,
  setQuotationSearch,
  selectedQuotationFees,
  setSelectedQuotationFees,
  feeCategories,
  weight,
  volume,
  hasBillSelected,
  onClose,
  onBatchAdd
}: {
  quotations: CustomerQuotation[]
  quotationSearch: string
  setQuotationSearch: (value: string) => void
  selectedQuotationFees: Array<{ quotationId: string; quoteNumber: string; feeItem: QuotationFeeItem }>
  setSelectedQuotationFees: (value: Array<{ quotationId: string; quoteNumber: string; feeItem: QuotationFeeItem }>) => void
  feeCategories: FeeCategory[]
  weight: number
  volume: number
  hasBillSelected: boolean
  onClose: () => void
  onBatchAdd: (items: Array<{ quotationId: string; quoteNumber: string; feeItem: QuotationFeeItem }>) => void
}) {
  const [expandedQuotations, setExpandedQuotations] = useState<string[]>([])
  const [feeItemSearch, setFeeItemSearch] = useState('')

  // 检查费用项是否匹配搜索词
  const feeItemMatchesSearch = (item: QuotationFeeItem, search: string): boolean => {
    return (
      item.name?.toLowerCase().includes(search) ||
      item.nameEn?.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search)
    )
  }

  // 检查报价单是否匹配搜索词
  const quotationMatchesSearch = (quotation: CustomerQuotation, search: string): boolean => {
    return (
      quotation.quoteNumber?.toLowerCase().includes(search) ||
      quotation.subject?.toLowerCase().includes(search) ||
      quotation.customerName?.toLowerCase().includes(search)
    )
  }

  // 过滤报价单
  const searchLower = (quotationSearch + feeItemSearch).toLowerCase()
  const filteredQuotations = quotations.filter(quotation => {
    if (!searchLower) return true
    
    // 如果匹配报价单名称/编号
    if (quotationMatchesSearch(quotation, searchLower)) return true
    
    // 如果有费用项搜索词，检查费用项
    if (feeItemSearch) {
      return quotation.items?.some(item => feeItemMatchesSearch(item, feeItemSearch.toLowerCase()))
    }
    
    return true
  })

  // 切换报价单展开状态
  const toggleQuotation = (quotationId: string) => {
    setExpandedQuotations(prev =>
      prev.includes(quotationId)
        ? prev.filter(id => id !== quotationId)
        : [...prev, quotationId]
    )
  }

  // 切换费用项选中状态
  const toggleFeeItem = (quotationId: string, quoteNumber: string, item: QuotationFeeItem) => {
    setSelectedQuotationFees(prev => {
      const exists = prev.some(f => f.quotationId === quotationId && f.feeItem.id === item.id)
      if (exists) {
        return prev.filter(f => !(f.quotationId === quotationId && f.feeItem.id === item.id))
      }
      return [...prev, { quotationId, quoteNumber, feeItem: item }]
    })
  }

  // 选择/取消选择报价单下所有费用项
  const selectAllFromQuotation = (quotationId: string, quoteNumber: string) => {
    const quotation = quotations.find(q => q.id === quotationId)
    if (!quotation?.items?.length) return

    const feeItems = quotation.items
    const allSelected = feeItems.every(item =>
      selectedQuotationFees.some(f => f.quotationId === quotationId && f.feeItem.id === item.id)
    )

    if (allSelected) {
      // 取消选择该报价单下所有费用项
      setSelectedQuotationFees(prev =>
        prev.filter(f => f.quotationId !== quotationId)
      )
    } else {
      // 选择该报价单下所有费用项
      const newItems = feeItems
        .filter(item => !selectedQuotationFees.some(f => f.quotationId === quotationId && f.feeItem.id === item.id))
        .map(item => ({ quotationId, quoteNumber, feeItem: item }))
      setSelectedQuotationFees(prev => [...prev, ...newItems])
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-[700px] max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-gray-900">从报价单选择费用项</span>
            <span className="text-xs text-gray-500 ml-2">
              {quotations.length} 份报价单
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" title="关闭">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 搜索区 */}
        <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索报价单编号、主题..."
              value={quotationSearch}
              onChange={(e) => setQuotationSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索费用项..."
              value={feeItemSearch}
              onChange={(e) => setFeeItemSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        {/* 报价单列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredQuotations.length > 0 ? (
            <div className="space-y-2">
              {filteredQuotations.map(quotation => {
                const isExpanded = expandedQuotations.includes(quotation.id)
                const selectedCount = selectedQuotationFees.filter(f => f.quotationId === quotation.id).length
                const hasItems = quotation.items && quotation.items.length > 0

                // 过滤费用项
                const feeItems = feeItemSearch
                  ? (quotation.items || []).filter(item => feeItemMatchesSearch(item, feeItemSearch.toLowerCase()))
                  : (quotation.items || [])

                return (
                  <div key={quotation.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* 报价单头部 */}
                    <div
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isExpanded ? 'bg-purple-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleQuotation(quotation.id)}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{quotation.quoteNumber}</span>
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">已确认</span>
                            {selectedCount > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                已选 {selectedCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                            <span>{quotation.subject || '无主题'}</span>
                            <span>|</span>
                            <span>{quotation.quoteDate}</span>
                            <span>|</span>
                            <span className="text-purple-600 font-medium">
                              {quotation.currency} {quotation.totalAmount?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {quotation.items?.length || 0} 项费用
                      </div>
                    </div>

                    {/* 费用项列表 */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                        {feeItems.length > 0 ? (
                          <>
                            {/* 全选按钮 */}
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500">
                                共 {feeItems.length} 项费用
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  selectAllFromQuotation(quotation.id, quotation.quoteNumber)
                                }}
                                className="text-xs text-purple-600 hover:text-purple-700"
                              >
                                {selectedCount === feeItems.length && feeItems.length > 0 ? '取消全选' : '全选'}
                              </button>
                            </div>

                            {/* 费用项 */}
                            <div className="space-y-1">
                              {feeItems.map(item => {
                                const isSelected = selectedQuotationFees.some(
                                  f => f.quotationId === quotation.id && f.feeItem.id === item.id
                                )

                                return (
                                  <div
                                    key={item.id}
                                    className={`flex items-start gap-3 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'border-purple-400 bg-purple-50'
                                        : 'border-gray-100 hover:border-purple-300 hover:bg-purple-50/50'
                                    }`}
                                    onClick={() => toggleFeeItem(quotation.id, quotation.quoteNumber, item)}
                                  >
                                    {/* 复选框 */}
                                    <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center ${
                                      isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                                    }`}>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>

                                    {/* 内容 */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm text-gray-900">{item.name}</span>
                                          {item.unit && (
                                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                                              isQtyBasedUnit(item.unit)
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              /{item.unit}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <span className="text-sm font-medium text-purple-600">
                                            EUR {item.amount?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                          </span>
                                          {item.quantity > 1 && (
                                            <div className="text-xs text-gray-500">
                                              {item.price?.toLocaleString('de-DE', { minimumFractionDigits: 2 })} × {item.quantity}
                                            </div>
                                          )}
                                          {/* 如果是按量计费且有订单信息，显示预估金额 */}
                                          {isQtyBasedUnit(item.unit) && hasBillSelected && (weight > 0 || volume > 0) && (
                                            <div className="text-xs text-blue-600">
                                              ≈ EUR {calcAmountByUnit(item.price || 0, item.unit, weight, volume).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {item.nameEn && (
                                        <div className="text-xs text-gray-500">{item.nameEn}</div>
                                      )}
                                      {item.description && (
                                        <div className="text-xs text-gray-400 mt-1">{item.description}</div>
                                      )}
                                      {item.feeCategory && (
                                        <div className="mt-1 text-xs text-gray-500">
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
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">{quotationSearch || feeItemSearch ? '未找到匹配的报价单' : '该客户暂无已确认报价单'}</p>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {selectedQuotationFees.length > 0
              ? `已选择 ${selectedQuotationFees.length} 项，合计 ${
                  selectedQuotationFees
                    .reduce((sum, f) => sum + (f.feeItem.amount || 0), 0)
                    .toLocaleString('de-DE', { minimumFractionDigits: 2 })
                } EUR`
              : '点击展开报价单，选择费用项，可多选'
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
              onClick={() => onBatchAdd(selectedQuotationFees)}
              disabled={selectedQuotationFees.length === 0}
              className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg flex items-center gap-1.5 ${
                selectedQuotationFees.length > 0
                  ? 'bg-purple-500 hover:bg-purple-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              添加 {selectedQuotationFees.length > 0 ? `(${selectedQuotationFees.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

