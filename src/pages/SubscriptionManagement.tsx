/**
 * 服务订阅管理页面
 * 管理 SSL 证书、认证服务、API 服务、云服务等的到期和费用
 */

import React, { useState, useEffect } from 'react'
import { 
  Shield, Clock, AlertTriangle, CheckCircle, XCircle,
  Plus, Edit2, Trash2, RefreshCw, Search, Filter,
  Calendar, DollarSign, Globe, Key, Server, Cloud,
  Bell, ExternalLink, ChevronDown, MoreVertical
} from 'lucide-react'
import api from '../utils/api'

// 类型定义
interface Subscription {
  id: number
  name: string
  category: string
  provider: string
  description: string
  domain: string
  environment: string
  start_date: string
  expire_date: string
  auto_renew: boolean
  renew_url: string
  status: string
  cost_amount: number
  cost_currency: string
  cost_cycle: string
  alert_days: number
  last_check_at: string
  notes: string
  created_at: string
  updated_at: string
}

interface Statistics {
  total: number
  active: number
  expiring: number
  expired: number
  totalCost: number
  byCategory: Record<string, number>
}

// 分类配置
const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ssl: { label: 'SSL证书', icon: <Shield className="w-4 h-4" />, color: 'text-green-600 bg-green-100' },
  auth: { label: '认证服务', icon: <Key className="w-4 h-4" />, color: 'text-blue-600 bg-blue-100' },
  api: { label: 'API服务', icon: <Globe className="w-4 h-4" />, color: 'text-purple-600 bg-purple-100' },
  cloud: { label: '云服务', icon: <Cloud className="w-4 h-4" />, color: 'text-cyan-600 bg-cyan-100' },
  domain: { label: '域名', icon: <Server className="w-4 h-4" />, color: 'text-orange-600 bg-orange-100' },
}

// 状态配置
const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'bg-green-100 text-green-700' },
  expiring: { label: '即将到期', color: 'bg-amber-100 text-amber-700' },
  expired: { label: '已过期', color: 'bg-red-100 text-red-700' },
  inactive: { label: '已停用', color: 'bg-gray-100 text-gray-600' },
}

// 环境配置
const envConfig: Record<string, { label: string; color: string }> = {
  production: { label: '生产', color: 'bg-blue-100 text-blue-700' },
  demo: { label: '演示', color: 'bg-purple-100 text-purple-700' },
  development: { label: '开发', color: 'bg-gray-100 text-gray-600' },
  all: { label: '全部', color: 'bg-cyan-100 text-cyan-700' },
}

