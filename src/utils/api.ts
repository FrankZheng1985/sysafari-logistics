/**
 * API 服务工具
 * 物流管理系统 API 接口
 */

import { isTestMode, mockAPI, createWriteBlockedResponse } from '../services/mockDataService'

// API 基础地址配置 - 根据域名自动选择（阿里云部署）
export function getApiBaseUrl(): string {
  // 优先使用环境变量
  if (import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string
  }
  
  // 根据当前域名自动选择 API（全部指向阿里云）
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // 演示环境 -> 演示 API
    if (hostname === 'demo.xianfeng-eu.com') {
      return 'https://demo-api.xianfeng-eu.com'
    }
    
    // 生产环境 -> 阿里云 API
    if (hostname === 'erp.xianfeng-eu.com') {
      return 'https://api.xianfeng-eu.com'
    }
    
    // 阿里云 OSS 直接访问时
    if (hostname.includes('oss-cn-hongkong.aliyuncs.com')) {
      return 'https://api.xianfeng-eu.com'
    }
  }
  
  // 默认使用相对路径（本地开发或其他情况）
  return ''
}

const API_BASE_URL = getApiBaseUrl()

// 测试模式本地存储键
const TEST_MODE_KEY = 'bp_logistics_test_mode'

/**
 * 获取存储的认证 Token
 * 从 localStorage 中获取登录时保存的 token
 */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  const testData = localStorage.getItem(TEST_MODE_KEY)
  if (!testData) return null
  
  try {
    const data = JSON.parse(testData)
    return data.token || null
  } catch {
    return null
  }
}

/**
 * 获取认证 Headers
 * 用于需要自定义 fetch 调用的场景
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken()
  if (token) {
    return { 'Authorization': `Bearer ${token}` }
  }
  return {}
}

/**
 * 检查是否为测试模式
 * 只有当用户以测试账号（user_type='test'）登录时才返回 true
 */
function checkTestMode(): boolean {
  if (typeof window === 'undefined') return false
  const testData = localStorage.getItem(TEST_MODE_KEY)
  if (!testData) return false
  
  try {
    const data = JSON.parse(testData)
    // 只有 isTestMode 为 true 时才是测试模式
    return data.isTestMode === true
  } catch {
    return false
  }
}

/**
 * 测试模式下显示提示
 */
function showTestModeWarning(action: string): void {
  console.warn(`🧪 测试模式: ${action} 操作被拦截，数据不会被保存`)
}

// ==================== API 请求配置 ====================
const DEFAULT_TIMEOUT = 30000 // 默认30秒超时
const RETRY_COUNT = 1 // 重试次数（GET请求）
const RETRY_DELAY = 1000 // 重试延迟（毫秒）

/**
 * 自定义 API 错误类
 */
export class ApiError extends Error {
  status: number
  code: string
  isTimeout: boolean
  isNetworkError: boolean

  constructor(message: string, status = 0, code = 'UNKNOWN_ERROR', isTimeout = false, isNetworkError = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.isTimeout = isTimeout
    this.isNetworkError = isNetworkError
  }
}

/**
 * 请求选项扩展
 */
interface RequestOptions extends RequestInit {
  timeout?: number // 超时时间（毫秒）
  retry?: boolean // 是否自动重试（仅GET请求）
  retryCount?: number // 重试次数
  showErrorToast?: boolean // 是否显示错误提示
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 通用 API 请求函数（带超时和重试机制）
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { 
    timeout = DEFAULT_TIMEOUT, 
    retry = true,
    retryCount = RETRY_COUNT,
    showErrorToast = true,
    ...fetchOptions 
  } = options
  
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const shouldRetry = retry && method === 'GET' && retryCount > 0

  // 获取存储的 token 用于认证
  const token = getStoredToken()
  const authHeaders: Record<string, string> = {}
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`
  }

  // 内部执行函数（支持重试）
  async function executeRequest(attemptNumber: number): Promise<T> {
    // 创建 AbortController 用于超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: fetchOptions.signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...fetchOptions.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // 尝试读取响应体中的错误信息
        let errorMsg = response.statusText
        let errorCode = `HTTP_${response.status}`
        
        try {
          const errorData = await response.json()
          errorMsg = errorData.msg || errorData.message || errorMsg
          errorCode = errorData.errCode?.toString() || errorCode
        } catch {
          // 无法解析响应体，使用默认错误信息
        }

        // 401 未授权，可能需要重新登录
        if (response.status === 401) {
          throw new ApiError('登录已过期，请重新登录', 401, 'UNAUTHORIZED')
        }

        // 403 禁止访问
        if (response.status === 403) {
          throw new ApiError('没有权限访问此资源', 403, 'FORBIDDEN')
        }

        // 404 资源不存在
        if (response.status === 404) {
          throw new ApiError('请求的资源不存在', 404, 'NOT_FOUND')
        }

        // 500+ 服务器错误
        if (response.status >= 500) {
          throw new ApiError(errorMsg || '服务器错误，请稍后重试', response.status, 'SERVER_ERROR')
        }

        throw new ApiError(errorMsg, response.status, errorCode)
      }

      return response.json()
    } catch (error: any) {
      clearTimeout(timeoutId)

      // 处理请求被取消的情况
      if (error.name === 'AbortError') {
        // 检查是否是超时导致的取消
        const isTimeoutError = !fetchOptions.signal?.aborted
        if (isTimeoutError) {
          const timeoutError = new ApiError(
            `请求超时（${timeout / 1000}秒），请检查网络连接`,
            0,
            'TIMEOUT',
            true
          )
          
          // 超时可以重试
          if (shouldRetry && attemptNumber < retryCount) {
            console.warn(`[API] 请求超时，${RETRY_DELAY / 1000}秒后重试... (${attemptNumber + 1}/${retryCount})`)
            await delay(RETRY_DELAY)
            return executeRequest(attemptNumber + 1)
          }
          
          throw timeoutError
        }
        // 用户主动取消，直接抛出
        throw new ApiError('请求已取消', 0, 'CANCELLED')
      }

      // 处理网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new ApiError(
          '网络连接失败，请检查网络设置',
          0,
          'NETWORK_ERROR',
          false,
          true
        )
        
        // 网络错误可以重试
        if (shouldRetry && attemptNumber < retryCount) {
          console.warn(`[API] 网络错误，${RETRY_DELAY / 1000}秒后重试... (${attemptNumber + 1}/${retryCount})`)
          await delay(RETRY_DELAY)
          return executeRequest(attemptNumber + 1)
        }
        
        throw networkError
      }

      // 如果已经是 ApiError，直接抛出
      if (error instanceof ApiError) {
        throw error
      }

      // 其他错误
      throw new ApiError(error.message || '请求失败', 0, 'UNKNOWN_ERROR')
    }
  }

  return executeRequest(0)
}

// fetchApi 是 request 的别名，用于保持向后兼容
const fetchApi = request

// ==================== 便捷 API 对象 ====================
// 提供 api.get(), api.post() 等便捷方法

interface ApiRequestOptions {
  timeout?: number
  signal?: AbortSignal
  retry?: boolean
}

const api = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) => 
    request<T>(endpoint, { method: 'GET', ...options }),
  
  post: <T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) => 
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    }),
  
  put: <T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) => 
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    }),
  
  delete: <T>(endpoint: string, options?: ApiRequestOptions) => 
    request<T>(endpoint, { method: 'DELETE', ...options }),
  
  patch: <T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) => 
    request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    })
}

export default api

/**
 * 创建一个可取消的请求
 * 返回 [promise, abortController]
 * 在组件卸载时调用 abortController.abort() 取消请求
 */
export function createCancellableRequest<T>(
  requestFn: (signal: AbortSignal) => Promise<T>
): [Promise<T>, AbortController] {
  const controller = new AbortController()
  const promise = requestFn(controller.signal)
  return [promise, controller]
}

/**
 * 用于 React 组件的 hook 辅助函数
 * 在组件卸载时自动取消所有未完成的请求
 */
export function createAbortController(): AbortController {
  return new AbortController()
}

// ==================== 用户管理 API 接口 ====================

export interface User {
  id: string
  username: string
  name: string
  email: string
  phone?: string
  avatar?: string
  role: string  // 扩展角色类型支持更多角色
  roleName?: string
  status: 'active' | 'inactive'
  lastLoginTime?: string
  lastLoginIp?: string
  loginCount?: number
  createTime?: string
  updateTime?: string
  permissions?: string[]
  // 新增字段
  supervisorId?: number
  department?: string
  position?: string
}

export interface CreateUserRequest {
  username: string
  name: string
  email?: string
  phone?: string
  role: string  // 扩展角色类型
  status?: 'active' | 'inactive'
  password: string
  // 新增字段
  supervisorId?: number
  department?: string
  position?: string
}

export interface UpdateUserRequest {
  id: string
  name?: string
  email?: string
  phone?: string
  role?: string  // 扩展角色类型
  status?: 'active' | 'inactive'
  // 新增字段
  supervisorId?: number
  department?: string
  position?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  permissions: string[]
  token: string
}

export interface Role {
  id: number
  roleCode: string
  roleName: string
  description: string
  isSystem: boolean
  status: string
  colorCode?: string
  // 新增字段
  roleLevel?: number
  canManageTeam?: boolean
  canApprove?: boolean
}

export interface Permission {
  permissionCode: string
  permissionName: string
  module: string
  description?: string
  category?: string
  isSensitive?: boolean
}

export interface ApiResponse<T = any> {
  errCode: number
  msg: string
  data?: T
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  stats?: Record<string, unknown>
}

/**
 * 用户登录
 * @param data 登录凭证
 * @returns 用户信息和token
 * 
 * 接口地址: POST /api/auth/login
 */
export async function login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  return request<ApiResponse<LoginResponse>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 修改密码
 * @param userId 用户ID
 * @param oldPassword 旧密码
 * @param newPassword 新密码
 * @returns 操作结果
 * 
 * 接口地址: POST /api/auth/change-password
 */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<ApiResponse<void>> {
  return request<ApiResponse<void>>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ userId, oldPassword, newPassword }),
  })
}

/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 用户列表
 * 
 * 接口地址: GET /api/users
 * 请求参数: { page?: number, pageSize?: number, search?: string, role?: string, status?: string, userType?: string }
 */
export async function getUserList(params?: {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  status?: string
  userType?: string  // 用户类型过滤：'test' = 演示用户，'normal' = 正式用户
}): Promise<ApiResponse<PaginatedResponse<User>>> {
  // 演示环境：使用真实 API 获取测试数据库中的数据

  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.role) queryParams.append('role', params.role)
  if (params?.status) queryParams.append('status', params.status)
  if (params?.userType) queryParams.append('userType', params.userType)
  
  const queryString = queryParams.toString()
  return request<ApiResponse<PaginatedResponse<User>>>(`/api/users${queryString ? `?${queryString}` : ''}`)
}

/**
 * 获取用户详情
 * @param id 用户ID
 * @returns 用户详情
 */
export async function getUserById(id: string): Promise<ApiResponse<User>> {
  return request<ApiResponse<User>>(`/api/users/${id}`)
}

/**
 * 创建用户
 * @param data 用户数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/users
 * 请求体: CreateUserRequest
 */
export async function createUser(data: CreateUserRequest): Promise<ApiResponse<User>> {
  // 测试模式：阻止写操作
  if (checkTestMode()) {
    showTestModeWarning('创建用户')
    return createWriteBlockedResponse() as any
  }

  return request<ApiResponse<User>>('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 更新用户信息
 * @param data 用户数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/users/:id
 * 请求体: UpdateUserRequest
 */
export async function updateUser(data: UpdateUserRequest): Promise<ApiResponse<void>> {
  const { id, ...updateData } = data
  return request<ApiResponse<void>>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  })
}

/**
 * 删除用户
 * @param id 用户ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/users/:id
 */
export async function deleteUser(id: string): Promise<ApiResponse<void>> {
  return request<ApiResponse<void>>(`/api/users/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 更新用户状态（启用/禁用）
 * @param id 用户ID
 * @param status 状态
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/users/:id/status
 * 请求体: { status: 'active' | 'inactive' }
 */
export async function updateUserStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<ApiResponse<void>> {
  return request<ApiResponse<void>>(`/api/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

/**
 * 重置用户密码（管理员操作）
 * @param id 用户ID
 * @param newPassword 新密码（可选，默认为 password123）
 * @returns 修改结果
 * 
 * 接口地址: POST /api/users/:id/reset-password
 */
export async function resetUserPassword(
  id: string,
  newPassword?: string
): Promise<ApiResponse<{ newPassword: string }>> {
  return request<ApiResponse<{ newPassword: string }>>(`/api/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  })
}

/**
 * 获取角色列表
 * @returns 角色列表
 * 
 * 接口地址: GET /api/roles
 */
export async function getRoleList(): Promise<ApiResponse<Role[]>> {
  return request<ApiResponse<Role[]>>('/api/roles')
}

/**
 * 获取权限列表
 * @returns 权限列表
 * 
 * 接口地址: GET /api/permissions
 */
export async function getPermissionList(): Promise<ApiResponse<{
  list: Permission[]
  grouped: Record<string, Permission[]>
}>> {
  return request<ApiResponse<{
    list: Permission[]
    grouped: Record<string, Permission[]>
  }>>('/api/permissions')
}

/**
 * 获取角色权限
 * @param roleCode 角色代码
 * @returns 该角色的权限列表
 * 
 * 接口地址: GET /api/roles/:roleCode/permissions
 */
export async function getRolePermissions(roleCode: string): Promise<ApiResponse<Permission[]>> {
  return request<ApiResponse<Permission[]>>(`/api/roles/${roleCode}/permissions`)
}

/**
 * 更新角色权限
 * @param roleCode 角色代码
 * @param permissions 权限代码列表
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/roles/:roleCode/permissions
 */
