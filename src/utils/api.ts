/**
 * API 服务工具
 * 物流管理系统 API 接口
 */

// API 基础地址配置
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || ''

/**
 * 通用 API 请求函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API请求失败: ${response.statusText}`)
  }

  return response.json()
}

// ==================== 用户管理 API 接口 ====================

export interface User {
  id: string
  username: string
  name: string
  email: string
  phone?: string
  avatar?: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  roleName?: string
  status: 'active' | 'inactive'
  lastLoginTime?: string
  lastLoginIp?: string
  loginCount?: number
  createTime?: string
  updateTime?: string
  permissions?: string[]
}

export interface CreateUserRequest {
  username: string
  name: string
  email?: string
  phone?: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
  status?: 'active' | 'inactive'
  password: string
}

export interface UpdateUserRequest {
  id: string
  name?: string
  email?: string
  phone?: string
  role?: 'admin' | 'manager' | 'operator' | 'viewer'
  status?: 'active' | 'inactive'
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
}

export interface Permission {
  permissionCode: string
  permissionName: string
  module: string
  description?: string
  category?: string
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
 * 请求参数: { page?: number, pageSize?: number, search?: string, role?: string, status?: string }
 */
export async function getUserList(params?: {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  status?: string
}): Promise<ApiResponse<PaginatedResponse<User>>> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.role) queryParams.append('role', params.role)
  if (params?.status) queryParams.append('status', params.status)
  
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
    body: JSON.stringify({ permissions })
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
  // TODO: 对接后台系统时，取消注释以下代码
  // return request<ApiResponse<{ downloadUrl: string; fileName: string }>>(
  //   `/files/download?declarationNumber=${declarationNumber}`
  // )
  
  // 临时模拟数据
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
  billId?: string
  billNumber: string
  containerNumber?: string
  actualContainerNo?: string  // 实际集装箱号
  vessel?: string
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
  orderSeq?: number
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
  voyage?: string
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
export async function createBill(data: Partial<BillOfLading>): Promise<ApiResponse<BillOfLading>> {
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
export async function updateBill(id: string, data: Partial<BillOfLading>): Promise<ApiResponse<BillOfLading>> {
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
export async function voidBill(id: string, voidReason?: string): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/void`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voidReason }),
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
  docSwapStatus: '未换单' | '已换单'
): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/doc-swap-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ docSwapStatus }),
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
  customsNote?: string
): Promise<ApiResponse<BillOfLading>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bills/${id}/customs-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customsStatus, customsNote }),
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
 * 接口地址: GET /api/container-codes/search?q=xxx
 */
export async function searchContainerCodes(query: string): Promise<ApiResponse<ContainerCode[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/container-codes/search?q=${encodeURIComponent(query)}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
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
  code: string
  description: string
  sortOrder: number
  status: 'active' | 'inactive'
  createTime: string
}

/**
 * 获取服务费类别列表
 */
export async function getServiceFeeCategories(params?: { search?: string; status?: string }): Promise<ApiResponse<ServiceFeeCategory[]>> {
  try {
    const searchParams = new URLSearchParams()
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    
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
export async function createServiceFeeCategory(data: Omit<ServiceFeeCategory, 'id' | 'createTime'>): Promise<ApiResponse<{ id: string }>> {
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

