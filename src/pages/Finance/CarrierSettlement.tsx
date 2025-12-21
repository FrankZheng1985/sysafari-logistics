import { useState, useEffect } from 'react'
import { 
  Plus, Search, Eye, FileText, Check, X, RefreshCw, 
  Download, Upload, AlertCircle, DollarSign, Truck,
  Calendar, ChevronDown, Filter, CheckCircle, Clock
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { getApiBaseUrl } from '../../utils/api'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface Settlement {
  id: number
  settlementNo: string
  carrierId: number
  carrierName: string
  carrierCode: string
  periodStart: string
  periodEnd: string
  totalShipments: number
  totalWeight: number
  carrierBillAmount: number
  systemCalcAmount: number
  differenceAmount: number
  currency: string
  reconcileStatus: 'pending' | 'confirmed' | 'disputed'
  reconciledAt: string | null
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  paidAmount: number
  paidAt: string | null
  createdAt: string
}

interface SettlementItem {
  id: number
  trackingNo: string
  shipDate: string
  carrierWeight: number
  carrierAmount: number
  systemWeight: number
  systemAmount: number
  weightDiff: number
  amountDiff: number
  status: 'pending' | 'matched' | 'disputed' | 'unmatched'
  shipmentNo?: string
  receiverName?: string
  receiverCity?: string
}

interface Carrier {
  id: number
  carrierCode: string
  carrierName: string
}

interface SettlementStats {
  totalSettlements: number
  totalShipments: number
  totalCarrierAmount: number
  totalSystemAmount: number
  totalDifference: number
  totalPaid: number
  totalUnpaid: number
}

// ==================== 常量定义 ====================

const RECONCILE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '待核对', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: '已确认', color: 'bg-green-100 text-green-700' },
  disputed: { label: '有争议', color: 'bg-red-100 text-red-700' }
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid: { label: '未付款', color: 'bg-gray-100 text-gray-700' },
  partial: { label: '部分付款', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已付款', color: 'bg-green-100 text-green-700' }
}

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '待核对', color: 'bg-gray-100 text-gray-700' },
  matched: { label: '已匹配', color: 'bg-green-100 text-green-700' },
  disputed: { label: '有差异', color: 'bg-red-100 text-red-700' },
  unmatched: { label: '未匹配', color: 'bg-yellow-100 text-yellow-700' }
}

// ==================== 主组件 ====================

