import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, FileText, Edit, Trash2, X, 
  Send, CheckCircle, XCircle, Clock, Languages, Loader2, Package, Download,
  Truck, MapPin, AlertCircle, Play, User
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const API_BASE = getApiBaseUrl()

interface Quotation {
  id: string
  quoteNumber: string
  customerId: string
  customerName: string
  subject: string
  quoteDate: string
  validUntil: string | null
  subtotal: number
  discount: number
  taxAmount: number
  totalAmount: number
  currency: string
  status: string
  items: QuotationItem[]
  createTime: string
}

interface QuotationItem {
  name: string
  nameEn?: string
  description?: string
  quantity: number
  unit?: string
  price: number
  amount: number
  productId?: string
  feeItemId?: number
}

interface Customer {
  id: string
  customerName: string
}

interface Product {
  id: string
  productCode: string
  productName: string
  productNameEn: string
  category: string
  feeItems?: ProductFeeItem[]
}

interface ProductFeeItem {
  id: number
  feeName: string
  feeNameEn: string
  unit: string
  standardPrice: number
  currency: string
  isRequired: boolean
}

// 客户询价接口
interface CustomerInquiry {
  id: string
  inquiryNumber: string
  customerId: string
  customerName: string
  inquiryType: 'clearance' | 'transport' | 'combined'
  status: string
  transportData: {
    transportMode?: 'container' | 'truck'
    containerType?: string
    returnLocation?: 'same' | 'different'
    returnAddress?: string
    origin: string
    destination: string
  } | null
  clearanceData: any
  assignedTo: number | null
  assignedToName: string | null
  dueAt: string | null
  isOverdue: boolean
  priority: string
  source: string
  createdAt: string
}

// 待办任务接口
interface InquiryTask {
  id: number
  inquiryId: string
  inquiryNumber: string
  assigneeId: number
  assigneeName: string
  supervisorId: number | null
  supervisorName: string | null
  taskType: string
  status: string
  dueAt: string | null
  customerName: string
  inquiryType: string
  transportData: any
  clearanceData: any
  priority: string
  source: string
}

