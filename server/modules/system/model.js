/**
 * 系统管理模块 - 数据模型
 * 包含：用户管理、角色管理、权限管理、系统设置
 */

import { getDatabase, generateId } from '../../config/database.js'
import crypto from 'crypto'

// ==================== 用户管理 ====================

/**
 * 获取用户列表
 */
export async function getUsers(params = {}) {
  const db = getDatabase()
  const { role, status, search, userType, page = 1, pageSize = 20 } = params
  
  let query = `
    SELECT u.*, r.role_name
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE 1=1
  `
  const queryParams = []
  
  if (role) {
    query += ' AND u.role = ?'
    queryParams.push(role)
  }
  
  if (status) {
    query += ' AND u.status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (u.username LIKE ? OR u.name LIKE ? OR u.email LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 根据用户类型过滤（演示环境只显示演示用户）
  if (userType) {
    query += ' AND u.user_type = ?'
    queryParams.push(userType)
  }
  
  // 获取总数
  const countQuery = query.replace(/SELECT u\.\*, r\.role_name/, 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY u.id ASC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertUserToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取用户
 */
export async function getUserById(id) {
  const db = getDatabase()
  const user = await db.prepare(`
    SELECT u.*, r.role_name
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.id = ?
  `).get(id)
  
  return user ? convertUserToCamelCase(user) : null
}

/**
 * 根据用户名获取用户
 */
export async function getUserByUsername(username) {
  const db = getDatabase()
  const user = await db.prepare(`
    SELECT u.*, r.role_name
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.username = ?
  `).get(username)
  
  return user ? convertUserToCamelCase(user) : null
}

/**
 * 创建用户
 */
export async function createUser(data) {
  const db = getDatabase()
  
  // 密码加密
  const passwordHash = hashPassword(data.password)
  
  const result = await db.prepare(`
    INSERT INTO users (
      username, password_hash, name, email, phone,
      avatar, role, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    data.username,
    passwordHash,
    data.name,
    data.email || '',
    data.phone || '',
    data.avatar || '',
    data.role || 'operator',
    data.status || 'active'
  )
  
  return { id: result.lastInsertRowid }
}

/**
 * 更新用户
 */
export async function updateUser(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  if (data.name !== undefined) {
    fields.push('name = ?')
    values.push(data.name)
  }
  if (data.email !== undefined) {
    fields.push('email = ?')
    values.push(data.email)
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?')
    values.push(data.phone)
  }
  if (data.avatar !== undefined) {
    fields.push('avatar = ?')
    values.push(data.avatar)
  }
  if (data.role !== undefined) {
    fields.push('role = ?')
    values.push(data.role)
  }
  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 更新用户状态
 */
export async function updateUserStatus(id, status) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?
  `).run(status, id)
  
  return result.changes > 0
}

/**
 * 修改密码
 */
export async function changePassword(id, newPassword) {
  const db = getDatabase()
  const passwordHash = hashPassword(newPassword)
  
  const result = await db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?
  `).run(passwordHash, id)
  
  return result.changes > 0
}

/**
 * 验证密码
 */
export async function verifyPassword(user, password) {
  const passwordHash = hashPassword(password)
  return user.passwordHash === passwordHash
}

/**
 * 删除用户
 */
export async function deleteUser(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM users WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 更新登录信息
 */
export async function updateLoginInfo(id, ip) {
  const db = getDatabase()
  // 生成当前时间字符串 YYYY-MM-DD HH:MM:SS
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  
  await db.prepare(`
    UPDATE users 
    SET last_login_time = ?,
        last_login_ip = ?,
        login_count = COALESCE(login_count, 0) + 1
    WHERE id = ?
  `).run(now, ip, id)
}

/**
 * 增加登录失败次数（使用login_attempts表）
 */
export async function incrementLoginAttempts(username, ip = '', reason = '') {
  const db = getDatabase()
  
  // 检查login_attempts表是否存在
  try {
    await db.prepare(`
      INSERT INTO login_attempts (username, ip_address, success, failure_reason)
      VALUES (?, ?, 0, ?)
    `).run(username, ip, reason)
  } catch (error) {
    console.error('记录登录失败次数失败:', error.message)
  }
}

/**
 * 获取最近登录失败次数
 */
export async function getRecentFailedAttempts(username, minutes = 15) {
  const db = getDatabase()
  
  try {
    const result = await db.prepare(`
      SELECT COUNT(*) as count FROM login_attempts 
      WHERE username = ? AND success = 0 
      AND attempt_time > NOW() - INTERVAL '${minutes} minutes'
    `).get(username)
    return result?.count || 0
  } catch (error) {
    console.error('获取登录失败次数失败:', error.message)
    return 0
  }
}

/**
 * 检查用户是否被锁定（基于最近失败次数）
 */
export async function isUserLocked(username, maxAttempts = 5, lockoutMinutes = 15) {
  const failedCount = await getRecentFailedAttempts(username, lockoutMinutes)
  return failedCount >= maxAttempts
}

// ==================== 角色管理 ====================

/**
 * 获取角色列表
 */
export async function getRoles(params = {}) {
  const db = getDatabase()
  const { status, search } = params
  
  let query = 'SELECT * FROM roles WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (role_name LIKE ? OR role_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  query += ' ORDER BY id ASC'
  
  const list = await db.prepare(query).all(...queryParams)
  return list.map(convertRoleToCamelCase)
}

/**
 * 根据角色代码获取角色
 */
export async function getRoleByCode(roleCode) {
  const db = getDatabase()
  const role = await db.prepare('SELECT * FROM roles WHERE role_code = ?').get(roleCode)
  return role ? convertRoleToCamelCase(role) : null
}

/**
 * 创建角色
 */
export async function createRole(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO roles (role_code, role_name, description, color_code, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    data.roleCode,
    data.roleName,
    data.description || '',
    data.colorCode || 'blue',
    data.status || 'active'
  )
  
  return { id: result.lastInsertRowid }
}

/**
 * 更新角色
 */
export async function updateRole(roleCode, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  if (data.roleName !== undefined) {
    fields.push('role_name = ?')
    values.push(data.roleName)
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description)
  }
  if (data.colorCode !== undefined) {
    fields.push('color_code = ?')
    values.push(data.colorCode)
  }
  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(roleCode)
  
  const result = await db.prepare(`UPDATE roles SET ${fields.join(', ')} WHERE role_code = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除角色
 */
export async function deleteRole(roleCode) {
  const db = getDatabase()
  
  // 检查是否有用户使用此角色
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(roleCode)
  if (userCount.count > 0) {
    throw new Error('该角色下还有用户，无法删除')
  }
  
  // 删除角色权限
  await db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode)
  
  // 删除角色
  const result = await db.prepare('DELETE FROM roles WHERE role_code = ?').run(roleCode)
  return result.changes > 0
}

// ==================== 权限管理 ====================

/**
 * 获取所有权限
 */
export async function getPermissions() {
  const db = getDatabase()
  const permissions = await db.prepare('SELECT * FROM permissions ORDER BY module, sort_order').all()
  
  // 按模块分组
  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.module]) {
      acc[p.module] = []
    }
    acc[p.module].push(convertPermissionToCamelCase(p))
    return acc
  }, {})
  
  return {
    list: permissions.map(convertPermissionToCamelCase),
    grouped
  }
}

