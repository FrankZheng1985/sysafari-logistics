import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, X, Settings, 
  Percent, DollarSign, TrendingUp, ToggleLeft, ToggleRight,
  AlertTriangle, Info
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface CommissionTier {
  id?: number
  tierLevel: number
  minCount: number
  maxCount: number | null
  bonusAmount: number // 总奖金（兼容旧数据）
  supervisorBonus: number // 主管奖金
  salesBonus: number // 跟单奖金
  documentBonus: number // 单证奖金
}

interface CommissionRule {
  id: number
  ruleName: string
  customerLevel: string
  ruleType: 'percentage' | 'fixed' | 'tiered'
  commissionBase: string
  commissionRate: number
  fixedAmount: number // 总固定金额（兼容旧数据）
  fixedSupervisorAmount: number // 主管固定奖金
  fixedSalesAmount: number // 跟单固定奖金
  fixedDocumentAmount: number // 单证固定奖金
  minBaseAmount: number
  maxCommission: number | null
  isStackable: boolean
  applyTo: string
  isActive: boolean
  priority: number
  notes: string
  tiers?: CommissionTier[]
  createdAt: string
}

// 惩罚规则接口
interface PenaltyRule {
  id: number
  penaltyName: string
  penaltyType: 'inspection' | 'mistake' | 'loss' // 查验/工作失误/经济损失
  totalAmount: number // 总惩罚金额
  supervisorPenalty: number // 主管惩罚
  salesPenalty: number // 跟单惩罚
  documentPenalty: number // 单证惩罚
  lossPercentage: number // 经济损失承担百分比
  maxPenaltyRate: number // 最高惩罚比例（不超过当月奖金）
  isActive: boolean
  notes: string
  createdAt: string
}

// 方案配置
const SCHEME_CONFIG = {
  startDate: '2025-12-01', // 方案开始日期
  trialPeriod: 3, // 惩罚试用期（月）- 期间只沟通不惩罚
  schemeDuration: { min: 6, max: 12 }, // 方案试运行期（月）
}

// 客户级别选项
const CUSTOMER_LEVELS = [
  { value: 'all', label: '全部客户' },
  { value: 'vip', label: 'VIP客户' },
  { value: 'important', label: '重要客户' },
  { value: 'normal', label: '普通客户' },
  { value: 'potential', label: '潜在客户' }
]

// 规则类型选项
const RULE_TYPES = [
  { value: 'percentage', label: '百分比提成', icon: Percent },
  { value: 'fixed', label: '固定金额', icon: DollarSign },
  { value: 'tiered', label: '阶梯奖金', icon: TrendingUp }
]

// 惩罚类型选项
const PENALTY_TYPES = [
  { value: 'inspection', label: '查验惩罚', description: '查验一条柜的惩罚' },
  { value: 'mistake', label: '工作失误', description: '一般工作失误的惩罚' },
  { value: 'loss', label: '经济损失', description: '直接经济损失按比例承担' }
]

// 提成基数选项
const COMMISSION_BASES = [
  { value: 'contract_amount', label: '合同金额' },
  { value: 'order_amount', label: '订单金额' },
  { value: 'profit', label: '利润' },
  { value: 'receivable', label: '回款金额' }
]

// 适用范围选项
const APPLY_TO_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'contract', label: '合同' },
  { value: 'order', label: '订单' },
  { value: 'payment', label: '回款' }
]

