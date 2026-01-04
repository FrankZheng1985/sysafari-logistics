import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft, Plus, Trash2, DollarSign, Package, X, Search,
  FileText, AlertCircle, Check, Loader2, Receipt, Edit3,
  ArrowDownCircle, ArrowUpCircle, ChevronRight, Settings,
  Truck, Building2, Shield, ChevronDown
} from 'lucide-react'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const API_BASE = getApiBaseUrl()

// 安全返回函数 - 避免 navigate(-1) 导致空白页
const useSafeGoBack = (navigate: ReturnType<typeof useNavigate>, invoiceId?: string, billId?: string) => {
  return () => {
    // 优先使用明确的返回路径，避免 navigate(-1) 的不确定性
    if (invoiceId && invoiceId !== 'test') {
      // 如果有发票ID，返回发票详情页
      navigate(`/finance/invoices/${invoiceId}`)
    } else if (billId) {
      // 如果有订单ID，返回订单详情页
      navigate(`/bill/${billId}`)
    } else {
      // 默认返回费用管理页面
      navigate('/finance/fees')
    }
  }
}

// 费用来源类型
type FeeSourceType = 'product' | 'supplier_price' | 'quotation' | 'manual'

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
  return { icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100' }
}

interface FeeCategory {
  id: string
  value: string
  label: string
  icon: any
  color: string
  bg: string
  parentId?: string | null
  level?: number
}

interface FeeCategoryGroup {
  parent: FeeCategory
  children: FeeCategory[]
}

interface ProductFeeItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string
  standardPrice: number
  currency: string
  routeFrom?: string
  routeTo?: string
  returnPoint?: string
  city?: string
  country?: string
  transportMode?: string
}

interface Product {
  id: string
  productCode: string
  productName: string
  feeItems?: ProductFeeItem[]
}

interface SupplierPriceItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string
  price: number
  currency: string
  routeFrom?: string
  routeTo?: string
  returnPoint?: string
  city?: string
  country?: string
  transportMode?: string
}

interface Supplier {
  id: string
  supplierName: string
  supplierCode: string
}

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

interface PendingFeeItem {
  id: string
  feeName: string
  feeNameEn?: string
  category: string
  amount: number
  currency: string
  source: FeeSourceType
  sourceId?: number | string
  routeInfo?: string
  unit?: string
}

interface InvoiceInfo {
  id: string
  invoiceNumber: string
  invoiceType: 'sales' | 'purchase'
  billId: string
  billNumber: string
  containerNumber?: string
  containerNumbers?: string[]
  customerId?: string
  customerName: string
  totalAmount: number
  paidAmount: number
  status: string
  currency?: string
}

interface BillInfo {
  id: string
  billNumber: string
  orderNumber?: string
  containerNumber?: string
  containerNumbers?: string[]
  customerName: string
  customerId?: string
  paymentConfirmed: boolean
  primaryInvoiceNumber?: string
  weight?: number
  volume?: number
}

// 默认费用分类
const DEFAULT_FEE_CATEGORIES: FeeCategory[] = [
  { id: '1', value: 'other', label: '其他服务', icon: Settings, color: 'text-gray-600', bg: 'bg-gray-100' },
]