export async function updateRolePermissions(
  roleCode: string, 
  permissions: string[]
): Promise<ApiResponse<void>> {
  return request<ApiResponse<void>>(`/api/roles/${roleCode}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionCodes: permissions })  // 后端期望 permissionCodes
  })
}

/**
 * 删除角色
 * @param roleCode 角色代码
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/roles/:roleCode
 */
export async function deleteRole(roleCode: string): Promise<ApiResponse<void>> {
  return request<ApiResponse<void>>(`/api/roles/${roleCode}`, {
    method: 'DELETE'
  })
}

/**
 * 获取操作员列表（用于分配订单）
 * @returns 操作员列表
 * 
 * 接口地址: GET /api/operators
 */
export async function getOperatorList(): Promise<ApiResponse<User[]>> {
  return request<ApiResponse<User[]>>('/api/operators')
}

/**
 * 分配订单给操作员
 * @param billId 订单ID
 * @param operatorId 操作员ID
 * @param assignedBy 分配人ID
 * @returns 分配结果
 * 
 * 接口地址: POST /api/bills/:billId/assign
 */
export async function assignBillToOperator(
  billId: string,
  operatorId: string,
  assignedBy?: string
): Promise<ApiResponse<{ billId: string; operatorId: string; operatorName: string }>> {
  return request<ApiResponse<{ billId: string; operatorId: string; operatorName: string }>>(`/api/bills/${billId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ operatorId, assignedBy }),
  })
}

// ==================== 文件下载 API 接口 ====================

/**
 * 获取文件下载链接
 * @param declarationNumber 报关单号或申报ID
 * @returns 文件下载链接
 * 
 * 接口地址: GET /api/files/download?declarationNumber={declarationNumber}
 */
export async function getFileDownloadUrl(declarationNumber: string): Promise<ApiResponse<{ downloadUrl: string; fileName: string }>> {
  // 注：此接口使用模拟数据，后台接口完成后可切换为真实 API 调用
  // return request<ApiResponse<{ downloadUrl: string; fileName: string }>>(
  //   `/files/download?declarationNumber=${declarationNumber}`
  // )
  
  // 模拟数据
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        errCode: 200,
        msg: 'success',
        data: {
          downloadUrl: `/api/files/${declarationNumber}.pdf`, // 示例下载链接
          fileName: `${declarationNumber}.pdf`,
        },
      })
    }, 300)
  })
}

/**
 * 下载文件
 * @param declarationNumber 报关单号或申报ID
 * @returns 下载结果
 */
export async function downloadFile(declarationNumber: string): Promise<void> {
  try {
    const response = await getFileDownloadUrl(declarationNumber)
    if (response.errCode === 200 && response.data) {
      // 创建临时链接并触发下载
      const link = document.createElement('a')
      link.href = response.data.downloadUrl
      link.download = response.data.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      throw new Error(response.msg || '获取下载链接失败')
    }
  } catch (error) {
    console.error('下载文件失败:', error)
    throw error
  }
}

// ==================== 订单管理 API 接口 ====================

export interface BillOfLading {
  id: string
  orderSeq?: number       // 订单序号
  orderNumber?: string    // 订单号 (BP25XXXXX)
  billId?: string
  billNumber: string      // 提单号
  containerNumber?: string // 集装箱号
  vessel?: string
  voyage?: string  // 航次
  etd?: string  // 装船日期 (Date Laden on Board)
  eta?: string
  ata?: string
  pieces: number
  weight: number
  volume?: number
  inspection: string
  customsStats: string
  creator: string
  createTime: string
  status: string
  shipper?: string
  consignee?: string
  notifyParty?: string
  portOfLoading?: string
  portOfDischarge?: string
  placeOfDelivery?: string
  completeTime?: string
  deliveryStatus?: string
  transportMethod?: string
  companyName?: string
  customerName?: string  // 客户名称（与companyName同义）
  customerId?: string    // 客户ID
  customerCode?: string  // 客户编码
  isVoid?: boolean
  voidReason?: string
  voidTime?: string
  shipStatus?: '未到港' | '已到港' | '跳港'
  skipPort?: string
  skipPortTime?: string
  docSwapStatus?: '未换单' | '已换单'
  docSwapTime?: string
  customsStatus?: '未放行' | '已放行'
  customsReleaseTime?: string
  // 查验相关字段
  inspectionDetail?: string
  inspectionEstimatedTime?: string
  inspectionStartTime?: string
  inspectionEndTime?: string
  inspectionResult?: string
  inspectionResultNote?: string
  inspectionReleaseTime?: string
  inspectionConfirmedTime?: string
  // 船舶相关字段
  shippingCompany?: string
  vesselName?: string
  destinationPort?: string
  // CMR相关字段
  cmrNotes?: string
  cmrEstimatedPickupTime?: string
  cmrServiceProvider?: string
  cmrDeliveryAddress?: string
  cmrEstimatedArrivalTime?: string
  cmrActualArrivalTime?: string
  cmrUnloadingCompleteTime?: string
  cmrConfirmedTime?: string
  // CMR异常相关字段
  cmrHasException?: number
  cmrExceptionNote?: string
  cmrExceptionTime?: string
  cmrExceptionStatus?: string
  cmrExceptionResolution?: string
  cmrExceptionResolvedTime?: string
  // 附加属性字段
  containerType?: string  // 箱型: 'cfs' | 'fcl'
  containerSize?: string  // 柜型: '20GP' | '40GP' | '40HQ' 等
  sealNumber?: string  // 封号
  billType?: string  // 提单类型: 'master' | 'house'
  transportArrangement?: string  // 运输安排: 'entrust' | 'self'
  consigneeType?: string  // 收货人类型: 'asl' | 'not-asl'
  containerReturn?: string  // 异地还柜: 'off-site' | 'local'
  fullContainerTransport?: string  // 全程整柜运输: 'must-full' | 'can-split'
  lastMileTransport?: string  // 末端运输方式
  devanning?: string  // 拆柜: 'required' | 'not-required'
  t1Declaration?: string  // T1报关: 'yes' | 'no'
  // 导入者追踪字段
  importedBy?: number  // 导入者用户ID
  importedByName?: string  // 导入者用户名
  importTime?: string  // 导入时间
  // Reference List（包含多个卸货地址）
  referenceList?: Array<{
    referenceNumber: string
    pieces: string
    grossWeight: string
    shipper: string
    shipperDetails: string
    consigneeAddress: string
    consigneeAddressDetails: string
  }>
}

// 用于 API 提交的输入类型（referenceList 可以是字符串或数组）
export type BillOfLadingInput = Omit<Partial<BillOfLading>, 'referenceList'> & {
  referenceList?: string | BillOfLading['referenceList']
}

export interface GetBillsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  type?: 'schedule' | 'draft' | 'history' | 'void'
  includeVoid?: boolean
}

export interface BillStats {
  // 当前类型的数量
  currentTypeCount: number
  // 各类型数量
  scheduleCount: number
  draftCount: number
  historyCount: number
  voidCount: number
  // 总体统计
  allTotal: number
  validCount: number
}

/**
 * 获取提单列表
 * @param params 查询参数
 * @returns 提单列表
 * 
 * 接口地址: GET /api/bills
 */
export async function getBillsList(params?: GetBillsParams): Promise<ApiResponse<PaginatedResponse<BillOfLading> & { stats?: BillStats }>> {
  // 演示环境：使用真实 API 获取测试数据库中的数据
  // 只阻止写操作，读操作正常使用 API

  try {
    // 构建查询参数，过滤掉 undefined 和空字符串
    const queryParams = new URLSearchParams()
    if (params?.type) queryParams.append('type', params.type)
    if (params?.page) queryParams.append('page', String(params.page))
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize))
    if (params?.search && params.search.trim()) queryParams.append('search', params.search.trim())
    if (params?.status) queryParams.append('status', params.status)
    if (params?.includeVoid !== undefined) queryParams.append('includeVoid', String(params.includeVoid))
    
    const queryString = queryParams.toString()
    const response = await fetch(`${API_BASE_URL}/api/bills${queryString ? '?' + queryString : ''}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取提单列表失败:', error)
    console.warn('API 服务器可能未启动，使用 mock 数据作为降级方案')
    
    // 如果 API 不可用，使用 mock 数据作为降级方案
    const { scheduleBills, historyBills } = await import('../data/mockOrders')
    const mockData = params?.type === 'draft' ? historyBills : scheduleBills
    
    // 应用搜索过滤
    let filteredData = [...mockData]
    if (params?.search) {
      const search = params.search.toLowerCase()
      filteredData = filteredData.filter(bill =>
        bill.billNumber?.toLowerCase().includes(search) ||
        bill.containerNumber?.toLowerCase().includes(search) ||
        bill.vessel?.toLowerCase().includes(search) ||
        bill.billId?.toLowerCase().includes(search) ||
        bill.companyName?.toLowerCase().includes(search)
      )
    }
    
    // 应用状态过滤
    if (params?.status) {
      filteredData = filteredData.filter(bill => bill.status === params.status)
    }
    
    // 分页
    const page = params?.page || 1
    const pageSize = params?.pageSize || 10
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginatedList = filteredData.slice(start, end)
    
    return {
      errCode: 200,
      msg: '使用 mock 数据（API 服务器未启动）',
      data: {
        list: paginatedList,
        total: filteredData.length,
        page,
        pageSize,
      },
    }
  }
}

/**
 * 获取提单详情
 * @param id 提单ID
 * @returns 提单详情
 * 
 * 接口地址: GET /api/bills/:id
 */
export async function getBillById(id: string): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取提单详情失败:', error)
    throw error
  }
}

// 操作日志接口
export interface OperationLog {
  id: number
  billId: string
  operationType: string
  operationName: string
  oldValue: string | null
  newValue: string | null
  operator: string
  remark: string | null
  operationTime: string
}

// 提单文件
export interface BillFile {
  id: number
  billId: string
  fileName: string
  originalSize: number
  compressedSize: number
  fileType: string
  uploadTime: string
  uploadBy: string
}

// 获取提单文件列表
export async function getBillFiles(billId: string): Promise<ApiResponse<BillFile[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${billId}/files`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取文件列表失败:', error)
    throw error
  }
}

// 上传文件
export async function uploadBillFile(billId: string, file: File): Promise<ApiResponse<BillFile>> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch(`${API_BASE_URL}/api/bills/${billId}/files`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('上传文件失败:', error)
    throw error
  }
}

// 下载文件
export async function downloadBillFile(billId: string, fileId: string | number, fileName: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${billId}/files/${fileId}/download`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载文件失败:', error)
    throw error
  }
}

// 删除文件
export async function deleteBillFile(billId: string, fileId: string | number): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${billId}/files/${fileId}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除文件失败:', error)
    throw error
  }
}

// 获取提单操作日志
export async function getBillOperationLogs(id: string): Promise<ApiResponse<OperationLog[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/logs`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取操作日志失败:', error)
    throw error
  }
}

/**
 * 创建提单
 * @param data 提单数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/bills
 */
export async function createBill(data: BillOfLadingInput): Promise<ApiResponse<BillOfLading>> {
  // 测试模式：阻止写操作
  if (checkTestMode()) {
    showTestModeWarning('创建提单')
    return createWriteBlockedResponse() as any
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建提单失败:', error)
    throw error
  }
}

/**
 * 更新提单
 * @param id 提单ID
 * @param data 更新数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/bills/:id
 */
export async function updateBill(id: string, data: BillOfLadingInput): Promise<ApiResponse<BillOfLading>> {
  // 测试模式：阻止写操作
  if (checkTestMode()) {
    showTestModeWarning('更新提单')
    return createWriteBlockedResponse() as any
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新提单失败:', error)
    throw error
  }
}

/**
 * 删除提单
 * @param id 提单ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/bills/:id
 */
export async function deleteBill(id: string): Promise<ApiResponse<void>> {
  // 测试模式：阻止写操作
  if (checkTestMode()) {
    showTestModeWarning('删除提单')
    return createWriteBlockedResponse() as any
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除提单失败:', error)
    throw error
  }
}

/**
 * 作废提单
 * @param id 提单ID
 * @param voidReason 作废原因
 * @returns 作废后的提单
 * 
 * 接口地址: PUT /api/bills/:id/void
 */
export async function voidBill(id: string, reason?: string): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/void`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('作废提单失败:', error)
    throw error
  }
}

/**
 * 恢复作废的提单
 * @param id 提单ID
 * @returns 恢复后的提单
 * 
 * 接口地址: PUT /api/bills/:id/restore
 */
export async function restoreBill(id: string): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/restore`, {
      method: 'PUT',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('恢复提单失败:', error)
    throw error
  }
}

// 更新船状态
export async function updateBillShipStatus(
  id: string, 
  shipStatus: '未到港' | '已到港' | '跳港',
  actualArrivalDateOrSkipPort?: string,
  skipPortNote?: string
): Promise<ApiResponse<BillOfLading>> {
  try {
    // 根据状态类型决定参数含义
    const body: Record<string, string | undefined> = { shipStatus }
    if (shipStatus === '已到港' && actualArrivalDateOrSkipPort) {
      body.actualArrivalDate = actualArrivalDateOrSkipPort
    } else if (shipStatus === '跳港' && actualArrivalDateOrSkipPort) {
      body.skipPort = actualArrivalDateOrSkipPort
      body.skipPortNote = skipPortNote
    }
    
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/ship-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新船状态失败:', error)
    throw error
  }
}

// 更新换单状态
export async function updateBillDocSwapStatus(
  id: string, 
  docSwapStatus: '未换单' | '已换单',
  docSwapAgent?: string,
  docSwapFee?: number
): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/doc-swap-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docSwapStatus, docSwapAgent, docSwapFee }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新换单状态失败:', error)
    throw error
  }
}

// 更新清关状态
export async function updateBillCustomsStatus(
  id: string, 
  customsStatus: '未放行' | '已放行',
  customsReleaseTime?: string  // ISO 格式的时间字符串
): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/customs-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customsStatus, customsReleaseTime }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新清关状态失败:', error)
    throw error
  }
}

/**
 * 发布草稿为正式订单
 * @param id 草稿ID
 * @param newStatus 新状态，默认为'船未到港'
 * @returns 发布后的提单
 * 
 * 接口地址: PUT /api/bills/:id/publish
 */
export async function publishDraft(id: string, newStatus?: string): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/publish`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newStatus }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('发布草稿失败:', error)
    throw error
  }
}

// ==================== 序号管理接口 ====================

export type BusinessType = 'package' | 'bill' | 'declaration' | 'label' | 'last_mile'

export interface SequenceStats {
  businessType: BusinessType
  currentSeq: number
  prefix: string
  description: string
  updatedAt: string
  stats: {
    total: number
    valid: number
    void: number
  }
}

export interface SequenceInfo {
  businessType: BusinessType
  currentSeq: number
  prefix: string
  description: string
  nextSeq: number
  nextFormatted: string
}

/**
 * 获取所有业务类型的序号统计
 */
export async function getSequencesStats(): Promise<ApiResponse<SequenceStats[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sequences/stats`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取序号统计失败:', error)
    throw error
  }
}

/**
 * 获取指定业务类型的序号信息
 */
