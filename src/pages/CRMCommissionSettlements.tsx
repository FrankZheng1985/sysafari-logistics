import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Plus, Check, X, Eye, FileText,
  DollarSign, Clock, CheckCircle, XCircle, Banknote,
  AlertTriangle, TrendingUp, TrendingDown, Calculator,
  RefreshCw, Download, Send, Users
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'
import { formatDate, formatDateTime } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface CommissionSettlement {
  id: string
  settlementNo: string
  settlementMonth: string
  salespersonId: number
  salespersonName: string
  // 奖励部分
  rewardRecordCount: number
  totalBaseAmount: number
  totalReward: number
  // 惩罚部分
  penaltyRecordCount: number
  totalPenalty: number
  // 净额
  netAmount: number
  status: string
  submitTime: string | null
  reviewerId: number | null
  reviewerName: string | null
  reviewTime: string | null
  reviewComment: string | null
  paidTime: string | null
  // 财务关联
  financialVoucherId: string | null
  financialVoucherNo: string | null
  createdAt: string
}

interface CommissionRecord {
  id: string
  recordNo: string
  // 客户信息
  customerId: string
  customerName: string
  customerLevel: string
  // 订单信息
  sourceType: string // contract/order/payment
  sourceId: string
  sourceNo: string
  // 规则信息
  ruleName: string
  ruleType: string
  baseAmount: number
  commissionAmount: number
  // 角色分配
  supervisorBonus: number
  salesBonus: number
  documentBonus: number
}

interface PenaltyRecord {
  id: string
  recordNo: string
  penaltyName: string
  penaltyType: string
  incidentDescription: string
  // 客户信息
  customerId: string
  customerName: string
  // 订单信息
  relatedOrderId: string
  relatedOrderNo: string
  // 惩罚金额
  totalPenalty: number
  supervisorPenalty: number
  salesPenalty: number
  documentPenalty: number
  lossAmount: number
  isTrialPeriod: boolean
  status: string
  incidentDate: string
}

interface User {
  id: number
  name: string
  role?: string
}

interface SettlementSummary {
  totalReward: number
  totalPenalty: number
  netAmount: number
  pendingCount: number
  approvedCount: number
  paidCount: number
}

// 状态选项
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '待审批' },
  { value: 'approved', label: '已审批' },
  { value: 'rejected', label: '已驳回' },
  { value: 'paid', label: '已发放' }
]

// 方案配置
const SCHEME_CONFIG = {
  startDate: '2025-12-01',
  trialPeriod: 3,
}

// 计算试用期状态
const getTrialStatus = () => {
  const startDate = new Date(SCHEME_CONFIG.startDate)
  const today = new Date()
  const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth())
  return today >= startDate && monthsDiff < SCHEME_CONFIG.trialPeriod
}

