/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { type User } from '../utils/api'

// API 基础地址（生产环境使用相对路径，通过 Vercel rewrites 转发到后端）
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'

interface AuthState {
  user: User | null
  permissions: string[]
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isTestMode: boolean
}

interface AuthContextType extends AuthState {
  login: () => void
  testLogin: (username: string, password: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  getAccessToken: () => Promise<string | null>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  canViewBill: (billId?: string, operatorId?: string) => boolean
  isAdmin: () => boolean
  isManager: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 本地存储键
const USER_CACHE_KEY = 'bp_logistics_user_cache'
const TEST_MODE_KEY = 'bp_logistics_test_mode'

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user: auth0User,
    isAuthenticated: auth0IsAuthenticated,
    isLoading: auth0IsLoading,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0()

  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    token: null,
    isAuthenticated: false,
    isLoading: true,
    isTestMode: false,
  })

  // 从后端获取用户信息和权限
  const fetchUserProfile = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          return data.data
        }
      }
      return null
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }, [])

  // 检查是否有登录缓存（包括测试模式和正式模式）
  useEffect(() => {
    const testModeData = localStorage.getItem(TEST_MODE_KEY)
    if (testModeData) {
      try {
        const data = JSON.parse(testModeData)
        setState({
          user: data.user,
          permissions: data.permissions || [],
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
          isTestMode: data.isTestMode === true,  // 根据存储的值判断
        })
        return
      } catch (e) {
        localStorage.removeItem(TEST_MODE_KEY)
      }
    }
  }, [])

  // 当 Auth0 认证状态改变时，同步用户信息
  useEffect(() => {
    const syncUser = async () => {
      // 检查是否是密码登录（TEST_MODE_KEY 存储的是密码登录的数据，包括测试账号和正式账号）
      const hasPasswordLogin = localStorage.getItem(TEST_MODE_KEY)
      if (hasPasswordLogin) {
        // 密码登录用户，跳过 Auth0 同步
        return
      }

      if (auth0IsLoading) {
        return
      }

      if (!auth0IsAuthenticated || !auth0User) {
        // 未登录且不是密码登录，清除状态
        localStorage.removeItem(USER_CACHE_KEY)
        setState(prev => ({
          ...prev,
          user: null,
          permissions: [],
          token: null,
          isAuthenticated: false,
          isLoading: false,
        }))
        return
      }

      try {
        // 获取 Access Token
        const accessToken = await getAccessTokenSilently()

        // 从后端获取用户信息和权限
        const userProfile = await fetchUserProfile(accessToken)

        if (userProfile) {
          // 缓存用户信息
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userProfile))

          setState({
            user: userProfile.user,
            permissions: userProfile.permissions || [],
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            isTestMode: false,
          })
        } else {
          // 后端没有该用户，使用 Auth0 基本信息
          const basicUser: User = {
            id: auth0User.sub || '',
            username: auth0User.email || auth0User.nickname || '',
            name: auth0User.name || auth0User.nickname || '用户',
            email: auth0User.email || '',
            role: 'operator',
            status: 'active',
          }

          setState({
            user: basicUser,
            permissions: [],
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            isTestMode: false,
          })
        }
      } catch (error) {
        console.error('同步用户信息失败:', error)
        const cached = localStorage.getItem(USER_CACHE_KEY)
        if (cached) {
          const userProfile = JSON.parse(cached)
          setState({
            user: userProfile.user,
            permissions: userProfile.permissions || [],
            token: null,
            isAuthenticated: true,
            isLoading: false,
            isTestMode: false,
          })
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      }
    }

    syncUser()
  }, [auth0IsAuthenticated, auth0IsLoading, auth0User, getAccessTokenSilently, fetchUserProfile, state.isTestMode])

  // 正式登录（跳转到 Auth0）
  const login = useCallback(() => {
    loginWithRedirect()
  }, [loginWithRedirect])

  // 用户名+密码登录（本地开发/测试账号）
  const testLogin = useCallback(async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.errCode === 200 && data.data) {
        const { user, permissions, token } = data.data

        // 判断是否是测试用户
        const isTestUser = user.userType === 'test'
        
        // 所有环境都允许用密码登录（测试用户使用模拟数据，普通用户使用真实数据）

        // 保存登录数据
        const loginData = { user, permissions, token, isTestMode: isTestUser }
        localStorage.setItem(TEST_MODE_KEY, JSON.stringify(loginData))

        setState({
          user,
          permissions: permissions || [],
          token,
          isAuthenticated: true,
          isLoading: false,
          isTestMode: isTestUser,
        })

        return { success: true, message: '登录成功' }
      } else {
        return { success: false, message: data.msg || '登录失败' }
      }
    } catch (error: any) {
      console.error('登录失败:', error)
      return { success: false, message: error.message || '登录失败，请稍后重试' }
    }
  }, [])

  // 登出
  const logout = useCallback(() => {
    localStorage.removeItem(USER_CACHE_KEY)
    localStorage.removeItem(TEST_MODE_KEY)
    
    if (state.isTestMode) {
      // 测试模式直接清除状态
      setState({
        user: null,
        permissions: [],
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isTestMode: false,
      })
    } else {
      // 正式模式退出 Auth0
      auth0Logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      })
    }
  }, [auth0Logout, state.isTestMode])

  // 获取 Access Token（用于 API 调用）
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (state.isTestMode) {
      return state.token
    }
    try {
      const token = await getAccessTokenSilently()
      return token
    } catch (error) {
      console.error('获取 Access Token 失败:', error)
      return null
    }
  }, [getAccessTokenSilently, state.isTestMode, state.token])

  // 检查是否有某个权限
  const hasPermission = useCallback((permission: string): boolean => {
    if (state.user?.role === 'admin') return true
    if (!state.permissions || !Array.isArray(state.permissions)) return false
    return state.permissions.includes(permission)
  }, [state.user?.role, state.permissions])

  // 检查是否有任意一个权限
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (state.user?.role === 'admin') return true
    if (!state.permissions || !Array.isArray(state.permissions)) return false
    if (!permissions || !Array.isArray(permissions)) return false
    return permissions.some(p => state.permissions.includes(p))
  }, [state.user?.role, state.permissions])

  // 检查是否有所有权限
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (state.user?.role === 'admin') return true
    if (!state.permissions || !Array.isArray(state.permissions)) return false
    if (!permissions || !Array.isArray(permissions)) return false
    return permissions.every(p => state.permissions.includes(p))
  }, [state.user?.role, state.permissions])

  // 检查是否可以查看订单
  const canViewBill = useCallback((_billId?: string, operatorId?: string): boolean => {
    if (state.user?.role === 'admin' || state.user?.role === 'manager') {
      return true
    }
    if (hasPermission('bill:view_all')) {
      return true
    }
    if (operatorId && state.user?.id === operatorId) {
      return hasPermission('bill:view')
    }
    return false
  }, [state.user?.role, state.user?.id, hasPermission])

  // 是否是管理员
  const isAdmin = useCallback((): boolean => {
    return state.user?.role === 'admin'
  }, [state.user?.role])

  // 是否是经理
  const isManager = useCallback((): boolean => {
    return state.user?.role === 'manager' || state.user?.role === 'admin'
  }, [state.user?.role])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        testLogin,
        logout,
        getAccessToken,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        canViewBill,
        isAdmin,
        isManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 权限常量