export async function getSequenceInfo(businessType: BusinessType): Promise<ApiResponse<SequenceInfo>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sequences/${businessType}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取序号信息失败:', error)
    throw error
  }
}

// ==================== 查验相关接口 ====================

export interface GetInspectionsParams {
  type?: 'pending' | 'released'  // pending = 待查验/查验中, released = 已放行
  status?: string
  search?: string
}

/**
 * 获取查验列表
 * @param params 查询参数
 * @returns 查验列表
 * 
 * 接口地址: GET /api/inspections
 */
export async function getInspectionsList(params?: GetInspectionsParams): Promise<ApiResponse<PaginatedResponse<BillOfLading>>> {
  try {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }
    
    const url = searchParams.toString() 
      ? `${API_BASE_URL}/api/inspections?${searchParams.toString()}`
      : `${API_BASE_URL}/api/inspections`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取查验列表失败:', error)
    throw error
  }
}

// 查验货物项
export interface InspectionItem {
  id: string
  hsCode: string
  productName: string
  quantity?: number
  unit?: string
}

// 查验详情
export interface InspectionDetailData {
  items: InspectionItem[]
  estimatedTime?: string
  actualStartTime?: string
  actualEndTime?: string
  result?: 'pass' | 'second_inspection' | 'fail'
  resultNote?: string
  releaseTime?: string
  confirmedTime?: string
}

/**
 * 更新提单的查验状态（支持完整查验流程）
 * @param id 提单ID
 * @param inspection 查验状态
 * @param detail 查验详情
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/bills/:id/inspection
 */
export async function updateBillInspection(
  id: string, 
  inspection: string,
  detail?: InspectionDetailData,
  inspectionNote?: string
): Promise<ApiResponse<BillOfLading>> {
  try {
    const body: Record<string, unknown> = { inspection }
    
    if (detail) {
      if (detail.items) body.inspectionDetail = detail.items
      if (detail.estimatedTime) body.estimatedTime = detail.estimatedTime
      if (detail.actualStartTime) body.startTime = detail.actualStartTime
      if (detail.actualEndTime) body.endTime = detail.actualEndTime
      if (detail.result) body.result = detail.result
      if (detail.resultNote) body.resultNote = detail.resultNote
      if (detail.releaseTime) body.releaseTime = detail.releaseTime
      if (detail.confirmedTime) body.confirmedTime = detail.confirmedTime
    }
    
    if (inspectionNote) body.inspectionNote = inspectionNote
    
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/inspection`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新查验状态失败:', error)
    throw error
  }
}

// 更新派送状态
export async function updateBillDeliveryStatus(
  id: string, 
  deliveryStatus: string,
  deliveryNote?: string
): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/delivery`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        deliveryStatus,
        deliveryNote,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新派送状态失败:', error)
    throw error
  }
}

// ==================== CMR 管理相关接口 ====================

export interface GetCMRParams {
  type?: 'undelivered' | 'delivering' | 'archived' | 'exception' | 'all'
  search?: string
}

export interface CMRStats {
  undelivered: number
  delivering: number
  archived: number
}

export interface CMRResponse {
  list: BillOfLading[]
  total: number
  stats: CMRStats
}

/**
 * 获取 CMR 列表
 * @param params 查询参数
 * @returns CMR 列表
 * 
 * 接口地址: GET /api/cmr
 */
export async function getCMRList(params?: GetCMRParams): Promise<ApiResponse<CMRResponse>> {
  try {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }
    
    const url = searchParams.toString() 
      ? `${API_BASE_URL}/api/cmr?${searchParams.toString()}`
      : `${API_BASE_URL}/api/cmr`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取 CMR 列表失败:', error)
    throw error
  }
}

// CMR详情数据接口
export interface CMRDetailData {
  estimatedPickupTime?: string
  serviceProvider?: string
  pickupNote?: string
  deliveryAddress?: string
  estimatedArrivalTime?: string
  arrivalNote?: string
  actualArrivalTime?: string
  deliveryNote?: string
  unloadingCompleteTime?: string
  unloadingNote?: string
  confirmedTime?: string
  confirmNote?: string
  hasException?: boolean
  exceptionNote?: string
  exceptionTime?: string
  exceptionStatus?: 'open' | 'following' | 'resolved' | 'closed'
  exceptionRecords?: Array<{
    id: string
    note: string
    time: string
    action: string
    actionLabel: string
  }>
}

/**
 * 更新提单的派送状态
 * @param id 提单ID
 * @param deliveryStatus 派送状态
 * @param deliveryNote 备注
 * @param cmrDetail CMR详情数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/bills/:id/delivery
 */
export async function updateBillDelivery(
  id: string, 
  deliveryStatus: string,
  deliveryNote?: string,
  cmrDetail?: CMRDetailData
): Promise<ApiResponse<BillOfLading>> {
  try {
    const body: Record<string, any> = { 
      deliveryStatus,
      deliveryNote,
    }
    
    // 添加CMR详细字段
    if (cmrDetail) {
      body.cmrEstimatedPickupTime = cmrDetail.estimatedPickupTime
      body.cmrServiceProvider = cmrDetail.serviceProvider
      body.cmrDeliveryAddress = cmrDetail.deliveryAddress
      body.cmrEstimatedArrivalTime = cmrDetail.estimatedArrivalTime
      body.cmrActualArrivalTime = cmrDetail.actualArrivalTime
      body.cmrUnloadingCompleteTime = cmrDetail.unloadingCompleteTime
      body.cmrConfirmedTime = cmrDetail.confirmedTime
      body.cmrHasException = cmrDetail.hasException
      body.cmrExceptionNote = cmrDetail.exceptionNote
      body.cmrExceptionTime = cmrDetail.exceptionTime
      body.cmrExceptionStatus = cmrDetail.exceptionStatus
      body.cmrExceptionRecords = cmrDetail.exceptionRecords
      // 合并所有备注
      body.cmrNotes = JSON.stringify({
        pickupNote: cmrDetail.pickupNote,
        arrivalNote: cmrDetail.arrivalNote,
        deliveryNote: cmrDetail.deliveryNote,
        unloadingNote: cmrDetail.unloadingNote,
        confirmNote: cmrDetail.confirmNote,
      })
    }
    
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/delivery`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新派送状态失败:', error)
    throw error
  }
}

/**
 * 标记提单为已完成
 * @param id 提单ID
 * @param completeNote 完成备注（可选）
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/bills/:id/complete
 */
export async function markBillComplete(
  id: string, 
  completeNote?: string
): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completeNote }),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('标记完成失败:', error)
    throw error
  }
}

// ==================== 海运公司相关接口 ====================

export interface ShippingCompany {
  id: string
  companyName: string
  companyCode: string
  country: string
  website: string
  createTime?: string
  updateTime?: string
}

export interface CreateShippingCompanyRequest {
  companyName: string
  companyCode: string
  country?: string
  website?: string
}

export interface UpdateShippingCompanyRequest extends CreateShippingCompanyRequest {}

export interface ContainerCode {
  containerCode: string
  description: string
  companyName?: string
  companyCode?: string
}

/**
 * 获取所有海运公司列表
 * @param search 搜索关键词
 * @returns 海运公司列表
 * 
 * 接口地址: GET /api/shipping-companies
 */
export async function getShippingCompanies(search?: string): Promise<ApiResponse<ShippingCompany[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (search) queryParams.append('search', search)

    const url = `${API_BASE_URL}/api/shipping-companies${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取海运公司列表失败:', error)
    throw error
  }
}

/**
 * 获取海运公司详情
 * @param id 海运公司ID
 * @returns 海运公司详情
 * 
 * 接口地址: GET /api/shipping-companies/:id
 */
export async function getShippingCompanyById(id: string): Promise<ApiResponse<ShippingCompany>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shipping-companies/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取海运公司详情失败:', error)
    throw error
  }
}

/**
 * 创建海运公司
 * @param data 海运公司数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/shipping-companies
 */
export async function createShippingCompany(data: CreateShippingCompanyRequest): Promise<ApiResponse<ShippingCompany>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shipping-companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建海运公司失败:', error)
    throw error
  }
}

/**
 * 更新海运公司
 * @param id 海运公司ID
 * @param data 海运公司数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/shipping-companies/:id
 */
export async function updateShippingCompany(id: string, data: UpdateShippingCompanyRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shipping-companies/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新海运公司失败:', error)
    throw error
  }
}

/**
 * 删除海运公司
 * @param id 海运公司ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/shipping-companies/:id
 */
export async function deleteShippingCompany(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shipping-companies/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除海运公司失败:', error)
    throw error
  }
}

/**
 * 根据集装箱代码获取海运公司信息
 * @param containerCode 集装箱代码（如 COSU）
 * @returns 海运公司信息
 * 
 * 接口地址: GET /api/shipping-companies/by-container-code/:code
 */
export async function getShippingCompanyByContainerCode(containerCode: string): Promise<ApiResponse<{
  companyName: string
  companyCode: string
  containerCode: string
  country: string
  website: string
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shipping-companies/by-container-code/${containerCode}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('根据集装箱代码获取海运公司失败:', error)
    throw error
  }
}

/**
 * 获取指定海运公司的所有集装箱代码
 * @param companyCode 海运公司代码（如 COSCO）
 * @returns 集装箱代码列表
 * 
 * 接口地址: GET /api/shipping-companies/:companyCode/container-codes
 */
export async function getContainerCodesByCompany(companyCode: string): Promise<ApiResponse<ContainerCode[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shipping-companies/${companyCode}/container-codes`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取集装箱代码列表失败:', error)
    throw error
  }
}

/**
 * 搜索集装箱代码
 * @param query 搜索关键词
 * @returns 匹配的集装箱代码列表
 * 
 * 接口地址: GET /api/container-codes
 */
export async function searchContainerCodes(query: string): Promise<ApiResponse<ContainerCode[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/container-codes`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    
    // 转换数据格式
    if (result.errCode === 200 && result.data) {
      result.data = result.data.map((item: any) => ({
        containerCode: item.containerCode || item.container_code || '',
        companyName: item.shippingCompanyName || item.shipping_company_name || item.companyName || '',
        companyCode: item.companyCode || '',
        description: item.description || '',
      }))
      
      // 如果有搜索关键词，进行前端过滤
      if (query) {
        const search = query.toLowerCase()
        result.data = result.data.filter((item: any) => 
          (item.containerCode || '').toLowerCase().includes(search) ||
          (item.companyName || '').toLowerCase().includes(search) ||
          (item.companyCode || '').toLowerCase().includes(search)
        )
      }
    }
    
    return result
  } catch (error) {
    console.error('搜索集装箱代码失败:', error)
    throw error
  }
}

// ==================== 基础数据管理 API ====================

export interface BasicDataItem {
  id: string
  name: string
  code: string
  category: string
  description?: string
  status: 'active' | 'inactive'
  createTime: string
  updateTime?: string
}

export interface CreateBasicDataRequest {
  name: string
  code: string
  category: string
  description?: string
  status?: 'active' | 'inactive'
}

export interface UpdateBasicDataRequest {
  name: string
  code: string
  category: string
  description?: string
  status?: 'active' | 'inactive'
}

/**
 * 获取基础数据列表
 * @param params 查询参数
 * @returns 基础数据列表
 * 
 * 接口地址: GET /api/basic-data
 */
export async function getBasicDataList(params?: {
  category?: string
  status?: string
  search?: string
}): Promise<ApiResponse<BasicDataItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (params?.category) queryParams.append('category', params.category)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.search) queryParams.append('search', params.search)

    const url = `${API_BASE_URL}/api/basic-data${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取基础数据列表失败:', error)
    throw error
  }
}

/**
 * 获取基础数据详情
 * @param id 基础数据ID
 * @returns 基础数据详情
 * 
 * 接口地址: GET /api/basic-data/:id
 */
export async function getBasicDataById(id: string): Promise<ApiResponse<BasicDataItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/basic-data/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取基础数据详情失败:', error)
    throw error
  }
}

/**
 * 创建基础数据
 * @param data 基础数据信息
 * @returns 创建结果
 * 
 * 接口地址: POST /api/basic-data
 */
export async function createBasicData(data: CreateBasicDataRequest): Promise<ApiResponse<BasicDataItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/basic-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建基础数据失败:', error)
    throw error
  }
}

/**
 * 更新基础数据
 * @param id 基础数据ID
 * @param data 基础数据信息
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/basic-data/:id
 */
export async function updateBasicData(id: string, data: UpdateBasicDataRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/basic-data/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新基础数据失败:', error)
    throw error
  }
}

/**
 * 删除基础数据
 * @param id 基础数据ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/basic-data/:id
 */
export async function deleteBasicData(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/basic-data/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除基础数据失败:', error)
    throw error
  }
}

/**
 * 获取基础数据分类列表
 * @returns 分类列表
 * 
 * 接口地址: GET /api/basic-data/categories
 */
export async function getBasicDataCategories(): Promise<ApiResponse<string[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/basic-data/categories`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取分类列表失败:', error)
    throw error
  }
}

// ==================== 集装箱代码管理 API ====================

export interface ContainerCodeItem {
  id: string
  containerCode: string
  description: string
  companyName: string
  companyCode: string
  shippingCompanyId: string
  createTime: string
  updateTime?: string
}

export interface CreateContainerCodeRequest {
  containerCode: string
  description?: string
  shippingCompanyId: string
}

export interface UpdateContainerCodeRequest {
  containerCode: string
  description?: string
  shippingCompanyId: string
}

/**
 * 获取集装箱代码列表（用于管理）
 * @param params 查询参数
 * @returns 集装箱代码列表
 * 
 * 接口地址: GET /api/container-codes
 */