export default function SupplementFee() {
  const navigate = useNavigate()
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const [searchParams] = useSearchParams()
  const billIdFromUrl = searchParams.get('billId')
  const { user, hasPermission } = useAuth()
  
  // 安全返回函数
  const safeGoBack = useSafeGoBack(navigate, invoiceId, billIdFromUrl || undefined)
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null)
  const [bill, setBill] = useState<BillInfo | null>(null)
  
  // 费用类型
  const [feeType, setFeeType] = useState<'receivable' | 'payable'>('receivable')
  
  // 费用来源相关
  const [feeSource, setFeeSource] = useState<FeeSourceType>('product')
  const [isManualEntry, setIsManualEntry] = useState(false)
  
  // 待提交的费用项列表
  const [pendingFeeItems, setPendingFeeItems] = useState<PendingFeeItem[]>([])
  
  // 产品相关
  const [products, setProducts] = useState<Product[]>([])
  const [showProductSelect, setShowProductSelect] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  
  // 供应商相关
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [supplierPrices, setSupplierPrices] = useState<SupplierPriceItem[]>([])
  const [showSupplierPriceSelect, setShowSupplierPriceSelect] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  
  // 报价单相关
  const [customerQuotations, setCustomerQuotations] = useState<CustomerQuotation[]>([])
  const [showQuotationSelect, setShowQuotationSelect] = useState(false)
  const [loadingQuotations, setLoadingQuotations] = useState(false)
  
  // 费用分类
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>(DEFAULT_FEE_CATEGORIES)
  const [feeCategoryGroups, setFeeCategoryGroups] = useState<FeeCategoryGroup[]>([])
  
  // 手动录入相关
  const [manualCategory, setManualCategory] = useState('')
  const [manualFeeName, setManualFeeName] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualCurrency, setManualCurrency] = useState('EUR')
  const [manualDescription, setManualDescription] = useState('')
  
  // 费用日期
  const [feeDate, setFeeDate] = useState(new Date().toISOString().split('T')[0])
  
  // 供应商搜索防抖
  const supplierSearchRef = useRef<NodeJS.Timeout | null>(null)
  
  // 判断是否有财务权限
  const hasFinancePermission = hasPermission('finance:manage') || 
                               hasPermission('finance:fee_manage') ||
                               user?.role === 'admin'

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceInfo()
    } else if (billIdFromUrl) {
      fetchBillInfo(billIdFromUrl)
    }
    loadProducts()
    loadSuppliers()
    loadFeeCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, billIdFromUrl])

  // 获取发票信息
  const fetchInvoiceInfo = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/invoices/${invoiceId}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        // 处理 containerNumbers - API 可能返回 JSON 字符串或数组
        let containerNumbers: string[] = []
        if (data.data.containerNumbers) {
          if (typeof data.data.containerNumbers === 'string') {
            try {
              containerNumbers = JSON.parse(data.data.containerNumbers)
            } catch {
              containerNumbers = [data.data.containerNumbers]
            }
          } else if (Array.isArray(data.data.containerNumbers)) {
            containerNumbers = data.data.containerNumbers
          }
        }
        
        setInvoice({
          id: data.data.id,
          invoiceNumber: data.data.invoiceNumber,
          invoiceType: data.data.invoiceType,
          billId: data.data.billId,
          billNumber: data.data.billNumber,
          containerNumber: data.data.containerNumber,
          containerNumbers: containerNumbers,
          customerId: data.data.customerId,
          customerName: data.data.customerName,
          totalAmount: data.data.totalAmount,
          paidAmount: data.data.paidAmount,
          status: data.data.status,
          currency: data.data.currency
        })
        
        if (data.data.billId) {
          await fetchBillInfo(data.data.billId)
        }
      }
    } catch (error) {
      console.error('获取发票信息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取提单信息
  const fetchBillInfo = async (billId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/bills/${billId}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        // 处理 containerNumbers - API 可能返回 JSON 字符串或数组
        let containerNumbers: string[] = []
        if (data.data.containerNumbers) {
          if (typeof data.data.containerNumbers === 'string') {
            try {
              containerNumbers = JSON.parse(data.data.containerNumbers)
            } catch {
              containerNumbers = [data.data.containerNumbers]
            }
          } else if (Array.isArray(data.data.containerNumbers)) {
            containerNumbers = data.data.containerNumbers
          }
        } else if (data.data.containerNumber) {
          containerNumbers = [data.data.containerNumber]
        }
        
        setBill({
          id: data.data.id,
          billNumber: data.data.billNumber,
          orderNumber: data.data.orderNumber,
          containerNumber: data.data.containerNumber,
          containerNumbers: containerNumbers,
          customerName: data.data.customerName,
          customerId: data.data.customerId,
          paymentConfirmed: data.data.paymentConfirmed === 1,
          primaryInvoiceNumber: data.data.primaryInvoiceNumber,
          weight: Number(data.data.weight) || 0,
          volume: Number(data.data.volume) || 0
        })
        
        // 如果有客户ID，加载客户的报价单
        if (data.data.customerId) {
          loadCustomerQuotations(data.data.customerId)
        }
      }
    } catch (error) {
      console.error('获取提单信息失败:', error)
    } finally {
      if (!invoiceId) {
        setLoading(false)
      }
    }
  }

  // 加载产品列表
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

  // 加载供应商列表
  const loadSuppliers = async (search?: string) => {
    setLoadingSuppliers(true)
    try {
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

  // 加载费用分类
  const loadFeeCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/service-fee-categories?status=active`)
      const data = await response.json()
      const list = data.data?.list || (Array.isArray(data.data) ? data.data : [])
      if (data.errCode === 200 && list.length > 0) {
        const categories: FeeCategory[] = list.map((item: any) => {
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
        
        const parentCategories = categories.filter(c => !c.parentId || c.level === 1)
        const childCategories = categories.filter(c => c.parentId && c.level === 2)
        
        const groups: FeeCategoryGroup[] = parentCategories.map(parent => {
          const children = childCategories.filter(child => child.parentId === parent.id)
          return { parent, children }
        }).filter(group => group.children.length > 0)
        
        if (categories.length > 0) {
          setFeeCategories(categories)
        }
        if (groups.length > 0) {
          setFeeCategoryGroups(groups)
        }
      }
    } catch (error) {
      console.error('加载费用分类失败:', error)
    }
  }

  // 加载供应商报价
  const loadSupplierPrices = async (supplierId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/${supplierId}/prices?pageSize=100`)
      const data = await response.json()
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

  // 加载产品费用项
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

  // 加载客户报价单
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

  // 供应商搜索处理
  const handleSupplierSearchChange = (value: string) => {
    setSupplierSearch(value)
    setSelectedSupplier(null)
    setShowSupplierDropdown(true)
    
    if (supplierSearchRef.current) {
      clearTimeout(supplierSearchRef.current)
    }
    
    if (value.length >= 2) {
      supplierSearchRef.current = setTimeout(() => {
        loadSuppliers(value)
      }, 300)
    }
  }

  // 选择供应商
  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setShowSupplierDropdown(false)
    setSupplierSearch('')
    loadSupplierPrices(supplier.id)
  }

  // 计算金额
  const calculateAmountByUnit = (unitPrice: number, unit: string, weight: number, volume: number): number => {
    const upperUnit = (unit || '').toUpperCase()
    if (upperUnit === 'KG' && weight > 0) {
      return unitPrice * weight
    } else if (upperUnit === 'CBM' && volume > 0) {
      return unitPrice * volume
    }
    return unitPrice
  }

  // 判断是否为按量计费
  const isQuantityBasedUnit = (unit: string): boolean => {
    const upperUnit = (unit || '').toUpperCase()
    return upperUnit === 'KG' || upperUnit === 'CBM'
  }

  // 添加产品费用项到待提交列表
  const handleAddProductFee = (productName: string, feeItem: ProductFeeItem) => {
    const calculatedAmount = calculateAmountByUnit(
      feeItem.standardPrice || 0,
      feeItem.unit || '',
      bill?.weight || 0,
      bill?.volume || 0
    )
    
    const newItem: PendingFeeItem = {
      id: `product-${feeItem.id}-${Date.now()}`,
      feeName: feeItem.feeName,
      feeNameEn: feeItem.feeNameEn,
      category: feeItem.feeCategory || 'other',
      amount: calculatedAmount,
      currency: feeItem.currency || 'EUR',
      source: 'product',
      sourceId: feeItem.id,
      routeInfo: `产品: ${productName}`,
      unit: feeItem.unit
    }
    
    // 检查是否已添加
    const exists = pendingFeeItems.some(p => p.source === 'product' && p.sourceId === feeItem.id)
    if (exists) {
      alert('该费用项已添加')
      return
    }
    
    setPendingFeeItems(prev => [...prev, newItem])
  }

  // 添加供应商报价到待提交列表
  const handleAddSupplierPrice = (priceItem: SupplierPriceItem) => {
    const calculatedAmount = calculateAmountByUnit(
      priceItem.price || 0,
      priceItem.unit || '',
      bill?.weight || 0,
      bill?.volume || 0
    )
    
    const routeParts = []
    if (priceItem.routeFrom) routeParts.push(priceItem.routeFrom)
    if (priceItem.routeTo) routeParts.push(priceItem.routeTo)
    if (priceItem.city) routeParts.push(priceItem.city)
    
    const newItem: PendingFeeItem = {
      id: `supplier-${priceItem.id}-${Date.now()}`,
      feeName: priceItem.feeName,
      feeNameEn: priceItem.feeNameEn,
      category: priceItem.feeCategory || 'other',
      amount: calculatedAmount,
      currency: priceItem.currency || 'EUR',
      source: 'supplier_price',
      sourceId: priceItem.id,
      routeInfo: routeParts.length > 0 ? `路线: ${routeParts.join(' → ')}` : `供应商: ${selectedSupplier?.supplierName}`,
      unit: priceItem.unit
    }
    
    const exists = pendingFeeItems.some(p => p.source === 'supplier_price' && p.sourceId === priceItem.id)
    if (exists) {
      alert('该报价项已添加')
      return
    }
    
    setPendingFeeItems(prev => [...prev, newItem])
  }

  // 添加报价单费用到待提交列表
  const handleAddQuotationFee = (quotation: CustomerQuotation, feeItem: QuotationFeeItem) => {
    const newItem: PendingFeeItem = {
      id: `quotation-${feeItem.id}-${Date.now()}`,
      feeName: feeItem.name,
      feeNameEn: feeItem.nameEn,
      category: feeItem.feeCategory || 'other',
      amount: feeItem.amount,
      currency: quotation.currency || 'EUR',
      source: 'quotation',
      sourceId: feeItem.id,
      routeInfo: `报价单: ${quotation.quoteNumber}`,
      unit: feeItem.unit
    }
    
    const exists = pendingFeeItems.some(p => p.source === 'quotation' && p.sourceId === feeItem.id)
    if (exists) {
      alert('该费用项已添加')
      return
    }
    
    setPendingFeeItems(prev => [...prev, newItem])
  }

  // 添加手动录入费用
  const handleAddManualFee = () => {
    if (!manualFeeName.trim()) {
      alert('请输入费用名称')
      return
    }
    if (!manualAmount || parseFloat(manualAmount) <= 0) {
      alert('请输入有效金额')
      return
    }
    
    const newItem: PendingFeeItem = {
      id: `manual-${Date.now()}`,
      feeName: manualFeeName,
      category: manualCategory || 'other',
      amount: parseFloat(manualAmount),
      currency: manualCurrency,
      source: 'manual',
      routeInfo: manualDescription || '[手动录入]'
    }
    
    setPendingFeeItems(prev => [...prev, newItem])
    
    // 清空表单
    setManualFeeName('')
    setManualAmount('')
    setManualDescription('')
  }

  // 删除待提交费用项
  const removePendingItem = (id: string) => {
    setPendingFeeItems(prev => prev.filter(item => item.id !== id))
  }

  // 更新待提交费用项金额
  const updatePendingItemAmount = (id: string, amount: number) => {
    setPendingFeeItems(prev => prev.map(item => 
      item.id === id ? { ...item, amount } : item
    ))
  }

  // 提交追加费用并创建追加发票
  const handleSubmit = async () => {
    if (pendingFeeItems.length === 0) {
      alert('请至少添加一项费用')
      return
    }
    
    // 追加发票只支持应收费用
    if (feeType !== 'receivable') {
      alert('追加发票仅支持应收费用')
      return
    }
    
    // 必须有原发票信息
    if (!invoice?.invoiceNumber) {
      alert('无法获取原发票信息，请确认发票存在')
      return
    }
    
    setSubmitting(true)
    try {
      const createdFeeIds: string[] = []
      const invoiceItems: Array<{
        feeName: string
        category: string
        amount: number
        currency: string
        description: string
      }> = []
      let totalAmount = 0
      let failCount = 0
      
      // 第一步：创建费用记录
      for (const fee of pendingFeeItems) {
        const feeData = {
          feeName: fee.feeName,
          feeType: 'receivable',
          category: fee.category,
          amount: fee.amount,
          currency: fee.currency,
          feeDate: feeDate,
          description: fee.routeInfo || '',
          billId: bill?.id,
          billNumber: bill?.billNumber,
          customerId: bill?.customerId,
          customerName: bill?.customerName,
          feeSource: fee.source,
          needApproval: fee.source === 'manual'
        }
        
        const response = await fetch(`${API_BASE}/api/fees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feeData)
        })
        
        const result = await response.json()
        
        if (result.errCode === 200 && result.data?.id) {
          createdFeeIds.push(result.data.id)
          invoiceItems.push({
            feeName: fee.feeName,
            category: fee.category,
            amount: fee.amount,
            currency: fee.currency,
            description: fee.routeInfo || ''
          })
          totalAmount += fee.amount
          
          // 手动录入的费用创建审批记录
          if (fee.source === 'manual') {
            try {
              await fetch(`${API_BASE}/api/fee-item-approvals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  feeId: result.data.id,
                  feeName: fee.feeName,
                  category: fee.category,
                  amount: fee.amount,
                  currency: fee.currency,
                  description: fee.routeInfo,
                  status: 'pending'
                })
              })
            } catch (err) {
              console.log('创建审批记录失败:', err)
            }
          }
        } else {
          failCount++
        }
      }
      
      // 第二步：如果有成功创建的费用，直接创建追加发票
      if (createdFeeIds.length > 0) {
        // 优先从原发票获取信息，如果原发票没有才从提单获取
        const customerId = invoice.customerId || bill?.customerId
        const customerName = invoice.customerName || bill?.customerName || ''
        const containerNumbers = (invoice.containerNumbers && invoice.containerNumbers.length > 0) 
          ? invoice.containerNumbers 
          : (bill?.containerNumbers || [])
        const billId = invoice.billId || bill?.id
        const billNumber = invoice.billNumber || bill?.billNumber || ''
        const currency = invoice.currency || pendingFeeItems[0]?.currency || 'EUR'
        
        const supplementInvoiceData = {
          parentInvoiceNumber: invoice.invoiceNumber,
          billId: billId,
          billNumber: billNumber,
          customerId: customerId,
          customerName: customerName,
          containerNumbers: containerNumbers,
          invoiceDate: feeDate,
          feeIds: createdFeeIds,
          items: invoiceItems,
          subtotal: totalAmount,
          totalAmount: totalAmount,
          currency: currency,
          invoiceType: invoice.invoiceType || 'sales',
          status: 'pending',
          description: `追加费用 - 原发票: ${invoice.invoiceNumber}`
        }
        
        const invoiceResponse = await fetch(`${API_BASE}/api/invoices/supplement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supplementInvoiceData)
        })
        
        const invoiceResult = await invoiceResponse.json()
        
        if (invoiceResult.errCode === 200 && invoiceResult.data?.id) {
          // 追加发票创建成功，跳转到新发票详情页
          const successMessage = failCount > 0 
            ? `追加发票创建成功！发票号：${invoiceResult.data.invoiceNumber}\n（${failCount} 条费用创建失败）`
            : `追加发票创建成功！发票号：${invoiceResult.data.invoiceNumber}`
          
          alert(successMessage)
          navigate(`/finance/invoices/${invoiceResult.data.id}`)
        } else {
          // 费用创建成功但发票创建失败
          alert(`费用已创建成功，但追加发票创建失败：${invoiceResult.errMsg || '未知错误'}\n请到发票管理中手动创建发票。`)
          if (bill?.id) {
            navigate(`/bill/${bill.id}`)
          } else {
            navigate('/finance/fees')
          }
        }
      } else {
        alert('费用创建失败，请稍后重试')
      }
    } catch (error) {
      console.error('提交追加费用失败:', error)
      alert('提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  // 过滤供应商
  const filteredSuppliers = suppliers.filter(supplier => {
    if (!supplierSearch) return true
    const search = supplierSearch.toLowerCase()
    return (
      supplier.supplierName.toLowerCase().includes(search) ||
      supplier.supplierCode?.toLowerCase().includes(search)
    )
  })

  // 计算总金额
  const totalAmount = pendingFeeItems.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* 页面标题 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">追加费用</h1>
              <p className="text-sm text-gray-500">为已完成收款的订单添加追加费用</p>
            </div>
          </div>
          <button
            onClick={() => safeGoBack()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        </div>
        
        {/* 非财务人员提示 */}
        {!hasFinancePermission && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>您添加的追加费用将提交给财务部门审批，审批通过后才能生效</span>
          </div>
        )}
      </div>

      {/* 订单/发票信息 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary-600" />
          关联订单信息
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {bill && (
            <>
              <div>
                <div className="text-xs text-gray-500">订单号</div>
                <div className="text-sm font-medium text-gray-900">{bill.orderNumber || bill.billNumber}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">集装箱号</div>
                <div className="text-sm text-gray-900">{bill.containerNumber || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">客户</div>
                <div className="text-sm text-gray-900">{bill.customerName || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">主发票号</div>
                <div className="text-sm text-gray-900">{bill.primaryInvoiceNumber || '-'}</div>
              </div>
            </>
          )}
          
          {invoice && (
            <>
              <div>
                <div className="text-xs text-gray-500">原发票号</div>
                <div className="text-sm font-medium text-primary-600">{invoice.invoiceNumber}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">发票金额</div>
                <div className="text-sm text-gray-900">{formatCurrency(invoice.totalAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">发票状态</div>
                <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {invoice.status === 'paid' ? '已收款' : invoice.status}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* 货物信息 */}
        {bill && (bill.weight || bill.volume) && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-blue-600 font-medium">📦 货物信息：</span>
              {bill.weight && bill.weight > 0 && (
                <span className="text-gray-700">
                  重量 <span className="font-medium text-blue-700">{bill.weight.toLocaleString('de-DE')} KG</span>
                </span>
              )}
              {bill.volume && bill.volume > 0 && (
                <span className="text-gray-700">
                  体积 <span className="font-medium text-blue-700">{bill.volume.toLocaleString('de-DE', { minimumFractionDigits: 2 })} CBM</span>
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-blue-500">
              💡 选择按KG/CBM计费的费用项时，系统将自动计算金额
            </div>
          </div>
        )}
      </div>

      {/* 追加发票说明 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-purple-900 mb-1">追加发票说明</h3>
            <p className="text-xs text-purple-700">
              追加费用将自动创建一张新的销售发票（追加发票），发票号格式为：原发票号-1、原发票号-2 依此类推。
            </p>
            {invoice?.invoiceNumber && (
              <p className="text-xs text-purple-600 mt-1">
                原发票号：<span className="font-medium">{invoice.invoiceNumber}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 费用来源选择 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            费用来源
          </label>
          
          {/* 产品库 + 报价单 + 手动录入 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setFeeSource('product')
                setIsManualEntry(false)
                setShowProductSelect(true)
              }}
              className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                feeSource === 'product' && !isManualEntry
                  ? 'bg-green-50 text-green-600 border-green-500 ring-1 ring-green-500'
                  : 'border-gray-200 text-gray-600 hover:bg-green-50'
              }`}
            >
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <Package className="w-4 h-4" />
              <span className="font-medium text-xs">产品库</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                if (bill?.customerId && customerQuotations.length > 0) {
                  setFeeSource('quotation')
                  setIsManualEntry(false)
                  setShowQuotationSelect(true)
                }
              }}
              disabled={!bill?.customerId || customerQuotations.length === 0}
              className={`relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                feeSource === 'quotation' && !isManualEntry
                  ? 'bg-purple-50 text-purple-600 border-purple-500 ring-1 ring-purple-500'
                  : (!bill?.customerId || customerQuotations.length === 0)
                    ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                    : 'border-gray-200 text-gray-600 hover:bg-purple-50'
              }`}
            >
              {bill?.customerId && customerQuotations.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
              )}
              <FileText className="w-4 h-4" />
              <span className="font-medium text-xs">报价单 {customerQuotations.length > 0 ? `(${customerQuotations.length})` : ''}</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setFeeSource('manual')
                setIsManualEntry(true)
              }}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                isManualEntry
                  ? 'bg-blue-50 text-blue-600 border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-200 text-gray-600 hover:bg-blue-50'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span className="font-medium text-xs">手动录入</span>
            </button>
          </div>
          
          {/* 费用来源说明 */}
          <div className="text-xs text-gray-500">
            {feeSource === 'product' && !isManualEntry && (
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3 text-green-500" />
                从产品库选择标准费用项，价格自动填充
              </span>
            )}
            {feeSource === 'quotation' && !isManualEntry && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-purple-500" />
                {bill?.customerId 
                  ? customerQuotations.length > 0 
                    ? `该客户有 ${customerQuotations.length} 份已确认报价单可选`
                    : loadingQuotations 
                      ? '正在加载报价单...'
                      : '该客户暂无已确认报价单'
                  : '请先关联订单'
                }
              </span>
            )}
            {feeType === 'payable' && feeSource === 'supplier_price' && !isManualEntry && (
              <span className="flex items-center gap-1">
                <Receipt className="w-3 h-3 text-orange-500" />
                {selectedSupplier 
                  ? supplierPrices.length > 0 
                    ? `该供应商有 ${supplierPrices.length} 个报价项可选`
                    : '该供应商暂无报价数据，请手动录入'
                  : '请先选择供应商'
                }
              </span>
            )}
            {isManualEntry && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                手动录入的新费用项需经理审批后才能成为常规费用
              </span>
            )}
          </div>
        </div>

        {/* 手动录入表单 */}
        {isManualEntry && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Edit3 className="w-4 h-4" />
              手动录入费用
            </div>
            
            {/* 费用分类选择 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">费用分类</label>
              <div className="max-h-[160px] overflow-y-auto space-y-2">
                {feeCategoryGroups.length > 0 ? (
                  feeCategoryGroups.map(group => (
                    <div key={group.parent.value} className="space-y-1">
                      <div className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${group.parent.color}`}>
                        {(() => {
                          const Icon = group.parent.icon
                          return <Icon className="w-3.5 h-3.5" />
                        })()}
                        <span>{group.parent.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 pl-2">
                        {group.children.map(cat => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              setManualCategory(cat.value)
                              if (!manualFeeName) {
                                setManualFeeName(cat.label)
                              }
                            }}
                            className={`flex items-center justify-center px-2 py-1.5 rounded border text-xs transition-all truncate ${
                              manualCategory === cat.value
                                ? `${cat.bg} ${cat.color} border-current font-medium`
                                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {manualCategory === cat.value && <Check className="w-3 h-3 mr-1 flex-shrink-0" />}
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {feeCategories.map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => {
                          setManualCategory(cat.value)
                          if (!manualFeeName) {
                            setManualFeeName(cat.label)
                          }
                        }}
                        className={`flex items-center justify-center px-2 py-1.5 rounded border text-xs ${
                          manualCategory === cat.value
                            ? `${cat.bg} ${cat.color} border-current font-medium`
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">费用名称 *</label>
                <input
                  type="text"
                  value={manualFeeName}
                  onChange={(e) => setManualFeeName(e.target.value)}
                  placeholder="输入费用名称"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">金额 *</label>
                <div className="flex">
                  <select
                    value={manualCurrency}
                    onChange={(e) => setManualCurrency(e.target.value)}
                    className="px-2 py-1.5 text-sm border border-r-0 border-gray-200 rounded-l-lg focus:outline-none bg-gray-50"
                  >
                    <option value="EUR">€</option>
                    <option value="USD">$</option>
                    <option value="CNY">¥</option>
                  </select>
                  <input
                    type="number"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">说明</label>
                <input
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="可选"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            
            <button
              onClick={handleAddManualFee}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              添加到费用列表
            </button>
          </div>
        )}
        
        {/* 费用日期 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">费用日期</label>
          <DatePicker
            value={feeDate}
            onChange={(value) => setFeeDate(value)}
            placeholder="选择日期"
          />
        </div>
      </div>

      {/* 待提交费用列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            追加费用明细
          </h3>
          <div className="flex items-center gap-2">
            {feeType === 'receivable' && (
              <button
                onClick={() => setShowProductSelect(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
              >
                <Plus className="w-3.5 h-3.5" />
                从产品库选择
              </button>
            )}
            {feeType === 'payable' && selectedSupplier && (
              <button
                onClick={() => setShowSupplierPriceSelect(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100"
              >
                <Plus className="w-3.5 h-3.5" />
                从供应商报价选择
              </button>
            )}
          </div>
        </div>

        {pendingFeeItems.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无追加费用</p>
            <p className="text-xs mt-1">
              {feeType === 'receivable' 
                ? '请从产品库、报价单选择或手动录入费用' 
                : '请先选择供应商，然后从供应商报价选择或手动录入费用'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingFeeItems.map((fee, index) => {
              const sourceColors: Record<FeeSourceType, string> = {
                product: 'bg-green-100 text-green-700',
                supplier_price: 'bg-orange-100 text-orange-700',
                quotation: 'bg-purple-100 text-purple-700',
                manual: 'bg-blue-100 text-blue-700'
              }
              const sourceLabels: Record<FeeSourceType, string> = {
                product: '产品库',
                supplier_price: '供应商报价',
                quotation: '报价单',
                manual: '手动录入'
              }
              
              return (
                <div key={fee.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">#{index + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${sourceColors[fee.source]}`}>
                          {sourceLabels[fee.source]}
                        </span>
                        {fee.unit && (
                          <span className="text-xs text-gray-400">单位: {fee.unit}</span>
                        )}
                      </div>
                      <div className="font-medium text-sm text-gray-900">{fee.feeName}</div>
                      {fee.feeNameEn && (
                        <div className="text-xs text-gray-500">{fee.feeNameEn}</div>
                      )}
                      {fee.routeInfo && (
                        <div className="text-xs text-gray-400 mt-0.5">{fee.routeInfo}</div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <div className="flex items-center">
                          <span className="px-2 py-1 text-xs bg-gray-100 border border-r-0 border-gray-200 rounded-l">
                            {fee.currency === 'EUR' ? '€' : fee.currency === 'USD' ? '$' : '¥'}
                          </span>
                          <input
                            type="number"
                            value={fee.amount || ''}
                            onChange={(e) => updatePendingItemAmount(fee.id, parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm text-right border border-gray-200 rounded-r focus:outline-none focus:ring-1 focus:ring-primary-500"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                      
                      <button
                        onClick={() => removePendingItem(fee.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* 汇总 */}
        {pendingFeeItems.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                共 <span className="font-medium text-gray-900">{pendingFeeItems.length}</span> 项费用
              </span>
              <span className={`font-medium ${feeType === 'receivable' ? 'text-green-600' : 'text-orange-600'}`}>
                {feeType === 'receivable' ? '应收' : '应付'}合计：{formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 提交按钮 */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => safeGoBack()}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || pendingFeeItems.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {hasFinancePermission ? '确认添加' : '提交审批'}
            </>
          )}
        </button>
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          追加费用说明
        </h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• 追加费用将关联到原订单，但不会自动添加到已开具的发票中</li>
          {hasFinancePermission ? (
            <>
              <li>• 追加费用需要开具新的追加发票（发票号格式：原发票号-1, 原发票号-2...）</li>
              <li>• 添加后请前往【发票管理】-【新建发票】生成追加发票</li>
            </>
          ) : (
            <>
              <li>• 您添加的追加费用需要经过财务部门审批后才能生效</li>
              <li>• 审批通过后，财务人员会为追加费用开具相应的追加发票</li>
              <li>• 您可以在提单详情的费用管理中查看费用审批状态</li>
            </>
          )}
        </ul>
      </div>

      {/* 产品库选择弹窗 */}
      {showProductSelect && (
        <ProductFeeSelectModal
          products={products}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          loadProductFeeItems={loadProductFeeItems}
          feeCategories={feeCategories}
          weight={bill?.weight || 0}
          volume={bill?.volume || 0}
          onClose={() => setShowProductSelect(false)}
          onSelect={handleAddProductFee}
        />
      )}

      {/* 供应商报价选择弹窗 */}
      {showSupplierPriceSelect && selectedSupplier && (
        <SupplierPriceSelectModal
          supplierName={selectedSupplier.supplierName}
          supplierPrices={supplierPrices}
          feeCategories={feeCategories}
          weight={bill?.weight || 0}
          volume={bill?.volume || 0}
          onClose={() => setShowSupplierPriceSelect(false)}
          onSelect={handleAddSupplierPrice}
        />
      )}

      {/* 报价单选择弹窗 */}
      {showQuotationSelect && (
        <QuotationFeeSelectModal
          quotations={customerQuotations}
          onClose={() => setShowQuotationSelect(false)}
          onSelect={handleAddQuotationFee}
        />
      )}
    </div>
  )
}

