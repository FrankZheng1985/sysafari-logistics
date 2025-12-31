/**
 * 安全中间件模块
 * 
 * 包含：
 * - API速率限制
 * - IP黑名单检查
 * - 安全响应头
 * - XSS防护
 * - 请求验证
 */

import { getDatabase } from '../config/database.js'

// 内存缓存：用于高性能速率限制
const rateLimitCache = new Map()

// 定期清理过期的速率限制记录（每5分钟）
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitCache.entries()) {
    if (now - value.windowStart > 60000) { // 1分钟窗口
      rateLimitCache.delete(key)
    }
  }
}, 300000)

/**
 * 获取客户端真实IP
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown'
}

/**
 * API速率限制中间件
 * 防止暴力攻击和API滥用
 * 
 * @param {Object} options 配置选项
 * @param {number} options.maxRequests - 时间窗口内最大请求数（默认100）
 * @param {number} options.windowMs - 时间窗口（毫秒，默认60000ms=1分钟）
 * @param {string} options.message - 超限时的错误消息
 * @param {boolean} options.skipSuccessfulRequests - 是否跳过成功请求的计数
 */
export function rateLimit(options = {}) {
  const {
    maxRequests = 100,
    windowMs = 60000,
    message = '请求过于频繁，请稍后再试',
    skipSuccessfulRequests = false,
    keyGenerator = (req) => getClientIp(req)
  } = options
  
  return async (req, res, next) => {
    const key = keyGenerator(req)
    const now = Date.now()
    
    // 从缓存获取或创建新记录
    let record = rateLimitCache.get(key)
    
    if (!record || now - record.windowStart > windowMs) {
      record = {
        count: 0,
        windowStart: now
      }
    }
    
    record.count++
    rateLimitCache.set(key, record)
    
    // 设置响应头
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count))
    res.setHeader('X-RateLimit-Reset', Math.ceil((record.windowStart + windowMs) / 1000))
    
    if (record.count > maxRequests) {
      // 记录到数据库（异步，不阻塞响应）
      logRateLimitExceeded(key, req).catch(console.error)
      
      return res.status(429).json({
        errCode: 429,
        msg: message,
        data: {
          retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
        }
      })
    }
    
    next()
  }
}

/**
 * 登录专用速率限制
 * 对登录接口进行更严格的限制
 */
export function loginRateLimit() {
  return rateLimit({
    maxRequests: 5,           // 每分钟最多5次登录尝试
    windowMs: 60000,          // 1分钟窗口
    message: '登录尝试过于频繁，请1分钟后再试',
    keyGenerator: (req) => `login:${getClientIp(req)}`
  })
}

/**
 * 敏感操作速率限制
 * 对密码修改、用户创建等操作进行限制
 */
export function sensitiveRateLimit() {
  return rateLimit({
    maxRequests: 10,          // 每分钟最多10次
    windowMs: 60000,
    message: '操作过于频繁，请稍后再试',
    keyGenerator: (req) => `sensitive:${getClientIp(req)}:${req.user?.id || 'anonymous'}`
  })
}

/**
 * 记录速率限制超限
 */
async function logRateLimitExceeded(identifier, req) {
  try {
    const db = getDatabase()
    await db.prepare(`
      INSERT INTO security_audit_logs (
        action_type, action_name, ip_address, user_agent, request_url, request_method, result, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'rate_limit',
      '速率限制触发',
      getClientIp(req),
      req.get('User-Agent') || '',
      req.originalUrl,
      req.method,
      'blocked',
      `请求标识: ${identifier}`
    )
  } catch (error) {
    console.error('记录速率限制日志失败:', error.message)
  }
}

/**
 * IP黑名单检查中间件
 */
export function ipBlacklistCheck() {
  // 内存缓存黑名单IP（每5分钟刷新）
  let blacklistCache = new Set()
  let lastRefresh = 0
  const refreshInterval = 300000 // 5分钟
  
  const refreshBlacklist = async () => {
    try {
      const db = getDatabase()
      const result = await db.prepare(`
        SELECT ip_address FROM ip_blacklist 
        WHERE is_active = TRUE 
        AND (expires_at IS NULL OR expires_at > NOW())
      `).all()
      
      blacklistCache = new Set(result.map(r => r.ip_address))
      lastRefresh = Date.now()
    } catch (error) {
      console.error('刷新IP黑名单失败:', error.message)
    }
  }
  
  return async (req, res, next) => {
    // 定期刷新黑名单
    if (Date.now() - lastRefresh > refreshInterval) {
      refreshBlacklist().catch(console.error)
    }
    
    const clientIp = getClientIp(req)
    
    if (blacklistCache.has(clientIp)) {
      // 记录被阻止的访问
      logBlockedAccess(clientIp, req).catch(console.error)
      
      return res.status(403).json({
        errCode: 403,
        msg: '访问被拒绝',
        data: null
      })
    }
    
    next()
  }
}

/**
 * 记录被阻止的访问
 */
async function logBlockedAccess(ip, req) {
  try {
    const db = getDatabase()
    await db.prepare(`
      INSERT INTO security_audit_logs (
        action_type, action_name, ip_address, user_agent, request_url, request_method, result, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'blocked_access',
      'IP黑名单拦截',
      ip,
      req.get('User-Agent') || '',
      req.originalUrl,
      req.method,
      'blocked',
      'IP在黑名单中'
    )
  } catch (error) {
    console.error('记录拦截日志失败:', error.message)
  }
}

/**
 * 安全响应头中间件
 * 添加各种安全相关的HTTP响应头
 */
export function securityHeaders() {
  return (req, res, next) => {
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    
    // 防止MIME类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff')
    
    // 启用XSS过滤器
    res.setHeader('X-XSS-Protection', '1; mode=block')
    
    // 控制Referrer信息
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // 权限策略
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    
    // 内容安全策略（根据需要调整）
    // res.setHeader('Content-Security-Policy', "default-src 'self'")
    
    // 移除服务器信息
    res.removeHeader('X-Powered-By')
    
    next()
  }
}

/**
 * XSS防护中间件
 * 对请求参数进行基本的XSS过滤
 */
export function xssProtection() {
  // XSS危险模式
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi
  ]
  
  const containsXss = (value) => {
    if (typeof value !== 'string') return false
    return xssPatterns.some(pattern => pattern.test(value))
  }
  
  const checkObject = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return null
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      
      if (typeof value === 'string' && containsXss(value)) {
        return currentPath
      }
      
      if (typeof value === 'object' && value !== null) {
        const result = checkObject(value, currentPath)
        if (result) return result
      }
    }
    
    return null
  }
  
  return (req, res, next) => {
    // 检查请求体
    if (req.body) {
      const xssField = checkObject(req.body)
      if (xssField) {
        return res.status(400).json({
          errCode: 400,
          msg: `检测到潜在的XSS攻击，字段: ${xssField}`,
          data: null
        })
      }
    }
    
    // 检查查询参数
    if (req.query) {
      const xssField = checkObject(req.query)
      if (xssField) {
        return res.status(400).json({
          errCode: 400,
          msg: `检测到潜在的XSS攻击，参数: ${xssField}`,
          data: null
        })
      }
    }
    
    next()
  }
}