export async function getContainerCodesList(params?: {
  companyCode?: string
  search?: string
}): Promise<ApiResponse<ContainerCodeItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (params?.companyCode) queryParams.append('companyCode', params.companyCode)
    if (params?.search) queryParams.append('search', params.search)

    const url = `${API_BASE_URL}/api/container-codes${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取集装箱代码列表失败:', error)
    throw error
  }
}

/**
 * 获取集装箱代码详情
 * @param id 集装箱代码ID
 * @returns 集装箱代码详情
 * 
 * 接口地址: GET /api/container-codes/:id
 */
export async function getContainerCodeById(id: string): Promise<ApiResponse<ContainerCodeItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/container-codes/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取集装箱代码详情失败:', error)
    throw error
  }
}

/**
 * 创建集装箱代码
 * @param data 集装箱代码信息
 * @returns 创建结果
 * 
 * 接口地址: POST /api/container-codes
 */
export async function createContainerCode(data: CreateContainerCodeRequest): Promise<ApiResponse<ContainerCodeItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/container-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建集装箱代码失败:', error)
    throw error
  }
}

/**
 * 更新集装箱代码
 * @param id 集装箱代码ID
 * @param data 集装箱代码信息
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/container-codes/:id
 */
export async function updateContainerCode(id: string, data: UpdateContainerCodeRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/container-codes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新集装箱代码失败:', error)
    throw error
  }
}

/**
 * 删除集装箱代码
 * @param id 集装箱代码ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/container-codes/:id
 */
export async function deleteContainerCode(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/container-codes/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除集装箱代码失败:', error)
    throw error
  }
}

// ==================== 起运港管理 API ====================

export interface PortOfLoadingItem {
  id: string
  portCode: string
  portNameCn: string
  portNameEn: string
  country: string
  countryCode: string
  city: string
  description: string
  transportType?: 'air' | 'sea' | 'rail' | 'truck'
  portType?: 'main' | 'terminal'
  parentPortCode?: string
  status: 'active' | 'inactive'
  createTime: string
  updateTime: string
}

export interface CreatePortRequest {
  portCode: string
  portNameCn: string
  portNameEn?: string
  country?: string
  countryCode?: string
  city?: string
  description?: string
  transportType?: 'air' | 'sea' | 'rail' | 'truck'
  portType?: 'main' | 'terminal'
  parentPortCode?: string
  status?: 'active' | 'inactive'
}

export interface UpdatePortRequest extends CreatePortRequest {}

export interface GetPortsListParams {
  country?: string
  status?: 'active' | 'inactive'
  search?: string
  transportType?: 'air' | 'sea' | 'rail' | 'truck'
  continent?: string
}

/**
 * 获取起运港列表
 * @param params 查询参数
 * @returns 起运港列表
 * 
 * 接口地址: GET /api/ports-of-loading
 */
export async function getPortsOfLoadingList(params?: GetPortsListParams): Promise<ApiResponse<PortOfLoadingItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (params?.country) queryParams.append('country', params.country)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.search) queryParams.append('search', params.search)
    if (params?.transportType) queryParams.append('transportType', params.transportType)
    if (params?.continent) queryParams.append('continent', params.continent)

    const url = `${API_BASE_URL}/api/ports-of-loading${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取起运港列表失败:', error)
    throw error
  }
}

/**
 * 获取起运港详情
 * @param id 起运港ID
 * @returns 起运港详情
 * 
 * 接口地址: GET /api/ports-of-loading/:id
 */
export async function getPortOfLoadingById(id: string): Promise<ApiResponse<PortOfLoadingItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ports-of-loading/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取起运港详情失败:', error)
    throw error
  }
}

/**
 * 获取主港口列表（用于码头选择父港口）
 * @param transportType 运输类型
 * @returns 主港口列表
 * 
 * 接口地址: GET /api/ports-of-loading/main-ports
 */
export async function getMainPortsOfLoadingList(transportType?: 'air' | 'sea' | 'rail' | 'truck'): Promise<ApiResponse<PortOfLoadingItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (transportType) queryParams.append('transportType', transportType)

    const url = `${API_BASE_URL}/api/ports-of-loading/main-ports${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取主港口列表失败:', error)
    throw error
  }
}

/**
 * 创建起运港
 * @param data 起运港数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/ports-of-loading
 */
export async function createPortOfLoading(data: CreatePortRequest): Promise<ApiResponse<PortOfLoadingItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ports-of-loading`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建起运港失败:', error)
    throw error
  }
}

/**
 * 更新起运港
 * @param id 起运港ID
 * @param data 起运港数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/ports-of-loading/:id
 */
export async function updatePortOfLoading(id: string, data: UpdatePortRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ports-of-loading/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新起运港失败:', error)
    throw error
  }
}

/**
 * 删除起运港
 * @param id 起运港ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/ports-of-loading/:id
 */
export async function deletePortOfLoading(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ports-of-loading/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除起运港失败:', error)
    throw error
  }
}

/**
 * 清空所有起运港数据
 * @returns 清空结果
 * 
 * 接口地址: DELETE /api/ports-of-loading
 */
export async function clearAllPortsOfLoading(): Promise<ApiResponse<{ deletedCount: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ports-of-loading`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('清空起运港数据失败:', error)
    throw error
  }
}

/**
 * 获取起运港国家列表
 * @returns 国家列表
 * 
 * 接口地址: GET /api/ports-of-loading/countries
 */
export async function getPortCountries(): Promise<ApiResponse<Array<{ country: string; countryCode: string }>>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ports-of-loading/countries`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取国家列表失败:', error)
    throw error
  }
}

// ==================== 目的港管理 API ====================

export interface DestinationPortItem {
  id: string
  portCode: string
  portNameCn: string
  portNameEn: string
  country: string
  countryCode: string
  city: string
  transportType: 'air' | 'sea' | 'rail' | 'truck'
  continent: string
  description: string
  status: 'active' | 'inactive'
  createTime: string
  updateTime: string
}

export interface CreateDestinationPortRequest {
  portCode: string
  portNameCn: string
  portNameEn?: string
  country?: string
  countryCode?: string
  city?: string
  transportType?: 'air' | 'sea' | 'rail' | 'truck'
  continent?: string
  description?: string
  status?: 'active' | 'inactive'
}

export interface UpdateDestinationPortRequest extends CreateDestinationPortRequest {}

export interface GetDestinationPortsListParams {
  country?: string
  status?: 'active' | 'inactive'
  search?: string
  transportType?: 'air' | 'sea' | 'rail' | 'truck'
  continent?: string
}

/**
 * 获取目的港列表
 * @param params 查询参数
 * @returns 目的港列表
 * 
 * 接口地址: GET /api/destination-ports
 */
export async function getDestinationPortsList(params?: GetDestinationPortsListParams): Promise<ApiResponse<DestinationPortItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (params?.country) queryParams.append('country', params.country)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.search) queryParams.append('search', params.search)
    if (params?.transportType) queryParams.append('transportType', params.transportType)
    if (params?.continent) queryParams.append('continent', params.continent)

    const url = `${API_BASE_URL}/api/destination-ports${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取目的地列表失败:', error)
    throw error
  }
}

/**
 * 获取目的港详情
 * @param id 目的港ID
 * @returns 目的港详情
 * 
 * 接口地址: GET /api/destination-ports/:id
 */
export async function getDestinationPortById(id: string): Promise<ApiResponse<DestinationPortItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/destination-ports/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取目的港详情失败:', error)
    throw error
  }
}

/**
 * 创建目的港
 * @param data 目的港数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/destination-ports
 */
export async function createDestinationPort(data: CreateDestinationPortRequest): Promise<ApiResponse<DestinationPortItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/destination-ports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建目的港失败:', error)
    throw error
  }
}

/**
 * 更新目的港
 * @param id 目的港ID
 * @param data 目的港数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/destination-ports/:id
 */
export async function updateDestinationPort(id: string, data: UpdateDestinationPortRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/destination-ports/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新目的港失败:', error)
    throw error
  }
}

/**
 * 删除目的港
 * @param id 目的港ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/destination-ports/:id
 */
export async function deleteDestinationPort(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/destination-ports/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除目的港失败:', error)
    throw error
  }
}

/**
 * 获取目的港国家列表
 * @returns 国家列表
 * 
 * 接口地址: GET /api/destination-ports/countries
 */
export async function getDestinationPortCountries(): Promise<ApiResponse<Array<{ country: string; countryCode: string }>>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/destination-ports/countries`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取国家列表失败:', error)
    throw error
  }
}

// ==================== 国家管理 API ====================

export interface CountryItem {
  id: string
  countryCode: string
  countryNameCn: string
  countryNameEn: string
  continent: string
  region: string
  capital: string
  currencyCode: string
  currencyName: string
  phoneCode: string
  timezone: string
  description: string
  status: 'active' | 'inactive'
  createTime: string
  updateTime: string
}

export interface CreateCountryRequest {
  countryCode: string
  countryNameCn: string
  countryNameEn: string
  continent?: string
  region?: string
  capital?: string
  currencyCode?: string
  currencyName?: string
  phoneCode?: string
  timezone?: string
  description?: string
  status?: 'active' | 'inactive'
}

export interface UpdateCountryRequest extends CreateCountryRequest {}

export interface GetCountriesListParams {
  continent?: string
  status?: 'active' | 'inactive'
  search?: string
}

/**
 * 获取国家列表
 * @param params 查询参数
 * @returns 国家列表
 * 
 * 接口地址: GET /api/countries
 */
export async function getCountriesList(params?: GetCountriesListParams): Promise<ApiResponse<CountryItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (params?.continent) queryParams.append('continent', params.continent)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.search) queryParams.append('search', params.search)

    const url = `${API_BASE_URL}/api/countries${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取国家列表失败:', error)
    throw error
  }
}

// ==================== 城市 API 接口 ====================

export interface CityItem {
  id: number
  countryCode: string
  cityCode?: string
  cityNameCn: string
  cityNameEn?: string
  parentId: number
  level: number // 1=省/州, 2=市, 3=区/县, 4=镇/乡
  postalCode?: string
  latitude?: number
  longitude?: number
  status: string
}

/**
 * 根据国家代码获取城市列表
 * @param countryCode 国家代码
 * @param search 搜索关键词
 * @returns 城市列表
 */
export async function getCitiesByCountry(countryCode: string, search?: string): Promise<ApiResponse<CityItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (search) queryParams.append('search', search)
    
    const url = `${API_BASE_URL}/api/cities/country/${countryCode}${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取城市列表失败:', error)
    throw error
  }
}

/**
 * 获取国家详情
 * @param id 国家ID
 * @returns 国家详情
 * 
 * 接口地址: GET /api/countries/:id
 */
export async function getCountryById(id: string): Promise<ApiResponse<CountryItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/countries/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取国家详情失败:', error)
    throw error
  }
}

/**
 * 创建国家
 * @param data 国家数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/countries
 */
export async function createCountry(data: CreateCountryRequest): Promise<ApiResponse<CountryItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/countries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建国家失败:', error)
    throw error
  }
}

/**
 * 更新国家
 * @param id 国家ID
 * @param data 国家数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/countries/:id
 */
export async function updateCountry(id: string, data: UpdateCountryRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/countries/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新国家失败:', error)
    throw error
  }
}

/**
 * 删除国家
 * @param id 国家ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/countries/:id
 */
export async function deleteCountry(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/countries/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除国家失败:', error)
    throw error
  }
}

/**
 * 获取国家大洲列表
 * @returns 大洲列表
 * 
 * 接口地址: GET /api/countries/continents
 */
export async function getCountryContinents(): Promise<ApiResponse<string[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/countries/continents`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取大洲列表失败:', error)
    throw error
  }
}

// ==================== 空运港相关接口 ====================

export interface AirPortItem {
  id: string
  portCode: string
  portNameCn: string
  portNameEn: string
  country: string
  countryCode: string
  city: string
  description: string
  status: 'active' | 'inactive'
  createTime?: string
  updateTime?: string
}

export interface GetAirPortsListParams {
  search?: string
  country?: string
  continent?: string
}

export interface CreateAirPortRequest {
  portCode: string
  portNameCn: string
  portNameEn?: string
  country?: string
  countryCode?: string
  city?: string
  description?: string
  status?: 'active' | 'inactive'
}

export interface UpdateAirPortRequest extends CreateAirPortRequest {}

/**
 * 获取空运港列表
 * @param params 查询参数
 * @returns 空运港列表
 * 
 * 接口地址: GET /api/air-ports
 */
export async function getAirPortsList(params?: GetAirPortsListParams): Promise<ApiResponse<AirPortItem[]>> {
  try {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.country) queryParams.append('country', params.country)
    if (params?.continent) queryParams.append('continent', params.continent)

    const url = `${API_BASE_URL}/api/air-ports${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取空运港列表失败:', error)
    throw error
  }
}

/**
 * 获取空运港详情
 * @param id 空运港ID
 * @returns 空运港详情
 * 
 * 接口地址: GET /api/air-ports/:id
 */
export async function getAirPortById(id: string): Promise<ApiResponse<AirPortItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/air-ports/${id}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取空运港详情失败:', error)
    throw error
  }
}

/**
 * 创建空运港
 * @param data 空运港数据
 * @returns 创建结果
 * 
 * 接口地址: POST /api/air-ports
 */
export async function createAirPort(data: CreateAirPortRequest): Promise<ApiResponse<AirPortItem>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/air-ports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('创建空运港失败:', error)
    throw error
  }
}

/**
 * 更新空运港
 * @param id 空运港ID
 * @param data 空运港数据
 * @returns 更新结果
 * 
 * 接口地址: PUT /api/air-ports/:id
 */
export async function updateAirPort(id: string, data: UpdateAirPortRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/air-ports/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('更新空运港失败:', error)
    throw error
  }
}

/**
 * 删除空运港
 * @param id 空运港ID
 * @returns 删除结果
 * 
 * 接口地址: DELETE /api/air-ports/:id
 */
export async function deleteAirPort(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/air-ports/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('删除空运港失败:', error)
    throw error
  }
}

/**
 * 获取空运港国家列表
 * @returns 国家列表
 * 
 * 接口地址: GET /api/air-ports/countries
 */
export async function getAirPortCountries(): Promise<ApiResponse<Array<{ country: string; countryCode: string }>>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/air-ports/countries`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('获取空运港国家列表失败:', error)
    throw error
  }
}

// ==================== 提单文件解析 API ====================

export interface ParsedBillData {
  masterBillNumber?: string
  shippingCompany?: string
  origin?: string
  destination?: string
  containerNumber?: string
  vessel?: string
  pieces?: string
  weight?: string
  volume?: string
  estimatedDeparture?: string
  estimatedArrival?: string
  sealNumber?: string
  containerSize?: string
  shipper?: string
}

/**
 * 解析提单文件（提取信息）
 * @param file 提单文件
 * @returns 解析后的数据
 * 
 * 接口地址: POST /api/bills/parse-file
 */
export async function parseBillFile(file: File): Promise<ApiResponse<ParsedBillData>> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/bills/parse-file`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('解析提单文件失败:', error)
    throw error
  }
}

// ==================== OCR 运输单识别 API 接口 ====================

/**
 * OCR解析后的运输单数据
 */
