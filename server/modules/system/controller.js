/**
 * 系统管理模块 - 控制器
 */

import { success, successWithPagination, badRequest, notFound, conflict, unauthorized, forbidden, serverError } from '../../utils/response.js'
import { validatePassword } from '../../utils/validator.js'
import * as model from './model.js'

// ==================== 用户管理 ====================

/**
 * 获取用户列表
 */
export async function getUsers(req, res) {
  try {
    const { role, status, search, page, pageSize } = req.query
    
    const result = model.getUsers({
      role,
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    // 移除敏感信息
    result.list = result.list.map(user => {
      const { passwordHash, ...safeUser } = user
      return safeUser
    })
    
    return successWithPagination(res, result.list, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    return serverError(res, '获取用户列表失败')
  }
}

/**
 * 获取单个用户
 */
export async function getUserById(req, res) {
  try {
    const user = model.getUserById(req.params.id)
    if (!user) {
      return notFound(res, '用户不存在')
    }
    
    // 移除敏感信息
    const { passwordHash, ...safeUser } = user
    return success(res, safeUser)
  } catch (error) {
    console.error('获取用户详情失败:', error)
    return serverError(res, '获取用户详情失败')
  }
}

/**
 * 创建用户
 */
export async function createUser(req, res) {
  try {
    const { username, password, name, email, phone, role } = req.body
    
    if (!username || !password || !name) {
      return badRequest(res, '用户名、密码和姓名为必填项')
    }
    
    // 检查用户名是否已存在
    const existing = model.getUserByUsername(username)
    if (existing) {
      return conflict(res, '用户名已存在')
    }
    
    // 验证密码强度
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return badRequest(res, passwordValidation.errors.join('; '))
    }
    
    const result = model.createUser({
      username,
      password,
      name,
      email,
      phone,
      role
    })
    
    const newUser = model.getUserById(result.id)
    const { passwordHash, ...safeUser } = newUser
    
    return success(res, safeUser, '创建成功')
  } catch (error) {
    console.error('创建用户失败:', error)
    return serverError(res, '创建用户失败')
  }
}

/**
 * 更新用户
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getUserById(id)
    if (!existing) {
      return notFound(res, '用户不存在')
    }
    
    const updated = model.updateUser(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedUser = model.getUserById(id)
    const { passwordHash, ...safeUser } = updatedUser
    
    return success(res, safeUser, '更新成功')
  } catch (error) {
    console.error('更新用户失败:', error)
    return serverError(res, '更新用户失败')
  }
}

/**
 * 更新用户状态
 */
export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return badRequest(res, '状态值无效')
    }
    
    const existing = model.getUserById(id)
    if (!existing) {
      return notFound(res, '用户不存在')
    }
    
    // 不能禁用自己
    if (req.user && req.user.id === parseInt(id) && status === 'inactive') {
      return badRequest(res, '不能禁用自己的账号')
    }
    
    model.updateUserStatus(id, status)
    return success(res, null, status === 'active' ? '用户已启用' : '用户已禁用')
  } catch (error) {
    console.error('更新用户状态失败:', error)
    return serverError(res, '更新用户状态失败')
  }
}

/**
 * 删除用户
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params
    
    const existing = model.getUserById(id)
    if (!existing) {
      return notFound(res, '用户不存在')
    }
    
    // 不能删除自己
    if (req.user && req.user.id === parseInt(id)) {
      return badRequest(res, '不能删除自己的账号')
    }
    
    // 不能删除管理员
    if (existing.role === 'admin') {
      return badRequest(res, '不能删除管理员账号')
    }
    
    model.deleteUser(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除用户失败:', error)
    return serverError(res, '删除用户失败')
  }
}

/**
 * 修改密码
 */
export async function changePassword(req, res) {
  try {
    const { id } = req.params
    const { oldPassword, newPassword } = req.body
    
    if (!newPassword) {
      return badRequest(res, '新密码为必填项')
    }
    
    const user = model.getUserById(id)
    if (!user) {
      return notFound(res, '用户不存在')
    }
    
    // 如果不是管理员修改他人密码，需要验证旧密码
    if (!req.user || req.user.role !== 'admin' || req.user.id === parseInt(id)) {
      if (!oldPassword) {
        return badRequest(res, '原密码为必填项')
      }
      
      if (!model.verifyPassword(user, oldPassword)) {
        return badRequest(res, '原密码错误')
      }
    }
    
    // 验证新密码强度
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      return badRequest(res, passwordValidation.errors.join('; '))
    }
    
    model.changePassword(id, newPassword)
    return success(res, null, '密码修改成功')
  } catch (error) {
    console.error('修改密码失败:', error)
    return serverError(res, '修改密码失败')
  }
}

// ==================== 认证相关 ====================

