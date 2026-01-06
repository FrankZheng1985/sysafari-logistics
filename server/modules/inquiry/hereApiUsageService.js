/**
 * HERE API 调用计数器服务
 * 用于监控和限制 HERE Maps API 的使用量，避免超出免费配额产生费用
 * 
 * 免费配额（每月）：
 * - Autosuggest: 250,000 次
 * - Geocoding & Search: 250,000 次
 * - Routing: 250,000 次
 * - Matrix Routing: 5,000 次
 */

import db from '../../config/database.js'

// API 类型及其免费配额
export const API_LIMITS = {
  autosuggest: {
    name: 'Autosuggest',
    description: '地址自动补全',
    monthlyLimit: 250000,
    warningThreshold: 0.8,   // 80% 时发出警告
    blockThreshold: 0.95     // 95% 时阻止调用
  },
  geocoding: {
    name: 'Geocoding & Search',
    description: '地址解析、地理编码',
    monthlyLimit: 250000,
    warningThreshold: 0.8,
    blockThreshold: 0.95
  },
  routing: {
    name: 'Routing',
    description: '路线计算',
    monthlyLimit: 250000,
    warningThreshold: 0.8,
    blockThreshold: 0.95
  },
  matrix_routing: {
    name: 'Matrix Routing',
    description: '批量距离/时间矩阵',
    monthlyLimit: 5000,
    warningThreshold: 0.7,   // Matrix 配额少，70% 就警告
    blockThreshold: 0.9
  }
}

// 内存缓存，减少数据库查询
let usageCache = new Map()
let cacheLastUpdated = null
const CACHE_TTL = 60000 // 缓存有效期 60 秒

/**
 * 获取当前年月字符串
 */
function getCurrentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 确保当月记录存在
 */
async function ensureMonthlyRecord(apiType) {
  const yearMonth = getCurrentYearMonth()
  const limit = API_LIMITS[apiType]?.monthlyLimit || 250000
  
  try {
    await db.query(`
      INSERT INTO here_api_usage (api_type, year_month, monthly_limit, call_count)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (api_type, year_month) DO NOTHING
    `, [apiType, yearMonth, limit])
  } catch (error) {
    console.error('[HereApiUsage] 创建月度记录失败:', error)
  }
}

/**
 * 获取当前使用情况（带缓存）
 */
async function getCurrentUsage(apiType, forceRefresh = false) {
  const yearMonth = getCurrentYearMonth()
  const cacheKey = `${apiType}_${yearMonth}`
  
  // 检查缓存
  if (!forceRefresh && usageCache.has(cacheKey)) {
    const cached = usageCache.get(cacheKey)
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }
  }
  
  try {
    // 确保记录存在
    await ensureMonthlyRecord(apiType)
    
    const result = await db.query(`
      SELECT call_count, monthly_limit, cache_hit_count, error_count, last_call_at
      FROM here_api_usage
      WHERE api_type = $1 AND year_month = $2
    `, [apiType, yearMonth])
    
    if (result.rows.length > 0) {
      const usage = result.rows[0]
      const data = {
        apiType,
        callCount: usage.call_count,
        monthlyLimit: usage.monthly_limit,
        cacheHitCount: usage.cache_hit_count || 0,
        errorCount: usage.error_count || 0,
        remaining: usage.monthly_limit - usage.call_count,
        usagePercentage: (usage.call_count / usage.monthly_limit) * 100,
        lastCallAt: usage.last_call_at
      }
      
      // 更新缓存
      usageCache.set(cacheKey, { data, timestamp: Date.now() })
      
      return data
    }
    
    return null
  } catch (error) {
    console.error('[HereApiUsage] 获取使用情况失败:', error)
    return null
  }
}

/**
 * 检查是否可以调用 API
 * @param {string} apiType - API 类型
 * @returns {Object} { allowed: boolean, reason: string, usage: Object }
 */