export interface ParsedTransportData {
  transportType: 'sea' | 'air' | 'rail' | 'truck'
  billNumber?: string | null
  containerNumber?: string | null
  vessel?: string | null
  flightNumber?: string | null
  trainNumber?: string | null
  vehicleNumber?: string | null
  portOfLoading?: string | null
  portOfDischarge?: string | null
  pieces?: number | null
  grossWeight?: number | null
  volume?: number | null
  volumeWeight?: number | null
  shipper?: string | null
  consignee?: string | null
  carrier?: string | null
  airline?: string | null
  shippingCompany?: string | null
  eta?: string | null
  // 新增字段 - 基于COSCO等提单格式
  etd?: string | null           // 预计离开时间 (Date Laden on Board)
  sealNumber?: string | null    // 封签号
  containerSize?: string | null // 柜型 (20GP/40GP/40HQ等)
  _ocrText?: string
  _fileName?: string
  _fileType?: string
  error?: string
}

/**
 * 检查OCR服务配置状态
 * @returns OCR配置状态
 * 
 * 接口地址: GET /api/ocr/status
 */
export async function checkOcrStatus(): Promise<ApiResponse<{ configured: boolean; message: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ocr/status`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('检查OCR状态失败:', error)
    throw error
  }
}

/**
 * OCR解析运输单文件
 * @param file 运输单文件（PDF/图片/Excel）
 * @param transportType 运输方式 (sea/air/rail/truck)
 * @returns 解析后的运输单数据
 * 
 * 接口地址: POST /api/ocr/parse-transport
 */
export async function parseTransportDocument(
  file: File, 
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
): Promise<ApiResponse<ParsedTransportData>> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (transportType) {
      formData.append('transportType', transportType)
    }

    const response = await fetch(`${API_BASE_URL}/api/ocr/parse-transport`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('OCR解析运输单失败:', error)
    throw error
  }
}

/**
 * 批量OCR解析运输单（Excel文件）
 * @param file Excel文件
 * @param transportType 运输方式
 * @returns 批量解析结果
 * 
 * 接口地址: POST /api/ocr/batch-parse
 */
export async function batchParseTransportDocuments(
  file: File,
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
): Promise<ApiResponse<{ total: number; items: ParsedTransportData[] }>> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (transportType) {
      formData.append('transportType', transportType)
    }

    const response = await fetch(`${API_BASE_URL}/api/ocr/batch-parse`, {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('批量OCR解析失败:', error)
    throw error
  }
}

// ==================== 运输方式 API 接口 ====================

export interface TransportMethod {
  id: string
  name: string
  code: string
  description: string
  icon: string
  sortOrder: number
  status: 'active' | 'inactive'
  createTime: string
}

/**
 * 获取运输方式列表
 */
export async function getTransportMethods(params?: { search?: string; status?: string }): Promise<ApiResponse<TransportMethod[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/transport-methods${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取运输方式失败:', error)
    throw error
  }
}

/**
 * 获取启用的运输方式名称列表
 */
export async function getTransportMethodNames(): Promise<ApiResponse<string[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-methods/names`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取运输方式名称失败:', error)
    throw error
  }
}

/**
 * 创建运输方式
 */
export async function createTransportMethod(data: Omit<TransportMethod, 'id' | 'createTime'>): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建运输方式失败:', error)
    throw error
  }
}

/**
 * 更新运输方式
 */
export async function updateTransportMethod(id: string, data: Partial<TransportMethod>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-methods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新运输方式失败:', error)
    throw error
  }
}

/**
 * 删除运输方式
 */
export async function deleteTransportMethod(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-methods/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除运输方式失败:', error)
    throw error
  }
}

// ==================== 增值税率 API 接口 ====================

export interface VatRate {
  id: string
  countryCode: string
  countryName: string
  standardRate: number
  reducedRate: number
  superReducedRate: number
  parkingRate: number
  description: string
  effectiveDate: string
  status: 'active' | 'inactive'
  createTime: string
  updateTime: string
}

export interface CreateVatRateRequest {
  countryCode: string
  countryName: string
  standardRate: number
  reducedRate?: number
  superReducedRate?: number
  parkingRate?: number
  description?: string
  effectiveDate?: string
  status?: 'active' | 'inactive'
}

export interface UpdateVatRateRequest {
  countryCode?: string
  countryName?: string
  standardRate?: number
  reducedRate?: number
  superReducedRate?: number
  parkingRate?: number
  description?: string
  effectiveDate?: string
  status?: 'active' | 'inactive'
}

/**
 * 获取增值税率列表
 */
export async function getVatRates(params?: { search?: string; status?: string }): Promise<ApiResponse<VatRate[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/vat-rates${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取增值税率失败:', error)
    throw error
  }
}

/**
 * 创建增值税率
 */
export async function createVatRate(data: CreateVatRateRequest): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vat-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建增值税率失败:', error)
    throw error
  }
}

/**
 * 更新增值税率
 */
export async function updateVatRate(id: string, data: UpdateVatRateRequest): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vat-rates/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新增值税率失败:', error)
    throw error
  }
}

/**
 * 删除增值税率
 */
export async function deleteVatRate(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vat-rates/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除增值税率失败:', error)
    throw error
  }
}

// ==================== 服务费类别 API 接口 ====================

export interface ServiceFeeCategory {
  id: string
  name: string
  nameEn?: string
  code: string
  description: string
  sortOrder: number
  status: 'active' | 'inactive'
  createTime: string
  parentId?: string | null  // 父级分类ID
  level?: number            // 层级（1=一级，2=二级）
  children?: ServiceFeeCategory[]  // 子分类（树形结构时使用）
}

/**
 * 获取服务费类别列表
 * @param params.tree 是否返回树形结构
 */
export async function getServiceFeeCategories(params?: { search?: string; status?: string; tree?: boolean }): Promise<ApiResponse<ServiceFeeCategory[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.tree) searchParams.append('tree', 'true')
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/service-fee-categories${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取服务费类别失败:', error)
    throw error
  }
}

/**
 * 获取顶级分类列表（用于选择父级）
 */
export async function getTopLevelCategories(status?: string): Promise<ApiResponse<ServiceFeeCategory[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (status) searchParams.append('status', status)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/service-fee-categories/top-level${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取顶级分类失败:', error)
    throw error
  }
}

/**
 * 获取启用的服务费类别名称列表
 */
export async function getServiceFeeCategoryNames(): Promise<ApiResponse<string[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fee-categories/names`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取服务费类别名称失败:', error)
    throw error
  }
}

/**
 * 创建服务费类别
 */
export async function createServiceFeeCategory(data: Omit<ServiceFeeCategory, 'id' | 'createTime' | 'children' | 'level'>): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fee-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建服务费类别失败:', error)
    throw error
  }
}

/**
 * 更新服务费类别
 */
export async function updateServiceFeeCategory(id: string, data: Partial<ServiceFeeCategory>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fee-categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新服务费类别失败:', error)
    throw error
  }
}

/**
 * 删除服务费类别
 */
export async function deleteServiceFeeCategory(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fee-categories/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除服务费类别失败:', error)
    throw error
  }
}

// ==================== 服务费项目 API 接口 ====================

export interface ServiceFeeItem {
  id: string
  name: string
  category: string
  unit: string
  price: number
  currency: string
  description: string
  isActive: boolean
}

/**
 * 获取服务费项目列表
 */
export async function getServiceFees(params?: { search?: string; category?: string }): Promise<ApiResponse<ServiceFeeItem[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.category) searchParams.append('category', params.category)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/service-fees${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取服务费项目失败:', error)
    throw error
  }
}

/**
 * 创建服务费项目
 */
export async function createServiceFee(data: Omit<ServiceFeeItem, 'id'>): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建服务费项目失败:', error)
    throw error
  }
}

/**
 * 更新服务费项目
 */
export async function updateServiceFee(id: string, data: Partial<ServiceFeeItem>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新服务费项目失败:', error)
    throw error
  }
}

/**
 * 删除服务费项目
 */
export async function deleteServiceFee(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/service-fees/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除服务费项目失败:', error)
    throw error
  }
}

// ==================== 运输价格 API 接口 ====================

export interface TransportPriceItem {
  id: string
  name: string
  origin: string
  destination: string
  transportType: string
  distance: number        // 公里数
  pricePerKm: number      // 公里单价
  totalPrice: number      // 运输总价 = 公里数 × 公里单价
  currency: string
  validFrom: string
  validTo: string
  description: string
  isActive: boolean
}

/**
 * 获取运输价格列表
 */
export async function getTransportPrices(params?: { search?: string; origin?: string; destination?: string }): Promise<ApiResponse<TransportPriceItem[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.origin) searchParams.append('origin', params.origin)
    if (params?.destination) searchParams.append('destination', params.destination)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/transport-prices${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取运输价格失败:', error)
    throw error
  }
}

/**
 * 创建运输价格
 */
export async function createTransportPrice(data: Omit<TransportPriceItem, 'id'>): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建运输价格失败:', error)
    throw error
  }
}

/**
 * 更新运输价格
 */
export async function updateTransportPrice(id: string, data: Partial<TransportPriceItem>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-prices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新运输价格失败:', error)
    throw error
  }
}

/**
 * 删除运输价格
 */
export async function deleteTransportPrice(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transport-prices/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除运输价格失败:', error)
    throw error
  }
}

// ==================== TARIC 税率管理 API 接口 ====================

export interface TariffRate {
  id: string
  hsCode: string
  hsCode10?: string
  goodsDescription: string
  goodsDescriptionCn?: string
  originCountry?: string
  originCountryCode?: string
  dutyRate: number
  dutyRateType: 'percentage' | 'specific' | 'mixed'
  vatRate: number
  antiDumpingRate?: number
  countervailingRate?: number
  preferentialRate?: number
  preferentialOrigin?: string
  unitCode?: string
  unitName?: string
  supplementaryUnit?: string
  measureType?: string
  measureCode?: string
  legalBase?: string
  startDate?: string
  endDate?: string
  quotaOrderNumber?: string
  additionalCode?: string
  footnotes?: string
  isActive: boolean
  dataSource?: string
  lastSyncTime?: string
  // 货值申报相关字段
  declarationType?: 'per_unit' | 'per_weight' // 申报方式：按单价/按重量
  minDeclarationValue?: number // 最低申报金额
  material?: string // 货物材质
  usageScenario?: string // 货物使用场景
  createdAt?: string
  updatedAt?: string
}

export interface TariffRateHistory {
  id: number
  tariffRateId: number
  hsCode: string
  oldDutyRate: number
  newDutyRate: number
  oldVatRate: number
  newVatRate: number
  changeType: string
  changeReason: string
  changedBy: string
  changedAt: string
}

export interface TariffRateStats {
  total: number
  active: number
  inactive: number
  bySource: Record<string, number>
}

export interface TariffRateQueryParams {
  search?: string
  hsCode?: string
  origin?: string
  dataSource?: string
  status?: string
  dutyRateMin?: number
  dutyRateMax?: number
  page?: number
  pageSize?: number
}

export interface TariffRateListResponse extends ApiResponse<TariffRate[]> {
  total: number
  page: number
  pageSize: number
}

/**
 * 获取税率列表
 */
export async function getTariffRates(params?: TariffRateQueryParams): Promise<TariffRateListResponse> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.hsCode) searchParams.append('hsCode', params.hsCode)
    if (params?.origin) searchParams.append('origin', params.origin)
    if (params?.dataSource) searchParams.append('dataSource', params.dataSource)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.dutyRateMin !== undefined) searchParams.append('dutyRateMin', String(params.dutyRateMin))
    if (params?.dutyRateMax !== undefined) searchParams.append('dutyRateMax', String(params.dutyRateMax))
    if (params?.page) searchParams.append('page', String(params.page))
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize))

    const queryString = searchParams.toString()
    const url = queryString
      ? `${API_BASE_URL}/api/tariff-rates?${queryString}`
      : `${API_BASE_URL}/api/tariff-rates`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取税率列表失败:', error)
    throw error
  }
}

/**
 * 根据HS编码查询税率
 */
export async function queryTariffRate(hsCode: string, origin?: string): Promise<ApiResponse<TariffRate[]>> {
  try {
    const searchParams = new URLSearchParams({ hsCode })
    if (origin) searchParams.append('origin', origin)

    const response = await fetch(`${API_BASE_URL}/api/tariff-rates/query?${searchParams.toString()}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('查询税率失败:', error)
    throw error
  }
}

/**
 * 创建税率
 */
export async function createTariffRate(data: Omit<TariffRate, 'id'>): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tariff-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建税率失败:', error)
    throw error
  }
}

/**
 * 更新税率
 */
export async function updateTariffRate(id: string, data: Partial<TariffRate>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tariff-rates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新税率失败:', error)
    throw error
  }
}

/**
 * 删除税率
 */
export async function deleteTariffRate(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tariff-rates/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除税率失败:', error)
    throw error
  }
}

/**
 * 批量导入税率
 */
export async function importTariffRates(rates: Partial<TariffRate>[]): Promise<ApiResponse<{
  successCount: number
  failCount: number
  errors: Array<{ hsCode: string; error: string }>
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tariff-rates/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rates }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('批量导入税率失败:', error)
    throw error
  }
}

/**
 * 获取税率变更历史
 */
export async function getTariffRateHistory(id: string): Promise<ApiResponse<TariffRateHistory[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tariff-rates/${id}/history`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取税率历史失败:', error)
    throw error
  }
}

/**
 * 获取税率统计信息
 */
export async function getTariffRateStats(): Promise<ApiResponse<TariffRateStats>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tariff-rates/stats`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取税率统计失败:', error)
    throw error
  }
}

// ==================== TARIC 实时查询 API 接口 ====================

/**
 * TARIC 实时查询结果
 */
export interface TaricRealtimeResult {
  hsCode: string
  hsCode10: string
  originCountryCode: string | null
  goodsDescription?: string
  goodsDescriptionCn?: string
  dutyRate: number | null
  thirdCountryDuty: number | null
  antiDumpingRate: number | null
  countervailingRate: number | null
  hasAntiDumping?: boolean
  hasCountervailing?: boolean
  hasQuota?: boolean
  requiresLicense?: boolean
  requiresSPS?: boolean
  preferentialRates: Array<{
    rate: number
    geographicalArea: string
    conditions?: string
  }>
  measures: Array<{
    type: string
    typeCn?: string
    rate?: number
    geographicalArea?: string
    geographicalAreaCn?: string
    startDate?: string
    endDate?: string
  }>
  totalMeasures?: number
  queryTime: string
  fromCache: boolean
  savedToDb?: string
}