/**
 * 用户登录
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body
    
    if (!username || !password) {
      return badRequest(res, '用户名和密码为必填项')
    }
    
    // 检查用户是否被锁定
    if (model.isUserLocked(username)) {
      model.addLoginLog({
        username,
        loginIp: req.ip,
        userAgent: req.get('User-Agent'),
        loginResult: 'locked',
        failReason: '账号已锁定'
      })
      return forbidden(res, '账号已被锁定，请15分钟后重试')
    }
    
    const user = model.getUserByUsername(username)
    
    if (!user) {
      model.addLoginLog({
        username,
        loginIp: req.ip,
        userAgent: req.get('User-Agent'),
        loginResult: 'failed',
        failReason: '用户不存在'
      })
      return unauthorized(res, '用户名或密码错误')
    }
    
    if (user.status !== 'active') {
      model.addLoginLog({
        userId: user.id,
        username,
        loginIp: req.ip,
        userAgent: req.get('User-Agent'),
        loginResult: 'failed',
        failReason: '账号已禁用'
      })
      return forbidden(res, '账号已被禁用')
    }
    
    // 验证密码
    if (!model.verifyPassword(user, password)) {
      model.incrementLoginAttempts(username, req.ip, '密码错误')
      
      model.addLoginLog({
        userId: user.id,
        username,
        loginIp: req.ip,
        userAgent: req.get('User-Agent'),
        loginResult: 'failed',
        failReason: '密码错误'
      })
      
      return unauthorized(res, '用户名或密码错误')
    }
    
    // 更新登录信息
    model.updateLoginInfo(user.id, req.ip)
    
    // 记录成功登录
    model.addLoginLog({
      userId: user.id,
      username,
      loginIp: req.ip,
      userAgent: req.get('User-Agent'),
      loginResult: 'success'
    })
    
    // 返回用户信息（简化版token，实际项目应使用JWT）
    const { passwordHash, ...safeUser } = user
    
    return success(res, {
      user: safeUser,
      token: String(user.id) // 简化token
    }, '登录成功')
  } catch (error) {
    console.error('登录失败:', error)
    return serverError(res, '登录失败')
  }
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(req, res) {
  try {
    if (!req.user) {
      return unauthorized(res, '未登录')
    }
    
    const user = model.getUserById(req.user.id)
    if (!user) {
      return notFound(res, '用户不存在')
    }
    
    const { passwordHash, ...safeUser } = user
    
    // 获取用户权限
    const permissions = model.getRolePermissions(user.role)
    
    return success(res, {
      ...safeUser,
      permissions: permissions.map(p => p.permissionCode)
    })
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return serverError(res, '获取当前用户失败')
  }
}

// ==================== 角色管理 ====================

/**
 * 获取角色列表
 */
export async function getRoles(req, res) {
  try {
    const { status, search } = req.query
    const roles = model.getRoles({ status, search })
    return success(res, roles)
  } catch (error) {
    console.error('获取角色列表失败:', error)
    return serverError(res, '获取角色列表失败')
  }
}

/**
 * 获取单个角色
 */
export async function getRoleByCode(req, res) {
  try {
    const role = model.getRoleByCode(req.params.roleCode)
    if (!role) {
      return notFound(res, '角色不存在')
    }
    
    // 获取角色权限
    const permissions = model.getRolePermissions(role.roleCode)
    
    return success(res, {
      ...role,
      permissions
    })
  } catch (error) {
    console.error('获取角色详情失败:', error)
    return serverError(res, '获取角色详情失败')
  }
}

/**
 * 创建角色
 */
export async function createRole(req, res) {
  try {
    const { roleCode, roleName } = req.body
    
    if (!roleCode || !roleName) {
      return badRequest(res, '角色代码和角色名称为必填项')
    }
    
    // 检查角色代码是否已存在
    const existing = model.getRoleByCode(roleCode)
    if (existing) {
      return conflict(res, '角色代码已存在')
    }
    
    const result = model.createRole(req.body)
    const newRole = model.getRoleByCode(roleCode)
    
    return success(res, newRole, '创建成功')
  } catch (error) {
    console.error('创建角色失败:', error)
    return serverError(res, '创建角色失败')
  }
}

/**
 * 更新角色
 */
