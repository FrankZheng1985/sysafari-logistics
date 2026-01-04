import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ArrowLeft, CreditCard, DollarSign, 
  FileText, CheckCircle, AlertCircle, Building2,
  Upload, X, Image, Eye, Loader2
} from 'lucide-react'
import DateTimePicker from '../components/DateTimePicker'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceType: 'sales' | 'purchase'
  customerName: string
  totalAmount: number
  paidAmount: number
  currency: string
  status: string
}

interface BankAccount {
  id: number
  accountName: string
  accountNumber: string
  bankName: string
  currency: string
  isDefault: boolean
  isActive: boolean
}

// 收款方式选项
const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'cash', label: '现金' },
  { value: 'check', label: '支票' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'other', label: '其他' }
]

export default function RegisterPayment() {
  const { id: invoiceId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'bank_transfer',
    bankAccountId: '',
    reference: '',
    notes: ''
  })
  
  // 付款单上传相关
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = invoiceId || searchParams.get('invoiceId')
    if (id) {
      loadInvoice(id)
    } else {
      setError('未指定发票')
      setLoading(false)
    }
    loadBankAccounts()
  }, [invoiceId, searchParams])

  const loadBankAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bank-accounts?isActive=true`)
      const data = await res.json()
      if (data.errCode === 200) {
        setBankAccounts(data.data || [])
        const defaultAccount = data.data?.find((a: BankAccount) => a.isDefault)
        if (defaultAccount) {
          setFormData(prev => ({ ...prev, bankAccountId: String(defaultAccount.id) }))
        }
      }
    } catch (error) {
      console.error('加载银行账户失败:', error)
    }
  }

  const loadInvoice = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/invoices/${id}`)
      if (!response.ok) throw new Error('加载发票失败')
      const result = await response.json()
      if (result.errCode !== 200 || !result.data) {
        throw new Error(result.msg || '加载发票失败')
      }
      const data = result.data
      setInvoice(data)
      const unpaidAmount = Number(data.totalAmount) - Number(data.paidAmount)
      setFormData(prev => ({
        ...prev,
        amount: unpaidAmount.toFixed(2)
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载发票失败')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '¥'
    return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // 处理付款单文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('请上传 PDF 或图片文件（JPG、PNG、GIF、WebP）')
      return
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过 10MB')
      return
    }

    setReceiptFile(file)
    setError('')

    // 如果是图片，生成预览
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }
  }

  // 移除已选择的文件
  const handleRemoveFile = () => {
    setReceiptFile(null)
    setReceiptPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 上传付款凭证
  const uploadReceipt = async (paymentId: string) => {
    if (!receiptFile) return true

    setUploadingReceipt(true)
    try {
      const formData = new FormData()
      formData.append('file', receiptFile)

      const response = await fetch(`${API_BASE}/api/payments/${paymentId}/receipt`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.errCode !== 200) {
        console.error('上传付款凭证失败:', data.msg)
        return false
      }
      return true
    } catch (err) {
      console.error('上传付款凭证失败:', err)
      return false
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('请输入有效的收款金额')
      return
    }

    const unpaidAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount)
    if (amount > unpaidAmount) {
      setError(`收款金额不能超过待收金额 ${formatCurrency(unpaidAmount, invoice.currency)}`)
      return
    }

    if (formData.method === 'bank_transfer' && !formData.bankAccountId) {
      setError('请选择收款银行账户')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const selectedBank = bankAccounts.find(a => String(a.id) === formData.bankAccountId)
      
      const response = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          paymentType: invoice.invoiceType === 'sales' ? 'income' : 'expense',
          paymentDate: formData.paymentDate,
          amount: amount,
          currency: invoice.currency,
          paymentMethod: formData.method,
          bankAccount: selectedBank ? `${selectedBank.accountName} (${selectedBank.bankName})` : '',
          referenceNumber: formData.reference,
          notes: formData.notes,
          status: 'completed'
        })
      })

      const data = await response.json()
      
      if (data.errCode !== 200) {
        throw new Error(data.msg || '登记收款失败')
      }

      // 如果有付款凭证，上传
      if (receiptFile && data.data?.id) {
        await uploadReceipt(data.data.id)
      }

      navigate(`/finance/invoices/${invoice.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登记收款失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || '发票不存在'}
        </div>
      </div>
    )
  }

  const unpaidAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount)
  const paymentProgress = (Number(invoice.paidAmount) / Number(invoice.totalAmount)) * 100

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="返回"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">登记收款</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            为发票 {invoice.invoiceNumber} 登记收款
          </p>
        </div>
      </div>

      {/* 发票信息卡片 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          发票信息
        </h2>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">发票号码：</span>
            <span className="text-gray-900 font-medium">{invoice.invoiceNumber}</span>
          </div>
          <div>
            <span className="text-gray-500">发票类型：</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              invoice.invoiceType === 'sales' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {invoice.invoiceType === 'sales' ? '销售发票' : '采购发票'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">{invoice.invoiceType === 'sales' ? '客户' : '供应商'}：</span>
            <span className="text-gray-900">{invoice.customerName}</span>
          </div>
          <div>
            <span className="text-gray-500">货币：</span>
            <span className="text-gray-900">{invoice.currency}</span>
          </div>
        </div>

        {/* 金额信息 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">总金额</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatCurrency(Number(invoice.totalAmount), invoice.currency)}
              </div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">已收金额</div>
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(Number(invoice.paidAmount), invoice.currency)}
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">待收金额</div>
              <div className="text-lg font-semibold text-orange-600">
                {formatCurrency(unpaidAmount, invoice.currency)}
              </div>
            </div>
          </div>
          
          {/* 进度条 */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>收款进度</span>
              <span>{paymentProgress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(paymentProgress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 收款表单 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" />
          收款信息
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* 收款日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                收款日期 <span className="text-red-500">*</span>
              </span>
            </label>
            <DateTimePicker
              value={formData.paymentDate}
              onChange={(value) => setFormData(prev => ({ ...prev, paymentDate: value }))}
              showTime={false}
              placeholder="选择收款日期"
            />
          </div>

          {/* 收款金额 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                收款金额 ({invoice.currency}) <span className="text-red-500">*</span>
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={unpaidAmount}
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="请输入收款金额"
                required
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, amount: unpaidAmount.toFixed(2) }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 bg-primary-50 rounded"
              >
                全额收款
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              待收金额：{formatCurrency(unpaidAmount, invoice.currency)}
            </p>
          </div>

          {/* 收款方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              收款方式 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>

          {/* 收款银行账户 */}
          {formData.method === 'bank_transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  收款银行账户 <span className="text-red-500">*</span>
                </span>
              </label>
              <select
                value={formData.bankAccountId}
                onChange={(e) => setFormData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required={formData.method === 'bank_transfer'}
              >
                <option value="">请选择收款账户</option>
                {bankAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.accountName} - {account.bankName} ({account.currency})
                    {account.isDefault ? ' ⭐默认' : ''}
                  </option>
                ))}
              </select>
              {bankAccounts.length === 0 && (
                <p className="mt-1 text-xs text-orange-600">
                  暂无银行账户，请先在财务管理-银行账户中添加
                </p>
              )}
            </div>
          )}

          {/* 交易参考号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              交易参考号
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="银行流水号、支票号等"
            />
          </div>

          {/* 付款凭证上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              付款凭证
              <span className="text-xs text-gray-400 ml-2">（PDF 或图片，最大 10MB）</span>
            </label>
            
            {!receiptFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">点击上传付款凭证</p>
                <p className="text-xs text-gray-400 mt-1">支持 PDF、JPG、PNG、GIF、WebP 格式</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {/* 预览区域 */}
                  {receiptPreview ? (
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200">
                      <img 
                        src={receiptPreview} 
                        alt="预览" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 flex-shrink-0 bg-red-50 rounded-lg flex items-center justify-center">
                      <FileText className="w-8 h-8 text-red-400" />
                    </div>
                  )}
                  
                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {receiptFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(receiptFile.size / 1024).toFixed(1)} KB
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {receiptPreview && (
                        <button
                          type="button"
                          onClick={() => window.open(receiptPreview, '_blank')}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          预览
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        移除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="收款相关说明..."
            />
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || uploadingReceipt}
            className="flex items-center gap-2 px-6 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting || uploadingReceipt ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadingReceipt ? '上传凭证中...' : '处理中...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                确认收款
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