/**
 * TARIC API 健康状态
 */
export interface TaricApiHealth {
  available: boolean
  responseTime?: number
  error?: string
  timestamp: string
  cacheStats: {
    validCount: number
    expiredCount: number
    totalCount: number
  }
}

/**
 * 国家/地区代码
 */
export interface CountryCode {
  code: string
  iso: string
  name: string
  type: 'C' | 'R' // C = Country, R = Region
}

/**
 * 实时查询单个 HS 编码
 * @param hsCode HS 编码（6-10位）
 * @param originCountry 原产国代码（可选，如 CN）
 * @param saveToDb 是否保存到数据库
 */
export async function lookupTaricRealtime(
  hsCode: string,
  originCountry?: string,
  saveToDb?: boolean
): Promise<ApiResponse<TaricRealtimeResult>> {
  try {
    const params = new URLSearchParams()
    if (originCountry) params.append('originCountry', originCountry)
    if (saveToDb) params.append('saveToDb', 'true')
    
    const queryString = params.toString()
    const url = queryString
      ? `${API_BASE_URL}/api/taric/realtime/${hsCode}?${queryString}`
      : `${API_BASE_URL}/api/taric/realtime/${hsCode}`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('TARIC 实时查询失败:', error)
    throw error
  }
}

/**
 * 批量实时查询 HS 编码
 * @param hsCodes HS 编码数组
 * @param originCountry 原产国代码（可选）
 */
export async function batchLookupTaricRealtime(
  hsCodes: string[],
  originCountry?: string
): Promise<ApiResponse<{
  results: Array<{ hsCode: string; data: TaricRealtimeResult }>
  errors: Array<{ hsCode: string; error: string }>
  totalCount: number
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/realtime-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hsCodes, originCountry }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('TARIC 批量查询失败:', error)
    throw error
  }
}

/**
 * 获取 HS 编码的贸易措施详情
 * @param hsCode HS 编码
 * @param originCountry 原产国代码（可选）
 */
export async function getTaricMeasures(
  hsCode: string,
  originCountry?: string
): Promise<ApiResponse<{
  measures: Array<{
    type: string
    rate: number | null
    geographicalArea: string | null
    startDate: string | null
    endDate: string | null
    regulation: string | null
    conditions: string[]
  }>
}>> {
  try {
    const params = originCountry ? `?originCountry=${originCountry}` : ''
    const response = await fetch(`${API_BASE_URL}/api/taric/measures/${hsCode}${params}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取贸易措施失败:', error)
    throw error
  }
}

/**
 * 获取国家/地区代码列表
 */
export async function getTaricCountryCodes(): Promise<ApiResponse<{
  countries: CountryCode[]
  fromCache: boolean
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/countries`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取国家代码失败:', error)
    throw error
  }
}

/**
 * 检查 TARIC API 健康状态
 */
export async function checkTaricApiHealth(): Promise<ApiResponse<TaricApiHealth>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/api-health`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('TARIC API 健康检查失败:', error)
    throw error
  }
}

/**
 * 清除 TARIC API 缓存
 */
export async function clearTaricApiCache(): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/clear-cache`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('清除缓存失败:', error)
    throw error
  }
}

// ==================== UK Trade Tariff API 接口 ====================

/**
 * UK Trade Tariff 查询结果（继承 EU TARIC 结果结构）
 */
export interface UkTaricRealtimeResult extends TaricRealtimeResult {
  dataSource: 'uk_api' | 'uk_xi_api'
  region: 'uk' | 'xi'
  regionName: string
  formattedDescription?: string
  vatRate?: number | null
}

/**
 * UK Trade Tariff API 健康状态
 */
export interface UkTaricApiHealth {
  available: boolean
  uk: {
    available: boolean
    responseTime: number
  }
  xi: {
    available: boolean
    responseTime: number
  }
  timestamp: string
  cacheStats: {
    validCount: number
    expiredCount: number
    totalCount: number
  }
}

/**
 * 数据源类型
 */
export type TaricDataSource = 'eu' | 'uk'

/**
 * UK 地区类型
 */
export type UkRegion = 'uk' | 'xi'

/**
 * 实时查询单个 HS 编码（UK Trade Tariff API）
 * @param hsCode HS 编码（6-10位）
 * @param originCountry 原产国代码（可选，如 CN）
 * @param region UK 地区：'uk' 或 'xi'（北爱尔兰，适用EU规则）
 * @param saveToDb 是否保存到数据库
 */
export async function lookupUkTaricRealtime(
  hsCode: string,
  originCountry?: string,
  region: UkRegion = 'uk',
  saveToDb?: boolean
): Promise<ApiResponse<UkTaricRealtimeResult>> {
  try {
    const params = new URLSearchParams()
    if (originCountry) params.append('originCountry', originCountry)
    params.append('region', region)
    if (saveToDb) params.append('saveToDb', 'true')
    
    const queryString = params.toString()
    const url = `${API_BASE_URL}/api/taric/uk/realtime/${hsCode}?${queryString}`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('UK Trade Tariff 实时查询失败:', error)
    throw error
  }
}

/**
 * 批量实时查询 UK HS 编码
 * @param hsCodes HS 编码数组
 * @param originCountry 原产国代码（可选）
 * @param region UK 地区：'uk' 或 'xi'
 */
export async function batchLookupUkTaricRealtime(
  hsCodes: string[],
  originCountry?: string,
  region: UkRegion = 'uk'
): Promise<ApiResponse<{
  results: Array<{ hsCode: string; data: UkTaricRealtimeResult }>
  errors: Array<{ hsCode: string; error: string }>
  totalCount: number
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/uk/realtime-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hsCodes, originCountry, region }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('UK Trade Tariff 批量查询失败:', error)
    throw error
  }
}

/**
 * 搜索 UK 商品
 * @param query 搜索关键词
 * @param region UK 地区：'uk' 或 'xi'
 */
export async function searchUkCommodities(
  query: string,
  region: UkRegion = 'uk'
): Promise<ApiResponse<{
  results: any[]
  meta: any
  dataSource: string
}>> {
  try {
    const params = new URLSearchParams()
    params.append('q', query)
    params.append('region', region)
    
    const response = await fetch(`${API_BASE_URL}/api/taric/uk/search?${params.toString()}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('UK 商品搜索失败:', error)
    throw error
  }
}

/**
 * 获取 UK 章节列表
 * @param region UK 地区：'uk' 或 'xi'
 */
export async function getUkChapters(region: UkRegion = 'uk'): Promise<ApiResponse<{
  chapters: Array<{
    id: string
    code: string
    description: string
    formattedDescription?: string
  }>
  fromCache: boolean
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/uk/chapters?region=${region}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取 UK 章节列表失败:', error)
    throw error
  }
}

/**
 * 检查 UK Trade Tariff API 健康状态
 */
export async function checkUkTaricApiHealth(): Promise<ApiResponse<UkTaricApiHealth>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/uk/api-health`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('UK Trade Tariff API 健康检查失败:', error)
    throw error
  }
}

/**
 * 清除 UK Trade Tariff API 缓存
 */
export async function clearUkTaricApiCache(): Promise<ApiResponse<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/uk/clear-cache`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('清除 UK API 缓存失败:', error)
    throw error
  }
}

// ==================== 统一 TARIC 查询接口 ====================

/**
 * 统一实时查询结果（支持 EU 和 UK）
 */
export type UnifiedTaricResult = TaricRealtimeResult | UkTaricRealtimeResult

/**
 * 统一实时查询单个 HS 编码（支持 EU 和 UK）
 * @param hsCode HS 编码（6-10位）
 * @param originCountry 原产国代码（可选，如 CN）
 * @param source 数据源：'eu'（欧盟 TARIC）或 'uk'（英国 Trade Tariff）
 * @param region 仅当 source='uk' 时有效：'uk' 或 'xi'（北爱尔兰）
 * @param saveToDb 是否保存到数据库
 */
export async function lookupTaricUnified(
  hsCode: string,
  originCountry?: string,
  source: TaricDataSource = 'eu',
  region: UkRegion = 'uk',
  saveToDb?: boolean
): Promise<ApiResponse<UnifiedTaricResult>> {
  try {
    const params = new URLSearchParams()
    if (originCountry) params.append('originCountry', originCountry)
    params.append('source', source)
    if (source === 'uk') params.append('region', region)
    if (saveToDb) params.append('saveToDb', 'true')
    
    const queryString = params.toString()
    const url = `${API_BASE_URL}/api/taric/unified/${hsCode}?${queryString}`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('统一 TARIC 查询失败:', error)
    throw error
  }
}

/**
 * 检查所有 TARIC API 健康状态
 */
export async function checkAllTaricApiHealth(): Promise<ApiResponse<{
  eu: TaricApiHealth
  uk: UkTaricApiHealth
  timestamp: string
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/all-api-health`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('API 健康检查失败:', error)
    throw error
  }
}

// ==================== HS 编码验证和智能查询 V2 API ====================

/**
 * HS 编码验证结果
 */
export interface HsCodeValidation {
  inputCode: string
  normalizedCode: string
  isValid: boolean
  isDeclarable: boolean
  level: 'chapter' | 'heading' | 'subheading' | 'cn' | 'taric' | null
  hasChildren: boolean
  childCount: number
  declarableCount?: number
  description: string | null
  descriptionCn: string | null
  parentCode: string | null
  parentDescription: string | null
  breadcrumb: Array<{
    code: string
    description: string
    descriptionCn?: string
    level: string
  }>
  similarCodes?: Array<{
    code: string
    description: string
  }>
  error: string | null
  fromCache?: boolean
}

/**
 * HS 编码层级树结果
 */
export interface HsCodeHierarchy {
  code: string
  description: string | null
  descriptionCn: string | null
  level: string | null
  isDeclarable?: boolean
  // Section 信息（类别）
  section?: {
    number: number
    title: string
    titleCn: string | null
  } | null
  breadcrumb: Array<{
    code: string
    description: string
    descriptionCn?: string
    level: string
    indent?: number
  }>
  childGroups: Array<{
    groupCode: string
    groupTitle: string
    groupTitleCn: string | null
    children: Array<{
      code: string
      description: string
      descriptionCn?: string
      declarable: boolean
      vatRate?: number | null
      thirdCountryDuty?: string | null
      supplementaryUnit?: string | null
      antiDumpingRate?: number | null
    }>
  }>
  children?: Array<{
    code: string
    description: string
    descriptionCn?: string
    level: string
    hasChildren: boolean
  }>
  totalChildren: number
  declarableCount: number
  hasMore: boolean
  error?: string
  fromCache?: boolean
}

/**
 * 商品搜索结果
 */
export interface HsCodeSearchResult {
  query: string
  total: number
  chapterStats: Array<{
    chapter: string
    description: string | null
    count: number
  }>
  results: Array<{
    hsCode: string
    description: string
    descriptionCn: string | null
    declarable: boolean
    chapter: string
    keywords: string[]
    dutyRate: number | null
    links: {
      detail: string
    }
  }>
  page: number
  pageSize: number
  hasMore: boolean
  error?: string
  fromCache?: boolean
}

/**
 * 改进的查询结果 V2
 */
export interface TaricLookupV2Result {
  inputCode: string
  normalizedCode: string
  matchStatus: 'exact' | 'parent_node' | 'not_found' | 'partial_match' | 'error'
  exactMatch: TaricRealtimeResult | null
  validation: HsCodeValidation | null
  hierarchy: HsCodeHierarchy | null
  candidates: Array<{
    code: string
    description: string
    matchScore: number
  }>
  suggestion: string
  warning: string | null
  queryTime: string
  savedToDb?: string
  dbError?: string
  fromCache?: boolean
  error?: string
}

/**
 * 验证 HS 编码有效性
 * @param hsCode HS 编码
 */
export async function validateHsCode(hsCode: string): Promise<ApiResponse<HsCodeValidation>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/taric/validate/${hsCode}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('HS 编码验证失败:', error)
    throw error
  }
}

/**
 * 获取 HS 编码层级树
 * @param prefix 编码前缀
 * @param originCountry 原产国代码（可选）
 */