/**
 * SQL注入防护检查
 * 注意：主要依靠参数化查询，这只是额外的防护层
 */
export function sqlInjectionCheck() {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
    /(--|;|'|"|\*|\/\*|\*\/)/g,
    /\b(OR|AND)\s+\d+\s*=\s*\d+/gi
  ]
  
  const isSuspicious = (value) => {
    if (typeof value !== 'string') return false
    // 只检查看起来像SQL注入的模式组合
    let matchCount = 0
    for (const pattern of sqlPatterns) {
      if (pattern.test(value)) matchCount++
      pattern.lastIndex = 0 // 重置正则
    }
    return matchCount >= 2 // 需要匹配多个模式才认为可疑
  }
  
  return (req, res, next) => {
    // 检查查询参数
    for (const [key, value] of Object.entries(req.query || {})) {
      if (isSuspicious(String(value))) {
        console.warn(`⚠️ 可疑SQL注入尝试: ${key}=${value}, IP: ${getClientIp(req)}`)
        // 只记录警告，不阻止请求（因为参数化查询已经防护）
      }
    }
    
    next()
  }
}

/**
 * 请求大小限制
 */
export function requestSizeLimit(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = req.headers['content-length']
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10)
      const maxBytes = parseSize(maxSize)
      
      if (sizeInBytes > maxBytes) {
        return res.status(413).json({
          errCode: 413,
          msg: '请求体过大',
          data: { maxSize, received: formatSize(sizeInBytes) }
        })
      }
    }
    
    next()
  }
}

/**
 * 解析大小字符串（如 '10mb'）为字节数
 */
function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }
  const match = String(size).toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/)
  if (!match) return 10 * 1024 * 1024 // 默认10MB
  return parseInt(match[1], 10) * (units[match[2]] || 1)
}

/**
 * 格式化字节数为可读字符串
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
}

/**
 * 添加IP到黑名单
 */
export async function addToBlacklist(ipAddress, reason, blockedBy, expiresInMinutes = null) {
  const db = getDatabase()
  const expiresAt = expiresInMinutes 
    ? new Date(Date.now() + expiresInMinutes * 60000).toISOString()
    : null
  
  await db.prepare(`
    INSERT INTO ip_blacklist (ip_address, reason, blocked_by, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (ip_address) DO UPDATE SET
      reason = EXCLUDED.reason,
      blocked_by = EXCLUDED.blocked_by,
      expires_at = EXCLUDED.expires_at,
      is_active = TRUE
  `).run(ipAddress, reason, blockedBy, expiresAt)
}

/**
 * 从黑名单移除IP
 */
export async function removeFromBlacklist(ipAddress) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE ip_blacklist SET is_active = FALSE WHERE ip_address = ?
  `).run(ipAddress)
}

/**
 * 综合安全中间件
 * 一次性应用所有安全措施
 */
export function securityMiddleware(options = {}) {
  const {
    enableRateLimit = true,
    enableBlacklist = true,
    enableHeaders = true,
    enableXss = true
  } = options
  
  const middlewares = []
  
  if (enableHeaders) middlewares.push(securityHeaders())
  if (enableBlacklist) middlewares.push(ipBlacklistCheck())
  if (enableXss) middlewares.push(xssProtection())
  if (enableRateLimit) middlewares.push(rateLimit())
  
  return (req, res, next) => {
    let index = 0
    
    const runNext = () => {
      if (index >= middlewares.length) {
        return next()
      }
      middlewares[index++](req, res, runNext)
    }
    
    runNext()
  }
}

export default {
  rateLimit,
  loginRateLimit,
  sensitiveRateLimit,
  ipBlacklistCheck,
  securityHeaders,
  xssProtection,
  sqlInjectionCheck,
  requestSizeLimit,
  addToBlacklist,
  removeFromBlacklist,
  securityMiddleware,
  getClientIp
}
