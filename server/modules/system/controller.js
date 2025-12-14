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
    
    // 返回用户信息
    const { passwordHash, password_hash, ...safeUser } = user
    
    // 获取用户权限
    const permissions = model.getRolePermissions(user.role)
    const permissionCodes = permissions.map(p => p.permissionCode || p.permission_code)
    
    // 判断是否是测试用户
    const isTestUser = user.user_type === 'test'
    
    return success(res, {
      user: {
        ...safeUser,
        userType: user.user_type || 'normal'
      },
      permissions: permissionCodes,
      isTestMode: isTestUser,
      token: String(user.id)
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

/**
 * Auth0 用户信息接口
 * 前端通过 Auth0 登录后调用此接口获取本地用户信息和权限
 */
export async function getAuth0Profile(req, res) {
  try {
    // req.user 由 Auth0 中间件设置
    if (!req.user) {
      return unauthorized(res, '未认证')
    }

    // 如果用户已在本地数据库中
    if (req.user.id) {
      const permissions = req.user.permissions || []
      
      return success(res, {
        user: {
          id: req.user.id,
          auth0Id: req.user.auth0Id,
          username: req.user.username,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          roleName: req.user.roleName,
          status: 'active'
        },
        permissions: permissions
      })
    }

    // 用户不在本地数据库中
    const db = getDatabase()
    
    // 检查是否是第一个用户（系统初始化）
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get()
    
    if (userCount && userCount.count === 0) {
      // 系统中没有用户，自动创建管理员账号并绑定
      console.log('🚀 系统初始化：为第一个 Auth0 用户创建管理员账号')
      
      try {
        // 生成随机密码（因为使用 Auth0 登录，不需要密码）
        const crypto = await import('crypto')
        const randomPassword = crypto.randomBytes(32).toString('hex')
        
        // 创建管理员用户
        const username = req.user.email?.split('@')[0] || 'admin'
        const result = await db.prepare(`
          INSERT INTO users (username, name, email, role, password_hash, auth0_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, 'admin', $4, $5, 'active', NOW(), NOW())
          RETURNING id
        `).get(
          username,
          req.user.name || '系统管理员',
          req.user.email || '',
          randomPassword,
          req.user.auth0Id
        )
        
        if (result && result.id) {
          console.log('✅ 管理员账号创建成功, ID:', result.id)
          
          // 获取管理员权限
          const permissions = await db.prepare(`
            SELECT permission_code
            FROM role_permissions
            WHERE role_code = 'admin'
          `).all()
          
          const permissionCodes = permissions.map(p => p.permission_code)
          
          return success(res, {
            user: {
              id: result.id,
              auth0Id: req.user.auth0Id,
              username: username,
              name: req.user.name || '系统管理员',
              email: req.user.email || '',
              role: 'admin',
              roleName: '管理员',
              status: 'active'
            },
            permissions: permissionCodes,
            message: '🎉 欢迎！已自动为您创建管理员账号'
          })
        }
      } catch (createError) {
        console.error('自动创建管理员失败:', createError)
        // 继续执行后续逻辑（记录到待绑定表）
      }
    }

    // 不是第一个用户，记录到待绑定表
    try {
      await db.prepare(`
        INSERT INTO auth0_pending_users (auth0_id, email, name, picture, last_login_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (auth0_id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          picture = EXCLUDED.picture,
          last_login_at = NOW()
      `).run(
        req.user.auth0Id,
        req.user.email || '',
        req.user.name || '新用户',
        req.user.picture || ''
      )
    } catch (dbError) {
      console.error('记录待绑定用户失败:', dbError)
    }

    // 返回基本信息
    return success(res, {
      user: {
        id: null,
        auth0Id: req.user.auth0Id,
        username: req.user.username || req.user.email,
        name: req.user.name || '新用户',
        email: req.user.email || '',
        role: 'operator',
        roleName: '操作员',
        status: 'pending'
      },
      permissions: [],
      message: '用户尚未在系统中注册，请联系管理员'
    })
  } catch (error) {
    console.error('获取 Auth0 用户信息失败:', error)
    return serverError(res, '获取用户信息失败')
  }
}

/**
 * 获取待绑定的 Auth0 用户列表
 */
export async function getPendingAuth0Users(req, res) {
  try {
    const db = getDatabase()
    const users = await db.prepare(`
      SELECT 
        p.id,
        p.auth0_id,
        p.email,
        p.name,
        p.picture,
        p.first_login_at,
        p.last_login_at,
        p.is_bound,
        p.bound_user_id,
        u.username as bound_username,
        u.name as bound_name
      FROM auth0_pending_users p
      LEFT JOIN users u ON p.bound_user_id = u.id
      ORDER BY p.last_login_at DESC
    `).all()

    return success(res, users)
  } catch (error) {
    console.error('获取待绑定用户列表失败:', error)
    return serverError(res, '获取待绑定用户列表失败')
  }
}

/**
 * 绑定 Auth0 用户到系统用户
 */
export async function bindAuth0User(req, res) {
  try {
    const { auth0Id, userId } = req.body

    if (!auth0Id || !userId) {
      return badRequest(res, 'auth0Id 和 userId 为必填项')
    }

    const db = getDatabase()

    // 检查系统用户是否存在
    const user = await db.prepare('SELECT id, username, name FROM users WHERE id = $1').get(userId)
    if (!user) {
      return notFound(res, '系统用户不存在')
    }

    // 检查该 Auth0 ID 是否已绑定其他用户
    const existingBind = await db.prepare('SELECT id, username FROM users WHERE auth0_id = $1').get(auth0Id)
    if (existingBind) {
      return badRequest(res, `该 Auth0 账号已绑定到用户: ${existingBind.username}`)
    }

    // 更新系统用户的 auth0_id
    await db.prepare('UPDATE users SET auth0_id = $1 WHERE id = $2').run(auth0Id, userId)

    // 更新待绑定表
    await db.prepare(`
      UPDATE auth0_pending_users 
      SET is_bound = TRUE, bound_user_id = $1 
      WHERE auth0_id = $2
    `).run(userId, auth0Id)

    return success(res, { message: '绑定成功', user })
  } catch (error) {
    console.error('绑定用户失败:', error)
    return serverError(res, '绑定用户失败')
  }
}

/**
 * 创建新用户并绑定 Auth0
 */
export async function createAndBindUser(req, res) {
  try {
    const { auth0Id, username, name, email, role } = req.body

    if (!auth0Id || !username || !name || !role) {
      return badRequest(res, '缺少必填字段')
    }

    const db = getDatabase()

    // 检查用户名是否已存在
    const existing = await db.prepare('SELECT id FROM users WHERE username = $1').get(username)
    if (existing) {
      return badRequest(res, '用户名已存在')
    }

    // 创建用户（密码设为随机值，因为使用 Auth0 登录）
    const randomPassword = Math.random().toString(36).slice(-12)
    const result = await db.prepare(`
      INSERT INTO users (username, name, email, role, password_hash, auth0_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
      RETURNING id, username, name, email, role
    `).get(username, name, email || '', role, randomPassword, auth0Id)

    // 更新待绑定表
    await db.prepare(`
      UPDATE auth0_pending_users 
      SET is_bound = TRUE, bound_user_id = $1 
      WHERE auth0_id = $2
    `).run(result.id, auth0Id)

    return success(res, { message: '创建并绑定成功', user: result })
  } catch (error) {
    console.error('创建并绑定用户失败:', error)
    return serverError(res, '创建并绑定用户失败')
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

