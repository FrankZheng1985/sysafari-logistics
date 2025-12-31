/**
 * TARIC API 客户端
 * 从欧盟官方 TARIC 系统实时获取税率数据
 * 
 * 由于欧盟没有公开的 REST API，通过解析官方网页获取数据
 * 数据来源：https://ec.europa.eu/taxation_customs/dds2/taric/
 * 
 * 备用数据源：本地常用税率数据库
 */

import https from 'https'
import http from 'http'
import { findDutyRate } from './commonDutyRates.js'
import { findChinaAntiDumpingRate } from './chinaAntiDumpingRates.js'

// ==================== 配置 ====================

const TARIC_BASE_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric'

// 内存缓存（简单实现，可升级为 Redis）
const cache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时缓存

// ==================== 缓存管理 ====================

/**
 * 从缓存获取数据
 */
function getFromCache(key) {
  const item = cache.get(key)
  if (!item) return null
  
  if (Date.now() > item.expiry) {
    cache.delete(key)
    return null
  }
  
  return item.data
}

/**
 * 设置缓存
 */
function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl
  })
}

/**
 * 清除所有缓存
 */
export function clearCache() {
  cache.clear()
}

/**
 * 获取缓存统计
 */
export function getCacheStats() {
  let validCount = 0
  let expiredCount = 0
  const now = Date.now()
  
  for (const [, value] of cache) {
    if (now > value.expiry) {
      expiredCount++
    } else {
      validCount++
    }
  }
  
  return { validCount, expiredCount, totalCount: cache.size }
}

// ==================== HTTP 请求工具 ====================

/**
 * 发送 HTTP GET 请求
 */
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const timeout = options.timeout || 30000
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...options.headers
      },
      timeout
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject)
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        return
      }
      
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
    
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
  })
}

// ==================== HTML 解析工具 ====================

/**
 * 简单的 HTML 属性提取
 */
function extractAttribute(html, tagPattern, attrName) {
  const regex = new RegExp(`<${tagPattern}[^>]*${attrName}=["']([^"']+)["']`, 'gi')
  const matches = []
  let match
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1])
  }
  return matches
}

/**
 * 提取标签内容
 */
function extractTagContent(html, tagName, className) {
  const pattern = className 
    ? `<${tagName}[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)</${tagName}>`
    : `<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`
  const regex = new RegExp(pattern, 'gi')
  const matches = []
  let match
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1].trim())
  }
  return matches
}

/**
 * 清理 HTML 标签
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// ==================== TARIC 数据获取 ====================

/**
 * 获取当前日期字符串（YYYYMMDD 格式）
 */
function getCurrentDateStr() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * 从 TARIC 系统查询 HS 编码的税率信息
 * @param {string} hsCode - HS 编码（8-10位）
 * @param {string} originCountry - 原产国代码（如 CN）
 * @returns {Promise<Object>} 税率信息
 */
