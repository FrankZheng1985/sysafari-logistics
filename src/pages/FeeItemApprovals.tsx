/**
 * 费用项审批管理页面
 * 用于经理审批手动录入的费用项
 * 审批通过后自动添加到供应商报价库
 */

import { useState, useEffect } from 'react'
import { 
  CheckCircle2, XCircle, Clock, AlertCircle, 
  ChevronLeft, ChevronRight, Search,
  Receipt, User, Calendar, Check, X, RefreshCw
} from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface ApprovalItem {
  id: number
  feeId: string | null
  feeName: string
  feeNameEn: string | null
  category: string
  amount: number
  currency: string
  unit: string
  supplierId: string | null
  supplierName: string | null
  description: string | null
  requestedBy: string | null
  requestedByName: string | null
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy: string | null
  approvedByName: string | null
  approvedAt: string | null
  rejectionReason: string | null
  convertedToPriceId: number | null
  convertedAt: string | null
}

interface ApprovalStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

// 状态配置
const STATUS_CONFIG = {
  pending: { label: '待审批', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock },
  approved: { label: '已通过', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
  rejected: { label: '已拒绝', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle }
}

// 费用分类配置
const CATEGORY_LABELS: Record<string, string> = {
  freight: '运费',
  customs: '关税',
  warehouse: '仓储费',
  insurance: '保险费',
  handling: '操作费',
  documentation: '文件费',
  other: '其他'
}

export default function FeeItemApprovals() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [stats, setStats] = useState<ApprovalStats>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  
  const pageSize = 20

  // 加载审批列表
  const loadApprovals = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize)
      })
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      const response = await fetch(`${API_BASE}/api/fee-item-approvals?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        setApprovals(data.data.list || [])
        setTotalPages(Math.ceil((data.data.total || 0) / pageSize))
      }
    } catch (error) {
      console.error('加载审批列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载统计数据
  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fee-item-approvals/stats`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  useEffect(() => {
    loadApprovals()
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter])

  // 审批通过
  const handleApprove = async (item: ApprovalItem) => {
    if (!confirm(`确认通过「${item.feeName}」的审批申请？\n\n通过后将自动添加到供应商报价库。`)) {
      return
    }
    
    setProcessing(true)
    try {
      const response = await fetch(`${API_BASE}/api/fee-item-approvals/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: '管理员' // 实际应从登录状态获取
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert(data.msg || '审批通过')
        loadApprovals()
        loadStats()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('审批失败:', error)
      alert('操作失败')
    } finally {
      setProcessing(false)
    }
  }

  // 打开拒绝弹窗
  const openRejectModal = (item: ApprovalItem) => {
    setSelectedItem(item)
    setRejectReason('')
    setShowRejectModal(true)
  }

  // 审批拒绝
  const handleReject = async () => {
    if (!selectedItem) return
    if (!rejectReason.trim()) {
      alert('请输入拒绝原因')
      return
    }
    
    setProcessing(true)
    try {
      const response = await fetch(`${API_BASE}/api/fee-item-approvals/${selectedItem.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: '管理员', // 实际应从登录状态获取
          reason: rejectReason
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert('已拒绝')
        setShowRejectModal(false)
        setSelectedItem(null)
        loadApprovals()
        loadStats()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('拒绝失败:', error)
      alert('操作失败')
    } finally {
      setProcessing(false)
    }
  }

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">费用项审批</h1>
        <p className="text-sm text-gray-500 mt-1">
          审批手动录入的费用项，通过后自动添加到供应商报价库
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-lg p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'ring-2 ring-primary-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">全部申请</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setStatusFilter('pending')}
          className={`bg-white rounded-lg p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'pending' ? 'ring-2 ring-amber-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">待审批</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setStatusFilter('approved')}
          className={`bg-white rounded-lg p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'approved' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">已通过</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setStatusFilter('rejected')}
          className={`bg-white rounded-lg p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">已拒绝</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索费用名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
              />
            </div>
          </div>
          
          <button
            onClick={() => {
              loadApprovals()
              loadStats()
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* 审批列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">费用名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">分类</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">金额</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">供应商</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">申请人</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">申请时间</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">状态</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    加载中...
                  </div>
                </td>
              </tr>
            ) : approvals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">暂无审批记录</p>
                </td>
              </tr>
            ) : (
              approvals.map(item => {
                const statusInfo = STATUS_CONFIG[item.status]
                const StatusIcon = statusInfo.icon
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-gray-900">{item.feeName}</div>
                      {item.feeNameEn && (
                        <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                      )}
                      {item.description && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]" title={item.description}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-sm text-gray-900">
                        {item.currency} {item.amount?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="text-xs text-gray-400">/{item.unit}</div>
                    </td>
                    <td className="px-4 py-3">
                      {item.supplierName ? (
                        <div className="text-sm text-gray-900">{item.supplierName}</div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">{item.requestedByName || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{formatDate(item.requestedAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${statusInfo.bg} ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>
                      {item.status === 'approved' && item.convertedToPriceId && (
                        <div className="text-xs text-green-600 text-center mt-1">
                          已转报价库
                        </div>
                      )}
                      {item.status === 'rejected' && item.rejectionReason && (
                        <div className="text-xs text-red-500 text-center mt-1 truncate max-w-[100px]" title={item.rejectionReason}>
                          {item.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {item.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApprove(item)}
                              disabled={processing}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                              title="通过"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openRejectModal(item)}
                              disabled={processing}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="拒绝"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {item.approvedByName && `${item.approvedByName} 处理`}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        
        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              第 {currentPage} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="上一页"
                aria-label="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="下一页"
                aria-label="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 拒绝原因弹窗 */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRejectModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">拒绝审批</h3>
            </div>
            
            <div className="p-4">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900">{selectedItem.feeName}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedItem.currency} {selectedItem.amount?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  {selectedItem.supplierName && ` · ${selectedItem.supplierName}`}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  拒绝原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请输入拒绝原因..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {processing && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

