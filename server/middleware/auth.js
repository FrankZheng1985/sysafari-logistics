/**
 * Auth0 认证中间件
 * 验证 Auth0 JWT Token 并获取用户权限
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
        SELECT u.*, r.role_name 
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
          role: userResult.role,
          roleName: userResult.role_name,
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

// CommonJS 兼容导出
export default {
  authenticate,
  authorize,
  requireRole,
  optionalAuth
}