export async function lookupTaricCode(hsCode, originCountry = '') {
  // 规范化 HS 编码
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  
  // 检查缓存
  const cacheKey = `taric_${normalizedCode}_${originCountry || 'ALL'}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  // 先从本地常用税率数据库查找
  const localRate = findDutyRate(normalizedCode)
  
  // 如果是中国原产地，查找反倾销税数据
  let chinaAntiDumping = null
  if (originCountry && originCountry.toUpperCase() === 'CN') {
    chinaAntiDumping = findChinaAntiDumpingRate(normalizedCode)
  }
  
  let result = {
    hsCode: normalizedCode.substring(0, 8),
    hsCode10: normalizedCode,
    originCountryCode: originCountry || null,
    measures: [],
    dutyRate: chinaAntiDumping?.dutyRate ?? localRate?.dutyRate ?? null,
    thirdCountryDuty: localRate?.thirdCountryDuty ?? null,
    preferentialRates: [],
    antiDumpingRate: chinaAntiDumping?.antiDumpingRate ?? null,
    antiDumpingRateRange: chinaAntiDumping?.antiDumpingRateRange ?? null,
    countervailingRate: chinaAntiDumping?.countervailingRate ?? null,
    additionalCodes: [],
    restrictions: [],
    quotas: [],
    goodsDescription: chinaAntiDumping?.description || localRate?.description || null,
    goodsDescriptionCn: chinaAntiDumping?.descriptionCn || localRate?.descriptionCn || null,
    dataSource: chinaAntiDumping ? 'china_anti_dumping_database' : (localRate ? 'local_database' : 'taric_api'),
    note: chinaAntiDumping?.note || localRate?.note || null,
    regulationId: chinaAntiDumping?.regulationId || null,
    validFrom: chinaAntiDumping?.validFrom || null,
    totalDutyRate: chinaAntiDumping?.totalDutyRate ?? null,
    queryTime: new Date().toISOString()
  }
  
  try {
    const dateStr = getCurrentDateStr()
    
    // 构建查询 URL
    let url = `${TARIC_BASE_URL}/measures.jsp?Lang=en&SimDate=${dateStr}&Taric=${normalizedCode}&LangDescr=en&Domain=TARIC`
    if (originCountry) {
      url += `&Area=${originCountry}`
    }
    
    // 获取页面内容
    const html = await httpGet(url)
    
    // 解析数据（尝试从网页获取更多信息）
    const webResult = parseTaricMeasuresPage(html, normalizedCode, originCountry)
    
    // 合并结果：网页数据优先，本地数据作为备用
    if (webResult.totalMeasures > 0) {
      result.totalMeasures = webResult.totalMeasures
    }
    if (webResult.detailsUrls) {
      result.detailsUrls = webResult.detailsUrls
    }
    if (webResult.hasAntiDumping) {
      result.hasAntiDumping = true
    }
    if (webResult.hasCountervailing) {
      result.hasCountervailing = true
    }
    if (webResult.hasQuota) {
      result.hasQuota = true
    }
    if (webResult.requiresLicense) {
      result.requiresLicense = true
    }
    if (webResult.requiresSPS) {
      result.requiresSPS = true
    }
    
    // 如果网页获取到了税率，使用网页数据
    if (webResult.thirdCountryDuty !== null) {
      result.thirdCountryDuty = webResult.thirdCountryDuty
      result.dutyRate = webResult.thirdCountryDuty
      result.dataSource = 'taric_api'
      result.note = null
    }
    if (webResult.antiDumpingRate !== null) {
      result.antiDumpingRate = webResult.antiDumpingRate
    }
    
    // 获取商品描述（从另一个页面）
    if (!result.goodsDescription) {
      const descriptionUrl = `${TARIC_BASE_URL}/goods_description.jsp?Lang=en&LangDescr=en&SimDate=${dateStr}&Taric=${normalizedCode}`
      try {
        const descHtml = await httpGet(descriptionUrl)
        const webDesc = parseGoodsDescription(descHtml)
        if (webDesc) {
          result.goodsDescription = webDesc
        }
      } catch (e) {
        console.warn('获取商品描述失败:', e.message)
      }
    }
    
  } catch (error) {
    console.warn(`从欧盟网站查询失败 [${hsCode}]:`, error.message)
    // 如果网络请求失败但有本地数据，继续使用本地数据
    if (!localRate) {
      throw error
    }
  }
  
  // 缓存结果
  setCache(cacheKey, result)
  
  return { ...result, fromCache: false }
}

/**
 * 解析 TARIC 措施页面
 */
function parseTaricMeasuresPage(html, hsCode, originCountry) {
  const result = {
    hsCode: hsCode.substring(0, 8),
    hsCode10: hsCode,
    originCountryCode: originCountry || null,
    measures: [],
    dutyRate: null,
    thirdCountryDuty: null,
    preferentialRates: [],
    antiDumpingRate: null,
    countervailingRate: null,
    additionalCodes: [],
    restrictions: [],
    quotas: [],
    dataSource: 'taric_api',
    queryTime: new Date().toISOString()
  }
  
  // 检查是否有数据
  const totalMeasuresMatch = html.match(/totalNumberOfMeasures\s*=\s*(\d+)/)
  if (totalMeasuresMatch) {
    result.totalMeasures = parseInt(totalMeasuresMatch[1], 10)
  }
  
  // 提取 iframe 数据 URL（详细数据在 iframe 中加载）
  const iframeSrcMatch = html.match(/measures_details\.jsp[^'"]+/g)
  if (iframeSrcMatch && iframeSrcMatch.length > 0) {
    // 记录详细数据 URL，可用于后续深度查询
    result.detailsUrls = iframeSrcMatch.map(src => 
      `${TARIC_BASE_URL}/${src.replace(/&amp;/g, '&')}`
    )
  }
  
  // 从页面中提取一些基本信息
  // 提取商品代码确认
  const goodsCodeMatch = html.match(/Taric=(\d{10})/)
  if (goodsCodeMatch) {
    result.hsCode10 = goodsCodeMatch[1]
    result.hsCode = goodsCodeMatch[1].substring(0, 8)
  }
  
  // 尝试从页面中提取税率信息（如果页面包含）
  const dutyPatterns = [
    /(\d+(?:\.\d+)?)\s*%/g,  // 匹配百分比
    /duty[^:]*:\s*(\d+(?:\.\d+)?)/gi,  // 匹配 duty: xx
  ]
  
  // 解析页面中的第三国税率（Third country duty）
  if (html.includes('Third country') || html.includes('ERGA OMNES')) {
    const thirdCountryMatch = html.match(/Third\s+country[^<]*?(\d+(?:\.\d+)?)\s*%/i)
    if (thirdCountryMatch) {
      result.thirdCountryDuty = parseFloat(thirdCountryMatch[1])
      result.dutyRate = result.thirdCountryDuty
    }
  }
  
  // 检查反倾销税
  if (html.includes('anti-dumping') || html.includes('Anti-dumping')) {
    result.hasAntiDumping = true
    const adMatch = html.match(/anti-dumping[^<]*?(\d+(?:\.\d+)?)\s*%/i)
    if (adMatch) {
      result.antiDumpingRate = parseFloat(adMatch[1])
    }
  }
  
  // 检查反补贴税
  if (html.includes('countervailing') || html.includes('Countervailing')) {
    result.hasCountervailing = true
    const cvMatch = html.match(/countervailing[^<]*?(\d+(?:\.\d+)?)\s*%/i)
    if (cvMatch) {
      result.countervailingRate = parseFloat(cvMatch[1])
    }
  }
  
  // 检查配额
  if (html.includes('quota') || html.includes('Quota') || html.includes('TRQ')) {
    result.hasQuota = true
  }
  
  // 检查许可证要求
  if (html.includes('licence') || html.includes('License') || html.includes('permit')) {
    result.requiresLicense = true
  }
  
  // 检查检验检疫要求
  if (html.includes('phytosanitary') || html.includes('sanitary') || html.includes('veterinary')) {
    result.requiresSPS = true
  }
  
  return result
}

/**
 * 解析商品描述页面
 */
function parseGoodsDescription(html) {
  // 提取商品描述层级
  const descriptions = []
  
  // 尝试从页面中提取描述文本
  // TARIC 使用多级描述结构
  const descPatterns = [
    /<span[^>]*class="[^"]*goods_text[^"]*"[^>]*>([^<]+)</g,
    /<td[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)</g,
  ]
  
  for (const pattern of descPatterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      const text = stripHtml(match[1])
      if (text && text.length > 2 && !descriptions.includes(text)) {
        descriptions.push(text)
      }
    }
  }
  
  // 如果找到描述，合并为完整描述
  if (descriptions.length > 0) {
    return descriptions.join(' - ')
  }
  
  return null
}

/**
 * 获取 HS 编码的详细措施信息
 * @param {string} hsCode - HS 编码
 * @param {string} originCountry - 原产国代码
 */
export async function getMeasureDetails(hsCode, originCountry = '') {
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  const dateStr = getCurrentDateStr()
  
  const url = `${TARIC_BASE_URL}/measures_details.jsp?Lang=en&SimDate=${dateStr}&Taric=${normalizedCode}&Area=${originCountry || ''}&Domain=TARIC`
  
  try {
    const html = await httpGet(url)
    return parseMeasureDetailsPage(html)
  } catch (error) {
    console.error(`获取措施详情失败 [${hsCode}]:`, error.message)
    throw error
  }
}

/**
 * 解析措施详情页面
 */
function parseMeasureDetailsPage(html) {
  const measures = []
  
  // 提取措施类型和税率
  // 这里需要根据实际 HTML 结构调整
  const measureBlocks = html.split(/measure_row|measure-row/i)
  
  for (const block of measureBlocks) {
    if (block.length < 100) continue
    
    const measure = {
      type: null,
      rate: null,
      geographicalArea: null,
      startDate: null,
      endDate: null,
      regulation: null,
      conditions: []
    }
    
    // 提取税率
    const rateMatch = block.match(/(\d+(?:\.\d+)?)\s*%/)
    if (rateMatch) {
      measure.rate = parseFloat(rateMatch[1])
    }
    
    // 提取地理区域代码
    const areaMatch = block.match(/area[^>]*>([A-Z0-9]+)</i)
    if (areaMatch) {
      measure.geographicalArea = areaMatch[1]
    }
    
    // 提取日期
    const dateMatches = block.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/g)
    if (dateMatches && dateMatches.length >= 1) {
      measure.startDate = dateMatches[0]
      if (dateMatches.length >= 2) {
        measure.endDate = dateMatches[1]
      }
    }
    
    // 提取法规编号
    const regMatch = block.match(/Regulation[^>]*>([^<]+)</i) || block.match(/R\d{4}\/\d+/)
    if (regMatch) {
      measure.regulation = regMatch[1] || regMatch[0]
    }
    
    if (measure.rate !== null || measure.type) {
      measures.push(measure)
    }
  }
  
  return { measures }
}

/**
 * 批量查询多个 HS 编码
 * @param {string[]} hsCodes - HS 编码数组
 * @param {string} originCountry - 原产国代码
 * @param {Object} options - 选项
 */
export async function batchLookup(hsCodes, originCountry = '', options = {}) {
  const { concurrency = 3, delay = 500 } = options
  const results = []
  const errors = []
  
  // 分批处理以避免过载
  for (let i = 0; i < hsCodes.length; i += concurrency) {
    const batch = hsCodes.slice(i, i + concurrency)
    
    const batchResults = await Promise.allSettled(
      batch.map(code => lookupTaricCode(code, originCountry))
    )
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      const code = batch[j]
      
      if (result.status === 'fulfilled') {
        results.push({ hsCode: code, data: result.value })
      } else {
        errors.push({ hsCode: code, error: result.reason.message })
      }
    }
    
    // 添加延迟以避免请求过快
    if (i + concurrency < hsCodes.length && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return { results, errors, totalCount: hsCodes.length }
}

/**
 * 获取国家/地区代码列表
 */
export async function getCountryCodes() {
  const cacheKey = 'taric_country_codes'
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { countries: cached, fromCache: true }
  }
  
  try {
    const dateStr = getCurrentDateStr()
    const url = `${TARIC_BASE_URL}/area_combo/area_combo_en_${dateStr}.js`
    
    const jsContent = await httpGet(url)
    
    // 解析 JavaScript 数组
    const arrayMatch = jsContent.match(/areacomboarray\s*=\s*\[([\s\S]+)\]/)
    if (!arrayMatch) {
      throw new Error('无法解析国家代码数据')
    }
    
    // 安全地解析数组
    const countries = []
    const itemPattern = /\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]/g
    let match
    while ((match = itemPattern.exec(arrayMatch[1])) !== null) {
      countries.push({
        code: match[1],
        iso: match[2],
        name: match[3],
        type: match[4] // C = Country, R = Region
      })
    }
    
    setCache(cacheKey, countries, 7 * 24 * 60 * 60 * 1000) // 缓存 7 天
    
    return { countries, fromCache: false }
  } catch (error) {
    console.error('获取国家代码失败:', error.message)
    throw error
  }
}

/**
 * 检查 API 可用性
 */
export async function checkApiHealth() {
  try {
    const startTime = Date.now()
    const dateStr = getCurrentDateStr()
    
    // 测试基本连接
    const url = `${TARIC_BASE_URL}/taric_consultation.jsp?Lang=en`
    await httpGet(url, { timeout: 10000 })
    
    const responseTime = Date.now() - startTime
    
    return {
      available: true,
      responseTime,
      timestamp: new Date().toISOString(),
      cacheStats: getCacheStats()
    }
  } catch (error) {
    return {
      available: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      cacheStats: getCacheStats()
    }
  }
}

// ==================== 导出 ====================

// 重新导出中国反倾销税相关函数
export { 
  findChinaAntiDumpingRate,
  getAllChinaAntiDumpingRates,
  getAntiDumpingHsCodes,
  hasAntiDumpingDuty,
  getAntiDumpingSummary
} from './chinaAntiDumpingRates.js'

export default {
  lookupTaricCode,
  getMeasureDetails,
  batchLookup,
  getCountryCodes,
  checkApiHealth,
  clearCache,
  getCacheStats,
  // 中国反倾销税
  findChinaAntiDumpingRate
}
