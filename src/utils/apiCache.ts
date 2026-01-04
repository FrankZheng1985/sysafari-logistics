/**
 * API 请求缓存和去重工具
 * 
 * 功能：
 * 1. 请求去重 - 防止同一请求并发多次发送
 * 2. 响应缓存 - 缓存 API 响应，减少重复请求
 * 3. TTL 过期 - 缓存自动过期
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

// 响应缓存
const cache = new Map<string, CacheEntry<any>>()

// 进行中的请求（用于去重）
const pendingRequests = new Map<string, PendingRequest<any>>()

// 默认缓存时间（毫秒）
const DEFAULT_TTL = 60 * 1000 // 1分钟

// 系统设置缓存时间（更长，因为不常变化）
const SYSTEM_SETTINGS_TTL = 5 * 60 * 1000 // 5分钟

/**
 * 获取缓存的数据
 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  
  const now = Date.now()
  if (now - entry.timestamp > entry.ttl) {
    // 缓存已过期
    cache.delete(key)
    return null
  }
  
  return entry.data as T
}

/**
 * 设置缓存
 */
function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  })
}

/**
 * 清除特定缓存
 */
export function clearCache(key: string): void {
  cache.delete(key)
  pendingRequests.delete(key)
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  cache.clear()
  pendingRequests.clear()
}

/**
 * 清除匹配前缀的缓存
 */
export function clearCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
  for (const key of pendingRequests.keys()) {
    if (key.startsWith(prefix)) {
      pendingRequests.delete(key)
    }
  }
}

/**
 * 带去重和缓存的请求包装器
 * 
 * @param key 缓存键（通常是 URL）
 * @param fetcher 实际的请求函数
 * @param ttl 缓存时间（毫秒）
 * @param forceRefresh 是否强制刷新（忽略缓存）
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
  forceRefresh: boolean = false
): Promise<T> {
  // 1. 检查缓存（除非强制刷新）
  if (!forceRefresh) {
    const cached = getCached<T>(key)
    if (cached !== null) {
      return cached
    }
  }
  
  // 2. 检查是否有进行中的相同请求
  const pending = pendingRequests.get(key)
  if (pending) {
    // 复用进行中的请求
    return pending.promise
  }
  
  // 3. 发起新请求
  const promise = fetcher()
    .then((data) => {
      // 缓存响应
      setCache(key, data, ttl)
      return data
    })
    .finally(() => {
      // 请求完成后移除 pending 状态
      pendingRequests.delete(key)
    })
  
  // 记录进行中的请求
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now()
  })
  
  return promise
}

/**
 * 获取系统设置（带缓存和去重）
 */
export async function getCachedSystemSettings(
  key: string,
  apiBaseUrl: string
): Promise<any> {
  const cacheKey = `system-settings:${key}`
  
  return cachedFetch(
    cacheKey,
    async () => {
      const res = await fetch(`${apiBaseUrl}/api/system-settings?key=${key}`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      return res.json()
    },
    SYSTEM_SETTINGS_TTL
  )
}

/**
 * 系统设置变更时清除相关缓存
 */
export function invalidateSystemSettings(key?: string): void {
  if (key) {
    clearCache(`system-settings:${key}`)
  } else {
    clearCacheByPrefix('system-settings:')
  }
}

/**
 * 通知概览缓存（较短的 TTL）
 * @param userId - 用户ID
 * @param apiBaseUrl - API基础URL
 * @param userRole - 用户角色（用于权限过滤）
 */
export async function getCachedNotificationOverview(
  userId: string | number,
  apiBaseUrl: string,
  userRole?: string
): Promise<any> {
  // 缓存键需要包含角色，因为不同角色看到的数据不同
  const cacheKey = `notifications:overview:${userId}:${userRole || 'unknown'}`
  
  return cachedFetch(
    cacheKey,
    async () => {
      const params = new URLSearchParams({ userId: String(userId) })
      if (userRole) {
        params.append('userRole', userRole)
      }
      const res = await fetch(`${apiBaseUrl}/api/notifications/overview?${params}`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      return res.json()
    },
    30 * 1000 // 30秒缓存，与轮询间隔配合
  )
}

/**
 * 清除通知缓存（用于新通知到达时）
 * @param userId - 用户ID
 * @param userRole - 用户角色（可选，如果提供将清除该角色的缓存）
 */
export function invalidateNotificationCache(userId?: string | number, userRole?: string): void {
  if (userId) {
    if (userRole) {
      // 清除特定用户和角色的缓存
      clearCache(`notifications:overview:${userId}:${userRole}`)
    } else {
      // 清除该用户的所有角色缓存
      clearCacheByPrefix(`notifications:overview:${userId}:`)
    }
  } else {
    clearCacheByPrefix('notifications:')
  }
}

// 导出常量供其他模块使用
export const CACHE_TTL = {
  DEFAULT: DEFAULT_TTL,
  SYSTEM_SETTINGS: SYSTEM_SETTINGS_TTL,
  NOTIFICATIONS: 30 * 1000,
  DASHBOARD_STATS: 60 * 1000,
}

