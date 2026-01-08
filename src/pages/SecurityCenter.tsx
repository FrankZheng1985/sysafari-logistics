import { 
  Shield, Save, Loader2, RefreshCw, Info, Lock, Mail, Clock, Key, History,
  AlertTriangle, Globe, Users, Database, Eye, Trash2, Play, FileDown,
  Activity, Ban, CheckCircle, XCircle, Cloud, CloudOff, Download, RotateCcw,
  Settings, HardDrive
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import NoPermission from '../components/NoPermission'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTime } from '../utils/dateFormat'

import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

// API 基础地址
const API_BASE_URL = getApiBaseUrl()

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
  backupSize: number | null
  backupPath: string | null
  backupStatus: string
  startedAt: string
  completedAt: string
  errorMessage: string | null
  cosKey: string | null
  isCloudSynced: boolean
  fileName: string | null
  description: string | null
  restoredAt: string | null
  restoreCount: number
  createdAt: string
}

interface BackupSettings {
  enabled: boolean
  frequency: string
  time: string
  retentionCount: number
  uploadToCos: boolean
  cosConfigured: boolean
}

type TabType = 'overview' | 'settings' | 'audit' | 'blacklist' | 'sessions' | 'backup'

export default function SecurityCenter() {
  const { hasPermission, user, isAdmin, isManager } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 页面级权限检查
  const canAccessPage = isAdmin() || isManager() || hasPermission('system:security')
  
  if (!canAccessPage) {
    return (
      <NoPermission 
        message="您没有安全管理中心权限，请联系管理员。"
      />
    )
  }
  
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
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [savingBackupSettings, setSavingBackupSettings] = useState(false)

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
      const response = await fetch(`${API_BASE_URL}/api/security/backups?limit=30`)
      const data = await response.json()
      if (data.errCode === 200) {
        setBackups(data.data)
      }
    } catch (error) {
      console.error('加载备份记录失败:', error)
    }
  }, [])

  // 加载备份设置
  const loadBackupSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backup-settings`)
      const data = await response.json()
      if (data.errCode === 200) {
        setBackupSettings(data.data)
      }
    } catch (error) {
      console.error('加载备份设置失败:', error)
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
        loadBackupSettings()
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
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
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
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
    if (!confirm('确定要立即执行数据库备份吗？\n备份将上传到腾讯云 COS 存储。')) return
    
    setCreatingBackup(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ type: 'full' })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('备份任务已启动，请稍后刷新查看结果')
        setTimeout(loadBackups, 5000)
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

  // 删除备份
  const handleDeleteBackup = async (backup: BackupRecord) => {
    if (!confirm(`确定要删除备份 "${backup.backupName}" 吗？\n此操作将同时删除本地和云端的备份文件，无法恢复！`)) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backups/${backup.id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() }
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('备份已删除')
        loadBackups()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除备份失败:', error)
      alert('删除失败')
    }
  }

  // 下载备份
  const handleDownloadBackup = async (backup: BackupRecord) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backups/${backup.id}/download`)
      const data = await response.json()
      if (data.errCode === 200 && data.data?.downloadUrl) {
        // 打开下载链接
        window.open(data.data.downloadUrl, '_blank')
      } else {
        alert(data.msg || '获取下载链接失败')
      }
    } catch (error) {
      console.error('下载备份失败:', error)
      alert('下载失败')
    }
  }

  // 打开恢复确认弹窗
  const handleOpenRestoreModal = (backup: BackupRecord) => {
    setRestoreTarget(backup)
    setShowRestoreModal(true)
  }

  // 执行恢复
  const handleRestoreBackup = async () => {
    if (!restoreTarget) return
    
    setRestoring(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backups/${restoreTarget.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ noBackupBefore: false })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('恢复任务已启动，请稍后查看结果。\n注意：恢复过程中系统可能需要重启。')
        setShowRestoreModal(false)
        setRestoreTarget(null)
        setTimeout(loadBackups, 3000)
      } else {
        alert(data.msg || '恢复失败')
      }
    } catch (error) {
      console.error('恢复失败:', error)
      alert('恢复失败')
    } finally {
      setRestoring(false)
    }
  }

  // 保存备份设置
  const handleSaveBackupSettings = async () => {
    if (!backupSettings) return
    
    setSavingBackupSettings(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/backup-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(backupSettings)
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('备份设置已保存')
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存备份设置失败:', error)
      alert('保存失败')
    } finally {
      setSavingBackupSettings(false)
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
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
                    {formatDateTime(u.lastAttempt)}
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
                  {formatDateTime(overview.lastBackup.time)}
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
                        value={String(modifiedSettings[setting.key] ?? setting.value ?? '')}
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
      sorter: (a: AuditLog, b: AuditLog) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (_value: unknown, record: AuditLog) => formatDateTime(record.createdAt)
    },
    { key: 'username', label: '用户', sorter: true },
    { key: 'actionName', label: '操作', sorter: true },
    { key: 'resourceType', label: '资源类型', sorter: true },
    { key: 'resourceName', label: '资源', sorter: true },
    { key: 'ipAddress', label: 'IP', sorter: true },
    { 
      key: 'result', 
      label: '结果',
      sorter: true,
      render: (_value: unknown, record: AuditLog) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          record.result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {record.result === 'success' ? '成功' : '失败'}
        </span>
      )
    }
  ]

  // 黑名单列定义
  const blacklistColumns = [
    { key: 'ipAddress', label: 'IP地址', sorter: true },
    { key: 'reason', label: '原因', sorter: true },
    { key: 'blockedBy', label: '操作人', sorter: true },
    { 
      key: 'blockedAt', 
      label: '封禁时间',
      sorter: (a: IpBlacklistItem, b: IpBlacklistItem) => new Date(a.blockedAt).getTime() - new Date(b.blockedAt).getTime(),
      render: (_value: unknown, record: IpBlacklistItem) => formatDateTime(record.blockedAt)
    },
    { 
      key: 'expiresAt', 
      label: '过期时间',
      sorter: (a: IpBlacklistItem, b: IpBlacklistItem) => {
        const timeA = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity
        const timeB = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity
        return timeA - timeB
      },
      render: (_value: unknown, record: IpBlacklistItem) => record.expiresAt 
        ? formatDateTime(record.expiresAt) 
        : '永久'
    },
    { 
      key: 'isActive', 
      label: '状态',
      sorter: true,
      render: (_value: unknown, record: IpBlacklistItem) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          record.isActive ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {record.isActive ? '生效中' : '已解除'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value: unknown, record: IpBlacklistItem) => (
        <button
          onClick={() => handleRemoveIp(record.ipAddress)}
          disabled={!record.isActive}
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
    { key: 'username', label: '用户', sorter: true },
    { key: 'name', label: '姓名', sorter: true },
    { key: 'ipAddress', label: 'IP地址', sorter: true },
    { 
      key: 'loginTime', 
      label: '登录时间',
      sorter: (a: ActiveSession, b: ActiveSession) => new Date(a.loginTime).getTime() - new Date(b.loginTime).getTime(),
      render: (_value: unknown, record: ActiveSession) => formatDateTime(record.loginTime)
    },
    { 
      key: 'lastActivity', 
      label: '最后活动',
      sorter: (a: ActiveSession, b: ActiveSession) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime(),
      render: (_value: unknown, record: ActiveSession) => formatDateTime(record.lastActivity)
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value: unknown, record: ActiveSession) => (
        <button
          onClick={() => handleTerminateSession(record.sessionId)}
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
    { 
      key: 'backupName', 
      label: '备份名称', 
      sorter: true,
      render: (_value: unknown, record: BackupRecord) => (
        <div className="max-w-[180px]">
          <div className="font-medium text-gray-900 truncate" title={record.backupName}>
            {record.fileName || record.backupName}
          </div>
          {record.description && (
            <div className="text-xs text-gray-500 truncate" title={record.description}>
              {record.description}
            </div>
          )}
        </div>
      )
    },
    { 
      key: 'backupType', 
      label: '类型',
      sorter: true,
      render: (_value: unknown, record: BackupRecord) => (
        <div className="flex items-center justify-center">
          <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
            record.backupType === 'full' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {record.backupType === 'full' ? '完整' : '增量'}
          </span>
        </div>
      )
    },
    {
      key: 'backupSize',
      label: '大小',
      render: (_value: unknown, record: BackupRecord) => (
        <span className="text-gray-600 text-xs">{formatFileSize(record.backupSize)}</span>
      )
    },
    { 
      key: 'backupStatus', 
      label: '状态',
      sorter: true,
      render: (_value: unknown, record: BackupRecord) => (
        <div className="flex items-center justify-center">
          <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
            record.backupStatus === 'completed' ? 'bg-green-100 text-green-700' :
            record.backupStatus === 'running' ? 'bg-blue-100 text-blue-700' :
            'bg-red-100 text-red-700'
          }`}>
            {record.backupStatus === 'completed' ? '完成' :
             record.backupStatus === 'running' ? '进行中' : '失败'}
          </span>
        </div>
      )
    },
    {
      key: 'isCloudSynced',
      label: '云同步',
      render: (_value: unknown, record: BackupRecord) => (
        <div className="flex items-center justify-center">
          {record.isCloudSynced ? (
            <span className="flex items-center gap-1 text-green-600" title="已同步到腾讯云 COS">
              <Cloud className="w-4 h-4" />
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-400" title="仅本地存储">
              <HardDrive className="w-4 h-4" />
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'createdAt', 
      label: '备份时间',
      sorter: (a: BackupRecord, b: BackupRecord) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return timeA - timeB
      },
      render: (_value: unknown, record: BackupRecord) => (
        <span className="text-xs text-gray-600">
          {record.createdAt ? formatDateTime(record.createdAt) : '-'}
        </span>
      )
    },
    {
      key: 'restoreCount',
      label: '恢复次数',
      render: (_value: unknown, record: BackupRecord) => (
        <span className="text-xs text-gray-600">{record.restoreCount || 0}</span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value: unknown, record: BackupRecord) => (
        <div className="flex items-center justify-center gap-1">
          {record.backupStatus === 'completed' && (
            <>
              <button
                onClick={() => handleDownloadBackup(record)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                title="下载备份"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleOpenRestoreModal(record)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-amber-600"
                title="恢复数据"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => handleDeleteBackup(record)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
            title="删除备份"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
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
          onKeyDown={(e) => e.key === 'Enter' && loadAuditLogs()}
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
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          共 {backups.length} 条备份记录
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => { loadBackups(); loadBackupSettings(); }}
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

      {/* 备份设置卡片 */}
      {backupSettings && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-600" />
              <h3 className="font-medium text-gray-900">备份设置</h3>
            </div>
            <button
              onClick={handleSaveBackupSettings}
              disabled={savingBackupSettings}
              className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
            >
              {savingBackupSettings ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存设置
            </button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 自动备份开关 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">自动备份</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupSettings.enabled}
                  onChange={(e) => setBackupSettings({ ...backupSettings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                <span className="ml-2 text-sm text-gray-700">{backupSettings.enabled ? '已启用' : '已禁用'}</span>
              </label>
            </div>
            
            {/* 备份频率 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">备份频率</label>
              <select
                value={backupSettings.frequency}
                onChange={(e) => setBackupSettings({ ...backupSettings, frequency: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              >
                <option value="hourly">每小时</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            
            {/* 备份时间 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">备份时间</label>
              <input
                type="time"
                value={backupSettings.time}
                onChange={(e) => setBackupSettings({ ...backupSettings, time: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            
            {/* 保留份数 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">保留份数</label>
              <input
                type="number"
                min="1"
                max="100"
                value={backupSettings.retentionCount}
                onChange={(e) => setBackupSettings({ ...backupSettings, retentionCount: parseInt(e.target.value) || 30 })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            
            {/* 云同步状态 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">云端存储</label>
              <div className="flex items-center gap-2 py-1.5">
                {backupSettings.cosConfigured ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <Cloud className="w-4 h-4" />
                    腾讯云 COS 已配置
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-sm">
                    <CloudOff className="w-4 h-4" />
                    未配置云存储
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 提示信息 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p>备份文件将自动上传到腾讯云 COS 存储，确保数据安全。</p>
            <p className="mt-1 text-xs text-blue-600">
              恢复操作会覆盖现有数据，请谨慎操作。恢复前系统会自动创建一份当前数据的备份。
            </p>
          </div>
        </div>
      </div>
      
      {/* 备份列表 */}
      <DataTable columns={backupColumns} data={backups} compact />
      
      {/* 恢复确认弹窗 */}
      {showRestoreModal && restoreTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                确认恢复数据库
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium">警告：此操作不可撤销！</p>
                <p className="text-sm text-amber-700 mt-1">
                  恢复数据库将覆盖当前所有数据，请确保您已知悉风险。
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">备份名称：</span>{restoreTarget.fileName || restoreTarget.backupName}</p>
                <p><span className="text-gray-500">备份时间：</span>{restoreTarget.createdAt ? formatDateTime(restoreTarget.createdAt) : '-'}</p>
                <p><span className="text-gray-500">备份大小：</span>{formatFileSize(restoreTarget.backupSize)}</p>
                <p><span className="text-gray-500">数据来源：</span>{restoreTarget.isCloudSynced ? '腾讯云 COS' : '本地存储'}</p>
              </div>
              
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-600">
                  恢复前，系统将自动为当前数据库创建一份备份，以便在需要时可以回退。
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => { setShowRestoreModal(false); setRestoreTarget(null); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                disabled={restoring}
              >
                取消
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={restoring}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}
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
