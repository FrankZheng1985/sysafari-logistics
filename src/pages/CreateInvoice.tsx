import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft, Save, FileText, Plus, Trash2, 
  Search, Calculator, AlertCircle, Package, Check, Upload,
  Building2, FileCheck, Eye, X, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Customer {
  id: string
  customerName: string
  companyName?: string  // 公司全称
  customerCode?: string
  contactPerson?: string
  contactPhone?: string
}

interface Supplier {
  id: string
  supplierName: string
  supplierCode?: string
  shortName?: string
  contactPerson?: string
  contactPhone?: string
}

interface Bill {
  id: string
  billNumber: string
  customerName?: string
  customerId?: string
  customerCode?: string
  consignee?: string
  status?: string
  deliveryStatus?: string
  pieces?: number
  portOfLoading?: string
  portOfDischarge?: string
  eta?: string
  createTime?: string
  // 扩展字段（匹配API返回的字段名）
  containerNumber?: string      // 集装箱号（4字母+7数字，如APZU3456782）
  ata?: string                  // ATA (实际到达时间)
  weight?: number               // 毛重
  volume?: number               // 体积
  actualArrivalDate?: string    // 实际到港时间
  // 运输相关
  cmrEstimatedPickupTime?: string  // 提货时间
  cmrConfirmedTime?: string        // 实际送达时间
  cmrUnloadingCompleteTime?: string  // 卸货完成时间
  // 费用金额（新建发票页面使用）
  receivableAmount?: number     // 应收金额
  payableAmount?: number        // 应付金额
}

interface Fee {
  id: string
  feeName: string
  category: string
  amount: number
  currency: string
  description?: string
  billId?: string
  billNumber?: string
  // 审批相关
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  isSupplementary?: boolean
  isLocked?: boolean
}

// 供应商费用项（包含订单信息）
interface SupplierFee extends Fee {
  billId: string
  billNumber: string
  containerNumber?: string  // 集装箱号
  feeDate?: string
  selected?: boolean
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  currency: string  // 货币
  amount: number
  taxRate: number
  taxAmount: number
  discountPercent: number  // 优惠百分比
  discountAmount: number   // 优惠金额
  finalAmount: number      // 最终金额（金额 + 税额 - 优惠）
  feeId?: string // 关联的费用ID
  billId?: string // 关联的订单ID
  billNumber?: string // 关联的订单号
  isFromOrder?: boolean // 是否来自订单（来自订单的数据禁止修改）
}

interface InvoiceFormData {
  invoiceType: 'sales' | 'purchase'
  invoiceDate: string
  dueDate: string
  customerId: string
  customerName: string
  supplierId: string  // 采购发票用
  supplierName: string  // 采购发票用
  billId: string
  billNumber: string
  currency: string
  exchangeRate: number
  description: string
  notes: string
  status: string
  items: InvoiceItem[]
  language: 'en' | 'zh'  // 发票语言：en=英文, zh=中文
  // 采购发票专用字段
  supplierInvoiceNumber: string  // 供应商发票号
  supplierInvoiceDate: string    // 供应商发票日期
}