export async function checkCanCall(apiType) {
  const limits = API_LIMITS[apiType]
  if (!limits) {
    return { allowed: true, reason: '未知 API 类型，允许调用', usage: null }
  }
  
  const usage = await getCurrentUsage(apiType)
  if (!usage) {
    // 如果获取使用情况失败，为安全起见仍允许调用
    console.warn('[HereApiUsage] 无法获取使用情况，降级允许调用')
    return { allowed: true, reason: '无法获取使用情况', usage: null }
  }
  
  const percentage = usage.usagePercentage / 100
  
  // 检查是否达到阻止阈值
  if (percentage >= limits.blockThreshold) {
    console.error(`[HereApiUsage] ⛔ ${limits.name} API 已达配额上限 (${(percentage * 100).toFixed(1)}%)，阻止调用`)
    return {
      allowed: false,
      reason: `${limits.name} API 本月使用量已达 ${(percentage * 100).toFixed(1)}%，为避免产生费用，已暂停调用。请联系管理员。`,
      usage,
      blocked: true
    }
  }
  
  // 检查是否达到警告阈值
  if (percentage >= limits.warningThreshold) {
    console.warn(`[HereApiUsage] ⚠️ ${limits.name} API 接近配额上限 (${(percentage * 100).toFixed(1)}%)`)
    return {
      allowed: true,
      reason: `警告：${limits.name} API 本月使用量已达 ${(percentage * 100).toFixed(1)}%`,
      usage,
      warning: true
    }
  }
  
  return { allowed: true, reason: 'OK', usage }
}

/**
 * 记录 API 调用
 * @param {string} apiType - API 类型
 * @param {boolean} success - 是否成功
 * @param {boolean} fromCache - 是否来自缓存
 * @param {Object} options - 其他选项
 */
export async function recordApiCall(apiType, success = true, fromCache = false, options = {}) {
  const yearMonth = getCurrentYearMonth()
  
  try {
    // 确保记录存在
    await ensureMonthlyRecord(apiType)
    
    if (fromCache) {
      // 缓存命中，只增加缓存命中计数
      await db.query(`
        UPDATE here_api_usage
        SET cache_hit_count = cache_hit_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE api_type = $1 AND year_month = $2
      `, [apiType, yearMonth])
    } else if (success) {
      // 实际 API 调用成功
      await db.query(`
        UPDATE here_api_usage
        SET call_count = call_count + 1,
            last_call_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE api_type = $1 AND year_month = $2
      `, [apiType, yearMonth])
    } else {
      // API 调用失败
      await db.query(`
        UPDATE here_api_usage
        SET error_count = error_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE api_type = $1 AND year_month = $2
      `, [apiType, yearMonth])
    }
    
    // 清除缓存
    usageCache.delete(`${apiType}_${yearMonth}`)
    
    // 可选：记录详细日志
    if (options.logDetail) {
      await logApiCall(apiType, {
        success,
        fromCache,
        ...options
      })
    }
  } catch (error) {
    // 记录失败不应影响主流程
    console.error('[HereApiUsage] 记录 API 调用失败:', error)
  }
}

/**
 * 记录详细调用日志
 */