export default function CRMQuotations() {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  
  // 视图切换：quotations / inquiries
  const [activeView, setActiveView] = useState<'quotations' | 'inquiries'>('quotations')
  
  // 报价单状态
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [editingItem, setEditingItem] = useState<Quotation | null>(null)
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    subject: '',
    quoteDate: new Date().toISOString().split('T')[0],
    validUntil: '',
    validityValue: 30,
    validityUnit: 'day' as 'day' | 'week' | 'month' | 'year',
    currency: 'EUR',
    terms: '',
    notes: '',
    items: [{ name: '', nameEn: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }] as QuotationItem[]
  })
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [isComposing, setIsComposing] = useState(false) // 跟踪输入法状态
  
  // 客户询价状态
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([])
  const [inquiryTotal, setInquiryTotal] = useState(0)
  const [inquiryPage, setInquiryPage] = useState(1)
  const [inquiryLoading, setInquiryLoading] = useState(false)
  const [inquiryFilterStatus, setInquiryFilterStatus] = useState<string>('')
  const [selectedInquiry, setSelectedInquiry] = useState<CustomerInquiry | null>(null)
  const [showInquiryDetail, setShowInquiryDetail] = useState(false)
  const [taskStats, setTaskStats] = useState({ pendingCount: 0, processingCount: 0, overdueCount: 0, todayCompleted: 0 })

   
  useEffect(() => {
    if (activeView === 'quotations') {
    loadData()
    } else {
      loadInquiries()
      loadTaskStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, page, pageSize, searchValue, filterStatus, inquiryPage, inquiryFilterStatus])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterStatus) params.append('status', filterStatus)

      const [quoteRes, custRes, productRes] = await Promise.all([
        fetch(`${API_BASE}/api/quotations?${params}`),
        fetch(`${API_BASE}/api/customers?pageSize=100`),
        fetch(`${API_BASE}/api/products?isActive=1&pageSize=100`)
      ])

      const [quoteData, custData, productData] = await Promise.all([
        quoteRes.json(),
        custRes.json(),
        productRes.json()
      ])
      
      if (quoteData.errCode === 200) {
        setQuotations(quoteData.data.list || [])
        setTotal(quoteData.data.total || 0)
      }
      if (custData.errCode === 200) setCustomers(custData.data.list || [])
      if (productData.errCode === 200) setProducts(productData.data.list || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载客户询价列表
  const loadInquiries = async () => {
    setInquiryLoading(true)
    try {
      const params = new URLSearchParams({
        page: inquiryPage.toString(),
        pageSize: pageSize.toString()
      })
      if (inquiryFilterStatus) params.append('status', inquiryFilterStatus)

      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/inquiry/manage/inquiries?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        setInquiries(data.data.list || [])
        setInquiryTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载客户询价失败:', error)
    } finally {
      setInquiryLoading(false)
    }
  }

  // 加载任务统计
  const loadTaskStats = async () => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/inquiry/tasks/stats`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()
      if (data.errCode === 200) {
        setTaskStats(data.data)
      }
    } catch (error) {
      console.error('加载任务统计失败:', error)
    }
  }

  // 开始处理询价
  const handleStartProcessing = async (inquiry: CustomerInquiry) => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/inquiry/manage/inquiries/${inquiry.id}/start`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadInquiries()
        loadTaskStats()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('开始处理失败:', error)
      alert('操作失败')
    }
  }

  // 查看询价详情
  const handleViewInquiry = (inquiry: CustomerInquiry) => {
    setSelectedInquiry(inquiry)
    setShowInquiryDetail(true)
  }

  // 获取询价类型标签
  const getInquiryTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      clearance: '清关询价',
      transport: '运输询价',
      combined: '综合询价'
    }
    return types[type] || type
  }

  // 获取询价状态信息
  const getInquiryStatusInfo = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return { label: '已超时', color: 'text-red-600', bg: 'bg-red-100' }
    }
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: '待处理', color: 'text-amber-600', bg: 'bg-amber-100' },
      processing: { label: '处理中', color: 'text-blue-600', bg: 'bg-blue-100' },
      quoted: { label: '已报价', color: 'text-green-600', bg: 'bg-green-100' },
      accepted: { label: '已接受', color: 'text-green-700', bg: 'bg-green-200' },
      rejected: { label: '已拒绝', color: 'text-gray-600', bg: 'bg-gray-100' },
      expired: { label: '已过期', color: 'text-gray-500', bg: 'bg-gray-100' }
    }
    return statusMap[status] || statusMap.pending
  }

  // 格式化时间
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
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

  // 从产品导入费用项
  const handleImportFromProducts = async () => {
    if (selectedProducts.length === 0) {
      alert('请选择至少一个产品')
      return
    }

    // 检查是否已有手动添加的项目（非产品项目）
    const hasManualItems = formData.items.some(item => 
      item.name.trim() && !item.productId && !item.feeItemId
    )
    
    if (hasManualItems) {
      if (!confirm('导入产品会清除当前手动添加的项目，是否继续？')) {
        return
      }
    }

    const newItems: QuotationItem[] = []
    let detectedCurrency: string | null = null
    
    for (const productId of selectedProducts) {
      const feeItems = await loadProductFeeItems(productId)
      feeItems.forEach(feeItem => {
        // 记录第一个费用项的币种
        if (!detectedCurrency && feeItem.currency) {
          detectedCurrency = feeItem.currency
        }
        
        newItems.push({
          name: feeItem.feeName,
          nameEn: feeItem.feeNameEn || '',
          description: '',
          quantity: 1,
          unit: feeItem.unit || '',
          price: feeItem.standardPrice,
          amount: feeItem.standardPrice,
          productId,
          feeItemId: feeItem.id
        })
      })
    }

    if (newItems.length > 0) {
      // 只保留从产品导入的项目（有 productId 的），清除手动项目
      const existingProductItems = formData.items.filter(item => item.productId || item.feeItemId)
      setFormData(prev => ({
        ...prev,
        items: [...existingProductItems, ...newItems],
        // 使用检测到的币种，如果没有则保持原币种
        currency: detectedCurrency || prev.currency
      }))
    }

    setShowProductModal(false)
    setSelectedProducts([])
  }

  // 生成PDF报价单
  const handleGeneratePdf = async (quotation: Quotation) => {
    setGeneratingPdf(true)
    try {
      const response = await fetch(`${API_BASE}/api/quotations/${quotation.id}/pdf`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `报价单_${quotation.quoteNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const data = await response.json()
        alert(data.msg || '生成PDF失败')
      }
    } catch (error) {
      console.error('生成PDF失败:', error)
      alert('生成PDF失败')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleOpenModal = (item?: Quotation) => {
    if (item) {
      // 计算有效期值和单位
      let validityValue = 30
      let validityUnit: 'day' | 'week' | 'month' | 'year' = 'day'
      
      if (item.validUntil && item.quoteDate) {
        const startDate = new Date(item.quoteDate)
        const endDate = new Date(item.validUntil)
        const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        
        // 智能判断最合适的单位
        if (daysDiff % 365 === 0 && daysDiff >= 365) {
          validityValue = daysDiff / 365
          validityUnit = 'year'
        } else if (daysDiff % 30 === 0 && daysDiff >= 30) {
          validityValue = daysDiff / 30
          validityUnit = 'month'
        } else if (daysDiff % 7 === 0 && daysDiff >= 7) {
          validityValue = daysDiff / 7
          validityUnit = 'week'
        } else {
          validityValue = daysDiff
          validityUnit = 'day'
        }
      }
      
      setEditingItem(item)
      setFormData({
        customerId: item.customerId || '',
        customerName: item.customerName || '',
        subject: item.subject || '',
        quoteDate: item.quoteDate || new Date().toISOString().split('T')[0],
        validUntil: item.validUntil || '',
        validityValue,
        validityUnit,
        currency: item.currency || 'EUR',
        terms: '',
        notes: '',
        items: item.items?.length > 0 ? item.items : [{ name: '', nameEn: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
      })
    } else {
      setEditingItem(null)
      setFormData({
        customerId: '',
        customerName: '',
        subject: '',
        quoteDate: new Date().toISOString().split('T')[0],
        validUntil: '',
        validityValue: 30,
        validityUnit: 'day',
        currency: 'EUR',
        terms: '',
        notes: '',
        items: [{ name: '', nameEn: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
      })
    }
    setShowModal(true)
  }

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
    return { subtotal, totalAmount: subtotal }
  }

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'quantity' || field === 'price') {
      newItems[index].amount = newItems[index].quantity * newItems[index].price
    }
    setFormData({ ...formData, items: newItems })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { name: '', nameEn: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
    })
  }

  // 翻译费用名称
  const handleTranslateItem = async (index: number) => {
    const item = formData.items[index]
    if (!item.name.trim()) return

    setTranslatingIndex(index)
    try {
      const response = await fetch(`${API_BASE}/api/translate/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name })
      })
      const result = await response.json()
      
      if (result.errCode === 200 && result.data?.translated) {
        handleItemChange(index, 'nameEn', result.data.translated)
      }
    } catch (error) {
      console.error('翻译失败:', error)
    } finally {
      setTranslatingIndex(null)
    }
  }

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      })
    }
  }

  const handleSubmit = async () => {
    if (!formData.customerName && !formData.customerId) {
      alert('请选择客户')
      return
    }

    const { subtotal, totalAmount } = calculateTotals()

    // 计算有效期截止日期
    const quoteDate = new Date(formData.quoteDate)
    let validUntil = new Date(quoteDate)
    
    switch (formData.validityUnit) {
      case 'day':
        validUntil.setDate(validUntil.getDate() + formData.validityValue)
        break
      case 'week':
        validUntil.setDate(validUntil.getDate() + formData.validityValue * 7)
        break
      case 'month':
        validUntil.setMonth(validUntil.getMonth() + formData.validityValue)
        break
      case 'year':
        validUntil.setFullYear(validUntil.getFullYear() + formData.validityValue)
        break
    }

    try {
      const url = editingItem 
        ? `${API_BASE}/api/quotations/${editingItem.id}`
        : `${API_BASE}/api/quotations`
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          validUntil: validUntil.toISOString().split('T')[0],
          subtotal,
          totalAmount,
          items: formData.items.filter(item => item.name)
        })
      })

      const data = await response.json()
      if (data.errCode === 200) {
        setShowModal(false)
        loadData()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  const handleDelete = async (item: Quotation) => {
    if (!confirm(`确定要删除报价单"${item.quoteNumber}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/quotations/${item.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const formatCurrency = (value: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value)
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: any; color: string; bg: string }> = {
      draft: { label: '草稿', icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
      sent: { label: '已发送', icon: Send, color: 'text-blue-600', bg: 'bg-blue-100' },
      accepted: { label: '已接受', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
      rejected: { label: '已拒绝', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
      expired: { label: '已过期', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' }
    }
    return statusMap[status] || statusMap.draft
  }

  const columns: Column<Quotation>[] = useMemo(() => [
    {
      key: 'quoteNumber',
      label: '报价单号',
      width: 140,
      sorter: true,
      render: (_value, record) => (
        <span className="text-primary-600 font-medium text-xs">{record.quoteNumber}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户',
      width: 140,
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <span className="text-xs text-gray-900">{record.customerName || '-'}</span>
      )
    },
    {
      key: 'subject',
      label: '主题',
      width: 180,
      sorter: true,
      render: (_value, record) => (
        <span className="text-xs text-gray-700 line-clamp-1">{record.subject || '-'}</span>
      )
    },
    {
      key: 'totalAmount',
      label: '金额',
      width: 120,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (_value, record) => (
        <span className="text-xs font-medium text-gray-900">
          {formatCurrency(record.totalAmount, record.currency)}
        </span>
      )
    },
    {
      key: 'quoteDate',
      label: '报价日期',
      width: 100,
      sorter: (a, b) => {
        const dateA = a.quoteDate ? new Date(a.quoteDate).getTime() : 0
        const dateB = b.quoteDate ? new Date(b.quoteDate).getTime() : 0
        return dateA - dateB
      },
      render: (_value, record) => (
        <span className="text-xs text-gray-500">{record.quoteDate || '-'}</span>
      )
    },
    {
      key: 'validUntil',
      label: '有效期至',
      width: 100,
      sorter: (a, b) => {
        const dateA = a.validUntil ? new Date(a.validUntil).getTime() : 0
        const dateB = b.validUntil ? new Date(b.validUntil).getTime() : 0
        return dateA - dateB
      },
      render: (_value, record) => (
        <span className="text-xs text-gray-500">{record.validUntil || '-'}</span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 90,
      sorter: true,
      filters: [
        { text: '草稿', value: 'draft' },
        { text: '已发送', value: 'sent' },
        { text: '已接受', value: 'accepted' },
        { text: '已拒绝', value: 'rejected' },
        { text: '已过期', value: 'expired' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (_value, record) => {
        const info = getStatusInfo(record.status)
        const Icon = info.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            <Icon className="w-3 h-3" />
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      width: 180,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          {record.status === 'draft' && (
            <button
              onClick={() => handleUpdateStatus(record.id, 'sent')}
              className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              发送
            </button>
          )}
          {record.status === 'sent' && (
            <>
              <button
                onClick={() => handleUpdateStatus(record.id, 'accepted')}
                className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
              >
                接受
              </button>
              <button
                onClick={() => handleUpdateStatus(record.id, 'rejected')}
                className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                拒绝
              </button>
            </>
          )}
          <button 
            onClick={() => handleGeneratePdf(record)}
            disabled={generatingPdf}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-orange-600"
            title="下载报价单PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleOpenModal(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleDelete(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [generatingPdf])

  // 客户询价表格列
  const inquiryColumns: Column<CustomerInquiry>[] = useMemo(() => [
    {
      key: 'inquiryNumber',
      label: '询价编号',
      width: 130,
      render: (_value, record) => (
        <span className="text-primary-600 font-medium text-xs">{record.inquiryNumber}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户',
      width: 120,
      render: (_value, record) => (
        <span className="text-xs text-gray-900">{record.customerName || '-'}</span>
      )
    },
    {
      key: 'inquiryType',
      label: '类型',
      width: 90,
      render: (_value, record) => {
        const typeIcons: Record<string, any> = {
          transport: Truck,
          clearance: FileText,
          combined: Package
        }
        const Icon = typeIcons[record.inquiryType] || Package
        return (
          <span className="inline-flex items-center gap-1 text-xs text-gray-700">
            <Icon className="w-3 h-3" />
            {getInquiryTypeLabel(record.inquiryType)}
          </span>
        )
      }
    },
    {
      key: 'transportData',
      label: '路线/内容',
      width: 200,
      render: (_value, record) => {
        if (record.transportData) {
          return (
            <div className="text-xs">
              <div className="flex items-center gap-1 text-gray-700">
                <MapPin className="w-3 h-3 text-green-500" />
                <span className="truncate max-w-[80px]">{record.transportData.origin}</span>
                <span>→</span>
                <MapPin className="w-3 h-3 text-red-500" />
                <span className="truncate max-w-[80px]">{record.transportData.destination}</span>
              </div>
              {record.transportData.transportMode === 'container' && (
                <span className="text-gray-400 text-[10px]">
                  {record.transportData.containerType} / {record.transportData.returnLocation === 'same' ? '同地还柜' : '异地还柜'}
                </span>
              )}
            </div>
          )
        }
        return <span className="text-xs text-gray-400">-</span>
      }
    },
    {
      key: 'assignedToName',
      label: '处理人',
      width: 80,
      render: (_value, record) => (
        <span className="text-xs text-gray-600">
          {record.assignedToName || <span className="text-amber-500">未分配</span>}
        </span>
      )
    },
    {
      key: 'priority',
      label: '优先级',
      width: 70,
      render: (_value, record) => {
        const priorityMap: Record<string, { label: string; color: string }> = {
          urgent: { label: '紧急', color: 'text-red-600 bg-red-100' },
          high: { label: '高', color: 'text-orange-600 bg-orange-100' },
          normal: { label: '普通', color: 'text-gray-600 bg-gray-100' },
          low: { label: '低', color: 'text-gray-400 bg-gray-50' }
        }
        const info = priorityMap[record.priority] || priorityMap.normal
        return (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'status',
      label: '状态',
      width: 80,
      render: (_value, record) => {
        const info = getInquiryStatusInfo(record.status, record.isOverdue)
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            {record.isOverdue && <AlertCircle className="w-3 h-3" />}
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'dueAt',
      label: '截止时间',
      width: 100,
      render: (_value, record) => {
        if (!record.dueAt) return <span className="text-xs text-gray-400">-</span>
        const isNearDue = new Date(record.dueAt).getTime() - Date.now() < 4 * 60 * 60 * 1000 // 4小时内
        return (
          <span className={`text-[10px] ${record.isOverdue ? 'text-red-500' : isNearDue ? 'text-amber-500' : 'text-gray-500'}`}>
            {formatDateTime(record.dueAt)}
          </span>
        )
      }
    },
    {
      key: 'createdAt',
      label: '创建时间',
      width: 100,
      render: (_value, record) => (
        <span className="text-[10px] text-gray-400">{formatDateTime(record.createdAt)}</span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 140,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          {record.status === 'pending' && record.assignedTo === user?.id && (
            <button
              onClick={() => handleStartProcessing(record)}
              className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              开始处理
            </button>
          )}
          {(record.status === 'pending' || record.status === 'processing') && (
            <button
              onClick={() => handleViewInquiry(record)}
              className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
            >
              报价
            </button>
          )}
          <button
            onClick={() => handleViewInquiry(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="查看详情"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [user?.id])

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' }
  ]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { subtotal, totalAmount } = calculateTotals()

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/quotations"
        onTabChange={(path) => navigate(path)}
      />

      {/* 视图切换标签 */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-2">
        <button
          onClick={() => setActiveView('quotations')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            activeView === 'quotations'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4 inline-block mr-1" />
          报价单管理
        </button>
        <button
          onClick={() => setActiveView('inquiries')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
            activeView === 'inquiries'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          客户询价
          {taskStats.pendingCount > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
              activeView === 'inquiries' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
            }`}>
              {taskStats.pendingCount}
            </span>
          )}
          {taskStats.overdueCount > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
              activeView === 'inquiries' ? 'bg-red-400 text-white' : 'bg-red-100 text-red-600'
            }`}>
              超时 {taskStats.overdueCount}
            </span>
          )}
        </button>
      </div>

      {/* 报价单视图 */}
      {activeView === 'quotations' && (
        <>
      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索报价单号、客户..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="筛选报价状态"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="sent">已发送</option>
            <option value="accepted">已接受</option>
            <option value="rejected">已拒绝</option>
            <option value="expired">已过期</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          新建报价
        </button>
      </div>
        </>
      )}

      {/* 客户询价视图 */}
      {activeView === 'inquiries' && (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">待处理</div>
                  <div className="text-2xl font-bold text-amber-600">{taskStats.pendingCount}</div>
                </div>
                <Clock className="w-8 h-8 text-amber-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">处理中</div>
                  <div className="text-2xl font-bold text-blue-600">{taskStats.processingCount}</div>
                </div>
                <Play className="w-8 h-8 text-blue-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">已超时</div>
                  <div className="text-2xl font-bold text-red-600">{taskStats.overdueCount}</div>
                </div>
                <AlertCircle className="w-8 h-8 text-red-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">今日完成</div>
                  <div className="text-2xl font-bold text-green-600">{taskStats.todayCompleted}</div>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </div>
          </div>

          {/* 询价工具栏 */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <select
                value={inquiryFilterStatus}
                onChange={(e) => {
                  setInquiryFilterStatus(e.target.value)
                  setInquiryPage(1)
                }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                title="筛选询价状态"
              >
                <option value="">全部状态</option>
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="quoted">已报价</option>
                <option value="accepted">已接受</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>

            <div className="text-xs text-gray-500">
              共 {inquiryTotal} 条询价
            </div>
          </div>

          {/* 询价表格 */}
          <DataTable
            columns={inquiryColumns}
            data={inquiries}
            loading={inquiryLoading}
            rowKey="id"
          />

          {/* 询价分页 */}
          {inquiryTotal > pageSize && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500">
                共 {inquiryTotal} 条记录
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInquiryPage(p => Math.max(1, p - 1))}
                  disabled={inquiryPage === 1}
                  className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setInquiryPage(p => Math.min(Math.ceil(inquiryTotal / pageSize), p + 1))}
                  disabled={inquiryPage >= Math.ceil(inquiryTotal / pageSize)}
                  className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 报价单数据表格 */}
      {activeView === 'quotations' && (
        <>
      <DataTable
        columns={columns}
        data={quotations}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">
            共 {total} 条记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
              title="每页显示条数"
            >
              <option value={20}>20 条/页</option>
              <option value={50}>50 条/页</option>
              <option value={100}>100 条/页</option>
            </select>
          </div>
        </div>
          )}
        </>
      )}

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[720px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-sm font-medium">{editingItem ? '编辑报价单' : '新建报价单'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户 *</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value)
                      setFormData({
                        ...formData, 
                        customerId: e.target.value,
                        customerName: customer?.customerName || ''
                      })
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    title="选择客户"
                  >
                    <option value="">请选择客户</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">主题</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入报价件数-产品品名"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">报价日期</label>
                  <DatePicker
                    value={formData.quoteDate}
                    onChange={(value) => setFormData({...formData, quoteDate: value})}
                    placeholder="选择报价日期"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">有效期</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.validityValue}
                    onChange={(e) => setFormData({...formData, validityValue: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="数量"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">单位</label>
                  <select
                    value={formData.validityUnit}
                    onChange={(e) => setFormData({...formData, validityUnit: e.target.value as 'day' | 'week' | 'month' | 'year'})}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="day">天</option>
                    <option value="week">周</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    币种
                    {formData.items.some(item => item.productId || item.feeItemId) && (
                      <span className="ml-1 text-[10px] text-amber-600">(由产品决定)</span>
                    )}
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    disabled={formData.items.some(item => item.productId || item.feeItemId)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    title={formData.items.some(item => item.productId || item.feeItemId) ? "已导入产品，币种由产品决定" : "选择币种"}
                  >
                    <option value="CNY">人民币 (CNY)</option>
                    <option value="USD">美元 (USD)</option>
                    <option value="EUR">欧元 (EUR)</option>
                  </select>
                </div>
              </div>

              {/* 报价明细 */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-medium text-gray-700">报价明细</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowProductModal(true)}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <Package className="w-3.5 h-3.5" />
                      从产品导入
                    </button>
                    <button
                      onClick={addItem}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      + 添加项目
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-[10px] text-gray-500 font-medium">
                    <div className="col-span-3">项目名称（中文）</div>
                    <div className="col-span-2">英文名称</div>
                    <div className="col-span-2 text-center">数量</div>
                    <div className="col-span-2">单价</div>
                    <div className="col-span-2">金额</div>
                    <div className="col-span-1"></div>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={(e) => {
                          setIsComposing(false)
                          // 输入法确认后，更新值并触发翻译
                          const value = (e.target as HTMLInputElement).value
                          if (value.trim()) {
                            handleItemChange(index, 'name', value)
                            // 清空旧的英文名称并重新翻译
                            handleItemChange(index, 'nameEn', '')
                            setTimeout(() => handleTranslateItem(index), 100)
                          }
                        }}
                        onBlur={() => {
                          // 只在非输入法状态下触发翻译
                          if (!isComposing && item.name.trim() && !item.nameEn) {
                            handleTranslateItem(index)
                          }
                        }}
                        className="col-span-3 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="中文名称"
                      />
                      <div className="col-span-2 relative">
                        <input
                          type="text"
                          value={item.nameEn || ''}
                          readOnly
                          className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                          placeholder="英文名称"
                          title="自动翻译，不可编辑"
                        />
                        {translatingIndex === index && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '')
                          handleItemChange(index, 'quantity', parseFloat(val) || 0)
                        }}
                        className="col-span-2 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white text-center"
                        placeholder="数量"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.price}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '')
                          handleItemChange(index, 'price', parseFloat(val) || 0)
                        }}
                        className="col-span-2 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="单价"
                      />
                      <div className="col-span-2 text-sm text-gray-700 font-medium">
                        {formatCurrency(item.quantity * item.price, formData.currency)}
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="col-span-1 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                        disabled={formData.items.length <= 1}
                        title="删除"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t flex justify-end">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">合计金额</div>
                    <div className="text-lg font-bold text-primary-600">
                      {formatCurrency(totalAmount, formData.currency)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 产品选择模态框 */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                从产品库导入费用项
              </h3>
              <button onClick={() => { setShowProductModal(false); setSelectedProducts([]) }} className="p-1 hover:bg-gray-100 rounded" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-xs text-gray-500 mb-3">选择产品后，将自动导入该产品下的所有费用项</p>
              
              {products.length > 0 ? (
                <div className="space-y-2">
                  {products.map(product => (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProducts.includes(product.id)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(prev => [...prev, product.id])
                          } else {
                            setSelectedProducts(prev => prev.filter(id => id !== product.id))
                          }
                        }}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{product.productName}</span>
                          <span className="text-xs text-gray-400">{product.productCode}</span>
                        </div>
                        {product.productNameEn && (
                          <div className="text-xs text-gray-500">{product.productNameEn}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">暂无可用产品</p>
                  <button
                    onClick={() => navigate('/tools/product-pricing')}
                    className="mt-2 text-primary-600 hover:text-primary-700 text-xs"
                  >
                    去添加产品
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowProductModal(false); setSelectedProducts([]) }}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={handleImportFromProducts}
                disabled={selectedProducts.length === 0}
                className="px-4 py-2 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                导入 ({selectedProducts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 询价详情弹窗 */}
      {showInquiryDetail && selectedInquiry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">询价详情</h3>
                <span className="text-xs text-gray-400">{selectedInquiry.inquiryNumber}</span>
              </div>
              <button onClick={() => setShowInquiryDetail(false)} className="p-1 hover:bg-gray-100 rounded" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-700 mb-3">基本信息</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">客户：</span>
                    <span className="text-gray-900 ml-1">{selectedInquiry.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">类型：</span>
                    <span className="text-gray-900 ml-1">{getInquiryTypeLabel(selectedInquiry.inquiryType)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">来源：</span>
                    <span className="text-gray-900 ml-1">{selectedInquiry.source === 'portal' ? '客户门户' : 'CRM'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">优先级：</span>
                    <span className={`ml-1 ${selectedInquiry.priority === 'urgent' ? 'text-red-600' : 'text-gray-900'}`}>
                      {selectedInquiry.priority === 'urgent' ? '紧急' : selectedInquiry.priority === 'high' ? '高' : '普通'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">处理人：</span>
                    <span className="text-gray-900 ml-1">{selectedInquiry.assignedToName || '未分配'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">状态：</span>
                    <span className={`ml-1 ${getInquiryStatusInfo(selectedInquiry.status, selectedInquiry.isOverdue).color}`}>
                      {getInquiryStatusInfo(selectedInquiry.status, selectedInquiry.isOverdue).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* 运输信息 */}
              {selectedInquiry.transportData && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-xs font-medium text-blue-700 mb-3 flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    运输信息
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-green-500" />
                      <span className="text-gray-600">起点：</span>
                      <span className="text-gray-900">{selectedInquiry.transportData.origin}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span className="text-gray-600">终点：</span>
                      <span className="text-gray-900">{selectedInquiry.transportData.destination}</span>
                    </div>
                    {selectedInquiry.transportData.transportMode === 'container' && (
                      <>
                        <div>
                          <span className="text-gray-600">运输方式：</span>
                          <span className="text-gray-900 ml-1">集装箱原柜</span>
                        </div>
                        <div>
                          <span className="text-gray-600">柜型：</span>
                          <span className="text-gray-900 ml-1">{selectedInquiry.transportData.containerType || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">还柜方式：</span>
                          <span className="text-gray-900 ml-1">
                            {selectedInquiry.transportData.returnLocation === 'same' ? '同地还柜' : '异地还柜'}
                          </span>
                        </div>
                        {selectedInquiry.transportData.returnLocation === 'different' && selectedInquiry.transportData.returnAddress && (
                          <div>
                            <span className="text-gray-600">还柜地址：</span>
                            <span className="text-gray-900 ml-1">{selectedInquiry.transportData.returnAddress}</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedInquiry.transportData.transportMode === 'truck' && (
                      <div>
                        <span className="text-gray-600">运输方式：</span>
                        <span className="text-gray-900 ml-1">卡车运输</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 时间信息 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-700 mb-3">时间信息</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">创建时间：</span>
                    <span className="text-gray-900 ml-1">{formatDateTime(selectedInquiry.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">截止时间：</span>
                    <span className={`ml-1 ${selectedInquiry.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatDateTime(selectedInquiry.dueAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowInquiryDetail(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
              {(selectedInquiry.status === 'pending' || selectedInquiry.status === 'processing') && (
                <button
                  onClick={() => {
                    // TODO: 跳转到报价页面或打开报价弹窗
                    setShowInquiryDetail(false)
                    // 创建报价单并预填信息
                    setFormData({
                      customerId: selectedInquiry.customerId,
                      customerName: selectedInquiry.customerName,
                      subject: `${getInquiryTypeLabel(selectedInquiry.inquiryType)} - ${selectedInquiry.inquiryNumber}`,
                      quoteDate: new Date().toISOString().split('T')[0],
                      validUntil: '',
                      validityValue: 30,
                      validityUnit: 'day',
                      currency: 'EUR',
                      terms: '',
                      notes: `关联询价：${selectedInquiry.inquiryNumber}`,
                      items: [{ name: '', nameEn: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
                    })
                    setActiveView('quotations')
                    setShowModal(true)
                  }}
                  className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                >
                  创建报价单
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