export default function CRMCommissionSettlements() {
  const navigate = useNavigate()
  const [settlements, setSettlements] = useState<CommissionSettlement[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [summary, setSummary] = useState<SettlementSummary>({
    totalReward: 0, totalPenalty: 0, netAmount: 0,
    pendingCount: 0, approvedCount: 0, paidCount: 0
  })
  
  // 筛选条件
  const [filterSalesperson, setFilterSalesperson] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // 弹窗状态
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<CommissionSettlement | null>(null)
  const [detailRecords, setDetailRecords] = useState<CommissionRecord[]>([])
  const [detailPenalties, setDetailPenalties] = useState<PenaltyRecord[]>([])
  const [rejectComment, setRejectComment] = useState('')
  const [generating, setGenerating] = useState(false)
  
  // 是否试用期
  const inTrialPeriod = getTrialStatus()
  
  // 生成表单
  const [generateForm, setGenerateForm] = useState({
    salespersonId: '',
    salespersonName: '',
    month: new Date().toISOString().slice(0, 7)
  })
  
  // 自动生成表单
  const [autoGenerateForm, setAutoGenerateForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    includeAll: true // 是否包含所有业务员
  })

  const tabs = [
    { label: '提成规则', path: '/finance/commission/rules' },
    { label: '提成记录', path: '/finance/commission/records' },
    { label: '惩罚记录', path: '/finance/commission/penalties' },
    { label: '月度结算', path: '/finance/commission/settlements' }
  ]

  useEffect(() => {
    loadData()
  }, [page, pageSize, filterSalesperson, filterMonth, filterStatus])

  useEffect(() => {
    loadUsers()
    loadSummary()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (filterSalesperson) params.append('salespersonId', filterSalesperson)
      if (filterMonth) params.append('settlementMonth', filterMonth)
      if (filterStatus) params.append('status', filterStatus)

      const response = await fetch(`${API_BASE}/api/commission/settlements?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setSettlements(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载结算单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users?pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200) {
        setUsers(data.data.list || [])
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    }
  }
  
  const loadSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/summary`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSummary(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  const loadSettlementDetail = async (settlement: CommissionSettlement) => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/${settlement.id}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setSelectedSettlement(settlement)
        setDetailRecords(data.data.records || [])
        setDetailPenalties(data.data.penalties || [])
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error('加载结算单详情失败:', error)
    }
  }

  // 单个业务员生成结算单
  const handleGenerate = async () => {
    if (!generateForm.salespersonId) {
      alert('请选择业务员')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm)
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert('生成成功')
        setShowGenerateModal(false)
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '生成失败')
      }
    } catch (error) {
      console.error('生成结算单失败:', error)
      alert('生成结算单失败')
    } finally {
      setGenerating(false)
    }
  }
  
  // 自动批量生成结算单
  const handleAutoGenerate = async () => {
    if (!confirm(`确定要为${autoGenerateForm.month}月自动生成所有业务员的结算单吗？\n系统将汇总所有待结算的奖励和惩罚记录。`)) {
      return
    }

    setGenerating(true)
    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/auto-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoGenerateForm)
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功生成 ${data.data.count} 个结算单`)
        setShowAutoGenerateModal(false)
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '生成失败')
      }
    } catch (error) {
      console.error('自动生成结算单失败:', error)
      alert('自动生成结算单失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async (settlement: CommissionSettlement) => {
    if (!confirm('确定要提交审批吗？')) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/${settlement.id}/submit`, {
        method: 'PUT'
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '提交失败')
      }
    } catch (error) {
      console.error('提交审批失败:', error)
    }
  }

  const handleApprove = async (settlement: CommissionSettlement) => {
    if (!confirm('确定要审批通过吗？\n审批通过后将自动生成财务凭证。')) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/${settlement.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: '审批通过' })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '审批失败')
      }
    } catch (error) {
      console.error('审批失败:', error)
    }
  }

  const handleReject = async () => {
    if (!rejectComment.trim()) {
      alert('请填写驳回原因')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/${selectedSettlement?.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectComment })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowRejectModal(false)
        setRejectComment('')
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '驳回失败')
      }
    } catch (error) {
      console.error('驳回失败:', error)
    }
  }

  const handleMarkPaid = async (settlement: CommissionSettlement) => {
    if (!confirm('确定要标记为已发放吗？\n这将更新财务凭证状态。')) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/${settlement.id}/paid`, {
        method: 'PUT'
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('标记发放失败:', error)
    }
  }
  
  // 批量提交审批
  const handleBatchSubmit = async () => {
    const draftSettlements = settlements.filter(s => s.status === 'draft')
    if (draftSettlements.length === 0) {
      alert('没有可提交的草稿结算单')
      return
    }
    
    if (!confirm(`确定要批量提交 ${draftSettlements.length} 个草稿结算单吗？`)) return
    
    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/batch-submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: draftSettlements.map(s => s.id) })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`成功提交 ${data.data.count} 个结算单`)
        loadData()
        loadSummary()
      } else {
        alert(data.msg || '批量提交失败')
      }
    } catch (error) {
      console.error('批量提交失败:', error)
    }
  }
  
  // 导出结算单
  const handleExport = async (settlement: CommissionSettlement) => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/settlements/${settlement.id}/export`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `结算单_${settlement.settlementNo}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value)
  }


  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
      draft: { label: '草稿', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText },
      pending: { label: '待审批', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
      approved: { label: '已审批', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
      rejected: { label: '已驳回', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
      paid: { label: '已发放', color: 'text-blue-700', bg: 'bg-blue-100', icon: Banknote }
    }
    return statusMap[status] || statusMap.draft
  }

  const columns: Column<CommissionSettlement>[] = useMemo(() => [
    {
      key: 'settlementNo',
      label: '结算单号',
      width: 140,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{record.settlementNo}</div>
          <div className="text-[10px] text-gray-500">{record.settlementMonth}</div>
        </div>
      )
    },
    {
      key: 'salesperson',
      label: '业务员',
      width: 100,
      render: (_value, record) => (
        <span className="text-xs text-gray-700">{record.salespersonName || '-'}</span>
      )
    },
    {
      key: 'reward',
      label: '奖励',
      width: 110,
      render: (_value, record) => (
        <div className="text-right">
          <div className="text-xs font-medium text-green-600">+{formatCurrency(record.totalReward || 0)}</div>
          <div className="text-[10px] text-gray-400">{record.rewardRecordCount || 0}条</div>
        </div>
      )
    },
    {
      key: 'penalty',
      label: '惩罚',
      width: 110,
      render: (_value, record) => (
        <div className="text-right">
          <div className="text-xs font-medium text-red-600">-{formatCurrency(record.totalPenalty || 0)}</div>
          <div className="text-[10px] text-gray-400">{record.penaltyRecordCount || 0}条</div>
        </div>
      )
    },
    {
      key: 'netAmount',
      label: '净额',
      width: 120,
      render: (_value, record) => {
        const netAmount = (record.totalReward || 0) - (record.totalPenalty || 0)
        return (
          <span className={`text-xs font-bold ${netAmount >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
            {formatCurrency(netAmount)}
          </span>
        )
      }
    },
    {
      key: 'status',
      label: '状态',
      width: 90,
      render: (_value, record) => {
        const info = getStatusInfo(record.status)
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
      key: 'financial',
      label: '财务凭证',
      width: 100,
      render: (_value, record) => (
        record.financialVoucherNo ? (
          <span className="text-xs text-blue-600">{record.financialVoucherNo}</span>
        ) : (
          <span className="text-[10px] text-gray-400">-</span>
        )
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 180,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => loadSettlementDetail(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="查看详情"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          
          <button 
            onClick={() => handleExport(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="导出"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          
          {record.status === 'draft' && (
            <button
              onClick={() => handleSubmit(record)}
              className="px-2 py-1 text-[10px] bg-primary-50 text-primary-600 rounded hover:bg-primary-100"
            >
              提交审批
            </button>
          )}
          
          {record.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(record)}
                className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
              >
                通过
              </button>
              <button
                onClick={() => {
                  setSelectedSettlement(record)
                  setShowRejectModal(true)
                }}
                className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                驳回
              </button>
            </>
          )}
          
          {record.status === 'approved' && (
            <button
              onClick={() => handleMarkPaid(record)}
              className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
            >
              标记发放
            </button>
          )}
        </div>
      )
    }
  ], [])

  // 生成月份选项
  const monthOptions = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(d.toISOString().slice(0, 7))
    }
    return months
  }, [])

  // 统计各状态数量
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { draft: 0, pending: 0, approved: 0, rejected: 0, paid: 0 }
    settlements.forEach(s => {
      if (counts[s.status] !== undefined) {
        counts[s.status]++
      }
    })
    return counts
  }, [settlements])

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="提成管理"
        tabs={tabs}
        activeTab="/finance/commission/settlements"
        onTabChange={(path) => navigate(path)}
      />

      {/* 试用期提示 */}
      {inTrialPeriod && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-800">惩罚规则试用期</div>
            <div className="text-xs text-amber-600">
              当前处于惩罚规则试用期，惩罚记录仅作为沟通参考，不会从奖金中扣除。
            </div>
          </div>
        </div>
      )}

      {/* 汇总统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">总奖励</div>
              <div className="text-lg font-bold text-green-600">{formatCurrency(summary.totalReward)}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">总惩罚</div>
              <div className="text-lg font-bold text-red-600">{formatCurrency(summary.totalPenalty)}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Calculator className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">净结算额</div>
              <div className={`text-lg font-bold ${summary.netAmount >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                {formatCurrency(summary.netAmount)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Banknote className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">已发放</div>
              <div className="text-lg font-bold text-blue-600">{summary.paidCount} 单</div>
            </div>
          </div>
        </div>
      </div>

      {/* 状态统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { status: 'draft', label: '草稿', icon: FileText, color: 'gray' },
          { status: 'pending', label: '待审批', icon: Clock, color: 'amber' },
          { status: 'approved', label: '已审批', icon: CheckCircle, color: 'green' },
          { status: 'rejected', label: '已驳回', icon: XCircle, color: 'red' },
          { status: 'paid', label: '已发放', icon: Banknote, color: 'blue' }
        ].map(item => (
          <div 
            key={item.status}
            className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-${item.color}-300 transition-colors ${
              filterStatus === item.status ? `border-${item.color}-500 bg-${item.color}-50` : ''
            }`}
            onClick={() => {
              setFilterStatus(filterStatus === item.status ? '' : item.status)
              setPage(1)
            }}
          >
            <div className="flex items-center gap-2">
              <item.icon className={`w-4 h-4 text-${item.color}-600`} />
              <span className="text-xs text-gray-600">{item.label}</span>
              <span className="ml-auto text-sm font-bold text-gray-900">{statusCounts[item.status] || 0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <select
            value={filterSalesperson}
            onChange={(e) => { setFilterSalesperson(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部业务员</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部月份</option>
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          
          <button
            onClick={loadData}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {statusCounts.draft > 0 && (
            <button
              onClick={handleBatchSubmit}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 text-xs rounded-lg hover:bg-amber-100"
            >
              <Send className="w-4 h-4" />
              批量提交 ({statusCounts.draft})
            </button>
          )}
          
          <button
            onClick={() => setShowAutoGenerateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 text-xs rounded-lg hover:bg-green-100"
          >
            <Users className="w-4 h-4" />
            自动结算
          </button>
          
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            手动生成
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={settlements}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">
            共 {total} 条结算单，第 {page} / {Math.ceil(total / pageSize)} 页
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
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
              title="每页显示条数"
            >
              <option value={20}>20 条/页</option>
              <option value={50}>50 条/页</option>
              <option value={100}>100 条/页</option>
            </select>
          </div>
        </div>
      )}

      {/* 手动生成结算单弹窗 */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[400px]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">手动生成结算单</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">业务员 *</label>
                <select
                  value={generateForm.salespersonId}
                  onChange={(e) => {
                    const user = users.find(u => u.id.toString() === e.target.value)
                    setGenerateForm({
                      ...generateForm,
                      salespersonId: e.target.value,
                      salespersonName: user?.name || ''
                    })
                  }}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">请选择业务员</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">结算月份 *</label>
                <select
                  value={generateForm.month}
                  onChange={(e) => setGenerateForm({...generateForm, month: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {monthOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <p className="font-medium mb-1">结算内容包括：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>所有待结算的提成记录（奖励）</li>
                  <li>所有已确认的惩罚记录（扣款）</li>
                </ul>
                {inTrialPeriod && (
                  <p className="mt-2 text-amber-600">
                    ⚠️ 试用期内惩罚记录不会实际扣款
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {generating ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自动生成结算单弹窗 */}
      {showAutoGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[450px]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">自动批量生成结算单</h3>
              <button onClick={() => setShowAutoGenerateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">结算月份 *</label>
                <select
                  value={autoGenerateForm.month}
                  onChange={(e) => setAutoGenerateForm({...autoGenerateForm, month: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  {monthOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-xs font-medium text-green-700 mb-2">自动结算说明</div>
                <ul className="text-xs text-green-600 space-y-1">
                  <li>• 系统将自动为所有有待结算记录的业务员生成结算单</li>
                  <li>• 每个业务员的奖励和惩罚将自动汇总</li>
                  <li>• 已存在结算单的业务员将被跳过</li>
                  <li>• 生成后结算单状态为"草稿"，需提交审批</li>
                </ul>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="text-xs font-medium text-amber-700 mb-2">财务关联</div>
                <ul className="text-xs text-amber-600 space-y-1">
                  <li>• 审批通过后自动生成财务凭证</li>
                  <li>• 凭证科目：应付职工薪酬-奖金</li>
                  <li>• 标记发放后更新凭证为已付款</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowAutoGenerateModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAutoGenerate}
                disabled={generating}
                className="px-4 py-2 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {generating ? '生成中...' : '开始自动生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetailModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[900px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="text-sm font-medium">
                结算单详情 - {selectedSettlement.settlementNo}
              </h3>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 结算单汇总信息 */}
              <div className="grid grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-[10px] text-gray-500">业务员</div>
                  <div className="text-xs font-medium">{selectedSettlement.salespersonName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">结算月份</div>
                  <div className="text-xs font-medium">{selectedSettlement.settlementMonth}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">奖励金额</div>
                  <div className="text-sm font-bold text-green-600">
                    +{formatCurrency(selectedSettlement.totalReward || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">惩罚金额</div>
                  <div className="text-sm font-bold text-red-600">
                    -{formatCurrency(selectedSettlement.totalPenalty || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">净结算额</div>
                  <div className={`text-sm font-bold ${
                    (selectedSettlement.totalReward || 0) - (selectedSettlement.totalPenalty || 0) >= 0 
                      ? 'text-primary-600' : 'text-red-600'
                  }`}>
                    {formatCurrency((selectedSettlement.totalReward || 0) - (selectedSettlement.totalPenalty || 0))}
                  </div>
                </div>
              </div>

              {/* 审批信息 */}
              {selectedSettlement.reviewerName && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-xs font-medium text-blue-700 mb-2">审批信息</div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">审批人：</span>
                      <span>{selectedSettlement.reviewerName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">审批时间：</span>
                      <span>{formatDateTime(selectedSettlement.reviewTime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">审批意见：</span>
                      <span>{selectedSettlement.reviewComment || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 财务凭证信息 */}
              {selectedSettlement.financialVoucherNo && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-xs font-medium text-green-700 mb-2">财务凭证</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">凭证号：</span>
                      <span className="text-green-700 font-medium">{selectedSettlement.financialVoucherNo}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">状态：</span>
                      <span>{selectedSettlement.status === 'paid' ? '已付款' : '待付款'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 奖励记录列表 */}
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  奖励记录明细 ({detailRecords.length}条)
                </div>
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">记录编号</th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">客户</th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">关联订单</th>
                        <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">规则</th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">基数</th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">主管</th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">跟单</th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">单证</th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">合计</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detailRecords.map(record => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-900">{record.recordNo}</td>
                          <td className="px-3 py-2">
                            <div className="text-xs text-gray-900">{record.customerName || '-'}</div>
                            {record.customerLevel && (
                              <span className={`text-[10px] px-1 py-0.5 rounded ${
                                record.customerLevel === 'vip' ? 'bg-purple-100 text-purple-600' :
                                record.customerLevel === 'important' ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {record.customerLevel === 'vip' ? 'VIP' :
                                 record.customerLevel === 'important' ? '重要' :
                                 record.customerLevel === 'normal' ? '普通' : '潜在'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs text-blue-600">{record.sourceNo || '-'}</div>
                            <span className="text-[10px] text-gray-400">
                              {record.sourceType === 'contract' ? '合同' :
                               record.sourceType === 'order' ? '订单' : '回款'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{record.ruleName}</td>
                          <td className="px-3 py-2 text-xs text-gray-600 text-right">
                            {formatCurrency(record.baseAmount || 0)}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 text-right">
                            {formatCurrency(record.supervisorBonus || 0)}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 text-right">
                            {formatCurrency(record.salesBonus || 0)}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 text-right">
                            {formatCurrency(record.documentBonus || 0)}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-green-600 text-right">
                            {formatCurrency(record.commissionAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-green-50">
                      <tr>
                        <td colSpan={8} className="px-3 py-2 text-xs font-medium text-gray-700">奖励合计</td>
                        <td className="px-3 py-2 text-xs font-bold text-green-600 text-right">
                          +{formatCurrency(selectedSettlement.totalReward || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 惩罚记录列表 */}
              {detailPenalties.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    惩罚记录明细 ({detailPenalties.length}条)
                    {inTrialPeriod && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded">试用期-不扣款</span>
                    )}
                  </div>
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">记录编号</th>
                          <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">客户</th>
                          <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">关联订单</th>
                          <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">惩罚类型</th>
                          <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">事件描述</th>
                          <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500">发生日期</th>
                          <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">主管</th>
                          <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">跟单</th>
                          <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">单证</th>
                          <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500">合计</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailPenalties.map(penalty => (
                          <tr key={penalty.id} className={`hover:bg-gray-50 ${penalty.isTrialPeriod ? 'opacity-60' : ''}`}>
                            <td className="px-3 py-2 text-xs text-gray-900">{penalty.recordNo}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{penalty.customerName || '-'}</td>
                            <td className="px-3 py-2">
                              {penalty.relatedOrderNo ? (
                                <span className="text-xs text-blue-600">{penalty.relatedOrderNo}</span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                penalty.penaltyType === 'inspection' ? 'bg-red-100 text-red-600' :
                                penalty.penaltyType === 'mistake' ? 'bg-amber-100 text-amber-600' :
                                'bg-purple-100 text-purple-600'
                              }`}>
                                {penalty.penaltyType === 'inspection' ? '查验惩罚' :
                                 penalty.penaltyType === 'mistake' ? '工作失误' : '经济损失'}
                              </span>
                              {penalty.penaltyType === 'loss' && penalty.lossAmount > 0 && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  损失: {formatCurrency(penalty.lossAmount)}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 max-w-[150px] truncate" title={penalty.incidentDescription}>
                              {penalty.incidentDescription}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {penalty.incidentDate ? formatDate(penalty.incidentDate) : '-'}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 text-right">
                              {formatCurrency(penalty.supervisorPenalty || 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 text-right">
                              {formatCurrency(penalty.salesPenalty || 0)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 text-right">
                              {formatCurrency(penalty.documentPenalty || 0)}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-red-600 text-right">
                              -{formatCurrency(penalty.totalPenalty)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-red-50">
                        <tr>
                          <td colSpan={9} className="px-3 py-2 text-xs font-medium text-gray-700">惩罚合计</td>
                          <td className="px-3 py-2 text-xs font-bold text-red-600 text-right">
                            -{formatCurrency(selectedSettlement.totalPenalty || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              
              {/* 结算汇总 */}
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-primary-700">最终结算金额</div>
                  <div className={`text-xl font-bold ${
                    (selectedSettlement.totalReward || 0) - (selectedSettlement.totalPenalty || 0) >= 0 
                      ? 'text-primary-600' : 'text-red-600'
                  }`}>
                    {formatCurrency((selectedSettlement.totalReward || 0) - (selectedSettlement.totalPenalty || 0))}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  = 奖励 {formatCurrency(selectedSettlement.totalReward || 0)} - 惩罚 {formatCurrency(selectedSettlement.totalPenalty || 0)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => handleExport(selectedSettlement)}
                className="flex items-center gap-1 px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                导出PDF
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 驳回弹窗 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[400px]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">驳回结算单</h3>
              <button onClick={() => setShowRejectModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <label className="block text-xs text-gray-600 mb-1">驳回原因 *</label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                rows={3}
                placeholder="请填写驳回原因"
              />
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                确定驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
