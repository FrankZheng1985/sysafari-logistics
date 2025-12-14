import { useEffect, useState } from 'react'
import { LogIn, Shield, User, Lock, FlaskConical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [showTestLogin, setShowTestLogin] = useState(false)
  const [testUsername, setTestUsername] = useState('')
  const [testPassword, setTestPassword] = useState('')
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
  const handleLogin = () => {
    login()
  }

  // 测试账号登录
  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await testLogin(testUsername, testPassword)
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
    setTestUsername('demo_admin')
    setTestPassword('demo123')
  }

  const fillDemoOperator = () => {
    setTestUsername('demo_operator')
    setTestPassword('demo123')
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
          {!showTestLogin ? (
            <>
              {/* 正式登录入口 */}
              <div className="text-center mb-6">
                <Shield className="w-12 h-12 text-primary-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">安全登录</h2>
                <p className="text-gray-500 text-sm">
                  使用 Auth0 提供的企业级安全认证
                </p>
              </div>

              <button
                onClick={handleLogin}
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

              {/* 测试登录入口 */}
              <button
                onClick={() => setShowTestLogin(true)}
                className="w-full flex items-center justify-center gap-3 bg-orange-100 text-orange-700 py-3 rounded-lg font-medium hover:bg-orange-200 transition-colors"
              >
                <FlaskConical className="w-5 h-5" />
                <span>测试账号登录</span>
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                测试账号使用模拟数据，仅供演示
              </p>
            </>
          ) : (
            <>
              {/* 测试登录表单 */}
              <div className="text-center mb-6">
                <FlaskConical className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">测试账号登录</h2>
                <p className="text-gray-500 text-sm">
                  使用测试账号体验系统功能
                </p>
              </div>

              {/* 快速选择 */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={fillDemoAdmin}
                  className="flex-1 py-2 px-3 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  管理员演示
                </button>
                <button
                  type="button"
                  onClick={fillDemoOperator}
                  className="flex-1 py-2 px-3 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  操作员演示
                </button>
              </div>

              <form onSubmit={handleTestLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={testUsername}
                      onChange={(e) => setTestUsername(e.target.value)}
                      placeholder="输入测试用户名"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                      placeholder="输入密码"
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>登录中...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>测试登录</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTestLogin(false)
                    setError('')
                  }}
                  className="w-full py-2 text-gray-500 hover:text-gray-700"
                >
                  返回正式登录
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
