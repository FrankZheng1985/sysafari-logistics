import { User, Plus, Edit2, Trash2, Key, Loader2, Search, X, Users, Building } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import { isDemoEnvironment } from '../components/Layout'
import { 
  getUserList, 
  createUser, 
  updateUser, 
  deleteUser, 
  updateUserStatus, 
  resetUserPassword,
  getRoleList,
  type User as UserType, 
  type Role 
} from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

// API 基础地址
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

// 上级用户类型
interface Supervisor {
  id: number
  name: string
  username: string
  role: string
  roleName: string
  department: string
}

interface UserModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  user: UserType | null
  roles: Role[]
  supervisors: Supervisor[]
}

function UserModal({ visible, onClose, onSuccess, user, roles, supervisors }: UserModalProps) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role: 'doc_clerk' as string,
    status: 'active' as 'active' | 'inactive',
    supervisorId: '' as string,
    department: '',
    position: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (user) {
        setFormData({
          username: user.username,
          password: '',
          name: user.name,
          email: user.email || '',
          phone: user.phone || '',
          role: user.role,
          status: user.status,
          supervisorId: user.supervisorId?.toString() || '',
          department: user.department || '',
          position: user.position || '',
        })
      } else {
        setFormData({
          username: '',
          password: '',
          name: '',
          email: '',
          phone: '',
          role: 'doc_clerk',
          status: 'active',
          supervisorId: '',
          department: '',
          position: '',
        })
      }
      setErrors({})
    }
  }, [visible, user])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.username.trim()) newErrors.username = '用户名为必填项'
    if (!user && !formData.password.trim()) {
      newErrors.password = '密码为必填项'
    } else if (!user && formData.password.length < 8) {
      newErrors.password = '密码长度不能少于8位'
    } else if (!user) {
      // 验证密码复杂度
      const password = formData.password
      const hasUppercase = /[A-Z]/.test(password)
      const hasLowercase = /[a-z]/.test(password)
      const hasNumber = /\d/.test(password)
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
      
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        newErrors.password = '密码需包含大小写字母、数字和特殊字符'
      }
    }
    if (!formData.name.trim()) newErrors.name = '姓名为必填项'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      if (user) {
        // 更新用户
        const response = await updateUser({
          id: user.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          status: formData.status,
          supervisorId: formData.supervisorId ? parseInt(formData.supervisorId) : undefined,
          department: formData.department,
          position: formData.position,
        })
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '更新失败')
        }
      } else {
        // 创建用户
        const response = await createUser({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          status: formData.status,
          supervisorId: formData.supervisorId ? parseInt(formData.supervisorId) : undefined,
          department: formData.department,
          position: formData.position,
        })
        if (response.errCode === 200) {
          onSuccess()
          onClose()
        } else {
          alert(response.msg || '创建失败')
        }
      }
    } catch (err: any) {
      console.error('保存用户失败:', err)
      alert(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {user ? '编辑用户' : '新增用户'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors" title="关闭">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* 用户名 */}
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={!!user}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-1 ${
                errors.username ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
              } ${user ? 'bg-gray-100' : ''}`}
              placeholder="请输入用户名"
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
          </div>

          {/* 密码（仅新增时显示） */}
          {!user && (
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                密码 <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-1 ${
                  errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
                }`}
                placeholder="请输入密码"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                密码要求：至少8位，包含大小写字母、数字和特殊字符
              </p>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>
          )}

          {/* 姓名 */}
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-1 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
              }`}
              placeholder="请输入姓名"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 邮箱 */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="请输入邮箱"
            />
          </div>

          {/* 手机 */}
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
              手机号
            </label>
            <input
              id="phone"
              type="text"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="请输入手机号"
            />
          </div>

          {/* 角色 */}
          <div>
            <label htmlFor="role" className="block text-xs font-medium text-gray-700 mb-1">
              角色 <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {roles.map(r => (
                <option key={r.roleCode} value={r.roleCode}>{r.roleName}</option>
              ))}
            </select>
          </div>

          {/* 直属上级 */}
          <div>
            <label htmlFor="supervisorId" className="block text-xs font-medium text-gray-700 mb-1">
              直属上级
            </label>
            <select
              id="supervisorId"
              value={formData.supervisorId}
              onChange={(e) => handleInputChange('supervisorId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">无</option>
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.roleName}{s.department ? ` - ${s.department}` : ''})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">选择该用户的直属上级，用于团队管理</p>
          </div>

          {/* 部门和职位 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="department" className="block text-xs font-medium text-gray-700 mb-1">
                部门
              </label>
              <input
                id="department"
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="如：业务部"
              />
            </div>
            <div>
              <label htmlFor="position" className="block text-xs font-medium text-gray-700 mb-1">
                职位
              </label>
              <input
                id="position"
                type="text"
                value={formData.position}
                onChange={(e) => handleInputChange('position', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="如：跟单员"
              />
            </div>
          </div>

          {/* 状态 */}
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="active">启用</option>
              <option value="inactive">禁用</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UserManage() {
  const navigate = useNavigate()
  const { hasPermission, user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserType[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 })
  
  // 检测是否是演示环境
  const isDemo = useMemo(() => isDemoEnvironment(), [])
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<UserType | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await getUserList({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: searchText || undefined,
        role: filterRole || undefined,
        status: filterStatus || undefined,
        // 演示环境只显示演示用户
        userType: isDemo ? 'test' : undefined,
      })
      if (response.errCode === 200 && response.data) {
        setUsers(response.data.list)
        setPagination(prev => ({ ...prev, total: response.data!.total }))
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await getRoleList()
      if (response.errCode === 200 && response.data) {
        setRoles(response.data)
      }
    } catch (error) {
      console.error('加载角色列表失败:', error)
    }
  }

  // 加载上级用户列表
  const loadSupervisors = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/supervisors`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        setSupervisors(data.data)
      }
    } catch (error) {
      console.error('加载上级用户列表失败:', error)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    loadRoles()
    loadSupervisors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize])

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    loadUsers()
  }

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const response = await updateUserStatus(userId, newStatus)
      if (response.errCode === 200) {
        loadUsers()
      } else {
        alert(response.msg || '更新状态失败')
      }
    } catch (error: any) {
      console.error('更新用户状态失败:', error)
      alert(error.message || '更新用户状态失败')
    }
  }

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`确定要重置用户 "${userName}" 的密码吗？`)) return
    
    try {
      const response = await resetUserPassword(userId)
      if (response.errCode === 200 && response.data) {
        alert(`密码已重置为: ${response.data.newPassword}`)
      } else {
        alert(response.msg || '重置密码失败')
      }
    } catch (error: any) {
      console.error('重置密码失败:', error)
      alert(error.message || '重置密码失败')
    }
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`确定要删除用户 "${userName}" 吗？此操作不可恢复。`)) return
    
    try {
      const response = await deleteUser(userId)
      if (response.errCode === 200) {
        loadUsers()
      } else {
        alert(response.msg || '删除失败')
      }
    } catch (error: any) {
      console.error('删除用户失败:', error)
      alert(error.message || '删除用户失败')
    }
  }

  const handleEdit = (user: UserType) => {
    setEditingUser(user)
    setModalVisible(true)
  }

  const handleAdd = () => {
    setEditingUser(null)
    setModalVisible(true)
  }

  const handleModalSuccess = () => {
    loadUsers()
  }

  // 角色颜色映射
  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      boss: 'bg-purple-100 text-purple-700',
      manager: 'bg-blue-100 text-blue-700',
      finance_director: 'bg-orange-100 text-orange-700',
      doc_clerk: 'bg-cyan-100 text-cyan-700',
      doc_officer: 'bg-teal-100 text-teal-700',
      finance_assistant: 'bg-yellow-100 text-yellow-700',
      operator: 'bg-green-100 text-green-700',
      viewer: 'bg-gray-100 text-gray-700'
    }
    return colorMap[role] || 'bg-gray-100 text-gray-700'
  }

  // 查找用户名称
  const getSupervisorName = (supervisorId: number | undefined) => {
    if (!supervisorId) return '-'
    const supervisor = supervisors.find(s => s.id === supervisorId)
    return supervisor ? supervisor.name : '-'
  }

  const columns = [
    {
      key: 'id',
      label: '用户ID',
      render: (item: UserType) => (
        <span className="font-mono text-xs text-gray-600">{item.id}</span>
      )
    },
    { key: 'username', label: '用户名' },
    { key: 'name', label: '姓名' },
    {
      key: 'department',
      label: '部门',
      render: (item: UserType) => (
        <span className="text-xs text-gray-600">
          {item.department || '-'}
        </span>
      )
    },
    {
      key: 'roleName',
      label: '角色',
      render: (item: UserType) => (
        <span className={`px-2 py-0.5 rounded text-xs ${getRoleColor(item.role)}`}>
          {item.roleName || item.role}
        </span>
      )
    },
    {
      key: 'supervisorId',
      label: '上级',
      render: (item: UserType) => (
        <span className="text-xs text-gray-600">
          {getSupervisorName(item.supervisorId)}
        </span>
      )
    },
    {
      key: 'status',
      label: '状态',
      render: (item: UserType) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleStatus(item.id, item.status)
          }}
          disabled={item.id === currentUser?.id}
          className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
            item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
          } ${item.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={item.id === currentUser?.id ? '不能禁用自己' : (item.status === 'active' ? '点击禁用' : '点击启用')}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              item.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
    },
    { 
      key: 'lastLoginTime', 
      label: '最后登录',
      render: (item: UserType) => item.lastLoginTime ? new Date(item.lastLoginTime).toLocaleString('zh-CN') : '-'
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: UserType) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(item)
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleResetPassword(item.id, item.name)
            }}
            className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
            title="重置密码"
          >
            <Key className="w-4 h-4" />
          </button>
          {item.id !== currentUser?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(item.id, item.name)
              }}
              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="用户管理"
        icon={<User className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '系统管理', path: '/system/menu-settings' },
          { label: '用户管理' }
        ]}
        tabs={[
          { label: '用户列表', path: '/system/user-manage' },
          { label: '角色权限', path: '/system/user-manage/permissions' },
        ]}
        activeTab="/system/user-manage"
        onTabChange={(path) => navigate(path)}
        actionButtons={
          hasPermission('system:user') && (
            <button 
              onClick={handleAdd}
              className="px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              新增用户
            </button>
          )
        }
      />
      
      <div className="flex-1 overflow-auto p-4">
        {/* 搜索和筛选 */}
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="搜索用户名、姓名、邮箱..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-56 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              />
              <button
                onClick={handleSearch}
                className="px-2 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs flex items-center gap-1"
              >
                <Search className="w-3 h-3" />
                搜索
              </button>
            </div>
            <select
              value={filterRole}
              onChange={(e) => { setFilterRole(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            >
              <option value="">全部角色</option>
              {roles.map(r => (
                <option key={r.roleCode} value={r.roleCode}>{r.roleName}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            >
              <option value="">全部状态</option>
              <option value="active">已启用</option>
              <option value="inactive">已禁用</option>
            </select>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mb-3 p-2 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">总用户数:</span>
              <span className="text-gray-900 font-medium">{pagination.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">启用:</span>
              <span className="text-green-600 font-medium">{users.filter(u => u.status === 'active').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">禁用:</span>
              <span className="text-red-600 font-medium">{users.filter(u => u.status !== 'active').length}</span>
            </div>
          </div>
        </div>

        {/* 表格 */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
            <span className="ml-2 text-xs text-gray-600">加载中...</span>
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={users} 
            compact={true}
          />
        )}

        {/* 分页 */}
        {!loading && (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              共 <span className="font-medium">{pagination.total}</span> 条记录
            </div>
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
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900"
              >
                <option value={10}>10 条/页</option>
                <option value={20}>20 条/页</option>
                <option value={50}>50 条/页</option>
                <option value={100}>100 条/页</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 用户编辑模态框 */}
      <UserModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleModalSuccess}
        user={editingUser}
        roles={roles}
        supervisors={supervisors}
      />
    </div>
  )
}
