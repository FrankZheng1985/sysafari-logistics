import { useState, useEffect, useCallback } from 'react'
import { 
  Settings, Shield, Plus, Edit2, Check, X, 
  Clock, Code, AlertCircle, CheckCircle, Loader2,
  ChevronDown, Save, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const API_BASE = getApiBaseUrl()

// 类型定义
interface ApprovalTrigger {
  id: number
  operation_code: string
  operation_name: string
  operation_type: string
  description: string
  requires_approval: boolean
  approval_level: number
  approver_roles: string[]
  business_module: string
  trigger_action: string
  trigger_condition: any
  category: string
  availability_status: string
  is_active: boolean
}

interface TriggerRequest {
  id: number
  business_module: string
  trigger_action: string
  module_name: string
  action_name: string
  description: string
  expected_roles: string[]
  status: string
  requested_by: string
  requested_by_name: string
  developer_notes?: string
  created_at: string
}

interface BusinessModule {
  code: string
  name: string
  actions: string[]
}

// 角色选项
const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'boss', label: '老板' },
  { value: 'manager', label: '经理' },
  { value: 'finance', label: '财务' },
  { value: 'finance_director', label: '财务总监' },
  { value: 'sales', label: '销售' },
  { value: 'operator', label: '操作员' }
]

// 审批级别选项
const LEVEL_OPTIONS = [
  { value: 1, label: '普通' },
  { value: 2, label: '重要' },
  { value: 3, label: '关键' }
]

// 分类选项
const CATEGORY_OPTIONS = [
  { value: 'business', label: '业务审批' },
  { value: 'system', label: '系统审批' },
  { value: 'finance', label: '财务审批' }
]

// 状态标签样式
const STATUS_STYLES: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  developing: 'bg-amber-100 text-amber-700',
  requested: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
}

const STATUS_LABELS: Record<string, string> = {
  available: '可用',
  developing: '开发中',
  requested: '已申请',
  completed: '已完成',
  rejected: '已拒绝'
}

