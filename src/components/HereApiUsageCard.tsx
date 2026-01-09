import { useState, useEffect } from 'react'
import { 
  MapPin, TrendingUp, AlertTriangle, XCircle, RefreshCw, 
  Loader2, CheckCircle, Info, ExternalLink, BarChart3, Upload, X,
  Key, Eye, EyeOff, Save
} from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// API 类型映射
const API_TYPE_LABELS: Record<string, string> = {
  autosuggest: 'Autosuggest (地址补全)',
  geocoding: 'Geocoding (地理编码)',
  routing: 'Routing (路线计算)',
  matrix_routing: 'Matrix Routing (距离矩阵)'
}

interface ApiUsageStat {
  apiType: string
  name: string
  description: string
  callCount: number
  monthlyLimit: number
  cacheHitCount: number
  errorCount: number
  remaining: number
  usagePercentage: number
  lastCallAt: string | null
  warningThreshold: number
  blockThreshold: number
  status: 'normal' | 'moderate' | 'warning' | 'blocked'
}

interface UsageStats {
  yearMonth: string
  stats: ApiUsageStat[]
  summary: {
    totalCalls: number
    totalCacheHits: number
    totalErrors: number
    cacheHitRate: number
  }
}

// 状态配置
const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  normal: { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: '正常' },
  moderate: { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', label: '中等' },
  warning: { color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', label: '警告' },
  blocked: { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: '已阻止' }
}

// 单个 API 使用量卡片
function ApiUsageItem({ stat }: { stat: ApiUsageStat }) {
  const config = statusConfig[stat.status] || statusConfig.normal
  
  // 计算进度条颜色
  const getProgressColor = () => {
    if (stat.usagePercentage >= stat.blockThreshold) return 'bg-red-500'
    if (stat.usagePercentage >= stat.warningThreshold) return 'bg-amber-500'
    if (stat.usagePercentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  }
  
  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900 text-sm">{stat.name}</h4>
          <p className="text-xs text-gray-500">{stat.description}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color} ${config.bgColor}`}>
          {config.label}
        </span>
      </div>
      
      {/* 进度条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>使用量: {stat.callCount.toLocaleString()} / {stat.monthlyLimit.toLocaleString()}</span>
          <span>{stat.usagePercentage.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${getProgressColor()}`}
            style={{ width: `${Math.min(stat.usagePercentage, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
          <span>警告: {stat.warningThreshold}%</span>
          <span>阻止: {stat.blockThreshold}%</span>
        </div>
      </div>
      
      {/* 统计数据 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">{stat.remaining.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">剩余次数</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">{stat.cacheHitCount.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">缓存命中</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">{stat.errorCount}</div>
          <div className="text-[10px] text-gray-500">错误次数</div>
        </div>
      </div>
      
      {/* 最后调用时间 */}
      {stat.lastCallAt && (
        <div className="mt-2 text-[10px] text-gray-400 text-right">
          最后调用: {new Date(stat.lastCallAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}

// 同步对话框组件
function SyncModal({ 
  isOpen, 
  onClose, 
  onSync, 
  currentStats 
}: { 
  isOpen: boolean
  onClose: () => void
  onSync: (data: Record<string, number>) => Promise<void>
  currentStats: ApiUsageStat[]
}) {
  const [syncData, setSyncData] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  
  // 初始化同步数据
  useEffect(() => {
    if (isOpen && currentStats.length > 0) {
      const initial: Record<string, string> = {}
      currentStats.forEach(stat => {
        initial[stat.apiType] = stat.callCount.toString()
      })
      setSyncData(initial)
      setSyncError(null)
    }
  }, [isOpen, currentStats])
  
  const handleSync = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const data: Record<string, number> = {}
      Object.entries(syncData).forEach(([key, value]) => {
        const num = parseInt(value, 10)
        if (!isNaN(num) && num >= 0) {
          data[key] = num
        }
      })
      await onSync(data)
      onClose()
    } catch (err: any) {
      setSyncError(err.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h3 className="font-medium text-gray-900">同步 HERE 控制台数据</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            请登录 <a href="https://developer.here.com/projects" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">HERE 开发者控制台</a> 查看实际使用量，然后输入到下方对应字段：
          </p>
          
          <div className="space-y-3">
            {currentStats.map(stat => (
              <div key={stat.apiType} className="flex items-center gap-3">
                <label className="flex-1 text-sm text-gray-700">
                  {API_TYPE_LABELS[stat.apiType] || stat.apiType}
                </label>
                <input
                  type="number"
                  min="0"
                  value={syncData[stat.apiType] || ''}
                  onChange={(e) => setSyncData(prev => ({ ...prev, [stat.apiType]: e.target.value }))}
                  className="w-28 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="调用次数"
                />
              </div>
            ))}
          </div>
          
          {syncError && (
            <div className="p-2 bg-red-50 rounded text-sm text-red-600">
              {syncError}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
          >
            取消
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {syncing ? '同步中...' : '同步'}
          </button>
        </div>
      </div>
    </div>
  )
}

// API密钥设置模态框
function ApiKeyModal({
  isOpen,
  onClose,
  onSave,
  currentKeyMasked
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (apiKey: string) => Promise<void>
  currentKeyMasked?: string
}) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('请输入API密钥')
      return
    }

    setSaving(true)
    setError('')

    try {
      await onSave(apiKey.trim())
      setApiKey('')
      onClose()
    } catch (err) {
      setError((err as Error).message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            <h3 className="font-medium text-gray-900">设置 HERE API 密钥</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 当前状态 */}
          {currentKeyMasked && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span>当前已配置密钥: {currentKeyMasked}</span>
            </div>
          )}

          {/* 提示 */}
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <Info className="w-4 h-4" />
            <span>从 <a href="https://developer.here.com/projects" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">HERE Developer</a> 获取 API Key</span>
          </div>

          {/* API Key 输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="请输入HERE API Key"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 主组件
export default function HereApiUsageCard() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [apiKeyMasked, setApiKeyMasked] = useState<string | undefined>(undefined)
  
  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/inquiry/here-api/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        setStats(data.data)
        setError(null)
      } else {
        setError(data.msg || '获取数据失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  // 同步使用量
  const handleSync = async (syncData: Record<string, number>) => {
    const token = localStorage.getItem('token')
    const errors: string[] = []
    
    // 构建 headers，只有在 token 存在时才添加 Authorization
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    for (const [apiType, count] of Object.entries(syncData)) {
      try {
        const res = await fetch(`${API_BASE}/api/inquiry/here-api/usage/sync`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ apiType, count })
        })
        const data = await res.json()
        if (data.errCode !== 200) {
          errors.push(`${apiType}: ${data.msg}`)
        }
      } catch (err) {
        errors.push(`${apiType}: 网络错误`)
      }
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }
    
    // 刷新数据
    await fetchStats(true)
  }
  
  // 获取API密钥状态
  const fetchApiKeyStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/api/api-integrations/here_geocoding`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      const data = await res.json()
      if (data.errCode === 200 && data.data) {
        setApiKeyMasked(data.data.api_key_masked)
      }
    } catch (err) {
      console.error('获取API密钥状态失败:', err)
    }
  }

  // 保存API密钥
  const handleSaveApiKey = async (apiKey: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/api/api-integrations/here_geocoding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ apiKey })
    })
    const data = await res.json()

    if (data.errCode !== 200) {
      throw new Error(data.msg || '保存失败')
    }

    // 更新密钥显示状态
    await fetchApiKeyStatus()
  }

  useEffect(() => {
    fetchStats()
    fetchApiKeyStatus()
  }, [])
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    )
  }
  
  if (!stats) return null
  
  // 计算总体状态
  const hasWarning = stats.stats.some(s => s.status === 'warning')
  const hasBlocked = stats.stats.some(s => s.status === 'blocked')
  const overallStatus = hasBlocked ? 'blocked' : hasWarning ? 'warning' : 'normal'
  const overallConfig = statusConfig[overallStatus]
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <MapPin className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">HERE Maps API</h3>
            <p className="text-xs text-gray-500">{stats.yearMonth} 使用统计</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${overallConfig.color} ${overallConfig.bgColor}`}>
            {overallConfig.label}
          </span>
          <button
            onClick={() => setShowKeyModal(true)}
            className={`p-1.5 hover:bg-gray-100 rounded-lg transition-colors ${apiKeyMasked ? '' : 'text-amber-500'}`}
            title={apiKeyMasked ? '修改API密钥' : '设置API密钥'}
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSyncModal(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="同步 HERE 控制台数据"
          >
            <Upload className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* 简要统计 */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {stats.summary.totalCalls.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500">本月调用</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-lg font-semibold text-green-600">
              {stats.summary.totalCacheHits.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500">缓存命中</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-lg font-semibold text-blue-600">
              {stats.summary.cacheHitRate}%
            </div>
            <div className="text-[10px] text-gray-500">命中率</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="text-lg font-semibold text-red-600">
              {stats.summary.totalErrors}
            </div>
            <div className="text-[10px] text-gray-500">错误数</div>
          </div>
        </div>
        
        {/* 展开/收起详情 */}
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-2"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          {showDetail ? '收起详情' : '查看各 API 详情'}
        </button>
        
        {/* 详细统计 */}
        {showDetail && (
          <div className="mt-3 space-y-3">
            {stats.stats.map(stat => (
              <ApiUsageItem key={stat.apiType} stat={stat} />
            ))}
          </div>
        )}
        
        {/* 提示信息 */}
        {(hasWarning || hasBlocked) && (
          <div className={`mt-3 p-2 rounded-lg flex items-start gap-2 ${
            hasBlocked ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            <AlertTriangle className={`w-4 h-4 mt-0.5 ${hasBlocked ? 'text-red-600' : 'text-amber-600'}`} />
            <div className={`text-xs ${hasBlocked ? 'text-red-700' : 'text-amber-700'}`}>
              {hasBlocked 
                ? '部分 API 已达配额上限，相关功能已暂停。请联系管理员或等待下月配额刷新。' 
                : '部分 API 接近配额上限，请注意控制使用量。'
              }
            </div>
          </div>
        )}
        
        {/* 底部链接 */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Info className="w-3 h-3" />
            <span>缓存命中不消耗配额</span>
          </div>
          <a
            href="https://developer.here.com/projects"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
          >
            HERE 控制台 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      
      {/* 同步对话框 */}
      <SyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSync={handleSync}
        currentStats={stats.stats}
      />

      {/* API密钥设置对话框 */}
      <ApiKeyModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        onSave={handleSaveApiKey}
        currentKeyMasked={apiKeyMasked}
      />
    </div>
  )
}

