import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, Package, ChevronRight, ChevronDown, Settings, DollarSign, Loader2, Building2, ArrowRight, Percent, Calculator, X, CheckSquare, Square, RefreshCw, TrendingUp, Download, Sliders } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Product {
  id: string
  productCode: string
  productName: string
  productNameEn: string
  category: string
  description: string
  isActive: boolean
  feeItems?: FeeItem[]
  feeItemCount?: number  // 费用项数量（从列表API返回）
}

interface FeeItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string
  standardPrice: number
  minPrice: number | null
  maxPrice: number | null
  currency: string
  isRequired: boolean
  description: string
  // 供应商关联和利润设置
  supplierId?: string | null
  supplierPriceId?: number | null
  supplierName?: string | null
  costPrice?: number | null
  profitType?: 'amount' | 'rate'
  profitValue?: number
  billingType?: 'fixed' | 'actual'  // 计费类型: fixed=固定价格, actual=按实际收费
}

interface Supplier {
  id: string
  supplierCode: string
  supplierName: string
}

interface SupplierPrice {
  id: number
  supplierId: string
  supplierName?: string
  name: string
  nameEn: string
  category: string
  unit: string
  unitPrice: number
  currency: string
  routeFrom?: string
  routeTo?: string
}

// 服务费类别接口（从基础数据获取）
interface ServiceFeeCategory {
  id: string
  name: string
  code: string
  description?: string
  sortOrder?: number
  status: string
}