export default function ApprovalSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'triggers' | 'requests' | 'tasks' | 'configs'>('triggers')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 数据状态
  const [triggers, setTriggers] = useState<ApprovalTrigger[]>([])
  const [pendingRequests, setPendingRequests] = useState<TriggerRequest[]>([])
  const [allRequests, setAllRequests] = useState<TriggerRequest[]>([])
  const [businessModules, setBusinessModules] = useState<BusinessModule[]>([])
  const [actionNames, setActionNames] = useState<Record<string, string>>({})
  const [configs, setConfigs] = useState<Record<string, any>>({})
  
  // 筛选状态
  const [filterCategory, setFilterCategory] = useState('')
  
  // 编辑状态
  const [editingTrigger, setEditingTrigger] = useState<ApprovalTrigger | null>(null)
  const [editForm, setEditForm] = useState({
    approver_roles: [] as string[],
    approval_level: 1,
    trigger_condition: null as any
  })
  
  // 申请新触发点弹窗
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({
    business_module: '',
    trigger_action: '',
    module_name: '',
    action_name: '',
    description: '',
    expected_roles: [] as string[]
  })
  
  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 加载触发点列表
      const triggersRes = await fetch(`${API_BASE}/api/approval-settings/triggers`)
      const triggersData = await triggersRes.json()
      if (triggersData.errCode === 200) {
        setTriggers(triggersData.data.triggers || [])
        setPendingRequests(triggersData.data.pendingRequests || [])
      }
      
      // 加载业务模块选项
      const modulesRes = await fetch(`${API_BASE}/api/approval-settings/business-modules`)
      const modulesData = await modulesRes.json()
      if (modulesData.errCode === 200) {
        setBusinessModules(modulesData.data.modules || [])
        setActionNames(modulesData.data.actionNames || {})
      }
      
      // 加载全局配置
      const configsRes = await fetch(`${API_BASE}/api/approval-settings/configs`)
      const configsData = await configsRes.json()
      if (configsData.errCode === 200) {
        setConfigs(configsData.data || {})
      }
      
      // 加载所有申请记录
      const requestsRes = await fetch(`${API_BASE}/api/approval-settings/trigger-requests`)
      const requestsData = await requestsRes.json()
      if (requestsData.errCode === 200) {
        setAllRequests(requestsData.data || [])
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  // 切换触发点启用状态
  const handleToggleTrigger = async (trigger: ApprovalTrigger) => {
    try {
      const res = await fetch(`${API_BASE}/api/approval-settings/triggers/${trigger.id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setTriggers(prev => prev.map(t => 
          t.id === trigger.id ? { ...t, is_active: data.data.is_active } : t
        ))
      }
    } catch (error) {
      console.error('切换状态失败:', error)
    }
  }
  
  // 开始编辑触发点
  const handleEditTrigger = (trigger: ApprovalTrigger) => {
    setEditingTrigger(trigger)
    setEditForm({
      approver_roles: trigger.approver_roles || [],
      approval_level: trigger.approval_level || 1,
      trigger_condition: trigger.trigger_condition
    })
  }
  
  // 保存触发点配置
  const handleSaveTrigger = async () => {
    if (!editingTrigger) return
    
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/approval-settings/triggers/${editingTrigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setTriggers(prev => prev.map(t => 
          t.id === editingTrigger.id 
            ? { ...t, ...editForm }
            : t
        ))
        setEditingTrigger(null)
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 提交新触发点申请
  const handleSubmitRequest = async () => {
    if (!requestForm.business_module || !requestForm.trigger_action) {
      alert('请选择业务模块和触发操作')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/approval-settings/trigger-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm)
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert('申请已提交')
        setShowRequestModal(false)
        setRequestForm({
          business_module: '',
          trigger_action: '',
          module_name: '',
          action_name: '',
          description: '',
          expected_roles: []
        })
        loadData()
      } else {
        alert(data.msg || '提交失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 更新申请状态
  const handleUpdateRequestStatus = async (request: TriggerRequest, newStatus: string) => {
    const notes = newStatus === 'completed' 
      ? prompt('请输入开发完成备注（可选）：')
      : newStatus === 'rejected'
      ? prompt('请输入拒绝原因：')
      : ''
    
    if (newStatus === 'rejected' && !notes) {
      alert('请填写拒绝原因')
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/approval-settings/trigger-requests/${request.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, developer_notes: notes })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadData()
      } else {
        alert(data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新失败:', error)
    }
  }
  
  // 保存全局配置
  const handleSaveConfigs = async () => {
    setSaving(true)
    try {
      const configValues: Record<string, any> = {}
      Object.entries(configs).forEach(([key, config]) => {
        configValues[key] = config.value
      })
      
      const res = await fetch(`${API_BASE}/api/approval-settings/configs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configValues)
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert('配置保存成功')
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 筛选后的触发点
  const filteredTriggers = triggers.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false
    return true
  })
  
  // 获取模块中文名
  const getModuleName = (code: string) => {
    const module = businessModules.find(m => m.code === code)
    return module?.name || code
  }
  
  // 获取操作中文名
  const getActionName = (action: string) => {
    return actionNames[action] || action
  }

  return (
    <div className="p-6">
      <PageHeader
        title="审批权限设置"
        subtitle="管理系统审批触发点和审批角色配置"
        breadcrumbs={[
          { label: '系统概览', path: '/dashboard' },
          { label: '系统管理', path: '/system' },
          { label: '审批权限设置', path: '/system/approval-settings' }
        ]}
        activeTab="/system/approval-settings"
      />
      
      {/* Tab 导航 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('triggers')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'triggers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4 inline-block mr-2" />
              触发点列表
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'requests'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-4 h-4 inline-block mr-2" />
              申请记录
              {pendingRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'tasks'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Code className="w-4 h-4 inline-block mr-2" />
              开发任务
              {allRequests.filter(r => r.status === 'developing').length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                  {allRequests.filter(r => r.status === 'developing').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('configs')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'configs'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              全局配置
            </button>
          </nav>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* 触发点列表 Tab */}
          {activeTab === 'triggers' && (
            <div className="bg-white rounded-lg shadow-sm">
              {/* 工具栏 */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">全部分类</option>
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={loadData}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="刷新"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  申请新触发点
                </button>
              </div>
              
              {/* 列表 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">业务模块</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">触发操作</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">状态</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">启用</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">审批角色</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">级别</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTriggers.map(trigger => (
                      <tr key={trigger.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {getModuleName(trigger.business_module)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{trigger.operation_name}</div>
                            <div className="text-xs text-gray-500">{trigger.operation_code}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            trigger.category === 'business' ? 'bg-blue-100 text-blue-700' :
                            trigger.category === 'system' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {CATEGORY_OPTIONS.find(c => c.value === trigger.category)?.label || trigger.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLES[trigger.availability_status || 'available']}`}>
                            {STATUS_LABELS[trigger.availability_status || 'available']}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleTrigger(trigger)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              trigger.is_active ? 'bg-primary-600' : 'bg-gray-200'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              trigger.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {editingTrigger?.id === trigger.id ? (
                            <div className="flex flex-wrap gap-1">
                              {ROLE_OPTIONS.map(role => (
                                <label key={role.value} className="inline-flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={editForm.approver_roles.includes(role.value)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditForm(prev => ({
                                          ...prev,
                                          approver_roles: [...prev.approver_roles, role.value]
                                        }))
                                      } else {
                                        setEditForm(prev => ({
                                          ...prev,
                                          approver_roles: prev.approver_roles.filter(r => r !== role.value)
                                        }))
                                      }
                                    }}
                                    className="mr-1"
                                  />
                                  <span className="text-xs">{role.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(trigger.approver_roles || []).map(role => (
                                <span key={role} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                  {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingTrigger?.id === trigger.id ? (
                            <select
                              value={editForm.approval_level}
                              onChange={(e) => setEditForm(prev => ({ ...prev, approval_level: Number(e.target.value) }))}
                              className="px-2 py-1 border border-gray-300 rounded text-xs"
                            >
                              {LEVEL_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              trigger.approval_level === 3 ? 'bg-red-100 text-red-700' :
                              trigger.approval_level === 2 ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {LEVEL_OPTIONS.find(l => l.value === trigger.approval_level)?.label || '普通'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingTrigger?.id === trigger.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={handleSaveTrigger}
                                disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="保存"
                              >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setEditingTrigger(null)}
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                title="取消"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditTrigger(trigger)}
                              className="p-1 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded"
                              title="配置"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredTriggers.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  暂无审批触发点
                </div>
              )}
            </div>
          )}
          
          {/* 申请记录 Tab */}
          {activeTab === 'requests' && (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-medium text-gray-900">申请记录</h3>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  申请新触发点
                </button>
              </div>
              
              <div className="divide-y divide-gray-200">
                {allRequests.map(request => (
                  <div key={request.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {request.module_name || getModuleName(request.business_module)}
                          </span>
                          <span className="text-gray-500">-</span>
                          <span className="text-gray-700">
                            {request.action_name || getActionName(request.trigger_action)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLES[request.status]}`}>
                            {STATUS_LABELS[request.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{request.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>申请人: {request.requested_by_name}</span>
                          <span>申请时间: {new Date(request.created_at).toLocaleString()}</span>
                        </div>
                        {request.expected_roles && request.expected_roles.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-xs text-gray-500">期望角色:</span>
                            {request.expected_roles.map(role => (
                              <span key={role} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {allRequests.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    暂无申请记录
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 开发任务 Tab */}
          {activeTab === 'tasks' && (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">待处理的开发任务</h3>
                <p className="text-sm text-gray-500 mt-1">管理员申请的新审批触发点，需要开发人员处理</p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {allRequests.filter(r => ['requested', 'developing'].includes(r.status)).map(request => (
                  <div key={request.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`w-5 h-5 ${
                            request.status === 'requested' ? 'text-blue-500' : 'text-amber-500'
                          }`} />
                          <span className="font-medium text-gray-900">
                            {request.module_name || getModuleName(request.business_module)} - 
                            {request.action_name || getActionName(request.trigger_action)}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLES[request.status]}`}>
                            {STATUS_LABELS[request.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{request.description}</p>
                        
                        {/* 开发指南 */}
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">开发指南：</h4>
                          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                            <li>在对应的 controller 文件中找到 {request.trigger_action} 操作的处理函数</li>
                            <li>在执行操作前调用 unifiedApprovalService.checkAndCreate()</li>
                            <li>如需审批，暂停原操作，创建审批记录</li>
                            <li>测试完成后点击"标记完成"</li>
                          </ol>
                          <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
                            <code>
                              // {request.business_module}/controller.js<br/>
                              const needsApproval = await checkRequiresApproval('{request.business_module.toUpperCase()}_{request.trigger_action.toUpperCase()}')<br/>
                              if (needsApproval) {'{'}<br/>
                              &nbsp;&nbsp;await unifiedApprovalService.createApproval(...)<br/>
                              &nbsp;&nbsp;return {'{ needsApproval: true }'}<br/>
                              {'}'}
                            </code>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {request.status === 'requested' && (
                          <button
                            onClick={() => handleUpdateRequestStatus(request, 'developing')}
                            className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-sm"
                          >
                            开始开发
                          </button>
                        )}
                        {request.status === 'developing' && (
                          <button
                            onClick={() => handleUpdateRequestStatus(request, 'completed')}
                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            标记完成
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateRequestStatus(request, 'rejected')}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm"
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {allRequests.filter(r => ['requested', 'developing'].includes(r.status)).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-300" />
                    暂无待处理的开发任务
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 全局配置 Tab */}
          {activeTab === 'configs' && (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-medium text-gray-900">全局配置</h3>
                <button
                  onClick={handleSaveConfigs}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* 审批流程配置 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">审批流程配置</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">审批过期时间（小时）</label>
                      <input
                        type="number"
                        value={configs.approval_expire_hours?.value || 72}
                        onChange={(e) => setConfigs(prev => ({
                          ...prev,
                          approval_expire_hours: { ...prev.approval_expire_hours, value: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">自动提醒间隔（小时）</label>
                      <input
                        type="number"
                        value={configs.approval_auto_remind_hours?.value || 24}
                        onChange={(e) => setConfigs(prev => ({
                          ...prev,
                          approval_auto_remind_hours: { ...prev.approval_auto_remind_hours, value: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                
                {/* 财务配置 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">财务审批配置</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">财务审批阈值（EUR）</label>
                      <input
                        type="number"
                        value={configs.finance_approval_threshold?.value || 10000}
                        onChange={(e) => setConfigs(prev => ({
                          ...prev,
                          finance_approval_threshold: { ...prev.finance_approval_threshold, value: Number(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-400 mt-1">超过此金额的财务操作需要审批</p>
                    </div>
                  </div>
                </div>
                
                {/* 启用开关 */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">系统开关</h4>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm text-gray-900">启用审批流程</span>
                        <p className="text-xs text-gray-500">关闭后所有审批将跳过</p>
                      </div>
                      <button
                        onClick={() => setConfigs(prev => ({
                          ...prev,
                          approval_enabled: { ...prev.approval_enabled, value: !prev.approval_enabled?.value }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          configs.approval_enabled?.value ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          configs.approval_enabled?.value ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* 申请新触发点弹窗 */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">申请新审批触发点</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">业务模块 *</label>
                <select
                  value={requestForm.business_module}
                  onChange={(e) => {
                    const module = businessModules.find(m => m.code === e.target.value)
                    setRequestForm(prev => ({
                      ...prev,
                      business_module: e.target.value,
                      module_name: module?.name || '',
                      trigger_action: ''
                    }))
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">请选择业务模块</option>
                  {businessModules.map(module => (
                    <option key={module.code} value={module.code}>{module.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">触发操作 *</label>
                <select
                  value={requestForm.trigger_action}
                  onChange={(e) => setRequestForm(prev => ({
                    ...prev,
                    trigger_action: e.target.value,
                    action_name: actionNames[e.target.value] || ''
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!requestForm.business_module}
                >
                  <option value="">请选择触发操作</option>
                  {requestForm.business_module && 
                    businessModules.find(m => m.code === requestForm.business_module)?.actions.map(action => (
                      <option key={action} value={action}>{actionNames[action] || action}</option>
                    ))
                  }
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">需求说明</label>
                <textarea
                  value={requestForm.description}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="请描述为什么需要这个审批触发点..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">期望审批角色</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map(role => (
                    <label key={role.value} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={requestForm.expected_roles.includes(role.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRequestForm(prev => ({
                              ...prev,
                              expected_roles: [...prev.expected_roles, role.value]
                            }))
                          } else {
                            setRequestForm(prev => ({
                              ...prev,
                              expected_roles: prev.expected_roles.filter(r => r !== role.value)
                            }))
                          }
                        }}
                        className="mr-1"
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={saving || !requestForm.business_module || !requestForm.trigger_action}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