export default function CreateInvoice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialType = searchParams.get('type') as 'sales' | 'purchase' || 'sales'
  const editInvoiceId = searchParams.get('edit')  // 编辑模式的发票ID
  const isEditMode = !!editInvoiceId
  
  const [loading, setLoading] = useState(false)
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('')  // 编辑模式保存原发票号码
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [billFees, setBillFees] = useState<Fee[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [billSearch, setBillSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showBillDropdown, setShowBillDropdown] = useState(false)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [selectedBills, setSelectedBills] = useState<Bill[]>([]) // 多选订单
  const [loadingFees, setLoadingFees] = useState(false)
  const [paymentDays, setPaymentDays] = useState<number | ''>(7)  // 账期天数，默认7天
  const [customerBillCounts, setCustomerBillCounts] = useState<Record<string, number>>({})  // 每个客户的可开票订单数
  
  // 采购发票专用状态
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierFees, setSupplierFees] = useState<SupplierFee[]>([])  // 供应商在各订单的应付费用
  const [loadingSupplierFees, setLoadingSupplierFees] = useState(false)
  const [feeSearchKeyword, setFeeSearchKeyword] = useState('')  // 费用搜索关键词（支持多集装箱号，空格分隔）
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])  // 上传的对账单/发票文件
  const [previewFile, setPreviewFile] = useState<string | null>(null)  // 预览的文件URL
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mergeSameFees, setMergeSameFees] = useState(true)  // 是否合并相同费用项（默认开启）
  
  // Refs for click outside detection
  const customerDropdownRef = useRef<HTMLDivElement>(null)
  const billDropdownRef = useRef<HTMLDivElement>(null)
  const supplierDropdownRef = useRef<HTMLDivElement>(null)
  
  // 计算初始到期日期（发票日期 + 7天）
  const getInitialDueDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceType: initialType,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: getInitialDueDate(),
    customerId: '',
    customerName: '',
    supplierId: '',
    supplierName: '',
    billId: '',
    billNumber: '',
    currency: 'EUR',
    exchangeRate: 1,
    description: '',
    notes: '',
    status: 'pending',
    items: [],
    language: 'en',  // 默认英文发票
    supplierInvoiceNumber: '',
    supplierInvoiceDate: ''
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

  const currencies = [
    { value: 'EUR', label: '欧元 (EUR)' },
    { value: 'USD', label: '美元 (USD)' },
    { value: 'CNY', label: '人民币 (CNY)' },
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

  const feeCategoryMap: Record<string, string> = {
    freight: '运费',
    customs: '关税',
    warehouse: '仓储费',
    insurance: '保险费',
    handling: '操作费',
    documentation: '文件费',
    other: '其他费用'
  }

  // 过滤后的费用列表（支持多集装箱号搜索，空格分隔）
  const filteredSupplierFees = useMemo(() => {
    if (!feeSearchKeyword.trim()) {
      return supplierFees
    }
    // 将搜索词按空格分割成多个关键词
    const keywords = feeSearchKeyword.trim().split(/\s+/).filter(k => k)
    if (keywords.length === 0) {
      return supplierFees
    }
    // 只要费用的集装箱号或提单号包含任意一个关键词，就显示
    return supplierFees.filter(fee => 
      keywords.some(keyword => {
        const kw = keyword.toUpperCase()
        return (fee.containerNumber?.toUpperCase().includes(kw) || 
                fee.billNumber?.toUpperCase().includes(kw))
      })
    )
  }, [supplierFees, feeSearchKeyword])

  // 按集装箱号分组的费用
  const groupedSupplierFees = useMemo(() => {
    const groups: Record<string, SupplierFee[]> = {}
    filteredSupplierFees.forEach(fee => {
      const key = fee.containerNumber || fee.billNumber || '未知'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(fee)
    })
    return groups
  }, [filteredSupplierFees])

  // 获取汇率
  const fetchExchangeRate = async (currency: string) => {
    if (currency === 'CNY') {
      setFormData(prev => ({ ...prev, exchangeRate: 1 }))
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/exchange-rate?from=${currency}&to=CNY`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.rate) {
        const rate = Number(data.data.rate)
        setFormData(prev => ({ ...prev, exchangeRate: rate }))
        console.log(`获取汇率成功: ${currency} -> CNY = ${rate}`)
      }
    } catch (error) {
      console.error('获取汇率失败:', error)
      // 使用默认汇率
      const defaultRates: Record<string, number> = {
        'EUR': 7.65,
        'USD': 7.10,
        'GBP': 8.90,
        'HKD': 0.91
      }
      setFormData(prev => ({ ...prev, exchangeRate: defaultRates[currency] || 1 }))
    }
  }

  // 加载编辑模式的发票数据
  const loadInvoiceForEdit = async (invoiceId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/api/invoices/${invoiceId}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        const invoice = data.data
        setEditInvoiceNumber(invoice.invoiceNumber)
        
        // 解析发票明细 - 优先从 items 字段读取（包含正确的金额）
        let items: InvoiceItem[] = []
        
        // 尝试从 items 字段解析
        let parsedItems: Array<{description: string, amount: number, quantity?: number, unitPrice?: number, taxRate?: number}> = []
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
          // 使用 items 字段的数据（包含正确的金额）
          items = parsedItems.map((item: any, index) => {
            const amount = Number(item.amount) || 0
            const quantity = item.quantity || 1
            // 如果有 unitPrice 就用 unitPrice，否则用 amount/quantity 计算
            const unitPrice = item.unitPrice || (quantity > 0 ? amount / quantity : amount)
            const taxRate = Number(item.taxRate) || 0
            const taxAmount = Number(item.taxAmount) || (amount * taxRate / 100)
            const discountPercent = Number(item.discountPercent) || 0
            const discountAmount = Number(item.discountAmount) || 0
            // 计算最终金额：如果有 finalAmount 就用，否则计算
            const percentDiscount = (amount + taxAmount) * (discountPercent / 100)
            const totalDiscount = percentDiscount + discountAmount
            const finalAmount = item.finalAmount !== undefined 
              ? Number(item.finalAmount) 
              : (amount + taxAmount - totalDiscount)
            return {
              id: String(index + 1),
              description: item.description || '',
              quantity: quantity,
              unitPrice: unitPrice,
              currency: invoice.currency || 'EUR',
              amount: amount,
              taxRate: taxRate,
              taxAmount: taxAmount,
              discountPercent: discountPercent,
              discountAmount: discountAmount,
              finalAmount: finalAmount,
              isFromOrder: false
            }
          })
        } else if (invoice.description) {
          // 后备方案：从 description 字段分割（旧数据兼容）
          const descriptions = invoice.description.split(';').filter((s: string) => s.trim())
          const amountPerItem = Number(invoice.totalAmount) / descriptions.length
          items = descriptions.map((desc: string, idx: number) => ({
            id: String(idx + 1),
            description: desc.trim(),
            quantity: 1,
            unitPrice: amountPerItem,
            currency: invoice.currency || 'EUR',
            amount: amountPerItem,
            taxRate: 0,
            taxAmount: 0,
            discountPercent: 0,
            discountAmount: 0,
            finalAmount: amountPerItem,
            isFromOrder: false
          }))
        }
        
        // 如果 items 中没有优惠数据，但 subtotal 和 totalAmount 有差异，需要分配优惠
        const invoiceSubtotal = Number(invoice.subtotal) || 0
        const invoiceTotal = Number(invoice.totalAmount) || 0
        const itemsTotalDiscount = items.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0)
        const itemsTotalPercentDiscount = items.reduce((sum, item) => {
          const itemSubtotal = (Number(item.amount) || 0) + (Number(item.taxAmount) || 0)
          return sum + itemSubtotal * (Number(item.discountPercent) || 0) / 100
        }, 0)
        
        // 如果 items 中没有优惠，但发票有优惠差额
        if (itemsTotalDiscount === 0 && itemsTotalPercentDiscount === 0 && invoiceSubtotal > invoiceTotal + 0.01) {
          const totalDiscount = invoiceSubtotal - invoiceTotal
          // 将优惠分配到特定费用类型（税号使用费、进口商代理费等）
          const targetKeywords = ['税号', '进口商代理', '代理费']
          const eligibleItems = items.filter(item => 
            targetKeywords.some(keyword => item.description.includes(keyword))
          )
          
          if (eligibleItems.length > 0) {
            const discountPerItem = totalDiscount / eligibleItems.length
            items = items.map(item => {
              if (targetKeywords.some(keyword => item.description.includes(keyword))) {
                const newDiscount = discountPerItem
                return {
                  ...item,
                  discountAmount: newDiscount,
                  finalAmount: item.amount + (Number(item.taxAmount) || 0) - newDiscount
                }
              }
              return item
            })
          }
        }

        // 设置表单数据
        setFormData({
          invoiceType: invoice.invoiceType || 'sales',
          invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0],
          dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
          customerId: invoice.customerId || '',
          customerName: invoice.customerName || '',
          supplierId: invoice.invoiceType === 'purchase' ? (invoice.customerId || '') : '',
          supplierName: invoice.invoiceType === 'purchase' ? (invoice.customerName || '') : '',
          billId: invoice.billId || '',
          billNumber: invoice.billNumber || '',
          currency: invoice.currency || 'EUR',
          exchangeRate: Number(invoice.exchangeRate) || 1,
          description: invoice.description || '',
          notes: invoice.notes || '',
          status: invoice.status || 'issued',
          items: items.length > 0 ? items : [{ id: '1', description: '', quantity: 1, unitPrice: 0, currency: 'EUR', amount: 0, taxRate: 0, taxAmount: 0, discountPercent: 0, discountAmount: 0, finalAmount: 0, isFromOrder: false }],
          language: invoice.language || 'en',  // 发票语言
          supplierInvoiceNumber: invoice.supplierInvoiceNumber || '',
          supplierInvoiceDate: invoice.supplierInvoiceDate || ''
        })

        // 计算账期天数
        if (invoice.dueDate && invoice.invoiceDate) {
          const days = Math.ceil((new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24))
          setPaymentDays(days > 0 ? days : '')
        }

        // 如果有关联订单，加载订单信息
        if (invoice.billId) {
          const billResponse = await fetch(`${API_BASE}/api/bills/${invoice.billId}`)
          const billData = await billResponse.json()
          if (billData.errCode === 200 && billData.data) {
            setSelectedBill(billData.data)
            setBillSearch(billData.data.billNumber)
            // 加载订单费用（根据发票类型筛选费用类型）
            fetchBillFees(invoice.billId, invoice.invoiceType)
          }
        }

        // 设置客户搜索
        setCustomerSearch(invoice.customerName || '')
      }
    } catch (error) {
      console.error('加载发票数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    fetchSuppliers()
    fetchCompletedBills('', initialType) // 初始加载时使用初始发票类型
    // 初始加载时获取默认货币汇率
    fetchExchangeRate('EUR')
    
    // 编辑模式：加载发票数据
    if (editInvoiceId) {
      loadInvoiceForEdit(editInvoiceId)
    }
  }, [])
  
  // 当发票类型改变时，重置所有关联信息
  // 销售发票关联客户和订单，采购发票关联供应商
  useEffect(() => {
    if (formData.invoiceType === 'sales') {
      fetchCustomers(customerSearch)
      // 重新获取订单列表（根据新的发票类型过滤）
      fetchCompletedBills('', formData.invoiceType)
    } else {
      fetchSuppliers(supplierSearch)
    }
    // 切换发票类型时，清空所有选择
    setSelectedBill(null)
    setSelectedBills([])
    setBillSearch('')
    setBillFees([])
    setCustomerSearch('')
    setSelectedSupplier(null)
    setSupplierSearch('')
    setSupplierFees([])
    setUploadedFiles([])
    setFormData(prev => ({ 
      ...prev, 
      billId: '',
      billNumber: '',
      customerId: '', 
      customerName: '',
      supplierId: '',
      supplierName: '',
      supplierInvoiceNumber: '',
      supplierInvoiceDate: '',
      items: []
    }))
  }, [formData.invoiceType])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
      if (billDropdownRef.current && !billDropdownRef.current.contains(event.target as Node)) {
        setShowBillDropdown(false)
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setShowSupplierDropdown(false)
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

      const response = await fetch(`${API_BASE}/api/customers?${params}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        const customerList = data.data.list
        setCustomers(customerList)
        
        // 异步获取每个客户的可开票订单数量
        const counts: Record<string, number> = {}
        for (const customer of customerList) {
          try {
            const billParams = new URLSearchParams({
              pageSize: '100',
              type: 'history',
              forInvoiceType: formData.invoiceType,
              customerId: customer.id
            })
            const billResponse = await fetch(`${API_BASE}/api/bills?${billParams}`)
            const billData = await billResponse.json()
            if (billData.errCode === 200 && billData.data?.list) {
              counts[customer.id] = billData.data.list.length
            } else {
              counts[customer.id] = 0
            }
          } catch {
            counts[customer.id] = 0
          }
        }
        setCustomerBillCounts(counts)
      }
    } catch (error) {
      console.error('获取客户列表失败:', error)
    }
  }

  const fetchSuppliers = async (search = '') => {
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (search) params.append('search', search)

      const response = await fetch(`${API_BASE}/api/suppliers?${params}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setSuppliers(data.data.list)
      }
    } catch (error) {
      console.error('获取供应商列表失败:', error)
    }
  }

  // 获取已完成的订单（排除已开票并完成收付款的订单）
  const fetchCompletedBills = async (search = '', invoiceType = formData.invoiceType, customerId = '') => {
    try {
      const params = new URLSearchParams({ 
        pageSize: '50',
        type: 'history', // 获取已完成的订单
        forInvoiceType: invoiceType, // 排除该类型已完成收付款的订单
        includeFeeAmount: 'true'  // 包含费用金额统计，用于显示应收/应付金额
      })
      if (customerId) params.append('customerId', customerId)
      if (search) params.append('search', search)
      
      const response = await fetch(`${API_BASE}/api/bills?${params}`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setBills(data.data.list)
      }
    } catch (error) {
      console.error('获取订单列表失败:', error)
    }
  }

  // 获取订单关联的费用
  // 根据发票类型筛选对应的费用类型：销售发票->应收费用，采购发票->应付费用
  // 过滤条件：只显示已审批通过的费用（过滤 pending/rejected）
  const fetchBillFees = async (billId: string, invoiceType?: 'sales' | 'purchase') => {
    setLoadingFees(true)
    try {
      // 根据发票类型确定费用类型
      // 销售发票(sales) -> 应收费用(receivable)
      // 采购发票(purchase) -> 应付费用(payable)
      const feeType = invoiceType === 'purchase' ? 'payable' : 'receivable'
      const response = await fetch(`${API_BASE}/api/fees?billId=${billId}&feeType=${feeType}&pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        // 基于 feeId 去重，并过滤掉待审批和已拒绝的费用
        // 只保留 approvalStatus 为 'approved' 或 undefined（旧数据）的费用
        const uniqueFees = data.data.list.filter((fee: Fee, index: number, self: Fee[]) => {
          // 去重
          const isUnique = index === self.findIndex((f: Fee) => f.id === fee.id)
          // 过滤审批状态：只保留已审批通过的
          const isApproved = !fee.approvalStatus || fee.approvalStatus === 'approved'
          return isUnique && isApproved
        })
        setBillFees(uniqueFees)
        
        let items: InvoiceItem[]
        
        if (mergeSameFees) {
          // 合并相同费用项：按费用名称分组汇总
          const feeMap = new Map<string, {
            feeName: string
            totalAmount: number
            count: number
            currency: string
            feeIds: string[]
            unitPrices: number[]
          }>()
          
          uniqueFees.forEach((fee: Fee) => {
            const feeName = fee.feeName || feeCategoryMap[fee.category] || '费用'
            const amount = Number(fee.amount) || 0
            const existing = feeMap.get(feeName)
            
            if (existing) {
              existing.totalAmount += amount
              existing.count += 1
              existing.feeIds.push(fee.id)
              existing.unitPrices.push(amount)
            } else {
              feeMap.set(feeName, {
                feeName,
                totalAmount: amount,
                count: 1,
                currency: fee.currency || 'EUR',
                feeIds: [fee.id],
                unitPrices: [amount]
              })
            }
          })
          
          // 转换为发票明细项
          items = Array.from(feeMap.values()).map((group, index) => {
            const allSamePrice = group.unitPrices.every(p => p === group.unitPrices[0])
            return {
              id: (index + 1).toString(),
              description: group.feeName,
              quantity: group.count,
              unitPrice: allSamePrice ? group.unitPrices[0] : -1,
              currency: group.currency,
              amount: group.totalAmount,
              taxRate: 0,
              taxAmount: 0,
              discountPercent: 0,
              discountAmount: 0,
              finalAmount: group.totalAmount,
              feeId: group.feeIds.join(','),
              isFromOrder: true
            }
          })
        } else {
          // 不合并：每个费用项单独显示
          items = uniqueFees.map((fee: Fee, index: number) => ({
            id: (index + 1).toString(),
            description: fee.feeName || feeCategoryMap[fee.category] || '费用',
            quantity: 1,
            unitPrice: Number(fee.amount) || 0,
            currency: fee.currency || 'EUR',
            amount: Number(fee.amount) || 0,
            taxRate: 0,
            taxAmount: 0,
            discountPercent: 0,
            discountAmount: 0,
            finalAmount: Number(fee.amount) || 0,
            feeId: fee.id,
            isFromOrder: true
          }))
        }
        
        setFormData(prev => ({ ...prev, items }))
      } else {
        setBillFees([])
        // 如果没有费用，添加一个空行
        setFormData(prev => ({ 
          ...prev, 
          items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, currency: 'EUR', amount: 0, taxRate: 0, taxAmount: 0, discountPercent: 0, discountAmount: 0, finalAmount: 0, isFromOrder: false }]
        }))
      }
    } catch (error) {
      console.error('获取订单费用失败:', error)
      setBillFees([])
    } finally {
      setLoadingFees(false)
    }
  }

  // 获取供应商在各订单下的应付费用
  const fetchSupplierFees = async (supplierId: string, supplierName: string) => {
    setLoadingSupplierFees(true)
    try {
      // 获取该供应商的所有应付费用（跨订单），采购发票只显示应付费用
      // 使用供应商名称查询（兼容不同ID格式）
      const response = await fetch(`${API_BASE}/api/fees?supplierName=${encodeURIComponent(supplierName)}&feeType=payable&pageSize=500`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        // 按订单分组显示费用，并标记选中状态
        const fees: SupplierFee[] = data.data.list.map((fee: Fee & { billId: string; billNumber: string; feeDate?: string }) => ({
          ...fee,
          selected: false
        }))
        setSupplierFees(fees)
      } else {
        setSupplierFees([])
      }
    } catch (error) {
      console.error('获取供应商费用失败:', error)
      setSupplierFees([])
    } finally {
      setLoadingSupplierFees(false)
    }
  }

  // 选择供应商
  const selectSupplier = async (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setSupplierSearch(supplier.supplierName)
    setShowSupplierDropdown(false)
    setFormData(prev => ({
      ...prev,
      supplierId: supplier.id,
      supplierName: supplier.supplierName
    }))
    // 加载该供应商的费用（使用供应商名称查询，兼容不同ID格式）
    await fetchSupplierFees(supplier.id, supplier.supplierName)
  }

  // 清除供应商选择
  const clearSupplierSelection = () => {
    setSelectedSupplier(null)
    setSupplierSearch('')
    setSupplierFees([])
    setUploadedFiles([])
    setFormData(prev => ({
      ...prev,
      supplierId: '',
      supplierName: '',
      supplierInvoiceNumber: '',
      supplierInvoiceDate: '',
      items: []
    }))
  }

  // 切换费用选中状态
  const toggleFeeSelection = (feeId: string) => {
    setSupplierFees(prev => prev.map(fee => 
      fee.id === feeId ? { ...fee, selected: !fee.selected } : fee
    ))
  }

  // 全选/取消全选（针对当前过滤后的费用）
  const toggleSelectAll = () => {
    const targetFees = filteredSupplierFees
    const allSelected = targetFees.every(fee => fee.selected)
    const targetIds = new Set(targetFees.map(f => f.id))
    setSupplierFees(prev => prev.map(fee => 
      targetIds.has(fee.id) ? { ...fee, selected: !allSelected } : fee
    ))
  }

  // 按集装箱选择/取消选择
  const toggleContainerSelection = (containerKey: string) => {
    const containerFees = groupedSupplierFees[containerKey] || []
    const allSelected = containerFees.every(fee => fee.selected)
    const containerFeeIds = new Set(containerFees.map(f => f.id))
    setSupplierFees(prev => prev.map(fee => 
      containerFeeIds.has(fee.id) ? { ...fee, selected: !allSelected } : fee
    ))
  }

  // 将选中的费用转换为发票明细
  const confirmSelectedFees = () => {
    const selectedFeesList = supplierFees.filter(fee => fee.selected)
    if (selectedFeesList.length === 0) {
      alert('请至少选择一项费用')
      return
    }
    
    let items: InvoiceItem[]
    
    if (mergeSameFees) {
      // 合并相同费用项：按费用名称分组汇总
      const feeMap = new Map<string, {
        feeName: string
        totalAmount: number
        count: number
        currency: string
        feeIds: string[]
        billIds: string[]
        billNumbers: string[]
        unitPrices: number[]  // 记录所有单价，用于判断是否一致
      }>()
      
      selectedFeesList.forEach(fee => {
        const feeName = fee.feeName || feeCategoryMap[fee.category] || '费用'
        const amount = Number(fee.amount) || 0
        const existing = feeMap.get(feeName)
        
        if (existing) {
          existing.totalAmount += amount
          existing.count += 1
          existing.feeIds.push(fee.id)
          existing.unitPrices.push(amount)
          if (!existing.billIds.includes(fee.billId)) {
            existing.billIds.push(fee.billId)
          }
          if (!existing.billNumbers.includes(fee.billNumber)) {
            existing.billNumbers.push(fee.billNumber)
          }
        } else {
          feeMap.set(feeName, {
            feeName,
            totalAmount: amount,
            count: 1,
            currency: fee.currency || 'EUR',
            feeIds: [fee.id],
            billIds: [fee.billId],
            billNumbers: [fee.billNumber],
            unitPrices: [amount]
          })
        }
      })
      
      // 转换为发票明细项
      items = Array.from(feeMap.values()).map((group, index) => {
        // 检查单价是否一致
        const allSamePrice = group.unitPrices.every(p => p === group.unitPrices[0])
        return {
          id: (index + 1).toString(),
          description: group.feeName,
          quantity: group.count,
          unitPrice: allSamePrice ? group.unitPrices[0] : -1,  // -1 表示单价不一致，显示"多项"
          currency: group.currency,
          amount: group.totalAmount,
          taxRate: 0,
          taxAmount: 0,
          discountPercent: 0,
          discountAmount: 0,
          finalAmount: group.totalAmount,
          feeId: group.feeIds.join(','),  // 保存所有关联的费用ID
          billId: group.billIds.join(','),  // 保存所有关联的订单ID
          billNumber: group.billNumbers.join(','),  // 保存所有关联的订单号
          isFromOrder: true
        }
      })
    } else {
      // 不合并：每个费用项单独显示
      items = selectedFeesList.map((fee, index) => ({
        id: (index + 1).toString(),
        description: `${fee.billNumber} - ${fee.feeName || feeCategoryMap[fee.category] || '费用'}`,
        quantity: 1,
        unitPrice: Number(fee.amount) || 0,
        currency: fee.currency || 'EUR',
        amount: Number(fee.amount) || 0,
        taxRate: 0,
        taxAmount: 0,
        discountPercent: 0,
        discountAmount: 0,
        finalAmount: Number(fee.amount) || 0,
        feeId: fee.id,
        billId: fee.billId,
        billNumber: fee.billNumber,
        isFromOrder: true
      }))
    }
    
    setFormData(prev => ({ ...prev, items }))
  }

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)])
    }
  }

  // 移除上传的文件
  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // 预览文件
  const handlePreviewFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setPreviewFile(url)
  }

  // 根据账期天数计算到期日期
  const calculateDueDate = (invoiceDate: string, days: number): string => {
    if (!invoiceDate || !days) return ''
    const date = new Date(invoiceDate)
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  // 当账期天数变化时更新到期日期
  const handlePaymentDaysChange = (days: number | '') => {
    setPaymentDays(days)
    if (days && formData.invoiceDate) {
      const dueDate = calculateDueDate(formData.invoiceDate, days)
      setFormData(prev => ({ ...prev, dueDate }))
    } else {
      setFormData(prev => ({ ...prev, dueDate: '' }))
    }
  }

  // 当发票日期变化时重新计算到期日期
  const handleInvoiceDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, invoiceDate: date }))
    if (paymentDays && date) {
      const dueDate = calculateDueDate(date, paymentDays)
      setFormData(prev => ({ ...prev, dueDate }))
    }
  }

  // 计算单行金额（确保数值类型正确，包含优惠计算）
  const calculateItemAmount = (item: InvoiceItem) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    const taxRate = Number(item.taxRate) || 0
    const discountPercent = Number(item.discountPercent) || 0
    const discountAmount = Number(item.discountAmount) || 0
    
    // 如果单价为 -1（表示"多项"合并），保持原有金额不变
    const amount = unitPrice === -1 ? (Number(item.amount) || 0) : quantity * unitPrice
    const taxAmount = amount * (taxRate / 100)
    
    // 计算优惠：百分比优惠 + 固定金额优惠（支持负数）
    const percentDiscount = (amount + taxAmount) * (discountPercent / 100)
    const totalDiscount = percentDiscount + discountAmount
    
    // 最终金额 = 金额 + 税额 - 优惠
    const finalAmount = amount + taxAmount - totalDiscount
    
    return { amount, taxAmount, finalAmount }
  }

  // 更新发票项
  const updateItem = (id: string, field: keyof InvoiceItem, value: number | string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== id) return item

        const updated = { ...item, [field]: value }
        // 当数量、单价、税率或优惠字段变化时重新计算
        if (['quantity', 'unitPrice', 'taxRate', 'discountPercent', 'discountAmount'].includes(field)) {
          const { amount, taxAmount, finalAmount } = calculateItemAmount(updated)
          updated.amount = amount
          updated.taxAmount = taxAmount
          updated.finalAmount = finalAmount
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
        finalAmount: 0,
        isFromOrder: false  // 手动添加的项目可以修改
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

  // 计算合计（确保所有数值都是数字类型）
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    const taxAmount = formData.items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0)
    // 计算折扣/调整金额：百分比折扣 + 固定金额折扣
    const discountAmount = formData.items.reduce((sum, item) => {
      const discountPercent = Number(item.discountPercent) || 0
      const discountAmt = Number(item.discountAmount) || 0
      const itemSubtotal = (Number(item.amount) || 0) + (Number(item.taxAmount) || 0)
      return sum + (itemSubtotal * discountPercent / 100) + discountAmt
    }, 0)
    // 最终金额 = 小计 + 税额 - 折扣
    const totalAmount = subtotal + taxAmount - discountAmount
    return { subtotal, taxAmount, discountAmount, totalAmount }
  }

  // 选择客户
  const selectCustomer = (customer: Customer) => {
    // 发票使用公司全称，如果没有全称则使用客户名称
    const displayName = customer.companyName || customer.customerName
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: displayName
    }))
    setCustomerSearch(displayName)
    setShowCustomerDropdown(false)
    
    // 清空之前选择的订单
    setSelectedBill(null)
    setSelectedBills([])
    setBillSearch('')
    setBillFees([])
    
    // 根据客户筛选订单
    fetchCompletedBills('', formData.invoiceType, customer.id)
  }
  
  // 清除客户选择
  const clearCustomerSelection = () => {
    setFormData(prev => ({
      ...prev,
      customerId: '',
      customerName: '',
      billId: '',
      billNumber: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, currency: 'EUR', amount: 0, taxRate: 0, taxAmount: 0, discountPercent: 0, discountAmount: 0, finalAmount: 0, isFromOrder: false }]
    }))
    setCustomerSearch('')
    setSelectedBill(null)
    setSelectedBills([])
    setBillSearch('')
    setBillFees([])
    setBills([])
  }

  // 选择订单（单选模式，用于向后兼容）
  const selectBill = async (bill: Bill) => {
    setSelectedBill(bill)
    setBillSearch(bill.billNumber)
    setShowBillDropdown(false)
    
    // 更新表单数据
    setFormData(prev => ({
      ...prev,
      billId: bill.id,
      billNumber: bill.billNumber,
      customerId: bill.customerId || '',
      customerName: bill.customerName || bill.consignee || ''
    }))
    setCustomerSearch(bill.customerName || bill.consignee || '')
    
    // 获取订单关联的费用（根据发票类型筛选费用类型）
    await fetchBillFees(bill.id, formData.invoiceType)
  }

  // 切换订单选择（多选模式）
  const toggleBillSelection = (bill: Bill) => {
    setSelectedBills(prev => {
      const isSelected = prev.some(b => b.id === bill.id)
      if (isSelected) {
        return prev.filter(b => b.id !== bill.id)
      } else {
        return [...prev, bill]
      }
    })
  }

  // 确认多选订单
  const confirmMultiBillSelection = async () => {
    if (selectedBills.length === 0) return
    
    // 使用第一个订单的客户信息
    const firstBill = selectedBills[0]
    setFormData(prev => ({
      ...prev,
      billId: selectedBills.map(b => b.id).join(','),
      billNumber: selectedBills.map(b => b.billNumber).join(', '),
      customerId: firstBill.customerId || '',
      customerName: firstBill.customerName || firstBill.consignee || ''
    }))
    setCustomerSearch(firstBill.customerName || firstBill.consignee || '')
    
    // 获取所有订单的费用（根据发票类型筛选费用类型）
    setLoadingFees(true)
    try {
      const allFees: (Fee & { billId: string; billNumber: string })[] = []
      // 销售发票(sales) -> 应收费用(receivable)，采购发票(purchase) -> 应付费用(payable)
      const feeType = formData.invoiceType === 'purchase' ? 'payable' : 'receivable'
      for (const bill of selectedBills) {
        const response = await fetch(`${API_BASE}/api/fees?billId=${bill.id}&feeType=${feeType}&pageSize=100`)
        const data = await response.json()
        if (data.errCode === 200 && data.data?.list) {
          // 为每个费用添加订单信息
          const feesWithBillInfo = data.data.list.map((fee: Fee) => ({
            ...fee,
            billId: bill.id,
            billNumber: bill.billNumber
          }))
          allFees.push(...feesWithBillInfo)
        }
      }
      
      // 基于 feeId 去重，防止重复费用（同一费用可能在多个查询中返回）
      const uniqueFees = allFees.filter((fee, index, self) => 
        index === self.findIndex((f) => f.id === fee.id)
      )
      setBillFees(uniqueFees)
      
      let items: InvoiceItem[]
      
      if (mergeSameFees) {
        // 合并相同费用项：按费用名称分组汇总
        const feeMap = new Map<string, {
          feeName: string
          totalAmount: number
          count: number
          currency: string
          feeIds: string[]
          billIds: string[]
          billNumbers: string[]
          unitPrices: number[]  // 记录所有单价，用于判断是否一致
        }>()
        
        uniqueFees.forEach(fee => {
          const feeName = fee.feeName || feeCategoryMap[fee.category] || '费用'
          const amount = typeof fee.amount === 'string' ? parseFloat(fee.amount) || 0 : fee.amount || 0
          const existing = feeMap.get(feeName)
          
          if (existing) {
            existing.totalAmount += amount
            existing.count += 1
            existing.feeIds.push(fee.id)
            existing.unitPrices.push(amount)
            if (!existing.billIds.includes(fee.billId)) {
              existing.billIds.push(fee.billId)
            }
            if (!existing.billNumbers.includes(fee.billNumber)) {
              existing.billNumbers.push(fee.billNumber)
            }
          } else {
            feeMap.set(feeName, {
              feeName,
              totalAmount: amount,
              count: 1,
              currency: fee.currency || 'EUR',
              feeIds: [fee.id],
              billIds: [fee.billId],
              billNumbers: [fee.billNumber],
              unitPrices: [amount]
            })
          }
        })
        
        // 转换为发票明细项
        items = Array.from(feeMap.values()).map((group, index) => {
          // 检查单价是否一致
          const allSamePrice = group.unitPrices.every(p => p === group.unitPrices[0])
          return {
            id: (index + 1).toString(),
            description: group.feeName,
            quantity: group.count,
            unitPrice: allSamePrice ? group.unitPrices[0] : -1,  // -1 表示单价不一致，显示"多项"
            currency: group.currency,
            amount: group.totalAmount,
            taxRate: 0,
            taxAmount: 0,
            discountPercent: 0,
            discountAmount: 0,
            finalAmount: group.totalAmount,
            feeId: group.feeIds.join(','),  // 保存所有关联的费用ID
            billId: group.billIds.join(','),  // 保存所有关联的订单ID
            billNumber: group.billNumbers.join(','),  // 保存所有关联的订单号
            isFromOrder: true
          }
        })
      } else {
        // 不合并：每个费用项单独显示
        items = uniqueFees.map((fee, index) => ({
          id: (index + 1).toString(),
          description: fee.feeName || feeCategoryMap[fee.category] || '费用',
          quantity: 1,
          unitPrice: typeof fee.amount === 'string' ? parseFloat(fee.amount) || 0 : fee.amount || 0,
          currency: fee.currency || 'EUR',
          amount: typeof fee.amount === 'string' ? parseFloat(fee.amount) || 0 : fee.amount || 0,
          taxRate: typeof (fee as any).taxRate === 'string' ? parseFloat((fee as any).taxRate) || 0 : (fee as any).taxRate || 0,
          taxAmount: 0,
          discountPercent: 0,
          discountAmount: 0,
          finalAmount: typeof fee.amount === 'string' ? parseFloat(fee.amount) || 0 : fee.amount || 0,
          feeId: fee.id,
          billId: fee.billId,
          billNumber: fee.billNumber,
          isFromOrder: true
        }))
      }
      
      if (items.length > 0) {
        setFormData(prev => ({ ...prev, items }))
      }
    } catch (error) {
      console.error('获取费用失败:', error)
    } finally {
      setLoadingFees(false)
    }
    
    setShowBillDropdown(false)
    // 设置 selectedBill 为第一个订单（向后兼容）
    setSelectedBill(firstBill)
  }

  // 清除订单选择
  const clearBillSelection = () => {
    setSelectedBill(null)
    setSelectedBills([])
    setBillSearch('')
    setBillFees([])
    setFormData(prev => ({
      ...prev,
      billId: '',
      billNumber: '',
      customerId: '',
      customerName: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, currency: 'EUR', amount: 0, taxRate: 0, taxAmount: 0, discountPercent: 0, discountAmount: 0, finalAmount: 0, isFromOrder: false }]
    }))
    setCustomerSearch('')
  }

  // 提交表单
  const handleSubmit = async () => {
    // 表单验证
    const totals = calculateTotals()

    // 销售发票需要选择订单，采购发票需要选择供应商
    if (formData.invoiceType === 'sales') {
      if (!formData.billId) {
        alert('请先选择关联订单')
        return
      }
      if (!formData.customerName.trim()) {
        alert('请选择或输入客户')
        return
      }
    } else {
      // 采购发票
      if (!formData.supplierId) {
        alert('请先选择供应商')
        return
      }
      if (formData.items.length === 0) {
        alert('请选择需要核对的费用项')
        return
      }
    }

    if (totals.totalAmount <= 0) {
      alert('发票金额必须大于0')
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
      // 采购发票可能关联多个订单
      const billIds = formData.invoiceType === 'purchase' 
        ? [...new Set(formData.items.map(item => item.billId).filter(Boolean))]
        : [formData.billId]
      const billNumbers = formData.invoiceType === 'purchase'
        ? [...new Set(formData.items.map(item => item.billNumber).filter(Boolean))]
        : [formData.billNumber]
      
      // 提取集装箱号：从选中的订单中获取
      const containerNumbers = formData.invoiceType === 'sales'
        ? selectedBills.map(b => b.containerNumber).filter(Boolean)
        : [...new Set(formData.items.map(item => {
            // 从 supplierFees 中查找对应订单的集装箱号
            const fee = supplierFees.find(f => f.billId === item.billId)
            return fee?.containerNumber
          }).filter(Boolean))]

      const submitData = {
        invoiceType: formData.invoiceType,
        invoiceDate: formData.invoiceDate,
        dueDate: formData.dueDate || null,
        // 销售发票用客户，采购发票用供应商
        customerId: formData.invoiceType === 'sales' ? formData.customerId : formData.supplierId,
        customerName: formData.invoiceType === 'sales' ? formData.customerName : formData.supplierName,
        billId: billIds.join(','),  // 多个订单ID用逗号分隔
        billNumber: billNumbers.join(', '),  // 可能多个订单号
        containerNumbers: containerNumbers,  // 集装箱号数组
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        currency: formData.currency,
        exchangeRate: formData.exchangeRate,
        language: formData.language,  // 发票语言
        description: formData.description || formData.items.map(i => i.description).join('; '),
        items: JSON.stringify(formData.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          currency: item.currency,
          amount: item.amount,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          finalAmount: item.finalAmount,
          billId: item.billId,
          billNumber: item.billNumber,
          feeId: item.feeId
        }))),
        notes: formData.notes,
        // 采购发票额外信息
        supplierInvoiceNumber: formData.supplierInvoiceNumber || null,
        supplierInvoiceDate: formData.supplierInvoiceDate || null,
        status: formData.status
      }

      let response
      if (isEditMode && editInvoiceId) {
        // 编辑模式：更新发票
        response = await fetch(`${API_BASE}/api/invoices/${editInvoiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        })
      } else {
        // 创建模式：新建发票
        response = await fetch(`${API_BASE}/api/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        })
      }

      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(isEditMode ? '发票更新成功' : '发票创建成功')
        if (isEditMode && editInvoiceId) {
          navigate(`/finance/invoices/${editInvoiceId}`)
        } else {
          navigate('/finance/invoices')
        }
      } else {
        alert(data.msg || (isEditMode ? '更新失败' : '创建失败'))
      }
    } catch (error) {
      console.error(isEditMode ? '更新发票失败:' : '创建发票失败:', error)
      alert(isEditMode ? '更新发票失败' : '创建发票失败')
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, taxAmount, discountAmount, totalAmount } = calculateTotals()

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
            title="返回发票列表"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              {isEditMode ? `编辑发票 ${editInvoiceNumber}` : `新建${formData.invoiceType === 'sales' ? '销售' : '采购'}发票`}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance/invoices')}
            title="取消并返回"
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (formData.invoiceType === 'sales' ? !selectedBill : formData.items.length === 0)}
            title={isEditMode ? '更新发票' : '保存发票'}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : (isEditMode ? '更新发票' : '保存发票')}
          </button>
        </div>
      </div>

      {/* 步骤1：选择发票类型 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-primary-600 text-white">
            1
          </div>
          <h2 className="text-sm font-medium text-gray-900">选择发票类型</h2>
        </div>
        
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, invoiceType: 'sales' }))}
            title="选择销售发票类型"
            className={`flex-1 px-4 py-4 rounded-lg border-2 transition-all ${
              formData.invoiceType === 'sales'
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="text-base font-medium mb-1">销售发票（应收）</div>
            <div className="text-xs text-gray-500">向客户开具发票，记录应收账款</div>
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, invoiceType: 'purchase' }))}
            title="选择采购发票类型"
            className={`flex-1 px-4 py-4 rounded-lg border-2 transition-all ${
              formData.invoiceType === 'purchase'
                ? 'bg-orange-50 border-orange-500 text-orange-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="text-base font-medium mb-1">采购发票（应付）</div>
            <div className="text-xs text-gray-500">录入供应商发票，记录应付账款</div>
          </button>
        </div>
      </div>

      {/* 步骤2：销售发票选择客户 / 采购发票选择供应商 */}
      {formData.invoiceType === 'sales' ? (
        <>
        {/* 销售发票：步骤2 选择客户 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              formData.customerId ? 'bg-green-500 text-white' : 'bg-primary-600 text-white'
            }`}>
              {formData.customerId ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <h2 className="text-sm font-medium text-gray-900">选择客户</h2>
            <span className="text-xs text-gray-500">（选择开票客户）</span>
          </div>
          
          {!formData.customerId ? (
            <div className="relative" ref={customerDropdownRef}>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    fetchCustomers(e.target.value)
                    setShowCustomerDropdown(true)
                  }}
                  onFocus={() => {
                    fetchCustomers(customerSearch)
                    setShowCustomerDropdown(true)
                  }}
                  placeholder="搜索客户名称..."
                  title="搜索客户"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {showCustomerDropdown && customers.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {customers.map(customer => {
                    const billCount = customerBillCounts[customer.id] ?? -1
                    return (
                      <div
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{customer.companyName || customer.customerName}</span>
                            {/* 显示可开票订单数量 */}
                            {billCount >= 0 ? (
                              billCount > 0 ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                                  {billCount}个柜
                                </span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                                  0柜
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-gray-300">...</span>
                            )}
                          </div>
                          {(customer as any).customerType && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {(customer as any).customerType}
                            </span>
                          )}
                        </div>
                        {/* 如果有公司全称，显示简称作为提示 */}
                        {customer.companyName && customer.customerName !== customer.companyName && (
                          <div className="mt-0.5 text-xs text-gray-400">
                            简称: {customer.customerName}
                          </div>
                        )}
                        {customer.contactPerson && (
                          <div className="mt-1 text-xs text-gray-500">
                            联系人: {customer.contactPerson} {(customer as any).phone && `| ${(customer as any).phone}`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {showCustomerDropdown && customers.length === 0 && customerSearch && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                  未找到匹配的客户
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-600" />
                  <span className="text-sm font-medium text-gray-900">{formData.customerName}</span>
                  {/* 显示可开票订单数量 */}
                  {bills.length > 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      {bills.length} 个柜子可开票
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      暂无可开票订单
                    </span>
                  )}
                </div>
                <button 
                  onClick={clearCustomerSelection}
                  title="更换客户"
                  className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded transition-colors"
                >
                  更换客户
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* 销售发票：步骤3 选择订单 */}
        <div className={`bg-white rounded-lg border border-gray-200 p-4 ${!formData.customerId ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              selectedBill ? 'bg-green-500 text-white' : formData.customerId ? 'bg-primary-600 text-white' : 'bg-gray-300 text-white'
            }`}>
              {selectedBill ? <Check className="w-4 h-4" /> : '3'}
            </div>
            <h2 className="text-sm font-medium text-gray-900">选择订单</h2>
            <span className="text-xs text-gray-500">
              {formData.customerId ? '（从该客户的已完成订单中选择，支持多选）' : '（请先选择客户）'}
            </span>
          </div>

          {!selectedBill ? (
            <div className="space-y-3" ref={billDropdownRef}>
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={billSearch}
                  onChange={(e) => {
                    if (!formData.customerId) return
                    setBillSearch(e.target.value)
                    fetchCompletedBills(e.target.value, formData.invoiceType, formData.customerId)
                    setShowBillDropdown(true)
                  }}
                  onFocus={() => {
                    if (formData.customerId) {
                      setShowBillDropdown(true)
                    }
                  }}
                  disabled={!formData.customerId}
                  placeholder={formData.customerId ? "搜索提单号、集装箱号（支持空格分隔多个批量搜索）" : "请先选择客户"}
                  title="搜索订单"
                  className={`w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    !formData.customerId ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              
              {/* 已选订单标签 */}
              {selectedBills.length > 0 && (
                <div className="space-y-2 p-2 bg-blue-50 rounded-lg">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-blue-600 font-medium">已选 {selectedBills.length} 个订单:</span>
                    {selectedBills.map(bill => (
                      <span 
                        key={bill.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs text-blue-700"
                      >
                        {bill.containerNumber || bill.billNumber}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleBillSelection(bill)
                          }}
                          title="取消选择"
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* 多订单合并选项 */}
                  {selectedBills.length > 1 && (
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 rounded border border-amber-200">
                      <input
                        type="checkbox"
                        id="mergeSalesFees"
                        checked={mergeSameFees}
                        onChange={(e) => setMergeSameFees(e.target.checked)}
                        title="合并相同费用项"
                        className="w-3.5 h-3.5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <label htmlFor="mergeSalesFees" className="text-xs text-amber-800 cursor-pointer">
                        <span className="font-medium">合并相同费用项</span>
                        <span className="text-[10px] text-amber-600 ml-1">(如关税、包价一口价等)</span>
                      </label>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={confirmMultiBillSelection}
                      title="确认选择订单"
                      className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                    >
                      确认选择
                    </button>
                  </div>
                </div>
              )}
              
              {/* 订单列表 */}
              {showBillDropdown && bills.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {bills.map(bill => {
                    const isSelected = selectedBills.some(b => b.id === bill.id)
                    return (
                      <div
                        key={bill.id}
                        onClick={() => toggleBillSelection(bill)}
                        className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* 复选框 */}
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">{bill.billNumber}</span>
                                {bill.containerNumber && (
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                    柜号: {bill.containerNumber}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {/* 显示金额 - 根据发票类型显示应收或应付金额 */}
                                {formData.invoiceType === 'sales' && bill.receivableAmount !== undefined && bill.receivableAmount > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">
                                    应收: €{bill.receivableAmount.toFixed(2)}
                                  </span>
                                )}
                                {formData.invoiceType === 'purchase' && bill.payableAmount !== undefined && bill.payableAmount > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                    应付: €{bill.payableAmount.toFixed(2)}
                                  </span>
                                )}
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  {bill.deliveryStatus || bill.status || '已完成'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                              <span>客户: {bill.customerName || bill.consignee || '-'}</span>
                              {bill.portOfDischarge && <span>目的港: {bill.portOfDischarge}</span>}
                              {bill.eta && <span>ETA: {bill.eta}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {showBillDropdown && bills.length === 0 && billSearch && (
                <div className="border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                  未找到匹配的订单
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  {/* 多订单标题 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="w-5 h-5 text-primary-600" />
                    {selectedBills.length > 1 ? (
                      <>
                        <span className="text-base font-medium text-gray-900">已选择 {selectedBills.length} 个订单</span>
                        <div className="flex flex-wrap gap-1 ml-2">
                          {selectedBills.map(bill => (
                            <span key={bill.id} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {bill.containerNumber || bill.billNumber}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-base font-medium text-gray-900">{selectedBill.billNumber}</span>
                        {selectedBill.containerNumber && (
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                            柜号: {selectedBill.containerNumber}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          {selectedBill.deliveryStatus || selectedBill.status || '已完成'}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* 订单信息（单选时显示详情，多选时显示汇总） */}
                  {selectedBills.length <= 1 ? (
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">基本信息</div>
                        <div className="flex gap-1"><span className="text-gray-500">客户:</span><span className="text-gray-900">{selectedBill.customerName || selectedBill.consignee || '-'}</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">提单号:</span><span className="text-gray-900 font-medium">{selectedBill.billNumber || '-'}</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">集装箱号:</span><span className="text-gray-900 font-medium">{selectedBill.containerNumber || '-'}</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">货物信息</div>
                        <div className="flex gap-1"><span className="text-gray-500">件数:</span><span className="text-gray-900">{selectedBill.pieces || '-'} 件</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">毛重:</span><span className="text-gray-900">{selectedBill.weight || '-'} KG</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">体积:</span><span className="text-gray-900">{selectedBill.volume || '-'} CBM</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">集装箱运输</div>
                        <div className="flex gap-1"><span className="text-gray-500">目的港:</span><span className="text-gray-900">{selectedBill.portOfDischarge || '-'}</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">ATA:</span><span className="text-gray-900">{selectedBill.ata || '-'}</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">ETA:</span><span className="text-gray-900">{selectedBill.eta || '-'}</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">海外运输</div>
                        <div className="flex gap-1"><span className="text-gray-500">提货时间:</span><span className="text-gray-900">{selectedBill.cmrEstimatedPickupTime ? selectedBill.cmrEstimatedPickupTime.split('T')[0] : '-'}</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">送达时间:</span><span className="text-gray-900">{selectedBill.cmrConfirmedTime ? selectedBill.cmrConfirmedTime.split('T')[0] : '-'}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">汇总信息</div>
                        <div className="flex gap-1"><span className="text-gray-500">客户:</span><span className="text-gray-900">{selectedBills[0].customerName || selectedBills[0].consignee || '-'}</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">订单数:</span><span className="text-gray-900 font-medium">{selectedBills.length} 个</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">货物汇总</div>
                        <div className="flex gap-1"><span className="text-gray-500">总件数:</span><span className="text-gray-900">{selectedBills.reduce((sum, b) => sum + (b.pieces || 0), 0)} 件</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">总毛重:</span><span className="text-gray-900">{selectedBills.reduce((sum, b) => sum + (parseFloat(String(b.weight)) || 0), 0).toFixed(2)} KG</span></div>
                        <div className="flex gap-1"><span className="text-gray-500">总体积:</span><span className="text-gray-900">{selectedBills.reduce((sum, b) => sum + (parseFloat(String(b.volume)) || 0), 0).toFixed(2)} CBM</span></div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <div className="text-gray-400 font-medium border-b border-gray-200 pb-1 mb-1">集装箱列表</div>
                        <div className="flex flex-wrap gap-1">
                          {selectedBills.map(bill => (
                            <span key={bill.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                              {bill.containerNumber || bill.billNumber}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {billFees.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="w-3.5 h-3.5" />已加载 {billFees.length} 条费用记录
                    </div>
                  )}
                </div>
                <button onClick={clearBillSelection} title="更换订单" className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded transition-colors flex-shrink-0">更换订单</button>
              </div>
            </div>
          )}
        </div>
        </>
      ) : (
        // 采购发票：选择供应商
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              selectedSupplier ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              {selectedSupplier ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <h2 className="text-sm font-medium text-gray-900">选择供应商</h2>
            <span className="text-xs text-gray-500">（选择开具发票的供应商）</span>
          </div>

          {!selectedSupplier ? (
            <div className="relative" ref={supplierDropdownRef}>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value)
                    fetchSuppliers(e.target.value)
                    setShowSupplierDropdown(true)
                  }}
                  onFocus={() => {
                    fetchSuppliers(supplierSearch)
                    setShowSupplierDropdown(true)
                  }}
                  placeholder="搜索供应商名称、编码..."
                  title="搜索供应商"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              {showSupplierDropdown && suppliers.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {suppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      onClick={() => selectSupplier(supplier)}
                      className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium text-gray-900">{supplier.supplierName}</span>
                          {supplier.shortName && <span className="text-xs text-gray-500">({supplier.shortName})</span>}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        {supplier.supplierCode && <span>编码: {supplier.supplierCode}</span>}
                        {supplier.contactPerson && <span>联系人: {supplier.contactPerson}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showSupplierDropdown && suppliers.length === 0 && supplierSearch && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                  未找到匹配的供应商
                </div>
              )}
            </div>
          ) : (
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-orange-600" />
                  <div>
                    <div className="text-base font-medium text-gray-900">{selectedSupplier.supplierName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selectedSupplier.supplierCode && <span className="mr-3">编码: {selectedSupplier.supplierCode}</span>}
                      {selectedSupplier.contactPerson && <span>联系人: {selectedSupplier.contactPerson}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={clearSupplierSelection} title="更换供应商" className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded transition-colors">更换供应商</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 采购发票步骤3：上传对账单/发票 + 匹配费用 */}
      {formData.invoiceType === 'purchase' && selectedSupplier && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              formData.items.length > 0 ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              {formData.items.length > 0 ? <Check className="w-4 h-4" /> : '3'}
            </div>
            <h2 className="text-sm font-medium text-gray-900">上传对账单 & 匹配费用</h2>
            <span className="text-xs text-gray-500">（上传供应商对账单/发票，勾选需要核对的费用项）</span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* 左侧：上传对账单/发票 */}
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-orange-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  onChange={handleFileUpload}
                  title="选择文件上传"
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="点击上传对账单或发票文件"
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    点击上传对账单/发票
                  </button>
                  <p className="text-xs text-gray-500 mt-1">支持 PDF、JPG、PNG 格式</p>
                </div>
              </div>

              {/* 已上传文件列表 */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700">已上传文件：</div>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-700 truncate max-w-[150px]">{file.name}</span>
                        <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePreviewFile(file)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="预览"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(index)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 供应商发票信息 */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-700">供应商发票信息：</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">供应商发票号</label>
                    <input
                      type="text"
                      value={formData.supplierInvoiceNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, supplierInvoiceNumber: e.target.value }))}
                      placeholder="输入发票号"
                      title="供应商发票号"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">供应商发票日期</label>
                    <DatePicker
                      value={formData.supplierInvoiceDate}
                      onChange={(date) => setFormData(prev => ({ ...prev, supplierInvoiceDate: date }))}
                      placeholder="选择日期"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：系统费用匹配 */}
            <div className="border-l border-gray-200 pl-6">
              {/* 标题和操作栏 */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-medium text-gray-700">
                  该供应商的应付费用 
                  {loadingSupplierFees && <span className="text-gray-400 ml-2">加载中...</span>}
                  {supplierFees.length > 0 && <span className="text-gray-400 ml-1">({supplierFees.length}项)</span>}
                </div>
                {supplierFees.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    title={filteredSupplierFees.every(f => f.selected) ? '取消全选' : '全选费用项'}
                    className="text-xs text-orange-600 hover:text-orange-700"
                  >
                    {filteredSupplierFees.every(f => f.selected) ? '取消全选' : '全选'}
                  </button>
                )}
              </div>

              {/* 集装箱号搜索框 */}
              {supplierFees.length > 0 && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={feeSearchKeyword}
                      onChange={(e) => setFeeSearchKeyword(e.target.value)}
                      placeholder="搜索集装箱号，多个用空格分隔"
                      className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    {feeSearchKeyword && (
                      <button
                        type="button"
                        onClick={() => setFeeSearchKeyword('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {feeSearchKeyword && (
                    <p className="text-xs text-gray-500 mt-1">
                      找到 {filteredSupplierFees.length} 项费用
                    </p>
                  )}
                </div>
              )}

              {supplierFees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无该供应商的应付费用记录</p>
                  <p className="text-xs mt-1">请先在订单的费用管理中录入费用</p>
                </div>
              ) : filteredSupplierFees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">未找到匹配的费用</p>
                  <p className="text-xs mt-1">请检查搜索的集装箱号</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {Object.entries(groupedSupplierFees).map(([containerKey, fees]) => (
                    <div key={containerKey} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* 集装箱号分组标题 - 点击可选择整个集装箱 */}
                      <div 
                        className="bg-gray-50 px-3 py-2 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleContainerSelection(containerKey)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={fees.every(f => f.selected)}
                            onChange={() => {}}
                            title={fees.every(f => f.selected) ? '取消选择该集装箱所有费用' : '选择该集装箱所有费用'}
                            className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                          />
                          <span className="text-xs font-medium text-gray-700 flex-1">
                            📦 {containerKey}
                          </span>
                          <span className="text-xs text-gray-500">
                            {fees.filter(f => f.selected).length}/{fees.length}项
                          </span>
                        </div>
                      </div>
                      {/* 该集装箱下的费用列表 */}
                      <div className="divide-y divide-gray-100">
                        {fees.map(fee => (
                          <div
                            key={fee.id}
                            onClick={() => toggleFeeSelection(fee.id)}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                              fee.selected
                                ? 'bg-orange-50'
                                : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={fee.selected || false}
                              onChange={() => {}}
                              title="选择此费用项"
                              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-900">{fee.feeName || feeCategoryMap[fee.category] || '费用'}</span>
                              {fee.description && <p className="text-xs text-gray-500 truncate">{fee.description}</p>}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{Number(fee.amount).toFixed(2)}</div>
                              <div className="text-xs text-gray-500">{fee.currency}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 确认选择按钮 */}
              {supplierFees.some(f => f.selected) && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      已选择 {supplierFees.filter(f => f.selected).length} 项费用
                    </span>
                    <span className="text-sm font-medium text-orange-600">
                      合计: {supplierFees.filter(f => f.selected).reduce((sum, f) => sum + Number(f.amount), 0).toFixed(2)} {supplierFees.find(f => f.selected)?.currency || 'EUR'}
                    </span>
                  </div>
                  
                  {/* 合并相同费用项选项 */}
                      <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      id="mergeSameFees"
                      checked={mergeSameFees}
                      onChange={(e) => setMergeSameFees(e.target.checked)}
                      title="合并相同费用项"
                      className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <label htmlFor="mergeSameFees" className="text-xs text-amber-800 cursor-pointer flex-1">
                      <span className="font-medium">合并相同费用项</span>
                      <span className="block text-[10px] text-amber-600 mt-0.5">
                        将同名费用（如"关税"、"包价一口价"）合并为一行显示
                      </span>
                    </label>
                  </div>
                  
                  <button
                    type="button"
                    onClick={confirmSelectedFees}
                    title="确认选择并生成发票明细"
                    className="w-full py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    确认选择并生成发票明细
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 发票信息（销售发票选择订单后显示 / 采购发票确认费用后显示） */}
      {((formData.invoiceType === 'sales' && selectedBill) || (formData.invoiceType === 'purchase' && formData.items.length > 0)) && (
        <div className="grid grid-cols-3 gap-4">
          {/* 左侧：基本信息 */}
          <div className="col-span-2 space-y-4">
            {/* 发票基本信息 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  formData.invoiceType === 'sales' ? 'bg-primary-600' : 'bg-orange-500'
                } text-white`}>
                  {formData.invoiceType === 'sales' ? '3' : '4'}
                </div>
                <h2 className="text-sm font-medium text-gray-900">发票信息</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  formData.invoiceType === 'sales' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {formData.invoiceType === 'sales' ? '销售发票' : '采购发票'}
                </span>
              </div>
              
              {/* 表单布局 - 紧凑对齐设计 */}
              <div className="space-y-3">
                {/* 第一行：日期相关 */}
                <div className="grid grid-cols-3 gap-3">
                  {/* 发票日期 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      发票日期 <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      value={formData.invoiceDate}
                      onChange={handleInvoiceDateChange}
                      placeholder="选择日期"
                    />
                  </div>

                  {/* 账期天数 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      账期天数
                    </label>
                    <div className="flex items-center h-8">
                      <input
                        type="number"
                        value={paymentDays}
                        onChange={(e) => handlePaymentDaysChange(e.target.value ? parseInt(e.target.value) : '')}
                        min="0"
                        placeholder="输入"
                        title="账期天数"
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary-500 h-8"
                      />
                      <span className="px-2 py-1.5 text-xs bg-gray-100 border border-l-0 border-gray-200 rounded-r-md text-gray-500 h-8 flex items-center">天</span>
                    </div>
                  </div>

                  {/* 到期日期 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      到期日期
                    </label>
                    <div className={`px-2 py-1.5 text-xs rounded-md border h-8 flex items-center ${
                      formData.dueDate 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                      {formData.dueDate || '自动计算'}
                    </div>
                  </div>
                </div>

                {/* 第二行：客户、货币、汇率 */}
                <div className="grid grid-cols-3 gap-3">
                  {/* 客户/供应商 */}
                  <div className="relative" ref={customerDropdownRef}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {formData.invoiceType === 'sales' ? '客户' : '供应商'} <span className="text-red-500">*</span>
                      {(formData.billId || formData.supplierId) && (
                        <span className="ml-1 text-[10px] font-normal text-gray-400">(锁定)</span>
                      )}
                    </label>
                    <div className="relative">
                      {formData.invoiceType === 'sales' ? (
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <Building2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-500" />
                      )}
                      <input
                        type="text"
                        value={formData.invoiceType === 'sales' ? customerSearch : formData.supplierName}
                        onChange={(e) => {
                          if (formData.invoiceType === 'sales') {
                            if (formData.billId) return
                            setCustomerSearch(e.target.value)
                            setFormData(prev => ({ ...prev, customerName: e.target.value }))
                            fetchCustomers(e.target.value)
                            setShowCustomerDropdown(true)
                          }
                        }}
                        onFocus={() => {
                          if (formData.invoiceType === 'sales' && !formData.billId) {
                            setShowCustomerDropdown(true)
                          }
                        }}
                        disabled={formData.invoiceType === 'sales' ? !!formData.billId : true}
                        placeholder={formData.invoiceType === 'sales' && !formData.billId ? '搜索客户...' : ''}
                        title={formData.invoiceType === 'sales' ? customerSearch : formData.supplierName}
                        className={`w-full pl-7 pr-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 h-8 truncate ${
                          formData.invoiceType === 'sales' ? 'focus:ring-primary-500' : 'focus:ring-orange-500'
                        } ${(formData.billId || formData.supplierId) 
                          ? 'bg-gray-50 border-gray-200 text-gray-700 cursor-not-allowed' 
                          : 'border-gray-200'
                        }`}
                      />
                    </div>
                    {formData.invoiceType === 'sales' && !formData.billId && showCustomerDropdown && customers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {customers.map(customer => (
                          <button
                            type="button"
                            key={customer.id}
                            onClick={() => selectCustomer(customer)}
                            title={`选择客户: ${customer.companyName || customer.customerName}`}
                            className="w-full text-left px-2 py-1.5 hover:bg-gray-50 cursor-pointer"
                          >
                            <div className="text-xs text-gray-900">{customer.companyName || customer.customerName}</div>
                            {customer.customerCode && (
                              <div className="text-[10px] text-gray-500">{customer.customerCode}</div>
                            )}
                          </button>
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
                      onChange={(e) => {
                        const newCurrency = e.target.value
                        setFormData(prev => ({ ...prev, currency: newCurrency }))
                        fetchExchangeRate(newCurrency)
                      }}
                      title="选择货币"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white h-8"
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
                    {formData.currency === 'CNY' ? (
                      <div className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md text-gray-500 h-8 flex items-center">
                        无需换算
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-600 whitespace-nowrap">1 {formData.currency} =</span>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={formData.exchangeRate || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value)
                            if (!isNaN(value) && value > 0) {
                              setFormData(prev => ({ ...prev, exchangeRate: value }))
                            } else if (e.target.value === '') {
                              setFormData(prev => ({ ...prev, exchangeRate: 0 }))
                            }
                          }}
                          className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 text-center h-7"
                          title="手动输入汇率"
                        />
                        <span className="text-xs text-gray-600">CNY</span>
                        <button
                          type="button"
                          onClick={() => fetchExchangeRate(formData.currency)}
                          title="刷新获取最新汇率"
                          className="p-1 hover:bg-blue-50 rounded text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 第三行：发票语言选择 */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {/* 发票语言 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      费用品名语言
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as 'en' | 'zh' }))}
                      title="选择发票费用品名显示语言"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white h-8"
                    >
                      <option value="en">英文 (English)</option>
                      <option value="zh">中文 (Chinese)</option>
                    </select>
                    <p className="mt-1 text-[10px] text-gray-400">影响PDF发票中费用品名的显示语言</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 发票明细 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    formData.invoiceType === 'sales' ? 'bg-primary-600' : 'bg-orange-500'
                  } text-white`}>
                    {formData.invoiceType === 'sales' ? '4' : '5'}
                  </div>
                  <h2 className="text-sm font-medium text-gray-900">发票明细</h2>
                  {loadingFees && (
                    <span className="text-xs text-gray-500">正在加载费用...</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addItem}
                    title="添加发票项目"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加项目
                  </button>
                </div>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">该订单暂无费用记录</p>
                  <button
                    type="button"
                    onClick={addItem}
                    title="手动添加发票项"
                    className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                  >
                    手动添加发票项
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] lg:text-xs xl:text-sm table-fixed" style={{minWidth: '850px'}}>
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th style={{width: '24px'}} className="text-left py-2 px-1.5 font-medium text-gray-600">#</th>
                        <th style={{width: '100px'}} className="text-left py-2 px-1.5 font-medium text-gray-600">描述</th>
                        <th style={{width: '50px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">数量</th>
                        <th style={{width: '70px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">单价</th>
                        <th style={{width: '55px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">货币</th>
                        <th style={{width: '55px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">税率</th>
                        <th style={{width: '85px'}} className="text-right py-2 px-1.5 font-medium text-gray-600">金额</th>
                        <th style={{width: '70px'}} className="text-right py-2 px-1.5 font-medium text-gray-600">税额</th>
                        <th style={{width: '55px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">优惠%</th>
                        <th style={{width: '65px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">优惠额</th>
                        <th style={{width: '90px'}} className="text-right py-2 px-1.5 font-medium text-gray-600">最终金额</th>
                        <th style={{width: '32px'}} className="text-center py-2 px-1.5 font-medium text-gray-600">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={item.id} className={`border-b border-gray-100 ${item.isFromOrder ? 'bg-gray-50' : ''}`}>
                          <td className="py-1.5 px-1.5 text-gray-500">{index + 1}</td>
                          <td className="py-1.5 px-1.5" style={{width: '100px'}}>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                              placeholder="描述..."
                              disabled={item.isFromOrder}
                              title={item.description}
                              className={`w-full px-1.5 py-1 text-[11px] lg:text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 truncate ${item.isFromOrder ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="1"
                              title="数量"
                              className="w-full px-1 py-1 text-[11px] lg:text-xs text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            {item.unitPrice === -1 ? (
                              // 单价不一致时显示"多项"
                              <div className="w-full px-1 py-1 text-[11px] lg:text-xs text-center bg-amber-50 border border-amber-200 rounded text-amber-700">
                                多项
                              </div>
                            ) : (
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                min="0"
                                step="0.01"
                                disabled={item.isFromOrder}
                                title="单价"
                                className={`w-full px-1 py-1 text-[11px] lg:text-xs text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 ${item.isFromOrder ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-1.5">
                            <select
                              value={item.currency}
                              onChange={(e) => updateItem(item.id, 'currency', e.target.value)}
                              disabled={item.isFromOrder}
                              title="货币"
                              className={`w-full px-0.5 py-1 text-[11px] lg:text-xs text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 ${item.isFromOrder ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'}`}
                            >
                              {currencies.map(c => (
                                <option key={c.value} value={c.value}>{c.value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-1.5">
                            <select
                              value={item.taxRate}
                              onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value))}
                              title="税率"
                              className="w-full px-0.5 py-1 text-[11px] lg:text-xs text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                            >
                              {taxRates.map(rate => (
                                <option key={rate.value} value={rate.value}>{rate.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-1.5 text-right text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-1.5 px-1.5 text-right text-gray-600 whitespace-nowrap">
                            {formatCurrency(item.taxAmount)}
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="number"
                              value={item.discountPercent}
                              onChange={(e) => updateItem(item.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              placeholder="0"
                              title="优惠百分比"
                              className="w-full px-1 py-1 text-[11px] lg:text-xs text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="py-1.5 px-1.5">
                            <input
                              type="number"
                              value={item.discountAmount}
                              onChange={(e) => updateItem(item.id, 'discountAmount', parseFloat(e.target.value) || 0)}
                              step="0.01"
                              placeholder="0"
                              title="优惠金额"
                              className="w-full px-1 py-1 text-[11px] lg:text-xs text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="py-1.5 px-1.5 text-right font-medium text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.finalAmount ?? (item.amount + item.taxAmount))}
                          </td>
                          <td className="py-1.5 px-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              disabled={formData.items.length <= 1 || item.isFromOrder}
                              className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={item.isFromOrder ? '订单数据不可删除' : '删除'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* 合计行 */}
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium text-[11px] lg:text-xs">
                        <td colSpan={6} className="py-2 px-1.5 text-right text-gray-700">
                          合计
                        </td>
                        <td className="py-2 px-1.5 text-right text-gray-900 font-semibold whitespace-nowrap">
                          {formatCurrency(formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
                        </td>
                        <td className="py-2 px-1.5 text-right text-gray-900 font-semibold whitespace-nowrap">
                          {formatCurrency(formData.items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0))}
                        </td>
                        <td className="py-2 px-1.5 text-center text-gray-500">-</td>
                        <td className="py-2 px-1.5 text-right text-orange-600 font-semibold whitespace-nowrap">
                          {formatCurrency(formData.items.reduce((sum, item) => {
                            const discountPercent = Number(item.discountPercent) || 0
                            const discountAmount = Number(item.discountAmount) || 0
                            const subtotal = (Number(item.amount) || 0) + (Number(item.taxAmount) || 0)
                            return sum + (subtotal * discountPercent / 100) + discountAmount
                          }, 0))}
                        </td>
                        <td className="py-2 px-1.5 text-right text-primary-700 font-bold whitespace-nowrap">
                          {formatCurrency(formData.items.reduce((sum, item) => sum + (item.finalAmount !== undefined ? Number(item.finalAmount) : (Number(item.amount) || 0) + (Number(item.taxAmount) || 0)), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
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
                    title="发票说明"
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
                    title="内部备注"
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
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">折扣/调整</span>
                    <span className="text-sm font-medium text-orange-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
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
                    {formData.status === 'draft' ? '草稿' : (formData.invoiceType === 'sales' ? '待收款' : '待付款')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">发票日期</span>
                  <span className="font-medium text-gray-900">{formData.invoiceDate}</span>
                </div>
                {paymentDays && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">账期</span>
                    <span className="font-medium text-gray-900">{paymentDays} 天</span>
                  </div>
                )}
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
                <div className="flex justify-between">
                  <span className="text-gray-500">关联订单</span>
                  <span className="font-medium text-gray-900 truncate max-w-[120px]">
                    {formData.billNumber}
                  </span>
                </div>
                {selectedBill?.containerNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">提单号</span>
                    <span className="font-medium text-gray-900 truncate max-w-[120px]" title={selectedBill.containerNumber}>
                      {selectedBill.containerNumber}
                    </span>
                  </div>
                )}
                {selectedBill?.containerNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">集装箱号</span>
                    <span className="font-medium text-gray-900 truncate max-w-[120px]" title={selectedBill.containerNumber}>
                      {selectedBill.containerNumber}
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
                  <p>• 费用数据从订单自动加载</p>
                  <p>• 可手动调整金额和添加项目</p>
                  <p>• 销售发票会计入应收款</p>
                  <p>• 采购发票会计入应付款</p>
                </div>
              </div>
            </div>

            {/* 保存按钮 */}
            <button
              onClick={handleSubmit}
              disabled={loading || (formData.invoiceType === 'sales' ? !selectedBill : formData.items.length === 0)}
              title={isEditMode ? '更新发票' : '保存发票'}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                formData.invoiceType === 'sales'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 border-2 border-blue-600'
                  : 'bg-orange-600 text-white hover:bg-orange-700 border-2 border-orange-600'
              }`}
            >
              <Save className="w-4 h-4" />
              {loading ? '保存中...' : (isEditMode ? '更新发票' : '保存发票')}
            </button>
          </div>
        </div>
      )}

      {/* 文件预览模态框 */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <button
              onClick={() => {
                URL.revokeObjectURL(previewFile)
                setPreviewFile(null)
              }}
              title="关闭预览"
              className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewFile} alt="预览" className="max-w-full max-h-[90vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
