import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, FileText, Edit, Trash2, X, 
  Send, CheckCircle, XCircle, Clock
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
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
  description?: string
  quantity: number
  unit?: string
  price: number
  amount: number
}

interface Customer {
  id: string
  customerName: string
}

export default function CRMQuotations() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
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
    items: [{ name: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }] as QuotationItem[]
  })

   
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

      const [quoteRes, custRes] = await Promise.all([
        fetch(`${API_BASE}/api/quotations?${params}`),
        fetch(`${API_BASE}/api/customers?pageSize=100`)
      ])

      const [quoteData, custData] = await Promise.all([
        quoteRes.json(),
        custRes.json()
      ])
      
      if (quoteData.errCode === 200) {
        setQuotations(quoteData.data.list || [])
        setTotal(quoteData.data.total || 0)
      }
      if (custData.errCode === 200) setCustomers(custData.data.list || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
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
        items: item.items?.length > 0 ? item.items : [{ name: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
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
        items: [{ name: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
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
      items: [...formData.items, { name: '', description: '', quantity: 1, unit: '', price: 0, amount: 0 }]
    })
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
      render: (item) => (
        <span className="text-primary-600 font-medium text-xs">{item.quoteNumber}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户',
      width: 140,
      render: (item) => (
        <span className="text-xs text-gray-900">{item.customerName || '-'}</span>
      )
    },
    {
      key: 'subject',
      label: '主题',
      width: 180,
      render: (item) => (
        <span className="text-xs text-gray-700 line-clamp-1">{item.subject || '-'}</span>
      )
    },
    {
      key: 'totalAmount',
      label: '金额',
      width: 120,
      render: (item) => (
        <span className="text-xs font-medium text-gray-900">
          {formatCurrency(item.totalAmount, item.currency)}
        </span>
      )
    },
    {
      key: 'quoteDate',
      label: '报价日期',
      width: 100,
      render: (item) => (
        <span className="text-xs text-gray-500">{item.quoteDate || '-'}</span>
      )
    },
    {
      key: 'validUntil',
      label: '有效期至',
      width: 100,
      render: (item) => (
        <span className="text-xs text-gray-500">{item.validUntil || '-'}</span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 90,
      render: (item) => {
        const info = getStatusInfo(item.status)
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
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.status === 'draft' && (
            <button
              onClick={() => handleUpdateStatus(item.id, 'sent')}
              className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              发送
            </button>
          )}
          {item.status === 'sent' && (
            <>
              <button
                onClick={() => handleUpdateStatus(item.id, 'accepted')}
                className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
              >
                接受
              </button>
              <button
                onClick={() => handleUpdateStatus(item.id, 'rejected')}
                className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                拒绝
              </button>
            </>
          )}
          <button 
            onClick={() => handleOpenModal(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleDelete(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
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
                  <input
                    type="date"
                    value={formData.quoteDate}
                    onChange={(e) => setFormData({...formData, quoteDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">有效期至</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
                  <button
                    onClick={addItem}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    + 添加项目
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 font-medium">
                    <div className="col-span-4">项目名称</div>
                    <div className="col-span-2">数量</div>
                    <div className="col-span-2">单价</div>
                    <div className="col-span-3">金额</div>
                    <div className="col-span-1"></div>
                  </div>
                  
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="col-span-4 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="项目名称"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        min="0"
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                        className="col-span-2 px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        min="0"
                        step="0.01"
                      />
                      <div className="col-span-3 text-xs text-gray-700 font-medium">
                        {formatCurrency(item.quantity * item.price, formData.currency)}
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="col-span-1 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                        disabled={formData.items.length <= 1}
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
    </div>
  )
}

