import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, ArrowUpRight, ArrowDownRight, FileText, Building2, Calendar,
  CreditCard, Banknote, Wallet, User, Phone, Mail, MapPin,
  Ship, Receipt, Clock, CheckCircle, AlertTriangle, Trash2, GripVertical
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

// 卡片类型定义
type CardId = 'paymentInfo' | 'bankAccount' | 'invoice' | 'billInfo' | 'customerInfo' | 'timeRecord' | 'receipt'

interface CardConfig {
  id: CardId
  title: string
  icon: typeof Receipt
  column: 'left' | 'right'
  defaultOrder: number
}

// 卡片配置
const CARD_CONFIGS: CardConfig[] = [
  { id: 'paymentInfo', title: '收款信息', icon: Receipt, column: 'left', defaultOrder: 1 },
  { id: 'invoice', title: '关联发票', icon: FileText, column: 'left', defaultOrder: 2 },
  { id: 'billInfo', title: '关联订单', icon: Ship, column: 'left', defaultOrder: 3 },
  { id: 'customerInfo', title: '付款方', icon: User, column: 'right', defaultOrder: 1 },
  { id: 'bankAccount', title: '收款账户', icon: Building2, column: 'right', defaultOrder: 2 },
  { id: 'timeRecord', title: '时间记录', icon: Clock, column: 'right', defaultOrder: 3 },
  { id: 'receipt', title: '收款凭证', icon: Receipt, column: 'right', defaultOrder: 4 },
]

// localStorage key
const CARD_ORDER_STORAGE_KEY = 'payment-detail-card-order'

interface InvoiceItem {
  id?: string
  description?: string  // 费用名称 (数据库存储格式)
  descriptionEn?: string  // 英文名称
  feeName?: string  // 兼容旧格式
  feeNameEn?: string
  quantity?: number
  unitPrice?: number
  unitValue?: number  // 数据库存储格式
  amount: number
  currency?: string
  containerNumber?: string
  billNumber?: string
}

interface BillInfo {
  id: string
  billNumber: string
  containerNumber: string
  customerName: string
  consignee?: string
  pieces?: number
  weight?: number
  volume?: number
  portOfLoading?: string
  portOfDischarge?: string
  eta?: string
  ata?: string
  deliveryStatus?: string
  status?: string
}

// 多发票支持
interface InvoiceInfo {
  id: string
  invoiceNumber: string
  invoiceType?: string
  totalAmount: number
  paidAmount: number
  status?: string
  dueDate?: string
  items?: InvoiceItem[]
  containerNumbers?: string[]
  billId?: string
  billNumber?: string
}

interface BankAccountInfo {
  id: string
  accountName: string
  bankName: string
  accountNumber: string
  iban: string
  swiftCode: string
  currency: string
}

interface Payment {
  id: string
  paymentNumber: string
  paymentType: 'income' | 'expense'
  paymentDate: string
  paymentMethod: string
  invoiceId: string | null
  invoiceNumber: string
  customerId: string | null
  customerName: string
  containerNumbers: string[]
  amount: number
  currency: string
  exchangeRate: number
  bankAccount: string
  referenceNumber: string
  description: string
  notes: string
  status: string
  receiptUrl: string | null
  createTime: string
  updateTime: string
  // 多发票支持（新格式）
  invoices?: InvoiceInfo[]
  invoiceCount?: number
  billInfoList?: BillInfo[]
  // 发票相关信息（兼容旧格式 - 主发票）
  invoiceType?: string
  invoiceTotalAmount?: number
  invoicePaidAmount?: number
  invoiceStatus?: string
  invoiceItems?: InvoiceItem[]
  invoiceDueDate?: string
  // 客户详细信息
  customerCompanyName?: string
  customerContactName?: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  // 提单信息
  billInfo?: BillInfo | null
  // 银行账户信息
  bankAccountInfo?: BankAccountInfo | null
}

// 可拖拽卡片组件
interface DraggableCardProps {
  id: CardId
  title: string
  icon: typeof Receipt
  children: React.ReactNode
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: CardId) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>, id: CardId) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, id: CardId) => void
}

