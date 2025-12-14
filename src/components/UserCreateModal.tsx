import { useState } from 'react'
import { X } from 'lucide-react'

interface UserCreateModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: {
    username: string
    name: string
    email: string
    phone?: string
    role: 'admin' | 'operator' | 'viewer'
    status: 'active' | 'inactive'
    password: string
  }) => Promise<void>
}

export default function UserCreateModal({ visible, onClose, onSubmit }: UserCreateModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    role: 'viewer' as 'admin' | 'operator' | 'viewer',
    status: 'active' as 'active' | 'inactive',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSubmit(formData)
      // 重置表单
      setFormData({
        username: '',
        name: '',
        email: '',
        phone: '',
        role: 'viewer',
        status: 'active',
        password: '',
      })
      onClose()
    } catch (err) {
      console.error('创建用户错误:', err)
      setError(err instanceof Error ? err.message : '创建用户失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 清除错误信息
    if (error) {
      setError('')
    }
  }

  // 早期返回必须在所有hooks之后
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">添加新账户</h2>
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
              <span className="text-red-500">*</span> 用户名:
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
              placeholder="请输入用户名"
            />
          </div>

          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> 姓名:
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
              placeholder="请输入姓名"
            />
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

          {/* 初始密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> 初始密码:
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
              placeholder="请输入初始密码"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

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
              {loading ? '提交中...' : '提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

