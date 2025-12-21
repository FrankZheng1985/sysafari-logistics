import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Filter, Download, Calculator, X,
  DollarSign, FileText, Users, Calendar
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface CommissionRecord {
  id: string
  recordNo: string
  salespersonId: number
  salespersonName: string
  customerId: string
  customerName: string
  customerLevel: string
  ruleId: number
  ruleName: string
  ruleType: string
  commissionBase: string
  baseAmount: number
  commissionRate: number
  fixedBonus: number
  tierBonus: number
  commissionAmount: number
  sourceType: string
  sourceId: string
  sourceNo: string
  settlementMonth: string
  settlementId: string
  status: string
  notes: string
  createdAt: string
}

interface CommissionStats {
  total: {
    records: number
    baseAmount: number
    commission: number
    pendingCommission: number
    settledCommission: number
  }
  monthly: Array<{
    month: string
    recordCount: number
    commission: number
  }>
  byRuleType: Array<{
    ruleType: string
    recordCount: number
    commission: number
  }>
}

interface User {
  id: number
  name: string
}

// 状态选项
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待结算' },
  { value: 'settled', label: '已结算' },
  { value: 'cancelled', label: '已取消' }
]

// 来源类型选项
const SOURCE_TYPES = [
  { value: '', label: '全部来源' },
  { value: 'contract', label: '合同' },
  { value: 'order', label: '订单' },
  { value: 'payment', label: '回款' }
]

// 客户级别选项
const CUSTOMER_LEVELS = [
  { value: 'vip', label: 'VIP' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '普通' },
  { value: 'potential', label: '潜在' }
]

