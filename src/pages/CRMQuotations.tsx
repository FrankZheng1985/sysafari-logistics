import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, FileText, Edit, Trash2, X, 
  Send, CheckCircle, XCircle, Clock, Languages, Loader2, Package, Download
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'

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

export default function CRMQuotations() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
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
    currency: 'EUR',
    terms: '',
    notes: '',
    items: [{ name: '', nameEn: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }] as QuotationItem[]
  })
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

   
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, filterStatus])

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

    const newItems: QuotationItem[] = []
    
    for (const productId of selectedProducts) {
      const feeItems = await loadProductFeeItems(productId)
      feeItems.forEach(feeItem => {
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
      // 合并到现有项目（移除空白项）
      const existingItems = formData.items.filter(item => item.name.trim())
      setFormData(prev => ({
        ...prev,
        items: [...existingItems, ...newItems]
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
      setEditingItem(item)
      setFormData({
        customerId: item.customerId || '',
        customerName: item.customerName || '',
        subject: item.subject || '',
        quoteDate: item.quoteDate || new Date().toISOString().split('T')[0],
        validUntil: item.validUntil || '',
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

    try {
      const url = editingItem 
        ? `/api/quotations/${editingItem.id}`
        : '/api/quotations'
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
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
      render: (_value, record) => (
        <span className="text-primary-600 font-medium text-xs">{record.quoteNumber}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户',
      width: 140,
      render: (_value, record) => (
        <span className="text-xs text-gray-900">{record.customerName || '-'}</span>
      )
    },
    {
      key: 'subject',
      label: '主题',
      width: 180,
      render: (_value, record) => (
        <span className="text-xs text-gray-700 line-clamp-1">{record.subject || '-'}</span>
      )
    },
    {
      key: 'totalAmount',
      label: '金额',
      width: 120,
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
      render: (_value, record) => (
        <span className="text-xs text-gray-500">{record.quoteDate || '-'}</span>
      )
    },
    {
      key: 'validUntil',
      label: '有效期至',
      width: 100,
      render: (_value, record) => (
        <span className="text-xs text-gray-500">{record.validUntil || '-'}</span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 90,
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

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
    { label: '提成规则', path: '/crm/commission/rules' },
    { label: '提成记录', path: '/crm/commission/records' },
    { label: '月度结算', path: '/crm/commission/settlements' },
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
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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

      {/* 数据表格 */}
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
          </div>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[720px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-sm font-medium">{editingItem ? '编辑报价单' : '新建报价单'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
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
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入报价主题"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">报价日期</label>
                  <DatePicker
                    value={formData.quoteDate}
                    onChange={(value) => setFormData({...formData, quoteDate: value})}
                    placeholder="选择报价日期"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">有效期至</label>
                  <DatePicker
                    value={formData.validUntil}
                    onChange={(value) => setFormData({...formData, validUntil: value})}
                    placeholder="选择有效期"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">币种</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
                
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 font-medium">
                    <div className="col-span-3">项目名称（中文）</div>
                    <div className="col-span-2">英文名称</div>
                    <div className="col-span-2 text-center">数量</div>
                    <div className="col-span-2">单价</div>
                    <div className="col-span-2">金额</div>
                    <div className="col-span-1"></div>
                  </div>

                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="col-span-3 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="中文名称"
                      />
                      <div className="col-span-2 flex gap-1">
                        <input
                          type="text"
                          value={item.nameEn || ''}
                          onChange={(e) => handleItemChange(index, 'nameEn', e.target.value)}
                          className="flex-1 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                          placeholder="英文名称"
                        />
                        <button
                          type="button"
                          onClick={() => handleTranslateItem(index)}
                          disabled={translatingIndex === index || !item.name.trim()}
                          className="px-1.5 py-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                          title="翻译"
                        >
                          {translatingIndex === index ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Languages className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0"
                        placeholder="数量"
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0"
                        step="0.01"
                        placeholder="单价"
                      />
                      <div className="col-span-2 text-xs text-gray-700 font-medium">
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
              <button onClick={() => { setShowProductModal(false); setSelectedProducts([]) }} className="p-1 hover:bg-gray-100 rounded">
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
    </div>
  )
}