/**
 * 获取角色权限
 */
export async function getRolePermissions(roleCode) {
  const db = getDatabase()
  const permissions = await db.prepare(`
    SELECT p.* FROM permissions p
    INNER JOIN role_permissions rp ON p.permission_code = rp.permission_code
    WHERE rp.role_code = ?
    ORDER BY p.module, p.sort_order
  `).all(roleCode)
  
  return permissions.map(convertPermissionToCamelCase)
}

/**
 * 更新角色权限
 */
export async function updateRolePermissions(roleCode, permissionCodes) {
  const db = getDatabase()
  
  // 删除现有权限
  await db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode)
  
  // 添加新权限
  const insertStmt = await db.prepare('INSERT INTO role_permissions (role_code, permission_code) VALUES (?, ?)')
  for (const permCode of permissionCodes) {
    await insertStmt.run(roleCode, permCode)
  }
  
  return true
}

/**
 * 检查用户是否有权限
 */
export async function hasPermission(userId, permissionCode) {
  const db = getDatabase()
  
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId)
  if (!user) return false
  
  // 管理员有所有权限
  if (user.role === 'admin') return true
  
  const permission = await db.prepare(`
    SELECT 1 FROM role_permissions 
    WHERE role_code = ? AND permission_code = ?
  `).get(user.role, permissionCode)
  
  return !!permission
}