export async function getHsCodeHierarchy(
  prefix: string, 
  originCountry?: string
): Promise<ApiResponse<HsCodeHierarchy>> {
  try {
    const params = originCountry ? `?originCountry=${originCountry}` : ''
    const response = await fetch(`${API_BASE_URL}/api/taric/hierarchy/${prefix}${params}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取 HS 编码层级失败:', error)
    throw error
  }
}

/**
 * 搜索商品描述
 * @param query 搜索关键词
 * @param options 搜索选项
 */
export async function searchHsCodes(
  query: string,
  options?: {
    chapter?: string
    page?: number
    pageSize?: number
    originCountry?: string
  }
): Promise<ApiResponse<HsCodeSearchResult>> {
  try {
    const params = new URLSearchParams()
    params.append('q', query)
    if (options?.chapter) params.append('chapter', options.chapter)
    if (options?.page) params.append('page', String(options.page))
    if (options?.pageSize) params.append('pageSize', String(options.pageSize))
    if (options?.originCountry) params.append('originCountry', options.originCountry)
    
    const response = await fetch(`${API_BASE_URL}/api/taric/search?${params.toString()}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('商品搜索失败:', error)
    throw error
  }
}

/**
 * 改进的 HS 编码查询（V2版本）
 * 不自动替换，返回验证结果和候选列表
 * @param hsCode HS 编码
 * @param originCountry 原产国代码（可选）
 * @param saveToDb 是否保存到数据库
 */
export async function lookupTaricV2(
  hsCode: string,
  originCountry?: string,
  saveToDb?: boolean
): Promise<ApiResponse<TaricLookupV2Result>> {
  try {
    const params = new URLSearchParams()
    if (originCountry) params.append('originCountry', originCountry)
    if (saveToDb) params.append('saveToDb', 'true')
    
    const queryString = params.toString()
    const url = queryString
      ? `${API_BASE_URL}/api/taric/lookup-v2/${hsCode}?${queryString}`
      : `${API_BASE_URL}/api/taric/lookup-v2/${hsCode}`
    
    const response = await fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('HS 编码查询 V2 失败:', error)
    throw error
  }
}

/**
 * 获取可申报编码列表
 * @param prefix 编码前缀（4-8位）
 * @param originCountry 原产国代码（可选）
 */
export async function getDeclarableCodes(
  prefix: string,
  originCountry?: string
): Promise<ApiResponse<{
  prefix: string
  total: number
  codes: Array<{
    code: string
    description: string
    declarable: boolean
    dutyRate?: number | null
    thirdCountryDuty?: number | null
    antiDumpingRate?: number | null
  }>
}>> {
  try {
    const params = originCountry ? `?originCountry=${originCountry}` : ''
    const response = await fetch(`${API_BASE_URL}/api/taric/declarable/${prefix}${params}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取可申报编码失败:', error)
    throw error
  }
}

// ==================== 系统设置 API 接口 ====================

/**
 * 获取系统设置
 */
export async function getSystemSettings(key?: string): Promise<ApiResponse<Record<string, any>>> {
  try {
    const url = key 
      ? `${API_BASE_URL}/api/system-settings?key=${encodeURIComponent(key)}`
      : `${API_BASE_URL}/api/system-settings`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw error
  }
}

/**
 * 保存单个系统设置
 */
export async function saveSystemSetting(key: string, value: any, description?: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/system-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, description }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('保存系统设置失败:', error)
    throw error
  }
}

/**
 * 批量保存系统设置
 */
export async function saveSystemSettingsBatch(settings: Record<string, any>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/system-settings/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('批量保存系统设置失败:', error)
    throw error
  }
}

// ==================== CRM客户 API 接口 ====================

export interface Customer {
  id: string
  customerCode: string
  customerName: string
  companyName: string
  customerType: 'shipper' | 'consignee' | 'both'
  customerLevel: 'vip' | 'important' | 'normal' | 'potential'
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  countryCode: string
  status: 'active' | 'inactive' | 'blacklist'
  creditLimit: number
  paymentTerms: string
  notes: string
  assignedTo: number
  assignedName: string
  assignedOperator?: number | null
  assignedOperatorName?: string
  createTime: string
  updateTime: string
}

/**
 * 获取客户列表
 */
export async function getCustomers(params?: { 
  search?: string
  type?: string
  level?: string
  status?: string
  page?: number
  pageSize?: number 
}): Promise<ApiResponse<{ list: Customer[]; total: number; page: number; pageSize: number }>> {
  // 演示环境：使用真实 API 获取测试数据库中的数据

  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.type) searchParams.append('type', params.type)
    if (params?.level) searchParams.append('level', params.level)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.page) searchParams.append('page', String(params.page))
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize))
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/customers${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户列表失败:', error)
    throw error
  }
}

/**
 * 获取客户详情
 */
export async function getCustomerById(id: string): Promise<ApiResponse<Customer>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${id}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户详情失败:', error)
    throw error
  }
}

/**
 * 获取客户订单列表
 */
export async function getCustomerOrders(customerId: string, params?: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.page) searchParams.append('page', String(params.page))
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize))
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/customers/${customerId}/orders${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户订单失败:', error)
    throw error
  }
}

/**
 * 获取客户订单统计
 */
export async function getCustomerOrderStats(customerId: string): Promise<ApiResponse<{
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalPieces: number
  totalWeight: number
  totalVolume: number
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/order-stats`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户订单统计失败:', error)
    throw error
  }
}

/**
 * 客户订单趋势数据项
 */
export interface OrderTrendItem {
  period: string
  year: string
  month: string | null
  label: string
  orderCount: number
  totalWeight: number
  totalVolume: number
  totalPieces: number
}

/**
 * 客户订单趋势统计结果（包含创建时间和清关完成时间两个维度）
 */
export interface OrderTrendData {
  created: OrderTrendItem[]  // 按创建时间统计
  cleared: OrderTrendItem[]  // 按清关完成时间统计
}

/**
 * 获取客户订单趋势统计（按月/年维度）
 * 同时返回两个日期维度的统计：创建时间和清关完成时间
 * @param customerId 客户ID
 * @param dimension 统计维度：'month' 或 'year'
 * @param limit 返回记录数，月度默认12，年度默认5
 */
export async function getCustomerOrderTrend(
  customerId: string, 
  dimension: 'month' | 'year' = 'month',
  limit?: number
): Promise<ApiResponse<OrderTrendData>> {
  try {
    const params = new URLSearchParams({ dimension })
    if (limit) params.append('limit', limit.toString())
    
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/order-trend?${params}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户订单趋势失败:', error)
    throw error
  }
}

/**
 * 获取全公司订单趋势统计（按月/年维度）
 * 同时返回两个日期维度的统计：创建时间和清关完成时间
 * @param dimension 统计维度：'month' 或 'year'
 * @param limit 返回记录数，月度默认12，年度默认5
 */
export async function getCompanyOrderTrend(
  dimension: 'month' | 'year' = 'month',
  limit?: number
): Promise<ApiResponse<OrderTrendData>> {
  try {
    const params = new URLSearchParams({ dimension })
    if (limit) params.append('limit', limit.toString())
    
    const response = await fetch(`${API_BASE_URL}/api/bills/order-trend?${params}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取公司订单趋势失败:', error)
    throw error
  }
}


// ==================== 客户地址 API 接口 ====================

export interface CustomerAddress {
  id?: number
  customerId?: number
  addressCode?: string
  companyName: string
  contactPerson?: string
  phone?: string
  country?: string
  city?: string
  address: string
  postalCode?: string
  isDefault?: boolean
  addressType?: 'shipper' | 'consignee' | 'both'
  createdAt?: string
  updatedAt?: string
}

/**
 * 获取客户地址列表
 */
export async function getCustomerAddresses(customerId: string): Promise<ApiResponse<CustomerAddress[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/addresses`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户地址列表失败:', error)
    throw error
  }
}

/**
 * 创建客户地址
 */
export async function createCustomerAddress(customerId: string, data: CustomerAddress): Promise<ApiResponse<{ id: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建客户地址失败:', error)
    throw error
  }
}

/**
 * 更新客户地址
 */
export async function updateCustomerAddress(customerId: string, addressId: number, data: Partial<CustomerAddress>): Promise<ApiResponse<{ id: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/addresses/${addressId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新客户地址失败:', error)
    throw error
  }
}

/**
 * 删除客户地址
 */
export async function deleteCustomerAddress(customerId: string, addressId: number): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/addresses/${addressId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除客户地址失败:', error)
    throw error
  }
}

// ==================== 客户税号 API 接口 ====================

export interface CustomerTaxNumber {
  id?: number
  customerId?: number
  taxType: 'vat' | 'eori' | 'other'
  taxNumber: string
  country?: string
  companyShortName?: string
  companyName?: string
  companyAddress?: string
  isVerified?: boolean
  verifiedAt?: string
  verificationData?: {
    source: string
    requestDate: string
    valid: boolean
    companyName?: string
    companyAddress?: string
  }
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

// 税号验证结果接口
export interface TaxValidationResult {
  valid: boolean
  vatNumber?: string
  eoriNumber?: string
  countryCode?: string
  companyName?: string
  companyAddress?: string
  verifiedAt?: string
  error?: string
}

/**
 * 获取客户税号列表
 */
export async function getCustomerTaxNumbers(customerId: string): Promise<ApiResponse<CustomerTaxNumber[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-numbers`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户税号列表失败:', error)
    throw error
  }
}

/**
 * 创建客户税号
 */
export async function createCustomerTaxNumber(customerId: string, data: CustomerTaxNumber): Promise<ApiResponse<{ id: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建客户税号失败:', error)
    throw error
  }
}

/**
 * 更新客户税号
 */
export async function updateCustomerTaxNumber(customerId: string, taxId: number, data: Partial<CustomerTaxNumber>): Promise<ApiResponse<{ id: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-numbers/${taxId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新客户税号失败:', error)
    throw error
  }
}

/**
 * 删除客户税号
 */
export async function deleteCustomerTaxNumber(customerId: string, taxId: number): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-numbers/${taxId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除客户税号失败:', error)
    throw error
  }
}

// ==================== 客户公司税号信息 API（新版：每个公司一条记录） ====================

/**
 * 公司税号信息（新版）
 */
export interface CustomerTaxInfo {
  id?: number
  customerId?: string
  companyName: string
  companyShortName?: string
  companyAddress?: string
  country?: string
  eoriNumber?: string
  eoriVerified?: boolean
  eoriVerifiedAt?: string
  vatNumber?: string
  vatVerified?: boolean
  vatVerifiedAt?: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 获取客户公司税号列表（新版）
 */
export async function getCustomerTaxInfoList(customerId: string): Promise<ApiResponse<CustomerTaxInfo[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-info`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户公司税号列表失败:', error)
    throw error
  }
}

/**
 * 创建客户公司税号信息（新版）
 */
export async function createCustomerTaxInfo(customerId: string, data: CustomerTaxInfo): Promise<ApiResponse<{ id: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建客户公司税号信息失败:', error)
    throw error
  }
}

/**
 * 更新客户公司税号信息（新版）
 */
export async function updateCustomerTaxInfo(customerId: string, taxInfoId: number, data: Partial<CustomerTaxInfo>): Promise<ApiResponse<{ id: number }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-info/${taxInfoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新客户公司税号信息失败:', error)
    throw error
  }
}

/**
 * 删除客户公司税号信息（新版）
 */
export async function deleteCustomerTaxInfo(customerId: string, taxInfoId: number): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}/tax-info/${taxInfoId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除客户公司税号信息失败:', error)
    throw error
  }
}

// ==================== 税号验证 API 接口 ====================

/**
 * 验证VAT税号
 */
export async function validateVATNumber(vatNumber: string, countryCode?: string): Promise<ApiResponse<TaxValidationResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tax/validate-vat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vatNumber, countryCode })
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('VAT税号验证失败:', error)
    throw error
  }
}

/**
 * 验证EORI号码
 */
export async function validateEORINumber(eoriNumber: string): Promise<ApiResponse<TaxValidationResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tax/validate-eori`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eoriNumber })
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('EORI号码验证失败:', error)
    throw error
  }
}

/**
 * 获取支持的VAT国家列表
 */
export async function getSupportedVatCountries(): Promise<ApiResponse<Array<{ code: string; pattern: string }>>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tax/supported-countries`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取VAT国家列表失败:', error)
    throw error
  }
}

// ==================== 财务费用 API 接口 ====================

export interface Fee {
  id: string
  billId: string | null
  billNumber: string
  customerId: string | null
  customerName: string
  category: string
  feeName: string
  amount: number
  currency: string
  exchangeRate: number
  feeDate: string
  description: string
  notes: string
  createdBy: number
  createdAt: string
  updatedAt: string
}

/**
 * 获取费用列表
 */
export async function getFees(params?: { 
  billId?: string
  customerId?: string
  category?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number 
}): Promise<ApiResponse<{ list: Fee[]; total: number; page: number; pageSize: number }>> {
  // 演示环境：使用真实 API 获取测试数据库中的数据

  try {
    const searchParams = new URLSearchParams()
    if (params?.billId) searchParams.append('billId', params.billId)
    if (params?.customerId) searchParams.append('customerId', params.customerId)
    if (params?.category) searchParams.append('category', params.category)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)
    if (params?.page) searchParams.append('page', String(params.page))
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize))
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/fees${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取费用列表失败:', error)
    throw error
  }
}

/**
 * 创建费用
 */
export async function createFee(data: Omit<Fee, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<{ id: string }>> {
  // 测试模式：阻止写操作
  if (checkTestMode()) {
    showTestModeWarning('创建费用')
    return createWriteBlockedResponse() as any
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建费用失败:', error)
    throw error
  }
}

/**
 * 更新费用
 */
export async function updateFee(id: string, data: Partial<Fee>): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/fees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新费用失败:', error)
    throw error
  }
}

/**
 * 删除费用
 */
export async function deleteFee(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/fees/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders()
      }
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除费用失败:', error)
    throw error
  }
}

/**
 * 获取订单费用统计
 */
export async function getBillFeeStats(billId: string): Promise<ApiResponse<{
  totalAmount: number
  feeCount: number
  byCategory: Array<{ category: string; total: number; count: number }>
}>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${billId}/fee-stats`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取订单费用统计失败:', error)
    throw error
  }
}

// ==================== 税号批量验证 API ====================

/**
 * 税号批量验证结果
 */
export interface TaxValidationBatchResult {
  success: boolean
  total: number
  validated: number
  failed: number
  duration?: string
  results?: Array<{
    id: number
    taxNumber: string
    taxType: string
    valid: boolean
    error?: string
  }>
  error?: string
}

/**
 * 税号验证统计
 */
export interface TaxValidationStats {
  total: number
  verified: number
  unverified: number
  lastVerifiedAt?: string
  lastAutoValidation?: {
    total: number
    validated: number
    failed: number
    duration: string
    runAt: string
  }
}

/**
 * 手动触发批量验证所有税号
 */
export async function validateAllTaxNumbers(): Promise<ApiResponse<TaxValidationBatchResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/crm/tax/validate-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('批量验证税号失败:', error)
    throw error
  }
}

/**
 * 获取税号验证统计
 */
export async function getTaxValidationStats(): Promise<ApiResponse<TaxValidationStats>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/crm/tax/validation-stats`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取税号验证统计失败:', error)
    throw error
  }
}

// ==================== 物流跟踪 API 接口 ====================

/**
 * 跟踪记录
 */
export interface TrackingRecord {
  id: string
  billId: string
  transportType: 'sea' | 'air' | 'rail' | 'truck'
  trackingNumber: string
  nodeType: string
  nodeName: string
  status: 'pending' | 'in_transit' | 'arrived' | 'customs' | 'delivered' | 'exception'
  location: string
  eventTime: string
  remark: string
  source: 'manual' | 'api'
  operator: string
  latitude?: number
  longitude?: number
  createdAt: string
  updatedAt: string
}

/**
 * 跟踪信息响应
 */
export interface TrackingInfo {
  records: TrackingRecord[]
  latestStatus: TrackingRecord | null
  refreshed: boolean
}

/**
 * 节点模板
 */
export interface NodeTemplate {
  nodeType: string
  nodeName: string
  order: number
}

/**
 * 获取提单跟踪记录
 * @param billId 提单ID
 * @param options 选项
 */