// 费用分类映射 - 支持多种格式：小写英文、中文、大写英文
const FEE_CATEGORIES: Record<string, { label: string; color: string }> = {
  // 小写英文代码
  freight: { label: '运费', color: 'bg-blue-100 text-blue-700' },
  customs: { label: '关税', color: 'bg-red-100 text-red-700' },
  warehouse: { label: '仓储', color: 'bg-orange-100 text-orange-700' },
  insurance: { label: '保险', color: 'bg-green-100 text-green-700' },
  handling: { label: '操作', color: 'bg-purple-100 text-purple-700' },
  documentation: { label: '文件', color: 'bg-cyan-100 text-cyan-700' },
  duty: { label: '关税', color: 'bg-red-100 text-red-700' },
  tax: { label: '税费', color: 'bg-amber-100 text-amber-700' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700' },
  // 大写英文代码
  'TRANSPORT': { label: '运输', color: 'bg-blue-100 text-blue-700' },
  'WAREHOUSE': { label: '仓储', color: 'bg-orange-100 text-orange-700' },
  'CLEARANCE': { label: '清关', color: 'bg-purple-100 text-purple-700' },
  'DOCUMENT FEES': { label: '文件', color: 'bg-cyan-100 text-cyan-700' },
  'DOCUMENT EXCHANGE FEE': { label: '换单', color: 'bg-cyan-100 text-cyan-700' },
  'THC': { label: 'THC', color: 'bg-orange-100 text-orange-700' },
  'TAX FEES': { label: '税费', color: 'bg-amber-100 text-amber-700' },
  "IMPORTER'S AGENCY FEE": { label: '代理费', color: 'bg-indigo-100 text-indigo-700' },
  'MANAGEMENT FEE': { label: '管理费', color: 'bg-gray-100 text-gray-700' },
  'OTHER': { label: '其他', color: 'bg-gray-100 text-gray-700' },
  'EXPORT CUSTOMS CLEARANCE SERVICES': { label: '出口报关', color: 'bg-purple-100 text-purple-700' },
  // 中文分类名称
  '运输服务': { label: '运输', color: 'bg-blue-100 text-blue-700' },
  '清关服务': { label: '清关', color: 'bg-purple-100 text-purple-700' },
  '仓储服务': { label: '仓储', color: 'bg-orange-100 text-orange-700' },
  '文件费': { label: '文件', color: 'bg-cyan-100 text-cyan-700' },
  '换单费': { label: '换单', color: 'bg-cyan-100 text-cyan-700' },
  '港杂费': { label: 'THC', color: 'bg-orange-100 text-orange-700' },
  '税务费': { label: '税费', color: 'bg-amber-100 text-amber-700' },
  '进口商代理费': { label: '代理费', color: 'bg-indigo-100 text-indigo-700' },
  '管理费': { label: '管理费', color: 'bg-gray-100 text-gray-700' },
  '其他服务': { label: '其他', color: 'bg-gray-100 text-gray-700' },
  '出口报关服务': { label: '出口报关', color: 'bg-purple-100 text-purple-700' }
}

export default function ProductPricing() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  
  // 服务类别（从基础数据获取）
  const [serviceCategories, setServiceCategories] = useState<ServiceFeeCategory[]>([])
  
  // 模态框状态
  const [showProductModal, setShowProductModal] = useState(false)
  const [showFeeItemModal, setShowFeeItemModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingFeeItem, setEditingFeeItem] = useState<FeeItem | null>(null)
  const [currentProductId, setCurrentProductId] = useState<string | null>(null)
  
  // 表单数据
  const [productForm, setProductForm] = useState({
    productName: '',
    productNameEn: '',
    category: '',
    description: '',
    isActive: true
  })
  
  const [feeItemForm, setFeeItemForm] = useState({
    feeName: '',
    feeNameEn: '',
    feeCategory: 'other',
    unit: '',
    standardPrice: '',
    minPrice: '',
    maxPrice: '',
    currency: 'EUR',
    isRequired: false,
    description: '',
    // 供应商关联和利润设置
    supplierId: '' as string,
    supplierPriceId: null as number | null,
    supplierName: '' as string,
    costPrice: '' as string | number,
    profitType: 'amount' as 'amount' | 'rate',
    profitValue: '' as string | number,
    billingType: 'fixed' as 'fixed' | 'actual'  // 计费类型
  })
  
  const [submitting, setSubmitting] = useState(false)
  
  // 翻译相关状态（产品名称）
  const [isTranslatingName, setIsTranslatingName] = useState(false)
  const translateTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 翻译相关状态（费用项名称）
  const [isTranslatingFeeName, setIsTranslatingFeeName] = useState(false)
  const feeNameTranslateTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 翻译中文名称为英文
  const translateToEnglish = useCallback(async (chineseText: string) => {
    if (!chineseText.trim()) {
      setProductForm(prev => ({ ...prev, productNameEn: '' }))
      return
    }
    
    setIsTranslatingName(true)
    try {
      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chineseText, from: 'zh-CN', to: 'en' })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data?.translatedText) {
          setProductForm(prev => ({ ...prev, productNameEn: data.data.translatedText }))
        }
      }
    } catch (error) {
      console.error('翻译失败:', error)
    } finally {
      setIsTranslatingName(false)
    }
  }, [])
  
  // 处理产品名称变化（带防抖的自动翻译）
  const handleProductNameChange = useCallback((value: string) => {
    setProductForm(prev => ({ ...prev, productName: value }))
    
    // 清除之前的定时器
    if (translateTimerRef.current) {
      clearTimeout(translateTimerRef.current)
    }
    
    // 设置新的防抖定时器（500ms 后触发翻译）
    translateTimerRef.current = setTimeout(() => {
      translateToEnglish(value)
    }, 500)
  }, [translateToEnglish])
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (translateTimerRef.current) {
        clearTimeout(translateTimerRef.current)
      }
      if (feeNameTranslateTimerRef.current) {
        clearTimeout(feeNameTranslateTimerRef.current)
      }
    }
  }, [])
  
  // 翻译费用项中文名称为英文
  const translateFeeNameToEnglish = useCallback(async (chineseText: string) => {
    if (!chineseText.trim()) {
      setFeeItemForm(prev => ({ ...prev, feeNameEn: '' }))
      return
    }
    
    setIsTranslatingFeeName(true)
    try {
      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chineseText, from: 'zh-CN', to: 'en' })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data?.translatedText) {
          setFeeItemForm(prev => ({ ...prev, feeNameEn: data.data.translatedText }))
        }
      }
    } catch (error) {
      console.error('翻译费用项名称失败:', error)
    } finally {
      setIsTranslatingFeeName(false)
    }
  }, [])
  
  // 处理费用项名称输入变化（带防抖翻译）
  const handleFeeNameChange = useCallback((value: string) => {
    setFeeItemForm(prev => ({ ...prev, feeName: value }))
    
    // 清除之前的定时器
    if (feeNameTranslateTimerRef.current) {
      clearTimeout(feeNameTranslateTimerRef.current)
    }
    
    // 设置新的防抖定时器（500ms 后触发翻译）
    feeNameTranslateTimerRef.current = setTimeout(() => {
      translateFeeNameToEnglish(value)
    }, 500)
  }, [translateFeeNameToEnglish])
  
  // 供应商选择相关状态
  const [showSupplierPicker, setShowSupplierPicker] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierPrices, setSupplierPrices] = useState<SupplierPrice[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [priceSearch, setPriceSearch] = useState('')
  
  // 销售价格向上取整到50的倍数（仅主运输费用）
  const roundSalesPriceTo50 = (price: number, feeCategory?: string, feeName?: string): number => {
    if (!price || price <= 0) return price
    
    // 只有以下主运输费用才取整（按费用名称匹配）
    const transportFeeNames = [
      '提柜送仓费', '提柜费', '送仓费', '运输费', '配送费',
      'Container Pickup & Delivery', 'Delivery Fee', 'Transport Fee'
    ]
    const isMainTransportFee = transportFeeNames.some(name => 
      feeName?.toLowerCase?.()?.includes(name.toLowerCase())
    )
    
    if (!isMainTransportFee) return price  // 非主运输费用保持原价
    
    return Math.ceil(price / 50) * 50
  }
  
  // 计算销售价格（运输费用自动取整到50的倍数）
  const calculatedPrice = useMemo(() => {
    const cost = parseFloat(String(feeItemForm.costPrice)) || 0
    const profit = parseFloat(String(feeItemForm.profitValue)) || 0
    
    if (cost <= 0) return null
    
    let rawPrice: number
    if (feeItemForm.profitType === 'rate') {
      rawPrice = cost * (1 + profit / 100)
    } else {
      rawPrice = cost + profit
    }
    // 销售价向上取整到50的倍数（仅主运输费用）
    return roundSalesPriceTo50(rawPrice, feeItemForm.feeCategory, feeItemForm.feeName)
  }, [feeItemForm.costPrice, feeItemForm.profitType, feeItemForm.profitValue, feeItemForm.feeCategory, feeItemForm.feeName])
  
  // 计算未取整的原始价格（用于显示）
  const rawCalculatedPrice = useMemo(() => {
    const cost = parseFloat(String(feeItemForm.costPrice)) || 0
    const profit = parseFloat(String(feeItemForm.profitValue)) || 0
    
    if (cost <= 0) return null
    
    if (feeItemForm.profitType === 'rate') {
      return cost * (1 + profit / 100)
    }
    return cost + profit
  }, [feeItemForm.costPrice, feeItemForm.profitType, feeItemForm.profitValue])

  // ==================== 批量操作状态 ====================
  const [selectedFeeItems, setSelectedFeeItems] = useState<number[]>([])
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [showBatchProfitModal, setShowBatchProfitModal] = useState(false)
  const [showBatchAdjustModal, setShowBatchAdjustModal] = useState(false)
  const [showBatchImportModal, setShowBatchImportModal] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  
  // 批量设置利润表单
  const [batchProfitForm, setBatchProfitForm] = useState({
    profitType: 'amount' as 'amount' | 'rate',
    profitValue: ''
  })
  
  // 批量调价表单
  const [batchAdjustForm, setBatchAdjustForm] = useState({
    adjustType: 'percent' as 'percent' | 'amount',
    adjustValue: ''
  })
  
  // 批量导入表单
  const [batchImportForm, setBatchImportForm] = useState({
    profitType: 'amount' as 'amount' | 'rate',
    profitValue: ''
  })
  const [selectedImportPrices, setSelectedImportPrices] = useState<number[]>([])

  const tabs = [
    { key: 'product-pricing', label: '产品定价', path: '/tools/product-pricing' },
    { key: 'supplier-pricing', label: '供应商报价', path: '/suppliers/prices' },
    { key: 'import', label: '智能导入', path: '/suppliers/import' }
  ]

  useEffect(() => {
    loadProducts()
  }, [search, category])

  // 加载服务类别（从基础数据）
  useEffect(() => {
    loadServiceCategories()
  }, [])

  const loadServiceCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/service-fee-categories?status=active`)
      const data = await response.json()
      if (data.errCode === 200) {
        setServiceCategories(data.data || [])
      }
    } catch (error) {
      console.error('加载服务类别失败:', error)
    }
  }

  // 加载供应商列表
  const loadSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/active`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSuppliers(data.data || [])
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error)
    } finally {
      setLoadingSuppliers(false)
    }
  }

  // 加载供应商报价
  const loadSupplierPrices = async (supplierId: string) => {
    setLoadingPrices(true)
    try {
      const response = await fetch(`${API_BASE}/api/suppliers/${supplierId}/prices`)
      const data = await response.json()
      if (data.errCode === 200) {
        // 兼容两种返回格式：data.data.list 或 data.data（直接数组）
        const list = data.data?.list || (Array.isArray(data.data) ? data.data : [])
        setSupplierPrices(list)
      }
    } catch (error) {
      console.error('加载供应商报价失败:', error)
    } finally {
      setLoadingPrices(false)
    }
  }

  // 打开供应商选择器
  const handleOpenSupplierPicker = () => {
    loadSuppliers()
    setShowSupplierPicker(true)
    setSelectedSupplier(null)
    setSupplierPrices([])
    setSupplierSearch('')
    setPriceSearch('')
  }

  // 选择供应商
  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    loadSupplierPrices(supplier.id)
  }

  // 选择供应商报价
  const handleSelectSupplierPrice = (price: SupplierPrice) => {
    setFeeItemForm(prev => ({
      ...prev,
      feeName: prev.feeName || price.name,
      feeNameEn: prev.feeNameEn || price.nameEn,
      unit: prev.unit || price.unit,
      currency: price.currency || 'EUR',
      supplierId: price.supplierId,
      supplierPriceId: price.id,
      supplierName: selectedSupplier?.supplierName || price.supplierName || '',
      costPrice: price.unitPrice,
      // 如果还没有设置销售价，默认设为成本价
      standardPrice: prev.standardPrice || String(price.unitPrice)
    }))
    setShowSupplierPicker(false)
  }

  // 清除供应商关联
  const handleClearSupplier = () => {
    setFeeItemForm(prev => ({
      ...prev,
      supplierId: '',
      supplierPriceId: null,
      supplierName: '',
      costPrice: '',
      profitType: 'amount',
      profitValue: ''
    }))
  }

  // ==================== 批量操作函数 ====================
  
  // 选择/取消选择费用项
  const handleToggleFeeItem = (feeItemId: number) => {
    setSelectedFeeItems(prev => 
      prev.includes(feeItemId) 
        ? prev.filter(id => id !== feeItemId)
        : [...prev, feeItemId]
    )
  }

  // 全选/取消全选当前产品的费用项
  const handleSelectAllFeeItems = (feeItems: FeeItem[]) => {
    const feeItemIds = feeItems.map(f => f.id)
    const allSelected = feeItemIds.every(id => selectedFeeItems.includes(id))
    
    if (allSelected) {
      setSelectedFeeItems(prev => prev.filter(id => !feeItemIds.includes(id)))
    } else {
      setSelectedFeeItems(prev => [...new Set([...prev, ...feeItemIds])])
    }
  }

  // 批量同步成本
  const handleBatchSyncCost = async () => {
    if (selectedFeeItems.length === 0) {
      alert('请先选择要同步的费用项')
      return
    }
    
    if (!confirm(`确定要同步 ${selectedFeeItems.length} 个费用项的成本价吗？\n将从关联的供应商报价获取最新成本。`)) {
      return
    }
    
    setBatchLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/products/fee-items/batch-sync-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeItemIds: selectedFeeItems })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功同步 ${data.data.updated} 项，失败 ${data.data.failed} 项`)
        setSelectedFeeItems([])
        if (currentProductId) {
          loadProductFeeItems(currentProductId)
        }
      } else {
        alert(data.msg || '同步失败')
      }
    } catch (error) {
      console.error('批量同步成本失败:', error)
      alert('同步失败')
    } finally {
      setBatchLoading(false)
      setShowBatchMenu(false)
    }
  }

  // 批量设置利润
  const handleBatchSetProfit = async () => {
    if (selectedFeeItems.length === 0) {
      alert('请先选择要设置的费用项')
      return
    }
    
    setBatchLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/products/fee-items/batch-set-profit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeItemIds: selectedFeeItems,
          profitType: batchProfitForm.profitType,
          profitValue: parseFloat(batchProfitForm.profitValue) || 0
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功设置 ${data.data.updated} 项利润`)
        setSelectedFeeItems([])
        setShowBatchProfitModal(false)
        setBatchProfitForm({ profitType: 'amount', profitValue: '' })
        if (currentProductId) {
          loadProductFeeItems(currentProductId)
        }
      } else {
        alert(data.msg || '设置失败')
      }
    } catch (error) {
      console.error('批量设置利润失败:', error)
      alert('设置失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 批量调价
  const handleBatchAdjustPrice = async () => {
    if (selectedFeeItems.length === 0) {
      alert('请先选择要调价的费用项')
      return
    }
    
    setBatchLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/products/fee-items/batch-adjust-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeItemIds: selectedFeeItems,
          adjustType: batchAdjustForm.adjustType,
          adjustValue: parseFloat(batchAdjustForm.adjustValue) || 0
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功调整 ${data.data.updated} 项价格`)
        setSelectedFeeItems([])
        setShowBatchAdjustModal(false)
        setBatchAdjustForm({ adjustType: 'percent', adjustValue: '' })
        if (currentProductId) {
          loadProductFeeItems(currentProductId)
        }
      } else {
        alert(data.msg || '调价失败')
      }
    } catch (error) {
      console.error('批量调价失败:', error)
      alert('调价失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 批量重新取整（更新旧数据）
  const handleBatchRecalculateRounding = async () => {
    if (selectedFeeItems.length === 0) {
      alert('请先选择要重新取整的费用项')
      return
    }
    
    if (!confirm(`确定要对选中的 ${selectedFeeItems.length} 项重新应用取整规则吗？\n\n这将把销售价向上取整到50的倍数。`)) {
      return
    }
    
    setBatchLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/products/fee-items/batch-recalculate-rounding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeItemIds: selectedFeeItems
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功更新 ${data.data.updated} 项价格取整`)
        setSelectedFeeItems([])
        if (currentProductId) {
          loadProductFeeItems(currentProductId)
        }
      } else {
        alert(data.msg || '重新取整失败')
      }
    } catch (error) {
      console.error('批量重新取整失败:', error)
      alert('重新取整失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 批量导入
  const handleBatchImport = async () => {
    if (selectedImportPrices.length === 0) {
      alert('请先选择要导入的供应商报价')
      return
    }
    
    if (!currentProductId) {
      alert('请先选择目标产品')
      return
    }
    
    setBatchLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/products/${currentProductId}/fee-items/batch-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierPriceIds: selectedImportPrices,
          profitType: batchImportForm.profitType,
          profitValue: parseFloat(batchImportForm.profitValue) || 0
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功导入 ${data.data.imported} 项`)
        setSelectedImportPrices([])
        setShowBatchImportModal(false)
        setBatchImportForm({ profitType: 'amount', profitValue: '' })
        loadProductFeeItems(currentProductId)
      } else {
        alert(data.msg || '导入失败')
      }
    } catch (error) {
      console.error('批量导入失败:', error)
      alert('导入失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 打开批量导入弹窗
  const handleOpenBatchImport = (productId: string) => {
    setCurrentProductId(productId)
    loadSuppliers()
    setShowBatchImportModal(true)
    setSelectedSupplier(null)
    setSupplierPrices([])
    setSelectedImportPrices([])
  }

  // 切换导入选择
  const handleToggleImportPrice = (priceId: number) => {
    setSelectedImportPrices(prev =>
      prev.includes(priceId)
        ? prev.filter(id => id !== priceId)
        : [...prev, priceId]
    )
  }

  // 全选导入
  const handleSelectAllImportPrices = () => {
    const allIds = supplierPrices.map(p => p.id)
    const allSelected = allIds.every(id => selectedImportPrices.includes(id))
    setSelectedImportPrices(allSelected ? [] : allIds)
  }

  const loadProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (category) params.append('category', category)
      params.append('pageSize', '100')
      
      const response = await fetch(`${API_BASE}/api/products?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setProducts(data.data?.list || [])
      }
    } catch (error) {
      console.error('加载产品列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProductFeeItems = async (productId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        setProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, feeItems: data.data.feeItems } : p
        ))
      }
    } catch (error) {
      console.error('加载费用项失败:', error)
    }
  }

  const handleExpandProduct = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null)
    } else {
      setExpandedProduct(productId)
      const product = products.find(p => p.id === productId)
      if (product && !product.feeItems) {
        await loadProductFeeItems(productId)
      }
    }
  }

  // 产品操作
  const handleAddProduct = () => {
    setEditingProduct(null)
    setProductForm({
      productName: '',
      productNameEn: '',
      category: '',
      description: '',
      isActive: true
    })
    setShowProductModal(true)
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      productName: product.productName,
      productNameEn: product.productNameEn || '',
      category: product.category || '',
      description: product.description || '',
      isActive: product.isActive
    })
    setShowProductModal(true)
  }

  const handleSaveProduct = async () => {
    if (!productForm.productName.trim()) {
      alert('请输入产品名称')
      return
    }
    
    setSubmitting(true)
    try {
      const url = editingProduct 
        ? `${API_BASE}/api/products/${editingProduct.id}`
        : `${API_BASE}/api/products`
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowProductModal(false)
        loadProducts()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存产品失败:', error)
      alert('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('确定要删除此产品吗？关联的费用项也会被删除。')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadProducts()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除产品失败:', error)
      alert('删除失败')
    }
  }

  // 费用项操作
  const handleAddFeeItem = (productId: string) => {
    setCurrentProductId(productId)
    setEditingFeeItem(null)
    setFeeItemForm({
      feeName: '',
      feeNameEn: '',
      feeCategory: 'other',
      unit: '',
      standardPrice: '',
      minPrice: '',
      maxPrice: '',
      currency: 'EUR',
      isRequired: false,
      description: '',
      supplierId: '',
      supplierPriceId: null,
      supplierName: '',
      costPrice: '',
      profitType: 'amount',
      profitValue: ''
    })
    setShowFeeItemModal(true)
  }

  const handleEditFeeItem = (productId: string, feeItem: FeeItem) => {
    setCurrentProductId(productId)
    setEditingFeeItem(feeItem)
    setFeeItemForm({
      feeName: feeItem.feeName,
      feeNameEn: feeItem.feeNameEn || '',
      feeCategory: feeItem.feeCategory || 'other',
      unit: feeItem.unit || '',
      standardPrice: String(feeItem.standardPrice || ''),
      minPrice: feeItem.minPrice ? String(feeItem.minPrice) : '',
      maxPrice: feeItem.maxPrice ? String(feeItem.maxPrice) : '',
      currency: feeItem.currency || 'EUR',
      isRequired: feeItem.isRequired,
      description: feeItem.description || '',
      supplierId: feeItem.supplierId || '',
      supplierPriceId: feeItem.supplierPriceId || null,
      supplierName: feeItem.supplierName || '',
      costPrice: feeItem.costPrice || '',
      profitType: feeItem.profitType || 'amount',
      profitValue: feeItem.profitValue || '',
      billingType: feeItem.billingType || 'fixed'
    })
    setShowFeeItemModal(true)
  }

  const handleSaveFeeItem = async () => {
    if (!feeItemForm.feeName.trim()) {
      alert('请输入费用名称')
      return
    }
    
    // 计算最终价格
    const finalPrice = calculatedPrice !== null ? calculatedPrice : (parseFloat(String(feeItemForm.standardPrice)) || 0)
    
    // 固定价格类型必须输入价格
    if (feeItemForm.billingType === 'fixed' && finalPrice <= 0) {
      alert('固定价格类型必须输入价格')
      return
    }
    
    setSubmitting(true)
    try {
      const url = editingFeeItem
        ? `${API_BASE}/api/products/fee-items/${editingFeeItem.id}`
        : `${API_BASE}/api/products/${currentProductId}/fee-items`
      
      const response = await fetch(url, {
        method: editingFeeItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feeItemForm,
          standardPrice: finalPrice,
          minPrice: feeItemForm.minPrice ? parseFloat(String(feeItemForm.minPrice)) : null,
          maxPrice: feeItemForm.maxPrice ? parseFloat(String(feeItemForm.maxPrice)) : null,
          costPrice: feeItemForm.costPrice ? parseFloat(String(feeItemForm.costPrice)) : null,
          profitValue: feeItemForm.profitValue ? parseFloat(String(feeItemForm.profitValue)) : 0
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowFeeItemModal(false)
        if (currentProductId) {
          loadProductFeeItems(currentProductId)
        }
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存费用项失败:', error)
      alert('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteFeeItem = async (feeItemId: number, productId: string) => {
    if (!confirm('确定要删除此费用项吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/products/fee-items/${feeItemId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadProductFeeItems(productId)
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除费用项失败:', error)
      alert('删除失败')
    }
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="报价管理"
        tabs={tabs}
        activeTab="/tools/product-pricing"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索产品名称或编码..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部分类</option>
            {serviceCategories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加产品
          </button>
        </div>
      </div>

      {/* 产品列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无产品</p>
            <button
              onClick={handleAddProduct}
              className="mt-3 text-primary-600 hover:text-primary-700 text-sm"
            >
              点击添加第一个产品
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {products.map(product => (
              <div key={product.id} className="group">
                {/* 产品行 */}
                <div
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleExpandProduct(product.id)}
                >
                  <div className="flex items-center gap-3">
                    <button className="text-gray-400">
                      {expandedProduct === product.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{product.productName}</span>
                        <span className="text-xs text-gray-400">{product.productCode}</span>
                        {!product.isActive && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            已停用
                          </span>
                        )}
                      </div>
                      {product.productNameEn && (
                        <div className="text-xs text-gray-500">{product.productNameEn}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {product.category 
                          ? (serviceCategories.find(c => c.code === product.category || c.name === product.category)?.name || product.category)
                          : '未分类'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {product.feeItemCount ?? product.feeItems?.length ?? 0} 个费用项
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditProduct(product) }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="编辑产品"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="删除产品"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 费用项列表 */}
                {expandedProduct === product.id && (
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
                    <div className="ml-8">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          费用项配置
                        </h4>
                        <div className="flex items-center gap-2">
                          {/* 批量操作按钮 - 始终显示 */}
                          <div className="relative">
                            <button
                              onClick={() => {
                                setCurrentProductId(product.id)
                                setShowBatchMenu(!showBatchMenu)
                              }}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1 border border-gray-300"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              批量操作
                              {selectedFeeItems.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                                  {selectedFeeItems.length}
                                </span>
                              )}
                            </button>
                            {showBatchMenu && currentProductId === product.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                <button
                                  onClick={handleBatchSyncCost}
                                  disabled={selectedFeeItems.length === 0 || batchLoading}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                >
                                  <RefreshCw className="w-4 h-4 text-blue-600" />
                                  同步成本价
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedFeeItems.length === 0) {
                                      alert('请先选择费用项')
                                      return
                                    }
                                    setShowBatchProfitModal(true)
                                    setShowBatchMenu(false)
                                  }}
                                  disabled={selectedFeeItems.length === 0}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                >
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                  设置利润
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedFeeItems.length === 0) {
                                      alert('请先选择费用项')
                                      return
                                    }
                                      setShowBatchAdjustModal(true)
                                      setShowBatchMenu(false)
                                    }}
                                    disabled={selectedFeeItems.length === 0}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    <Percent className="w-4 h-4 text-orange-600" />
                                    批量调价
                                  </button>
                                  <div className="border-t border-gray-100 my-1" />
                                  <button
                                    onClick={() => {
                                      handleOpenBatchImport(product.id)
                                      setShowBatchMenu(false)
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Download className="w-4 h-4 text-purple-600" />
                                    从供应商导入
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleBatchRecalculateRounding()
                                      setShowBatchMenu(false)
                                    }}
                                    disabled={selectedFeeItems.length === 0 || batchLoading}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    <RefreshCw className="w-4 h-4 text-cyan-600" />
                                    重新取整
                                  </button>
                                </div>
                              )}
                            </div>
                        <button
                          onClick={() => handleAddFeeItem(product.id)}
                          className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          添加费用项
                        </button>
                        </div>
                      </div>
                      
                      {product.feeItems && product.feeItems.length > 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="w-8 px-2 py-2">
                                  <button
                                    onClick={() => handleSelectAllFeeItems(product.feeItems || [])}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="全选/取消全选"
                                  >
                                    {product.feeItems?.every(f => selectedFeeItems.includes(f.id)) 
                                      ? <CheckSquare className="w-4 h-4 text-primary-600" />
                                      : <Square className="w-4 h-4" />
                                    }
                                  </button>
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">费用名称</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">类别</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">单位</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">成本价</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">销售价</th>
                                <th className="text-center px-3 py-2 font-medium text-gray-600">必选</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.feeItems.map(item => (
                                <tr key={item.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedFeeItems.includes(item.id) ? 'bg-primary-50' : ''}`}>
                                  <td className="w-8 px-2 py-2">
                                    <button
                                      onClick={() => handleToggleFeeItem(item.id)}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      {selectedFeeItems.includes(item.id) 
                                        ? <CheckSquare className="w-4 h-4 text-primary-600" />
                                        : <Square className="w-4 h-4" />
                                      }
                                    </button>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-gray-900">{item.feeName}</div>
                                    {item.feeNameEn && (
                                      <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                                    )}
                                    {item.supplierName && (
                                      <div className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                        <Building2 className="w-3 h-3" />
                                        {item.supplierName}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                                      FEE_CATEGORIES[item.feeCategory]?.color || FEE_CATEGORIES.other.color
                                    }`}>
                                      {FEE_CATEGORIES[item.feeCategory]?.label || '其他'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{item.unit || '-'}</td>
                                  <td className="px-3 py-2 text-right">
                                    {item.costPrice ? (
                                      <span className="text-gray-600">
                                        {item.currency} {item.costPrice?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {item.billingType === 'actual' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                                        按实际
                                      </span>
                                    ) : (
                                      <>
                                    <span className="font-medium text-gray-900">
                                      {item.currency} {item.standardPrice?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                    </span>
                                        {item.costPrice && item.profitValue ? (
                                          <div className="text-xs text-green-600">
                                            +{item.profitType === 'rate' ? `${item.profitValue}%` : `${item.profitValue}`}
                                      </div>
                                        ) : null}
                                      </>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {item.isRequired ? (
                                      <span className="text-green-600">✓</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => handleEditFeeItem(product.id, item)}
                                      className="p-1 text-gray-400 hover:text-primary-600"
                                      title="编辑"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFeeItem(item.id, product.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 ml-1"
                                      title="删除"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">暂无费用项</p>
                          <button
                            onClick={() => handleAddFeeItem(product.id)}
                            className="mt-2 text-primary-600 hover:text-primary-700 text-sm"
                          >
                            添加第一个费用项
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 产品编辑模态框 */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {editingProduct ? '编辑产品' : '添加产品'}
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.productName}
                  onChange={(e) => handleProductNameChange(e.target.value)}
                  placeholder="如：整柜海运"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-2">
                  英文名称
                  {isTranslatingName && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      翻译中...
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={productForm.productNameEn}
                  onChange={(e) => setProductForm(prev => ({ ...prev, productNameEn: e.target.value }))}
                  placeholder="如：FCL Ocean Freight（自动翻译）"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">服务类别</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">请选择服务类别</option>
                  {serviceCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="产品描述..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">启用此产品</label>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 费用项编辑模态框 */}
      {showFeeItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFeeItemModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {editingFeeItem ? '编辑费用项' : '添加费用项'}
              </h3>
            </div>
            
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 供应商关联区域 */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-blue-800 flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    从供应商报价获取成本
                  </label>
                  {feeItemForm.supplierId ? (
                    <button
                      type="button"
                      onClick={handleClearSupplier}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      清除关联
                    </button>
                  ) : null}
                </div>
                
                {feeItemForm.supplierId && feeItemForm.costPrice ? (
                  <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-blue-200">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{feeItemForm.supplierName}</div>
                      <div className="text-xs text-gray-500">
                        成本价: <span className="font-medium text-blue-600">{feeItemForm.currency} {Number(feeItemForm.costPrice).toFixed(2)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenSupplierPicker}
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded"
                    >
                      更换
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenSupplierPicker}
                    className="w-full px-3 py-2 text-sm text-blue-600 bg-white border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    选择供应商报价
                  </button>
                )}
                
                {/* 利润设置 - 只有选择了供应商后才显示 */}
                {feeItemForm.supplierId && feeItemForm.costPrice && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <label className="block text-xs font-medium text-blue-800 mb-2">
                      <Calculator className="w-3.5 h-3.5 inline mr-1" />
                      利润设置
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">利润类型</label>
                        <select
                          value={feeItemForm.profitType}
                          onChange={(e) => setFeeItemForm(prev => ({ ...prev, profitType: e.target.value as 'amount' | 'rate' }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="amount">固定利润额</option>
                          <option value="rate">利润率 (%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          {feeItemForm.profitType === 'rate' ? '利润率' : '利润额'}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={feeItemForm.profitValue}
                            onChange={(e) => setFeeItemForm(prev => ({ ...prev, profitValue: e.target.value }))}
                            placeholder={feeItemForm.profitType === 'rate' ? '如：20' : '如：50'}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {feeItemForm.profitType === 'rate' && (
                            <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* 计算结果预览 */}
                    {calculatedPrice !== null && rawCalculatedPrice !== null && (
                      <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            销售价{calculatedPrice !== rawCalculatedPrice ? '（已取整）' : ''}:
                          </span>
                          <span className="font-semibold text-green-700">
                            {feeItemForm.currency} {calculatedPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {Number(feeItemForm.costPrice).toFixed(2)} 
                          {feeItemForm.profitType === 'rate' 
                            ? ` × (1 + ${feeItemForm.profitValue || 0}%)` 
                            : ` + ${feeItemForm.profitValue || 0}`
                          }
                          = {rawCalculatedPrice.toFixed(2)}
                          {calculatedPrice !== rawCalculatedPrice && (
                            <span className="text-blue-600"> → 取整为 {calculatedPrice.toFixed(2)}（主运输费）</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    费用名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={feeItemForm.feeName}
                    onChange={(e) => handleFeeNameChange(e.target.value)}
                    placeholder="如：海运费"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    英文名称
                    {isTranslatingFeeName && (
                      <span className="ml-2 text-xs text-blue-500">翻译中...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={feeItemForm.feeNameEn}
                    readOnly
                    placeholder={isTranslatingFeeName ? "翻译中..." : "自动翻译"}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">费用类别</label>
                  <select
                    value={feeItemForm.feeCategory}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, feeCategory: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">请选择类别</option>
                    {serviceCategories.map((cat) => (
                      <option key={cat.id} value={cat.code}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">计费单位</label>
                  <input
                    type="text"
                    value={feeItemForm.unit}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="如：柜、票、件"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              {/* 计费类型 */}
                <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">计费类型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billingType"
                      value="fixed"
                      checked={feeItemForm.billingType === 'fixed'}
                      onChange={(e) => setFeeItemForm(prev => ({ ...prev, billingType: e.target.value as 'fixed' | 'actual' }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">固定价格</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billingType"
                      value="actual"
                      checked={feeItemForm.billingType === 'actual'}
                      onChange={(e) => setFeeItemForm(prev => ({ ...prev, billingType: e.target.value as 'fixed' | 'actual' }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">按实际收费</span>
                  </label>
                </div>
                {feeItemForm.billingType === 'actual' && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ 按实际收费项目将根据实际发生金额计费</p>
                )}
              </div>
              
              {/* 价格行 */}
              <div className="grid grid-cols-4 gap-4">
                {/* 货币 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">货币</label>
                    <select
                      value={feeItemForm.currency}
                      onChange={(e) => setFeeItemForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="EUR">EUR</option>
                      <option value="CNY">CNY</option>
                      <option value="USD">USD</option>
                    </select>
                </div>
                {/* 标准价格 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {feeItemForm.costPrice ? '销售价格' : '标准价格'}
                  </label>
                    <input
                      type="number"
                      step="0.01"
                    value={calculatedPrice !== null ? calculatedPrice.toFixed(2) : feeItemForm.standardPrice}
                      onChange={(e) => setFeeItemForm(prev => ({ ...prev, standardPrice: e.target.value }))}
                      placeholder="0.00"
                    disabled={!!feeItemForm.costPrice}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      feeItemForm.costPrice ? 'bg-gray-100 text-gray-600' : ''
                    }`}
                    />
                  {feeItemForm.costPrice && (
                    <p className="text-xs text-gray-500 mt-1">自动计算</p>
                  )}
                  </div>
                {/* 最低价 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">最低价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeItemForm.minPrice}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, minPrice: e.target.value }))}
                    placeholder="可选"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {/* 最高价 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">最高价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeItemForm.maxPrice}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, maxPrice: e.target.value }))}
                    placeholder="可选"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                <input
                  type="text"
                  value={feeItemForm.description}
                  onChange={(e) => setFeeItemForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="费用项说明..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={feeItemForm.isRequired}
                  onChange={(e) => setFeeItemForm(prev => ({ ...prev, isRequired: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="isRequired" className="text-sm text-gray-700">必选费用项（报价时默认勾选）</label>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowFeeItemModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSaveFeeItem}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 供应商报价选择器弹窗 */}
      {showSupplierPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSupplierPicker(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                选择供应商报价
              </h3>
              <button onClick={() => setShowSupplierPicker(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
    </div>
            
            <div className="flex-1 flex min-h-0">
              {/* 左侧供应商列表 */}
              <div className="w-1/3 border-r border-gray-200 flex flex-col">
                <div className="p-3 border-b bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索供应商..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingSuppliers ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y">
                      {suppliers
                        .filter(s => !supplierSearch || 
                          s.supplierName.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                          s.supplierCode.toLowerCase().includes(supplierSearch.toLowerCase())
                        )
                        .map(supplier => (
                          <button
                            key={supplier.id}
                            onClick={() => handleSelectSupplier(supplier)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                              selectedSupplier?.id === supplier.id ? 'bg-primary-50 border-l-2 border-primary-600' : ''
                            }`}
                          >
                            <div className="font-medium text-gray-900 text-sm truncate">{supplier.supplierName}</div>
                            <div className="text-xs text-gray-500">{supplier.supplierCode}</div>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧报价列表 */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-3 border-b bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索报价项..."
                      value={priceSearch}
                      onChange={(e) => setPriceSearch(e.target.value)}
                      disabled={!selectedSupplier}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {!selectedSupplier ? (
                    <div className="p-8 text-center text-gray-500">
                      <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">请先从左侧选择供应商</p>
                    </div>
                  ) : loadingPrices ? (
                    <div className="p-8 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                      <p className="mt-2 text-sm">加载报价中...</p>
                    </div>
                  ) : supplierPrices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <DollarSign className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">该供应商暂无报价数据</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {supplierPrices
                        .filter(p => !priceSearch || 
                          p.name?.toLowerCase().includes(priceSearch.toLowerCase()) ||
                          p.nameEn?.toLowerCase().includes(priceSearch.toLowerCase())
                        )
                        .map(price => (
                          <button
                            key={price.id}
                            onClick={() => handleSelectSupplierPrice(price)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-sm truncate">{price.name}</div>
                                {price.nameEn && (
                                  <div className="text-xs text-gray-500 truncate">{price.nameEn}</div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                    {price.category}
                                  </span>
                                  {price.unit && (
                                    <span className="text-xs text-gray-500">/{price.unit}</span>
                                  )}
                                  {price.routeFrom && price.routeTo && (
                                    <span className="text-xs text-gray-500">
                                      {price.routeFrom} → {price.routeTo}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-semibold text-primary-600">
                                  {price.currency} {price.unitPrice?.toFixed(2)}
                                </div>
                                <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                  点击选择 →
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 批量设置利润弹窗 ==================== */}
      {showBatchProfitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBatchProfitModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                批量设置利润
              </h3>
              <button onClick={() => setShowBatchProfitModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  将为 <span className="font-semibold">{selectedFeeItems.length}</span> 个费用项统一设置利润。
                  销售价将按"成本价 + 利润"重新计算。
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">利润类型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={batchProfitForm.profitType === 'amount'}
                      onChange={() => setBatchProfitForm(prev => ({ ...prev, profitType: 'amount' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">固定利润额</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={batchProfitForm.profitType === 'rate'}
                      onChange={() => setBatchProfitForm(prev => ({ ...prev, profitType: 'rate' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">利润率 (%)</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {batchProfitForm.profitType === 'rate' ? '利润率' : '利润额'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={batchProfitForm.profitValue}
                    onChange={(e) => setBatchProfitForm(prev => ({ ...prev, profitValue: e.target.value }))}
                    placeholder={batchProfitForm.profitType === 'rate' ? '如：20' : '如：50'}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {batchProfitForm.profitType === 'rate' && (
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowBatchProfitModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleBatchSetProfit}
                disabled={batchLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {batchLoading ? '处理中...' : '确定设置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 批量调价弹窗 ==================== */}
      {showBatchAdjustModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBatchAdjustModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Percent className="w-5 h-5 text-orange-600" />
                批量调价
              </h3>
              <button onClick={() => setShowBatchAdjustModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-800">
                  将对 <span className="font-semibold">{selectedFeeItems.length}</span> 个费用项的销售价格进行调整。
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">调价方式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={batchAdjustForm.adjustType === 'percent'}
                      onChange={() => setBatchAdjustForm(prev => ({ ...prev, adjustType: 'percent' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">按百分比</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={batchAdjustForm.adjustType === 'amount'}
                      onChange={() => setBatchAdjustForm(prev => ({ ...prev, adjustType: 'amount' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">按固定金额</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  调价幅度 {batchAdjustForm.adjustType === 'percent' ? '(%)' : ''}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={batchAdjustForm.adjustValue}
                    onChange={(e) => setBatchAdjustForm(prev => ({ ...prev, adjustValue: e.target.value }))}
                    placeholder={batchAdjustForm.adjustType === 'percent' ? '如：10 或 -5' : '如：50 或 -20'}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {batchAdjustForm.adjustType === 'percent' && (
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">输入正数涨价，负数降价</p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowBatchAdjustModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleBatchAdjustPrice}
                disabled={batchLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {batchLoading ? '处理中...' : '确定调价'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 批量导入弹窗 ==================== */}
      {showBatchImportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBatchImportModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-600" />
                从供应商报价批量导入
              </h3>
              <button onClick={() => setShowBatchImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 利润设置 */}
            <div className="px-4 py-3 bg-purple-50 border-b">
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-purple-800">统一利润设置:</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={batchImportForm.profitType === 'amount'}
                      onChange={() => setBatchImportForm(prev => ({ ...prev, profitType: 'amount' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">固定利润</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={batchImportForm.profitType === 'rate'}
                      onChange={() => setBatchImportForm(prev => ({ ...prev, profitType: 'rate' }))}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm">利润率(%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={batchImportForm.profitValue}
                    onChange={(e) => setBatchImportForm(prev => ({ ...prev, profitValue: e.target.value }))}
                    placeholder={batchImportForm.profitType === 'rate' ? '如：20' : '如：50'}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex min-h-0">
              {/* 左侧供应商列表 */}
              <div className="w-1/3 border-r border-gray-200 flex flex-col">
                <div className="p-3 border-b bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索供应商..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loadingSuppliers ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                    </div>
                  ) : (
                    <div className="divide-y">
                      {suppliers
                        .filter(s => !supplierSearch || 
                          s.supplierName.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                          s.supplierCode.toLowerCase().includes(supplierSearch.toLowerCase())
                        )
                        .map(supplier => (
                          <button
                            key={supplier.id}
                            onClick={() => handleSelectSupplier(supplier)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                              selectedSupplier?.id === supplier.id ? 'bg-primary-50 border-l-2 border-primary-600' : ''
                            }`}
                          >
                            <div className="font-medium text-gray-900 text-sm truncate">{supplier.supplierName}</div>
                            <div className="text-xs text-gray-500">{supplier.supplierCode}</div>
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* 右侧报价列表 */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
                  <div className="relative flex-1 mr-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索报价项..."
                      value={priceSearch}
                      onChange={(e) => setPriceSearch(e.target.value)}
                      disabled={!selectedSupplier}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                    />
                  </div>
                  {supplierPrices.length > 0 && (
                    <button
                      onClick={handleSelectAllImportPrices}
                      className="text-xs text-primary-600 hover:text-primary-700 whitespace-nowrap"
                    >
                      {supplierPrices.every(p => selectedImportPrices.includes(p.id)) ? '取消全选' : '全选'}
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {!selectedSupplier ? (
                    <div className="p-8 text-center text-gray-500">
                      <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">请先从左侧选择供应商</p>
                    </div>
                  ) : loadingPrices ? (
                    <div className="p-8 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin" />
                      <p className="mt-2 text-sm">加载报价中...</p>
                    </div>
                  ) : supplierPrices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <DollarSign className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">该供应商暂无报价数据</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {supplierPrices
                        .filter(p => !priceSearch || 
                          p.name?.toLowerCase().includes(priceSearch.toLowerCase()) ||
                          p.nameEn?.toLowerCase().includes(priceSearch.toLowerCase())
                        )
                        .map(price => (
                          <label
                            key={price.id}
                            className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                              selectedImportPrices.includes(price.id) ? 'bg-purple-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedImportPrices.includes(price.id)}
                              onChange={() => handleToggleImportPrice(price.id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 mr-3"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">{price.name}</div>
                              {price.nameEn && (
                                <div className="text-xs text-gray-500 truncate">{price.nameEn}</div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                  {price.category}
                                </span>
                                {price.unit && (
                                  <span className="text-xs text-gray-500">/{price.unit}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold text-purple-600">
                                {price.currency} {price.unitPrice?.toFixed(2)}
                              </div>
                            </div>
                          </label>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-600">
                已选择 <span className="font-semibold text-purple-600">{selectedImportPrices.length}</span> 项报价
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBatchImportModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchImport}
                  disabled={batchLoading || selectedImportPrices.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {batchLoading ? '导入中...' : `导入 ${selectedImportPrices.length} 项`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
