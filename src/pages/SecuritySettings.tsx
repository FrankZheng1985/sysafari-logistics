import { Shield, Save, Loader2, RefreshCw, Info, Lock, Clock, Key, History } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../contexts/AuthContext'

// API 基础地址 - 根据域名自动选择
function getApiBaseUrl(): string {
  // 开发环境
  if (import.meta.env.DEV) {
    return 'http://localhost:3001'
  }
  
  // 根据当前域名自动选择 API
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // 演示环境 -> 演示 API
    if (hostname === 'demo.xianfeng-eu.com') {
      return 'https://sysafari-logistics-demo-api.onrender.com'
    }
    
    // 生产环境 -> 生产 API
    if (hostname === 'erp.xianfeng-eu.com') {
      return 'https://sysafari-logistics-api.onrender.com'
    }
  }
  
  return ''
}

const API_BASE_URL = getApiBaseUrl()

interface SecuritySetting {
  key: string
  value: string
  type?: string
  description: string
}

interface LoginLog {
  id: number
  userId: number | null
  username: string
  loginTime: string
  ipAddress: string
  userAgent: string
  status: string
  failureReason: string | null
}

export default function SecuritySettings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission, getAccessToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>(() => 
    location.pathname.includes('logs') ? 'logs' : 'settings'
  )
  const [settings, setSettings] = useState<SecuritySetting[]>([])
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })

  // 获取带认证的请求头
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }, [getAccessToken])

  // 设置分组
  const settingGroups = [
    {
      key: 'password',
      title: '密码策略',
      icon: <Key className="w-3 h-3" />,
      settings: [
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_number',
        'password_require_special',
        'password_expire_days',
      ]
    },
    {
      key: 'login',
      title: '登录锁定',
      icon: <Lock className="w-3 h-3" />,
      settings: [
        'login_max_attempts',
        'login_lockout_duration',
        'login_require_captcha_after',
      ]
    },
    {
      key: 'session',
      title: '会话管理',
      icon: <Clock className="w-3 h-3" />,
      settings: [
        'session_timeout',
        'session_single_login',
        'session_remember_max_days',
      ]
    },
    {
      key: 'audit',
      title: '安全审计',
      icon: <History className="w-3 h-3" />,
      settings: [
        'audit_enabled',
        'audit_sensitive_operations',
        'audit_retention_days',
      ]
    },
  ]

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE_URL}/api/security/settings`, { headers })
      const data = await response.json()
      if (data.errCode === 200) {
        // 后端返回的是分组对象，需要转换为扁平数组
        const grouped = data.data
        const flatSettings: SecuritySetting[] = []
        
        for (const category of Object.values(grouped) as { name: string, settings: { key: string, value: unknown, type?: string, description: string }[] }[]) {
          for (const setting of category.settings) {
            // 统一布尔值格式：true/false -> 1/0
            let value = String(setting.value)
            if (setting.type === 'boolean') {
              value = (setting.value === true || setting.value === 'true' || setting.value === '1') ? '1' : '0'
            }
            flatSettings.push({
              key: setting.key,
              value,
              type: setting.type,
              description: setting.description
            })
          }
        }
        
        setSettings(flatSettings)
      } else if (data.errCode === 401) {
        alert('认证失败，请重新登录')
      }
    } catch (error) {
      console.error('加载安全配置失败:', error)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  const loadLogs = useCallback(async (page: number, pageSize: number) => {
    setLogsLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE_URL}/api/auth/login-logs?page=${page}&pageSize=${pageSize}`, { headers })
      const data = await response.json()
      if (data.errCode === 200) {
        setLogs(data.data.list)
        setPagination(prev => ({ ...prev, total: data.data.total }))
      } else if (data.errCode === 401) {
        alert('认证失败，请重新登录')
      }
    } catch (error) {
      console.error('加载登录日志失败:', error)
    } finally {
      setLogsLoading(false)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(pagination.page, pagination.pageSize)
    }
  }, [activeTab, pagination.page, pagination.pageSize, loadLogs])

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
  }

  // 初始化安全设置
  const handleInitialize = async () => {
    if (!confirm('确定要初始化安全设置吗？这将创建默认的安全配置。')) {
      return
    }
    
    setInitializing(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE_URL}/api/security/settings/init`, {
        method: 'POST',
        headers
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert(data.msg || '初始化成功')
        loadSettings() // 重新加载设置
      } else if (data.errCode === 401) {
        alert('认证失败，请重新登录')
      } else {
        alert(data.msg || '初始化失败')
      }
    } catch (error) {
      console.error('初始化失败:', error)
      alert('初始化失败')
    } finally {
      setInitializing(false)
    }
  }

  // 检查设置是否已加载
  const hasSettings = settings.length > 0

  const handleSave = async () => {
    setSaving(true)
    try {
      // 将数组转换为对象格式，并将布尔值转回 true/false
      const settingsObj: Record<string, string> = {}
      for (const s of settings) {
        let value = s.value
        if (s.type === 'boolean') {
          value = s.value === '1' ? 'true' : 'false'
        }
        settingsObj[s.key] = value
      }
      
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE_URL}/api/security/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ settings: settingsObj })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('配置保存成功')
      } else if (data.errCode === 401) {
        alert('认证失败，请重新登录')
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const getSetting = (key: string) => settings.find(s => s.key === key)

  const getSettingLabel = (key: string) => {
    const labels: Record<string, string> = {
      // 密码策略
      'password_min_length': '最小密码长度',
      'password_require_uppercase': '需要大写字母',
      'password_require_lowercase': '需要小写字母',
      'password_require_number': '需要数字',
      'password_require_special': '需要特殊字符',
      'password_expire_days': '密码有效期（天）',
      'password_history_count': '密码历史记录',
      // 登录安全
      'login_max_attempts': '最大登录尝试次数',
      'login_lockout_duration': '锁定时长（分钟）',
      'login_remember_days': '记住登录天数',
      'login_require_captcha_after': '验证码触发次数',
      // 会话管理
      'session_timeout': '会话超时（分钟）',
      'session_single_login': '单点登录',
      'session_remember_max_days': '最长记住天数',
      // 安全审计
      'audit_enabled': '启用审计',
      'audit_sensitive_operations': '记录敏感操作',
      'audit_retention_days': '日志保留天数',
    }
    return labels[key] || key
  }

  const renderSettingInput = (setting: SecuritySetting) => {
    // 根据 type 字段或键名判断是否为布尔值
    const boolKeys = [
      'password_require_uppercase', 'password_require_lowercase', 
      'password_require_number', 'password_require_special',
      'session_single_login', 'audit_enabled', 'audit_sensitive_operations'
    ]
    const isBool = setting.type === 'boolean' || boolKeys.includes(setting.key)
    
    if (isBool) {
      return (
        <button
          onClick={() => handleSettingChange(setting.key, setting.value === '1' ? '0' : '1')}
          title={setting.value === '1' ? '点击关闭' : '点击开启'}
          aria-label={`${getSettingLabel(setting.key)} - ${setting.value === '1' ? '已开启' : '已关闭'}`}
          className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-primary-500 ${
            setting.value === '1' ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              setting.value === '1' ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      )
    }

    return (
      <input
        type="number"
        value={setting.value}
        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
        title={`输入${getSettingLabel(setting.key)}`}
        aria-label={getSettingLabel(setting.key)}
        className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
        min="1"
      />
    )
  }

  const logColumns = [
    { 
      key: 'loginTime', 
      label: '登录时间',
      render: (_value: unknown, record: LoginLog) => new Date(record.loginTime).toLocaleString('zh-CN')
    },
    { key: 'username', label: '用户名' },
    { key: 'ipAddress', label: 'IP地址' },
    { 
      key: 'status', 
      label: '状态',
      render: (_value: unknown, record: LoginLog) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          record.status === 'success' ? 'bg-green-100 text-green-700' :
          record.status === 'failed' ? 'bg-red-100 text-red-700' :
          record.status === 'locked' ? 'bg-orange-100 text-orange-700' :
          record.status === 'disabled' ? 'bg-gray-100 text-gray-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {record.status === 'success' ? '成功' :
           record.status === 'failed' ? '失败' :
           record.status === 'locked' ? '已锁定' :
           record.status === 'disabled' ? '已禁用' : record.status}
        </span>
      )
    },
    { 
      key: 'failureReason', 
      label: '失败原因',
      render: (_value: unknown, record: LoginLog) => record.failureReason || '-'
    },
    { 
      key: 'userAgent', 
      label: '设备',
      render: (_value: unknown, record: LoginLog) => {
        const ua = record.userAgent || ''
        if (ua.includes('Chrome')) return 'Chrome'
        if (ua.includes('Firefox')) return 'Firefox'
        if (ua.includes('Safari')) return 'Safari'
        if (ua.includes('Edge')) return 'Edge'
        return '未知'
      }
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="安全设置"
        icon={<Shield className="w-4 h-4 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system/menu-settings' },
          { label: '安全设置' }
        ]}
        tabs={[
          { label: '安全配置', path: '/system/security-settings' },
          { label: '登录日志', path: '/system/security-settings/logs' },
        ]}
        activeTab={activeTab === 'settings' ? '/system/security-settings' : '/system/security-settings/logs'}
        onTabChange={(path) => {
          setActiveTab(path.includes('logs') ? 'logs' : 'settings')
          navigate(path)
        }}
        actionButtons={
          activeTab === 'settings' && hasPermission('system:user') && (
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs flex items-center gap-1 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存配置
            </button>
          )
        }
      />

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'settings' ? (
          loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
              <span className="ml-2 text-xs text-gray-600">加载中...</span>
            </div>
          ) : !hasSettings ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Shield className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无安全配置数据</p>
              <p className="text-xs mt-1 mb-4">点击下方按钮初始化默认安全配置</p>
              {hasPermission('system:user') && (
                <button
                  onClick={handleInitialize}
                  disabled={initializing}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {initializing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      初始化中...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      初始化安全配置
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 说明信息 */}
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-0.5">安全配置说明</p>
                  <p>• 密码策略会在用户修改密码时生效</p>
                  <p>• 启用邮箱验证后，用户登录需要输入邮箱收到的验证码</p>
                  <p>• 登录锁定可防止暴力破解攻击</p>
                </div>
              </div>

              {/* 配置分组 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {settingGroups.map(group => (
                  <div key={group.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <span className="text-primary-600">{group.icon}</span>
                      <h3 className="text-xs font-semibold text-gray-900">{group.title}</h3>
                    </div>
                    <div className="p-3 space-y-3">
                      {group.settings.map(settingKey => {
                        const setting = getSetting(settingKey)
                        if (!setting) return null
                        return (
                          <div key={settingKey} className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-gray-700">{getSettingLabel(settingKey)}</div>
                              <div className="text-[10px] text-gray-400">{setting.description}</div>
                            </div>
                            {renderSettingInput(setting)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 当前密码要求预览 */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Key className="w-3 h-3 text-primary-600" />
                  当前密码要求
                </h3>
                <div className="text-xs text-gray-600 space-y-0.5">
                  <p>• 最少 {getSetting('password_min_length')?.value || 8} 位字符</p>
                  {getSetting('password_require_uppercase')?.value === '1' && <p>• 必须包含大写字母 (A-Z)</p>}
                  {getSetting('password_require_lowercase')?.value === '1' && <p>• 必须包含小写字母 (a-z)</p>}
                  {getSetting('password_require_number')?.value === '1' && <p>• 必须包含数字 (0-9)</p>}
                  {getSetting('password_require_special')?.value === '1' && <p>• 必须包含特殊字符 (!@#$%^&*等)</p>}
                  {Number(getSetting('password_expire_days')?.value) > 0 && (
                    <p>• 密码有效期 {getSetting('password_expire_days')?.value} 天</p>
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {/* 刷新按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <History className="w-3 h-3" />
                共 {pagination.total} 条登录记录
              </div>
              <button
                onClick={() => loadLogs(pagination.page, pagination.pageSize)}
                disabled={logsLoading}
                className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            {/* 日志表格 */}
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                <span className="ml-2 text-xs text-gray-600">加载中...</span>
              </div>
            ) : (
              <DataTable columns={logColumns} data={logs} compact />
            )}

            {/* 分页 */}
            {!logsLoading && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-700">
                  共 <span className="font-medium">{pagination.total}</span> 条记录
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-gray-700">
                    第 {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                  <select
                    value={pagination.pageSize}
                    onChange={(e) => setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
                    title="每页显示条数"
                    aria-label="每页显示条数"
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
                  >
                    <option value={20}>20 条/页</option>
                    <option value={50}>50 条/页</option>
                    <option value={100}>100 条/页</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

