import { useState, useEffect, useCallback } from 'react'
import { 
  Link2, RefreshCw, Settings, DollarSign, Activity, Server, 
  FileText, Ship, HardDrive, Languages, Calculator, BadgeCheck,
  ShieldCheck, Globe, ExternalLink, Plus, AlertTriangle, 
  CheckCircle, XCircle, Clock, Loader2, TrendingUp, Wallet,
  ChevronRight, Info, Download, X, Building2, MapPin
} from 'lucide-react'
import { getApiBaseUrl } from '../utils/api'
import HereApiUsageCard from '../components/HereApiUsageCard'

const API_BASE = getApiBaseUrl()

// 分类图标映射
const categoryIcons: Record<string, React.ElementType> = {
  tracking: Ship,
  ocr: FileText,
  storage: HardDrive,
  finance: DollarSign,
  translation: Languages,
  tariff: Calculator,
  validation: BadgeCheck,
  business_info: Building2,
  infrastructure: Server,
  geocoding: MapPin,
  other: Link2
}

// 分类名称映射
const categoryNames: Record<string, string> = {
  tracking: '物流跟踪',
  ocr: '文档识别',
  storage: '云存储',
  finance: '财务服务',
  translation: '翻译服务',
  tariff: '关税查询',
  validation: '号码验证',
  business_info: '工商信息',
  infrastructure: '基础设施',
  geocoding: '地图服务',
  other: '其他'
}

// 健康状态配置
const healthStatusConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
  online: { color: 'text-green-600', bgColor: 'bg-green-500', icon: CheckCircle, label: '正常' },
  degraded: { color: 'text-yellow-600', bgColor: 'bg-yellow-500', icon: AlertTriangle, label: '异常' },
  offline: { color: 'text-red-600', bgColor: 'bg-red-500', icon: XCircle, label: '离线' },
  unknown: { color: 'text-gray-400', bgColor: 'bg-gray-400', icon: Clock, label: '未知' }
}

interface CosStorageInfo {
  usedGB: number
  quotaGB: number
  usagePercent: string
  bucket: string
  region: string
  estimated?: boolean
}

interface ApiIntegration {
  id: number
  api_code: string
  api_name: string
  provider: string
  category: string
  api_url: string
  health_check_url: string
  pricing_model: string
  unit_price: number
  currency: string
  balance: number
  total_recharged: number
  total_consumed: number
  alert_threshold: number
  recharge_url: string
  status: string
  health_status: string
  last_health_check: string
  health_check_message: string
  response_time_ms: number
  last_sync_time: string | null
  description: string
  icon: string
  month_calls: number
  month_cost: number
  config_json?: string  // 存储额外配置信息（如COS存储量）
}

interface Stats {
  total: number
  online: number
  offline: number
  degraded: number
  unknown: number
  lowBalance: number
  monthTotalCost: number
}

// 健康状态指示灯组件
function HealthIndicator({ 
  status, 
  responseTime, 
  lastCheck, 
  message,
  onCheck,
  checking
}: { 
  status: string
  responseTime?: number
  lastCheck?: string
  message?: string
  onCheck?: () => void
  checking?: boolean
}) {
  const config = healthStatusConfig[status] || healthStatusConfig.unknown
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={onCheck}
        disabled={checking}
        className="flex items-center gap-1.5 group"
        title="点击检查"
      >
        {checking ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        ) : (
          <div className={`w-2.5 h-2.5 rounded-full ${config.bgColor} animate-pulse`} />
        )}
        <span className={`text-xs ${config.color}`}>{config.label}</span>
      </button>
      
      {/* Tooltip */}
      {showTooltip && !checking && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-gray-900 text-white text-xs rounded-lg p-2 min-w-[180px] shadow-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <config.icon className="w-3 h-3" />
            <span className="font-medium">{config.label}</span>
          </div>
          {responseTime !== undefined && (
            <div className="text-gray-300">响应时间: {responseTime}ms</div>
          )}
          {message && (
            <div className="text-gray-300 truncate">{message}</div>
          )}
          {lastCheck && (
            <div className="text-gray-400 mt-1 text-[10px]">
              上次检查: {new Date(lastCheck).toLocaleString()}
            </div>
          )}
          <div className="text-gray-400 mt-1 text-[10px]">点击重新检查</div>
        </div>
      )}
    </div>
  )
}

// 支持自动同步的API列表
const syncableApis = ['tencent_ocr', 'tencent_cos']

// 格式化存储空间大小
function formatStorageSize(sizeGB: number): string {
  if (sizeGB < 1) {
    return `${(sizeGB * 1024).toFixed(1)} MB`
  } else if (sizeGB >= 1024) {
    return `${(sizeGB / 1024).toFixed(2)} TB`
  }
  return `${sizeGB.toFixed(2)} GB`
}

