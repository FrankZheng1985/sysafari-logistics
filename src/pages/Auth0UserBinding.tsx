import { useState, useEffect } from 'react'
import { UserPlus, Link2, RefreshCw, Check, X, User, Mail, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface PendingUser {
  id: number
  auth0_id: string
  email: string
  name: string
  picture: string
  first_login_at: string
  last_login_at: string
  is_bound: boolean
  bound_user_id: number | null
  bound_username: string | null
  bound_name: string | null
}

interface SystemUser {
  id: number
  username: string
  name: string
  role: string
  email: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

export default function Auth0UserBinding() {
  const { getAccessToken, isAdmin } = useAuth()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [bindingUserId, setBindingUserId] = useState<number | null>(null)
  const [selectedSystemUser, setSelectedSystemUser] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    auth0Id: '',
    username: '',
    name: '',
    email: '',
    role: 'operator'
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 获取待绑定用户列表
  const fetchPendingUsers = async () => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE_URL}/auth/pending-users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.errCode === 200) {
        setPendingUsers(data.data || [])
      }
    } catch (error) {
      console.error('获取待绑定用户失败:', error)
    }
  }

  // 获取系统用户列表
  const fetchSystemUsers = async () => {
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.errCode === 200) {
        setSystemUsers(data.data || [])
      }
    } catch (error) {
      console.error('获取系统用户失败:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchPendingUsers(), fetchSystemUsers()])
      setLoading(false)
    }
    loadData()
  }, [])

  // 绑定用户
  const handleBind = async (auth0Id: string) => {
    if (!selectedSystemUser) {
      setMessage({ type: 'error', text: '请选择要绑定的系统用户' })
      return
    }

    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE_URL}/auth/bind-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ auth0Id, userId: selectedSystemUser })
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        setMessage({ type: 'success', text: '绑定成功！' })
        setBindingUserId(null)
        setSelectedSystemUser(null)
        fetchPendingUsers()
      } else {
        setMessage({ type: 'error', text: data.msg || '绑定失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '绑定失败，请重试' })
    }
  }

  // 创建并绑定用户
  const handleCreateAndBind = async () => {
    if (!createForm.username || !createForm.name) {
      setMessage({ type: 'error', text: '请填写用户名和姓名' })
      return
    }

    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE_URL}/auth/create-and-bind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        setMessage({ type: 'success', text: '创建并绑定成功！' })
        setShowCreateModal(false)
        setCreateForm({ auth0Id: '', username: '', name: '', email: '', role: 'operator' })
        fetchPendingUsers()
        fetchSystemUsers()
      } else {
        setMessage({ type: 'error', text: data.msg || '创建失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '创建失败，请重试' })
    }
  }

  // 格式化时间
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleString('zh-CN')
  }

  // 获取未绑定的系统用户
  const unboundSystemUsers = systemUsers.filter(u => 
    !pendingUsers.some(p => p.bound_user_id === u.id)
  )

  if (!isAdmin()) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
          只有管理员可以访问此页面
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">用户绑定管理</h1>
          <p className="text-gray-500 mt-1">将 Auth0 登录用户绑定到系统用户</p>
        </div>
        <button
          onClick={() => { fetchPendingUsers(); fetchSystemUsers() }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right">×</button>
        </div>
      )}

      {/* 待绑定用户列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Auth0 登录用户</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无用户登录记录。当新用户通过 Auth0 登录后，会显示在这里。
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingUsers.map(user => (
              <div key={user.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  {/* 用户信息 */}
                  <div className="flex items-start gap-4">
                    {user.picture ? (
                      <img src={user.picture} alt="" className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{user.name || '未知用户'}</div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Mail className="w-3 h-3" />
                        {user.email || '无邮箱'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Clock className="w-3 h-3" />
                        最后登录: {formatTime(user.last_login_at)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        {user.auth0_id}
                      </div>
                    </div>
                  </div>

                  {/* 绑定状态/操作 */}
                  <div className="flex items-center gap-2">
                    {user.is_bound ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        <Check className="w-4 h-4" />
                        已绑定: {user.bound_name} ({user.bound_username})
                      </div>
                    ) : bindingUserId === user.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSystemUser || ''}
                          onChange={(e) => setSelectedSystemUser(Number(e.target.value) || null)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">选择系统用户...</option>
                          {unboundSystemUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.username}) - {u.role}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleBind(user.auth0_id)}
                          className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => { setBindingUserId(null); setSelectedSystemUser(null) }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setBindingUserId(user.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                        >
                          <Link2 className="w-4 h-4" />
                          绑定现有用户
                        </button>
                        <button
                          onClick={() => {
                            setCreateForm({
                              auth0Id: user.auth0_id,
                              username: user.email?.split('@')[0] || '',
                              name: user.name || '',
                              email: user.email || '',
                              role: 'operator'
                            })
                            setShowCreateModal(true)
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                        >
                          <UserPlus className="w-4 h-4" />
                          创建新用户
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建用户弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-[500px] p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">创建新用户并绑定</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="输入姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="输入邮箱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色 *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="operator">操作员</option>
                  <option value="manager">经理</option>
                  <option value="admin">管理员</option>
                  <option value="viewer">查看者</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleCreateAndBind}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                创建并绑定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
