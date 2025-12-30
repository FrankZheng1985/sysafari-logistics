import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  FileCheck, Calculator, Download, CheckCircle, RefreshCw,
  ChevronDown, FileText, AlertTriangle, Edit2, X, Save, User, Building, MapPin, Phone, Hash, Check,
  Shield, TrendingDown
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getCustomers, getCustomerTaxNumbers, type Customer, type CustomerTaxNumber } from '../utils/api'
import { useToast } from '../components/Toast'
import { useDownload } from '../hooks/useDownload'
import RiskAnalysisDashboard from '../components/RiskAnalysisDashboard'

const API_BASE = getApiBaseUrl()

interface ImportBatch {
  id: number
  importNo: string
  customerName: string
  containerNo: string
  totalItems: number
  matchedItems: number
  status: string
}

interface TaxDetails {
  batch: {
    id: number
    importNo: string
    customerId: string
    customerName: string
    containerNo: string
    billNumber: string
    totalItems: number
    matchedItems: number
    totalValue: number
    totalDuty: number
    totalVat: number
    totalOtherTax: number
    customerConfirmed: number
    customerConfirmedAt: string
    confirmPdfPath: string
    status: string
    clearanceType: string
    // 发货方信息
    shipperName: string
    shipperAddress: string
    shipperContact: string
    // 进口商信息
    importerCustomerId: string
    importerName: string
    importerTaxId: string
    importerTaxNumber: string
    importerTaxType: string
    importerCountry: string
    importerCompanyName: string
    importerAddress: string
  }
  items: Array<{
    id: number
    itemNo: number
    productName: string
    productImage: string | null
    matchedHsCode: string
    quantity: number
    unitName: string
    totalValue: number
    dutyRate: number
    vatRate: number
    antiDumpingRate: number
    countervailingRate: number
    dutyAmount: number
    vatAmount: number
    otherTaxAmount: number
    totalTax: number
  }>
  summary: {
    totalValue: number
    totalDuty: number
    totalVat: number
    payableVat: number
    deferredVat: number
    totalOtherTax: number
    totalTax: number
    clearanceType: string
    clearanceTypeLabel: string
    isDeferred: boolean
  }
  byHsCode: Array<{
    hsCode: string
    itemCount: number
    totalValue: number
    totalDuty: number
    totalVat: number
    totalOtherTax: number
    totalTax: number
  }>
}