export default function CRMCommissionRecords() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [stats, setStats] = useState<CommissionStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  // 筛选条件
  const [searchValue, setSearchValue] = useState('')
  const [filterSalesperson, setFilterSalesperson] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSourceType, setFilterSourceType] = useState('')
  
  // 手动计算弹窗
  const [showCalculateModal, setShowCalculateModal] = useState(false)
  const [calculateForm, setCalculateForm] = useState({
    salespersonId: '',
    salespersonName: '',
    customerId: '',
    customerName: '',
    customerLevel: 'normal',
    sourceType: 'contract',
    sourceId: '',
    sourceNo: '',
    amount: 0,
    commissionBase: 'contract_amount'
  })

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
    { label: '提成规则', path: '/crm/commission/rules' },
    { label: '提成记录', path: '/crm/commission/records' },
    { label: '惩罚记录', path: '/crm/commission/penalties' },
    { label: '月度结算', path: '/crm/commission/settlements' }
  ]

  useEffect(() => {
    loadData()
  }, [page, filterSalesperson, filterMonth, filterStatus, filterSourceType])

  useEffect(() => {
    loadUsers()
    loadStats()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterSalesperson) params.append('salespersonId', filterSalesperson)
      if (filterMonth) params.append('settlementMonth', filterMonth)
      if (filterStatus) params.append('status', filterStatus)
      if (filterSourceType) params.append('sourceType', filterSourceType)

      const response = await fetch(`${API_BASE}/api/commission/records?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setRecords(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载提成记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
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

  const handleSearch = () => {
    setPage(1)
    loadData()
  }

  const handleCalculate = async () => {
    if (!calculateForm.salespersonId) {
      alert('请选择业务员')
      return
    }
    if (!calculateForm.amount || calculateForm.amount <= 0) {
      alert('请输入有效的金额')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/commission/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculateForm)
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        alert(`计算成功！\n生成 ${data.data.records.length} 条提成记录\n总提成: €${data.data.totalCommission.toFixed(2)}`)
        setShowCalculateModal(false)
        loadData()
        loadStats()
      } else {
        alert(data.msg || '计算失败')
      }
    } catch (error) {
      console.error('计算提成失败:', error)
      alert('计算提成失败')
    }
  }

  const handleCancelRecord = async (record: CommissionRecord) => {
    if (!confirm(`确定要取消提成记录"${record.recordNo}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/records/${record.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '手动取消' })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadData()
        loadStats()
      } else {
        alert(data.msg || '取消失败')
      }
    } catch (error) {
      console.error('取消失败:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: '待结算', color: 'text-amber-700', bg: 'bg-amber-100' },
      settled: { label: '已结算', color: 'text-green-700', bg: 'bg-green-100' },
      cancelled: { label: '已取消', color: 'text-gray-500', bg: 'bg-gray-100' }
    }
    return statusMap[status] || statusMap.pending
  }

  const getRuleTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      percentage: '百分比',
      fixed: '固定金额',
      tiered: '阶梯奖金'
    }
    return typeMap[type] || type
  }

  const getSourceTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      contract: '合同',
      order: '订单',
      payment: '回款'
    }
    return typeMap[type] || type
  }

  const columns: Column<CommissionRecord>[] = useMemo(() => [
    {
      key: 'recordNo',
      label: '记录编号',
      width: 140,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{record.recordNo}</div>
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
      key: 'customer',
      label: '客户',
      width: 150,
      render: (_value, record) => (
        <div>
          <div className="text-xs text-gray-900">{record.customerName || '-'}</div>
          <div className="text-[10px] text-gray-500">
            {CUSTOMER_LEVELS.find(l => l.value === record.customerLevel)?.label || record.customerLevel}
          </div>
        </div>
      )
    },
    {
      key: 'rule',
      label: '规则',
      width: 120,
      render: (_value, record) => (
        <div>
          <div className="text-xs text-gray-700">{record.ruleName || '-'}</div>
          <div className="text-[10px] text-gray-500">{getRuleTypeLabel(record.ruleType)}</div>
        </div>
      )
    },
    {
      key: 'baseAmount',
      label: '基数金额',
      width: 110,
      render: (_value, record) => (
        <span className="text-xs text-gray-600">{formatCurrency(record.baseAmount)}</span>
      )
    },
    {
      key: 'commissionAmount',
      label: '提成金额',
      width: 110,
      render: (_value, record) => (
        <span className="text-xs font-medium text-primary-600">
          {formatCurrency(record.commissionAmount)}
        </span>
      )
    },
    {
      key: 'source',
      label: '来源',
      width: 100,
      render: (_value, record) => (
        <div>
          <div className="text-xs text-gray-600">{getSourceTypeLabel(record.sourceType)}</div>
          <div className="text-[10px] text-gray-400">{record.sourceNo || '-'}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 80,
      render: (_value, record) => {
        const info = getStatusInfo(record.status)
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      width: 80,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          {record.status === 'pending' && (
            <button 
              onClick={() => handleCancelRecord(item)}
              className="px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 rounded"
            >
              取消
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

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/commission/records"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">总记录数</div>
              <div className="text-lg font-bold text-gray-900">{stats?.total.records || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">总提成</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(stats?.total.commission || 0)}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">待结算</div>
              <div className="text-lg font-bold text-amber-600">
                {formatCurrency(stats?.total.pendingCommission || 0)}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500">已结算</div>
              <div className="text-lg font-bold text-emerald-600">
                {formatCurrency(stats?.total.settledCommission || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索记录编号、客户..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

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

          <select
            value={filterSourceType}
            onChange={(e) => { setFilterSourceType(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {SOURCE_TYPES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowCalculateModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
        >
          <Calculator className="w-4 h-4" />
          手动计算
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
            共 {total} 条记录，第 {page} / {Math.ceil(total / pageSize)} 页
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
          </div>
        </div>
      )}

      {/* 手动计算弹窗 */}
      {showCalculateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">手动计算提成</h3>
              <button onClick={() => setShowCalculateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">业务员 *</label>
                  <select
                    value={calculateForm.salespersonId}
                    onChange={(e) => {
                      const user = users.find(u => u.id.toString() === e.target.value)
                      setCalculateForm({
                        ...calculateForm,
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
                  <label className="block text-xs text-gray-600 mb-1">客户级别</label>
                  <select
                    value={calculateForm.customerLevel}
                    onChange={(e) => setCalculateForm({...calculateForm, customerLevel: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {CUSTOMER_LEVELS.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户名称</label>
                  <input
                    type="text"
                    value={calculateForm.customerName}
                    onChange={(e) => setCalculateForm({...calculateForm, customerName: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="可选"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">来源类型 *</label>
                  <select
                    value={calculateForm.sourceType}
                    onChange={(e) => setCalculateForm({...calculateForm, sourceType: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="contract">合同</option>
                    <option value="order">订单</option>
                    <option value="payment">回款</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">来源单号</label>
                  <input
                    type="text"
                    value={calculateForm.sourceNo}
                    onChange={(e) => setCalculateForm({...calculateForm, sourceNo: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="合同/订单编号"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">提成基数</label>
                  <select
                    value={calculateForm.commissionBase}
                    onChange={(e) => setCalculateForm({...calculateForm, commissionBase: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="contract_amount">合同金额</option>
                    <option value="order_amount">订单金额</option>
                    <option value="profit">利润</option>
                    <option value="receivable">回款金额</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">金额 (EUR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={calculateForm.amount}
                  onChange={(e) => setCalculateForm({...calculateForm, amount: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="请输入金额"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <p>系统将根据当前启用的提成规则自动计算提成金额。</p>
                <p className="mt-1">如果有多条可叠加的规则，会生成多条提成记录。</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowCalculateModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCalculate}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                计算提成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
