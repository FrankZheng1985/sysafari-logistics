import { User, Key, LogOut, Shield, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import UserPasswordModal from './UserPasswordModal'
import NotificationBell from './NotificationBell'
import MessageCenterModal from './MessageCenterModal'
import { useAuth } from '../contexts/AuthContext'
import { changePassword } from '../utils/api'

export default function Header() {
  const navigate = useNavigate()
  const { user: currentUser, logout, isAdmin, isManager, isTestMode } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showMessageCenter, setShowMessageCenter] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleUserClick = () => {
    setShowDropdown(!showDropdown)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleChangePassword = () => {
    setShowDropdown(false)
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = async (oldPassword: string, newPassword: string) => {
    if (!currentUser?.id) {
      alert('用户信息不存在')
      return
    }
    
    try {
      const response = await changePassword(currentUser.id, oldPassword, newPassword)
      if (response.errCode === 200) {
        alert('密码修改成功')
        setShowPasswordModal(false)
      } else {
        alert(response.msg || '密码修改失败')
      }
    } catch (error: any) {
      console.error('修改密码失败:', error)
      alert(error.message || '密码修改失败，请稍后重试')
    }
  }

  const handleUserManage = () => {
    setShowDropdown(false)
    navigate('/system/user-manage')
  }

  const displayName = currentUser?.email || currentUser?.username || currentUser?.name || '未登录'
  const roleName = currentUser?.roleName || currentUser?.role || ''

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">BP Logistics 物流管理系统</h1>
      </div>
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        {/* 消息中心按钮 */}
        <button
          onClick={() => setShowMessageCenter(true)}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="消息中心"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        
        {/* 通知铃铛 */}
        <NotificationBell />
        
        <button
          onClick={handleUserClick}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-primary-300 hover:text-primary-600 transition-all cursor-pointer"
          title="点击查看用户信息"
        >
          <User className="w-4 h-4" />
          <span>{displayName}</span>
        </button>

        {/* 下拉菜单 */}
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
            {/* 用户信息 */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{currentUser?.name || '用户'}</div>
                  <div className="text-xs text-gray-500">{displayName}</div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {roleName && (
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                        currentUser?.role === 'admin' ? 'bg-red-100 text-red-700' :
                        currentUser?.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                        currentUser?.role === 'operator' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {roleName}
                      </span>
                    )}
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                      isTestMode ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isTestMode ? '测试账号' : '正式账号'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 用户管理（仅管理员和经理可见） */}
            {(isAdmin() || isManager()) && (
              <button
                onClick={handleUserManage}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <Shield className="w-4 h-4 text-gray-500" />
                <span>用户管理</span>
              </button>
            )}

            {/* 修改密码按钮 */}
            <button
              onClick={handleChangePassword}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <Key className="w-4 h-4 text-gray-500" />
              <span>修改密码</span>
            </button>

            {/* 退出登录按钮 */}
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </div>
        )}

        {/* 修改密码模态框 */}
        <UserPasswordModal
          visible={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSubmit={handlePasswordSubmit}
        />

        {/* 消息中心模态框 (使用Portal渲染到body) */}
        <MessageCenterModal
          visible={showMessageCenter}
          onClose={() => setShowMessageCenter(false)}
        />
      </div>
    </header>
  )
}

