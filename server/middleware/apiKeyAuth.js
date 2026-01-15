/**
 * API Key 认证中间件
 * 用于外部系统（如集团ERP）调用先锋物流API
 */

import { getDatabase } from '../config/database.js'
import crypto from 'crypto'

/**
 * API Key 认证中间件
 * 验证 Authorization: Bearer <api_key> 或 X-API-Key header
 */
export function apiKeyAuth(req, res, next) {
  // 获取 API Key
  let apiKey = null
  
  // 方式1: Authorization header (Bearer token)
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    // 检查是否像是API Key（以 'sk_' 或 'pk_' 开头）
    if (token.startsWith('sk_') || token.startsWith('pk_')) {
      apiKey = token
    }
  }
  
  // 方式2: X-API-Key header
  if (!apiKey && req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key']
  }
  
  // 方式3: 查询参数 (用于webhook等场景)
  if (!apiKey && req.query.api_key) {
    apiKey = req.query.api_key
  }
  
  if (!apiKey) {
    return res.status(401).json({
      errCode: 401,
      msg: '缺少API Key认证',
      data: null
    })
  }
  
  // 验证API Key
  validateApiKey(apiKey).then(result => {
    if (!result.valid) {
      return res.status(401).json({
        errCode: 401,
        msg: result.message || 'API Key无效',
        data: null
      })
    }
    
    // 将API Key信息附加到请求
    req.apiKeyInfo = result.keyInfo
    req.user = {
      id: result.keyInfo.userId || 0,
      username: result.keyInfo.name || 'api_user',
      name: result.keyInfo.name || 'API用户',
      role: 'api',
      permissions: result.keyInfo.permissions || ['read'],
      isApiRequest: true
    }
    
    // 记录API调用日志
    logApiCall(apiKey, req).catch(err => {
      console.error('记录API调用日志失败:', err)
    })
    
    next()
  }).catch(err => {
    console.error('API Key验证错误:', err)
    return res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  })
}

/**
 * 可选的 API Key 认证
 * 如果提供了API Key则验证，否则继续
 */
export function optionalApiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key
  
  if (!apiKey) {
    return next()
  }
  
  apiKeyAuth(req, res, next)
}

/**
 * 验证API Key
 */
async function validateApiKey(apiKey) {
  const db = getDatabase()
  
  // 哈希API Key进行比较（安全存储）
  const keyHash = hashApiKey(apiKey)
  
  // 查询API Key记录
  const keyRecord = await db.prepare(`
    SELECT * FROM api_keys 
    WHERE (key_hash = $1 OR key_value = $2)
      AND is_active = TRUE 
      AND (expires_at IS NULL OR expires_at > NOW())
  `).get(keyHash, apiKey)
  
  if (!keyRecord) {
    return { valid: false, message: 'API Key无效或已过期' }
  }
  
  // 检查速率限制
  const rateLimit = await checkRateLimit(keyRecord.id)
  if (!rateLimit.allowed) {
    return { valid: false, message: `超出速率限制，请在${rateLimit.retryAfter}秒后重试` }
  }
  
  // 解析权限（支持 JSONB 数组、JSON字符串、逗号分隔字符串）
  let permissions = ['read']
  if (keyRecord.permissions) {
    if (Array.isArray(keyRecord.permissions)) {
      // PostgreSQL JSONB 已自动解析为数组
      permissions = keyRecord.permissions
    } else if (typeof keyRecord.permissions === 'string') {
      try {
        permissions = JSON.parse(keyRecord.permissions)
      } catch (e) {
        permissions = keyRecord.permissions.split(',')
      }
    }
  }
  
  return {
    valid: true,
    keyInfo: {
      id: keyRecord.id,
      name: keyRecord.name,
      userId: keyRecord.user_id,
      clientId: keyRecord.client_id,
      permissions,
      rateLimit: keyRecord.rate_limit || 1000
    }
  }
}

/**
 * 哈希API Key
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

/**
 * 检查速率限制
 */
