import { useState, useEffect } from 'react'
import { X, Key } from 'lucide-react'

interface UserPasswordModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (oldPassword: string, newPassword: string) => Promise<void>
}

export default function UserPasswordModal({ visible, onClose, onSubmit }: UserPasswordModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')

  // 重置表单
  useEffect(() => {
    if (visible) {
      setFormData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setError('')
    }
  }, [visible])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 验证原密码
    if (!formData.oldPassword) {
      setError('请输入原密码')
      return
    }

    // 验证新密码
    if (!formData.newPassword) {
      setError('请输入新密码')
      return
    }

    if (formData.newPassword.length < 6) {
      setError('新密码长度至少为6位')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (formData.oldPassword === formData.newPassword) {
      setError('新密码不能与原密码相同')
      return
    }

    setLoading(true)

    try {
      await onSubmit(formData.oldPassword, formData.newPassword)
    } catch (err) {
      console.error('修改密码错误:', err)
      setError(err instanceof Error ? err.message : '修改密码失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) {
      setError('')
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">修改密码</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 原密码 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              原密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.oldPassword}
              onChange={(e) => handleChange('oldPassword', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
              placeholder="请输入原密码"
            />
          </div>

          {/* 新密码 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              新密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.newPassword}
              onChange={(e) => handleChange('newPassword', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
              placeholder="请输入新密码（至少6位）"
            />
          </div>

          {/* 确认新密码 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              确认新密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white text-gray-900"
              placeholder="请再次输入新密码"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* 按钮 */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
            >
              {loading ? '提交中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
