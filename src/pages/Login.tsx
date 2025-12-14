import { useEffect, useState } from 'react'
import { LogIn, Shield, User, Lock, FlaskConical, Monitor } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// 是否是开发环境
const isDev = import.meta.env.DEV

export default function Login() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showLocalLogin, setShowLocalLogin] = useState(isDev) // 开发环境默认显示本地登录
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const navigate = useNavigate()
  const { login, testLogin, isAuthenticated, isLoading } = useAuth()

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

  // 正式登录（Auth0）
  const handleAuth0Login = () => {
    login()
  }

  // 用户名+密码登录
  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await testLogin(username, password)
      if (result.success) {
        navigate('/', { replace: true })
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 快速填充测试账号
  const fillDemoAdmin = () => {
    setUsername('demo_admin')
    setPassword('demo123')
  }

  const fillDemoOperator = () => {
    setUsername('demo_operator')
    setPassword('demo123')
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
          {isDev && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              <Monitor className="w-3 h-3" />
              开发环境
            </span>
          )}
        </div>

        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {!showLocalLogin ? (
            <>
              {/* Auth0 登录入口 */}
              <div className="text-center mb-6">
                <Shield className="w-12 h-12 text-primary-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">安全登录</h2>
                <p className="text-gray-500 text-sm">
                  使用 Auth0 提供的企业级安全认证
                </p>
              </div>

              <button
                onClick={handleAuth0Login}
                className="w-full flex items-center justify-center gap-3 bg-primary-600 text-white py-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                <LogIn className="w-5 h-5" />
                <span>正式登录</span>
              </button>

              {/* 分隔线 */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-4 text-sm text-gray-400">或</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>

              {/* 账号密码登录入口 */}
              <button
                onClick={() => setShowLocalLogin(true)}
                className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                <User className="w-5 h-5" />
                <span>账号密码登录</span>
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                使用系统账号和密码登录
              </p>
            </>
          ) : (
            <>
              {/* 账号密码登录表单 */}
              <div className="text-center mb-6">
                {isDev ? (
                  <>
                    <Monitor className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">本地登录</h2>
                    <p className="text-gray-500 text-sm">
                      使用系统账号登录（开发环境）
                    </p>
                  </>
                ) : (
                  <>
                    <User className="w-12 h-12 text-primary-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">账号登录</h2>
                    <p className="text-gray-500 text-sm">
                      使用系统账号和密码登录
                    </p>
                  </>
                )}
              </div>

              {/* 快速选择演示账号（所有环境都显示） */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="flex-1 py-2 px-3 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-200"
                >
                  🧪 演示管理员
                </button>
                <button
                  type="button"
                  onClick={fillDemoOperator}
                  className="flex-1 py-2 px-3 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-200"
                >
                  🧪 演示操作员
                </button>
              </div>

              <form onSubmit={handleLocalLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="输入用户名"
                      required
                      className={`block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${isDev ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-primary-500 focus:border-primary-500'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入密码"
                      required
                      className={`block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${isDev ? 'focus:ring-blue-500 focus:border-blue-500' : 'focus:ring-primary-500 focus:border-primary-500'}`}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isDev ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500' : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'}`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>登录中...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>登录</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLocalLogin(false)
                    setError('')
                  }}
                  className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  {isDev ? '使用 Auth0 登录' : '返回 Auth0 登录'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* 版权信息 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2025 BP Logistics. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
