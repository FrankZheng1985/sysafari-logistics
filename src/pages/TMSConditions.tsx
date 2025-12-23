import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, Check, X,
  Clock, DollarSign, TrendingUp, Star,
  AlertTriangle, Bell, BellOff
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 条件类型
const CONDITION_TYPES = [
  { value: 'time_limit', label: '时效考核', icon: Clock, color: 'blue' },
  { value: 'price_standard', label: '价格标准', icon: DollarSign, color: 'green' },
  { value: 'efficiency', label: '效率指标', icon: TrendingUp, color: 'purple' },
  { value: 'provider_score', label: '服务商评分', icon: Star, color: 'amber' },
]

// 比较操作符
const OPERATORS = [
  { value: '<=', label: '小于等于 (<=)' },
  { value: '>=', label: '大于等于 (>=)' },
  { value: '=', label: '等于 (=)' },
  { value: 'between', label: '范围 (between)' },
]

// 适用范围类型
const SCOPE_TYPES = [
  { value: 'global', label: '全局通用' },
  { value: 'route', label: '按路线' },
  { value: 'provider', label: '按服务商' },
  { value: 'service_type', label: '按服务类型' },
]

// 预警级别
const ALERT_LEVELS = [
  { value: 'warning', label: '警告', color: 'yellow' },
  { value: 'error', label: '错误', color: 'orange' },
  { value: 'critical', label: '严重', color: 'red' },
]

// 单位选项
const UNITS = [
  { value: '小时', label: '小时' },
  { value: '天', label: '天' },
  { value: '元', label: '元' },
  { value: '元/kg', label: '元/公斤' },
  { value: '元/cbm', label: '元/立方米' },
  { value: '%', label: '百分比 (%)' },
  { value: '分', label: '分' },
]

interface Condition {
  id: number
  conditionCode: string
  conditionName: string
  conditionType: string
  metricName: string
  operator: string
  thresholdValue: number
  thresholdValue2: number | null
  unit: string
  weight: number
  scopeType: string
  scopeValues: string[] | null
  alertEnabled: boolean
  alertLevel: string
  description: string
  status: string
  createTime: string
  updateTime: string
}

interface ConditionFormData {
  conditionCode: string
  conditionName: string
  conditionType: string
  metricName: string
  operator: string
  thresholdValue: number
  thresholdValue2: number | null
  unit: string
  weight: number
  scopeType: string
  scopeValues: string[]
  alertEnabled: boolean
  alertLevel: string
  description: string
  status: string
}

const initialFormData: ConditionFormData = {
  conditionCode: '',
  conditionName: '',
  conditionType: 'time_limit',
  metricName: '',
  operator: '<=',
  thresholdValue: 0,
  thresholdValue2: null,
  unit: '小时',
  weight: 100,
  scopeType: 'global',
  scopeValues: [],
  alertEnabled: false,
  alertLevel: 'warning',
  description: '',
  status: 'active',
}