// 计费周期
const costCycleOptions = [
  { value: 'monthly', label: '月付' },
  { value: 'quarterly', label: '季付' },
  { value: 'yearly', label: '年付' },
  { value: 'one-time', label: '一次性' },
  { value: 'usage', label: '按量' },
]

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // 筛选状态
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    environment: '',
    search: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Subscription | null>(null)
  const [formData, setFormData] = useState<Partial<Subscription>>({})
  const [saving, setSaving] = useState(false)
  
  // 删除确认
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  
  // 加载数据
  useEffect(() => {
    loadData()
  }, [filters])
  
  const loadData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)
      if (filters.environment) params.append('environment', filters.environment)
      if (filters.search) params.append('search', filters.search)
      
      const [subsRes, statsRes] = await Promise.all([
        api.get(`/api/subscriptions?${params.toString()}`),
        api.get('/api/subscriptions/statistics')
      ])
      
      // 调试日志
      console.log('订阅API响应:', JSON.stringify(subsRes.data, null, 2))
      
      // API 返回格式: { errCode: 200, data: { list: [...] } }
      const items = subsRes.data?.data?.list || subsRes.data?.data?.items || subsRes.data?.data || []
      console.log('解析后的items:', items?.length || 0, '条')
      setSubscriptions(Array.isArray(items) ? items : [])
      setStatistics(statsRes.data?.data || null)
    } catch (error) {
      console.error('加载订阅数据失败:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 刷新状态检查
  const handleRefreshStatus = async () => {
    try {
      setRefreshing(true)
      await api.post('/api/subscriptions/check-status')
      await loadData()
    } catch (error) {
      console.error('刷新状态失败:', error)
    } finally {
      setRefreshing(false)
    }
  }
  
  // 打开新建/编辑弹窗
  const openModal = (item?: Subscription) => {
    if (item) {
      setEditingItem(item)
      setFormData({ ...item })
    } else {
      setEditingItem(null)
      setFormData({
        category: 'api',
        environment: 'production',
        auto_renew: false,
        cost_currency: 'CNY',
        cost_cycle: 'monthly',
        alert_days: 30,
        status: 'active'
      })
    }
    setShowModal(true)
  }
  
  // 保存
  const handleSave = async () => {
    try {
      setSaving(true)
      if (editingItem) {
        await api.put(`/api/subscriptions/${editingItem.id}`, formData)
      } else {
        await api.post('/api/subscriptions', formData)
      }
      setShowModal(false)
      await loadData()
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 删除
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/subscriptions/${id}`)
      setDeleteConfirm(null)
      await loadData()
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败，请重试')
    }
  }
  
  // 计算剩余天数
  const getDaysRemaining = (expireDate: string) => {
    if (!expireDate) return null
    const today = new Date()
    const expire = new Date(expireDate)
    const diff = Math.ceil((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }
  
  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }
  
  // 格式化金额
  const formatCost = (amount: number, currency: string) => {
    if (!amount) return '-'
    const symbols: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€' }
    return `${symbols[currency] || currency} ${amount.toLocaleString()}`
  }

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">服务订阅管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理 SSL 证书、认证服务、API 服务等的到期和费用</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            检查状态
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            添加服务
          </button>
        </div>
      </div>
      
      {/* 统计卡片 */}
      {statistics && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Server className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
                <div className="text-xs text-gray-500">总服务数</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{statistics.active}</div>
                <div className="text-xs text-gray-500">正常运行</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{statistics.expiring}</div>
                <div className="text-xs text-gray-500">即将到期</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{statistics.expired}</div>
                <div className="text-xs text-gray-500">已过期</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  ¥{(statistics.totalCost || 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">月度费用</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border border-gray-200 mb-4">
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索服务名称、提供商、域名..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部分类</option>
            {Object.entries(categoryConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部状态</option>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          
          <select
            value={filters.environment}
            onChange={(e) => setFilters(prev => ({ ...prev, environment: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部环境</option>
            {Object.entries(envConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* 列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">环境</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">到期日期</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">剩余天数</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">费用</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">自动续期</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-gray-500">
                  暂无订阅数据
                </td>
              </tr>
            ) : (
              subscriptions.map((item) => {
                const days = getDaysRemaining(item.expire_date)
                const category = categoryConfig[item.category] || { label: item.category, icon: <Server className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' }
                const status = statusConfig[item.status] || { label: item.status, color: 'bg-gray-100 text-gray-600' }
                const env = envConfig[item.environment] || { label: item.environment, color: 'bg-gray-100 text-gray-600' }
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${category.color}`}>
                          {category.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.provider || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${category.color}`}>
                        {category.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${env.color}`}>
                        {env.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {item.domain && (
                        <div className="text-xs text-gray-400 truncate max-w-[120px]" title={item.domain}>
                          {item.domain}
                        </div>
                      )}
                      {formatDate(item.expire_date)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        {days !== null ? (
                          <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs font-medium ${
                            days < 0 ? 'bg-red-100 text-red-700' :
                            days <= 30 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {days < 0 ? `过期${Math.abs(days)}天` : `${days}天`}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm">
                      {item.cost_amount ? (
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatCost(item.cost_amount, item.cost_currency)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {costCycleOptions.find(c => c.value === item.cost_cycle)?.label || item.cost_cycle}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        {item.auto_renew ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {item.renew_url && (
                          <a
                            href={item.renew_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                            title="续费链接"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => openModal(item)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                          title="编辑"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingItem ? '编辑服务' : '添加服务'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    服务名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="如：阿里云 SSL 证书"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    分类 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(categoryConfig).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">提供商</label>
                  <input
                    type="text"
                    value={formData.provider || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="如：阿里云、腾讯云、Auth0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">环境</label>
                  <select
                    value={formData.environment || 'production'}
                    onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(envConfig).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联域名</label>
                <input
                  type="text"
                  value={formData.domain || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="如：erp.xianfeng-eu.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">生效日期</label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    到期日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expire_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, expire_date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">费用金额</label>
                  <input
                    type="number"
                    value={formData.cost_amount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">货币</label>
                  <select
                    value={formData.cost_currency || 'CNY'}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="CNY">人民币 (CNY)</option>
                    <option value="USD">美元 (USD)</option>
                    <option value="EUR">欧元 (EUR)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">计费周期</label>
                  <select
                    value={formData.cost_cycle || 'monthly'}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_cycle: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {costCycleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">提前提醒天数</label>
                  <input
                    type="number"
                    value={formData.alert_days || 30}
                    onChange={(e) => setFormData(prev => ({ ...prev, alert_days: parseInt(e.target.value) || 30 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    min="1"
                    max="365"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">续费链接</label>
                  <input
                    type="url"
                    value={formData.renew_url || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, renew_url: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_renew"
                  checked={formData.auto_renew || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto_renew: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="auto_renew" className="text-sm text-gray-700">
                  自动续期（无需手动操作）
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="其他备注信息..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.category}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
              <p className="text-sm text-gray-500 mb-6">删除后将无法恢复，是否确认删除该服务记录？</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
