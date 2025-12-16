import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Target, TrendingUp, DollarSign, 
  ChevronRight, Edit, Trash2, X
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Opportunity {
  id: string
  opportunityName: string
  customerId: string
  customerName: string
  contactName: string
  stage: string
  expectedAmount: number
  probability: number
  expectedCloseDate: string | null
  source: string
  description: string
  assignedName: string
  lostReason: string
  createTime: string
}

interface OpportunityStats {
  total: number
  byStage: Record<string, number>
  pipelineValue: number
  wonValue: number
  winRate: string | number
}

interface Customer {
  id: string
  customerName: string
}

export default function CRMOpportunities() {
  const navigate = useNavigate()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [stats, setStats] = useState<OpportunityStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterStage, setFilterStage] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Opportunity | null>(null)
  const [formData, setFormData] = useState({
    opportunityName: '',
    customerId: '',
    customerName: '',
    stage: 'lead',
    expectedAmount: 0,
    probability: 20,
    expectedCloseDate: '',
    source: '',
    description: ''
  })

   
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, filterStage])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterStage) params.append('stage', filterStage)

      const [oppRes, statsRes, custRes] = await Promise.all([
        fetch(`${API_BASE}/api/opportunities?${params}`),
        fetch(`${API_BASE}/api/opportunities/stats`),
        fetch(`${API_BASE}/api/customers?pageSize=100`)
      ])

      const [oppData, statsData, custData] = await Promise.all([
        oppRes.json(),
        statsRes.json(),
        custRes.json()
      ])
      
      if (oppData.errCode === 200) {
        setOpportunities(oppData.data.list || [])
        setTotal(oppData.data.total || 0)
      }
      if (statsData.errCode === 200) setStats(statsData.data)
      if (custData.errCode === 200) setCustomers(custData.data.list || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (item?: Opportunity) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        opportunityName: item.opportunityName,
        customerId: item.customerId || '',
        customerName: item.customerName || '',
        stage: item.stage,
        expectedAmount: item.expectedAmount,
        probability: item.probability,
        expectedCloseDate: item.expectedCloseDate || '',
        source: item.source || '',
        description: item.description || ''
      })
    } else {
      setEditingItem(null)
      setFormData({
        opportunityName: '',
        customerId: '',
        customerName: '',
        stage: 'lead',
        expectedAmount: 0,
        probability: 20,
        expectedCloseDate: '',
        source: '',
        description: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.opportunityName) {
      alert('请输入机会名称')
      return
    }

    try {
      const url = editingItem 
        ? `/api/opportunities/${editingItem.id}`
        : '/api/opportunities'
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.errCode === 200) {
        setShowModal(false)
        loadData()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleUpdateStage = async (id: string, stage: string, lostReason?: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${id}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, lostReason })
      })

      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      }
    } catch (error) {
      console.error('更新阶段失败:', error)
    }
  }

  const handleDelete = async (item: Opportunity) => {
    if (!confirm(`确定要删除销售机会"${item.opportunityName}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${item.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadData()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value)
  }

  const getStageInfo = (stage: string) => {
    const stageMap: Record<string, { label: string; color: string; bg: string }> = {
      lead: { label: '线索', color: 'text-gray-700', bg: 'bg-gray-100' },
      qualification: { label: '资格确认', color: 'text-blue-700', bg: 'bg-blue-100' },
      proposal: { label: '方案报价', color: 'text-cyan-700', bg: 'bg-cyan-100' },
      negotiation: { label: '谈判中', color: 'text-amber-700', bg: 'bg-amber-100' },
      closed_won: { label: '成交', color: 'text-green-700', bg: 'bg-green-100' },
      closed_lost: { label: '失败', color: 'text-red-700', bg: 'bg-red-100' }
    }
    return stageMap[stage] || stageMap.lead
  }

  const columns: Column<Opportunity>[] = useMemo(() => [
    {
      key: 'opportunityName',
      label: '机会名称',
      width: 200,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{item.opportunityName}</div>
          <div className="text-[10px] text-gray-500">{item.customerName || '-'}</div>
        </div>
      )
    },
    {
      key: 'stage',
      label: '阶段',
      width: 100,
      render: (item) => {
        const info = getStageInfo(item.stage)
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'expectedAmount',
      label: '预期金额',
      width: 120,
      render: (item) => (
        <span className="text-xs font-medium text-gray-900">
          {formatCurrency(item.expectedAmount)}
        </span>
      )
    },
    {
      key: 'probability',
      label: '成交概率',
      width: 100,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${item.probability >= 70 ? 'bg-green-500' : item.probability >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${item.probability}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-8">{item.probability}%</span>
        </div>
      )
    },
    {
      key: 'expectedCloseDate',
      label: '预计成交',
      width: 100,
      render: (item) => (
        <span className="text-xs text-gray-500">
          {item.expectedCloseDate || '-'}
        </span>
      )
    },
    {
      key: 'source',
      label: '来源',
      width: 80,
      render: (item) => (
        <span className="text-xs text-gray-600">{item.source || '-'}</span>
      )
    },
    {
      key: 'assignedName',
      label: '负责人',
      width: 80,
      render: (item) => (
        <span className="text-xs text-gray-600">{item.assignedName || '-'}</span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 180,
      render: (item) => (
        <div className="flex items-center gap-1">
          {item.stage !== 'closed_won' && item.stage !== 'closed_lost' && (
            <>
              <button
                onClick={() => {
                  const stages = ['lead', 'qualification', 'proposal', 'negotiation']
                  const currentIndex = stages.indexOf(item.stage)
                  if (currentIndex < stages.length - 1) {
                    handleUpdateStage(item.id, stages[currentIndex + 1])
                  }
                }}
                className="px-2 py-1 text-[10px] bg-primary-50 text-primary-600 rounded hover:bg-primary-100"
              >
                推进
              </button>
              <button
                onClick={() => handleUpdateStage(item.id, 'closed_won')}
                className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
              >
                成交
              </button>
              <button
                onClick={() => {
                  const reason = prompt('请输入失败原因：')
                  if (reason !== null) {
                    handleUpdateStage(item.id, 'closed_lost', reason)
                  }
                }}
                className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                失败
              </button>
            </>
          )}
          <button 
            onClick={() => handleOpenModal(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleDelete(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/opportunities"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">总机会数</div>
              <div className="text-lg font-bold text-gray-900">{stats?.total || 0}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">管道价值</div>
              <div className="text-lg font-bold text-gray-900 truncate" title={formatCurrency(stats?.pipelineValue || 0)}>{formatCurrency(stats?.pipelineValue || 0)}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">成交金额</div>
              <div className="text-lg font-bold text-gray-900 truncate" title={formatCurrency(stats?.wonValue || 0)}>{formatCurrency(stats?.wonValue || 0)}</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">转化率</div>
              <div className="text-lg font-bold text-gray-900">{stats?.winRate || '0%'}</div>
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
              placeholder="搜索机会名称、客户..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部阶段</option>
            <option value="lead">线索</option>
            <option value="qualification">资格确认</option>
            <option value="proposal">方案报价</option>
            <option value="negotiation">谈判中</option>
            <option value="closed_won">成交</option>
            <option value="closed_lost">失败</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          新建机会
        </button>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={opportunities}
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

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[560px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">{editingItem ? '编辑销售机会' : '新建销售机会'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">机会名称 *</label>
                <input
                  type="text"
                  value={formData.opportunityName}
                  onChange={(e) => setFormData({...formData, opportunityName: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="请输入机会名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">关联客户</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value)
                      setFormData({
                        ...formData, 
                        customerId: e.target.value,
                        customerName: customer?.customerName || ''
                      })
                    }}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">请选择客户</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customerName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">阶段</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({...formData, stage: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="lead">线索</option>
                    <option value="qualification">资格确认</option>
                    <option value="proposal">方案报价</option>
                    <option value="negotiation">谈判中</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">预期金额</label>
                  <input
                    type="number"
                    value={formData.expectedAmount}
                    onChange={(e) => setFormData({...formData, expectedAmount: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">成交概率 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({...formData, probability: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">预计成交日期</label>
                  <input
                    type="date"
                    value={formData.expectedCloseDate}
                    onChange={(e) => setFormData({...formData, expectedCloseDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">来源</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({...formData, source: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="如：网站、转介绍、展会"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={3}
                  placeholder="请输入机会描述"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