// 解析 config_json 获取 COS 存储信息
function parseCosStorage(configJson?: string): CosStorageInfo | null {
  if (!configJson) return null
  try {
    const config = JSON.parse(configJson)
    return config.storage || null
  } catch {
    return null
  }
}

// API卡片组件 - 与 HereApiUsageCard 样式一致
function ApiCard({ 
  api, 
  onHealthCheck, 
  checking,
  onSync,
  syncing
}: { 
  api: ApiIntegration
  onHealthCheck: (code: string) => void
  checking: boolean
  onSync?: (code: string) => void
  syncing?: boolean
}) {
  const CategoryIcon = categoryIcons[api.category] || Link2
  const balance = Number(api.balance || 0)
  const alertThreshold = Number(api.alert_threshold || 0)
  const isLowBalance = api.pricing_model !== 'free' && balance > 0 && balance <= alertThreshold
  const canSync = syncableApis.includes(api.api_code)
  
  // 解析COS存储信息
  const cosStorage = api.api_code === 'tencent_cos' ? parseCosStorage(api.config_json) : null
  
  // 格式化同步时间
  const formatSyncTime = (time: string | null) => {
    if (!time) return null
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return `${days}天前`
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 头部 - 与 HereApiUsageCard 一致 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gray-100 rounded-lg">
            <CategoryIcon className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">{api.api_name}</h3>
            <p className="text-xs text-gray-500">{api.provider}</p>
          </div>
        </div>
        <HealthIndicator
          status={api.health_status}
          responseTime={api.response_time_ms}
          lastCheck={api.last_health_check}
          message={api.health_check_message}
          onCheck={() => onHealthCheck(api.api_code)}
          checking={checking}
        />
      </div>
      
      {/* 内容区域 */}
      <div className="p-4">
        {/* 描述 */}
        {api.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{api.description}</p>
        )}
        
        {/* 统计数据 - 4列网格与 HereApiUsageCard 一致 */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="text-center p-2 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {Number(api.month_calls || 0) > 0 ? (
                Number(api.month_calls).toLocaleString()
              ) : canSync ? (
                <span className="text-sm text-gray-400">-</span>
              ) : '0'}
            </div>
            <div className="text-[10px] text-gray-500">本月调用</div>
          </div>
          {api.pricing_model !== 'free' ? (
            <div className={`text-center p-2 rounded-lg ${isLowBalance ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className={`text-lg font-semibold ${isLowBalance ? 'text-red-600' : 'text-green-600'}`}>
                {balance.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500">当前余额</div>
            </div>
          ) : (
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="text-lg font-semibold text-green-600">免费</div>
              <div className="text-[10px] text-gray-500">计费模式</div>
            </div>
          )}
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-lg font-semibold text-blue-600">
              {canSync && Number(api.month_cost || 0) > 0 
                ? `¥${Number(api.month_cost).toFixed(0)}` 
                : '-'}
            </div>
            <div className="text-[10px] text-gray-500">本月费用</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <div className="text-lg font-semibold text-purple-600">
              {api.response_time_ms ? `${api.response_time_ms}ms` : '-'}
            </div>
            <div className="text-[10px] text-gray-500">响应时间</div>
          </div>
        </div>
        
        {/* COS存储空间使用情况（仅COS显示） */}
        {api.api_code === 'tencent_cos' && cosStorage && cosStorage.usedGB > 0 && (
          <div className="bg-purple-50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600 font-medium">
                存储空间 {cosStorage.estimated && <span className="text-amber-500">(估算)</span>}
              </span>
              <span className="text-sm font-semibold text-purple-600">
                {formatStorageSize(cosStorage.usedGB)}
              </span>
            </div>
            {/* 存储进度条 */}
            <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  parseFloat(cosStorage.usagePercent) > 80 
                    ? 'bg-red-500' 
                    : parseFloat(cosStorage.usagePercent) > 50 
                      ? 'bg-amber-500' 
                      : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(parseFloat(cosStorage.usagePercent), 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-gray-400">
                {cosStorage.bucket}
              </span>
              <span className="text-[10px] text-gray-400">
                配额: {formatStorageSize(cosStorage.quotaGB)}
              </span>
            </div>
          </div>
        )}
        
        {/* COS存储桶信息（未同步时显示提示） */}
        {api.api_code === 'tencent_cos' && (!cosStorage || cosStorage.usedGB === 0) && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">点击同步获取存储空间使用情况</span>
            </div>
          </div>
        )}
        
        {/* 同步时间提示 */}
        {canSync && api.last_sync_time && (
          <div className="text-[10px] text-gray-400 mb-3 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            上次同步: {formatSyncTime(api.last_sync_time)}
          </div>
        )}
        
        {/* 底部操作 - 与 HereApiUsageCard 一致 */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Info className="w-3 h-3" />
            <span>{categoryNames[api.category] || api.category}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 同步按钮 - 仅对支持同步的API显示 */}
            {canSync && onSync && (
              <button
                onClick={() => onSync(api.api_code)}
                disabled={syncing}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                title="从腾讯云同步余额"
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                同步
              </button>
            )}
            {api.recharge_url && api.pricing_model !== 'free' && (
              <a
                href={api.recharge_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                充值 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 统计详情模态框类型
type StatsModalType = 'total' | 'online' | 'degraded' | 'offline' | 'lowBalance' | 'cost' | null

// 统计详情模态框组件
function StatsDetailModal({
  type,
  apis,
  onClose
}: {
  type: StatsModalType
  apis: ApiIntegration[]
  onClose: () => void
}) {
  if (!type) return null
  
  // 根据类型筛选API列表
  const getFilteredApis = () => {
    switch (type) {
      case 'total':
        return apis
      case 'online':
        return apis.filter(api => api.health_status === 'online')
      case 'degraded':
        return apis.filter(api => api.health_status === 'degraded')
      case 'offline':
        return apis.filter(api => api.health_status === 'offline')
      case 'lowBalance':
        return apis.filter(api => {
          const balance = Number(api.balance || 0)
          const threshold = Number(api.alert_threshold || 0)
          return api.pricing_model !== 'free' && balance > 0 && balance <= threshold
        })
      case 'cost':
        return apis.filter(api => Number(api.month_cost || 0) > 0)
      default:
        return []
    }
  }
  
  const filteredApis = getFilteredApis()
  
  // 模态框标题配置
  const modalConfig: Record<string, { title: string; icon: React.ElementType; color: string; bgColor: string }> = {
    total: { title: '全部服务', icon: Server, color: 'text-gray-600', bgColor: 'bg-gray-100' },
    online: { title: '正常运行', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
    degraded: { title: '异常/缓慢', icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    offline: { title: '离线服务', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
    lowBalance: { title: '余额不足', icon: Wallet, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    cost: { title: '本月有消费', icon: TrendingUp, color: 'text-primary-600', bgColor: 'bg-primary-100' }
  }
  
  const config = modalConfig[type]
  const Icon = config.icon
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 模态框内容 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
              <p className="text-sm text-gray-500">共 {filteredApis.length} 个服务</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* 列表内容 */}
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {filteredApis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Icon className={`w-12 h-12 mx-auto mb-3 ${config.color} opacity-30`} />
              <p>暂无相关服务</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredApis.map(api => {
                const CategoryIcon = categoryIcons[api.category] || Link2
                const statusConfig = healthStatusConfig[api.health_status] || healthStatusConfig.unknown
                const balance = Number(api.balance || 0)
                const monthCost = Number(api.month_cost || 0)
                
                return (
                  <div
                    key={api.api_code}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-gray-200">
                        <CategoryIcon className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{api.api_name}</span>
                          <div className={`w-2 h-2 rounded-full ${statusConfig.bgColor}`} />
                        </div>
                        <p className="text-xs text-gray-500">{api.provider} · {categoryNames[api.category]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {type === 'cost' ? (
                        <div className="text-sm font-medium text-gray-900">
                          ${monthCost.toFixed(2)}
                        </div>
                      ) : type === 'lowBalance' ? (
                        <div className="text-sm font-medium text-orange-600">
                          {api.currency} {balance.toFixed(2)}
                        </div>
                      ) : (
                        <div className={`text-xs ${statusConfig.color}`}>
                          {statusConfig.label}
                        </div>
                      )}
                      {api.response_time_ms && (
                        <div className="text-[10px] text-gray-400">
                          {api.response_time_ms}ms
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ApiIntegrations() {
  const [apis, setApis] = useState<ApiIntegration[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkingApi, setCheckingApi] = useState<string | null>(null)
  const [syncingApi, setSyncingApi] = useState<string | null>(null)
  const [statsModalType, setStatsModalType] = useState<StatsModalType>(null)
  
  // 加载API列表
  const loadApis = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/api-integrations`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setApis(data.data.list || [])
        setStats(data.data.stats || null)
      }
    } catch (error) {
      console.error('加载API列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    loadApis()
  }, [loadApis])
  
  // 单个API健康检查
  const handleHealthCheck = async (apiCode: string) => {
    setCheckingApi(apiCode)
    try {
      const res = await fetch(`${API_BASE}/api/api-integrations/${apiCode}/health-check`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        // 更新本地状态
        setApis(prev => prev.map(api => 
          api.api_code === apiCode 
            ? { 
                ...api, 
                health_status: data.data.status,
                response_time_ms: data.data.responseTime,
                health_check_message: data.data.message,
                last_health_check: data.data.checkTime
              }
            : api
        ))
      }
    } catch (error) {
      console.error('健康检查失败:', error)
    } finally {
      setCheckingApi(null)
    }
  }
  
  // 批量健康检查
  const handleHealthCheckAll = async () => {
    setCheckingAll(true)
    try {
      const res = await fetch(`${API_BASE}/api/api-integrations/health-check-all`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        // 重新加载列表
        await loadApis()
      }
    } catch (error) {
      console.error('批量健康检查失败:', error)
    } finally {
      setCheckingAll(false)
    }
  }
  
  // 单个API数据同步（从云端获取余额等）
  const handleSyncData = async (apiCode: string) => {
    setSyncingApi(apiCode)
    try {
      const res = await fetch(`${API_BASE}/api/api-integrations/${apiCode}/sync-data`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (data.errCode === 200 && data.data.api) {
        // 更新本地状态
        setApis(prev => prev.map(api => 
          api.api_code === apiCode ? { ...api, ...data.data.api } : api
        ))
      } else {
        alert(data.msg || '同步失败')
      }
    } catch (error) {
      console.error('同步数据失败:', error)
      alert('同步失败，请检查网络连接')
    } finally {
      setSyncingApi(null)
    }
  }
  
  // 按分类分组
  const groupedApis = apis.reduce((acc, api) => {
    const category = api.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(api)
    return acc
  }, {} as Record<string, ApiIntegration[]>)
  
  // 分类顺序
  const categoryOrder = ['tracking', 'ocr', 'storage', 'finance', 'translation', 'tariff', 'validation', 'business_info', 'geocoding', 'infrastructure', 'other']
  
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Link2 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">API对接管理</h1>
              <p className="text-xs text-gray-500">管理已对接的第三方API服务和基础设施</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleHealthCheckAll}
              disabled={checkingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {checkingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              全部检查
            </button>
          </div>
        </div>
      </div>
      
      {/* 统计卡片 */}
      {stats && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-6 gap-3">
            <button
              onClick={() => setStatsModalType('total')}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-gray-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">总服务数</p>
                  <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Server className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatsModalType('online')}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-green-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">正常运行</p>
                  <p className="text-xl font-bold text-green-600">{stats.online}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatsModalType('degraded')}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-yellow-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">异常/缓慢</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.degraded}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatsModalType('offline')}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-red-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">离线</p>
                  <p className="text-xl font-bold text-red-600">{stats.offline}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatsModalType('lowBalance')}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-orange-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">余额不足</p>
                  <p className="text-xl font-bold text-orange-600">{stats.lowBalance}</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Wallet className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setStatsModalType('cost')}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md hover:border-primary-300 transition-all text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">本月消费</p>
                  <p className="text-xl font-bold text-primary-600">
                    ${Number(stats.monthTotalCost || 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-2 bg-primary-100 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-primary-600" />
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* HERE API 使用统计卡片 */}
      <div className="px-4 py-2">
        <HereApiUsageCard />
      </div>
      
      
      {/* API列表 */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <div className="space-y-4">
          {categoryOrder.map(cat => {
            const categoryApis = groupedApis[cat]
            if (!categoryApis || categoryApis.length === 0) return null
            
            const Icon = categoryIcons[cat]
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-700">{categoryNames[cat]}</h2>
                  <span className="text-xs text-gray-400">({categoryApis.length})</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {categoryApis.map(api => (
                    <ApiCard
                      key={api.api_code}
                      api={api}
                      onHealthCheck={handleHealthCheck}
                      checking={checkingApi === api.api_code}
                      onSync={handleSyncData}
                      syncing={syncingApi === api.api_code}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        
        {apis.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Link2 className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">暂无API服务</p>
          </div>
        )}
      </div>
      
      {/* 提示信息 */}
      <div className="px-4 py-2 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5" />
          <span>点击状态指示灯可手动检查API健康状态。绿色=正常，黄色=缓慢，红色=离线，灰色=未知</span>
        </div>
      </div>
      
      {/* 统计详情模态框 */}
      {statsModalType && (
        <StatsDetailModal
          type={statsModalType}
          apis={apis}
          onClose={() => setStatsModalType(null)}
        />
      )}
    </div>
  )
}