export async function updateRole(req, res) {
  try {
    const { roleCode } = req.params
    
    const existing = model.getRoleByCode(roleCode)
    if (!existing) {
      return notFound(res, '角色不存在')
    }
    
    // 不能修改管理员角色的核心信息
    if (roleCode === 'admin' && req.body.roleCode) {
      return badRequest(res, '不能修改管理员角色的代码')
    }
    
    const updated = model.updateRole(roleCode, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    const updatedRole = model.getRoleByCode(roleCode)
    return success(res, updatedRole, '更新成功')
  } catch (error) {
    console.error('更新角色失败:', error)
    return serverError(res, '更新角色失败')
  }
}

/**
 * 删除角色
 */
export async function deleteRole(req, res) {
  try {
    const { roleCode } = req.params
    
    // 不能删除系统角色
    if (['admin', 'manager', 'operator', 'viewer'].includes(roleCode)) {
      return badRequest(res, '不能删除系统内置角色')
    }
    
    const existing = model.getRoleByCode(roleCode)
    if (!existing) {
      return notFound(res, '角色不存在')
    }
    
    model.deleteRole(roleCode)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除角色失败:', error)
    if (error.message.includes('还有用户')) {
      return badRequest(res, error.message)
    }
    return serverError(res, '删除角色失败')
  }
}

// ==================== 权限管理 ====================

/**
 * 获取所有权限
 */
export async function getPermissions(req, res) {
  try {
    const permissions = model.getPermissions()
    return success(res, permissions)
  } catch (error) {
    console.error('获取权限列表失败:', error)
    return serverError(res, '获取权限列表失败')
  }
}

/**
 * 获取角色权限
 */
export async function getRolePermissions(req, res) {
  try {
    const { roleCode } = req.params
    
    const role = model.getRoleByCode(roleCode)
    if (!role) {
      return notFound(res, '角色不存在')
    }
    
    const permissions = model.getRolePermissions(roleCode)
    return success(res, permissions)
  } catch (error) {
    console.error('获取角色权限失败:', error)
    return serverError(res, '获取角色权限失败')
  }
}

/**
 * 更新角色权限
 */
export async function updateRolePermissions(req, res) {
  try {
    const { roleCode } = req.params
    const { permissionCodes } = req.body
    
    if (!Array.isArray(permissionCodes)) {
      return badRequest(res, 'permissionCodes 必须是数组')
    }
    
    const role = model.getRoleByCode(roleCode)
    if (!role) {
      return notFound(res, '角色不存在')
    }
    
    // 不能修改管理员权限
    if (roleCode === 'admin') {
      return badRequest(res, '不能修改管理员角色的权限')
    }
    
    model.updateRolePermissions(roleCode, permissionCodes)
    return success(res, null, '权限更新成功')
  } catch (error) {
    console.error('更新角色权限失败:', error)
    return serverError(res, '更新角色权限失败')
  }
}

// ==================== 系统设置 ====================

/**
 * 获取系统设置
 */
export async function getSystemSettings(req, res) {
  try {
    const { category } = req.query
    const settings = model.getSystemSettings(category)
    return success(res, settings)
  } catch (error) {
    console.error('获取系统设置失败:', error)
    return serverError(res, '获取系统设置失败')
  }
}

/**
 * 更新系统设置
 */
export async function updateSystemSettings(req, res) {
  try {
    const settings = req.body
    
    if (!settings || Object.keys(settings).length === 0) {
      return badRequest(res, '没有需要更新的设置')
    }
    
    model.updateSystemSettings(settings)
    return success(res, null, '设置保存成功')
  } catch (error) {
    console.error('更新系统设置失败:', error)
    return serverError(res, '更新系统设置失败')
  }
}

/**
 * 获取安全设置
 */
export async function getSecuritySettings(req, res) {
  try {
    const settings = model.getSecuritySettings()
    return success(res, settings)
  } catch (error) {
    console.error('获取安全设置失败:', error)
    return serverError(res, '获取安全设置失败')
  }
}

/**
 * 更新安全设置
 */
export async function updateSecuritySettings(req, res) {
  try {
    const settings = req.body
    
    if (!settings || Object.keys(settings).length === 0) {
      return badRequest(res, '没有需要更新的设置')
    }
    
    model.updateSecuritySettings(settings)
    return success(res, null, '安全设置保存成功')
  } catch (error) {
    console.error('更新安全设置失败:', error)
    return serverError(res, '更新安全设置失败')
  }
}

// ==================== 登录日志 ====================

/**
 * 获取登录日志
 */
export async function getLoginLogs(req, res) {
  try {
    const { userId, username, result, startDate, endDate, page, pageSize } = req.query
    
    const logs = model.getLoginLogs({
      userId,
      username,
      result,
      startDate,
      endDate,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 20
    })
    
    return successWithPagination(res, logs.list, {
      total: logs.total,
      page: logs.page,
      pageSize: logs.pageSize
    })
  } catch (error) {
    console.error('获取登录日志失败:', error)
    return serverError(res, '获取登录日志失败')
  }
}

// ==================== 兼容旧API ====================

/**
 * 获取系统设置（兼容旧API，支持key参数）
 */
export async function getSystemSettingsByKey(req, res) {
  try {
    const { key } = req.query
    const settings = model.getSystemSettingsByKey(key)
    return success(res, settings)
  } catch (error) {
    console.error('获取系统设置失败:', error)
    return serverError(res, '获取系统设置失败')
  }
}

/**
 * 保存单个系统设置（兼容旧API）
 */
export async function saveSystemSetting(req, res) {
  try {
    const { key, value, type, description } = req.body
    
    if (!key) {
      return badRequest(res, '设置键名是必填项')
    }
    
    model.saveSystemSetting(key, value, type, description)
    return success(res, null, '保存成功')
  } catch (error) {
    console.error('保存系统设置失败:', error)
    return serverError(res, '保存系统设置失败')
  }
}

/**
 * 批量保存系统设置（兼容旧API）
 */
export async function saveSystemSettingsBatch(req, res) {
  try {
    const { settings } = req.body
    
    if (!settings || !Array.isArray(settings)) {
      return badRequest(res, '无效的设置数据')
    }
    
    model.saveSystemSettingsBatch(settings)
    return success(res, null, '批量保存成功')
  } catch (error) {
    console.error('批量保存系统设置失败:', error)
    return serverError(res, '批量保存系统设置失败')
  }
}