function DraggableCard({
  id,
  title,
  icon: Icon,
  children,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}: DraggableCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={(e) => onDragOver(e, id)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, id)}
      className={`
        bg-white rounded-lg border transition-all duration-200 group
        ${isDragging ? 'opacity-50 scale-[0.98] border-primary-300 shadow-lg' : 'border-gray-200'}
        ${isDropTarget ? 'border-primary-500 border-2 shadow-md bg-primary-50/30' : ''}
      `}
    >
      {/* 卡片标题栏 - 可拖拽区域 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 cursor-grab active:cursor-grabbing select-none">
        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
        <Icon className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900 flex-1">{title}</h3>
      </div>
      {/* 卡片内容 */}
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 拖拽状态
  const [dragCardId, setDragCardId] = useState<CardId | null>(null)
  const [dropTargetId, setDropTargetId] = useState<CardId | null>(null)
  
  // 卡片顺序 - 分为左右两列
  const [leftCardOrder, setLeftCardOrder] = useState<CardId[]>(() => {
    const saved = localStorage.getItem(CARD_ORDER_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // 过滤掉已删除或移动的卡片类型
        const validCards = (parsed.left || ['paymentInfo', 'invoice', 'billInfo'])
          .filter((id: string) => id !== 'containerNumbers' && id !== 'bankAccount')
        return validCards.length > 0 ? validCards : ['paymentInfo', 'invoice', 'billInfo']
      } catch {
        return ['paymentInfo', 'invoice', 'billInfo']
      }
    }
    return ['paymentInfo', 'invoice', 'billInfo']
  })
  
  const [rightCardOrder, setRightCardOrder] = useState<CardId[]>(() => {
    const saved = localStorage.getItem(CARD_ORDER_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        let rightCards = parsed.right || ['customerInfo', 'bankAccount', 'timeRecord', 'receipt']
        // 确保 bankAccount 在右列中
        if (!rightCards.includes('bankAccount')) {
          const customerIndex = rightCards.indexOf('customerInfo')
          if (customerIndex !== -1) {
            rightCards.splice(customerIndex + 1, 0, 'bankAccount')
          } else {
            rightCards.unshift('bankAccount')
          }
        }
        return rightCards
      } catch {
        return ['customerInfo', 'bankAccount', 'timeRecord', 'receipt']
      }
    }
    return ['customerInfo', 'bankAccount', 'timeRecord', 'receipt']
  })

  const tabs = [
    { label: '财务概览', path: '/finance' },
    { label: '发票管理', path: '/finance/invoices' },
    { label: '历史记录', path: '/finance/invoices/history' },
    { label: '收付款', path: '/finance/payments' },
    { label: '费用管理', path: '/finance/fees' },
    { label: '财务报表', path: '/finance/reports' },
    { label: '订单报表', path: '/finance/order-report' },
    { label: '银行账户', path: '/finance/bank-accounts' },
  ]

  useEffect(() => {
    if (id) {
      loadPayment()
    }
  }, [id])

  // 保存卡片顺序到 localStorage
  useEffect(() => {
    localStorage.setItem(CARD_ORDER_STORAGE_KEY, JSON.stringify({
      left: leftCardOrder,
      right: rightCardOrder
    }))
  }, [leftCardOrder, rightCardOrder])

  const loadPayment = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/payments/${id}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setPayment(data.data)
      }
    } catch (error) {
      console.error('加载收付款详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!payment) return
    
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/api/payments/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        navigate('/finance/payments')
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除收付款记录失败:', error)
      alert('删除失败')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // 拖拽处理
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, cardId: CardId) => {
    setDragCardId(cardId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cardId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, cardId: CardId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (cardId !== dragCardId) {
      setDropTargetId(cardId)
    }
  }, [dragCardId])

  const handleDragEnd = useCallback(() => {
    setDragCardId(null)
    setDropTargetId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetCardId: CardId) => {
    e.preventDefault()
    
    if (!dragCardId || dragCardId === targetCardId) {
      handleDragEnd()
      return
    }

    // 判断源卡片和目标卡片在哪一列
    const dragInLeft = leftCardOrder.includes(dragCardId)
    const targetInLeft = leftCardOrder.includes(targetCardId)

    if (dragInLeft && targetInLeft) {
      // 同列移动 - 左列
      setLeftCardOrder(prev => {
        const newOrder = [...prev]
        const fromIndex = newOrder.indexOf(dragCardId)
        const toIndex = newOrder.indexOf(targetCardId)
        newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, dragCardId)
        return newOrder
      })
    } else if (!dragInLeft && !targetInLeft) {
      // 同列移动 - 右列
      setRightCardOrder(prev => {
        const newOrder = [...prev]
        const fromIndex = newOrder.indexOf(dragCardId)
        const toIndex = newOrder.indexOf(targetCardId)
        newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, dragCardId)
        return newOrder
      })
    } else if (dragInLeft && !targetInLeft) {
      // 从左列移到右列
      setLeftCardOrder(prev => prev.filter(id => id !== dragCardId))
      setRightCardOrder(prev => {
        const toIndex = prev.indexOf(targetCardId)
        const newOrder = [...prev]
        newOrder.splice(toIndex, 0, dragCardId)
        return newOrder
      })
    } else {
      // 从右列移到左列
      setRightCardOrder(prev => prev.filter(id => id !== dragCardId))
      setLeftCardOrder(prev => {
        const toIndex = prev.indexOf(targetCardId)
        const newOrder = [...prev]
        newOrder.splice(toIndex, 0, dragCardId)
        return newOrder
      })
    }

    handleDragEnd()
  }, [dragCardId, leftCardOrder, handleDragEnd])

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getMethodConfig = (method: string) => {
    const configs: Record<string, { label: string; icon: typeof CreditCard }> = {
      bank_transfer: { label: '银行转账', icon: Building2 },
      cash: { label: '现金', icon: Banknote },
      check: { label: '支票', icon: CreditCard },
      credit_card: { label: '信用卡', icon: CreditCard },
      wechat: { label: '微信支付', icon: Wallet },
      alipay: { label: '支付宝', icon: Wallet },
      other: { label: '其他', icon: CreditCard },
    }
    return configs[method] || configs.other
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
      pending: { label: '待处理', color: 'text-amber-600 bg-amber-100', icon: Clock },
      completed: { label: '已完成', color: 'text-green-600 bg-green-100', icon: CheckCircle },
      confirmed: { label: '已确认', color: 'text-green-600 bg-green-100', icon: CheckCircle },
      cancelled: { label: '已取消', color: 'text-red-600 bg-red-100', icon: AlertTriangle },
    }
    return configs[status] || configs.pending
  }

  // 卡片内容渲染函数
  const renderCardContent = (cardId: CardId) => {
    if (!payment) return null
    
    const isIncome = payment.paymentType === 'income'
    const methodConfig = getMethodConfig(payment.paymentMethod)
    const MethodIcon = methodConfig.icon

    switch (cardId) {
      case 'paymentInfo':
        return (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">{isIncome ? '收款' : '付款'}日期</label>
                <p className="text-sm text-gray-900 flex items-center gap-1.5 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(payment.paymentDate) || '-'}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">支付方式</label>
                <p className="text-sm text-gray-900 flex items-center gap-1.5 mt-1">
                  <MethodIcon className="w-4 h-4 text-gray-400" />
                  {methodConfig.label}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">参考号/流水号</label>
                <p className="text-sm text-gray-900 mt-1">{payment.referenceNumber || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">汇率</label>
                <p className="text-sm text-gray-900 mt-1">{payment.exchangeRate || 1}</p>
              </div>
            </div>
            
            {payment.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs text-gray-500">备注说明</label>
                <p className="text-sm text-gray-900 mt-1">{payment.description}</p>
              </div>
            )}
            
            {payment.notes && (
              <div className="mt-3">
                <label className="text-xs text-gray-500">内部备注</label>
                <p className="text-sm text-gray-600 mt-1">{payment.notes}</p>
              </div>
            )}
          </div>
        )

      case 'bankAccount':
        if (!payment.bankAccountInfo && !payment.bankAccount) return null
        return (
          <div>
            {payment.bankAccountInfo ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">账户名称</label>
                  <p className="text-sm text-gray-900 mt-1">{payment.bankAccountInfo.accountName}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">银行名称</label>
                  <p className="text-sm text-gray-900 mt-1">{payment.bankAccountInfo.bankName || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">账号</label>
                  <p className="text-sm text-gray-900 font-mono mt-1">{payment.bankAccountInfo.accountNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">IBAN</label>
                  <p className="text-sm text-gray-900 font-mono mt-1">{payment.bankAccountInfo.iban || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">SWIFT代码</label>
                  <p className="text-sm text-gray-900 font-mono mt-1">{payment.bankAccountInfo.swiftCode || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">币种</label>
                  <p className="text-sm text-gray-900 mt-1">{payment.bankAccountInfo.currency || '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">{payment.bankAccount}</p>
            )}
          </div>
        )

      case 'invoice':
        // 支持多发票显示
        const invoiceList = payment.invoices && payment.invoices.length > 0 
          ? payment.invoices 
          : (payment.invoiceId ? [{
              id: payment.invoiceId,
              invoiceNumber: payment.invoiceNumber,
              invoiceType: payment.invoiceType,
              totalAmount: payment.invoiceTotalAmount || 0,
              paidAmount: payment.invoicePaidAmount || 0,
              status: payment.invoiceStatus,
              dueDate: payment.invoiceDueDate,
              items: payment.invoiceItems
            }] : [])
        
        if (invoiceList.length === 0) return null
        
        return (
          <div className="space-y-4">
            {/* 多发票提示 */}
            {invoiceList.length > 1 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  本次收款共核销 <strong>{invoiceList.length}</strong> 张发票
                </span>
              </div>
            )}
            
            {/* 发票列表 */}
            {invoiceList.map((invoice, idx) => (
              <div key={invoice.id || idx} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${invoice.invoiceType === 'sales' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                      <FileText className={`w-4 h-4 ${invoice.invoiceType === 'sales' ? 'text-blue-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">
                        {invoice.invoiceType === 'sales' ? '销售发票' : '采购发票'}
                        {invoice.dueDate && ` · 到期日: ${formatDate(invoice.dueDate)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.totalAmount || 0, payment.currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      已付: {formatCurrency(invoice.paidAmount || 0, payment.currency)}
                    </p>
                  </div>
                </div>
                
                <div className="p-3 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/finance/invoices/${invoice.id}`)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    查看发票详情 →
                  </button>
                </div>
                
                {/* 发票费用明细 */}
                {invoice.items && invoice.items.length > 0 && (
                  <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-gray-50/50">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">费用明细</h4>
                    <div className="space-y-1">
                      {invoice.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center justify-between py-1.5">
                          <div>
                            <p className="text-sm text-gray-900">{item.description || item.feeName || '费用项'}</p>
                            {item.containerNumber && (
                              <p className="text-xs text-gray-500">柜号: {item.containerNumber}</p>
                            )}
                            {item.billNumber && !item.containerNumber && (
                              <p className="text-xs text-gray-500">提单: {item.billNumber}</p>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(item.amount, item.currency || payment.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )

      case 'billInfo':
        // 支持多订单显示
        const billList = payment.billInfoList && payment.billInfoList.length > 0 
          ? payment.billInfoList 
          : (payment.billInfo ? [payment.billInfo] : [])
        
        if (billList.length === 0) return null
        
        return (
          <div className="space-y-4">
            {/* 多订单提示 */}
            {billList.length > 1 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
                <Ship className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  本次收款关联 <strong>{billList.length}</strong> 个订单
                </span>
              </div>
            )}
            
            {/* 订单列表 */}
            {billList.map((bill, idx) => (
              <div key={bill.id || idx} className="border border-gray-100 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">提单号</label>
                    <p className="text-sm text-gray-900 font-medium mt-0.5">{bill.billNumber}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">集装箱号</label>
                    <p className="text-sm text-gray-900 font-mono mt-0.5">{bill.containerNumber || '-'}</p>
                  </div>
                  {bill.consignee && (
                    <div>
                      <label className="text-xs text-gray-500">收货人</label>
                      <p className="text-sm text-gray-900 mt-0.5">{bill.consignee}</p>
                    </div>
                  )}
                  {(bill.portOfLoading || bill.portOfDischarge) && (
                    <div>
                      <label className="text-xs text-gray-500">航线</label>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {bill.portOfLoading || '-'} → {bill.portOfDischarge || '-'}
                      </p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => navigate(`/bills/${bill.id}`)}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  查看订单详情 →
                </button>
              </div>
            ))}
          </div>
        )

      case 'customerInfo':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">名称</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {payment.customerCompanyName || payment.customerName || '-'}
              </p>
            </div>
            
            {payment.customerContactName && (
              <div>
                <label className="text-xs text-gray-500">联系人</label>
                <p className="text-sm text-gray-900 mt-1">{payment.customerContactName}</p>
              </div>
            )}
            
            {payment.customerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-900">{payment.customerPhone}</p>
              </div>
            )}
            
            {payment.customerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-900">{payment.customerEmail}</p>
              </div>
            )}
            
            {payment.customerAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-900">{payment.customerAddress}</p>
              </div>
            )}
            
            {payment.customerId && (
              <button
                onClick={() => navigate(`/crm/customers/${payment.customerId}`)}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700"
              >
                查看客户详情 →
              </button>
            )}
          </div>
        )

      case 'timeRecord':
        return (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">创建时间</label>
              <p className="text-sm text-gray-900 mt-1">{formatDate(payment.createTime, true) || '-'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">更新时间</label>
              <p className="text-sm text-gray-900 mt-1">{formatDate(payment.updateTime, true) || '-'}</p>
            </div>
          </div>
        )

      case 'receipt':
        if (!payment.receiptUrl) return null
        return (
          <a
            href={`${API_BASE}/api/payments/${payment.id}/receipt`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            查看凭证
          </a>
        )

      default:
        return null
    }
  }

  // 获取卡片配置
  const getCardConfig = (cardId: CardId) => {
    return CARD_CONFIGS.find(c => c.id === cardId)
  }

  // 检查卡片是否应该显示
  const shouldShowCard = (cardId: CardId) => {
    if (!payment) return false
    
    switch (cardId) {
      case 'paymentInfo':
        return true
      case 'bankAccount':
        return !!(payment.bankAccountInfo || payment.bankAccount)
      case 'invoice':
        return !!payment.invoiceId || (payment.invoices && payment.invoices.length > 0)
      case 'billInfo':
        return !!payment.billInfo || (payment.billInfoList && payment.billInfoList.length > 0)
      case 'customerInfo':
        return true
      case 'timeRecord':
        return true
      case 'receipt':
        return !!payment.receiptUrl
      default:
        return false
    }
  }

  // 获取卡片标题（根据收款/付款类型动态调整）
  const getCardTitle = (cardId: CardId) => {
    if (!payment) return ''
    const isIncome = payment.paymentType === 'income'
    
    switch (cardId) {
      case 'paymentInfo':
        return isIncome ? '收款信息' : '付款信息'
      case 'bankAccount':
        return isIncome ? '收款账户' : '付款账户'
      case 'customerInfo':
        return isIncome ? '付款方' : '收款方'
      case 'receipt':
        return isIncome ? '收款凭证' : '付款凭证'
      default:
        return getCardConfig(cardId)?.title || ''
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <PageHeader
          title="财务管理"
          tabs={tabs}
          activeTab="/finance/payments"
          onTabChange={(path) => navigate(path)}
        />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-gray-500">加载中...</span>
        </div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="p-4">
        <PageHeader
          title="财务管理"
          tabs={tabs}
          activeTab="/finance/payments"
          onTabChange={(path) => navigate(path)}
        />
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">收付款记录不存在</p>
          <button
            onClick={() => navigate('/finance/payments')}
            className="mt-4 text-primary-600 hover:text-primary-700"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const isIncome = payment.paymentType === 'income'
  const statusConfig = getStatusConfig(payment.status)
  const StatusIcon = statusConfig.icon

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务管理"
        tabs={tabs}
        activeTab="/finance/payments"
        onTabChange={(path) => navigate(path)}
      />

      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/finance/payments')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">返回列表</span>
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">拖拽卡片可调整顺序</span>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>

      {/* 主信息卡片 - 不可拖拽 */}
      <div className={`rounded-xl p-6 ${isIncome ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${isIncome ? 'bg-green-100' : 'bg-red-100'}`}>
                {isIncome ? (
                  <ArrowUpRight className={`w-6 h-6 ${isIncome ? 'text-green-600' : 'text-red-600'}`} />
                ) : (
                  <ArrowDownRight className={`w-6 h-6 ${isIncome ? 'text-green-600' : 'text-red-600'}`} />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{payment.paymentNumber}</h2>
                <p className={`text-sm ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                  {isIncome ? '收款记录' : '付款记录'}
                </p>
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusConfig.label}
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-1">{isIncome ? '收款' : '付款'}金额</p>
            <p className={`text-3xl font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
              {isIncome ? '+' : '-'}{formatCurrency(payment.amount, payment.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* 可拖拽的卡片区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧卡片列 */}
        <div className="lg:col-span-2 space-y-4">
          {leftCardOrder.map(cardId => {
            if (!shouldShowCard(cardId)) return null
            const config = getCardConfig(cardId)
            if (!config) return null
            
            return (
              <DraggableCard
                key={cardId}
                id={cardId}
                title={getCardTitle(cardId)}
                icon={config.icon}
                isDragging={dragCardId === cardId}
                isDropTarget={dropTargetId === cardId}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              >
                {renderCardContent(cardId)}
              </DraggableCard>
            )
          })}
        </div>

        {/* 右侧卡片列 */}
        <div className="space-y-4">
          {rightCardOrder.map(cardId => {
            if (!shouldShowCard(cardId)) return null
            const config = getCardConfig(cardId)
            if (!config) return null
            
            return (
              <DraggableCard
                key={cardId}
                id={cardId}
                title={getCardTitle(cardId)}
                icon={config.icon}
                isDragging={dragCardId === cardId}
                isDropTarget={dropTargetId === cardId}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              >
                {renderCardContent(cardId)}
              </DraggableCard>
            )
          })}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
              <p className="text-sm text-gray-500 mb-6">
                确定要删除这条{isIncome ? '收款' : '付款'}记录吗？此操作不可恢复。
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