// ==================== 系统设置 ====================

/**
 * 获取系统设置
 */
export async function getSystemSettings(category = null) {
  const db = getDatabase()
  
  let query = 'SELECT * FROM system_settings WHERE 1=1'
  const params = []
  
  if (category) {
    query += ' AND setting_key LIKE ?'
    params.push(`${category}%`)
  }
  
  query += ' ORDER BY setting_key'
  
  const settings = await db.prepare(query).all(...params)
  
  // 转换为键值对
  const result = {}
  settings.forEach(s => {
    let value = s.setting_value
    // 根据类型转换值
    if (s.setting_type === 'number') {
      value = Number(value)
    } else if (s.setting_type === 'boolean') {
      value = value === 'true' || value === '1'
    } else if (s.setting_type === 'json') {
      try {
        value = JSON.parse(value)
      } catch (e) {
        // 保持原值
      }
    }
    result[s.setting_key] = value
  })
  
  return result
}

/**
 * 更新系统设置
 */
export async function updateSystemSettings(settings) {
  const db = getDatabase()
  
  const upsertStmt = await db.prepare(`
    INSERT INTO system_settings (setting_key, setting_value, updated_at)
    VALUES (?, ?, NOW())
    ON CONFLICT(setting_key) DO UPDATE SET 
      setting_value = excluded.setting_value,
      updated_at = NOW()
  `)
  
  for (const [key, value] of Object.entries(settings)) {
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    await upsertStmt.run(key, strValue)
  }
  
  return true
}

/**
 * 获取安全设置
 */
export async function getSecuritySettings() {
  const db = getDatabase()
  
  const settings = await db.prepare('SELECT * FROM security_settings').all()
  
  const result = {}
  settings.forEach(s => {
    let value = s.setting_value
    if (s.setting_type === 'number') {
      value = Number(value)
    } else if (s.setting_type === 'boolean') {
      value = value === 'true' || value === '1'
    }
    result[s.setting_key] = value
  })
  
  return result
}

/**
 * 更新安全设置
 */
export async function updateSecuritySettings(settings) {
  const db = getDatabase()
  
  const updateStmt = await db.prepare(`
    UPDATE security_settings 
    SET setting_value = ?, updated_at = NOW()
    WHERE setting_key = ?
  `)
  
  for (const [key, value] of Object.entries(settings)) {
    await updateStmt.run(String(value), key)
  }
  
  return true
}

// ==================== 登录日志 ====================

/**
 * 记录登录日志
 */
export async function addLoginLog(data) {
  const db = getDatabase()
  
  try {
    await db.prepare(`
      INSERT INTO login_logs (
        user_id, username, login_time, ip_address,
        user_agent, status, failure_reason
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?)
    `).run(
      data.userId || null,
      data.username,
      data.loginIp || '',
      data.userAgent || '',
      data.loginResult || 'success',
      data.failReason || null
    )
  } catch (error) {
    console.error('记录登录日志失败:', error.message)
  }
}

/**
 * 获取登录日志
 */
