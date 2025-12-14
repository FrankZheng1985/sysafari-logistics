import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import UserPasswordModal from './UserPasswordModal'

interface User {
  id: string
  username: string
  name: string
  email: string
  phone?: string
  role: 'admin' | 'operator' | 'viewer'
  status: 'active' | 'inactive'
}

interface UserEditModalProps {
  visible: boolean
  onClose: () => void
  user: User | null
  onSubmit: (data: {
    id: string
    email: string
    phone?: string
    role: 'admin' | 'operator' | 'viewer'
  }) => Promise<void>
  onPasswordChange?: (userId: string, newPassword: string) => Promise<void>
}

export default function UserEditModal({ visible, onClose, user, onSubmit, onPasswordChange }: UserEditModalProps) {
  const [loading, setLoading] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    role: 'viewer' as 'admin' | 'operator' | 'viewer',
  })

  // 当用户数据变化时，更新表单数据
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)

    try {
      await onSubmit({
        id: user.id,
        ...formData,
      })
      onClose()
    } catch (err) {
      console.error('更新用户错误:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePasswordChange = async (newPassword: string) => {
    if (!user || !onPasswordChange) return

    try {
      await onPasswordChange(user.id, newPassword)
      setPasswordModalVisible(false)
    } catch (err) {
      console.error('修改密码错误:', err)
      throw err
    }
  }

  // 早期返回必须在所有hooks之后
  if (!visible || !user) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">编辑账户</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户名:
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed text-sm"
                placeholder="用户名"
              />
              <p className="mt-1 text-sm text-gray-500">用户名不可修改</p>
            </div>

            {/* 权限 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-red-500">*</span> 权限:
              </label>
              <div className="relative">
                <select
                  value={formData.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  required
                  title="选择用户权限"
                  aria-label="选择用户权限"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-8 text-sm"
                >
                  <option value="admin">管理员</option>
                  <option value="operator">操作员</option>
                  <option value="viewer">查看者</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-red-500">*</span> 邮箱:
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
                placeholder="请输入邮箱"
              />
            </div>

            {/* 电话号码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                电话号码:
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
                placeholder="请输入电话号码"
              />
            </div>

            {/* 修改密码按钮 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码:
              </label>
              <button
                type="button"
                onClick={() => setPasswordModalVisible(true)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                修改密码
              </button>
            </div>

            {/* 按钮 */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-1.5 py-0.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
              >
                {loading ? '提交中...' : '保存'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 修改密码模态框 */}
      {onPasswordChange && (
        <UserPasswordModal
          visible={passwordModalVisible}
          onClose={() => setPasswordModalVisible(false)}
          onSubmit={handlePasswordChange}
        />
      )}
    </>
  )
}

