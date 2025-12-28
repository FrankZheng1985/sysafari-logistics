import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Target, TrendingUp, 
  ChevronRight, Edit, Trash2, X
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'
import { formatDate } from '../utils/dateFormat'

const API_BASE = getApiBaseUrl()

interface Opportunity {
  id: string
  opportunityName: string
  customerId: string
  customerName: string
  contactName: string
  stage: string
  inquiryCount: number // 询价次数
  orderCount: number // 成交订单数
  conversionRate: number // 转化率
  expectedCloseDate: string | null
  source: string
  description: string
  assignedName: string
  lostReason: string
  createTime: string
  // 合同关联
  contractId: string | null
  contractNumber: string | null
  // 跟进记录
  followUpCount: number // 跟进次数
  lastFollowUpTime: string | null // 最后跟进时间
}

interface FollowUpRecord {
  id: string
  opportunityId: string
  followUpType: 'phone' | 'email' | 'visit' | 'meeting' | 'other'
  content: string
  nextFollowUpDate: string | null
  createdBy: string
  createTime: string
}

interface Contract {
  id: string
  contractNumber: string
  contractName: string
  status: string
}

interface OpportunityStats {
  total: number
  byStage: Record<string, number>
  totalInquiries: number // 总询价次数
  totalOrders: number // 总成交订单数
  winRate: string | number // 总转化率
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
  const [contracts, setContracts] = useState<Contract[]>([]) // 合同列表
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterStage, setFilterStage] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false) // 跟进记录弹窗
  const [followUpRecords, setFollowUpRecords] = useState<FollowUpRecord[]>([]) // 当前商机的跟进记录
  const [editingItem, setEditingItem] = useState<Opportunity | null>(null)
  const [formData, setFormData] = useState({
    opportunityName: '',
    customerId: '',
    customerName: '',
    stage: 'lead',
    inquiryCount: 0, // 询价次数
    orderCount: 0, // 成交订单数
    expectedCloseDate: '',
    source: '',
    description: '',
    contractId: '', // 关联合同
  })
  const [followUpForm, setFollowUpForm] = useState({
    followUpType: 'phone' as 'phone' | 'email' | 'visit' | 'meeting' | 'other',
    content: '',
    nextFollowUpDate: ''
  })

   
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchValue, filterStage])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterStage) params.append('stage', filterStage)

      const [oppRes, statsRes, custRes, contractRes] = await Promise.all([
        fetch(`${API_BASE}/api/opportunities?${params}`),
        fetch(`${API_BASE}/api/opportunities/stats`),
        fetch(`${API_BASE}/api/customers?pageSize=100`),
        fetch(`${API_BASE}/api/contracts?pageSize=100&status=approved`) // 只获取已签订的合同
      ])

      const [oppData, statsData, custData, contractData] = await Promise.all([
        oppRes.json(),
        statsRes.json(),
        custRes.json(),
        contractRes.json()
      ])
      
      if (oppData.errCode === 200) {
        setOpportunities(oppData.data.list || [])
        setTotal(oppData.data.total || 0)
      }
      if (statsData.errCode === 200) setStats(statsData.data)
      if (custData.errCode === 200) setCustomers(custData.data.list || [])
      if (contractData.errCode === 200) setContracts(contractData.data.list || [])
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
        inquiryCount: item.inquiryCount || 0,
        orderCount: item.orderCount || 0,
        expectedCloseDate: item.expectedCloseDate || '',
        source: item.source || '',
        description: item.description || '',
        contractId: item.contractId || ''
      })
    } else {
      setEditingItem(null)
      setFormData({
        opportunityName: '',
        customerId: '',
        customerName: '',
        stage: 'lead',
        inquiryCount: 0,
        orderCount: 0,
        expectedCloseDate: '',
        source: '',
        description: '',
        contractId: ''
      })
    }
    setShowModal(true)
  }

  // 打开跟进记录弹窗
  const handleOpenFollowUp = async (item: Opportunity) => {
    setEditingItem(item)
    setFollowUpForm({ followUpType: 'phone', content: '', nextFollowUpDate: '' })
    // 加载该商机的跟进记录
    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${item.id}/follow-ups`)
      const data = await response.json()
      if (data.errCode === 200) {
        setFollowUpRecords(data.data || [])
      }
    } catch (error) {
      console.error('加载跟进记录失败:', error)
    }
    setShowFollowUpModal(true)
  }

  // 提交跟进记录
  const handleSubmitFollowUp = async () => {
    if (!followUpForm.content) {
      alert('请输入跟进内容')
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${editingItem?.id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUpForm)
      })
      const data = await response.json()
      if (data.errCode === 200) {
        // 刷新跟进记录
        const res = await fetch(`${API_BASE}/api/opportunities/${editingItem?.id}/follow-ups`)
        const resData = await res.json()
        if (resData.errCode === 200) setFollowUpRecords(resData.data || [])
        setFollowUpForm({ followUpType: 'phone', content: '', nextFollowUpDate: '' })
        loadData() // 刷新列表更新跟进次数
      }
    } catch (error) {
      console.error('提交跟进记录失败:', error)
    }
  }

  const handleSubmit = async () => {
    if (!formData.opportunityName) {
      alert('请输入机会名称')
      return
    }

    try {
      const url = editingItem 
        ? `${API_BASE}/api/opportunities/${editingItem.id}`
        : `${API_BASE}/api/opportunities`
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
      // 如果是成交操作，使用专门的成交API（带合同校验）
      if (stage === 'closed_won') {
        const response = await fetch(`${API_BASE}/api/opportunities/${id}/close`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage })
        })

        const data = await response.json()
        if (data.errCode === 200) {
          alert('🎉 恭喜成交！')
          loadData()
        } else {
          // 显示具体的错误信息和引导
          if (data.data?.needGenerateContract) {
            if (confirm(`${data.msg}\n\n是否立即为该机会生成合同？`)) {
              await handleGenerateContract(id)
            }
          } else if (data.data?.needSign) {
            alert(`${data.msg}\n\n请前往【合同管理】页面上传已签署的合同文件。`)
          } else {
            alert(data.msg || '成交失败')
          }
        }
        return
      }

      // 其他阶段更新
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

  // 为销售机会生成合同
  const handleGenerateContract = async (opportunityId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/contracts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId })
      })

      const data = await response.json()
      if (data.errCode === 200) {
        alert(`✅ 合同已生成！\n\n合同编号：${data.data.contractNumber}\n\n请前往【合同管理】页面完成签署后再进行成交操作。`)
        loadData()
      } else {
        alert(data.msg || '生成合同失败')
      }
    } catch (error) {
      console.error('生成合同失败:', error)
      alert('生成合同失败')
    }
  }

  // 检查是否可以成交
  const handleCheckCanClose = async (item: Opportunity) => {
    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${item.id}/can-close`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        const result = data.data
        if (result.canClose) {
          // 可以成交，执行成交操作
          handleUpdateStage(item.id, 'closed_won')
        } else {
          // 不能成交，显示原因
          if (result.needGenerateContract) {
            if (confirm(`${result.reason}\n\n是否立即为该机会生成合同？`)) {
              await handleGenerateContract(item.id)
            }
          } else if (result.needSign) {
            alert(`${result.reason}\n\n请前往【合同管理】页面上传已签署的合同文件。`)
          } else {
            alert(result.reason)
          }
        }
      }
    } catch (error) {
      console.error('检查成交条件失败:', error)
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
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{record.opportunityName}</div>
          <div className="text-[10px] text-gray-500">{record.customerName || '-'}</div>
        </div>
      )
    },
    {
      key: 'stage',
      label: '阶段',
      width: 100,
      sorter: true,
      filters: [
        { text: '线索', value: 'lead' },
        { text: '资格确认', value: 'qualification' },
        { text: '方案报价', value: 'proposal' },
        { text: '谈判中', value: 'negotiation' },
        { text: '成交', value: 'closed_won' },
        { text: '失败', value: 'closed_lost' },
      ],
      onFilter: (value, record) => record.stage === value,
      render: (_value, record) => {
        const info = getStageInfo(record.stage)
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'inquiryCount',
      label: '询价次数',
      width: 80,
      sorter: (a, b) => (a.inquiryCount || 0) - (b.inquiryCount || 0),
      render: (_value, record) => (
        <span className="text-xs font-medium text-gray-900">
          {record.inquiryCount || 0} 次
        </span>
      )
    },
    {
      key: 'orderCount',
      label: '成交订单',
      width: 80,
      sorter: (a, b) => (a.orderCount || 0) - (b.orderCount || 0),
      render: (_value, record) => (
        <span className="text-xs font-medium text-green-600">
          {record.orderCount || 0} 单
        </span>
      )
    },
    {
      key: 'conversionRate',
      label: '转化率',
      width: 100,
      sorter: (a, b) => {
        const rateA = a.inquiryCount > 0 ? (a.orderCount / a.inquiryCount) : 0
        const rateB = b.inquiryCount > 0 ? (b.orderCount / b.inquiryCount) : 0
        return rateA - rateB
      },
      render: (_value, record) => {
        const rate = record.inquiryCount > 0 
          ? Math.round((record.orderCount / record.inquiryCount) * 100) 
          : 0
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${rate >= 50 ? 'bg-green-500' : rate >= 20 ? 'bg-amber-500' : 'bg-red-400'}`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-8">{rate}%</span>
          </div>
        )
      }
    },
    {
      key: 'expectedCloseDate',
      label: '预计成交',
      width: 100,
      sorter: (a, b) => {
        const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0
        const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0
        return dateA - dateB
      },
      render: (_value, record) => (
        <span className="text-xs text-gray-500">
          {formatDate(record.expectedCloseDate)}
        </span>
      )
    },
    {
      key: 'source',
      label: '来源',
      width: 80,
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <span className="text-xs text-gray-600">{record.source || '-'}</span>
      )
    },
    {
      key: 'followUpCount',
      label: '跟进',
      width: 80,
      sorter: (a, b) => (a.followUpCount || 0) - (b.followUpCount || 0),
      render: (_value, record) => (
        <div className="text-center">
          <div className="text-xs font-medium text-gray-900">{record.followUpCount || 0} 次</div>
          {record.lastFollowUpTime && (
            <div className="text-[10px] text-gray-400">{record.lastFollowUpTime.split(' ')[0]}</div>
          )}
        </div>
      )
    },
    {
      key: 'contractNumber',
      label: '关联合同',
      width: 100,
      sorter: true,
      render: (_value, record) => (
        record.contractNumber ? (
          <span className="text-xs text-primary-600 font-medium">{record.contractNumber}</span>
        ) : (
          <span className="text-xs text-gray-400">未关联</span>
        )
      )
    },
    {
      key: 'assignedName',
      label: '负责人',
      width: 80,
      sorter: true,
      filterable: true,
      render: (_value, record) => (
        <span className="text-xs text-gray-600">{record.assignedName || '-'}</span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 220,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          {/* 跟进按钮 */}
          <button
            onClick={() => handleOpenFollowUp(record)}
            className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            跟进
          </button>
          {record.stage !== 'closed_won' && record.stage !== 'closed_lost' && (
            <>
              <button
                onClick={() => {
                  const stages = ['lead', 'qualification', 'proposal', 'negotiation']
                  const currentIndex = stages.indexOf(record.stage)
                  if (currentIndex < stages.length - 1) {
                    handleUpdateStage(record.id, stages[currentIndex + 1])
                  }
                }}
                className="px-2 py-1 text-[10px] bg-primary-50 text-primary-600 rounded hover:bg-primary-100"
              >
                推进
              </button>
              <button
                onClick={() => handleCheckCanClose(record)}
                className="px-2 py-1 text-[10px] bg-green-50 text-green-600 rounded hover:bg-green-100"
              >
                成交
              </button>
              <button
                onClick={() => {
                  const reason = prompt('请输入失败原因：')
                  if (reason !== null) {
                    handleUpdateStage(record.id, 'closed_lost', reason)
                  }
                }}
                className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                失败
              </button>
            </>
          )}
          <button 
            onClick={() => handleOpenModal(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleDelete(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
            title="删除"
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
    { label: '提成规则', path: '/crm/commission/rules' },
    { label: '提成记录', path: '/crm/commission/records' },
    { label: '月度结算', path: '/crm/commission/settlements' },
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
              <Search className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">总询价次数</div>
              <div className="text-lg font-bold text-gray-900">{stats?.totalInquiries || 0} 次</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">总成交订单</div>
              <div className="text-lg font-bold text-gray-900">{stats?.totalOrders || 0} 单</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">总转化率</div>
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
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            title="筛选销售阶段"
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

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[560px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">{editingItem ? '编辑销售机会' : '新建销售机会'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded" title="关闭">
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
                    title="选择客户"
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
                    title="选择阶段"
                  >
                    <option value="lead">线索</option>
                    <option value="qualification">资格确认</option>
                    <option value="proposal">方案报价</option>
                    <option value="negotiation">谈判中</option>
                  </select>
                </div>
              </div>

              {/* 关联合同 - 成交前必须选择 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  关联合同 {formData.stage === 'closed_won' && <span className="text-red-500">* (成交必填)</span>}
                </label>
                <select
                  value={formData.contractId}
                  onChange={(e) => setFormData({...formData, contractId: e.target.value})}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                    formData.stage === 'closed_won' && !formData.contractId ? 'border-red-300' : ''
                  }`}
                  title="选择关联合同"
                >
                  <option value="">请选择已签订的合同</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{c.contractNumber} - {c.contractName}</option>
                  ))}
                </select>
                {contracts.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">暂无已签订的合同，请先在合同管理中创建并审批通过合同</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">询价次数</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.inquiryCount}
                    onChange={(e) => setFormData({...formData, inquiryCount: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">成交订单数</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.orderCount}
                    onChange={(e) => setFormData({...formData, orderCount: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="0"
                  />
                </div>
              </div>
              {/* 转化率显示 */}
              {(formData.inquiryCount > 0 || formData.orderCount > 0) && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">转化率</div>
                  <div className="text-lg font-bold text-primary-600">
                    {formData.inquiryCount > 0 
                      ? Math.round((formData.orderCount / formData.inquiryCount) * 100) 
                      : 0}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formData.orderCount} 单 / {formData.inquiryCount} 次询价
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">预计成交日期</label>
                  <DatePicker
                    value={formData.expectedCloseDate}
                    onChange={(value) => setFormData({...formData, expectedCloseDate: value})}
                    placeholder="选择预计成交日期"
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

      {/* 跟进记录弹窗 */}
      {showFollowUpModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">客户跟进记录</h3>
                <p className="text-xs text-gray-500 mt-1">{editingItem.opportunityName} - {editingItem.customerName}</p>
              </div>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 添加跟进记录表单 */}
              <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                <div className="text-xs font-medium text-blue-700">添加跟进记录</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">跟进方式</label>
                    <select
                      value={followUpForm.followUpType}
                      onChange={(e) => setFollowUpForm({...followUpForm, followUpType: e.target.value as any})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      title="选择跟进方式"
                    >
                      <option value="phone">电话</option>
                      <option value="email">邮件</option>
                      <option value="visit">拜访</option>
                      <option value="meeting">会议</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">下次跟进日期</label>
                    <DatePicker
                      value={followUpForm.nextFollowUpDate}
                      onChange={(value) => setFollowUpForm({...followUpForm, nextFollowUpDate: value})}
                      placeholder="选择下次跟进日期"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">跟进内容 *</label>
                  <textarea
                    value={followUpForm.content}
                    onChange={(e) => setFollowUpForm({...followUpForm, content: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                    rows={3}
                    placeholder="请输入跟进内容..."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitFollowUp}
                    className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    添加记录
                  </button>
                </div>
              </div>

              {/* 跟进记录列表 */}
              <div>
                <div className="text-xs font-medium text-gray-700 mb-3">历史跟进记录 ({followUpRecords.length})</div>
                {followUpRecords.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">暂无跟进记录</div>
                ) : (
                  <div className="space-y-3">
                    {followUpRecords.map((record) => (
                      <div key={record.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              record.followUpType === 'phone' ? 'bg-blue-100 text-blue-700' :
                              record.followUpType === 'email' ? 'bg-green-100 text-green-700' :
                              record.followUpType === 'visit' ? 'bg-purple-100 text-purple-700' :
                              record.followUpType === 'meeting' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {record.followUpType === 'phone' ? '电话' :
                               record.followUpType === 'email' ? '邮件' :
                               record.followUpType === 'visit' ? '拜访' :
                               record.followUpType === 'meeting' ? '会议' : '其他'}
                            </span>
                            <span className="text-[10px] text-gray-400">{record.createdBy}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{formatDate(record.createTime)}</span>
                        </div>
                        <p className="text-xs text-gray-700">{record.content}</p>
                        {record.nextFollowUpDate && (
                          <p className="text-[10px] text-amber-600 mt-2">下次跟进: {formatDate(record.nextFollowUpDate)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowFollowUpModal(false)}
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

