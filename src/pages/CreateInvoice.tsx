import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft, Save, FileText, Plus, Trash2, 
  Search, Calculator, AlertCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'

interface Customer {
  id: string
  name: string
  code?: string
  contactName?: string
  phone?: string
}

interface Bill {
  id: string
  billNumber: string
  customerName?: string
  customerId?: string
  totalWeight?: number
  totalVolume?: number
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  taxRate: number
  taxAmount: number
}

interface InvoiceFormData {
  invoiceType: 'sales' | 'purchase'
  invoiceDate: string
  dueDate: string
  customerId: string
  customerName: string
  billId: string
  billNumber: string
  currency: string
  exchangeRate: number
  description: string
  notes: string
  status: string
  items: InvoiceItem[]
}

export default function CreateInvoice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialType = searchParams.get('type') as 'sales' | 'purchase' || 'sales'
  
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [billSearch, setBillSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  
  // Refs for click outside detection
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const billDropdownRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceType: initialType,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    customerId: '',
    customerName: '',
    billId: '',
    billNumber: '',
    currency: 'CNY',
    exchangeRate: 1,
    description: '',
    notes: '',
    status: 'pending',
    items: [
      { id: '1', description: '', quantity: 1, unitPrice: 0, amount: 0, taxRate: 0, taxAmount: 0 }
    ]
  })

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
  ]

  const currencies = [
    { value: 'CNY', label: '人民币 (CNY)' },
    { value: 'USD', label: '美元 (USD)' },
    { value: 'EUR', label: '欧元 (EUR)' },
    { value: 'GBP', label: '英镑 (GBP)' },
    { value: 'JPY', label: '日元 (JPY)' },
  ]

  const taxRates = [
    { value: 0, label: '0%' },
    { value: 3, label: '3%' },
    { value: 6, label: '6%' },
    { value: 9, label: '9%' },
    { value: 13, label: '13%' },
  ]

  useEffect(() => {
    fetchCustomers()
    fetchBills()
  }, [])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
      if (billDropdownRef.current && !billDropdownRef.current.contains(event.target as Node)) {
        setShowBillDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchCustomers = async (search = '') => {
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (search) params.append('search', search)
      
      const response = await fetch(`/api/customers?${params}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setCustomers(data.data.list)
      }
    } catch (error) {
      console.error('获取客户列表失败:', error)
    }
  }

  const fetchBills = async (search = '') => {
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (search) params.append('search', search)
      
      const response = await fetch(`/api/bills?${params}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setBills(data.data.list)
      }
    } catch (error) {
      console.error('获取提单列表失败:', error)
    }
  }

  // 计算单行金额
  const calculateItemAmount = (item: InvoiceItem) => {
    const amount = item.quantity * item.unitPrice
    const taxAmount = amount * (item.taxRate / 100)
    return { amount, taxAmount }
  }

  // 更新发票项
  const updateItem = (id: string, field: keyof InvoiceItem, value: number | string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== id) return item
        
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
          const { amount, taxAmount } = calculateItemAmount(updated)
          updated.amount = amount
          updated.taxAmount = taxAmount
        }
        return updated
      })
    }))
  }

  // 添加发票项
  const addItem = () => {
    const newId = (Math.max(...formData.items.map(i => parseInt(i.id))) + 1).toString()
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { 
        id: newId, 
        description: '', 
        quantity: 1, 
        unitPrice: 0, 
        amount: 0, 
        taxRate: 0, 
        taxAmount: 0 
      }]
    }))
  }

  // 删除发票项
  const removeItem = (id: string) => {
    if (formData.items.length <= 1) return
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }))
  }

  // 计算合计
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0)
    const taxAmount = formData.items.reduce((sum, item) => sum + item.taxAmount, 0)
    const totalAmount = subtotal + taxAmount
    return { subtotal, taxAmount, totalAmount }
  }

  // 选择客户
  const selectCustomer = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name
    }))
    setCustomerSearch(customer.name)
    setShowCustomerDropdown(false)
  }

  // 选择提单
  const selectBill = (bill: Bill) => {
    setFormData(prev => ({
      ...prev,
      billId: bill.id,
      billNumber: bill.billNumber,
      // 如果提单有关联客户且当前未选择客户，自动填充
      ...(bill.customerId && !prev.customerId ? {
        customerId: bill.customerId,
        customerName: bill.customerName || ''
      } : {})
    }))
    setBillSearch(bill.billNumber)
    setShowBillDropdown(false)
    
    // 如果提单有关联客户，更新客户搜索框显示
    if (bill.customerId && !formData.customerId && bill.customerName) {
      setCustomerSearch(bill.customerName)
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    // 表单验证
    const totals = calculateTotals()
    
    if (totals.totalAmount <= 0) {
      alert('发票金额必须大于0')
      return
    }

    if (!formData.customerName.trim()) {
      alert('请选择或输入客户/供应商')
      return
    }

    // 检查是否有空的发票项
    const hasEmptyItem = formData.items.some(item => !item.description.trim())
    if (hasEmptyItem) {
      alert('请填写所有发票项的描述')
      return
    }

    setLoading(true)
    try {
      const submitData = {
        invoiceType: formData.invoiceType,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || null,
        customerId: formData.customerId || null,
        customerName: formData.customerName,
        billId: formData.billId || null,
        billNumber: formData.billNumber || '',
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        currency: formData.currency,
        exchangeRate: formData.exchangeRate,
        description: formData.description || formData.items.map(i => i.description).join('; '),
        notes: formData.notes,
        status: formData.status
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      const data = await response.json()
      
      if (data.errCode === 200) {
        alert('发票创建成功')
        navigate('/finance/invoices')
      } else {
        alert(data.msg || '创建失败')
      }
    } catch (error) {
      console.error('创建发票失败:', error)
      alert('创建发票失败')
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, taxAmount, totalAmount } = calculateTotals()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: formData.currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/invoices"
        onTabChange={(path) => navigate(path)}
      />

      {/* 页面标题 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/finance/invoices')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              新建{formData.invoiceType === 'sales' ? '销售' : '采购'}发票
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance/invoices')}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : '保存发票'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 左侧：基本信息 */}
        <div className="col-span-2 space-y-4">
          {/* 发票类型和基本信息 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4">基本信息</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {/* 发票类型 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  发票类型 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, invoiceType: 'sales' }))}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      formData.invoiceType === 'sales'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    销售发票（应收）
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, invoiceType: 'purchase' }))}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      formData.invoiceType === 'purchase'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    采购发票（应付）
                  </button>
                </div>
              </div>

              {/* 状态 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="draft">草稿</option>
                  <option value="pending">待付款</option>
                </select>
              </div>

              {/* 发票日期 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  发票日期 <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={formData.invoiceDate}
                  onChange={(value) => setFormData(prev => ({ ...prev, invoiceDate: value }))}
                  placeholder="请选择发票日期"
                  className="!px-3 !py-2 !text-sm !rounded-lg"
                />
              </div>

              {/* 到期日期 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  到期日期
                </label>
                <DatePicker
                  value={formData.dueDate}
                  onChange={(value) => setFormData(prev => ({ ...prev, dueDate: value }))}
                  placeholder="请选择到期日期"
                  className="!px-3 !py-2 !text-sm !rounded-lg"
                />
              </div>

              {/* 客户/供应商 */}
              <div className="relative" ref={customerDropdownRef}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {formData.invoiceType === 'sales' ? '客户' : '供应商'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setFormData(prev => ({ ...prev, customerName: e.target.value }))
                      fetchCustomers(e.target.value)
                      setShowCustomerDropdown(true)
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder={`搜索或输入${formData.invoiceType === 'sales' ? '客户' : '供应商'}名称...`}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {showCustomerDropdown && customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="text-sm text-gray-900">{customer.name}</div>
                        {customer.code && (
                          <div className="text-xs text-gray-500">{customer.code}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 关联提单 */}
              <div className="relative" ref={billDropdownRef}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  关联提单
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={billSearch}
                    onChange={(e) => {
                      setBillSearch(e.target.value)
                      setFormData(prev => ({ ...prev, billNumber: e.target.value }))
                      fetchBills(e.target.value)
                      setShowBillDropdown(true)
                    }}
                    onFocus={() => setShowBillDropdown(true)}
                    placeholder="搜索提单号..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {showBillDropdown && bills.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {bills.map(bill => (
                      <div
                        key={bill.id}
                        onClick={() => selectBill(bill)}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="text-sm text-gray-900">{bill.billNumber}</div>
                        {bill.customerName && (
                          <div className="text-xs text-gray-500">{bill.customerName}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 货币 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  货币
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {currencies.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* 汇率 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  汇率
                </label>
                <input
                  type="number"
                  value={formData.exchangeRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) || 1 }))}
                  min="0"
                  step="0.0001"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* 发票明细 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-900">发票明细</h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加项目
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 w-8">#</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">描述</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-600 w-20">数量</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-600 w-28">单价</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-600 w-20">税率</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 w-28">金额</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 w-24">税额</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-600 w-12">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-500">{index + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="输入项目描述..."
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="1"
                          className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={item.taxRate}
                          onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value))}
                          className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                          {taxRates.map(rate => (
                            <option key={rate.value} value={rate.value}>{rate.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600">
                        {formatCurrency(item.taxAmount)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={formData.items.length <= 1}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 备注 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">备注信息</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">发票说明</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="输入发票说明..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">内部备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="输入内部备注（不会显示在发票上）..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：金额汇总 */}
        <div className="space-y-4">
          {/* 金额汇总卡片 */}
          <div className={`rounded-lg border p-4 ${
            formData.invoiceType === 'sales' 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator className={`w-5 h-5 ${
                formData.invoiceType === 'sales' ? 'text-blue-600' : 'text-orange-600'
              }`} />
              <h2 className={`text-sm font-medium ${
                formData.invoiceType === 'sales' ? 'text-blue-700' : 'text-orange-700'
              }`}>
                金额汇总
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">小计</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">税额</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    formData.invoiceType === 'sales' ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    {formData.invoiceType === 'sales' ? '应收金额' : '应付金额'}
                  </span>
                  <span className={`text-lg font-bold ${
                    formData.invoiceType === 'sales' ? 'text-blue-700' : 'text-orange-700'
                  }`}>
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 发票信息预览 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">发票信息预览</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">类型</span>
                <span className={`font-medium ${
                  formData.invoiceType === 'sales' ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  {formData.invoiceType === 'sales' ? '销售发票' : '采购发票'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">状态</span>
                <span className="font-medium text-gray-900">
                  {formData.status === 'draft' ? '草稿' : '待付款'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">发票日期</span>
                <span className="font-medium text-gray-900">{formData.invoiceDate}</span>
              </div>
              {formData.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">到期日期</span>
                  <span className="font-medium text-gray-900">{formData.dueDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">
                  {formData.invoiceType === 'sales' ? '客户' : '供应商'}
                </span>
                <span className="font-medium text-gray-900 truncate max-w-[120px]">
                  {formData.customerName || '-'}
                </span>
              </div>
              {formData.billNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">关联提单</span>
                  <span className="font-medium text-gray-900 truncate max-w-[120px]">
                    {formData.billNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">货币</span>
                <span className="font-medium text-gray-900">{formData.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">明细项数</span>
                <span className="font-medium text-gray-900">{formData.items.length} 项</span>
              </div>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-500 space-y-1">
                <p>• 发票号将在保存时自动生成</p>
                <p>• 销售发票会计入应收款</p>
                <p>• 采购发票会计入应付款</p>
                <p>• 草稿状态的发票可以修改</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

