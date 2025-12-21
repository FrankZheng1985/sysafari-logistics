/**
 * Auth0 认证中间件
 * 验证 Auth0 JWT Token 并获取用户权限
 * 包含团队归属和权限委托检查功能
 */

import { auth } from 'express-oauth2-jwt-bearer'
import { getDatabase } from '../config/database.js'

// Auth0 配置
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'dev-w345wcc1mgybuopm.us.auth0.com'
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://sysafari-logistics-api'

// Auth0 JWT 验证中间件
const jwtCheck = auth({
  audience: AUTH0_AUDIENCE,
  issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
})

// 角色层级定义（数字越小权限越高）
const ROLE_LEVELS = {
  admin: 1,
  boss: 2,
  manager: 3,
  finance_director: 3,
  doc_clerk: 4,
  doc_officer: 4,
  finance_assistant: 4,
  operator: 4,
  viewer: 5
}

/**
 * 基础认证中间件
 * 验证 Auth0 JWT Token
 */
export function authenticate(req, res, next) {
  // 开发模式下允许无认证访问（可选）
  if (process.env.NODE_ENV === 'development' && !req.headers.authorization) {
    req.user = {
      id: 1,
      auth0Id: 'dev-user',
      username: 'admin',
      name: '开发管理员',
      role: 'admin',
      roleLevel: 1,
      canManageTeam: true,
      canApprove: true,
      permissions: ['*']
    }
    return next()
  }

  // 使用 Auth0 JWT 验证
  jwtCheck(req, res, async (err) => {
    if (err) {
      console.error('JWT 验证失败:', err.message)
      return res.status(401).json({
        errCode: 401,
        msg: '认证失败：' + (err.message || 'Token 无效'),
        data: null
      })
    }

    try {
      // 从 Token 中获取 Auth0 用户 ID
      const auth0Id = req.auth?.payload?.sub
      
      if (!auth0Id) {
        return res.status(401).json({
          errCode: 401,
          msg: '无法获取用户身份',
          data: null
        })
      }

      // 从数据库查询用户（通过 auth0_id）
      const db = getDatabase()
      const userResult = await db.prepare(`
        SELECT u.*, r.role_name, r.role_level, r.can_manage_team, r.can_approve
        FROM users u 
        LEFT JOIN roles r ON u.role = r.role_code
        WHERE u.auth0_id = $1 AND u.status = 'active'
      `).get(auth0Id)

      console.log('Auth0 ID:', auth0Id, '查询结果:', userResult ? '找到用户' : '未找到')

      if (userResult) {
        // 获取用户权限
        const permissionsResult = await db.prepare(`
          SELECT permission_code FROM role_permissions 
          WHERE role_code = $1
        `).all(userResult.role)

        const permissions = Array.isArray(permissionsResult) 
          ? permissionsResult.map(p => p.permission_code)
          : []

        req.user = {
          id: userResult.id,
          auth0Id: auth0Id,
          username: userResult.username,
          name: userResult.name,
          email: userResult.email,
          phone: userResult.phone,
          role: userResult.role,
          roleName: userResult.role_name,
          roleLevel: userResult.role_level || ROLE_LEVELS[userResult.role] || 4,
          canManageTeam: userResult.can_manage_team || false,
          canApprove: userResult.can_approve || false,
          supervisorId: userResult.supervisor_id,
          department: userResult.department,
          position: userResult.position,
          permissions: permissions
        }
      } else {
        // 用户不在数据库中，使用 Token 中的基本信息
        req.user = {
          id: null,
          auth0Id: auth0Id,
          username: req.auth?.payload?.email || 'unknown',
          name: req.auth?.payload?.name || '新用户',
          email: req.auth?.payload?.email || '',
          role: 'operator',
          roleName: '操作员',
          roleLevel: 4,
          canManageTeam: false,
          canApprove: false,
          permissions: []
        }
      }

      next()
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return res.status(500).json({
        errCode: 500,
        msg: '服务器错误',
        data: null
      })
    }
  })
}

/**
 * 权限检查中间件
 * @param {string|Array<string>} requiredPermissions - 需要的权限代码
 */
export function authorize(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        errCode: 401,
        msg: '请先登录',
        data: null
      })
    }

    // 管理员拥有所有权限
    if (req.user.role === 'admin') {
      return next()
    }

    const permissions = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions]

    // 检查是否有任一所需权限
    const hasPermission = permissions.some(p => 
      req.user.permissions && req.user.permissions.includes(p)
    )

    if (!hasPermission) {
      return res.status(403).json({
        errCode: 403,
        msg: '没有访问权限',
        data: null
      })
    }

    next()
  }
}