export default function CarrierSettlement() {
  // 列表状态
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  // 统计数据
  const [stats, setStats] = useState<SettlementStats | null>(null)
  
  // 筛选条件
  const [filterCarrierId, setFilterCarrierId] = useState<number>(0)
  const [filterReconcileStatus, setFilterReconcileStatus] = useState('')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('')
  
  // 承运商列表
  const [carriers, setCarriers] = useState<Carrier[]>([])
  
  // 弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([])
  
  // 创建结算单表单
  const [createForm, setCreateForm] = useState({
    carrierId: 0,
    periodStart: '',
    periodEnd: ''
  })
  
  // 操作状态
  const [submitting, setSubmitting] = useState(false)

  // 获取承运商列表
  const fetchCarriers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers?status=active&pageSize=100`)
      const data = await res.json()
      if (data.errCode === 200) {
        setCarriers(data.data.list)
      }
    } catch (error) {
      console.error('获取承运商列表失败:', error)
    }
  }

  // 获取结算单列表
  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (filterCarrierId) params.append('carrierId', String(filterCarrierId))
      if (filterReconcileStatus) params.append('reconcileStatus', filterReconcileStatus)
      if (filterPaymentStatus) params.append('paymentStatus', filterPaymentStatus)
      
      const res = await fetch(`${API_BASE}/api/finance/carrier-settlements?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setSettlements(data.data.list)
        setTotal(data.data.total)
      }
    } catch (error) {
      console.error('获取结算单列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/finance/carrier-settlements/stats`)
      const data = await res.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  useEffect(() => {
    fetchCarriers()
    fetchStats()
  }, [])

  useEffect(() => {
    fetchSettlements()
  }, [page, filterCarrierId, filterReconcileStatus, filterPaymentStatus])

  // 创建结算单
  const handleCreate = async () => {
    if (!createForm.carrierId || !createForm.periodStart || !createForm.periodEnd) {
      alert('请填写完整信息')
      return
    }
    
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/finance/carrier-settlements/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        alert(`结算单创建成功！编号: ${data.data.settlementNo}`)
        setShowCreateModal(false)
        setCreateForm({ carrierId: 0, periodStart: '', periodEnd: '' })
        fetchSettlements()
        fetchStats()
      } else {
        alert(data.msg || '创建失败')
      }
    } catch (error) {
      console.error('创建结算单失败:', error)
      alert('创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 查看详情
  const handleViewDetail = async (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setShowDetailModal(true)
    
    try {
      const res = await fetch(`${API_BASE}/api/finance/carrier-settlements/${settlement.id}/items`)
      const data = await res.json()
      if (data.errCode === 200) {
        setSettlementItems(data.data)
      }
    } catch (error) {
      console.error('获取结算明细失败:', error)
    }
  }

  // 确认结算
  const handleConfirm = async (id: number) => {
    if (!confirm('确认核对无误？')) return
    
    try {
      const res = await fetch(`${API_BASE}/api/finance/carrier-settlements/${id}/confirm`, {
        method: 'POST'
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        alert('结算已确认')
        fetchSettlements()
        fetchStats()
      } else {
        alert(data.msg || '确认失败')
      }
    } catch (error) {
      console.error('确认结算失败:', error)
      alert('确认失败，请重试')
    }
  }

  // 标记付款
  const handlePay = async (id: number) => {
    if (!confirm('确认标记为已付款？')) return
    
    try {
      const res = await fetch(`${API_BASE}/api/finance/carrier-settlements/${id}/pay`, {
        method: 'POST'
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        alert('已标记为已付款')
        fetchSettlements()
        fetchStats()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('标记付款失败:', error)
      alert('操作失败，请重试')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="承运商结算"
        description="管理最后里程承运商的账单核对与结算"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建结算单
          </button>
        }
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">结算单数</div>
                <div className="text-xl font-bold text-gray-900">{stats.totalSettlements}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">承运商账单总额</div>
                <div className="text-xl font-bold text-gray-900">€{stats.totalCarrierAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">差异金额</div>
                <div className={`text-xl font-bold ${stats.totalDifference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  €{Math.abs(stats.totalDifference).toFixed(2)}
                  <span className="text-sm ml-1">{stats.totalDifference >= 0 ? '↑' : '↓'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">待付款</div>
                <div className="text-xl font-bold text-gray-900">€{stats.totalUnpaid.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">筛选：</span>
          </div>
          
          <select
            value={filterCarrierId}
            onChange={(e) => setFilterCarrierId(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value={0}>全部承运商</option>
            {carriers.map(c => (
              <option key={c.id} value={c.id}>{c.carrierName}</option>
            ))}
          </select>
          
          <select
            value={filterReconcileStatus}
            onChange={(e) => setFilterReconcileStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">全部核对状态</option>
            <option value="pending">待核对</option>
            <option value="confirmed">已确认</option>
            <option value="disputed">有争议</option>
          </select>
          
          <select
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">全部付款状态</option>
            <option value="unpaid">未付款</option>
            <option value="paid">已付款</option>
          </select>
          
          <button
            onClick={() => {
              setFilterCarrierId(0)
              setFilterReconcileStatus('')
              setFilterPaymentStatus('')
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            重置
          </button>
        </div>
      </div>

      {/* 结算单列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">结算单号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">承运商</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">结算周期</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">运单数</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">承运商账单</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">系统计算</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">差异</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">核对状态</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">付款状态</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    暂无结算单
                  </td>
                </tr>
              ) : (
                settlements.map(settlement => (
                  <tr key={settlement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-blue-600">{settlement.settlementNo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        {settlement.carrierName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {settlement.periodStart} ~ {settlement.periodEnd}
                    </td>
                    <td className="px-4 py-3 text-right">{settlement.totalShipments}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      €{settlement.carrierBillAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      €{settlement.systemCalcAmount.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${
                      settlement.differenceAmount > 0 ? 'text-red-600' : 
                      settlement.differenceAmount < 0 ? 'text-green-600' : ''
                    }`}>
                      {settlement.differenceAmount >= 0 ? '+' : ''}€{settlement.differenceAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        RECONCILE_STATUS_CONFIG[settlement.reconcileStatus]?.color || 'bg-gray-100'
                      }`}>
                        {RECONCILE_STATUS_CONFIG[settlement.reconcileStatus]?.label || settlement.reconcileStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        PAYMENT_STATUS_CONFIG[settlement.paymentStatus]?.color || 'bg-gray-100'
                      }`}>
                        {PAYMENT_STATUS_CONFIG[settlement.paymentStatus]?.label || settlement.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetail(settlement)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {settlement.reconcileStatus === 'pending' && (
                          <button
                            onClick={() => handleConfirm(settlement.id)}
                            className="p-1 hover:bg-green-100 rounded"
                            title="确认核对"
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        {settlement.reconcileStatus === 'confirmed' && settlement.paymentStatus === 'unpaid' && (
                          <button
                            onClick={() => handlePay(settlement.id)}
                            className="p-1 hover:bg-blue-100 rounded"
                            title="标记已付款"
                          >
                            <DollarSign className="w-4 h-4 text-blue-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* 分页 */}
        {total > pageSize && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              共 {total} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                第 {page} / {Math.ceil(total / pageSize)} 页
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 创建结算单弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium text-gray-900">创建结算单</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  承运商 <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.carrierId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, carrierId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={0}>请选择承运商</option>
                  {carriers.map(c => (
                    <option key={c.id} value={c.id}>{c.carrierName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结算周期开始 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.periodStart}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, periodStart: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结算周期结束 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.periodEnd}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, periodEnd: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 结算单详情弹窗 */}
      {showDetailModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">结算单详情</h3>
                <p className="text-sm text-gray-500">{selectedSettlement.settlementNo}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            {/* 结算单摘要 */}
            <div className="p-4 bg-gray-50 grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">承运商：</span>
                <span className="font-medium ml-1">{selectedSettlement.carrierName}</span>
              </div>
              <div>
                <span className="text-gray-500">结算周期：</span>
                <span className="font-medium ml-1">{selectedSettlement.periodStart} ~ {selectedSettlement.periodEnd}</span>
              </div>
              <div>
                <span className="text-gray-500">运单数：</span>
                <span className="font-medium ml-1">{selectedSettlement.totalShipments}</span>
              </div>
              <div>
                <span className="text-gray-500">差异金额：</span>
                <span className={`font-medium ml-1 ${
                  selectedSettlement.differenceAmount > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  €{selectedSettlement.differenceAmount.toFixed(2)}
                </span>
              </div>
            </div>
            
            {/* 明细列表 */}
            <div className="overflow-auto max-h-[50vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">运单号</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">发货日期</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">承运商重量</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">系统重量</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">承运商金额</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">系统金额</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">差异</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {settlementItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        暂无明细数据
                      </td>
                    </tr>
                  ) : (
                    settlementItems.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono">{item.trackingNo}</td>
                        <td className="px-4 py-2">{item.shipDate || '-'}</td>
                        <td className="px-4 py-2 text-right">{item.carrierWeight.toFixed(2)} kg</td>
                        <td className="px-4 py-2 text-right">{item.systemWeight.toFixed(2)} kg</td>
                        <td className="px-4 py-2 text-right font-mono">€{item.carrierAmount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-mono">€{item.systemAmount.toFixed(2)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${
                          item.amountDiff > 0 ? 'text-red-600' : 
                          item.amountDiff < 0 ? 'text-green-600' : ''
                        }`}>
                          {item.amountDiff >= 0 ? '+' : ''}€{item.amountDiff.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${
                            ITEM_STATUS_CONFIG[item.status]?.color || 'bg-gray-100'
                          }`}>
                            {ITEM_STATUS_CONFIG[item.status]?.label || item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
              {selectedSettlement.reconcileStatus === 'pending' && (
                <button
                  onClick={() => {
                    handleConfirm(selectedSettlement.id)
                    setShowDetailModal(false)
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  确认核对
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
