import { 
  Shield, Save, Loader2, RefreshCw, Info, Lock, Mail, Clock, Key, History,
  AlertTriangle, Globe, Users, Database, Eye, Trash2, Play, FileDown,
  Activity, Ban, CheckCircle, XCircle
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../contexts/AuthContext'

// API 基础地址
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

// 类型定义
interface SecurityOverview {
  failedLoginsToday: number
  activeSessions: number
  blockedIps: number
  auditLogsLast7Days: number
  lastBackup: {
    name: string
    status: string
    time: string
  } | null
  recentFailedUsers: Array<{
    username: string
    failCount: number
    lastAttempt: string
  }>
}

interface SecuritySettingGroup {
  name: string
  settings: Array<{
    key: string
    value: string | number | boolean
    type: string
    description: string
  }>
}

interface AuditLog {
  id: number
  userId: number | null
  username: string
  userRole: string
  actionType: string
  actionName: string
  resourceType: string
  resourceId: string
  resourceName: string
  description: string
  ipAddress: string
  result: string
  createdAt: string
}

interface IpBlacklistItem {
  id: number
  ipAddress: string
  reason: string
  blockedBy: string
  blockedAt: string
  expiresAt: string | null
  isActive: boolean
}

interface ActiveSession {
  id: number
  sessionId: string
  userId: number
  username: string
  name: string
  ipAddress: string
  deviceInfo: string
  loginTime: string
  lastActivity: string
}

interface BackupRecord {
  id: number
  backupName: string
  backupType: string
  backupStatus: string
  startedAt: string
  completedAt: string
  errorMessage: string | null
}

type TabType = 'overview' | 'settings' | 'audit' | 'blacklist' | 'sessions' | 'backup'

export default function SecurityCenter() {
  const { hasPermission, user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 概览数据
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  
  // 安全设置
  const [settingsGroups, setSettingsGroups] = useState<Record<string, SecuritySettingGroup>>({})
  const [modifiedSettings, setModifiedSettings] = useState<Record<string, string | number | boolean>>({})
  
  // 审计日志
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditPagination, setAuditPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [auditFilters, setAuditFilters] = useState({ username: '', actionType: '' })
  
  // IP黑名单
  const [blacklist, setBlacklist] = useState<IpBlacklistItem[]>([])
  const [blacklistPagination, setBlacklistPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  const [showAddIpModal, setShowAddIpModal] = useState(false)
  const [newIpData, setNewIpData] = useState({ ipAddress: '', reason: '', expiresInMinutes: '' })
  
  // 活动会话
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [sessionsPagination, setSessionsPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  
  // 备份记录
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [creatingBackup, setCreatingBackup] = useState(false)

  // 加载概览数据
  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/overview`)
      const data = await response.json()
      if (data.errCode === 200) {
        setOverview(data.data)
      }
    } catch (error) {
      console.error('加载安全概览失败:', error)
    }
  }, [])

  // 加载安全设置
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/settings`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSettingsGroups(data.data)
      }
    } catch (error) {
      console.error('加载安全设置失败:', error)
    }
  }, [])

  // 加载审计日志
  const loadAuditLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(auditPagination.page),
        pageSize: String(auditPagination.pageSize),
        ...(auditFilters.username && { username: auditFilters.username }),
        ...(auditFilters.actionType && { actionType: auditFilters.actionType })
      })
      const response = await fetch(`${API_BASE_URL}/api/security/audit-logs?${params}`)
      const data = await response.json()
      if (data.errCode === 200) {
        setAuditLogs(data.data.list)
        setAuditPagination(prev => ({ ...prev, total: data.data.total }))
      }
    } catch (error) {
      console.error('加载审计日志失败:', error)
    }
  }, [auditPagination.page, auditPagination.pageSize, auditFilters])

  // 加载IP黑名单
  const loadBlacklist = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(blacklistPagination.page),
        pageSize: String(blacklistPagination.pageSize)
      })
      const response = await fetch(`${API_BASE_URL}/api/security/ip-blacklist?${params}`)
      const data = await response.json()
      if (data.errCode === 200) {
        setBlacklist(data.data.list)
        setBlacklistPagination(prev => ({ ...prev, total: data.data.total }))
      }
    } catch (error) {
      console.error('加载IP黑名单失败:', error)
    }
  }, [blacklistPagination.page, blacklistPagination.pageSize])

  // 加载活动会话
  const loadSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(sessionsPagination.page),
        pageSize: String(sessionsPagination.pageSize)
      })
      const response = await fetch(`${API_BASE_URL}/api/security/active-sessions?${params}`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSessions(data.data.list)
        setSessionsPagination(prev => ({ ...prev, total: data.data.total }))
      }
    } catch (error) {
      console.error('加载活动会话失败:', error)
    }
  }, [sessionsPagination.page, sessionsPagination.pageSize])

  // 加载备份记录
  const loadBackups = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backups?limit=20`)
      const data = await response.json()
      if (data.errCode === 200) {
        setBackups(data.data)
      }
    } catch (error) {
      console.error('加载备份记录失败:', error)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await loadOverview()
      setLoading(false)
    }
    loadData()
  }, [loadOverview])

  // 切换标签时加载数据
  useEffect(() => {
    switch (activeTab) {
      case 'overview':
        loadOverview()
        break
      case 'settings':
        loadSettings()
        break
      case 'audit':
        loadAuditLogs()
        break
      case 'blacklist':
        loadBlacklist()
        break
      case 'sessions':
        loadSessions()
        break
      case 'backup':
        loadBackups()
        break
    }
  }, [activeTab, loadOverview, loadSettings, loadAuditLogs, loadBlacklist, loadSessions, loadBackups])

  // 保存安全设置
  const handleSaveSettings = async () => {
    if (Object.keys(modifiedSettings).length === 0) {
      alert('没有修改需要保存')
      return
    }
    
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: modifiedSettings })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('安全设置已保存')
        setModifiedSettings({})
        loadSettings()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存设置失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 修改设置值
  const handleSettingChange = (key: string, value: string | number | boolean) => {
    setModifiedSettings(prev => ({ ...prev, [key]: value }))
  }

  // 添加IP到黑名单
  const handleAddIpToBlacklist = async () => {
    if (!newIpData.ipAddress) {
      alert('请输入IP地址')
      return
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/ip-blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIpData)
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('IP已添加到黑名单')
        setShowAddIpModal(false)
        setNewIpData({ ipAddress: '', reason: '', expiresInMinutes: '' })
        loadBlacklist()
      } else {
        alert(data.msg || '添加失败')
      }
    } catch (error) {
      console.error('添加IP失败:', error)
      alert('添加失败')
    }
  }

  // 从黑名单移除IP
  const handleRemoveIp = async (ipAddress: string) => {
    if (!confirm(`确定要将 ${ipAddress} 从黑名单中移除吗？`)) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/ip-blacklist/${ipAddress}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('IP已从黑名单移除')
        loadBlacklist()
      } else {
        alert(data.msg || '移除失败')
      }
    } catch (error) {
      console.error('移除IP失败:', error)
      alert('移除失败')
    }
  }

  // 终止会话
  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('确定要强制终止该会话吗？')) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/active-sessions/${sessionId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('会话已终止')
        loadSessions()
      } else {
        alert(data.msg || '终止失败')
      }
    } catch (error) {
      console.error('终止会话失败:', error)
      alert('终止失败')
    }
  }

  // 创建备份
  const handleCreateBackup = async () => {
    if (!confirm('确定要立即执行数据库备份吗？')) return
    
    setCreatingBackup(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full' })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('备份任务已启动')
        setTimeout(loadBackups, 3000)
      } else {
        alert(data.msg || '备份失败')
      }
    } catch (error) {
      console.error('创建备份失败:', error)
      alert('创建备份失败')
    } finally {
      setCreatingBackup(false)
    }
  }

  // 渲染概览页
  const renderOverview = () => (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{overview?.failedLoginsToday || 0}</div>
              <div className="text-xs text-gray-500">今日登录失败</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{overview?.activeSessions || 0}</div>
              <div className="text-xs text-gray-500">活动会话</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Ban className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{overview?.blockedIps || 0}</div>
              <div className="text-xs text-gray-500">封禁IP</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{overview?.auditLogsLast7Days || 0}</div>
              <div className="text-xs text-gray-500">7天审计记录</div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近登录失败用户 & 备份状态 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            最近登录失败用户
          </h3>
          {overview?.recentFailedUsers && overview.recentFailedUsers.length > 0 ? (
            <div className="space-y-2">
              {overview.recentFailedUsers.map((u, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900">{u.username}</span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                      {u.failCount}次失败
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(u.lastAttempt).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">暂无登录失败记录</div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-green-500" />
            最近备份状态
          </h3>
          {overview?.lastBackup ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">备份名称</span>
                <span className="text-sm text-gray-900">{overview.lastBackup.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">状态</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  overview.lastBackup.status === 'completed' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {overview.lastBackup.status === 'completed' ? '已完成' : overview.lastBackup.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">时间</span>
                <span className="text-sm text-gray-900">
                  {new Date(overview.lastBackup.time).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">暂无备份记录</div>
          )}
        </div>
      </div>

      {/* 安全提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">安全建议</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 定期检查审计日志，及时发现异常活动</li>
              <li>• 为敏感操作启用两步验证</li>
              <li>• 定期更新密码，避免使用弱密码</li>
              <li>• 确保数据库备份正常运行</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )

  // 渲染设置页
  const renderSettings = () => (
    <div className="space-y-4">
      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
        <Info className="w-4 h-4 text-yellow-600 mt-0.5" />
        <div className="text-xs text-yellow-700">
          修改安全设置后请点击"保存"按钮生效。部分设置可能需要重新登录后才能完全生效。
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(settingsGroups).map(([key, group]) => (
          <div key={key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
            </div>
            <div className="p-4 space-y-4">
              {group.settings.map(setting => (
                <div key={setting.key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-gray-700">{setting.description}</div>
                    <div className="text-xs text-gray-400">{setting.key}</div>
                  </div>
                  <div className="ml-4">
                    {setting.type === 'boolean' ? (
                      <button
                        onClick={() => handleSettingChange(
                          setting.key, 
                          !(modifiedSettings[setting.key] ?? setting.value)
                        )}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          (modifiedSettings[setting.key] ?? setting.value) ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          (modifiedSettings[setting.key] ?? setting.value) ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                    ) : (
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                        value={modifiedSettings[setting.key] ?? setting.value}
                        onChange={(e) => handleSettingChange(
                          setting.key, 
                          setting.type === 'number' ? Number(e.target.value) : e.target.value
                        )}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // 审计日志列定义
  const auditColumns = [
    { 
      key: 'createdAt', 
      label: '时间',
      render: (item: AuditLog) => new Date(item.createdAt).toLocaleString('zh-CN')
    },
    { key: 'username', label: '用户' },
    { key: 'actionName', label: '操作' },
    { key: 'resourceType', label: '资源类型' },
    { key: 'resourceName', label: '资源' },
    { key: 'ipAddress', label: 'IP' },
    { 
      key: 'result', 
      label: '结果',
      render: (item: AuditLog) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {item.result === 'success' ? '成功' : '失败'}
        </span>
      )
    }
  ]

  // 黑名单列定义
  const blacklistColumns = [
    { key: 'ipAddress', label: 'IP地址' },
    { key: 'reason', label: '原因' },
    { key: 'blockedBy', label: '操作人' },
    { 
      key: 'blockedAt', 
      label: '封禁时间',
      render: (item: IpBlacklistItem) => new Date(item.blockedAt).toLocaleString('zh-CN')
    },
    { 
      key: 'expiresAt', 
      label: '过期时间',
      render: (item: IpBlacklistItem) => item.expiresAt 
        ? new Date(item.expiresAt).toLocaleString('zh-CN') 
        : '永久'
    },
    { 
      key: 'isActive', 
      label: '状态',
      render: (item: IpBlacklistItem) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.isActive ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.isActive ? '生效中' : '已解除'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: IpBlacklistItem) => (
        <button
          onClick={() => handleRemoveIp(item.ipAddress)}
          disabled={!item.isActive}
          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
          title="移除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    }
  ]

  // 会话列定义
  const sessionColumns = [
    { key: 'username', label: '用户' },
    { key: 'name', label: '姓名' },
    { key: 'ipAddress', label: 'IP地址' },
    { 
      key: 'loginTime', 
      label: '登录时间',
      render: (item: ActiveSession) => new Date(item.loginTime).toLocaleString('zh-CN')
    },
    { 
      key: 'lastActivity', 
      label: '最后活动',
      render: (item: ActiveSession) => new Date(item.lastActivity).toLocaleString('zh-CN')
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: ActiveSession) => (
        <button
          onClick={() => handleTerminateSession(item.sessionId)}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="强制下线"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )
    }
  ]

  // 备份列定义
  const backupColumns = [
    { key: 'backupName', label: '备份名称' },
    { 
      key: 'backupType', 
      label: '类型',
      render: (item: BackupRecord) => item.backupType === 'full' ? '完整备份' : '增量备份'
    },
    { 
      key: 'backupStatus', 
      label: '状态',
      render: (item: BackupRecord) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.backupStatus === 'completed' ? 'bg-green-100 text-green-700' :
          item.backupStatus === 'running' ? 'bg-blue-100 text-blue-700' :
          'bg-red-100 text-red-700'
        }`}>
          {item.backupStatus === 'completed' ? '完成' :
           item.backupStatus === 'running' ? '进行中' : '失败'}
        </span>
      )
    },
    { 
      key: 'startedAt', 
      label: '开始时间',
      render: (item: BackupRecord) => item.startedAt 
        ? new Date(item.startedAt).toLocaleString('zh-CN') 
        : '-'
    },
    { 
      key: 'completedAt', 
      label: '完成时间',
      render: (item: BackupRecord) => item.completedAt 
        ? new Date(item.completedAt).toLocaleString('zh-CN') 
        : '-'
    }
  ]

  // 渲染审计日志页
  const renderAudit = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="搜索用户名..."
          title="输入用户名进行搜索"
          aria-label="搜索用户名"
          value={auditFilters.username}
          onChange={(e) => setAuditFilters(prev => ({ ...prev, username: e.target.value }))}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={auditFilters.actionType}
          onChange={(e) => setAuditFilters(prev => ({ ...prev, actionType: e.target.value }))}
          title="筛选操作类型"
          aria-label="筛选操作类型"
          className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">全部操作</option>
          <option value="login">登录</option>
          <option value="user_create">创建用户</option>
          <option value="user_update">更新用户</option>
          <option value="user_delete">删除用户</option>
          <option value="permission_change">权限变更</option>
          <option value="data_export">数据导出</option>
        </select>
        <button
          onClick={loadAuditLogs}
          title="刷新审计日志"
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>
      
      <DataTable columns={auditColumns} data={auditLogs} compact />
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700">
          共 <span className="font-medium">{auditPagination.total}</span> 条记录
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuditPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={auditPagination.page <= 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="text-sm text-gray-700">
            第 {auditPagination.page} / {Math.ceil(auditPagination.total / auditPagination.pageSize) || 1} 页
          </span>
          <button
            onClick={() => setAuditPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={auditPagination.page >= Math.ceil(auditPagination.total / auditPagination.pageSize)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
          <select
            value={auditPagination.pageSize}
            onChange={(e) => setAuditPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
          >
            <option value={10}>10 条/页</option>
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
        </div>
      </div>
    </div>
  )

  // 渲染黑名单页
  const renderBlacklist = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          共 {blacklistPagination.total} 个封禁IP
        </span>
        <button
          onClick={() => setShowAddIpModal(true)}
          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
        >
          <Ban className="w-4 h-4" />
          添加IP
        </button>
      </div>
      
      <DataTable columns={blacklistColumns} data={blacklist} compact />

      {/* 添加IP弹窗 */}
      {showAddIpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">添加IP到黑名单</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">IP地址 *</label>
                <input
                  type="text"
                  value={newIpData.ipAddress}
                  onChange={(e) => setNewIpData(prev => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder="例如: 192.168.1.100"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">封禁原因</label>
                <input
                  type="text"
                  value={newIpData.reason}
                  onChange={(e) => setNewIpData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="例如: 多次登录失败"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">过期时间（分钟，留空永久）</label>
                <input
                  type="number"
                  value={newIpData.expiresInMinutes}
                  onChange={(e) => setNewIpData(prev => ({ ...prev, expiresInMinutes: e.target.value }))}
                  placeholder="例如: 60"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddIpModal(false)}
                className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddIpToBlacklist}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // 渲染会话页
  const renderSessions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          共 {sessionsPagination.total} 个活动会话
        </span>
        <button
          onClick={loadSessions}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>
      
      <DataTable columns={sessionColumns} data={sessions} compact />
    </div>
  )

  // 渲染备份页
  const renderBackup = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          最近 {backups.length} 条备份记录
        </span>
        <div className="flex gap-2">
          <button
            onClick={loadBackups}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1 disabled:opacity-50"
          >
            {creatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            立即备份
          </button>
        </div>
      </div>
      
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p>系统已配置自动备份，每天凌晨3点执行完整备份。</p>
            <p>备份文件将保留最近30天的记录。</p>
          </div>
        </div>
      </div>
      
      <DataTable columns={backupColumns} data={backups} compact />
    </div>
  )

  // 获取当前Tab内容
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'settings':
        return renderSettings()
      case 'audit':
        return renderAudit()
      case 'blacklist':
        return renderBlacklist()
      case 'sessions':
        return renderSessions()
      case 'backup':
        return renderBackup()
      default:
        return null
    }
  }

  const tabs = [
    { key: 'overview', label: '安全概览', icon: <Shield className="w-4 h-4" /> },
    { key: 'settings', label: '安全设置', icon: <Lock className="w-4 h-4" /> },
    { key: 'audit', label: '审计日志', icon: <History className="w-4 h-4" /> },
    { key: 'blacklist', label: 'IP黑名单', icon: <Ban className="w-4 h-4" /> },
    { key: 'sessions', label: '活动会话', icon: <Users className="w-4 h-4" /> },
    { key: 'backup', label: '数据备份', icon: <Database className="w-4 h-4" /> },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="安全管理中心"
        icon={<Shield className="w-4 h-4 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system' },
          { label: '安全管理中心' }
        ]}
        actionButtons={
          activeTab === 'settings' && Object.keys(modifiedSettings).length > 0 && (
            <button 
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs flex items-center gap-1 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存设置
            </button>
          )
        }
      />

      {/* Tab导航 */}
      <div className="border-b border-gray-200 px-4">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2 text-sm flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-600">加载中...</span>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  )
}
