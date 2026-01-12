/**
 * 预警管理页面
 * 展示预警列表，支持处理和配置预警规则
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateTime } from '../utils/dateFormat'
import { 
  AlertTriangle, 
  Bell, 
  ClipboardCheck,
  Check,
  X,
  RefreshCw,
  Settings,
  Filter,
  Eye,
  Package,
  Wallet,
  Building2,
  FileText,
  Users,
  Calendar,
  AlertCircle,
  Info,
  CheckCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { invalidateNotificationCache } from '../utils/apiCache'

const API_BASE = getApiBaseUrl()

interface AlertLog {
  id: number
  rule_id: string
  rule_name: string
  alert_type: string
  alert_level: string
  title: string
  content: string
  related_type: string
  related_id: string
  status: string
  handled_by: string
  handled_at: string
  handle_remark: string
  created_at: string
}

interface AlertRule {
  id: string
  rule_name: string
  rule_type: string
  conditions: string
  alert_level: string
  receivers: string
  is_active: number
  description: string
}

interface AlertStats {
  active_count: number
  handled_count: number
  ignored_count: number
  danger_count: number
  warning_count: number
  info_count: number
}

// 预警类型配置
const ALERT_TYPES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  order_overdue: { label: '订单超期', icon: Package, color: 'text-blue-600 bg-blue-100' },
  payment_due: { label: '应收逾期', icon: Wallet, color: 'text-green-600 bg-green-100' },
  payment_term_due: { label: '账期到期', icon: Calendar, color: 'text-amber-600 bg-amber-100' },
  customer_overdue: { label: '客户逾期', icon: Users, color: 'text-red-600 bg-red-100' },
  credit_limit: { label: '信用超限', icon: Users, color: 'text-purple-600 bg-purple-100' },
  contract_expire: { label: '合同到期', icon: FileText, color: 'text-orange-600 bg-orange-100' },
  license_expire: { label: '证照到期', icon: Calendar, color: 'text-cyan-600 bg-cyan-100' },
}

// 根据用户角色获取可见的预警类型
function getVisibleAlertTypes(userRole: string | undefined): string[] {
  const commonTypes = ['order_overdue']
  const financeTypes = ['payment_due', 'payment_term_due', 'credit_limit', 'customer_overdue']
  const crmTypes = ['contract_expire']
  const supplierTypes = ['license_expire']
  
  // 管理员和老板能看所有
  if (['admin', 'boss'].includes(userRole || '')) {
    return [...commonTypes, ...financeTypes, ...crmTypes, ...supplierTypes]
  }
  
  // 财务角色能看财务预警
  if (['finance_manager', 'finance'].includes(userRole || '')) {
    return [...commonTypes, ...financeTypes]
  }
  
  // 经理角色能看CRM和供应商预警
  if (['manager', 'czjl'].includes(userRole || '')) {
    return [...commonTypes, ...crmTypes, ...supplierTypes]
  }
  
  // 其他角色只能看通用预警
  return commonTypes
}

// 预警级别配置
const ALERT_LEVELS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  danger: { label: '危险', color: 'text-red-600 bg-red-100', icon: AlertCircle },
  warning: { label: '警告', color: 'text-amber-600 bg-amber-100', icon: AlertTriangle },
  info: { label: '提醒', color: 'text-blue-600 bg-blue-100', icon: Info },
}

// 预警状态配置
const ALERT_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: '待处理', color: 'text-red-600 bg-red-100' },
  handled: { label: '已处理', color: 'text-green-600 bg-green-100' },
  ignored: { label: '已忽略', color: 'text-gray-600 bg-gray-100' },
}

export default function AlertDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [activeStatus, setActiveStatus] = useState('active')
  const [activeType, setActiveType] = useState('all')
  const [activeLevel, setActiveLevel] = useState('all')
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showHandleModal, setShowHandleModal] = useState(false)
  const [currentAlert, setCurrentAlert] = useState<AlertLog | null>(null)
  const [handleAction, setHandleAction] = useState<'handle' | 'ignore'>('handle')
  const [handleRemark, setHandleRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tabs = [
    { label: '消息中心', path: '/system/messages' },
    { label: '审批工作台', path: '/system/approvals' },
    { label: '预警管理', path: '/system/alerts' },
  ]

  // 加载预警列表
  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      
      // 传递用户角色，用于权限过滤
      if (user?.role) {
        params.append('userRole', user.role)
      }
      
      if (activeStatus !== 'all') {
        params.append('status', activeStatus)
      }
      
      if (activeType !== 'all') {
        params.append('alertType', activeType)
      }
      
      if (activeLevel !== 'all') {
        params.append('alertLevel', activeLevel)
      }
      
      const response = await fetch(`${API_BASE}/api/alerts/logs?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setAlerts(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载预警列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载预警统计
  const fetchStats = async () => {
    try {
      // 传递用户角色，用于权限过滤
      const params = new URLSearchParams()
      if (user?.role) {
        params.append('userRole', user.role)
      }
      
      const response = await fetch(`${API_BASE}/api/alerts/stats?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载预警统计失败:', error)
    }
  }

  // 加载预警规则
  const fetchRules = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/alerts/rules`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setRules(data.data || [])
      }
    } catch (error) {
      console.error('加载预警规则失败:', error)
    }
  }

  // 打开处理弹窗
  const openHandleModal = (alert: AlertLog, action: 'handle' | 'ignore') => {
    setCurrentAlert(alert)
    setHandleAction(action)
    setHandleRemark('')
    setShowHandleModal(true)
  }

  // 提交处理
  const submitHandle = async () => {
    if (!currentAlert || !user?.id) return
    
    setSubmitting(true)
    try {
      const endpoint = handleAction === 'handle' 
        ? `/api/alerts/logs/${currentAlert.id}/handle`
        : `/api/alerts/logs/${currentAlert.id}/ignore`
        
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          handledBy: user.name || user.username,
          handleRemark: handleRemark
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        alert(handleAction === 'handle' ? '预警已处理' : '预警已忽略')
        setShowHandleModal(false)
        fetchAlerts()
        fetchStats()
        // 清除通知缓存，让铃铛数量立即更新
        if (user?.id) {
          invalidateNotificationCache(user.id, user.role)
        }
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('处理预警失败:', error)
      alert('操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 切换规则状态
  const toggleRuleStatus = async (rule: AlertRule) => {
    try {
      const response = await fetch(`${API_BASE}/api/alerts/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ isActive: !rule.is_active })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        fetchRules()
      }
    } catch (error) {
      console.error('切换规则状态失败:', error)
    }
  }

  // 查看关联业务
  const viewRelated = (alert: AlertLog) => {
    if (alert.related_type === 'order' && alert.related_id) {
      navigate(`/bill-details/${alert.related_id}`)
    } else if (alert.related_type === 'invoice' && alert.related_id) {
      navigate(`/finance/invoices/${alert.related_id}`)
    } else if (alert.related_type === 'customer' && alert.related_id) {
      navigate(`/crm/customers/${alert.related_id}`)
    } else if (alert.related_type === 'supplier' && alert.related_id) {
      navigate('/suppliers/list')
    } else if (alert.related_type === 'contract' && alert.related_id) {
      navigate('/crm/contracts')
    }
  }

  useEffect(() => {
    fetchAlerts()
    fetchStats()
  }, [page, pageSize, activeStatus, activeType, activeLevel])

  useEffect(() => {
    if (showRulesModal) {
      fetchRules()
    }
  }, [showRulesModal])

  // 格式化时间
  const formatTime = (dateStr: string) => {
    return formatDateTime(dateStr)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="预警管理"
        icon={<AlertTriangle className="w-6 h-6 text-primary-600" />}
        tabs={tabs}
        activeTab="/system/alerts"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">{stats?.active_count || 0}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">危险级别</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">{stats?.danger_count || 0}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">警告级别</p>
              <p className="text-2xl font-semibold text-amber-600 mt-1">{stats?.warning_count || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">提醒级别</p>
              <p className="text-2xl font-semibold text-blue-600 mt-1">{stats?.info_count || 0}</p>
            </div>
            <Info className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已处理</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">{stats?.handled_count || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已忽略</p>
              <p className="text-2xl font-semibold text-gray-600 mt-1">{stats?.ignored_count || 0}</p>
            </div>
            <X className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* 筛选和列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* 筛选栏 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={activeStatus}
                onChange={(e) => { setActiveStatus(e.target.value); setPage(1) }}
                className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">全部状态</option>
                {Object.entries(ALERT_STATUS).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <select
              value={activeType}
              onChange={(e) => { setActiveType(e.target.value); setPage(1) }}
              className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">全部类型</option>
              {/* 只显示用户有权查看的预警类型 */}
              {getVisibleAlertTypes(user?.role).map((key) => {
                const config = ALERT_TYPES[key]
                return config ? <option key={key} value={key}>{config.label}</option> : null
              })}
            </select>
            <select
              value={activeLevel}
              onChange={(e) => { setActiveLevel(e.target.value); setPage(1) }}
              className="text-sm border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">全部级别</option>
              {Object.entries(ALERT_LEVELS).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRulesModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-4 h-4" />
              规则配置
            </button>
            <button
              onClick={() => { fetchAlerts(); fetchStats() }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 预警列表 */}
        {loading ? (
          <div className="py-12 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
            暂无预警记录
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert) => {
              const typeConfig = ALERT_TYPES[alert.alert_type] || ALERT_TYPES.order_overdue
              const levelConfig = ALERT_LEVELS[alert.alert_level] || ALERT_LEVELS.warning
              const statusConfig = ALERT_STATUS[alert.status] || ALERT_STATUS.active
              const TypeIcon = typeConfig.icon
              const LevelIcon = levelConfig.icon
              
              return (
                <div key={alert.id} className="px-4 py-4">
                  <div className="flex items-start justify-between">
                    {/* 左侧信息 */}
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${levelConfig.color}`}>
                        <LevelIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded ${levelConfig.color}`}>
                            {levelConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{alert.title}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{alert.content}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>预警时间: {formatTime(alert.created_at)}</span>
                          {alert.rule_name && <span>规则: {alert.rule_name}</span>}
                        </div>
                        {alert.status !== 'active' && (
                          <div className="mt-2 text-xs text-gray-400">
                            <span>处理人: {alert.handled_by || '-'}</span>
                            <span className="ml-4">处理时间: {formatTime(alert.handled_at)}</span>
                            {alert.handle_remark && <span className="ml-4">备注: {alert.handle_remark}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧操作 */}
                    <div className="flex items-center gap-2">
                      {alert.related_id && (
                        <button
                          onClick={() => viewRelated(alert)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                          查看
                        </button>
                      )}
                      {alert.status === 'active' && (
                        <>
                          <button
                            onClick={() => openHandleModal(alert, 'handle')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                            处理
                          </button>
                          <button
                            onClick={() => openHandleModal(alert, 'ignore')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            <X className="w-4 h-4" />
                            忽略
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              第 {page} / {totalPages} 页，共 {total} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
      </div>

      {/* 处理弹窗 */}
      {showHandleModal && currentAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {handleAction === 'handle' ? '处理预警' : '忽略预警'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预警内容</label>
                <p className="text-sm text-gray-600">{currentAlert.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">处理备注</label>
                <textarea
                  value={handleRemark}
                  onChange={(e) => setHandleRemark(e.target.value)}
                  placeholder="可选，填写处理备注"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowHandleModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={submitHandle}
                disabled={submitting}
                className={`px-4 py-2 text-sm text-white rounded-lg ${
                  handleAction === 'handle'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-500 hover:bg-gray-600'
                } disabled:opacity-50`}
              >
                {submitting ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 规则配置弹窗 */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">预警规则配置</h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {rules.map((rule) => {
                  const typeConfig = ALERT_TYPES[rule.rule_type]
                  const levelConfig = ALERT_LEVELS[rule.alert_level]
                  const TypeIcon = typeConfig?.icon || AlertTriangle
                  
                  return (
                    <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig?.color || 'bg-gray-100 text-gray-600'}`}>
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">{rule.rule_name}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${levelConfig?.color || 'bg-gray-100 text-gray-600'}`}>
                                {levelConfig?.label || rule.alert_level}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{rule.description}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!rule.is_active}
                            onChange={() => toggleRuleStatus(rule)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