// 产品费用选择弹窗组件
function ProductFeeSelectModal({
  products,
  productSearch,
  setProductSearch,
  loadProductFeeItems,
  feeCategories,
  weight,
  volume,
  onClose,
  onSelect
}: {
  products: Product[]
  productSearch: string
  setProductSearch: (value: string) => void
  loadProductFeeItems: (productId: string) => Promise<ProductFeeItem[]>
  feeCategories: FeeCategory[]
  weight: number
  volume: number
  onClose: () => void
  onSelect: (productName: string, feeItem: ProductFeeItem) => void
}) {
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null)
  const [productFeeItemsMap, setProductFeeItemsMap] = useState<Record<string, ProductFeeItem[]>>({})
  const [expandedProducts, setExpandedProducts] = useState<string[]>([])
  
  const filteredProducts = products.filter(p => {
    if (!productSearch) return true
    const search = productSearch.toLowerCase()
    return (
      p.productName?.toLowerCase().includes(search) ||
      p.productCode?.toLowerCase().includes(search)
    )
  })
  
  const handleExpandProduct = async (productId: string) => {
    if (expandedProducts.includes(productId)) {
      setExpandedProducts(prev => prev.filter(id => id !== productId))
      return
    }
    
    setExpandedProducts(prev => [...prev, productId])
    
    if (!productFeeItemsMap[productId]) {
      setLoadingProductId(productId)
      const feeItems = await loadProductFeeItems(productId)
      setProductFeeItemsMap(prev => ({ ...prev, [productId]: feeItems }))
      setLoadingProductId(null)
    }
  }
  
  const calculateAmount = (unitPrice: number, unit: string) => {
    const upperUnit = (unit || '').toUpperCase()
    if (upperUnit === 'KG' && weight > 0) {
      return unitPrice * weight
    } else if (upperUnit === 'CBM' && volume > 0) {
      return unitPrice * volume
    }
    return unitPrice
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            从产品库选择费用项
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="搜索产品名称或编码..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length > 0 ? (
            <div className="space-y-2">
              {filteredProducts.map(product => (
                <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleExpandProduct(product.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">{product.productName}</div>
                      <div className="text-xs text-gray-500">{product.productCode}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                      expandedProducts.includes(product.id) ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {expandedProducts.includes(product.id) && (
                    <div className="border-t border-gray-100 bg-gray-50 p-3">
                      {loadingProductId === product.id ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      ) : productFeeItemsMap[product.id]?.length > 0 ? (
                        <div className="space-y-2">
                          {productFeeItemsMap[product.id].map(feeItem => {
                            const amount = calculateAmount(feeItem.standardPrice, feeItem.unit)
                            return (
                              <div
                                key={feeItem.id}
                                className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-green-300 cursor-pointer"
                                onClick={() => {
                                  onSelect(product.productName, feeItem)
                                }}
                              >
                                <div>
                                  <div className="font-medium text-sm text-gray-900">{feeItem.feeName}</div>
                                  {feeItem.feeNameEn && (
                                    <div className="text-xs text-gray-500">{feeItem.feeNameEn}</div>
                                  )}
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    单位: {feeItem.unit} | 单价: {feeItem.currency} {feeItem.standardPrice}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-sm text-green-600">
                                    {feeItem.currency} {amount.toFixed(2)}
                                  </div>
                                  <button className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 mt-1">
                                    <Plus className="w-3 h-3" />
                                    添加
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-gray-400">
                          该产品暂无费用项
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无匹配的产品</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 供应商报价选择弹窗组件
function SupplierPriceSelectModal({
  supplierName,
  supplierPrices,
  feeCategories,
  weight,
  volume,
  onClose,
  onSelect
}: {
  supplierName: string
  supplierPrices: SupplierPriceItem[]
  feeCategories: FeeCategory[]
  weight: number
  volume: number
  onClose: () => void
  onSelect: (priceItem: SupplierPriceItem) => void
}) {
  const [search, setSearch] = useState('')
  
  const filteredPrices = supplierPrices.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      p.feeName?.toLowerCase().includes(s) ||
      p.feeNameEn?.toLowerCase().includes(s) ||
      p.routeFrom?.toLowerCase().includes(s) ||
      p.routeTo?.toLowerCase().includes(s) ||
      p.city?.toLowerCase().includes(s)
    )
  })
  
  const calculateAmount = (unitPrice: number, unit: string) => {
    const upperUnit = (unit || '').toUpperCase()
    if (upperUnit === 'KG' && weight > 0) {
      return unitPrice * weight
    } else if (upperUnit === 'CBM' && volume > 0) {
      return unitPrice * volume
    }
    return unitPrice
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-orange-600" />
            {supplierName} - 供应商报价
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索费用名称、路线..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPrices.length > 0 ? (
            <div className="space-y-2">
              {filteredPrices.map(priceItem => {
                const amount = calculateAmount(priceItem.price, priceItem.unit)
                const routeParts = []
                if (priceItem.routeFrom) routeParts.push(priceItem.routeFrom)
                if (priceItem.routeTo) routeParts.push(priceItem.routeTo)
                if (priceItem.city) routeParts.push(priceItem.city)
                
                return (
                  <div
                    key={priceItem.id}
                    className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-orange-300 cursor-pointer"
                    onClick={() => onSelect(priceItem)}
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">{priceItem.feeName}</div>
                      {priceItem.feeNameEn && (
                        <div className="text-xs text-gray-500">{priceItem.feeNameEn}</div>
                      )}
                      {routeParts.length > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          路线: {routeParts.join(' → ')}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        单位: {priceItem.unit} | 单价: {priceItem.currency} {priceItem.price}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm text-orange-600">
                        {priceItem.currency} {amount.toFixed(2)}
                      </div>
                      <button className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 mt-1">
                        <Plus className="w-3 h-3" />
                        添加
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无匹配的报价项</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 报价单费用选择弹窗组件
function QuotationFeeSelectModal({
  quotations,
  onClose,
  onSelect
}: {
  quotations: CustomerQuotation[]
  onClose: () => void
  onSelect: (quotation: CustomerQuotation, feeItem: QuotationFeeItem) => void
}) {
  const [expandedQuotation, setExpandedQuotation] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            从报价单选择费用项
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {quotations.length > 0 ? (
            <div className="space-y-2">
              {quotations.map(quotation => (
                <div key={quotation.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedQuotation(
                      expandedQuotation === quotation.id ? null : quotation.id
                    )}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">{quotation.quoteNumber}</div>
                      <div className="text-xs text-gray-500">
                        {quotation.subject} | {quotation.quoteDate} | {quotation.currency} {quotation.totalAmount}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                      expandedQuotation === quotation.id ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {expandedQuotation === quotation.id && (
                    <div className="border-t border-gray-100 bg-gray-50 p-3">
                      {quotation.items?.length > 0 ? (
                        <div className="space-y-2">
                          {quotation.items.map(feeItem => (
                            <div
                              key={feeItem.id}
                              className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-purple-300 cursor-pointer"
                              onClick={() => onSelect(quotation, feeItem)}
                            >
                              <div>
                                <div className="font-medium text-sm text-gray-900">{feeItem.name}</div>
                                {feeItem.description && (
                                  <div className="text-xs text-gray-500">{feeItem.description}</div>
                                )}
                                <div className="text-xs text-gray-400 mt-0.5">
                                  数量: {feeItem.quantity} {feeItem.unit} | 单价: {feeItem.price}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-sm text-purple-600">
                                  {quotation.currency} {feeItem.amount.toFixed(2)}
                                </div>
                                <button className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 mt-1">
                                  <Plus className="w-3 h-3" />
                                  添加
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-gray-400">
                          该报价单暂无费用项
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无已确认的报价单</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