export async function getLoginLogs(params = {}) {
  const db = getDatabase()
  const { userId, username, result, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM login_logs WHERE 1=1'
  const queryParams = []
  
  if (userId) {
    query += ' AND user_id = ?'
    queryParams.push(userId)
  }
  
  if (username) {
    query += ' AND username LIKE ?'
    queryParams.push(`%${username}%`)
  }
  
  if (result) {
    query += ' AND status = ?'
    queryParams.push(result)
  }
  
  if (startDate) {
    query += ' AND login_time >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND login_time <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY login_time DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertLoginLogToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

// ==================== 工具函数 ====================

/**
 * 密码哈希（与原系统保持一致）
 */
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'sysafari_salt').digest('hex')
}

/**
 * 生成随机验证码
 */
export function generateVerificationCode(length = 6) {
  const chars = '0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// ==================== 数据转换函数 ====================

export function convertUserToCamelCase(row) {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar,
    role: row.role,
    roleName: row.role_name,
    status: row.status,
    lastLoginTime: row.last_login_time,
    lastLoginIp: row.last_login_ip,
    loginCount: row.login_count,
    createTime: row.created_at,
    updateTime: row.updated_at,
    userType: row.user_type || 'normal'  // 用户类型：test=演示用户, normal=正式用户
  }
}

export function convertRoleToCamelCase(row) {
  return {
    id: row.id,
    roleCode: row.role_code,
    roleName: row.role_name,
    description: row.description,
    colorCode: row.color_code,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertPermissionToCamelCase(row) {
  return {
    permissionCode: row.permission_code,
    permissionName: row.permission_name,
    module: row.module,
    category: row.category,
    description: row.description,
    sortOrder: row.sort_order
  }
}

export function convertLoginLogToCamelCase(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    loginTime: row.login_time,
    logoutTime: row.logout_time,
    loginIp: row.ip_address,
    userAgent: row.user_agent,
    deviceInfo: row.device_info,
    location: row.location,
    loginResult: row.status,
    failReason: row.failure_reason
  }
}

// ==================== 兼容旧API的函数 ====================

/**
 * 根据key获取系统设置（兼容旧API）
 */
export async function getSystemSettingsByKey(key = null) {
  const db = getDatabase()
  
  let query = 'SELECT * FROM system_settings'
  const params = []
  
  if (key) {
    query += ' WHERE setting_key = ?'
    params.push(key)
  }
  
  const settings = await db.prepare(query).all(...params)
  
  // 转换为键值对格式
  const settingsMap = {}
  settings.forEach(s => {
    let value = s.setting_value
    if (s.setting_type === 'json') {
      try {
        value = JSON.parse(s.setting_value)
      } catch (e) {
        // 解析失败，保持原值
      }
    } else if (s.setting_type === 'number') {
      value = Number(s.setting_value)
    } else if (s.setting_type === 'boolean') {
      value = s.setting_value === 'true'
    }
    settingsMap[s.setting_key] = value
  })
  
  return settingsMap
}

/**
 * 保存单个系统设置（兼容旧API）
 */
export async function saveSystemSetting(key, value, type, description) {
  const db = getDatabase()
  
  // 将值转换为字符串存储
  let stringValue = value
  let settingType = type || 'string'
  if (typeof value === 'object') {
    stringValue = JSON.stringify(value)
    settingType = 'json'
  } else if (typeof value === 'boolean') {
    stringValue = value.toString()
    settingType = 'boolean'
  } else if (typeof value === 'number') {
    stringValue = value.toString()
    settingType = 'number'
  }
  
  await db.prepare(`
    INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
    VALUES (?, ?, ?, ?, NOW())
  `).run(key, stringValue, settingType, description || '')
}

/**
 * 批量保存系统设置（兼容旧API）
 */
export async function saveSystemSettingsBatch(settings) {
  const db = getDatabase()
  
  const upsertStmt = await db.prepare(`
    INSERT OR REPLACE INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
    VALUES (?, ?, ?, ?, NOW())
  `)
  
  for (const { key, value, type, description } of settings) {
    let stringValue = value
    let settingType = type || 'string'
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value)
      settingType = 'json'
    } else if (typeof value === 'boolean') {
      stringValue = value.toString()
      settingType = 'boolean'
    } else if (typeof value === 'number') {
      stringValue = value.toString()
      settingType = 'number'
    }
    await upsertStmt.run(key, stringValue, settingType, description || '')
  }
}

export default {
  // 用户管理
  getUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  updateUserStatus,
  changePassword,
  verifyPassword,
  deleteUser,
  updateLoginInfo,
  incrementLoginAttempts,
  getRecentFailedAttempts,
  isUserLocked,
  
  // 角色管理
  getRoles,
  getRoleByCode,
  createRole,
  updateRole,
  deleteRole,
  
  // 权限管理
  getPermissions,
  getRolePermissions,
  updateRolePermissions,
  hasPermission,
  
  // 系统设置
  getSystemSettings,
  updateSystemSettings,
  getSecuritySettings,
  updateSecuritySettings,
  
  // 兼容旧API
  getSystemSettingsByKey,
  saveSystemSetting,
  saveSystemSettingsBatch,
  
  // 登录日志
  addLoginLog,
  getLoginLogs,
  
  // 工具函数
  hashPassword,
  generateVerificationCode,
  
  // 转换函数
  convertUserToCamelCase,
  convertRoleToCamelCase,
  convertPermissionToCamelCase,
  convertLoginLogToCamelCase
}