/**
 * 角色检查中间件
 * @param {string|Array<string>} allowedRoles - 允许的角色
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        errCode: 401,
        msg: '请先登录',
        data: null
      })
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        errCode: 403,
        msg: '角色权限不足',
        data: null
      })
    }

    next()
  }
}

/**
 * 可选认证中间件
 * 如果有认证信息则验证，没有也继续
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return next()
  }

  // 尝试验证
  authenticate(req, res, () => {
    // 即使验证失败也继续
    next()
  })
}

/**
 * 要求团队管理权限的中间件
 * 只允许具有 can_manage_team 权限的用户访问
 */
export function requireTeamManager(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      errCode: 401,
      msg: '请先登录',
      data: null
    })
  }

  // 管理员和老板总是有权限
  if (['admin', 'boss'].includes(req.user.role)) {
    return next()
  }

  if (!req.user.canManageTeam) {
    return res.status(403).json({
      errCode: 403,
      msg: '您没有团队管理权限',
      data: null
    })
  }

  next()
}

/**
 * 要求审批权限的中间件
 * 只允许具有 can_approve 权限的用户访问
 */
export function requireApprover(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      errCode: 401,
      msg: '请先登录',
      data: null
    })
  }

  // 管理员总是有权限
  if (req.user.role === 'admin') {
    return next()
  }

  if (!req.user.canApprove) {
    return res.status(403).json({
      errCode: 403,
      msg: '您没有审批权限',
      data: null
    })
  }

  next()
}

// ==================== 团队归属检查函数 ====================

/**
 * 检查用户是否可以管理另一个用户
 * 基于团队归属关系（直属上级）
 * @param {number} managerId 管理者ID
 * @param {number} targetUserId 目标用户ID
 * @returns {Promise<boolean>} 是否有权限
 */
export async function canManageUser(managerId, targetUserId) {
  const db = getDatabase()
  
  // 同一用户
  if (managerId === targetUserId) {
    return false // 不能管理自己
  }
  
  // 获取管理者信息
  const manager = await db.prepare(`
    SELECT u.*, r.role_level, r.can_manage_team
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.id = ?
  `).get(managerId)
  
  if (!manager) return false
  
  // 管理员可以管理所有人
  if (manager.role === 'admin') return true
  
  // 没有团队管理权限
  if (!manager.can_manage_team) return false
  
  // 获取目标用户信息
  const targetUser = await db.prepare(`
    SELECT u.*, r.role_level
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.id = ?
  `).get(targetUserId)
  
  if (!targetUser) return false
  
  // 检查是否是直属下属
  if (targetUser.supervisor_id === managerId) {
    return true
  }
  
  // 检查角色层级（只能管理比自己层级低的）
  const managerLevel = manager.role_level || ROLE_LEVELS[manager.role] || 4
  const targetLevel = targetUser.role_level || ROLE_LEVELS[targetUser.role] || 4
  
  if (managerLevel >= targetLevel) {
    return false // 不能管理同级或更高级别的人
  }
  
  // 老板可以管理所有非admin用户
  if (manager.role === 'boss' && targetUser.role !== 'admin') {
    return true
  }
  
  return false
}

/**
 * 获取用户的直属团队成员
 * @param {number} supervisorId 上级ID
 * @returns {Promise<Array>} 团队成员列表
 */
