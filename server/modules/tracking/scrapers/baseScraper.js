/**
 * 基础爬虫类
 * 
 * 提供通用的爬虫功能：
 * - 请求重试机制
 * - 请求频率限制
 * - 错误处理和日志
 * - 数据标准化接口
 */

// 简单的内存缓存
const cache = new Map()
const CACHE_TTL = 15 * 60 * 1000 // 15分钟缓存

// 请求频率限制
const rateLimiter = new Map()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分钟窗口
const MAX_REQUESTS_PER_WINDOW = 10 // 每分钟最多10次请求

/**
 * 基础爬虫类
 */
export class BaseScraper {
  constructor(options = {}) {
    this.name = options.name || 'BaseScraper'
    this.baseUrl = options.baseUrl || ''
    this.timeout = options.timeout || 30000
    this.maxRetries = options.maxRetries || 3
    this.retryDelay = options.retryDelay || 1000
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  /**
   * 检查缓存
   * @param {string} key - 缓存键
   * @returns {Object|null} 缓存数据或null
   */
  getFromCache(key) {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[${this.name}] 缓存命中: ${key}`)
      return cached.data
    }
    if (cached) {
      cache.delete(key)
    }
    return null
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {Object} data - 缓存数据
   */
  setCache(key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now()
    })
    console.log(`[${this.name}] 已缓存: ${key}`)
  }

  /**
   * 检查频率限制
   * @returns {boolean} 是否允许请求
   */
  checkRateLimit() {
    const now = Date.now()
    const key = this.name
    
    if (!rateLimiter.has(key)) {
      rateLimiter.set(key, { count: 0, windowStart: now })
    }
    
    const limiter = rateLimiter.get(key)
    
    // 重置窗口
    if (now - limiter.windowStart > RATE_LIMIT_WINDOW) {
      limiter.count = 0
      limiter.windowStart = now
    }
    
    if (limiter.count >= MAX_REQUESTS_PER_WINDOW) {
      console.warn(`[${this.name}] 频率限制: 已达到 ${MAX_REQUESTS_PER_WINDOW} 次/分钟`)
      return false
    }
    
    limiter.count++
    return true
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 发送HTTP请求（带重试）
   * @param {string} url - 请求URL
   * @param {Object} options - fetch选项
   * @returns {Promise<Response>} 响应
   */
  async fetchWithRetry(url, options = {}) {
    // 检查频率限制
    if (!this.checkRateLimit()) {
      throw new Error('请求频率超限，请稍后再试')
    }

    const fetchOptions = {
      ...options,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
    }

    let lastError = null
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[${this.name}] 请求 (${attempt}/${this.maxRetries}): ${url}`)
        const response = await fetch(url, fetchOptions)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        lastError = error
        console.error(`[${this.name}] 请求失败 (${attempt}/${this.maxRetries}):`, error.message)
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1) // 指数退避
          console.log(`[${this.name}] ${delay}ms 后重试...`)
          await this.delay(delay)
        }
      }
    }
    
    throw lastError
  }

  /**
   * 发送GET请求并解析JSON
   * @param {string} url - 请求URL
   * @param {Object} options - fetch选项
   * @returns {Promise<Object>} JSON数据
   */
  async fetchJson(url, options = {}) {
    const response = await this.fetchWithRetry(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    })
    return response.json()
  }

  /**
   * 发送GET请求并获取HTML
   * @param {string} url - 请求URL
   * @param {Object} options - fetch选项
   * @returns {Promise<string>} HTML文本
   */
  async fetchHtml(url, options = {}) {
    const response = await this.fetchWithRetry(url, {
      ...options,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers,
      },
    })
    return response.text()
  }

  /**
   * 根据集装箱号追踪（子类实现）
   * @param {string} containerNumber - 集装箱号
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByContainer(containerNumber) {
    throw new Error('子类必须实现 trackByContainer 方法')
  }

  /**
   * 根据提单号追踪（子类实现）
   * @param {string} billNumber - 提单号
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByBillNumber(billNumber) {
    throw new Error('子类必须实现 trackByBillNumber 方法')
  }

  /**
   * 标准化追踪数据（子类实现）
   * @param {Object} rawData - 原始数据
   * @returns {Object} 标准化数据
   */
  normalizeData(rawData) {
    throw new Error('子类必须实现 normalizeData 方法')
  }
}

/**
 * 标准化追踪结果格式
 */
export const TrackingResultSchema = {
  containerNumber: null,      // 集装箱号
  billNumber: null,           // 提单号
  carrier: null,              // 船公司
  carrierCode: null,          // 船公司代码
  vessel: null,               // 船名
  voyage: null,               // 航次
  portOfLoading: null,        // 起运港
  portOfDischarge: null,      // 目的港
  etd: null,                  // 预计离港时间
  eta: null,                  // 预计到港时间
  atd: null,                  // 实际离港时间
  ata: null,                  // 实际到港时间
  status: null,               // 当前状态
  containerType: null,        // 柜型
  sealNumber: null,           // 封签号
  grossWeight: null,          // 毛重
  volume: null,               // 体积
  events: [],                 // 事件列表
  _source: null,              // 数据来源
  _fetchedAt: null,           // 获取时间
}

/**
 * 创建标准追踪结果
 * @param {Object} data - 追踪数据
 * @param {string} source - 数据来源
 * @returns {Object} 标准化结果
 */
export function createTrackingResult(data, source) {
  return {
    ...TrackingResultSchema,
    ...data,
    _source: source,
    _fetchedAt: new Date().toISOString(),
  }
}

/**
 * 解析日期字符串
 * @param {string} dateStr - 日期字符串
 * @returns {string|null} ISO日期字符串
 */
export function parseDate(dateStr) {
  if (!dateStr) return null
  
  // 尝试多种格式
  const formats = [
    // ISO格式
    /^\d{4}-\d{2}-\d{2}/,
    // DD/MM/YYYY
    /^(\d{2})\/(\d{2})\/(\d{4})/,
    // DD-MMM-YYYY (如 15-DEC-2024)
    /^(\d{2})-([A-Za-z]{3})-(\d{4})/,
    // DD MMM YYYY
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/,
  ]
  
  // 月份名称映射
  const monthNames = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  }
  
  try {
    // DD-MMM-YYYY 或 DD MMM YYYY
    const monthMatch = dateStr.match(/(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})/)
    if (monthMatch) {
      const day = monthMatch[1].padStart(2, '0')
      const month = monthNames[monthMatch[2].toUpperCase()]
      const year = monthMatch[3]
      if (month) {
        return `${year}-${month}-${day}`
      }
    }
    
    // 直接尝试解析
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch (e) {
    console.warn('日期解析失败:', dateStr)
  }
  
  return null
}

/**
 * 清理缓存
 */
export function clearCache() {
  cache.clear()
  console.log('爬虫缓存已清理')
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  }
}

export default BaseScraper

