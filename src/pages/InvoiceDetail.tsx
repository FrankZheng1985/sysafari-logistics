import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, FileText, Building, Calendar, CreditCard,
  Package, Edit2, Trash2, CheckCircle, Clock,
  AlertTriangle, DollarSign, Receipt, Printer, Ship, Download, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface InvoiceItem {
  id: string
  feeName: string
  feeNameEn?: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  currency: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceType: 'sales' | 'purchase'
  invoiceDate: string
  dueDate: string | null
  customerId: string | null
  customerName: string
  billId: string | null
  billNumber: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  currency: string
  exchangeRate: number
  description: string
  notes: string
  status: string
  createdBy: string | null
  createTime: string
  items?: InvoiceItem[]
  updateTime: string
  pdfUrl?: string | null
  excelUrl?: string | null
  payments?: Payment[]
}

interface Payment {
  id: string
  paymentNumber: string
  paymentDate: string
  amount: number
  method: string
  reference: string
  notes: string
}

interface BillInfo {
  id: string
  billNumber: string
  containerNumber: string      // 提单号
  actualContainerNo: string    // 集装箱号
  customerName: string
  consignee: string
  pieces: number
  weight: number
  volume: number
  portOfLoading: string
  portOfDischarge: string
  eta: string
  ata: string
  deliveryStatus?: string      // 派送状态
  status?: string              // 订单状态
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [billInfo, setBillInfo] = useState<BillInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [voiding, setVoiding] = useState(false)

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

  useEffect(() => {
    if (id) {
      loadInvoice()
    }
  }, [id])