export default function TMSConditions() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [editingCondition, setEditingCondition] = useState<Condition | null>(null)
  const [formData, setFormData] = useState<ConditionFormData>(initialFormData)
  const [saving, setSaving] = useState(false)

  const tabs = [
    { label: 'TMS概览', path: '/tms' },
    { label: 'TMS管理', path: '/cmr-manage' },
    { label: '运输供应商', path: '/supplier-manage?type=transport' },
    { label: '运费管理', path: '/tms/pricing' },
    { label: '条件管理', path: '/tms/conditions' },
  ]

  useEffect(() => {
    fetchConditions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchText, filterType, filterStatus])

  const fetchConditions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchText && { search: searchText }),
        ...(filterType && { type: filterType }),
        ...(filterStatus && { status: filterStatus }),
      })
      
      const res = await fetch(`${API_BASE}/api/tms/conditions?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setConditions(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取条件列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (condition?: Condition) => {
    if (condition) {
      setEditingCondition(condition)
      setFormData({
        conditionCode: condition.conditionCode,
        conditionName: condition.conditionName,
        conditionType: condition.conditionType,
        metricName: condition.metricName || '',
        operator: condition.operator,
        thresholdValue: condition.thresholdValue,
        thresholdValue2: condition.thresholdValue2,
        unit: condition.unit,
        weight: condition.weight,
        scopeType: condition.scopeType,
        scopeValues: condition.scopeValues || [],
        alertEnabled: condition.alertEnabled,
        alertLevel: condition.alertLevel,
        description: condition.description || '',
        status: condition.status,
      })
    } else {
      setEditingCondition(null)
      setFormData(initialFormData)
    }
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setEditingCondition(null)
    setFormData(initialFormData)
  }

  const handleSave = async () => {
    if (!formData.conditionCode || !formData.conditionName || !formData.conditionType) {
      alert('请填写条件编码、名称和类型')
      return
    }

    setSaving(true)
    try {
      const url = editingCondition 
        ? `${API_BASE}/api/tms/conditions/${editingCondition.id}`
        : `${API_BASE}/api/tms/conditions`
      
      const res = await fetch(url, {
        method: editingCondition ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        handleCloseModal()
        fetchConditions()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存条件失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (condition: Condition) => {
    if (!confirm(`确定要删除条件 "${condition.conditionName}" 吗？`)) {
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/tms/conditions/${condition.id}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchConditions()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除条件失败:', error)
      alert('删除失败')
    }
  }

  const handleToggleStatus = async (condition: Condition) => {
    const newStatus = condition.status === 'active' ? 'inactive' : 'active'
    
    try {
      const res = await fetch(`${API_BASE}/api/tms/conditions/${condition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchConditions()
      } else {
        alert(data.msg || '更新状态失败')
      }
    } catch (error) {
      console.error('更新状态失败:', error)
      alert('更新状态失败')
    }
  }

  const getConditionTypeConfig = (type: string) => {
    return CONDITION_TYPES.find(t => t.value === type) || CONDITION_TYPES[0]
  }

  const getOperatorLabel = (op: string) => {
    return OPERATORS.find(o => o.value === op)?.label || op
  }

  const getScopeTypeLabel = (scope: string) => {
    return SCOPE_TYPES.find(s => s.value === scope)?.label || scope
  }

  const columns: Column<Condition>[] = [
    {
      key: 'conditionCode',
      label: '条件编码',
      width: '100px',
      sorter: true,
      render: (_value, record) => (
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          {record.conditionCode}
        </span>
      ),
    },
    {
      key: 'conditionName',
      label: '条件名称',
      sorter: true,
      render: (_value, record) => {
        const typeConfig = getConditionTypeConfig(record.conditionType)
        const TypeIcon = typeConfig.icon
        const colorMap: Record<string, string> = {
          blue: 'bg-blue-100 text-blue-600',
          green: 'bg-green-100 text-green-600',
          purple: 'bg-purple-100 text-purple-600',
          amber: 'bg-amber-100 text-amber-600',
        }
        return (
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorMap[typeConfig.color]}`}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{record.conditionName}</div>
              {record.metricName && (
                <div className="text-xs text-gray-500">{record.metricName}</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'conditionType',
      label: '类型',
      width: '100px',
      sorter: true,
      render: (_value, record) => {
        const typeConfig = getConditionTypeConfig(record.conditionType)
        const bgMap: Record<string, string> = {
          blue: 'bg-blue-100 text-blue-700',
          green: 'bg-green-100 text-green-700',
          purple: 'bg-purple-100 text-purple-700',
          amber: 'bg-amber-100 text-amber-700',
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bgMap[typeConfig.color]}`}>
            {typeConfig.label}
          </span>
        )
      },
    },
    {
      key: 'threshold',
      label: '阈值标准',
      width: '150px',
      sorter: (a: Condition, b: Condition) => (a.thresholdValue || 0) - (b.thresholdValue || 0),
      render: (_value, record) => (
        <div>
          <div className="font-medium text-gray-900">
            {record.operator === 'between' 
              ? `${record.thresholdValue} ~ ${record.thresholdValue2} ${record.unit}`
              : `${record.operator} ${record.thresholdValue} ${record.unit}`
            }
          </div>
          <div className="text-xs text-gray-500">权重: {record.weight}</div>
        </div>
      ),
    },
    {
      key: 'scopeType',
      label: '适用范围',
      width: '100px',
      sorter: true,
      render: (_value, record) => (
        <span className="text-sm text-gray-600">
          {getScopeTypeLabel(record.scopeType)}
        </span>
      ),
    },
    {
      key: 'alertEnabled',
      label: '预警',
      width: '80px',
      sorter: true,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          {record.alertEnabled ? (
            <>
              <Bell className="w-4 h-4 text-amber-500" />
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                record.alertLevel === 'critical' ? 'bg-red-100 text-red-700' :
                record.alertLevel === 'error' ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {ALERT_LEVELS.find(a => a.value === record.alertLevel)?.label || record.alertLevel}
              </span>
            </>
          ) : (
            <BellOff className="w-4 h-4 text-gray-300" />
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      width: '80px',
      sorter: true,
      render: (_value, record) => (
        <button
          onClick={() => handleToggleStatus(record)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            record.status === 'active' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {record.status === 'active' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {record.status === 'active' ? '启用' : '禁用'}
        </button>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      width: '100px',
      render: (_value, record) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(record)}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(record)}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="TMS运输管理"
        tabs={tabs}
        activeTab="/tms/conditions"
        onTabChange={(path) => navigate(path)}
      />

      {/* 条件类型统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {CONDITION_TYPES.map(type => {
          const TypeIcon = type.icon
          const count = conditions.filter(c => c.conditionType === type.value).length
          const activeCount = conditions.filter(c => c.conditionType === type.value && c.status === 'active').length
          const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
            blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700' },
            green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700' },
            purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
            amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-700' },
          }
          const colors = colorMap[type.color]
          return (
            <div 
              key={type.value}
              className={`${colors.bg} rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => setFilterType(filterType === type.value ? '' : type.value)}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg bg-white/80`}>
                  <TypeIcon className={`w-5 h-5 ${colors.icon}`} />
                </div>
                {filterType === type.value && (
                  <span className="text-xs bg-white px-2 py-0.5 rounded">已筛选</span>
                )}
              </div>
              <div className={`mt-3 text-lg font-bold ${colors.text}`}>{count}</div>
              <div className="text-sm text-gray-600">{type.label}</div>
              <div className="text-xs text-gray-400 mt-1">启用中: {activeCount}</div>
            </div>
          )
        })}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索条件..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 w-60 bg-white"
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            title="筛选条件类型"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            {CONDITION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="筛选条件状态"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">禁用</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          新建条件
        </button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={conditions}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (p, ps) => {
              setPage(p)
              if (ps) setPageSize(ps)
            },
          }}
        />
      </div>

      {/* 编辑弹窗 */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingCondition ? '编辑考核条件' : '新建考核条件'}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    条件编码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.conditionCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, conditionCode: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="如：TL001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    条件名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.conditionName}
                    onChange={(e) => setFormData(prev => ({ ...prev, conditionName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入条件名称"
                  />
                </div>
              </div>

              {/* 条件类型和指标名称 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    条件类型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.conditionType}
                    onChange={(e) => setFormData(prev => ({ ...prev, conditionType: e.target.value }))}
                    title="选择条件类型"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {CONDITION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">指标名称</label>
                  <input
                    type="text"
                    value={formData.metricName}
                    onChange={(e) => setFormData(prev => ({ ...prev, metricName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="如：提货时效、准时率"
                  />
                </div>
              </div>

              {/* 阈值设置 */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="text-sm font-medium text-gray-700">阈值设置</div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">比较方式</label>
                    <select
                      value={formData.operator}
                      onChange={(e) => setFormData(prev => ({ ...prev, operator: e.target.value }))}
                      title="选择比较方式"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">阈值</label>
                    <input
                      type="number"
                      value={formData.thresholdValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, thresholdValue: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="0"
                    />
                  </div>
                  {formData.operator === 'between' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">阈值上限</label>
                      <input
                        type="number"
                        value={formData.thresholdValue2 || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, thresholdValue2: parseFloat(e.target.value) || null }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="0"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">单位</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                      title="选择单位"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 权重和适用范围 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">权重</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: parseInt(e.target.value) || 100 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="100"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-400 mt-1">用于综合评分计算，0-100</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">适用范围</label>
                  <select
                    value={formData.scopeType}
                    onChange={(e) => setFormData(prev => ({ ...prev, scopeType: e.target.value }))}
                    title="选择适用范围"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {SCOPE_TYPES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 预警设置 */}
              <div className="p-3 bg-amber-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-gray-700">预警设置</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.alertEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, alertEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                    <span className="ml-2 text-sm text-gray-600">{formData.alertEnabled ? '已启用' : '未启用'}</span>
                  </label>
                </div>
                {formData.alertEnabled && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">预警级别</label>
                    <select
                      value={formData.alertLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, alertLevel: e.target.value }))}
                      title="选择预警级别"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {ALERT_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述说明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="输入条件描述说明"
                />
              </div>

              {/* 状态 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  title="选择条件状态"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