async function logApiCall(apiType, details) {
  try {
    await db.query(`
      INSERT INTO here_api_call_log (
        api_type, endpoint, request_params, success, from_cache, 
        response_time_ms, error_message, user_id, ip_address, request_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      apiType,
      details.endpoint || null,
      details.requestParams || null,
      details.success !== false,
      details.fromCache || false,
      details.responseTime || null,
      details.errorMessage || null,
      details.userId || null,
      details.ipAddress || null,
      details.requestSource || null
    ])
  } catch (error) {
    console.error('[HereApiUsage] 记录调用日志失败:', error)
  }
}

/**
 * 获取所有 API 的使用统计
 */
export async function getAllUsageStats() {
  const yearMonth = getCurrentYearMonth()
  
  try {
    // 先确保所有 API 类型的记录都存在
    for (const apiType of Object.keys(API_LIMITS)) {
      await ensureMonthlyRecord(apiType)
    }
    
    const result = await db.query(`
      SELECT 
        api_type,
        call_count,
        monthly_limit,
        cache_hit_count,
        error_count,
        ROUND((call_count::numeric / monthly_limit::numeric) * 100, 2) as usage_percentage,
        monthly_limit - call_count as remaining,
        last_call_at,
        updated_at
      FROM here_api_usage
      WHERE year_month = $1
      ORDER BY api_type
    `, [yearMonth])
    
    // 添加配额信息
    const stats = result.rows.map(row => {
      const limits = API_LIMITS[row.api_type] || {}
      return {
        apiType: row.api_type,
        name: limits.name || row.api_type,
        description: limits.description || '',
        callCount: row.call_count,
        monthlyLimit: row.monthly_limit,
        cacheHitCount: row.cache_hit_count || 0,
        errorCount: row.error_count || 0,
        remaining: row.remaining,
        usagePercentage: parseFloat(row.usage_percentage) || 0,
        lastCallAt: row.last_call_at,
        updatedAt: row.updated_at,
        warningThreshold: (limits.warningThreshold || 0.8) * 100,
        blockThreshold: (limits.blockThreshold || 0.95) * 100,
        status: getUsageStatus(parseFloat(row.usage_percentage) || 0, limits)
      }
    })
    
    return {
      yearMonth,
      stats,
      summary: {
        totalCalls: stats.reduce((sum, s) => sum + s.callCount, 0),
        totalCacheHits: stats.reduce((sum, s) => sum + s.cacheHitCount, 0),
        totalErrors: stats.reduce((sum, s) => sum + s.errorCount, 0),
        cacheHitRate: calculateCacheHitRate(stats)
      }
    }
  } catch (error) {
    console.error('[HereApiUsage] 获取使用统计失败:', error)
    throw error
  }
}

/**
 * 计算缓存命中率
 */
function calculateCacheHitRate(stats) {
  const totalAttempts = stats.reduce((sum, s) => sum + s.callCount + s.cacheHitCount, 0)
  const totalCacheHits = stats.reduce((sum, s) => sum + s.cacheHitCount, 0)
  
  if (totalAttempts === 0) return 0
  return Math.round((totalCacheHits / totalAttempts) * 100 * 100) / 100
}

/**
 * 获取使用状态
 */
function getUsageStatus(percentage, limits) {
  const warn = (limits.warningThreshold || 0.8) * 100
  const block = (limits.blockThreshold || 0.95) * 100
  
  if (percentage >= block) return 'blocked'
  if (percentage >= warn) return 'warning'
  if (percentage >= 50) return 'moderate'
  return 'normal'
}

/**
 * 获取历史使用记录
 */
export async function getUsageHistory(months = 6) {
  try {
    const result = await db.query(`
      SELECT 
        api_type, year_month, call_count, monthly_limit, 
        cache_hit_count, error_count,
        ROUND((call_count::numeric / monthly_limit::numeric) * 100, 2) as usage_percentage
      FROM here_api_usage
      ORDER BY year_month DESC, api_type
      LIMIT $1
    `, [months * 4]) // 4 种 API 类型
    
    // 按月份分组
    const grouped = {}
    for (const row of result.rows) {
      if (!grouped[row.year_month]) {
        grouped[row.year_month] = {}
      }
      grouped[row.year_month][row.api_type] = {
        callCount: row.call_count,
        monthlyLimit: row.monthly_limit,
        cacheHitCount: row.cache_hit_count || 0,
        errorCount: row.error_count || 0,
        usagePercentage: parseFloat(row.usage_percentage) || 0
      }
    }
    
    return grouped
  } catch (error) {
    console.error('[HereApiUsage] 获取历史记录失败:', error)
    return {}
  }
}

/**
 * 重置当月计数（仅用于测试）
 */
export async function resetMonthlyCount(apiType) {
  const yearMonth = getCurrentYearMonth()
  
  try {
    await db.query(`
      UPDATE here_api_usage
      SET call_count = 0, cache_hit_count = 0, error_count = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE api_type = $1 AND year_month = $2
    `, [apiType, yearMonth])
    
    // 清除缓存
    usageCache.delete(`${apiType}_${yearMonth}`)
    
    return true
  } catch (error) {
    console.error('[HereApiUsage] 重置计数失败:', error)
    return false
  }
}

/**
 * 手动设置调用次数（用于同步实际使用量）
 */
export async function setCallCount(apiType, count) {
  const yearMonth = getCurrentYearMonth()
  
  try {
    await ensureMonthlyRecord(apiType)
    
    await db.query(`
      UPDATE here_api_usage
      SET call_count = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE api_type = $1 AND year_month = $2
    `, [apiType, yearMonth, count])
    
    // 清除缓存
    usageCache.delete(`${apiType}_${yearMonth}`)
    
    return true
  } catch (error) {
    console.error('[HereApiUsage] 设置调用次数失败:', error)
    return false
  }
}

export default {
  API_LIMITS,
  checkCanCall,
  recordApiCall,
  getAllUsageStats,
  getUsageHistory,
  resetMonthlyCount,
  setCallCount
}