  const loadInvoice = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/invoices/${id}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setInvoice(data.data)
        // 如果有关联订单，获取订单详情
        if (data.data.billId) {
          loadBillInfo(data.data.billId)
        }
      }
    } catch (error) {
      console.error('加载发票详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBillInfo = async (billId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/bills/${billId}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setBillInfo(data.data)
      }
    } catch (error) {
      console.error('加载订单信息失败:', error)
    }
  }

  // 作废发票处理
  const handleVoidInvoice = async () => {
    if (!invoice) return
    
    setVoiding(true)
    try {
      const response = await fetch(`${API_BASE}/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowVoidConfirm(false)
        // 重新加载发票数据
        loadInvoice()
        alert('发票已作废')
      } else {
        alert(data.msg || '作废发票失败')
      }
    } catch (error) {
      console.error('作废发票失败:', error)
      alert('作废发票失败，请重试')
    } finally {
      setVoiding(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      issued: { label: '已开票', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
      draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: <FileText className="w-4 h-4" /> },
      unpaid: { label: '待收款', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
      partial: { label: '部分收款', color: 'bg-blue-100 text-blue-700', icon: <AlertTriangle className="w-4 h-4" /> },
      paid: { label: '已收款', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
      overdue: { label: '已逾期', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-4 h-4" /> },
      cancelled: { label: '已作废', color: 'bg-gray-100 text-gray-500', icon: <AlertTriangle className="w-4 h-4" /> }
    }
    return configs[status] || configs.issued
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: '银行转账',
      cash: '现金',
      check: '支票',
      credit_card: '信用卡',
      wechat: '微信',
      alipay: '支付宝',
      other: '其他'
    }
    return labels[method] || method
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader
          title="财务管理"
          tabs={tabs}
          activeTab="/finance/invoices"
          onTabChange={(path) => navigate(path)}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-4 space-y-4">
        <PageHeader
          title="财务管理"
          tabs={tabs}
          activeTab="/finance/invoices"
          onTabChange={(path) => navigate(path)}
        />
        <div className="flex flex-col items-center justify-center h-64">
          <FileText className="w-12 h-12 text-gray-300 mb-2" />
          <div className="text-gray-500">发票不存在</div>
          <button
            onClick={() => navigate('/finance/invoices')}
            className="mt-4 text-primary-600 hover:text-primary-700"
          >
            返回发票列表
          </button>
        </div>
      </div>
    )
  }

  const statusConfig = getStatusConfig(invoice.status)
  const remainingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount)

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/invoices"
        onTabChange={(path) => navigate(path)}
      />

      {/* 页面标题栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/finance/invoices')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${invoice.invoiceType === 'sales' ? 'bg-blue-100' : 'bg-orange-100'}`}>
              <FileText className={`w-5 h-5 ${invoice.invoiceType === 'sales' ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  invoice.invoiceType === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {invoice.invoiceType === 'sales' ? '销售发票' : '采购发票'}
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${statusConfig.color}`}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                {invoice.customerName} · 创建于 {formatDate(invoice.createTime)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => navigate(`/finance/invoices/${invoice.id}/payment`)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              登记收款
            </button>
          )}
          <button
            onClick={() => {
              if (invoice.pdfUrl) {
                // 使用 iframe 直接打印PDF
                const iframe = document.createElement('iframe')
                iframe.style.display = 'none'
                iframe.src = `${API_BASE}${invoice.pdfUrl}`
                document.body.appendChild(iframe)
                iframe.onload = () => {
                  setTimeout(() => {
                    iframe.contentWindow?.print()
                  }, 500)
                }
              } else {
                alert('PDF文件未生成，无法打印')
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            打印
          </button>
          <button
            onClick={async () => {
              if (!confirm('确定要重新生成发票文件吗？')) return
              try {
                const res = await fetch(`${API_BASE}/api/invoices/${id}/regenerate`, { method: 'POST' })
                const data = await res.json()
                if (data.errCode === 200) {
                  alert('发票文件已重新生成')
                  window.location.reload()
                } else {
                  alert(data.msg || '重新生成失败')
                }
              } catch (error) {
                alert('重新生成失败')
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新生成
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 左侧主要内容 */}
        <div className="col-span-2 space-y-4">
          {/* 发票金额卡片 */}
          <div className={`rounded-lg border p-4 ${
            invoice.invoiceType === 'sales' ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">小计</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(Number(invoice.subtotal), invoice.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">税额</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(Number(invoice.taxAmount), invoice.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">总金额</div>
                <div className={`text-xl font-bold ${
                  invoice.invoiceType === 'sales' ? 'text-blue-700' : 'text-orange-700'
                }`}>
                  {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  {invoice.invoiceType === 'sales' ? '待收金额' : '待付金额'}
                </div>
                <div className={`text-xl font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(remainingAmount, invoice.currency)}
                </div>
              </div>
            </div>
            
            {/* 付款进度条 */}
            {Number(invoice.totalAmount) > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>付款进度</span>
                  <span>{((Number(invoice.paidAmount) / Number(invoice.totalAmount)) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      Number(invoice.paidAmount) >= Number(invoice.totalAmount) 
                        ? 'bg-green-500' 
                        : invoice.invoiceType === 'sales' ? 'bg-blue-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min((Number(invoice.paidAmount) / Number(invoice.totalAmount)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 关联订单信息 - 放在发票信息前面 */}
          {billInfo && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Ship className="w-4 h-4 text-gray-400" />
                  关联订单信息
                </h2>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary-600" />
                  {invoice.billNumber ? (
                    <button 
                      onClick={() => navigate(`/bill/${invoice.billId}`)}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      {invoice.billNumber}
                    </button>
                  ) : '-'}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    {billInfo.deliveryStatus || billInfo.status || '已完成'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 text-xs">
                {/* 基本信息 */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-1">
                    <span className="text-gray-500">{invoice.invoiceType === 'sales' ? '客户' : '供应商'}:</span>
                    <span className="text-gray-900 font-medium">{billInfo.customerName || billInfo.consignee || invoice.customerName || '-'}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">提单号:</span>
                    <span className="text-gray-900 font-medium font-mono">{billInfo.containerNumber || '-'}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">集装箱号:</span>
                    <span className="text-gray-900 font-medium font-mono">{billInfo.actualContainerNo || '-'}</span>
                  </div>
                </div>
                
                {/* 货物信息 */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-1">
                    <span className="text-gray-500">件数:</span>
                    <span className="text-gray-900">{billInfo.pieces || '-'} 件</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">毛重:</span>
                    <span className="text-gray-900">{billInfo.weight || '-'} KG</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">体积:</span>
                    <span className="text-gray-900">{billInfo.volume || '-'} CBM</span>
                  </div>
                </div>
                
                {/* 运输信息 */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-1">
                    <span className="text-gray-500">ATA:</span>
                    <span className="text-gray-900">{billInfo.ata || '-'}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">ETA:</span>
                    <span className="text-gray-900">{billInfo.eta || '-'}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">起运港:</span>
                    <span className="text-gray-900">{billInfo.portOfLoading || '-'}</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="text-gray-500">目的港:</span>
                    <span className="text-gray-900">{billInfo.portOfDischarge || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 发票详细信息 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-400" />
              发票信息
            </h2>
            
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              {/* 第一行：基本信息 */}
              <div>
                <div className="text-xs text-gray-500 mb-1">发票类型</div>
                <div className="text-sm font-medium text-gray-900">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    invoice.invoiceType === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {invoice.invoiceType === 'sales' ? '销售发票' : '采购发票'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">状态</div>
                <div className="text-sm font-medium">
                  <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full w-fit ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">明细项数</div>
                <div className="text-sm font-medium text-gray-900">
                  {invoice.description ? invoice.description.split(';').filter(s => s.trim()).length : 0} 项
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">账期天数</div>
                <div className="text-sm font-medium text-gray-900">
                  {invoice.dueDate && invoice.invoiceDate ? (
                    `${Math.ceil((new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24))} 天`
                  ) : '-'}
                </div>
              </div>

              {/* 第二行：日期 + 货币信息 */}
              <div>
                <div className="text-xs text-gray-500 mb-1">发票日期</div>
                <div className="text-sm font-medium text-gray-900">{formatDate(invoice.invoiceDate)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">到期日期</div>
                <div className={`text-sm font-medium ${
                  invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid'
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {formatDate(invoice.dueDate)}
                  {invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' && (
                    <span className="ml-1 text-xs text-red-500">已逾期</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">货币</div>
                <div className="text-sm font-medium text-gray-900">{invoice.currency}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">汇率</div>
                <div className="text-sm font-medium text-gray-900">
                  {invoice.currency !== 'CNY' 
                    ? `1 ${invoice.currency} = ${Number(invoice.exchangeRate || 1).toFixed(4)} CNY`
                    : '-'
                  }
                </div>
              </div>
            </div>

            {/* 备注 */}
            {invoice.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">内部备注</div>
                <div className="text-sm text-gray-700">{invoice.notes}</div>
              </div>
            )}
          </div>

          {/* 发票明细 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              发票明细
            </h2>

            {(invoice.items && invoice.items.length > 0) || invoice.description ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">序号</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">描述</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 优先从 items 字段读取（包含金额），否则从 description 读取
                      let parsedItems: Array<{description: string, amount: number}> = []
                      if (invoice.items && typeof invoice.items === 'string') {
                        try {
                          parsedItems = JSON.parse(invoice.items)
                        } catch (e) {
                          parsedItems = []
                        }
                      } else if (Array.isArray(invoice.items)) {
                        parsedItems = invoice.items
                      }
                      
                      if (parsedItems.length > 0) {
                        return parsedItems.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2 px-3 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-3 text-gray-900">{item.description}</td>
                            <td className="py-2 px-3 text-right text-gray-900">
                              {formatCurrency(Number(item.amount), invoice.currency)}
                            </td>
                          </tr>
                        ))
                      } else if (invoice.description) {
                        // 后备方案：从 description 字符串分割，金额显示为 "-"
                        const items = invoice.description.split(';').filter(s => s.trim())
                        return items.map((item, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2 px-3 text-gray-500">{index + 1}</td>
                            <td className="py-2 px-3 text-gray-900">{item.trim()}</td>
                            <td className="py-2 px-3 text-right text-gray-500">-</td>
                          </tr>
                        ))
                      }
                      return null
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium">
                      <td colSpan={2} className="py-2 px-3 text-right text-gray-700">合计</td>
                      <td className="py-2 px-3 text-right text-gray-900 font-semibold">
                        {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">暂无明细项</p>
              </div>
            )}
          </div>

        </div>

        {/* 右侧信息栏 */}
        <div className="space-y-4">
          {/* 快速操作 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">快速操作</h2>
            <div className="space-y-2">
              {invoice.status === 'draft' && (
                <button 
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => alert('发布发票功能开发中')}
                >
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  发布发票
                </button>
              )}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => {
                  if (invoice.pdfUrl) {
                    window.open(`${API_BASE}${invoice.pdfUrl}`, '_blank')
                  } else {
                    alert('PDF文件未生成')
                  }
                }}
              >
                <Download className="w-4 h-4 text-red-500" />
                下载 PDF
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => {
                  if (invoice.excelUrl) {
                    window.open(`${API_BASE}${invoice.excelUrl}`, '_blank')
                  } else {
                    alert('Excel文件未生成')
                  }
                }}
              >
                <Download className="w-4 h-4 text-green-500" />
                下载 Excel
              </button>
              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                <>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={() => navigate(`/finance/invoices/create?edit=${id}`)}
                  >
                    <Edit2 className="w-4 h-4 text-blue-500" />
                    编辑发票
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    onClick={() => setShowVoidConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    作废发票
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 发票状态时间线 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">状态记录</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500" />
                <div>
                  <div className="text-xs font-medium text-gray-900">创建发票</div>
                  <div className="text-xs text-gray-500">{formatDate(invoice.createTime)}</div>
                </div>
              </div>
              {Number(invoice.paidAmount) > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500" />
                  <div>
                    <div className="text-xs font-medium text-gray-900">收到付款</div>
                    <div className="text-xs text-gray-500">
                      已收 {formatCurrency(Number(invoice.paidAmount), invoice.currency)}
                    </div>
                  </div>
                </div>
              )}
              {invoice.status === 'paid' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500" />
                  <div>
                    <div className="text-xs font-medium text-gray-900">付款完成</div>
                    <div className="text-xs text-gray-500">发票已结清</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 其他信息 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">其他信息</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">发票号码</span>
                <span className="text-gray-700 font-mono">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span className="text-gray-700">{formatDate(invoice.createTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span className="text-gray-700">{formatDate(invoice.updateTime)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 作废确认弹窗 */}
      {showVoidConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">确认作废发票</h3>
                <p className="text-sm text-gray-500">此操作不可撤销</p>
              </div>
            </div>
            
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 space-y-1">
                <div>发票编号：<span className="font-medium text-gray-900">{invoice.invoiceNumber}</span></div>
                <div>客户：<span className="font-medium text-gray-900">{invoice.customerName}</span></div>
                <div>金额：<span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount, invoice.currency)}</span></div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              作废后，该发票将被标记为"已作废"状态，无法再进行编辑或收款操作。确定要作废这张发票吗？
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowVoidConfirm(false)}
                disabled={voiding}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleVoidInvoice}
                disabled={voiding}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {voiding ? '处理中...' : '确认作废'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
