/**
 * 认证中间件
 */

const { getDatabase } = require('../config/database')
const { unauthorized, forbidden } = require('../utils/response')

/**
 * 基础认证中间件
 * 验证用户是否已登录
 */
function authenticate(req, res, next) {
  // 从请求头获取认证信息
  const authHeader = req.headers.authorization
  
  if (!authHeader) {
    // 开发模式下允许无认证访问
    if (process.env.NODE_ENV === 'development') {
      req.user = {
        id: 1,
        username: 'admin',
        name: '管理员',
        role: 'admin'
      }
      return next()
    }
    return unauthorized(res, '请先登录')
  }
  
  try {
    // 简单的 Bearer Token 验证
    const token = authHeader.replace('Bearer ', '')
    
    // TODO: 实现真正的 JWT 验证
    // 目前使用简单的 token 验证
    const db = getDatabase()
    const user = db.prepare(`
      SELECT u.*, r.role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role = r.role_code
      WHERE u.id = ? AND u.status = 'active'
    `).get(token)
    
    if (!user) {
      return unauthorized(res, 'Token无效或已过期')
    }
    
    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      roleName: user.role_name
    }
    
    next()
  } catch (error) {
    console.error('认证失败:', error)
    return unauthorized(res, '认证失败')
  }
}

/**
 * 权限检查中间件
 * @param {string|Array<string>} requiredPermissions - 需要的权限代码
 */
function authorize(requiredPermissions) {
  return (req, res, next) => {
    // 开发模式下跳过权限检查
    if (process.env.NODE_ENV === 'development') {
      return next()
    }
    
    if (!req.user) {
      return unauthorized(res, '请先登录')
    }
    
    // 管理员拥有所有权限
    if (req.user.role === 'admin') {
      return next()
    }
    
    const db = getDatabase()
    const permissions = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions]
    
    // 查询用户权限
    const userPermissions = db.prepare(`
      SELECT permission_code FROM role_permissions 
      WHERE role_code = ?
    `).all(req.user.role).map(p => p.permission_code)
    
    // 检查是否有任一所需权限
    const hasPermission = permissions.some(p => userPermissions.includes(p))
    
    if (!hasPermission) {
      return forbidden(res, '没有访问权限')
    }
    
    next()
  }
}

/**
 * 角色检查中间件
 * @param {string|Array<string>} allowedRoles - 允许的角色
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, '请先登录')
    }
    
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
    
    if (!roles.includes(req.user.role)) {
      return forbidden(res, '角色权限不足')
    }
    
    next()
  }
}

/**
 * 可选认证中间件
 * 如果有认证信息则验证，没有也继续
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader) {
    return next()
  }
  
  // 尝试验证
  authenticate(req, res, (err) => {
    // 即使验证失败也继续
    next()
  })
}

module.exports = {
  authenticate,
  authorize,
  requireRole,
  optionalAuth
}