export default function DocumentTaxCalc() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const importIdParam = searchParams.get('importId')
  const { showToast } = useToast()
  const { downloadTaxConfirmPdf } = useDownload()

  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null)
  const [taxDetails, setTaxDetails] = useState<TaxDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [changingType, setChangingType] = useState(false)
  const [showOtherTaxPopup, setShowOtherTaxPopup] = useState<number | null>(null) // 显示其他税弹窗的行ID
  const [showHsOtherTaxPopup, setShowHsOtherTaxPopup] = useState<number | null>(null) // 按HS编码汇总的其他税弹窗
  
  // 编辑相关状态
  const [editingItem, setEditingItem] = useState<{
    id: number
    itemNo: number
    productName: string
    matchedHsCode: string
    totalValue: number
    dutyRate: number
    vatRate: number
    antiDumpingRate: number
    countervailingRate: number
  } | null>(null)
  const [editForm, setEditForm] = useState({
    productName: '',
    matchedHsCode: '',
    totalValue: '',
    dutyRate: '',
    vatRate: '',
    antiDumpingRate: '',
    countervailingRate: ''
  })
  const [saving, setSaving] = useState(false)
  
  // HS编码搜索相关
  const [hsSearchResults, setHsSearchResults] = useState<Array<{
    hsCode: string
    productName: string
    dutyRate: number
    vatRate: number
    antiDumpingRate: number
    countervailingRate: number
    originCountry?: string
    originCountryCode?: string
  }>>([])
  const [hsSearching, setHsSearching] = useState(false)
  const [showHsSuggestions, setShowHsSuggestions] = useState(false)
  
  // 发货方和进口商编辑相关状态
  const [editingShipperImporter, setEditingShipperImporter] = useState(false)
  const [shipperForm, setShipperForm] = useState({
    name: '',
    address: '',
    contact: ''
  })
  const [importerForm, setImporterForm] = useState({
    customerId: '',
    name: '',
    taxId: '',
    taxNumber: '',
    taxType: '',
    country: '',
    companyName: '',
    address: ''
  })
  const [savingShipperImporter, setSavingShipperImporter] = useState(false)
  
  // 客户和税号选择
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerTaxNumbers, setCustomerTaxNumbers] = useState<CustomerTaxNumber[]>([])
  const [selectedTaxNumber, setSelectedTaxNumber] = useState<CustomerTaxNumber | null>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingTaxNumbers, setLoadingTaxNumbers] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  
  // 风险分析相关状态
  const [showRiskAnalysis, setShowRiskAnalysis] = useState(false)

  useEffect(() => {
    loadBatches()
    loadCustomers()
  }, [])
  
  // 加载客户列表
  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await getCustomers({ pageSize: 100 })
      if (response.errCode === 200) {
        setCustomers(response.data?.list || [])
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }
  
  // 加载客户税号
  const loadCustomerTaxNumbers = async (customerId: string) => {
    setLoadingTaxNumbers(true)
    try {
      const response = await getCustomerTaxNumbers(customerId)
      if (response.errCode === 200) {
        setCustomerTaxNumbers(response.data || [])
      }
    } catch (error) {
      console.error('加载客户税号失败:', error)
    } finally {
      setLoadingTaxNumbers(false)
    }
  }
  
  // 当选择客户时加载税号
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerTaxNumbers(selectedCustomer.id)
    } else {
      setCustomerTaxNumbers([])
      setSelectedTaxNumber(null)
    }
  }, [selectedCustomer])
  
  // 过滤客户
  const filteredCustomers = customers.filter(c => 
    c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
  )

  useEffect(() => {
    if (importIdParam) {
      const batch = batches.find(b => b.id === parseInt(importIdParam))
      if (batch) {
        setSelectedBatch(batch)
      }
    }
  }, [importIdParam, batches])

  useEffect(() => {
    if (selectedBatch) {
      loadTaxDetails()
    }
  }, [selectedBatch])

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showOtherTaxPopup !== null && !target.closest('.other-tax-popup-container')) {
        setShowOtherTaxPopup(null)
      }
      if (showHsOtherTaxPopup !== null && !target.closest('.hs-other-tax-popup-container')) {
        setShowHsOtherTaxPopup(null)
      }
      // 关闭HS搜索建议
      if (showHsSuggestions && !target.closest('.hs-search-container')) {
        setShowHsSuggestions(false)
      }
    }
    if (showOtherTaxPopup !== null || showHsOtherTaxPopup !== null || showHsSuggestions) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showOtherTaxPopup, showHsOtherTaxPopup, showHsSuggestions])

  const loadBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports?pageSize=100`)
      const data = await res.json()
      if (data.errCode === 200) {
        setBatches(data.data?.list || [])
        if (importIdParam) {
          const batch = data.data?.list?.find((b: ImportBatch) => b.id === parseInt(importIdParam))
          if (batch) {
            setSelectedBatch(batch)
          }
        }
      }
    } catch (error) {
      console.error('加载批次列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTaxDetails = async () => {
    if (!selectedBatch) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/tax-calc/${selectedBatch.id}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setTaxDetails(data.data)
      }
    } catch (error) {
      console.error('加载税费详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!selectedBatch) return
    setCalculating(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/tax-calc/${selectedBatch.id}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', '税费计算完成')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '计算失败')
      }
    } catch (error) {
      console.error('计算失败:', error)
      showToast('error', '计算失败')
    } finally {
      setCalculating(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!selectedBatch) return
    setGeneratingPdf(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/tax-calc/${selectedBatch.id}/pdf`)
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', 'PDF生成成功')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || 'PDF生成失败')
      }
    } catch (error) {
      console.error('PDF生成失败:', error)
      showToast('error', 'PDF生成失败')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!selectedBatch || !taxDetails?.batch.confirmPdfPath) return
    downloadTaxConfirmPdf(selectedBatch.id, taxDetails.batch.importNo)
  }

  const handleMarkConfirmed = async () => {
    if (!selectedBatch) return
    if (!confirm('确定标记客户已确认？')) return
    
    setConfirming(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/tax-calc/${selectedBatch.id}/confirm`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', '已标记客户确认')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '操作失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      showToast('error', '操作失败')
    } finally {
      setConfirming(false)
    }
  }

  // 更新清关类型
  const handleClearanceTypeChange = async (type: '40' | '42') => {
    if (!selectedBatch) return
    setChangingType(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/tax-calc/${selectedBatch.id}/clearance-type`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearanceType: type })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', type === '42' ? '已切换为42号递延清关' : '已切换为40号普通清关')
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新清关类型失败:', error)
      showToast('error', '更新失败')
    } finally {
      setChangingType(false)
    }
  }

  // 打开编辑弹窗
  const handleEditItem = (item: TaxDetails['items'][0]) => {
    setEditingItem({
      id: item.id,
      itemNo: item.itemNo,
      productName: item.productName,
      matchedHsCode: item.matchedHsCode || '',
      totalValue: item.totalValue,
      dutyRate: item.dutyRate,
      vatRate: item.vatRate,
      antiDumpingRate: item.antiDumpingRate,
      countervailingRate: item.countervailingRate
    })
    setEditForm({
      productName: item.productName || '',
      matchedHsCode: item.matchedHsCode || '',
      totalValue: item.totalValue.toString(),
      dutyRate: item.dutyRate.toString(),
      vatRate: item.vatRate.toString(),
      antiDumpingRate: item.antiDumpingRate.toString(),
      countervailingRate: item.countervailingRate.toString()
    })
  }

  // 关闭编辑弹窗
  const handleCloseEdit = () => {
    setEditingItem(null)
    setEditForm({
      productName: '',
      matchedHsCode: '',
      totalValue: '',
      dutyRate: '',
      vatRate: '',
      antiDumpingRate: '',
      countervailingRate: ''
    })
    setHsSearchResults([])
    setShowHsSuggestions(false)
  }

  // HS编码搜索
  const searchHsCode = async (query: string) => {
    if (!query || query.length < 2) {
      setHsSearchResults([])
      setShowHsSuggestions(false)
      return
    }
    
    setHsSearching(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/search-tariff?hsCode=${encodeURIComponent(query)}&limit=10`)
      const data = await res.json()
      if (data.errCode === 200 && data.data) {
        setHsSearchResults(data.data)
        setShowHsSuggestions(true)
      }
    } catch (error) {
      console.error('搜索HS编码失败:', error)
    } finally {
      setHsSearching(false)
    }
  }

  // 选择HS编码，自动填充税率
  const handleSelectHsCode = (item: typeof hsSearchResults[0]) => {
    setEditForm({
      ...editForm,
      matchedHsCode: item.hsCode,
      dutyRate: item.dutyRate.toString(),
      vatRate: item.vatRate.toString(),
      antiDumpingRate: item.antiDumpingRate.toString(),
      countervailingRate: item.countervailingRate.toString(),
      // 如果商品品名为空，使用HS数据库中的品名
      productName: editForm.productName || item.productName || ''
    })
    setShowHsSuggestions(false)
    setHsSearchResults([])
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingItem) return
    
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/tax-calc/item/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: editForm.productName.trim() || undefined,
          matchedHsCode: editForm.matchedHsCode.trim() || undefined,
          totalValue: parseFloat(editForm.totalValue) || 0,
          dutyRate: parseFloat(editForm.dutyRate) || 0,
          vatRate: parseFloat(editForm.vatRate) || 19,
          antiDumpingRate: parseFloat(editForm.antiDumpingRate) || 0,
          countervailingRate: parseFloat(editForm.countervailingRate) || 0
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', data.msg || '税费信息已更新')
        handleCloseEdit()
        loadTaxDetails() // 重新加载数据
      } else {
        showToast('error', data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新税费失败:', error)
      showToast('error', '更新失败')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
  }
  
  // 打开编辑发货方和进口商信息弹窗
  const handleEditShipperImporter = () => {
    if (taxDetails) {
      setShipperForm({
        name: taxDetails.batch.shipperName || '',
        address: taxDetails.batch.shipperAddress || '',
        contact: taxDetails.batch.shipperContact || ''
      })
      setImporterForm({
        customerId: taxDetails.batch.importerCustomerId || '',
        name: taxDetails.batch.importerName || '',
        taxId: taxDetails.batch.importerTaxId || '',
        taxNumber: taxDetails.batch.importerTaxNumber || '',
        taxType: taxDetails.batch.importerTaxType || '',
        country: taxDetails.batch.importerCountry || '',
        companyName: taxDetails.batch.importerCompanyName || '',
        address: taxDetails.batch.importerAddress || ''
      })
      // 如果有进口商客户ID，找到对应的客户
      if (taxDetails.batch.importerCustomerId) {
        const customer = customers.find(c => c.id === taxDetails.batch.importerCustomerId)
        setSelectedCustomer(customer || null)
      }
    }
    setEditingShipperImporter(true)
  }
  
  // 保存发货方和进口商信息
  const handleSaveShipperImporter = async () => {
    if (!selectedBatch) return
    
    setSavingShipperImporter(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports/${selectedBatch.id}/shipper-importer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipperName: shipperForm.name || null,
          shipperAddress: shipperForm.address || null,
          shipperContact: shipperForm.contact || null,
          importerCustomerId: selectedCustomer?.id || null,
          importerName: selectedCustomer?.companyName || selectedCustomer?.customerName || null,
          importerTaxId: selectedTaxNumber?.id || null,
          importerTaxNumber: selectedTaxNumber?.taxNumber || null,
          importerTaxType: selectedTaxNumber?.taxType || null,
          importerCountry: selectedTaxNumber?.country || null,
          importerCompanyName: selectedTaxNumber?.companyName || null,
          importerAddress: selectedTaxNumber?.companyAddress || null
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        showToast('success', '发货方和进口商信息已更新')
        setEditingShipperImporter(false)
        loadTaxDetails()
      } else {
        showToast('error', data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新发货方和进口商信息失败:', error)
      showToast('error', '更新失败')
    } finally {
      setSavingShipperImporter(false)
    }
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
  ]

  const isDeferred = taxDetails?.summary?.isDeferred || false

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/tax-calc"
        onTabChange={(path) => navigate(path)}
      />

      {/* 批次选择 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">选择导入批次</label>
            <div className="relative">
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => {
                  const batch = batches.find(b => b.id === parseInt(e.target.value))
                  setSelectedBatch(batch || null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm appearance-none bg-white"
                title="选择导入批次"
              >
                <option value="">请选择批次</option>
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.importNo} - {batch.containerNo || '无柜号'} ({batch.matchedItems}/{batch.totalItems}件已匹配)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          {selectedBatch && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
              >
                {calculating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4" />
                )}
                {calculating ? '计算中...' : '计算税费'}
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
              >
                {generatingPdf ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                生成PDF
              </button>
              {taxDetails?.batch.confirmPdfPath && (
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  下载PDF
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 税费详情 */}
      {taxDetails && (
        <>
          {/* 发货方和进口商信息卡片 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 发货方卡片 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-900">发货方</h3>
                </div>
                <button
                  onClick={handleEditShipperImporter}
                  className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="编辑发货方和进口商信息"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {taxDetails.batch.shipperName ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{taxDetails.batch.shipperName}</div>
                    </div>
                  </div>
                  {taxDetails.batch.shipperContact && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                      <div className="text-xs text-gray-600">{taxDetails.batch.shipperContact}</div>
                    </div>
                  )}
                  {taxDetails.batch.shipperAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                      <div className="text-xs text-gray-600">{taxDetails.batch.shipperAddress}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">未设置发货方信息</p>
                  <button
                    onClick={handleEditShipperImporter}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                  >
                    + 添加发货方
                  </button>
                </div>
              )}
            </div>
            
            {/* 进口商卡片 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-medium text-gray-900">进口商</h3>
                </div>
                <button
                  onClick={handleEditShipperImporter}
                  className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="编辑发货方和进口商信息"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {taxDetails.batch.importerTaxNumber ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Building className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {taxDetails.batch.importerCompanyName || taxDetails.batch.importerName || '未知公司'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Hash className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                        {taxDetails.batch.importerTaxType?.toUpperCase() || 'TAX'}
                      </span>
                      <span className="text-xs font-mono text-gray-700">{taxDetails.batch.importerTaxNumber}</span>
                    </div>
                  </div>
                  {taxDetails.batch.importerCountry && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                      <div className="text-xs text-gray-600">{taxDetails.batch.importerCountry}</div>
                    </div>
                  )}
                  {taxDetails.batch.importerAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                      <div className="text-xs text-gray-600">{taxDetails.batch.importerAddress}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Building className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">未设置进口商信息</p>
                  <button
                    onClick={handleEditShipperImporter}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                  >
                    + 关联客户税号
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* 清关类型选择 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">清关方式</h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clearanceType"
                      value="40"
                      checked={!isDeferred}
                      onChange={() => handleClearanceTypeChange('40')}
                      disabled={changingType}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">
                      <span className="font-medium">40号普通清关</span>
                      <span className="text-gray-500 ml-1">（关税+增值税在进口国缴纳）</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clearanceType"
                      value="42"
                      checked={isDeferred}
                      onChange={() => handleClearanceTypeChange('42')}
                      disabled={changingType}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">
                      <span className="font-medium">42号递延清关</span>
                      <span className="text-gray-500 ml-1">（增值税递延到目的地国家缴纳）</span>
                    </span>
                  </label>
                </div>
              </div>
              {isDeferred && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded text-blue-700 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  递延清关：增值税 {formatCurrency(taxDetails.summary.deferredVat || 0)} 将在目的地国家缴纳
                </div>
              )}
            </div>
          </div>

          {/* 汇总卡片 */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">货值总额</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(taxDetails.summary.totalValue)}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">关税</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(taxDetails.summary.totalDuty)}</div>
            </div>
            <div className={`bg-white rounded-lg border p-4 ${isDeferred ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
              <div className="text-xs text-gray-500 mb-1">
                增值税
                {isDeferred && <span className="ml-1 text-blue-600">(递延)</span>}
              </div>
              <div className={`text-xl font-bold ${isDeferred ? 'text-gray-400 line-through' : 'text-amber-600'}`}>
                {formatCurrency(taxDetails.summary.totalVat)}
              </div>
              {isDeferred && (
                <div className="text-xs text-blue-600 mt-1">目的地国家缴纳</div>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                其他税费
                <span 
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-purple-100 text-purple-600 cursor-help text-[9px] font-bold"
                  title="包含：反倾销税 (Anti-dumping)、反补贴税 (Countervailing) 等"
                >
                  ?
                </span>
              </div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(taxDetails.summary.totalOtherTax)}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 bg-gradient-to-br from-green-50 to-green-100">
              <div className="text-xs text-gray-500 mb-1">
                {isDeferred ? '进口应付税费' : '税费合计'}
              </div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(taxDetails.summary.totalTax)}</div>
              {isDeferred && (
                <div className="text-xs text-gray-500 mt-1">
                  不含递延增值税
                </div>
              )}
            </div>
          </div>
          
          {/* 反倾销/反补贴税警告 */}
          {taxDetails.summary.totalOtherTax > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-red-800 text-base">⚠️ 反倾销/反补贴税警告</div>
                  <div className="text-sm text-red-700 mt-1">
                    本批货物中包含需缴纳<span className="font-bold">反倾销税或反补贴税</span>的商品，
                    合计 <span className="font-bold text-red-800">{formatCurrency(taxDetails.summary.totalOtherTax)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {taxDetails.items.filter(item => item.antiDumpingRate > 0 || item.countervailingRate > 0).map((item, idx) => (
                      <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-100 rounded text-xs">
                        <span className="font-mono font-medium text-red-800">{item.matchedHsCode}</span>
                        <span className="text-red-600">
                          {item.antiDumpingRate > 0 && `反倾销${item.antiDumpingRate}%`}
                          {item.antiDumpingRate > 0 && item.countervailingRate > 0 && ' + '}
                          {item.countervailingRate > 0 && `反补贴${item.countervailingRate}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-amber-700">
                    💡 建议：点击下方"智能风险分析"查看是否有低税率替代HS编码
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 风险分析入口 */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-4 border border-primary-100">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary-600" />
              <div>
                <div className="font-medium text-gray-900">智能风险分析</div>
                <div className="text-sm text-gray-500">分析税率优化、申报价值、查验风险</div>
              </div>
            </div>
            <button
              onClick={() => setShowRiskAnalysis(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <TrendingDown className="w-4 h-4" />
              开始分析
            </button>
          </div>
          
          {/* 风险分析弹窗 */}
          {showRiskAnalysis && taxDetails && (
            <RiskAnalysisDashboard
              importId={taxDetails.batch.id}
              onClose={() => setShowRiskAnalysis(false)}
            />
          )}

          {/* 客户确认状态 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-1">客户确认状态</h3>
                {taxDetails.batch.customerConfirmed ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">客户已确认</span>
                    <span className="text-xs text-gray-500">
                      ({taxDetails.batch.customerConfirmedAt ? new Date(taxDetails.batch.customerConfirmedAt).toLocaleString('zh-CN') : '-'})
                    </span>
                  </div>
                ) : (
                  <div className="text-amber-600 text-sm">待客户确认</div>
                )}
              </div>
              {!taxDetails.batch.customerConfirmed && (
                <button
                  onClick={handleMarkConfirmed}
                  disabled={confirming}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {confirming ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  标记客户已确认
                </button>
              )}
            </div>
          </div>

          {/* 按HS编码汇总 */}
          {taxDetails.byHsCode.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">按HS编码汇总</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">HS编码</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-500">商品数</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">货值</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">关税</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">
                        增值税
                        {isDeferred && <span className="text-blue-500 ml-1">(递延)</span>}
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">
                        <span className="cursor-help" title="包含：反倾销税、反补贴税等">其他税</span>
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">税费合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxDetails.byHsCode.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono">{item.hsCode}</td>
                        <td className="px-4 py-2 text-center">{item.itemCount}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.totalValue)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.totalDuty)}</td>
                        <td className={`px-4 py-2 text-right ${isDeferred ? 'text-gray-400' : ''}`}>
                          {formatCurrency(item.totalVat)}
                        </td>
                        <td className="px-4 py-2 text-right text-purple-600">
                          <div className="flex items-center justify-end gap-1 relative hs-other-tax-popup-container">
                            {formatCurrency(item.totalOtherTax)}
                            {item.totalOtherTax > 0 && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowHsOtherTaxPopup(showHsOtherTaxPopup === idx ? null : idx)
                                  }}
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 cursor-pointer text-[10px] font-bold transition-colors"
                                >
                                  !
                                </button>
                                {showHsOtherTaxPopup === idx && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-purple-200 rounded-lg shadow-lg p-3 min-w-[200px]">
                                    <div className="text-xs font-medium text-gray-700 mb-2 border-b pb-1">其他税费说明</div>
                                    <div className="space-y-1.5 text-xs text-gray-600">
                                      <div>• <span className="font-medium">反倾销税</span>：针对倾销行为征收的惩罚性关税</div>
                                      <div>• <span className="font-medium">反补贴税</span>：针对政府补贴行为征收的关税</div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                                      <span className="text-gray-600">HS编码 {item.hsCode} 合计</span>
                                      <span className="text-purple-600 font-bold">{formatCurrency(item.totalOtherTax)}</span>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(isDeferred 
                            ? item.totalDuty + item.totalOtherTax 
                            : item.totalTax
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 商品明细 */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">商品税费明细 ({taxDetails.items.length}项)</h3>
              <span className="text-xs text-gray-500">点击编辑按钮可修改税费</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">行号</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">图片</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">商品名称</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">HS编码</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">货值</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">关税率</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">关税</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">增值税率</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      增值税
                      {isDeferred && <span className="text-blue-500 ml-1">(递延)</span>}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      <span className="cursor-help" title="包含：反倾销税、反补贴税等">其他税</span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">税费合计</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        加载中...
                      </td>
                    </tr>
                  ) : taxDetails.items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-gray-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    taxDetails.items.map(item => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{item.itemNo}</td>
                        <td className="px-3 py-2 text-center">
                          {item.productImage ? (
                            <img
                              src={`${API_BASE}${item.productImage}`}
                              alt={item.productName}
                              className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:scale-150 transition-transform"
                              onClick={() => window.open(`${API_BASE}${item.productImage}`, '_blank')}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <span className="text-gray-300 text-[10px]">无图</span>
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[150px] truncate" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="px-3 py-2 font-mono">{item.matchedHsCode || '-'}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.totalValue)}</td>
                        <td className="px-3 py-2 text-right">{item.dutyRate}%</td>
                        <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(item.dutyAmount)}</td>
                        <td className="px-3 py-2 text-right">{item.vatRate}%</td>
                        <td className={`px-3 py-2 text-right ${isDeferred ? 'text-gray-400' : 'text-amber-600'}`}>
                          {formatCurrency(item.vatAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-purple-600">
                          <div className="flex items-center justify-end gap-1 relative other-tax-popup-container">
                            {formatCurrency(item.otherTaxAmount)}
                            {item.otherTaxAmount > 0 && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowOtherTaxPopup(showOtherTaxPopup === item.id ? null : item.id)
                                  }}
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 cursor-pointer text-[10px] font-bold transition-colors"
                                >
                                  !
                                </button>
                                {showOtherTaxPopup === item.id && (
                                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-purple-200 rounded-lg shadow-lg p-3 min-w-[180px]">
                                    <div className="text-xs font-medium text-gray-700 mb-2 border-b pb-1">其他税费明细</div>
                                    <div className="space-y-1.5 text-xs">
                                      {item.antiDumpingRate > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">反倾销税</span>
                                          <span className="text-purple-600 font-medium">{item.antiDumpingRate}%</span>
                                        </div>
                                      )}
                                      {item.countervailingRate > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">反补贴税</span>
                                          <span className="text-purple-600 font-medium">{item.countervailingRate}%</span>
                                        </div>
                                      )}
                                      {item.antiDumpingRate === 0 && item.countervailingRate === 0 && (
                                        <div className="text-gray-500">其他特殊税费</div>
                                      )}
                                    </div>
                                    <div className="mt-2 pt-2 border-t flex justify-between text-xs">
                                      <span className="text-gray-600">合计金额</span>
                                      <span className="text-purple-600 font-bold">{formatCurrency(item.otherTaxAmount)}</span>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">
                          {formatCurrency(isDeferred 
                            ? item.dutyAmount + item.otherTaxAmount 
                            : item.totalTax
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="编辑税费"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {taxDetails.items.length > 0 && (
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 font-medium">合计</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(taxDetails.summary.totalValue)}</td>
                      <td></td>
                      <td className="px-3 py-2 text-right font-medium text-blue-600">{formatCurrency(taxDetails.summary.totalDuty)}</td>
                      <td></td>
                      <td className={`px-3 py-2 text-right font-medium ${isDeferred ? 'text-gray-400' : 'text-amber-600'}`}>
                        {formatCurrency(taxDetails.summary.totalVat)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-purple-600">{formatCurrency(taxDetails.summary.totalOtherTax)}</td>
                      <td className="px-3 py-2 text-right font-bold text-green-600">{formatCurrency(taxDetails.summary.totalTax)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* 递延清关说明 */}
          {isDeferred && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-1">42号递延清关说明</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 货物在进口国（如荷兰）清关时，仅需缴纳关税 {formatCurrency(taxDetails.summary.totalDuty)}</li>
                    <li>• 增值税 {formatCurrency(taxDetails.summary.deferredVat || 0)} 将递延到货物最终目的地国家缴纳</li>
                    <li>• 适用于货物清关后将运往其他欧盟成员国的情况</li>
                    <li>• 需要提供有效的目的地国家增值税号</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 无批次选择提示 */}
      {!selectedBatch && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">请选择一个导入批次查看税费计算结果</p>
        </div>
      )}

      {/* 编辑税费弹窗 */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">编辑税费信息</h3>
                <p className="text-sm text-gray-500 mt-1">
                  行号 {editingItem.itemNo}: {editingItem.productName}
                </p>
              </div>
              <button
                onClick={handleCloseEdit}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 弹窗内容 */}
            <div className="px-6 py-4 space-y-4">
              {/* 商品品名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  商品品名
                  <span className="text-xs text-gray-400 ml-2 font-normal">可手动修改</span>
                </label>
                <input
                  type="text"
                  value={editForm.productName}
                  onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入商品品名"
                />
              </div>

              {/* HS编码 - 带搜索建议 */}
              <div className="relative hs-search-container">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HS编码
                  <span className="text-xs text-gray-400 ml-2 font-normal">输入编码搜索，选择后自动填充税率</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editForm.matchedHsCode}
                    onChange={(e) => {
                      setEditForm({ ...editForm, matchedHsCode: e.target.value })
                      searchHsCode(e.target.value)
                    }}
                    onFocus={() => editForm.matchedHsCode.length >= 2 && setShowHsSuggestions(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="输入HS编码搜索..."
                    maxLength={10}
                  />
                  {hsSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>
                
                {/* 搜索建议列表 */}
                {showHsSuggestions && hsSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {hsSearchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectHsCode(item)}
                        className="px-3 py-2 hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-primary-600">{item.hsCode}</span>
                            {item.originCountry && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {item.originCountry}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 text-right">
                            <span>关税: {item.dutyRate}%</span>
                            <span className="ml-2">增值税: {item.vatRate}%</span>
                          </div>
                        </div>
                        {/* 显示反倾销税和反补贴税（如果有） */}
                        {(item.antiDumpingRate > 0 || item.countervailingRate > 0) && (
                          <div className="text-xs text-amber-600 mt-0.5">
                            {item.antiDumpingRate > 0 && <span>反倾销税: {item.antiDumpingRate}%</span>}
                            {item.antiDumpingRate > 0 && item.countervailingRate > 0 && <span className="mx-1">|</span>}
                            {item.countervailingRate > 0 && <span>反补贴税: {item.countervailingRate}%</span>}
                          </div>
                        )}
                        <div className="text-xs text-gray-600 truncate mt-0.5">{item.productName}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {editForm.matchedHsCode !== editingItem?.matchedHsCode && editForm.matchedHsCode && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ HS编码已修改，税率已自动更新
                  </p>
                )}
              </div>
              
              {/* 货值 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  货值 (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.totalValue}
                  onChange={(e) => setEditForm({ ...editForm, totalValue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入货值"
                />
              </div>
              
              {/* 关税率和增值税率 - 只读 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    关税率 (%)
                    <span className="text-xs text-gray-400 ml-1 font-normal">自动获取</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.dutyRate}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    placeholder="关税率"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    增值税率 (%)
                    <span className="text-xs text-gray-400 ml-1 font-normal">自动获取</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.vatRate}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    placeholder="增值税率"
                  />
                </div>
              </div>
              
              {/* 其他税率 - 只读 */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  其他税费
                  <span className="text-xs text-gray-400 ml-2 font-normal">根据HS编码自动获取</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      反倾销税率 (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.antiDumpingRate}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                      placeholder="反倾销税率"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      反补贴税率 (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.countervailingRate}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                      placeholder="反补贴税率"
                    />
                  </div>
                </div>
              </div>
              
              {/* 计算预览 */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <div className="text-gray-500 mb-2">税费将根据以上税率自动重新计算</div>
                <div className="text-gray-600">
                  关税 = 货值 × 关税率 | 增值税 = (货值 + 关税 + 其他税) × 增值税率
                </div>
              </div>
            </div>
            
            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={handleCloseEdit}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存修改
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 编辑发货方和进口商信息弹窗 */}
      {editingShipperImporter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h3 className="text-lg font-medium text-gray-900">编辑发货方和进口商信息</h3>
              <button
                onClick={() => setEditingShipperImporter(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* 发货方信息 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">发货方信息</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">发货方名称</label>
                    <input
                      type="text"
                      value={shipperForm.name}
                      onChange={(e) => setShipperForm({ ...shipperForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="请输入发货方名称"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">联系方式</label>
                    <input
                      type="text"
                      value={shipperForm.contact}
                      onChange={(e) => setShipperForm({ ...shipperForm, contact: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="请输入联系方式"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">地址</label>
                    <input
                      type="text"
                      value={shipperForm.address}
                      onChange={(e) => setShipperForm({ ...shipperForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="请输入发货方地址"
                    />
                  </div>
                </div>
              </div>
              
              {/* 进口商信息 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">进口商信息</span>
                  <span className="text-xs text-gray-400">(关联客户税号)</span>
                </div>
                <div className="space-y-3">
                  {/* 客户选择 */}
                  <div className="relative">
                    <label className="block text-xs text-gray-500 mb-1">选择客户</label>
                    <div 
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white cursor-pointer flex items-center justify-between"
                      onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                    >
                      <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                        {selectedCustomer ? (selectedCustomer.companyName || selectedCustomer.customerName) : '请选择客户'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                            placeholder="搜索客户..."
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {loadingCustomers ? (
                          <div className="p-3 text-center text-xs text-gray-400">
                            <RefreshCw className="w-4 h-4 animate-spin inline-block mr-1" />
                            加载中...
                          </div>
                        ) : filteredCustomers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-400">无匹配客户</div>
                        ) : (
                          filteredCustomers.map(customer => (
                            <div
                              key={customer.id}
                              className={`px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${
                                selectedCustomer?.id === customer.id ? 'bg-primary-50 text-primary-700' : ''
                              }`}
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setShowCustomerDropdown(false)
                                setCustomerSearch('')
                              }}
                            >
                              <div className="font-medium">{customer.companyName || customer.customerName}</div>
                              <div className="text-gray-400">{customer.customerCode}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* 税号选择 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">进口商税号</label>
                    {!selectedCustomer ? (
                      <div className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-400">
                        请先选择客户
                      </div>
                    ) : loadingTaxNumbers ? (
                      <div className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-400">
                        <RefreshCw className="w-3 h-3 animate-spin inline-block mr-1" />
                        加载税号中...
                      </div>
                    ) : customerTaxNumbers.length === 0 ? (
                      <div className="w-full px-3 py-2 border border-amber-200 rounded text-sm bg-amber-50 text-amber-600">
                        该客户暂无税号，请在CRM客户管理中添加
                      </div>
                    ) : (
                      <select
                        value={selectedTaxNumber?.id || ''}
                        onChange={(e) => {
                          const tax = customerTaxNumbers.find(t => String(t.id) === e.target.value)
                          setSelectedTaxNumber(tax || null)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        title="选择进口商税号"
                      >
                        <option value="">请选择税号</option>
                        {/* 按公司名称分组，每个公司显示一行 */}
                        {(() => {
                          const grouped = customerTaxNumbers.reduce((acc, tax) => {
                            const key = tax.companyName || '未命名公司'
                            if (!acc[key]) {
                              acc[key] = { companyName: key, taxes: [], defaultTax: null }
                            }
                            acc[key].taxes.push(tax)
                            if (tax.isDefault) {
                              acc[key].defaultTax = tax
                            }
                            return acc
                          }, {} as Record<string, { companyName: string; taxes: CustomerTaxNumber[]; defaultTax: CustomerTaxNumber | null }>)
                          
                          return Object.values(grouped).map(group => {
                            // 优先使用默认税号，否则使用第一个税号
                            const primaryTax = group.defaultTax || group.taxes[0]
                            // 显示所有税号类型
                            const taxTypes = group.taxes.map(t => t.taxType?.toUpperCase()).join('/')
                            return (
                              <option key={primaryTax.id} value={primaryTax.id}>
                                {group.companyName} ({taxTypes})
                              </option>
                            )
                          })
                        })()}
                      </select>
                    )}
                  </div>
                  
                  {/* 显示选中的税号详情 */}
                  {selectedTaxNumber && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          {selectedTaxNumber.taxType?.toUpperCase()}
                        </span>
                        <span className="font-mono text-sm text-gray-700">{selectedTaxNumber.taxNumber}</span>
                        {selectedTaxNumber.isVerified && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Check className="w-3 h-3" />
                            已验证
                          </span>
                        )}
                      </div>
                      {selectedTaxNumber.companyName && (
                        <div className="text-sm text-gray-700 mb-1">{selectedTaxNumber.companyName}</div>
                      )}
                      {selectedTaxNumber.companyAddress && (
                        <div className="text-xs text-gray-500">{selectedTaxNumber.companyAddress}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
              <button
                onClick={() => setEditingShipperImporter(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveShipperImporter}
                disabled={savingShipperImporter}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingShipperImporter ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