// 计算试用期状态
const getTrialStatus = () => {
  const startDate = new Date(SCHEME_CONFIG.startDate)
  const today = new Date()
  const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth())
  
  if (today < startDate) {
    return { status: 'not_started', message: '方案尚未开始', inPenaltyTrial: false }
  } else if (monthsDiff < SCHEME_CONFIG.trialPeriod) {
    const remaining = SCHEME_CONFIG.trialPeriod - monthsDiff
    return { 
      status: 'penalty_trial', 
      message: `惩罚试用期（剩余${remaining}个月）- 发生失误仅沟通，不直接惩罚`, 
      inPenaltyTrial: true 
    }
  } else if (monthsDiff < SCHEME_CONFIG.schemeDuration.max) {
    return { 
      status: 'running', 
      message: `方案试运行中（${monthsDiff}/${SCHEME_CONFIG.schemeDuration.min}-${SCHEME_CONFIG.schemeDuration.max}个月）`, 
      inPenaltyTrial: false 
    }
  } else {
    return { status: 'review', message: '方案试运行期已满，请评估是否调整或延续', inPenaltyTrial: false }
  }
}

export default function CRMCommissionRules() {
  const navigate = useNavigate()
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'reward' | 'penalty'>('reward') // 奖励/惩罚切换
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null)
  
  // 惩罚规则状态
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([])
  const [showPenaltyModal, setShowPenaltyModal] = useState(false)
  const [editingPenalty, setEditingPenalty] = useState<PenaltyRule | null>(null)
  
  // 获取试用期状态
  const trialStatus = getTrialStatus()
  
  // 表单数据
  const [formData, setFormData] = useState({
    ruleName: '',
    customerLevel: 'all',
    ruleType: 'percentage' as 'percentage' | 'fixed' | 'tiered',
    commissionBase: 'contract_amount',
    commissionRate: 0,
    fixedAmount: 0,
    fixedSupervisorAmount: 0, // 主管固定奖金
    fixedSalesAmount: 0, // 跟单固定奖金
    fixedDocumentAmount: 0, // 单证固定奖金
    minBaseAmount: 0,
    maxCommission: null as number | null,
    isStackable: true,
    applyTo: 'all',
    isActive: true,
    priority: 0,
    notes: '',
    tiers: [] as CommissionTier[]
  })
  
  // 惩罚规则表单
  const [penaltyForm, setPenaltyForm] = useState({
    penaltyName: '',
    penaltyType: 'inspection' as 'inspection' | 'mistake' | 'loss',
    totalAmount: 0,
    supervisorPenalty: 0,
    salesPenalty: 0,
    documentPenalty: 0,
    lossPercentage: 30, // 经济损失承担30%
    maxPenaltyRate: 100, // 惩罚不超过当月奖金的100%
    isActive: true,
    notes: ''
  })

  const tabs = [
    { label: '提成规则', path: '/finance/commission/rules' },
    { label: '提成记录', path: '/finance/commission/records' },
    { label: '惩罚记录', path: '/finance/commission/penalties' },
    { label: '月度结算', path: '/finance/commission/settlements' }
  ]

  useEffect(() => {
    loadRules()
    loadPenaltyRules()
  }, [page, pageSize, filterType])

  const loadRules = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (filterType) params.append('ruleType', filterType)

      const response = await fetch(`${API_BASE}/api/commission/rules?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setRules(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载提成规则失败:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 加载惩罚规则
  const loadPenaltyRules = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/penalty-rules`)
      const data = await response.json()
      if (data.errCode === 200) {
        setPenaltyRules(data.data || [])
      }
    } catch (error) {
      console.error('加载惩罚规则失败:', error)
      // 设置默认惩罚规则（如果API未实现）
      setPenaltyRules([
        {
          id: 1,
          penaltyName: '查验惩罚',
          penaltyType: 'inspection',
          totalAmount: 500,
          supervisorPenalty: 100,
          salesPenalty: 100,
          documentPenalty: 300,
          lossPercentage: 0,
          maxPenaltyRate: 100,
          isActive: true,
          notes: '查验一条柜的惩罚金额',
          createdAt: '2025-12-01'
        },
        {
          id: 2,
          penaltyName: '工作失误',
          penaltyType: 'mistake',
          totalAmount: 50,
          supervisorPenalty: 15,
          salesPenalty: 15,
          documentPenalty: 20,
          lossPercentage: 0,
          maxPenaltyRate: 100,
          isActive: true,
          notes: '一般工作失误每次惩罚',
          createdAt: '2025-12-01'
        },
        {
          id: 3,
          penaltyName: '直接经济损失',
          penaltyType: 'loss',
          totalAmount: 0,
          supervisorPenalty: 0,
          salesPenalty: 0,
          documentPenalty: 0,
          lossPercentage: 30,
          maxPenaltyRate: 100,
          isActive: true,
          notes: '直接经济损失承担30%，从当月奖金或工资扣除',
          createdAt: '2025-12-01'
        }
      ])
    }
  }
  
  // 打开惩罚规则弹窗
  const handleOpenPenaltyModal = (penalty?: PenaltyRule) => {
    if (penalty) {
      setEditingPenalty(penalty)
      setPenaltyForm({
        penaltyName: penalty.penaltyName,
        penaltyType: penalty.penaltyType,
        totalAmount: penalty.totalAmount,
        supervisorPenalty: penalty.supervisorPenalty,
        salesPenalty: penalty.salesPenalty,
        documentPenalty: penalty.documentPenalty,
        lossPercentage: penalty.lossPercentage,
        maxPenaltyRate: penalty.maxPenaltyRate,
        isActive: penalty.isActive,
        notes: penalty.notes
      })
    } else {
      setEditingPenalty(null)
      setPenaltyForm({
        penaltyName: '',
        penaltyType: 'inspection',
        totalAmount: 0,
        supervisorPenalty: 0,
        salesPenalty: 0,
        documentPenalty: 0,
        lossPercentage: 30,
        maxPenaltyRate: 100,
        isActive: true,
        notes: ''
      })
    }
    setShowPenaltyModal(true)
  }
  
  // 提交惩罚规则
  const handleSubmitPenalty = async () => {
    if (!penaltyForm.penaltyName) {
      alert('请输入惩罚名称')
      return
    }
    
    try {
      const url = editingPenalty 
        ? `${API_BASE}/api/commission/penalty-rules/${editingPenalty.id}`
        : `${API_BASE}/api/commission/penalty-rules`
      const method = editingPenalty ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(penaltyForm)
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        setShowPenaltyModal(false)
        loadPenaltyRules()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存惩罚规则失败:', error)
      alert('保存失败，请重试')
    }
  }
  
  // 删除惩罚规则
  const handleDeletePenalty = async (id: number) => {
    if (!confirm('确定要删除这条惩罚规则吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/commission/penalty-rules/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadPenaltyRules()
      }
    } catch (error) {
      console.error('删除惩罚规则失败:', error)
    }
  }

  const handleOpenModal = (rule?: CommissionRule) => {
    if (rule) {
      setEditingRule(rule)
      setFormData({
        ruleName: rule.ruleName,
        customerLevel: rule.customerLevel || 'all',
        ruleType: rule.ruleType,
        commissionBase: rule.commissionBase || 'contract_amount',
        commissionRate: rule.commissionRate || 0,
        fixedAmount: rule.fixedAmount || 0,
        fixedSupervisorAmount: rule.fixedSupervisorAmount || 0,
        fixedSalesAmount: rule.fixedSalesAmount || 0,
        fixedDocumentAmount: rule.fixedDocumentAmount || 0,
        minBaseAmount: rule.minBaseAmount || 0,
        maxCommission: rule.maxCommission,
        isStackable: rule.isStackable,
        applyTo: rule.applyTo || 'all',
        isActive: rule.isActive,
        priority: rule.priority || 0,
        notes: rule.notes || '',
        tiers: rule.tiers || []
      })
    } else {
      setEditingRule(null)
      setFormData({
        ruleName: '',
        customerLevel: 'all',
        ruleType: 'percentage',
        commissionBase: 'contract_amount',
        commissionRate: 0,
        fixedAmount: 0,
        fixedSupervisorAmount: 0,
        fixedSalesAmount: 0,
        fixedDocumentAmount: 0,
        minBaseAmount: 0,
        maxCommission: null,
        isStackable: true,
        applyTo: 'all',
        isActive: true,
        priority: 0,
        notes: '',
        tiers: []
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.ruleName) {
      alert('请输入规则名称')
      return
    }

    try {
      const url = editingRule 
        ? `${API_BASE}/api/commission/rules/${editingRule.id}`
        : `${API_BASE}/api/commission/rules`
      const method = editingRule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.errCode === 200) {
        setShowModal(false)
        loadRules()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleDelete = async (rule: CommissionRule) => {
    if (!confirm(`确定要删除规则"${rule.ruleName}"吗？`)) return

    try {
      const response = await fetch(`${API_BASE}/api/commission/rules/${rule.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadRules()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const handleToggleActive = async (rule: CommissionRule) => {
    try {
      const response = await fetch(`${API_BASE}/api/commission/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadRules()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  // 添加阶梯
  const addTier = () => {
    const newTier: CommissionTier = {
      tierLevel: formData.tiers.length + 1,
      minCount: formData.tiers.length > 0 
        ? (formData.tiers[formData.tiers.length - 1].maxCount || 0) + 1 
        : 1,
      maxCount: null,
      bonusAmount: 0,
      supervisorBonus: 0, // 主管奖金
      salesBonus: 0, // 跟单奖金
      documentBonus: 0 // 单证奖金
    }
    setFormData({ ...formData, tiers: [...formData.tiers, newTier] })
  }

  // 更新阶梯
  const updateTier = (index: number, field: keyof CommissionTier, value: number | null) => {
    const newTiers = [...formData.tiers]
    newTiers[index] = { ...newTiers[index], [field]: value }
    setFormData({ ...formData, tiers: newTiers })
  }

  // 删除阶梯
  const removeTier = (index: number) => {
    const newTiers = formData.tiers.filter((_, i) => i !== index)
    // 重新编号
    newTiers.forEach((tier, i) => { tier.tierLevel = i + 1 })
    setFormData({ ...formData, tiers: newTiers })
  }

  const getRuleTypeInfo = (type: string) => {
    const typeInfo: Record<string, { label: string; color: string; bg: string }> = {
      percentage: { label: '百分比', color: 'text-blue-700', bg: 'bg-blue-100' },
      fixed: { label: '固定金额', color: 'text-green-700', bg: 'bg-green-100' },
      tiered: { label: '阶梯奖金', color: 'text-purple-700', bg: 'bg-purple-100' }
    }
    return typeInfo[type] || typeInfo.percentage
  }

  const getCustomerLevelLabel = (level: string) => {
    const found = CUSTOMER_LEVELS.find(l => l.value === level)
    return found ? found.label : level
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value)
  }

  const columns: Column<CommissionRule>[] = useMemo(() => [
    {
      key: 'ruleName',
      label: '规则名称',
      width: 180,
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{record.ruleName}</div>
          <div className="text-[10px] text-gray-500">优先级: {record.priority}</div>
        </div>
      )
    },
    {
      key: 'ruleType',
      label: '类型',
      width: 100,
      render: (_value, record) => {
        const info = getRuleTypeInfo(record.ruleType)
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${info.bg} ${info.color}`}>
            {info.label}
          </span>
        )
      }
    },
    {
      key: 'customerLevel',
      label: '客户级别',
      width: 100,
      render: (_value, record) => (
        <span className="text-xs text-gray-600">
          {getCustomerLevelLabel(record.customerLevel)}
        </span>
      )
    },
    {
      key: 'config',
      label: '配置',
      width: 200,
      render: (_value, record) => {
        if (record.ruleType === 'percentage') {
          return (
            <div className="text-xs">
              <span className="text-primary-600 font-medium">{record.commissionRate}%</span>
              <span className="text-gray-400 ml-1">
                ({COMMISSION_BASES.find(b => b.value === record.commissionBase)?.label || record.commissionBase})
              </span>
            </div>
          )
        } else if (record.ruleType === 'fixed') {
          return (
            <span className="text-xs text-green-600 font-medium">
              {formatCurrency(record.fixedAmount)}/单
            </span>
          )
        } else if (record.ruleType === 'tiered' && record.tiers) {
          return (
            <div className="text-[10px] text-gray-600">
              {record.tiers.slice(0, 2).map((tier, i) => (
                <span key={i}>
                  {tier.minCount}-{tier.maxCount || '∞'}单: {formatCurrency(tier.bonusAmount)}
                  {i < Math.min(record.tiers!.length - 1, 1) && ', '}
                </span>
              ))}
              {record.tiers.length > 2 && <span>...</span>}
            </div>
          )
        }
        return '-'
      }
    },
    {
      key: 'isStackable',
      label: '可叠加',
      width: 70,
      render: (_value, record) => (
        <span className={`text-xs ${record.isStackable ? 'text-green-600' : 'text-gray-400'}`}>
          {record.isStackable ? '是' : '否'}
        </span>
      )
    },
    {
      key: 'isActive',
      label: '状态',
      width: 80,
      render: (_value, record) => (
        <button
          onClick={() => handleToggleActive(record)}
          className={`flex items-center gap-1 text-xs ${record.isActive ? 'text-green-600' : 'text-gray-400'}`}
        >
          {record.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {record.isActive ? '启用' : '禁用'}
        </button>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 100,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
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
  ], [])

  // 按类型分组显示
  const filteredRules = searchValue 
    ? rules.filter(r => r.ruleName.toLowerCase().includes(searchValue.toLowerCase()))
    : rules

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="提成管理"
        tabs={tabs}
        activeTab="/finance/commission/rules"
        onTabChange={(path) => navigate(path)}
      />

      {/* 方案试运行提示 */}
      <div className={`p-3 rounded-lg flex items-center gap-3 ${
        trialStatus.status === 'penalty_trial' ? 'bg-amber-50 border border-amber-200' :
        trialStatus.status === 'review' ? 'bg-red-50 border border-red-200' :
        'bg-blue-50 border border-blue-200'
      }`}>
        <Info className={`w-5 h-5 flex-shrink-0 ${
          trialStatus.status === 'penalty_trial' ? 'text-amber-600' :
          trialStatus.status === 'review' ? 'text-red-600' :
          'text-blue-600'
        }`} />
        <div className="flex-1">
          <div className={`text-sm font-medium ${
            trialStatus.status === 'penalty_trial' ? 'text-amber-800' :
            trialStatus.status === 'review' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {trialStatus.message}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            方案开始日期: {SCHEME_CONFIG.startDate} | 惩罚试用期: {SCHEME_CONFIG.trialPeriod}个月 | 
            方案试运行: {SCHEME_CONFIG.schemeDuration.min}-{SCHEME_CONFIG.schemeDuration.max}个月
          </div>
        </div>
      </div>

      {/* 奖励/惩罚切换Tab */}
      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
        <button
          onClick={() => setActiveTab('reward')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'reward' 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          奖励规则
        </button>
        <button
          onClick={() => setActiveTab('penalty')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'penalty' 
              ? 'bg-red-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          惩罚规则
          {trialStatus.inPenaltyTrial && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded">试用期</span>
          )}
        </button>
      </div>

      {/* 奖励规则区域 */}
      {activeTab === 'reward' && (
        <>
          {/* 工具栏 */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Settings className="w-4 h-4" />
                <span>提成规则配置</span>
              </div>
              
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索规则名称..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadRules()}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">全部类型</option>
                {RULE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              新建规则
            </button>
          </div>

          {/* 数据表格 */}
          <DataTable
            columns={columns}
            data={filteredRules}
            loading={loading}
            rowKey="id"
          />
        </>
      )}

      {/* 惩罚规则区域 */}
      {activeTab === 'penalty' && (
        <>
          {/* 试用期提醒 */}
          {trialStatus.inPenaltyTrial && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">惩罚规则试用期</span>
              </div>
              <p className="text-sm text-amber-700 mt-2">
                当前处于惩罚规则试用期（{SCHEME_CONFIG.trialPeriod}个月），期间发生失误将进行沟通，不直接执行惩罚。
                试用期结束后将正式执行惩罚规则。
              </p>
            </div>
          )}

          {/* 惩罚规则工具栏 */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>惩罚规则配置</span>
            </div>

            <button
              onClick={() => handleOpenPenaltyModal()}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
            >
              <Plus className="w-4 h-4" />
              新建惩罚规则
            </button>
          </div>

          {/* 惩罚规则列表 */}
          <div className="grid gap-4">
            {penaltyRules.map((penalty) => (
              <div key={penalty.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      penalty.penaltyType === 'inspection' ? 'bg-red-100' :
                      penalty.penaltyType === 'mistake' ? 'bg-amber-100' :
                      'bg-purple-100'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        penalty.penaltyType === 'inspection' ? 'text-red-600' :
                        penalty.penaltyType === 'mistake' ? 'text-amber-600' :
                        'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{penalty.penaltyName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          penalty.penaltyType === 'inspection' ? 'bg-red-100 text-red-700' :
                          penalty.penaltyType === 'mistake' ? 'bg-amber-100 text-amber-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {PENALTY_TYPES.find(t => t.value === penalty.penaltyType)?.label}
                        </span>
                        {!penalty.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">已禁用</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{penalty.notes}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPenaltyModal(penalty)}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePenalty(penalty.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 惩罚金额明细 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  {penalty.penaltyType === 'loss' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">经济损失承担比例</span>
                        <span className="font-bold text-purple-600">{penalty.lossPercentage}%</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        从当月奖金或工资中扣除，惩罚金额不超过当月奖金的 {penalty.maxPenaltyRate}%
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">总惩罚金额</span>
                        <span className="font-bold text-red-600">¥{penalty.totalAmount}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                        <div className="text-center">
                          <div className="text-xs text-gray-500">主管</div>
                          <div className="text-sm font-medium text-gray-900">¥{penalty.supervisorPenalty}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">跟单</div>
                          <div className="text-sm font-medium text-gray-900">¥{penalty.salesPenalty}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">单证</div>
                          <div className="text-sm font-medium text-gray-900">¥{penalty.documentPenalty}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {penaltyRules.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>暂无惩罚规则</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">
            共 {total} 条规则
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
          <div className="bg-white rounded-lg w-[640px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">
                {editingRule ? '编辑提成规则' : '新建提成规则'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">规则名称 *</label>
                  <input
                    type="text"
                    value={formData.ruleName}
                    onChange={(e) => setFormData({...formData, ruleName: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入规则名称"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">优先级</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="数字越大越优先"
                  />
                </div>
              </div>

              {/* 规则类型选择 */}
              <div>
                <label className="block text-xs text-gray-600 mb-2">规则类型 *</label>
                <div className="flex gap-3">
                  {RULE_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({...formData, ruleType: type.value as typeof formData.ruleType})}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                        formData.ruleType === type.value 
                          ? 'border-primary-500 bg-primary-50 text-primary-700' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <type.icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 客户级别和适用范围 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">适用客户级别</label>
                  <select
                    value={formData.customerLevel}
                    onChange={(e) => setFormData({...formData, customerLevel: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {CUSTOMER_LEVELS.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">适用范围</label>
                  <select
                    value={formData.applyTo}
                    onChange={(e) => setFormData({...formData, applyTo: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {APPLY_TO_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 百分比提成配置 */}
              {formData.ruleType === 'percentage' && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-4">
                  <div className="text-xs font-medium text-blue-700">百分比提成配置</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">提成基数</label>
                      <select
                        value={formData.commissionBase}
                        onChange={(e) => setFormData({...formData, commissionBase: e.target.value})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        {COMMISSION_BASES.map(base => (
                          <option key={base.value} value={base.value}>{base.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">提成比例 (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({...formData, commissionRate: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">最低起算金额</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.minBaseAmount}
                        onChange={(e) => setFormData({...formData, minBaseAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="0表示无限制"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">提成封顶金额</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.maxCommission || ''}
                        onChange={(e) => setFormData({...formData, maxCommission: e.target.value ? parseFloat(e.target.value) : null})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="留空表示无上限"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 固定金额配置 - 按角色分配 */}
              {formData.ruleType === 'fixed' && (
                <div className="p-4 bg-green-50 rounded-lg space-y-4">
                  <div className="text-xs font-medium text-green-700">固定金额配置 (每单奖金按角色分配)</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">主管奖金 (CNY)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.fixedSupervisorAmount}
                        onChange={(e) => setFormData({...formData, fixedSupervisorAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="主管每单奖金"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">跟单奖金 (CNY)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.fixedSalesAmount}
                        onChange={(e) => setFormData({...formData, fixedSalesAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="跟单每单奖金"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">单证奖金 (CNY)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.fixedDocumentAmount}
                        onChange={(e) => setFormData({...formData, fixedDocumentAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="单证每单奖金"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    合计: ¥{((formData.fixedSupervisorAmount || 0) + (formData.fixedSalesAmount || 0) + (formData.fixedDocumentAmount || 0)).toFixed(2)}/单
                  </div>
                </div>
              )}

              {/* 阶梯奖金配置 - 按角色分配 */}
              {formData.ruleType === 'tiered' && (
                <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-purple-700">阶梯奖金配置 (按角色分配)</div>
                    <button
                      type="button"
                      onClick={addTier}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      <Plus className="w-3 h-3" />
                      添加阶梯
                    </button>
                  </div>
                  
                  {formData.tiers.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-500">
                      点击"添加阶梯"配置阶梯奖金
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.tiers.map((tier, index) => (
                        <div key={index} className="bg-white p-3 rounded border border-purple-200">
                          {/* 阶梯条件行 */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-medium text-purple-700 w-16">第{tier.tierLevel}阶</span>
                            <input
                              type="number"
                              min="1"
                              value={tier.minCount}
                              onChange={(e) => updateTier(index, 'minCount', parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 text-xs border rounded"
                              placeholder="最小"
                            />
                            <span className="text-xs text-gray-400">-</span>
                            <input
                              type="number"
                              min={tier.minCount}
                              value={tier.maxCount || ''}
                              onChange={(e) => updateTier(index, 'maxCount', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-20 px-2 py-1 text-xs border rounded"
                              placeholder="无上限"
                            />
                            <span className="text-xs text-gray-400">单</span>
                            <div className="flex-1" />
                            <button
                              type="button"
                              onClick={() => removeTier(index)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {/* 奖金分配行 */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 w-10">主管:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tier.supervisorBonus || 0}
                                onChange={(e) => updateTier(index, 'supervisorBonus', parseFloat(e.target.value) || 0)}
                                className="flex-1 px-2 py-1 text-xs border rounded"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-400">CNY/单</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 w-10">跟单:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tier.salesBonus || 0}
                                onChange={(e) => updateTier(index, 'salesBonus', parseFloat(e.target.value) || 0)}
                                className="flex-1 px-2 py-1 text-xs border rounded"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-400">CNY/单</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 w-10">单证:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tier.documentBonus || 0}
                                onChange={(e) => updateTier(index, 'documentBonus', parseFloat(e.target.value) || 0)}
                                className="flex-1 px-2 py-1 text-xs border rounded"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-400">CNY/单</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-2 text-right">
                            合计: ¥{((tier.supervisorBonus || 0) + (tier.salesBonus || 0) + (tier.documentBonus || 0)).toFixed(2)}/单
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 其他选项 */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isStackable}
                    onChange={(e) => setFormData({...formData, isStackable: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">可与其他规则叠加</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-600">立即启用</span>
                </label>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={2}
                  placeholder="规则说明..."
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

      {/* 惩罚规则编辑弹窗 */}
      {showPenaltyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  {editingPenalty ? '编辑惩罚规则' : '新建惩罚规则'}
                </h3>
              </div>
              <button
                onClick={() => setShowPenaltyModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 基本信息 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">惩罚名称 *</label>
                <input
                  type="text"
                  value={penaltyForm.penaltyName}
                  onChange={(e) => setPenaltyForm({...penaltyForm, penaltyName: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  placeholder="如：查验惩罚、工作失误等"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">惩罚类型</label>
                <select
                  value={penaltyForm.penaltyType}
                  onChange={(e) => setPenaltyForm({...penaltyForm, penaltyType: e.target.value as any})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                >
                  {PENALTY_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label} - {t.description}</option>
                  ))}
                </select>
              </div>

              {/* 根据惩罚类型显示不同配置 */}
              {penaltyForm.penaltyType === 'loss' ? (
                <div className="p-4 bg-purple-50 rounded-lg space-y-4">
                  <div className="text-xs font-medium text-purple-700">经济损失配置</div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">损失承担比例 (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={penaltyForm.lossPercentage}
                      onChange={(e) => setPenaltyForm({...penaltyForm, lossPercentage: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">直接经济损失工作失误，承担经济损失金额的此比例</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">最高惩罚比例 (% 当月奖金)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={penaltyForm.maxPenaltyRate}
                      onChange={(e) => setPenaltyForm({...penaltyForm, maxPenaltyRate: parseInt(e.target.value) || 100})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">惩罚金额不能大于当月奖金金额的此比例</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50 rounded-lg space-y-4">
                  <div className="text-xs font-medium text-red-700">惩罚金额配置 (按角色分配)</div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">总惩罚金额 (CNY)</label>
                    <input
                      type="number"
                      min="0"
                      value={penaltyForm.totalAmount}
                      onChange={(e) => {
                        const total = parseFloat(e.target.value) || 0
                        setPenaltyForm({...penaltyForm, totalAmount: total})
                      }}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">主管 (CNY)</label>
                      <input
                        type="number"
                        min="0"
                        value={penaltyForm.supervisorPenalty}
                        onChange={(e) => setPenaltyForm({...penaltyForm, supervisorPenalty: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">跟单 (CNY)</label>
                      <input
                        type="number"
                        min="0"
                        value={penaltyForm.salesPenalty}
                        onChange={(e) => setPenaltyForm({...penaltyForm, salesPenalty: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">单证 (CNY)</label>
                      <input
                        type="number"
                        min="0"
                        value={penaltyForm.documentPenalty}
                        onChange={(e) => setPenaltyForm({...penaltyForm, documentPenalty: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    分配合计: ¥{(penaltyForm.supervisorPenalty + penaltyForm.salesPenalty + penaltyForm.documentPenalty).toFixed(2)}
                    {penaltyForm.totalAmount !== (penaltyForm.supervisorPenalty + penaltyForm.salesPenalty + penaltyForm.documentPenalty) && (
                      <span className="text-amber-600 ml-2">（与总金额不一致）</span>
                    )}
                  </div>
                </div>
              )}

              {/* 启用状态 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={penaltyForm.isActive}
                  onChange={(e) => setPenaltyForm({...penaltyForm, isActive: e.target.checked})}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-xs text-gray-700">启用此惩罚规则</span>
              </label>

              {/* 备注 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">备注说明</label>
                <textarea
                  value={penaltyForm.notes}
                  onChange={(e) => setPenaltyForm({...penaltyForm, notes: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white resize-none"
                  rows={2}
                  placeholder="惩罚规则说明..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowPenaltyModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmitPenalty}
                className="px-4 py-2 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700"
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