export async function getBillTracking(
  billId: string,
  options?: { refresh?: boolean; transportType?: string }
): Promise<ApiResponse<TrackingInfo>> {
  try {
    const params = new URLSearchParams()
    if (options?.refresh) params.append('refresh', 'true')
    if (options?.transportType) params.append('transportType', options.transportType)
    
    const queryString = params.toString()
    const url = `${API_BASE_URL}/api/tracking/bill/${billId}${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取跟踪记录失败:', error)
    throw error
  }
}

/**
 * 添加手动跟踪节点
 * @param billId 提单ID
 * @param data 节点数据
 */
export async function addTrackingNode(
  billId: string,
  data: {
    nodeType: string
    nodeName: string
    status?: string
    location?: string
    eventTime?: string
    remark?: string
    operator?: string
    latitude?: number
    longitude?: number
  }
): Promise<ApiResponse<{ id: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tracking/bill/${billId}/node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('添加跟踪节点失败:', error)
    throw error
  }
}

/**
 * 更新跟踪记录
 * @param id 记录ID
 * @param data 更新数据
 */
export async function updateTrackingRecord(
  id: string,
  data: Partial<TrackingRecord>
): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tracking/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新跟踪记录失败:', error)
    throw error
  }
}

/**
 * 删除跟踪记录
 * @param id 记录ID
 */
export async function deleteTrackingRecord(id: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tracking/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除跟踪记录失败:', error)
    throw error
  }
}

/**
 * 获取跟踪节点模板
 * @param transportType 运输方式
 */
export async function getTrackingNodeTemplates(
  transportType?: string
): Promise<ApiResponse<NodeTemplate[]>> {
  try {
    const params = new URLSearchParams()
    if (transportType) params.append('transportType', transportType)
    
    const queryString = params.toString()
    const url = `${API_BASE_URL}/api/tracking/templates${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取节点模板失败:', error)
    throw error
  }
}

/**
 * 批量刷新跟踪状态
 * @param billIds 提单ID数组
 * @param transportType 运输方式
 */
export async function batchRefreshTracking(
  billIds: string[],
  transportType?: string
): Promise<ApiResponse<{ success: number; failed: number; errors: Array<{ billId: string; error: string }> }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tracking/batch-refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billIds, transportType }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.msg || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('批量刷新跟踪失败:', error)
    throw error
  }
}

/**
 * 获取跟踪统计
 */
export async function getTrackingStats(params?: {
  transportType?: string
  startDate?: string
  endDate?: string
}): Promise<ApiResponse<{
  totalBills: number
  totalRecords: number
  inTransit: number
  delivered: number
  exceptions: number
}>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.transportType) searchParams.append('transportType', params.transportType)
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/tracking/stats${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取跟踪统计失败:', error)
    throw error
  }
}

// ==================== 供应商管理 API ====================

export interface Supplier {
  id: string
  supplierCode: string
  supplierName: string
  shortName?: string
  supplierType: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  country?: string
  city?: string
  address?: string
  status: string
  level?: string
  currency?: string
  remark?: string
}

/**
 * 获取供应商列表
 * @param params 查询参数
 */
export async function getSupplierList(params?: {
  search?: string
  type?: string
  types?: string
  status?: string
  level?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ list: Supplier[]; total: number; page: number; pageSize: number }>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.type) searchParams.append('type', params.type)
    if (params?.types) searchParams.append('types', params.types)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.level) searchParams.append('level', params.level)
    if (params?.page) searchParams.append('page', String(params.page))
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize))
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/suppliers${queryString ? `?${queryString}` : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取供应商列表失败:', error)
    throw error
  }
}

/**
 * 获取换单代理供应商列表（快捷方法）
 */
export async function getDocSwapAgents(): Promise<ApiResponse<{ list: Supplier[]; total: number }>> {
  return getSupplierList({ type: 'doc_swap_agent', status: 'active', pageSize: 100 })
}

// ==================== 追踪补充信息 API ====================

/**
 * 追踪补充信息响应数据
 */
export interface TrackingSupplementInfo {
  // 码头/堆场信息（地勤）
  terminal?: string | null
  terminalCode?: string | null
  // 船名航次
  vessel?: string | null
  voyage?: string | null
  // 预计时间
  eta?: string | null
  etd?: string | null
  // 承运人
  carrier?: string | null
  // 货物信息
  pieces?: number | null
  grossWeight?: number | null
  volume?: number | null
  // 集装箱信息
  containerNumber?: string | null
  containerType?: string | null
  sealNumber?: string | null
}

/**
 * 根据提单号/集装箱号获取补充信息（码头、船名航次等）
 * 用于创建提单时自动填充未识别的字段
 * @param params 查询参数
 * @returns 补充信息
 * 
 * 接口地址: GET /api/tracking/supplement-info
 */
export async function getTrackingSupplementInfo(params: {
  trackingNumber?: string
  containerNumber?: string
  transportType?: 'sea' | 'air' | 'rail' | 'truck'
}): Promise<ApiResponse<TrackingSupplementInfo | null>> {
  try {
    const searchParams = new URLSearchParams()
    if (params.trackingNumber) searchParams.append('trackingNumber', params.trackingNumber)
    if (params.containerNumber) searchParams.append('containerNumber', params.containerNumber)
    if (params.transportType) searchParams.append('transportType', params.transportType)
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/tracking/supplement-info?${queryString}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取追踪补充信息失败:', error)
    throw error
  }
}

// ==================== 爬虫追踪 API ====================

/**
 * 爬虫追踪结果类型
 */
export interface ScraperTrackingResult {
  containerNumber: string | null
  billNumber: string | null
  carrier: string | null
  carrierCode: string | null
  vessel: string | null
  voyage: string | null
  portOfLoading: string | null
  portOfDischarge: string | null
  etd: string | null
  eta: string | null
  atd: string | null
  ata: string | null
  status: string | null
  containerType: string | null
  sealNumber: string | null
  grossWeight: number | null
  volume: number | null
  events: Array<{
    date: string | null
    time?: string | null
    location: string | null
    event: string | null
    vessel?: string | null
    voyage?: string | null
  }>
  _source: string
  _fetchedAt: string
}

/**
 * 支持的船公司
 */
export interface SupportedCarrier {
  code: string
  name: string
  scraper: string
}

/**
 * 智能追踪（自动判断是集装箱号还是提单号）- 免费爬虫
 * @param trackingNumber - 追踪号（提单号或集装箱号）
 * @param shippingCompany - 可选，船公司名称（用于纯数字提单号的船公司识别）
 */
export async function smartTrack(trackingNumber: string, shippingCompany?: string): Promise<ApiResponse<ScraperTrackingResult | null>> {
  try {
    let url = `${API_BASE_URL}/api/tracking/scrape?trackingNumber=${encodeURIComponent(trackingNumber)}`
    if (shippingCompany) {
      url += `&shippingCompany=${encodeURIComponent(shippingCompany)}`
    }
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('智能追踪失败:', error)
    throw error
  }
}

/**
 * 按集装箱号追踪 - 免费爬虫
 */
export async function scrapeContainerTracking(containerNumber: string): Promise<ApiResponse<ScraperTrackingResult | null>> {
  try {
    const url = `${API_BASE_URL}/api/tracking/scrape/container?containerNumber=${encodeURIComponent(containerNumber)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('集装箱追踪失败:', error)
    throw error
  }
}

/**
 * 按提单号追踪 - 免费爬虫
 */
export async function scrapeBillTracking(billNumber: string): Promise<ApiResponse<ScraperTrackingResult | null>> {
  try {
    const url = `${API_BASE_URL}/api/tracking/scrape/bill?billNumber=${encodeURIComponent(billNumber)}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('提单追踪失败:', error)
    throw error
  }
}

/**
 * 获取支持的船公司列表
 */
export async function getSupportedCarriers(): Promise<ApiResponse<SupportedCarrier[]>> {
  try {
    const url = `${API_BASE_URL}/api/tracking/scrape/carriers`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取船公司列表失败:', error)
    throw error
  }
}

// ==================== 客户门户账户管理 API ====================

/**
 * 客户门户账户类型
 */
export interface CustomerAccount {
  id: number
  customerId: string
  customerName?: string
  username: string
  email: string | null
  status: 'active' | 'inactive' | 'suspended'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 获取客户门户账户列表
 */
export async function getCustomerAccounts(params?: {
  customerId?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{ list: CustomerAccount[]; total: number }>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.customerId) searchParams.append('customerId', params.customerId)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.page) searchParams.append('page', String(params.page))
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize))
    
    const queryString = searchParams.toString()
    const url = `${API_BASE_URL}/api/customer-accounts${queryString ? '?' + queryString : ''}`
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('获取客户账户列表失败:', error)
    throw error
  }
}

/**
 * 创建客户门户账户
 */
export async function createCustomerAccount(data: {
  customerId: string
  username: string
  password: string
  email?: string
}): Promise<ApiResponse<CustomerAccount>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.msg || errorData.errMessage || `HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('创建客户账户失败:', error)
    throw error
  }
}

/**
 * 更新客户门户账户
 */
export async function updateCustomerAccount(id: number, data: {
  email?: string
  status?: 'active' | 'inactive' | 'suspended'
}): Promise<ApiResponse<CustomerAccount>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('更新客户账户失败:', error)
    throw error
  }
}

/**
 * 重置客户账户密码
 */
export async function resetCustomerAccountPassword(id: number, newPassword: string): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-accounts/${id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('重置账户密码失败:', error)
    throw error
  }
}

/**
 * 删除客户门户账户
 */
export async function deleteCustomerAccount(id: number): Promise<ApiResponse<null>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-accounts/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('删除客户账户失败:', error)
    throw error
  }
}

/**
 * 工作人员代登录客户门户
 * 生成代登录Token，用于工作人员直接登录客户门户系统
 */
export interface StaffProxyLoginResponse {
  token: string
  expiresIn: string
  user: {
    id: number
    customerId: string
    customerName: string
    customerCode: string
    username: string
    email: string | null
    phone: string | null
    avatarUrl: string | null
    staffProxy: boolean
    staffName: string
  }
}

export async function staffProxyLoginToPortal(accountId: number): Promise<ApiResponse<StaffProxyLoginResponse>> {
  try {
    const token = localStorage.getItem('bp_logistics_user_cache')
    let authToken = ''
    if (token) {
      try {
        const cached = JSON.parse(token)
        authToken = cached.token || ''
      } catch {
        // 尝试直接使用
        authToken = token
      }
    }
    
    // 也尝试从测试模式获取 token
    if (!authToken) {
      const testMode = localStorage.getItem('bp_logistics_test_mode')
      if (testMode) {
        try {
          const testData = JSON.parse(testMode)
          authToken = testData.token || ''
        } catch {
          // ignore
        }
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/api/customer-accounts/${accountId}/staff-login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      }
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('工作人员代登录失败:', error)
    throw error
  }
}


// ==================== HERE 地理编码 API ====================

export interface HereGeocodeResult {
  lat: number
  lng: number
  address: string
  country: string
  countryName?: string
  city: string
  postalCode: string
}

export interface HereAddressSuggestion {
  title: string
  address: string
  city: string
  country: string
  countryCode: string
  postalCode: string
  lat?: number
  lng?: number
}

/**
 * HERE 地理编码 - 通过地址或邮编获取位置信息
 * @param query 地址或邮编（如 "41751, DE" 或 "德国柏林"）
 */
export async function hereGeocode(query: string): Promise<ApiResponse<HereGeocodeResult>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/inquiry/geocode?address=${encodeURIComponent(query)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('HERE 地理编码失败:', error)
    throw error
  }
}

/**
 * HERE 地址自动补全 - 输入关键词返回匹配的地址列表
 * @param query 搜索关键词（邮编或地址）
 * @param limit 返回结果数量限制，默认5条
 */
export async function hereAutosuggest(query: string, limit: number = 5): Promise<ApiResponse<HereAddressSuggestion[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/inquiry/autosuggest?query=${encodeURIComponent(query)}&limit=${limit}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('HERE 地址自动补全失败:', error)
    throw error
  }
}

/**
 * 根据邮编获取城市和国家信息
 * @param postalCode 邮编
 * @param countryCode 国家代码（可选，如 DE、NL）
 */
export async function getAddressByPostalCode(postalCode: string, countryCode?: string): Promise<ApiResponse<HereGeocodeResult>> {
  const query = countryCode ? `${postalCode}, ${countryCode}` : postalCode
  return hereGeocode(query)
}

// ==================== 地址缓存管理 API ====================

export interface AddressCacheItem {
  id: number
  query_text: string
  title: string
  address: string
  city: string
  country: string
  country_code: string
  postal_code: string
  lat: number
  lng: number
  cache_type: 'autosuggest' | 'geocode'
  source: 'here' | 'manual'
  hit_count: number
  last_hit_at: string
  created_at: string
}

export interface AddressCacheStats {
  cache_type: string
  total_count: number
  total_hits: number
  avg_hits: number
  last_hit: string
}

/**
 * 获取地址缓存统计
 */
export async function getAddressCacheStats(): Promise<ApiResponse<{
  stats: AddressCacheStats[]
  topAddresses: AddressCacheItem[]
}>> {
  return fetchApi('/api/inquiry/address-cache/stats')
}

/**
 * 搜索地址缓存
 */
export async function searchAddressCache(params: {
  keyword?: string
  countryCode?: string
  cacheType?: 'autosuggest' | 'geocode'
  page?: number
  pageSize?: number
}): Promise<ApiResponse<{
  list: AddressCacheItem[]
  total: number
  page: number
  pageSize: number
}>> {
  const queryParams = new URLSearchParams()
  if (params.keyword) queryParams.append('keyword', params.keyword)
  if (params.countryCode) queryParams.append('countryCode', params.countryCode)
  if (params.cacheType) queryParams.append('cacheType', params.cacheType)
  if (params.page) queryParams.append('page', params.page.toString())
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString())
  
  return fetchApi(`/api/inquiry/address-cache?${queryParams.toString()}`)
}

/**
 * 手动添加地址到缓存
 */
export async function addAddressToCache(addressData: {
  queryText?: string
  title?: string
  address: string
  city?: string
  country?: string
  countryCode?: string
  postalCode?: string
  lat?: number
  lng?: number
  cacheType?: 'autosuggest' | 'geocode'
}): Promise<ApiResponse<AddressCacheItem>> {
  return fetchApi('/api/inquiry/address-cache', {
    method: 'POST',
    body: JSON.stringify(addressData)
  })
}

/**
 * 删除地址缓存
 */
export async function deleteAddressCache(id: number): Promise<ApiResponse<{ id: number }>> {
  return fetchApi(`/api/inquiry/address-cache/${id}`, {
    method: 'DELETE'
  })
}

/**
 * 清理过期地址缓存
 */
export async function cleanupAddressCache(days: number = 90): Promise<ApiResponse<{ cleanedCount: number }>> {
  return fetchApi('/api/inquiry/address-cache/cleanup', {
    method: 'POST',
    body: JSON.stringify({ days })
  })
}


