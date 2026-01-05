import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Receipt, FileText, Loader2, ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface Fee {
  id: string
  feeName: string
  category: string
  feeType: 'receivable' | 'payable'
  amount: number
  currency: string
  feeDate: string
  customerName?: string
  supplierName?: string
}

interface OrderFeePanelProps {
  billId: string
  billNumber: string
  customerId?: string
  customerName?: string
  onAddFee: (feeType: 'receivable' | 'payable') => void
  disabled?: boolean
  disabledMessage?: string
}

const CATEGORY_LABELS: Record<string, { label: string; bgClass: string; textClass: string }> = {
  freight: { label: '运费', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  customs: { label: '关税', bgClass: 'bg-red-100', textClass: 'text-red-700' },
  warehouse: { label: '仓储', bgClass: 'bg-orange-100', textClass: 'text-orange-700' },
  insurance: { label: '保险', bgClass: 'bg-green-100', textClass: 'text-green-700' },
  handling: { label: '操作', bgClass: 'bg-purple-100', textClass: 'text-purple-700' },
  documentation: { label: '文件', bgClass: 'bg-cyan-100', textClass: 'text-cyan-700' },
  other: { label: '其他', bgClass: 'bg-gray-100', textClass: 'text-gray-700' }
}

export default function OrderFeePanel({
  billId,
  billNumber,
  customerId,
  customerName,
  onAddFee,
  disabled = false,
  disabledMessage = ''
}: OrderFeePanelProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable')
  const [fees, setFees] = useState<Fee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (billId) {
      loadFees()
    }
  }, [billId])

  const loadFees = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/fees?billId=${billId}&pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.list) {
        setFees(data.data.list)
      }
    } catch (error) {
      console.error('加载费用列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 按类型筛选费用
  const receivableFees = fees.filter(f => f.feeType === 'receivable' || !f.feeType)
  const payableFees = fees.filter(f => f.feeType === 'payable')

  const currentFees = activeTab === 'receivable' ? receivableFees : payableFees

  // 计算汇总
  const receivableTotal = receivableFees.reduce((sum, f) => sum + (f.amount || 0), 0)
  const payableTotal = payableFees.reduce((sum, f) => sum + (f.amount || 0), 0)
  const currentTotal = activeTab === 'receivable' ? receivableTotal : payableTotal

  const getCategoryDisplay = (category: string) => {
    const cat = CATEGORY_LABELS[category] || CATEGORY_LABELS.other
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${cat.bgClass} ${cat.textClass}`}>
        {cat.label}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      {/* Tab切换 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('receivable')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'receivable'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          应收费用
          {receivableFees.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
              {receivableFees.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('payable')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'payable'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          应付费用
          {payableFees.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
              {payableFees.length}
            </span>
          )}
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* 禁用提示 */}
        {disabled && disabledMessage && (
          <div className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200">
            <Lock className="w-3 h-3" />
            <span>{disabledMessage}</span>
          </div>
        )}
        <button
          onClick={() => onAddFee(activeTab)}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs rounded flex items-center gap-1 ${
            disabled 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : activeTab === 'receivable'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
          }`}
          title={disabled ? disabledMessage : ''}
        >
          {disabled ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          录入{activeTab === 'receivable' ? '应收' : '应付'}费用
        </button>
        <button
          onClick={() => navigate(`/finance/fees?billId=${billId}&feeType=${activeTab}`)}
          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
        >
          <Receipt className="w-3.5 h-3.5" />
          查看全部费用
        </button>
        <button
          onClick={() => navigate('/finance/invoices')}
          className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5" />
          发票管理
        </button>
      </div>

      {/* 费用汇总 */}
      {currentFees.length > 0 && (
        <div className={`rounded-lg p-3 border ${
          activeTab === 'receivable'
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-100'
            : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${
              activeTab === 'receivable' ? 'text-green-800' : 'text-orange-800'
            }`}>
              {activeTab === 'receivable' ? '应收' : '应付'}费用汇总
            </span>
            <span className={`text-sm font-bold ${
              activeTab === 'receivable' ? 'text-green-600' : 'text-orange-600'
            }`}>
              €{currentTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`text-xs ${
            activeTab === 'receivable' ? 'text-green-600' : 'text-orange-600'
          }`}>
            共 {currentFees.length} 笔费用
          </div>
        </div>
      )}

      {/* 毛利预览 */}
      {receivableFees.length > 0 && payableFees.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">预估毛利</span>
            <span className={`text-sm font-bold ${
              receivableTotal - payableTotal >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              €{(receivableTotal - payableTotal).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>应收: €{receivableTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
            <span>应付: €{payableTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* 费用列表 */}
      {loading ? (
        <div className="text-center py-4 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
          加载费用中...
        </div>
      ) : currentFees.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">费用名称</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">类别</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">
                  {activeTab === 'receivable' ? '客户' : '供应商'}
                </th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">金额</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">日期</th>
              </tr>
            </thead>
            <tbody>
              {currentFees.slice(0, 5).map((fee) => (
                <tr key={fee.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900">{fee.feeName}</td>
                  <td className="px-3 py-2">
                    {getCategoryDisplay(fee.category)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {activeTab === 'receivable' 
                      ? (fee.customerName || customerName || '-')
                      : (fee.supplierName || '-')
                    }
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    {fee.currency || '€'}{fee.amount?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {fee.feeDate ? formatDate(fee.feeDate) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {currentFees.length > 5 && (
            <div className="bg-gray-50 px-3 py-2 text-center">
              <button
                onClick={() => navigate(`/finance/fees?billId=${billId}&feeType=${activeTab}`)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                查看全部 {currentFees.length} 笔费用 →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg">
          暂无{activeTab === 'receivable' ? '应收' : '应付'}费用记录，点击上方按钮添加
        </div>
      )}
    </div>
  )
}
