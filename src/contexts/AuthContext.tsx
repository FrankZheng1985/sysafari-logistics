/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { type User } from '../utils/api'
import { useSessionTimeout } from '../hooks/useSessionTimeout'
import SessionTimeoutModal from '../components/SessionTimeoutModal'

// API 基础地址 - 根据域名自动选择（阿里云部署）
function getApiBaseUrl(): string {
  // 开发环境
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api'
  }
  
  // 根据当前域名自动选择 API（全部指向阿里云）
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // 演示环境 -> 演示 API
    if (hostname === 'demo.xianfeng-eu.com') {
      return 'https://demo-api.xianfeng-eu.com/api'
    }
    
    // 生产环境 -> 阿里云 API
    if (hostname === 'erp.xianfeng-eu.com') {
      return 'https://api.xianfeng-eu.com/api'
    }
  }
  
  // 默认使用相对路径（通过 Nginx 反向代理转发）
  return '/api'
}

const API_BASE_URL = getApiBaseUrl()

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
  logout: (reason?: string) => void
  getAccessToken: () => Promise<string | null>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  canViewBill: (billId?: string, operatorId?: string) => boolean
  isAdmin: () => boolean
  isManager: () => boolean
  extendSession: () => void // 延长会话（重置超时计时器）
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
          
          // 同时保存 token 到 TEST_MODE_KEY，确保 getAuthHeaders() 可以获取
          const loginData = { 
            user: userProfile.user, 
            permissions: userProfile.permissions || [], 
            token: accessToken, 
            isTestMode: false 
          }
          localStorage.setItem(TEST_MODE_KEY, JSON.stringify(loginData))

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
          
          // 同时保存 token 到 TEST_MODE_KEY，确保 getAuthHeaders() 可以获取
          const loginData = { 
            user: basicUser, 
            permissions: [], 
            token: accessToken, 
            isTestMode: false 
          }
          localStorage.setItem(TEST_MODE_KEY, JSON.stringify(loginData))

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
    // 注意：移除 state.isTestMode 依赖，避免循环更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth0IsAuthenticated, auth0IsLoading, auth0User, getAccessTokenSilently, fetchUserProfile])

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
  const logout = useCallback((reason?: string) => {
    // 检查是否是密码登录用户（localStorage 中有 TEST_MODE_KEY 表示是密码登录）
    const isPasswordLogin = !!localStorage.getItem(TEST_MODE_KEY)
    
    // 清除会话超时相关的 localStorage
    localStorage.removeItem('bp_logistics_last_activity')
    localStorage.removeItem('bp_logistics_session_timeout')
    localStorage.removeItem(USER_CACHE_KEY)
    localStorage.removeItem(TEST_MODE_KEY)
    
    // 如果是超时登出，在控制台记录
    if (reason === 'timeout') {
      console.log('[Auth] 会话超时，自动登出')
    }
    
    // 密码登录用户（包括测试用户和普通用户）直接清除状态
    if (isPasswordLogin || state.isTestMode) {
      setState({
        user: null,
        permissions: [],
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isTestMode: false,
      })
      // 跳转到登录页
      window.location.href = '/login'
    } else {
      // Auth0 登录用户退出 Auth0
      auth0Logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      })
    }
  }, [auth0Logout, state.isTestMode])

  // 会话超时处理
  const handleSessionTimeout = useCallback(() => {
    logout('timeout')
  }, [logout])

  // 会话超时监控 - 仅在已登录且非加载状态时启用
  const {
    showWarning: showTimeoutWarning,
    remainingTime: sessionRemainingTime,
    extendSession,
  } = useSessionTimeout({
    onTimeout: handleSessionTimeout,
    enabled: state.isAuthenticated && !state.isLoading,
  })

  // 获取 Access Token（用于 API 调用）
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // 如果有存储的 token（来自密码登录），直接使用
    // 这样即使 isTestMode 是 false，也能使用密码登录的 token
    if (state.token) {
      return state.token
    }
    
    // 如果 state.token 还没初始化，尝试从 localStorage 直接读取
    // 这解决了页面刷新后 state 还没初始化完成就调用 API 的问题
    const testModeData = localStorage.getItem(TEST_MODE_KEY)
    if (testModeData) {
      try {
        const data = JSON.parse(testModeData)
        if (data.token) {
          return data.token
        }
      } catch {
        // 解析失败，继续尝试 Auth0
      }
    }
    
    // 否则尝试获取 Auth0 token
    try {
      const token = await getAccessTokenSilently()
      return token
    } catch (error) {
      console.error('获取 Access Token 失败:', error)
      return null
    }
  }, [getAccessTokenSilently, state.token])

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
        extendSession,
      }}
    >
      {children}
      {/* 会话超时提醒弹窗 */}
      <SessionTimeoutModal
        isOpen={showTimeoutWarning}
        remainingTime={sessionRemainingTime}
        onExtend={extendSession}
        onLogout={() => logout('timeout')}
      />
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
  // 系统概览
  DASHBOARD_VIEW: 'dashboard:view',
  BP_VIEW: 'bp:view',
  // 订单管理
  BILL_VIEW: 'bill:view',
  BILL_VIEW_ALL: 'bill:view_all',
  BILL_CREATE: 'bill:create',
  BILL_EDIT: 'bill:edit',
  BILL_DELETE: 'bill:delete',
  // TMS运输
  CMR_VIEW: 'cmr:view',
  CMR_OPERATE: 'cmr:operate',
  TMS_VIEW: 'tms:view',
  TMS_TRACK: 'tms:track',
  TMS_OPERATE: 'tms:operate',
  TMS_DISPATCH: 'tms:dispatch',
  TMS_EXCEPTION: 'tms:exception',
  TMS_PRICING: 'tms:pricing',
  TMS_CONDITIONS: 'tms:conditions',
  TMS_LAST_MILE: 'tms:last_mile',
  // 查验管理
  INSPECTION_VIEW: 'inspection:view',
  INSPECTION_OPERATE: 'inspection:operate',
  INSPECTION_RELEASE: 'inspection:release',
  // CRM客户管理
  CRM_VIEW: 'crm:view',
  CRM_MANAGE: 'crm:manage',
  CRM_CUSTOMER_VIEW: 'crm:customer:view',
  CRM_CUSTOMER_MANAGE: 'crm:customer:manage',
  CRM_OPPORTUNITY_VIEW: 'crm:opportunity:view',
  CRM_OPPORTUNITY_MANAGE: 'crm:opportunity:manage',
  CRM_QUOTATION_MANAGE: 'crm:quotation_manage',
  CRM_CONTRACT_MANAGE: 'crm:contract_manage',
  CRM_FEEDBACK_MANAGE: 'crm:feedback_manage',
  CRM_BUSINESS_INFO: 'crm:business_info',
  // 供应商管理
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_MANAGE: 'supplier:manage',
  SUPPLIER_PRICE_IMPORT: 'supplier:price_import',
  // 财务管理
  FINANCE_VIEW: 'finance:view',
  FINANCE_MANAGE: 'finance:manage',
  FINANCE_INVOICE_VIEW: 'finance:invoice_view',
  FINANCE_INVOICE_CREATE: 'finance:invoice_create',
  FINANCE_INVOICE_EDIT: 'finance:invoice_edit',
  FINANCE_INVOICE_DELETE: 'finance:invoice_delete',
  FINANCE_INVOICE_MANAGE: 'finance:invoice:manage',
  FINANCE_PAYMENT_VIEW: 'finance:payment_view',
  FINANCE_PAYMENT_REGISTER: 'finance:payment_register',
  FINANCE_PAYMENT_APPROVE: 'finance:payment_approve',
  FINANCE_PAYMENT_MANAGE: 'finance:payment:manage',
  FINANCE_REPORT_VIEW: 'finance:report_view',
  FINANCE_REPORT_EXPORT: 'finance:report_export',
  FINANCE_FEE_MANAGE: 'finance:fee_manage',
  FINANCE_BANK_MANAGE: 'finance:bank_manage',
  FINANCE_STATEMENTS: 'finance:statements',
  FINANCE_COMMISSION_MANAGE: 'finance:commission_manage',
  FINANCE_CARRIER_SETTLEMENT: 'finance:carrier_settlement',
  // 单证管理
  DOCUMENT_VIEW: 'document:view',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_EDIT: 'document:edit',
  DOCUMENT_DELETE: 'document:delete',
  DOCUMENT_IMPORT: 'document:import',
  DOCUMENT_EXPORT: 'document:export',
  DOCUMENT_MATCH: 'document:match',
  DOCUMENT_TAX_CALC: 'document:tax_calc',
  DOCUMENT_SUPPLEMENT: 'document:supplement',
  DOCUMENT_MATCH_RECORDS: 'document:match_records',
  DOCUMENT_SENSITIVE_PRODUCTS: 'document:sensitive_products',
  // 产品定价
  PRODUCT_VIEW: 'product:view',
  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_PRICE_ADJUST: 'product:price_adjust',
  // 工具箱
  TOOL_INQUIRY: 'tool:inquiry',
  TOOL_TARIFF: 'tool:tariff',
  TOOL_CATEGORY: 'tool:category',
  TOOL_ADDRESS: 'tool:address',
  TOOL_COMMODITY: 'tool:commodity',
  TOOL_PAYMENT: 'tool:payment',
  TOOL_SHARED_TAX: 'tool:shared_tax',
  // 系统管理
  SYSTEM_USER: 'system:user',
  SYSTEM_MENU: 'system:menu',
  SYSTEM_BASIC_DATA: 'system:basic_data',
  SYSTEM_TARIFF_RATE: 'system:tariff_rate',
  SYSTEM_TARIFF_RATE_SYNC: 'system:tariff_rate_sync',
  SYSTEM_TARIFF_RATE_IMPORT: 'system:tariff_rate_import',
  SYSTEM_LOGO: 'system:logo',
  SYSTEM_ACTIVITY_LOG: 'system:activity_log',
  SYSTEM_MESSAGE: 'system:message',
  SYSTEM_DATA_IMPORT: 'system:data_import',
  SYSTEM_SECURITY: 'system:security',
  SYSTEM_API_INTEGRATIONS: 'system:api_integrations',
  SYSTEM_APPROVAL_SETTINGS: 'system:approval_settings',
  // 审批管理
  APPROVAL_VIEW: 'approval:view',
  APPROVAL_SUBMIT: 'approval:submit',
  APPROVAL_APPROVE: 'approval:approve',
} as const

export default AuthContext