export const PERMISSIONS = {
  BILL_VIEW: 'bill:view',
  BILL_VIEW_ALL: 'bill:view_all',
  BILL_CREATE: 'bill:create',
  BILL_EDIT: 'bill:edit',
  BILL_DELETE: 'bill:delete',
  CMR_VIEW: 'cmr:view',
  CMR_OPERATE: 'cmr:operate',
  INSPECTION_VIEW: 'inspection:view',
  INSPECTION_OPERATE: 'inspection:operate',
  CRM_VIEW: 'crm:view',
  CRM_MANAGE: 'crm:manage',
  CRM_CUSTOMER_VIEW: 'crm:customer:view',
  CRM_CUSTOMER_MANAGE: 'crm:customer:manage',
  CRM_OPPORTUNITY_VIEW: 'crm:opportunity:view',
  CRM_OPPORTUNITY_MANAGE: 'crm:opportunity:manage',
  FINANCE_VIEW: 'finance:view',
  FINANCE_MANAGE: 'finance:manage',
  FINANCE_INVOICE_VIEW: 'finance:invoice:view',
  FINANCE_INVOICE_MANAGE: 'finance:invoice:manage',
  FINANCE_PAYMENT_VIEW: 'finance:payment:view',
  FINANCE_PAYMENT_MANAGE: 'finance:payment:manage',
  FINANCE_REPORT_VIEW: 'finance:report:view',
  TOOL_INQUIRY: 'tool:inquiry',
  TOOL_TARIFF: 'tool:tariff',
  TOOL_CATEGORY: 'tool:category',
  TOOL_ADDRESS: 'tool:address',
  TOOL_COMMODITY: 'tool:commodity',
  TOOL_PAYMENT: 'tool:payment',
  SYSTEM_USER: 'system:user',
  SYSTEM_MENU: 'system:menu',
  SYSTEM_BASIC_DATA: 'system:basic_data',
  SYSTEM_TARIFF_RATE: 'system:tariff_rate',
  SYSTEM_LOGO: 'system:logo',
  SYSTEM_ACTIVITY_LOG: 'system:activity_log',
} as const

export default AuthContext
