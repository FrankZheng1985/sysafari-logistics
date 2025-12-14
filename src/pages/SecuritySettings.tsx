import { Shield, Save, Loader2, RefreshCw, Info, Lock, Mail, Clock, Key, History } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { useAuth } from '../contexts/AuthContext'

// API 基础地址
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

interface SecuritySetting {
  key: string
  value: string
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
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>(() => 
    location.pathname.includes('logs') ? 'logs' : 'settings'
  )
  const [settings, setSettings] = useState<SecuritySetting[]>([])
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })

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
      ]
    },
    {
      key: 'lockout',
      title: '登录锁定',
      icon: <Lock className="w-3 h-3" />,
      settings: [
        'login_lockout_attempts',
        'login_lockout_duration',
      ]
    },
    {
      key: 'verification',
      title: '邮箱验证',
      icon: <Mail className="w-3 h-3" />,
      settings: [
        'email_verification_enabled',
        'verification_code_expiry',
      ]
    },
    {
      key: 'session',
      title: '会话管理',
      icon: <Clock className="w-3 h-3" />,
      settings: [
        'session_timeout',
      ]
    },
  ]

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/settings`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSettings(data.data)
      }
    } catch (error) {
      console.error('加载安全配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login-logs?page=${pagination.page}&pageSize=${pagination.pageSize}`)
      const data = await response.json()
      if (data.errCode === 200) {
        setLogs(data.data.list)
        setPagination(prev => ({ ...prev, total: data.data.total }))
      }
    } catch (error) {
      console.error('加载登录日志失败:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

   
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pagination.page])

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })
      const data = await response.json()
      if (data.errCode === 200) {
        alert('配置保存成功')
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
      'password_min_length': '最小密码长度',
      'password_require_uppercase': '需要大写字母',
      'password_require_lowercase': '需要小写字母',
      'password_require_number': '需要数字',
      'password_require_special': '需要特殊字符',
      'login_lockout_attempts': '锁定前允许失败次数',
      'login_lockout_duration': '锁定时长（分钟）',
      'email_verification_enabled': '启用邮箱验证',
      'verification_code_expiry': '验证码有效期（分钟）',
      'session_timeout': '会话超时（分钟）',
    }
    return labels[key] || key
  }

  const renderSettingInput = (setting: SecuritySetting) => {
    const isBool = ['password_require_uppercase', 'password_require_lowercase', 'password_require_number', 'password_require_special', 'email_verification_enabled'].includes(setting.key)
    
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
      render: (item: LoginLog) => new Date(item.loginTime).toLocaleString('zh-CN')
    },
    { key: 'username', label: '用户名' },
    { key: 'ipAddress', label: 'IP地址' },
    { 
      key: 'status', 
      label: '状态',
      render: (item: LoginLog) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          item.status === 'success' ? 'bg-green-100 text-green-700' :
          item.status === 'failed' ? 'bg-red-100 text-red-700' :
          item.status === 'locked' ? 'bg-orange-100 text-orange-700' :
          item.status === 'disabled' ? 'bg-gray-100 text-gray-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {item.status === 'success' ? '成功' :
           item.status === 'failed' ? '失败' :
           item.status === 'locked' ? '已锁定' :
           item.status === 'disabled' ? '已禁用' : item.status}
        </span>
      )
    },
    { 
      key: 'failureReason', 
      label: '失败原因',
      render: (item: LoginLog) => item.failureReason || '-'
    },
    { 
      key: 'userAgent', 
      label: '设备',
      render: (item: LoginLog) => {
        const ua = item.userAgent || ''
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
                onClick={loadLogs}
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
            {!logsLoading && pagination.total > pagination.pageSize && (
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-gray-500">
                  第 {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)} 页
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="px-1.5 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                    className="px-1.5 py-0.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

