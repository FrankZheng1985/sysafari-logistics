/**
 * CRM 惩罚记录管理页面
 * 记录和管理业务员的惩罚记录，关联客户和订单
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Plus, X, Eye, Edit, Trash2,
  AlertTriangle, Clock, CheckCircle, XCircle,
  Users, FileText, Package
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import DateTimePicker from '../components/DateTimePicker'
import { getApiBaseUrl } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface PenaltyRecord {
  id: string
  recordNo: string
  penaltyRuleId: number
  penaltyName: string
  penaltyType: string
  // 客户信息
  customerId: string
  customerName: string
  // 订单信息
  relatedOrderId: string
  relatedOrderNo: string
  relatedContractId: string
  relatedContractNo: string
  // 责任人信息
  supervisorId: number
  supervisorName: string
  supervisorPenalty: number
  salesId: number
  salesName: string
  salesPenalty: number
  documentId: number
  documentName: string
  documentPenalty: number
  // 惩罚信息
  totalPenalty: number
  lossAmount: number
  // 状态
  settlementMonth: string
  status: string
  isTrialPeriod: boolean
  // 事件信息
  incidentDate: string
  incidentDescription: string
  notes: string
  createdAt: string
}

interface PenaltyRule {
  id: number
  penaltyName: string
  penaltyType: string
  totalAmount: number
  supervisorPenalty: number
  salesPenalty: number
  documentPenalty: number
  lossPercentage: number
}

interface User {
  id: number
  name: string
}

interface Customer {
  id: string
  customerName: string
  companyName: string
}

interface Order {
  id: string
  orderNo: string
  customerName: string
}

// 状态选项
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'communicated', label: '已沟通' },
  { value: 'confirmed', label: '已确认' },
  { value: 'settled', label: '已结算' },
  { value: 'cancelled', label: '已取消' }
]

// 惩罚类型选项
const PENALTY_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'inspection', label: '查验惩罚' },
  { value: 'mistake', label: '工作失误' },
  { value: 'loss', label: '经济损失' }
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

export default function CRMPenaltyRecords() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<PenaltyRecord[]>([])
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // 是否试用期
  const inTrialPeriod = getTrialStatus()
  
  // 筛选条件
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [searchValue, setSearchValue] = useState('')
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PenaltyRecord | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<PenaltyRecord | null>(null)
  
  // 表单数据
  const [formData, setFormData] = useState({
    penaltyRuleId: '',
    penaltyType: 'inspection' as 'inspection' | 'mistake' | 'loss',
    customerId: '',
    customerName: '',
    relatedOrderId: '',
    relatedOrderNo: '',
    supervisorId: '',
    supervisorName: '',
    salesId: '',
    salesName: '',
    documentId: '',
    documentName: '',
    supervisorPenalty: 0,
    salesPenalty: 0,
    documentPenalty: 0,
    totalPenalty: 0,
    lossAmount: 0,
    incidentDate: new Date().toISOString().slice(0, 10),
    incidentDescription: '',
    notes: ''
  })

  const tabs = [
    { label: '提成规则', path: '/finance/commission/rules' },
    { label: '提成记录', path: '/finance/commission/records' },
    { label: '惩罚记录', path: '/finance/commission/penalties' },
    { label: '月度结算', path: '/finance/commission/settlements' }
  ]

  useEffect(() => {
    loadData()
  }, [page, pageSize, filterType, filterStatus, filterMonth])

  useEffect(() => {
    loadPenaltyRules()
    loadUsers()
    loadCustomers()
    loadOrders()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (filterType) params.append('penaltyType', filterType)
      if (filterStatus) params.append('status', filterStatus)
      if (filterMonth) params.append('settlementMonth', filterMonth)

      const response = await fetch(`${API_BASE}/api/commission/penalty-records?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setRecords(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载惩罚记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPenaltyRules = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/penalty-rules`)
      const data = await response.json()
      if (data.errCode === 200) {
        setPenaltyRules(data.data || [])
      }
    } catch (error) {
      console.error('加载惩罚规则失败:', error)
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

  const loadCustomers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/customers?pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200) {
        setCustomers(data.data.list || [])
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    }
  }

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/orders?pageSize=100`)
      const data = await response.json()
      if (data.errCode === 200) {
        setOrders(data.data.list || [])
      }
    } catch (error) {
      console.error('加载订单列表失败:', error)
    }
  }

  const handleOpenModal = (record?: PenaltyRecord) => {
    if (record) {
      setEditingRecord(record)
      setFormData({
        penaltyRuleId: record.penaltyRuleId?.toString() || '',
        penaltyType: record.penaltyType as any,
        customerId: record.customerId || '',
        customerName: record.customerName || '',
        relatedOrderId: record.relatedOrderId || '',
        relatedOrderNo: record.relatedOrderNo || '',
        supervisorId: record.supervisorId?.toString() || '',
        supervisorName: record.supervisorName || '',
        salesId: record.salesId?.toString() || '',
        salesName: record.salesName || '',
        documentId: record.documentId?.toString() || '',
        documentName: record.documentName || '',
        supervisorPenalty: record.supervisorPenalty || 0,
        salesPenalty: record.salesPenalty || 0,
        documentPenalty: record.documentPenalty || 0,
        totalPenalty: record.totalPenalty || 0,
        lossAmount: record.lossAmount || 0,
        incidentDate: record.incidentDate || new Date().toISOString().slice(0, 10),
        incidentDescription: record.incidentDescription || '',
        notes: record.notes || ''
      })
    } else {
      setEditingRecord(null)
      setFormData({
        penaltyRuleId: '',
        penaltyType: 'inspection',
        customerId: '',
        customerName: '',
        relatedOrderId: '',
        relatedOrderNo: '',
        supervisorId: '',
        supervisorName: '',
        salesId: '',
        salesName: '',
        documentId: '',
        documentName: '',
        supervisorPenalty: 0,
        salesPenalty: 0,
        documentPenalty: 0,
        totalPenalty: 0,
        lossAmount: 0,
        incidentDate: new Date().toISOString().slice(0, 10),
        incidentDescription: '',
        notes: ''
      })
    }
    setShowModal(true)
  }

  // 选择惩罚规则后自动填充金额
  const handleSelectRule = (ruleId: string) => {
    const rule = penaltyRules.find(r => r.id.toString() === ruleId)
    if (rule) {
      setFormData({
        ...formData,
        penaltyRuleId: ruleId,
        penaltyType: rule.penaltyType as any,
        supervisorPenalty: rule.supervisorPenalty || 0,
        salesPenalty: rule.salesPenalty || 0,
        documentPenalty: rule.documentPenalty || 0,
        totalPenalty: rule.totalAmount || 0
      })
    }
  }

  // 选择客户后自动填充
  const handleSelectCustomer = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      setFormData({
        ...formData,
        customerId,
        customerName: customer.companyName || customer.customerName
      })
    }
  }

  // 选择订单后自动填充
  const handleSelectOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (order) {
      setFormData({
        ...formData,
        relatedOrderId: orderId,
        relatedOrderNo: order.orderNo,
        customerName: order.customerName || formData.customerName
      })
    }
  }

  // 选择责任人
  const handleSelectUser = (field: 'supervisor' | 'sales' | 'document', userId: string) => {
    const user = users.find(u => u.id.toString() === userId)
    if (user) {
      if (field === 'supervisor') {
        setFormData({ ...formData, supervisorId: userId, supervisorName: user.name })
      } else if (field === 'sales') {
        setFormData({ ...formData, salesId: userId, salesName: user.name })
      } else {
        setFormData({ ...formData, documentId: userId, documentName: user.name })
      }
    }
  }

  const handleSubmit = async () => {
    if (!formData.incidentDescription) {
      alert('请填写事件描述')
      return
    }

    try {
      const url = editingRecord 
        ? `${API_BASE}/api/commission/penalty-records/${editingRecord.id}`
        : `${API_BASE}/api/commission/penalty-records`
      const method = editingRecord ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          penaltyName: penaltyRules.find(r => r.id.toString() === formData.penaltyRuleId)?.penaltyName || formData.penaltyType
        })
      })

      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowModal(false)
        loadData()
        if (data.data?.isTrialPeriod) {
          alert('记录已创建。\n注意：当前处于惩罚规则试用期，此记录仅作为沟通参考。')
        }
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存惩罚记录失败:', error)
      alert('保存失败')
    }
  }

  const handleUpdateStatus = async (record: PenaltyRecord, newStatus: string) => {
    if (!confirm(`确定要将状态更新为"${STATUS_OPTIONS.find(s => s.value === newStatus)?.label}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/penalty-records/${record.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      } else {
        alert(data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  const handleDelete = async (record: PenaltyRecord) => {
    if (!confirm('确定要删除这条惩罚记录吗？')) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/penalty-records/${record.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value)
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: '待处理', color: 'text-amber-700', bg: 'bg-amber-100' },
      communicated: { label: '已沟通', color: 'text-blue-700', bg: 'bg-blue-100' },
      confirmed: { label: '已确认', color: 'text-green-700', bg: 'bg-green-100' },
      settled: { label: '已结算', color: 'text-purple-700', bg: 'bg-purple-100' },
      cancelled: { label: '已取消', color: 'text-gray-700', bg: 'bg-gray-100' }
    }
    return statusMap[status] || statusMap.pending
  }

  const getPenaltyTypeInfo = (type: string) => {
    const typeMap: Record<string, { label: string; color: string; bg: string }> = {
      inspection: { label: '查验惩罚', color: 'text-red-700', bg: 'bg-red-100' },
      mistake: { label: '工作失误', color: 'text-amber-700', bg: 'bg-amber-100' },
      loss: { label: '经济损失', color: 'text-purple-700', bg: 'bg-purple-100' }
    }
    return typeMap[type] || typeMap.inspection
  }

  const columns: Column<PenaltyRecord>[] = useMemo(() => [
    {
      key: 'recordNo',
      label: '记录编号',
      width: 130,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{record.recordNo}</div>
          <div className="text-[10px] text-gray-500">{formatDate(record.incidentDate)}</div>
        </div>
      )
    },
    {
      key: 'customer',
      label: '客户',
      width: 120,
      render: (_value, record) => (
        <span className="text-xs text-gray-700">{record.customerName || '-'}</span>
      )
    },
    {
      key: 'order',
      label: '关联订单',
      width: 120,
      render: (_value, record) => (
        record.relatedOrderNo ? (
          <span className="text-xs text-blue-600">{record.relatedOrderNo}</span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )
      )
    },
    {
      key: 'penaltyType',
      label: '惩罚类型',
      width: 90,
      render: (_value, record) => {
        const info = getPenaltyTypeInfo(record.penaltyType)
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'description',
      label: '事件描述',
      width: 180,
      render: (_value, record) => (
        <span className="text-xs text-gray-600 truncate block max-w-[180px]" title={record.incidentDescription}>
          {record.incidentDescription}
        </span>
      )
    },
    {
      key: 'amount',
      label: '惩罚金额',
      width: 100,
      render: (_value, record) => (
        <span className="text-xs font-medium text-red-600">
          {formatCurrency(record.totalPenalty)}
        </span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 80,
      render: (_value, record) => {
        const info = getStatusInfo(record.status)
        return (
          <div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
              {info.label}
            </span>
            {record.isTrialPeriod && (
              <div className="text-[9px] text-amber-600 mt-0.5">试用期</div>
            )}
          </div>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      width: 150,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => { setSelectedRecord(record); setShowDetailModal(true) }}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="查看详情"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          
          {(record.status === 'pending' || record.status === 'communicated') && (
            <>
              <button
                onClick={() => handleOpenModal(record)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                title="编辑"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              
              {record.status === 'pending' && (
                <button
                  onClick={() => handleUpdateStatus(record, 'communicated')}
                  className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  已沟通
                </button>
              )}
              
              {record.status === 'communicated' && (
                <button
                  onClick={() => handleUpdateStatus(record, 'confirmed')}
                  className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
                >
                  确认
                </button>
              )}
              
              <button
                onClick={() => handleDelete(record)}
                className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
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

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="提成管理"
        tabs={tabs}
        activeTab="/finance/commission/penalties"
        onTabChange={(path) => navigate(path)}
      />

      {/* 试用期提示 */}
      {inTrialPeriod && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-800">惩罚规则试用期</div>
            <div className="text-xs text-amber-600">
              当前处于惩罚规则试用期，新建的惩罚记录仅作为沟通参考，不会实际扣款。
            </div>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索记录..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {PENALTY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
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
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          新建惩罚记录
        </button>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={records}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">
            共 {total} 条记录
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

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[700px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-medium">
                  {editingRecord ? '编辑惩罚记录' : '新建惩罚记录'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 惩罚规则选择 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">惩罚规则</label>
                <select
                  value={formData.penaltyRuleId}
                  onChange={(e) => handleSelectRule(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                  <option value="">选择预设规则（可选）</option>
                  {penaltyRules.map(rule => (
                    <option key={rule.id} value={rule.id}>
                      {rule.penaltyName} - {formatCurrency(rule.totalAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 客户和订单关联 */}
              <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                <div className="text-xs font-medium text-blue-700 flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  关联客户和订单
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">关联客户</label>
                    <select
                      value={formData.customerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">选择客户</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.companyName || c.customerName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">关联订单</label>
                    <select
                      value={formData.relatedOrderId}
                      onChange={(e) => handleSelectOrder(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">选择订单</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.orderNo} - {o.customerName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 责任人 */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  责任人
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">主管</label>
                    <select
                      value={formData.supervisorId}
                      onChange={(e) => handleSelectUser('supervisor', e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="">选择主管</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">跟单</label>
                    <select
                      value={formData.salesId}
                      onChange={(e) => handleSelectUser('sales', e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="">选择跟单</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">单证</label>
                    <select
                      value={formData.documentId}
                      onChange={(e) => handleSelectUser('document', e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="">选择单证</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 惩罚金额 */}
              <div className="p-3 bg-red-50 rounded-lg space-y-3">
                <div className="text-xs font-medium text-red-700">惩罚金额分配</div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">主管 (CNY)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.supervisorPenalty}
                      onChange={(e) => setFormData({...formData, supervisorPenalty: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">跟单 (CNY)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.salesPenalty}
                      onChange={(e) => setFormData({...formData, salesPenalty: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">单证 (CNY)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.documentPenalty}
                      onChange={(e) => setFormData({...formData, documentPenalty: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">合计</label>
                    <div className="px-3 py-2 text-xs font-bold text-red-600 bg-white border rounded-lg">
                      {formatCurrency(formData.supervisorPenalty + formData.salesPenalty + formData.documentPenalty)}
                    </div>
                  </div>
                </div>
                
                {formData.penaltyType === 'loss' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">经济损失金额</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.lossAmount}
                      onChange={(e) => setFormData({...formData, lossAmount: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                      placeholder="用于计算30%承担金额"
                    />
                  </div>
                )}
              </div>

              {/* 事件信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">事件发生日期 *</label>
                  <DateTimePicker
                    value={formData.incidentDate}
                    onChange={(value) => setFormData({...formData, incidentDate: value})}
                    showTime={false}
                    placeholder="选择事件日期"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">惩罚类型</label>
                  <select
                    value={formData.penaltyType}
                    onChange={(e) => setFormData({...formData, penaltyType: e.target.value as any})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  >
                    <option value="inspection">查验惩罚</option>
                    <option value="mistake">工作失误</option>
                    <option value="loss">经济损失</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">事件描述 *</label>
                <textarea
                  value={formData.incidentDescription}
                  onChange={(e) => setFormData({...formData, incidentDescription: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white resize-none"
                  rows={3}
                  placeholder="详细描述事件经过..."
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white resize-none"
                  rows={2}
                  placeholder="其他备注信息..."
                />
              </div>

              {inTrialPeriod && (
                <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                  ⚠️ 当前处于惩罚规则试用期，此记录将被标记为"已沟通"状态，仅作为沟通参考。
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">惩罚记录详情</h3>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500">记录编号</div>
                  <div className="text-xs font-medium">{selectedRecord.recordNo}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">惩罚类型</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getPenaltyTypeInfo(selectedRecord.penaltyType).bg} ${getPenaltyTypeInfo(selectedRecord.penaltyType).color}`}>
                    {getPenaltyTypeInfo(selectedRecord.penaltyType).label}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">关联客户</div>
                  <div className="text-xs">{selectedRecord.customerName || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">关联订单</div>
                  <div className="text-xs text-blue-600">{selectedRecord.relatedOrderNo || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">事件日期</div>
                  <div className="text-xs">{selectedRecord.incidentDate}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">状态</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getStatusInfo(selectedRecord.status).bg} ${getStatusInfo(selectedRecord.status).color}`}>
                    {getStatusInfo(selectedRecord.status).label}
                  </span>
                  {selectedRecord.isTrialPeriod && (
                    <span className="ml-1 text-[9px] text-amber-600">(试用期)</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 mb-1">事件描述</div>
                <div className="text-xs text-gray-700 p-2 bg-gray-50 rounded">
                  {selectedRecord.incidentDescription}
                </div>
              </div>

              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-xs font-medium text-red-700 mb-2">惩罚金额明细</div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-[10px] text-gray-500">主管</div>
                    <div className="text-xs font-medium">{selectedRecord.supervisorName || '-'}</div>
                    <div className="text-sm font-bold text-red-600">{formatCurrency(selectedRecord.supervisorPenalty)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">跟单</div>
                    <div className="text-xs font-medium">{selectedRecord.salesName || '-'}</div>
                    <div className="text-sm font-bold text-red-600">{formatCurrency(selectedRecord.salesPenalty)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">单证</div>
                    <div className="text-xs font-medium">{selectedRecord.documentName || '-'}</div>
                    <div className="text-sm font-bold text-red-600">{formatCurrency(selectedRecord.documentPenalty)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500">合计</div>
                    <div className="text-xs font-medium">-</div>
                    <div className="text-sm font-bold text-red-600">{formatCurrency(selectedRecord.totalPenalty)}</div>
                  </div>
                </div>
              </div>

              {selectedRecord.notes && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">备注</div>
                  <div className="text-xs text-gray-600">{selectedRecord.notes}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end p-4 border-t">
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
    </div>
  )
}
