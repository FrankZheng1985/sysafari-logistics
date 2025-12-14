import { useEffect, useState } from 'react'
import { LogIn, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuth()

  // 如果已登录，直接跳转到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // 加载 Logo
  useEffect(() => {
    const savedLogo = localStorage.getItem('systemLogo')
    setLogoUrl(savedLogo)
  }, [])

  const handleLogin = () => {
    login()
  }

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="系统 Logo"
              className="w-16 h-16 mx-auto object-contain mb-4"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-lg mb-4">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BP Logistics</h1>
          <p className="text-gray-600">物流管理系统</p>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">安全登录</h2>
            <p className="text-gray-500 text-sm">
              使用 Auth0 提供的企业级安全认证
            </p>
          </div>

          {/* Auth0 登录按钮 */}
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-primary-600 text-white py-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            <span>登录系统</span>
          </button>

          {/* 说明文字 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              点击登录后将跳转至安全认证页面
            </p>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2025 BP Logistics. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
