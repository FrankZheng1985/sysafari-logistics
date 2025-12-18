import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  ArrowLeft, Save, FileText, Plus, Trash2, 
  Calculator, AlertCircle, Package
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  currency: string
  amount: number
  taxRate: number
  taxAmount: number
  discountPercent: number
  discountAmount: number
  finalAmount: number
}

interface InvoiceFormData {
  invoiceNumber: string
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

export default function EditInvoice() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [paymentDays, setPaymentDays] = useState<number | ''>(30)

  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceNumber: '',
    invoiceType: 'sales',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    customerId: '',
    customerName: '',
    billId: '',
    billNumber: '',
    currency: 'EUR',
    exchangeRate: 1,
    description: '',
    notes: '',
    status: 'pending',
    items: []
  })

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

  // 加载发票数据
  useEffect(() => {
    if (id) {
      loadInvoice()
    }
  }, [id])

  const loadInvoice = async () => {
    try {
      setInitialLoading(true)
      const response = await fetch(`${API_BASE}/api/invoices/${id}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        const invoice = data.data
        
        // 解析明细项目
        let items: InvoiceItem[] = []
        if (invoice.description) {
          const descriptions = invoice.description.split(';').filter((s: string) => s.trim())
          items = descriptions.map((desc: string, index: number) => ({
            id: (index + 1).toString(),
            description: desc.trim(),
            quantity: 1,
            unitPrice: invoice.totalAmount / descriptions.length,
            currency: invoice.currency || 'EUR',
            amount: invoice.totalAmount / descriptions.length,
            taxRate: 0,
            taxAmount: 0,
            discountPercent: 0,
            discountAmount: 0,
            finalAmount: invoice.totalAmount / descriptions.length
          }))
        }
        
        if (items.length === 0) {
          items = [{
            id: '1',
            description: invoice.description || '',
            quantity: 1,
            unitPrice: invoice.totalAmount || 0,
            currency: invoice.currency || 'EUR',
            amount: invoice.totalAmount || 0,
            taxRate: 0,
            taxAmount: 0,
            discountPercent: 0,
            discountAmount: 0,
            finalAmount: invoice.totalAmount || 0
          }]
        }
        
        // 计算账期天数
        if (invoice.dueDate && invoice.invoiceDate) {
          const days = Math.ceil(
            (new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
          )
          setPaymentDays(days > 0 ? days : 30)
        }
        
        setFormData({
          invoiceNumber: invoice.invoiceNumber || '',
          invoiceType: invoice.invoiceType || 'sales',
          invoiceDate: invoice.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0],
          dueDate: invoice.dueDate?.split('T')[0] || '',
          customerId: invoice.customerId || '',
          customerName: invoice.customerName || '',
          billId: invoice.billId || '',
          billNumber: invoice.billNumber || '',
          currency: invoice.currency || 'EUR',
          exchangeRate: invoice.exchangeRate || 1,
          description: invoice.description || '',
          notes: invoice.notes || '',
          status: invoice.status || 'pending',
          items
        })
      }
    } catch (error) {
      console.error('加载发票失败:', error)
      alert('加载发票数据失败')
    } finally {
      setInitialLoading(false)
    }
  }

  // 处理账期天数变化
  const handlePaymentDaysChange = (days: number | '') => {
    setPaymentDays(days)
    if (days && formData.invoiceDate) {
      const invoiceDate = new Date(formData.invoiceDate)
      const dueDate = new Date(invoiceDate)
      dueDate.setDate(dueDate.getDate() + days)
      setFormData(prev => ({
        ...prev,
        dueDate: dueDate.toISOString().split('T')[0]
      }))
    }
  }

  // 更新发票项
  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== id) return item

        const updated = { ...item, [field]: value }
        // 当数量、单价、税率或优惠字段变化时重新计算
        if (['quantity', 'unitPrice', 'taxRate', 'discountPercent', 'discountAmount'].includes(field)) {
          const amount = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0)
          const taxAmount = amount * ((Number(updated.taxRate) || 0) / 100)
          const discountAmount = Number(updated.discountAmount) || (amount * ((Number(updated.discountPercent) || 0) / 100))
          updated.amount = amount
          updated.taxAmount = taxAmount
          updated.discountAmount = discountAmount
          updated.finalAmount = amount + taxAmount - discountAmount
        }
        return updated
      })
    }))
  }

  // 添加发票项
  const addItem = () => {
    const newId = formData.items.length > 0
      ? (Math.max(...formData.items.map(i => parseInt(i.id))) + 1).toString()
      : '1'
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        id: newId,
        description: '',
        quantity: 1,
        unitPrice: 0,
        currency: formData.currency || 'EUR',
        amount: 0,
        taxRate: 0,
        taxAmount: 0,
        discountPercent: 0,
        discountAmount: 0,
        finalAmount: 0
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
    const subtotal = formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    const taxAmount = formData.items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0)
    const totalAmount = subtotal + taxAmount
    return { subtotal, taxAmount, totalAmount }
  }

  // 格式化货币
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: formData.currency || 'EUR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  // 提交表单
  const handleSubmit = async () => {
    // 验证
    if (formData.items.length === 0) {
      alert('请至少添加一个发票项')
      return
    }

    const hasEmptyItem = formData.items.some(item => !item.description.trim())
    if (hasEmptyItem) {
      alert('请填写所有发票项的描述')
      return
    }

    const { subtotal, taxAmount, totalAmount } = calculateTotals()

    if (totalAmount <= 0) {
      alert('发票金额必须大于0')
      return
    }

    setLoading(true)

    try {
      const submitData = {
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate,
        customerId: formData.customerId,
        customerName: formData.customerName,
        subtotal,
        taxAmount,
        totalAmount,
        currency: formData.currency,
        exchangeRate: formData.exchangeRate,
        description: formData.items.map(i => i.description).join('; '),
        notes: formData.notes,
        status: formData.status
      }

      const response = await fetch(`${API_BASE}/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      const data = await response.json()

      if (data.errCode === 200) {
        alert('发票更新成功')
        navigate(`/finance/invoices/${id}`)
      } else {
        alert(data.msg || '更新发票失败')
      }
    } catch (error) {
      console.error('更新发票失败:', error)
      alert('更新发票失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-4">
      {/* 页面头部 */}
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
            onClick={() => navigate(`/finance/invoices/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              编辑发票 - {formData.invoiceNumber}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              formData.invoiceType === 'sales'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {formData.invoiceType === 'sales' ? '销售发票' : '采购发票'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/finance/invoices/${id}`)}
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
            {loading ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      {/* 关联订单信息（只读） */}
      {formData.billNumber && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Package className="w-4 h-4" />
            <span>关联订单：</span>
            <span className="font-medium text-gray-900">{formData.billNumber}</span>
            <span className="text-gray-400">（订单信息不可修改）</span>
          </div>
        </div>
      )}

      {/* 发票基本信息 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">发票信息</h2>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* 发票日期 */}
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              发票日期 <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={formData.invoiceDate}
              onChange={(date) => setFormData(prev => ({ ...prev, invoiceDate: date }))}
            />
          </div>

          {/* 账期天数 */}
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              账期天数
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={paymentDays}
                onChange={(e) => handlePaymentDaysChange(e.target.value ? parseInt(e.target.value) : '')}
                min="0"
                className="w-[100px] px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* 到期日期显示 */}
          {formData.dueDate && (
            <div className="flex items-center text-xs text-gray-600 bg-gray-100 px-3 py-2.5 rounded-lg">
              到期: {formData.dueDate}
            </div>
          )}

          {/* 客户/供应商 */}
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {formData.invoiceType === 'sales' ? '客户' : '供应商'}
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={`输入${formData.invoiceType === 'sales' ? '客户' : '供应商'}名称`}
            />
          </div>

          {/* 货币 */}
          <div className="w-[100px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">货币</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          {/* 状态 */}
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-700 mb-1">状态</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="pending">待处理</option>
              <option value="issued">已开具</option>
              <option value="sent">已发送</option>
              <option value="partial">部分付款</option>
              <option value="paid">已付款</option>
            </select>
          </div>
        </div>
      </div>

      {/* 发票明细 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900">发票明细</h2>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加项目
          </button>
        </div>

        {formData.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">暂无明细项目</p>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              + 添加第一个项目
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs">
                  <th className="py-2 px-1.5 text-left w-8">#</th>
                  <th className="py-2 px-1.5 text-left">费用类型</th>
                  <th className="py-2 px-1.5 text-center w-16">数量</th>
                  <th className="py-2 px-1.5 text-right w-24">单价</th>
                  <th className="py-2 px-1.5 text-right w-24">金额</th>
                  <th className="py-2 px-1.5 text-center w-16">税率%</th>
                  <th className="py-2 px-1.5 text-right w-20">税额</th>
                  <th className="py-2 px-1.5 text-center w-10">操作</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-1.5 px-1.5 text-gray-500">{index + 1}</td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="费用描述"
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="1"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-1.5 px-1.5 text-right text-gray-900 whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        value={item.taxRate}
                        onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </td>
                    <td className="py-1.5 px-1.5 text-right text-gray-900 whitespace-nowrap">
                      {formatCurrency(item.taxAmount)}
                    </td>
                    <td className="py-1.5 px-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={formData.items.length <= 1}
                        className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* 合计行 */}
                <tr className="bg-gray-50 font-medium">
                  <td colSpan={4} className="py-2 px-1.5 text-right text-gray-600">
                    合计
                  </td>
                  <td className="py-2 px-1.5 text-right text-gray-900 font-semibold whitespace-nowrap">
                    {formatCurrency(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
                  </td>
                  <td className="py-2 px-1.5 text-center text-gray-500">-</td>
                  <td className="py-2 px-1.5 text-right text-gray-900 font-semibold whitespace-nowrap">
                    {formatCurrency(formData.items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0))}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 总计 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">小计</span>
                <span className="font-medium">{formatCurrency(calculateTotals().subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">税额</span>
                <span className="font-medium">{formatCurrency(calculateTotals().taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>总计</span>
                <span className="text-primary-600">{formatCurrency(calculateTotals().totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 备注 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">备注</h2>
        </div>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="添加发票备注..."
        />
      </div>
    </div>
  )
}