async function checkRateLimit(keyId) {
  try {
    const db = getDatabase()
    const windowMinutes = 1 // 1分钟窗口
    const defaultLimit = 1000 // 默认每分钟1000次
    
    // 获取速率限制配置
    const keyRecord = await db.prepare(`
      SELECT rate_limit FROM api_keys WHERE id = $1
    `).get(keyId)
    
    const limit = keyRecord?.rate_limit || defaultLimit
    
    // 统计当前窗口内的调用次数（兼容不同表结构）
    let currentCount = 0
    try {
      const countResult = await db.prepare(`
        SELECT COUNT(*) as count FROM api_call_logs 
        WHERE api_key_id = $1 
          AND called_at > NOW() - INTERVAL '${windowMinutes} minutes'
      `).get(keyId)
      currentCount = parseInt(countResult?.count) || 0
    } catch (e) {
      // 如果表结构不兼容，跳过速率限制检查
      console.warn('速率限制检查跳过（表结构不兼容）:', e.message)
      return { allowed: true, remaining: limit }
    }
    
    if (currentCount >= limit) {
      return { allowed: false, retryAfter: 60 }
    }
    
    return { allowed: true, remaining: limit - currentCount }
  } catch (error) {
    // 如果检查失败，默认允许访问
    console.warn('速率限制检查失败，默认允许:', error.message)
    return { allowed: true, remaining: 1000 }
  }
}

/**
 * 记录API调用日志
 */
async function logApiCall(apiKey, req) {
  const db = getDatabase()
  
  // 获取Key ID
  const keyHash = hashApiKey(apiKey)
  const keyRecord = await db.prepare(`
    SELECT id FROM api_keys WHERE key_hash = $1 OR key_value = $2
  `).get(keyHash, apiKey)
  
  if (!keyRecord) return
  
  await db.prepare(`
    INSERT INTO api_call_logs (api_key_id, endpoint, method, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `).run(
    keyRecord.id,
    req.path,
    req.method,
    req.ip || req.headers['x-forwarded-for'] || 'unknown',
    req.headers['user-agent'] || 'unknown'
  )
}

/**
 * 生成新的API Key
 */
export function generateApiKey(prefix = 'sk') {
  const randomBytes = crypto.randomBytes(24).toString('hex')
  return `${prefix}_${randomBytes}`
}

/**
 * 创建API Key记录
 */
export async function createApiKey(data) {
  const db = getDatabase()
  
  const apiKey = generateApiKey(data.prefix || 'sk')
  const keyHash = hashApiKey(apiKey)
  
  await db.prepare(`
    INSERT INTO api_keys (
      name, key_value, key_hash, client_id, user_id,
      permissions, rate_limit, expires_at, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
  `).run(
    data.name,
    apiKey, // 首次创建时保存原始值，方便用户查看
    keyHash,
    data.clientId || null,
    data.userId || null,
    JSON.stringify(data.permissions || ['read']),
    data.rateLimit || 1000,
    data.expiresAt || null
  )
  
  return { apiKey, keyHash }
}

/**
 * 撤销API Key
 */
export async function revokeApiKey(keyId) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE api_keys SET is_active = FALSE, revoked_at = NOW()
    WHERE id = $1
  `).run(keyId)
  
  return true
}

/**
 * 权限检查中间件
 * 检查API Key是否具有指定的权限
 * @param {string|string[]} requiredPermissions - 需要的权限（单个或数组）
 */
export function requirePermission(requiredPermissions) {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
  
  return (req, res, next) => {
    // 检查是否为API请求
    if (!req.user?.isApiRequest) {
      return next() // 非API请求，跳过权限检查
    }
    
    const userPermissions = req.user.permissions || []
    
    // 检查是否有admin权限（admin拥有所有权限）
    if (userPermissions.includes('admin')) {
      return next()
    }
    
    // 检查是否有所需权限
    const hasPermission = permissions.some(p => userPermissions.includes(p))
    
    if (!hasPermission) {
      return res.status(403).json({
        errCode: 403,
        msg: `权限不足，需要 ${permissions.join(' 或 ')} 权限`,
        data: null
      })
    }
    
    next()
  }
}

/**
 * 只读权限检查中间件
 * 确保只读API Key不能执行写入操作
 */
export function requireWritePermission(req, res, next) {
  // 检查是否为API请求
  if (!req.user?.isApiRequest) {
    return next() // 非API请求，跳过检查
  }
  
  // 只读方法不需要写入权限
  const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS']
  if (readOnlyMethods.includes(req.method)) {
    return next()
  }
  
  // 写入操作需要write或admin权限
  const userPermissions = req.user.permissions || []
  const hasWritePermission = userPermissions.some(p => ['write', 'sync', 'admin'].includes(p))
  
  if (!hasWritePermission) {
    return res.status(403).json({
      errCode: 403,
      msg: '只读API Key不能执行写入操作',
      data: null
    })
  }
  
  next()
}

export default {
  apiKeyAuth,
  optionalApiKeyAuth,
  generateApiKey,
  createApiKey,
  revokeApiKey,
  requirePermission,
  requireWritePermission
}
