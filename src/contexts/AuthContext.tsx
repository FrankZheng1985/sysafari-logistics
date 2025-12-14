/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { login as loginApi, type User, type LoginResponse } from '../utils/api'

interface AuthState {
  user: User | null
  permissions: string[]
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  canViewBill: (billId?: string, operatorId?: string) => boolean
  isAdmin: () => boolean
  isManager: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 本地存储键
const STORAGE_KEY = 'bp_logistics_auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // 初始化时从本地存储加载认证信息
  useEffect(() => {
    const loadAuth = () => {
      try {
        const storedAuth = localStorage.getItem(STORAGE_KEY)
        if (storedAuth) {
          const parsedAuth = JSON.parse(storedAuth) as LoginResponse
          setState({
            user: parsedAuth.user,
            permissions: parsedAuth.permissions,
            token: parsedAuth.token,
            isAuthenticated: true,
            isLoading: false,
          })
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Failed to load auth from storage:', error)
        localStorage.removeItem(STORAGE_KEY)
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    loadAuth()
  }, [])

  // 登录
  const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await loginApi({ username, password })
      
      if (response.errCode === 200 && response.data) {
        const { user, permissions, token } = response.data
        
        // 保存到本地存储
        localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data))
        
        setState({
          user,
          permissions,
          token,
          isAuthenticated: true,
          isLoading: false,
        })
        
        return { success: true, message: '登录成功' }
      } else {
        return { success: false, message: response.msg || '登录失败' }
      }
    } catch (error: any) {
      console.error('Login failed:', error)
      return { success: false, message: error.message || '登录失败，请稍后重试' }
    }
  }

  // 登出
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setState({
      user: null,
      permissions: [],
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }

  // 检查是否有某个权限
  const hasPermission = (permission: string): boolean => {
    // 管理员拥有所有权限
    if (state.user?.role === 'admin') return true
    // 安全检查：确保 permissions 数组存在
    if (!state.permissions || !Array.isArray(state.permissions)) return false
    return state.permissions.includes(permission)
  }

  // 检查是否有任意一个权限
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (state.user?.role === 'admin') return true
    // 安全检查：确保 permissions 数组存在
    if (!state.permissions || !Array.isArray(state.permissions)) return false
    if (!permissions || !Array.isArray(permissions)) return false
    return permissions.some(p => state.permissions.includes(p))
  }

  // 检查是否有所有权限
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (state.user?.role === 'admin') return true
    // 安全检查：确保 permissions 数组存在
    if (!state.permissions || !Array.isArray(state.permissions)) return false
    if (!permissions || !Array.isArray(permissions)) return false
    return permissions.every(p => state.permissions.includes(p))
  }

  // 检查是否可以查看订单
  const canViewBill = (_billId?: string, operatorId?: string): boolean => {
    // 管理员和经理可以查看所有订单
    if (state.user?.role === 'admin' || state.user?.role === 'manager') {
      return true
    }
    
    // 如果有 bill:view_all 权限，可以查看所有订单
    if (hasPermission('bill:view_all')) {
      return true
    }
    
    // 否则只能查看分配给自己的订单
    if (operatorId && state.user?.id === operatorId) {
      return hasPermission('bill:view')
    }
    
    return false
  }

  // 是否是管理员
  const isAdmin = (): boolean => {
    return state.user?.role === 'admin'
  }

  // 是否是经理
  const isManager = (): boolean => {
    return state.user?.role === 'manager' || state.user?.role === 'admin'
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
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
  // 订单管理
  BILL_VIEW: 'bill:view',
  BILL_VIEW_ALL: 'bill:view_all',
  BILL_CREATE: 'bill:create',
  BILL_EDIT: 'bill:edit',
  BILL_DELETE: 'bill:delete',
  
  // CMR管理
  CMR_VIEW: 'cmr:view',
  CMR_OPERATE: 'cmr:operate',
  
  // 查验管理
  INSPECTION_VIEW: 'inspection:view',
  INSPECTION_OPERATE: 'inspection:operate',
  
  // CRM客户管理
  CRM_VIEW: 'crm:view',
  CRM_MANAGE: 'crm:manage',
  CRM_CUSTOMER_VIEW: 'crm:customer:view',
  CRM_CUSTOMER_MANAGE: 'crm:customer:manage',
  CRM_OPPORTUNITY_VIEW: 'crm:opportunity:view',
  CRM_OPPORTUNITY_MANAGE: 'crm:opportunity:manage',
  
  // 财务管理
  FINANCE_VIEW: 'finance:view',
  FINANCE_MANAGE: 'finance:manage',
  FINANCE_INVOICE_VIEW: 'finance:invoice:view',
  FINANCE_INVOICE_MANAGE: 'finance:invoice:manage',
  FINANCE_PAYMENT_VIEW: 'finance:payment:view',
  FINANCE_PAYMENT_MANAGE: 'finance:payment:manage',
  FINANCE_REPORT_VIEW: 'finance:report:view',
  
  // 工具
  TOOL_INQUIRY: 'tool:inquiry',
  TOOL_TARIFF: 'tool:tariff',
  TOOL_CATEGORY: 'tool:category',
  TOOL_ADDRESS: 'tool:address',
  TOOL_COMMODITY: 'tool:commodity',
  TOOL_PAYMENT: 'tool:payment',
  
  // 系统设置
  SYSTEM_USER: 'system:user',
  SYSTEM_MENU: 'system:menu',
  SYSTEM_BASIC_DATA: 'system:basic_data',
  SYSTEM_TARIFF_RATE: 'system:tariff_rate',
  SYSTEM_LOGO: 'system:logo',
  SYSTEM_ACTIVITY_LOG: 'system:activity_log',
} as const

export default AuthContext