export async function getTeamMembers(supervisorId) {
  const db = getDatabase()
  
  const members = await db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.role, u.department, u.status,
           r.role_name, r.role_level
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.supervisor_id = ? AND u.status = 'active'
    ORDER BY u.name
  `).all(supervisorId)
  
  return members
}

/**
 * 获取用户的上级链（层级结构）
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 上级链列表（从直接上级到最高层）
 */
export async function getUserHierarchy(userId) {
  const db = getDatabase()
  const hierarchy = []
  let currentUserId = userId
  const visited = new Set()
  
  while (currentUserId) {
    // 防止循环引用
    if (visited.has(currentUserId)) break
    visited.add(currentUserId)
    
    const user = await db.prepare(`
      SELECT u.id, u.name, u.role, u.supervisor_id, r.role_name, r.role_level
      FROM users u
      LEFT JOIN roles r ON u.role = r.role_code
      WHERE u.id = ?
    `).get(currentUserId)
    
    if (!user) break
    
    if (user.id !== userId) {
      hierarchy.push({
        id: user.id,
        name: user.name,
        role: user.role,
        roleName: user.role_name,
        roleLevel: user.role_level
      })
    }
    
    currentUserId = user.supervisor_id
  }
  
  return hierarchy
}

// ==================== 权限委托检查函数 ====================

/**
 * 检查用户是否可以授予某个权限
 * 只能授予自己已有的权限子集
 * @param {number} granterId 授权者ID
 * @param {string} permissionCode 权限代码
 * @returns {Promise<boolean>} 是否可以授予
 */
export async function canGrantPermission(granterId, permissionCode) {
  const db = getDatabase()
  
  // 获取授权者信息
  const granter = await db.prepare(`
    SELECT u.*, r.role_level, r.can_manage_team
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.id = ?
  `).get(granterId)
  
  if (!granter) return false
  
  // 管理员可以授予所有权限
  if (granter.role === 'admin') return true
  
  // 没有团队管理权限
  if (!granter.can_manage_team) return false
  
  // 检查是否拥有该权限
  const hasPermission = await db.prepare(`
    SELECT 1 FROM role_permissions
    WHERE role_code = ? AND permission_code = ?
  `).get(granter.role, permissionCode)
  
  if (!hasPermission) return false
  
  // 检查是否为敏感权限
  const permission = await db.prepare(`
    SELECT is_sensitive FROM permissions WHERE permission_code = ?
  `).get(permissionCode)
  
  // 敏感权限需要更高级别才能授予
  if (permission?.is_sensitive) {
    // 只有 admin 和 boss 可以授予敏感权限
    if (!['admin', 'boss'].includes(granter.role)) {
      return false
    }
  }
  
  return true
}

/**
 * 获取用户可以授予的权限列表
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 可授予的权限列表
 */
export async function getGrantablePermissions(userId) {
  const db = getDatabase()
  
  const user = await db.prepare(`
    SELECT u.*, r.can_manage_team
    FROM users u
    LEFT JOIN roles r ON u.role = r.role_code
    WHERE u.id = ?
  `).get(userId)
  
  if (!user) return []
  
  // 管理员可以授予所有权限
  if (user.role === 'admin') {
    const allPermissions = await db.prepare(`
      SELECT permission_code, permission_name, category, is_sensitive
      FROM permissions
      ORDER BY sort_order
    `).all()
    return allPermissions
  }
  
  // 没有团队管理权限，不能授予任何权限
  if (!user.can_manage_team) return []
  
  // 获取用户自己的权限（排除敏感权限，除非是boss）
  let query = `
    SELECT p.permission_code, p.permission_name, p.category, p.is_sensitive
    FROM permissions p
    JOIN role_permissions rp ON p.permission_code = rp.permission_code
    WHERE rp.role_code = ?
  `
  
  // 非boss用户不能授予敏感权限
  if (user.role !== 'boss') {
    query += ' AND (p.is_sensitive = FALSE OR p.is_sensitive IS NULL)'
  }
  
  query += ' ORDER BY p.sort_order'
  
  const permissions = await db.prepare(query).all(user.role)
  return permissions
}

/**
 * 检查操作是否需要审批
 * @param {string} operationType 操作类型
 * @param {Object} context 上下文（如金额等）
 * @returns {Promise<boolean>} 是否需要审批
 */
export async function checkRequiresApproval(operationType, context = {}) {
  const db = getDatabase()
  
  // 检查敏感操作配置
  const operation = await db.prepare(`
    SELECT * FROM sensitive_operations
    WHERE operation_code = ? AND is_active = TRUE AND requires_approval = TRUE
  `).get(operationType)
  
  if (!operation) return false
  
  // 特殊处理：财务操作检查金额阈值
  if (operationType.startsWith('FINANCE_') && context.amount !== undefined) {
    const config = await db.prepare(`
      SELECT config_value FROM approval_configs
      WHERE config_key = 'finance_approval_threshold'
    `).get()
    
    const threshold = config ? Number(config.config_value) : 10000
    if (context.amount < threshold) {
      return false
    }
  }
  
  return true
}

// CommonJS 兼容导出
export default {
  authenticate,
  authorize,
  requireRole,
  optionalAuth,
  requireTeamManager,
  requireApprover,
  canManageUser,
  getTeamMembers,
  getUserHierarchy,
  canGrantPermission,
  getGrantablePermissions,
  checkRequiresApproval,
  ROLE_LEVELS
}
