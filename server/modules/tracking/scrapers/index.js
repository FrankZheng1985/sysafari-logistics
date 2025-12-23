/**
 * 集装箱追踪爬虫路由
 * 
 * 根据集装箱号/提单号前缀自动选择对应的爬虫
 * 支持通过船公司名称指定爬虫（用于纯数字提单号）
 * 
 * 支持的船公司：
 * - COSCO (COSU, OOCL)
 * - Maersk (MAEU, MSKU)
 * - Evergreen (长荣) - 纯数字提单号
 * - 其他船公司 -> Trackipi 聚合
 */

import { coscoScraper } from './coscoScraper.js'
import { maerskScraper } from './maerskScraper.js'
import { trackipiScraper } from './trackipiScraper.js'
import { clearCache, getCacheStats } from './baseScraper.js'

// 船公司代码前缀映射
const CARRIER_PREFIX_MAP = {
  // COSCO / OOCL
  'COSU': coscoScraper,
  'OOCL': coscoScraper,
  'OOCU': coscoScraper,
  
  // Maersk
  'MAEU': maerskScraper,
  'MSKU': maerskScraper,
  'MRKU': maerskScraper,
  'MRSU': maerskScraper,
  
  // MSC (暂时用 Trackipi)
  'MSCU': trackipiScraper,
  'MEDU': trackipiScraper,
  
  // CMA CGM (暂时用 Trackipi)
  'CMAU': trackipiScraper,
  'CGMU': trackipiScraper,
  
  // Hapag-Lloyd (暂时用 Trackipi)
  'HLCU': trackipiScraper,
  'HLXU': trackipiScraper,
  
  // Evergreen (暂时用 Trackipi)
  'EGLV': trackipiScraper,
  'EGHU': trackipiScraper,
  'EMCU': trackipiScraper,
  'EISU': trackipiScraper,
  'EGSU': trackipiScraper,
  
  // Yang Ming (暂时用 Trackipi)
  'YMLU': trackipiScraper,
  
  // ZIM (暂时用 Trackipi)
  'ZIMU': trackipiScraper,
}

// 船公司名称映射（支持中英文）- 用于纯数字提单号的船公司识别
const CARRIER_NAME_MAP = {
  // 长荣海运 / Evergreen
  '长荣海运': trackipiScraper,
  '长荣': trackipiScraper,
  'evergreen': trackipiScraper,
  'emc': trackipiScraper,
  
  // 中远海运 / COSCO
  '中远海运': coscoScraper,
  '中远': coscoScraper,
  'cosco': coscoScraper,
  'cosco shipping': coscoScraper,
  
  // 马士基 / Maersk
  '马士基': maerskScraper,
  'maersk': maerskScraper,
  
  // 地中海航运 / MSC
  '地中海航运': trackipiScraper,
  'msc': trackipiScraper,
  
  // 达飞 / CMA CGM
  '达飞': trackipiScraper,
  '达飞轮船': trackipiScraper,
  'cma cgm': trackipiScraper,
  'cma': trackipiScraper,
  
  // 赫伯罗特 / Hapag-Lloyd
  '赫伯罗特': trackipiScraper,
  'hapag-lloyd': trackipiScraper,
  'hapag': trackipiScraper,
  
  // 阳明海运 / Yang Ming
  '阳明海运': trackipiScraper,
  '阳明': trackipiScraper,
  'yang ming': trackipiScraper,
  
  // 东方海外 / OOCL
  '东方海外': coscoScraper,
  'oocl': coscoScraper,
  
  // 以星航运 / ZIM
  '以星航运': trackipiScraper,
  'zim': trackipiScraper,
}

/**
 * 根据船公司名称获取爬虫
 * @param {string} shippingCompany - 船公司名称（中文或英文）
 * @returns {BaseScraper|null} 爬虫实例
 */
function getScraperByCompanyName(shippingCompany) {
  if (!shippingCompany) return null
  
  const normalizedName = shippingCompany.toLowerCase().trim()
  
  // 直接匹配
  if (CARRIER_NAME_MAP[normalizedName]) {
    return CARRIER_NAME_MAP[normalizedName]
  }
  
  // 模糊匹配
  for (const [key, scraper] of Object.entries(CARRIER_NAME_MAP)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return scraper
    }
  }
  
  return null
}

/**
 * 识别船公司代码
 * @param {string} trackingNumber - 追踪号（集装箱号或提单号）
 * @param {string} shippingCompany - 可选，船公司名称
 * @returns {Object} { prefix: string, scraper: BaseScraper, source: string }
 */
function identifyCarrier(trackingNumber, shippingCompany) {
  // 1. 首先尝试通过船公司名称识别（用于纯数字提单号）
  if (shippingCompany) {
    const scraperByName = getScraperByCompanyName(shippingCompany)
    if (scraperByName) {
      console.log(`[ScraperRouter] 通过船公司名称识别: ${shippingCompany} -> ${scraperByName.name}`)
      return { prefix: null, scraper: scraperByName, source: 'company_name' }
    }
  }
  
  // 2. 尝试通过追踪号前缀识别
  if (!trackingNumber || trackingNumber.length < 4) {
    return { prefix: null, scraper: trackipiScraper, source: 'default' }
  }
  
  const prefix = trackingNumber.substring(0, 4).toUpperCase()
  
  // 检查前缀是否为字母（标准格式）
  if (/^[A-Z]{4}$/.test(prefix)) {
    const scraper = CARRIER_PREFIX_MAP[prefix] || trackipiScraper
    return { prefix, scraper, source: 'prefix' }
  }
  
  // 3. 纯数字提单号，使用默认爬虫
  return { prefix: null, scraper: trackipiScraper, source: 'default' }
}

/**
 * 根据集装箱号追踪
 * @param {string} containerNumber - 集装箱号 (如 COSU1234567)
 * @param {string} shippingCompany - 可选，船公司名称
 * @returns {Promise<Object>} 追踪结果
 */
export async function trackByContainer(containerNumber, shippingCompany) {
  if (!containerNumber) {
    throw new Error('集装箱号不能为空')
  }
  
  const { prefix, scraper, source } = identifyCarrier(containerNumber, shippingCompany)
  console.log(`[ScraperRouter] 集装箱追踪: ${containerNumber}, 船公司: ${shippingCompany || '未指定'}, 前缀: ${prefix || '无'}, 来源: ${source}, 使用: ${scraper.name}`)
  
  try {
    // 首先尝试识别的船公司爬虫
    let result = await scraper.trackByContainer(containerNumber)
    
    // 如果失败且不是 Trackipi，尝试 Trackipi 作为备选
    if (!result && scraper !== trackipiScraper) {
      console.log(`[ScraperRouter] ${scraper.name} 失败，尝试 Trackipi 备选`)
      result = await trackipiScraper.trackByContainer(containerNumber)
    }
    
    return result
  } catch (error) {
    console.error(`[ScraperRouter] 集装箱追踪失败:`, error.message)
    
    // 最后尝试 Trackipi
    if (scraper !== trackipiScraper) {
      try {
        return await trackipiScraper.trackByContainer(containerNumber)
      } catch (e) {
        console.error(`[ScraperRouter] Trackipi 备选也失败:`, e.message)
      }
    }
    
    return null
  }
}

/**
 * 根据提单号追踪
 * @param {string} billNumber - 提单号 (如 COSU6435174570 或纯数字 142500986170)
 * @param {string} shippingCompany - 可选，船公司名称（对于纯数字提单号必须提供）
 * @returns {Promise<Object>} 追踪结果
 */
export async function trackByBillNumber(billNumber, shippingCompany) {
  if (!billNumber) {
    throw new Error('提单号不能为空')
  }
  
  const { prefix, scraper, source } = identifyCarrier(billNumber, shippingCompany)
  console.log(`[ScraperRouter] 提单追踪: ${billNumber}, 船公司: ${shippingCompany || '未指定'}, 前缀: ${prefix || '无'}, 来源: ${source}, 使用: ${scraper.name}`)
  
  try {
    // 首先尝试识别的船公司爬虫
    let result = await scraper.trackByBillNumber(billNumber)
    
    // 如果失败且不是 Trackipi，尝试 Trackipi 作为备选
    if (!result && scraper !== trackipiScraper) {
      console.log(`[ScraperRouter] ${scraper.name} 失败，尝试 Trackipi 备选`)
      result = await trackipiScraper.trackByBillNumber(billNumber)
    }
    
    return result
  } catch (error) {
    console.error(`[ScraperRouter] 提单追踪失败:`, error.message)
    
    // 最后尝试 Trackipi
    if (scraper !== trackipiScraper) {
      try {
        return await trackipiScraper.trackByBillNumber(billNumber)
      } catch (e) {
        console.error(`[ScraperRouter] Trackipi 备选也失败:`, e.message)
      }
    }
    
    return null
  }
}

/**
 * 智能追踪（自动判断是集装箱号还是提单号，并同时获取关联信息）
 * @param {string} trackingNumber - 追踪号
 * @param {string} shippingCompany - 可选，船公司名称（对于纯数字提单号需要提供）
 * @returns {Promise<Object>} 追踪结果（包含提单和集装箱信息）
 */
export async function smartTrack(trackingNumber, shippingCompany) {
  if (!trackingNumber) {
    throw new Error('追踪号不能为空')
  }
  
  // 判断是集装箱号还是提单号
  // 集装箱号格式：4字母 + 7数字 (如 COSU1234567)
  // 提单号格式：4字母 + 10数字 (如 COSU6435174570) 或纯数字 (如 142500986170)
  const isContainerNumber = /^[A-Z]{4}\d{7}$/.test(trackingNumber.toUpperCase())
  
  console.log(`[ScraperRouter] 智能追踪: ${trackingNumber}, 船公司: ${shippingCompany || '未指定'}, 类型: ${isContainerNumber ? '集装箱号' : '提单号'}`)
  
  let primaryResult = null
  let secondaryResult = null
  
  if (isContainerNumber) {
    // 主要查询：通过集装箱号查询
    primaryResult = await trackByContainer(trackingNumber, shippingCompany)
    
    // 如果找到了提单号，尝试通过提单号再查询一次，获取更多信息
    if (primaryResult && primaryResult.billNumber) {
      console.log(`[ScraperRouter] 发现提单号 ${primaryResult.billNumber}，尝试获取更多信息...`)
      try {
        secondaryResult = await trackByBillNumber(primaryResult.billNumber, shippingCompany)
      } catch (error) {
        console.log(`[ScraperRouter] 通过提单号查询失败: ${error.message}`)
      }
    }
  } else {
    // 主要查询：通过提单号查询
    primaryResult = await trackByBillNumber(trackingNumber, shippingCompany)
    
    // 如果找到了集装箱号，尝试通过集装箱号再查询一次，获取更多信息
    if (primaryResult && primaryResult.containerNumber) {
      console.log(`[ScraperRouter] 发现集装箱号 ${primaryResult.containerNumber}，尝试获取更多信息...`)
      try {
        secondaryResult = await trackByContainer(primaryResult.containerNumber, shippingCompany)
      } catch (error) {
        console.log(`[ScraperRouter] 通过集装箱号查询失败: ${error.message}`)
      }
    }
  }
  
  // 合并两次查询的结果
  if (primaryResult && secondaryResult) {
    return mergeTrackingResults(primaryResult, secondaryResult)
  }
  
  return primaryResult
}

/**
 * 合并两次查询的追踪结果
 * @param {Object} primary - 主要结果
 * @param {Object} secondary - 次要结果
 * @returns {Object} 合并后的结果
 */
function mergeTrackingResults(primary, secondary) {
  if (!primary) return secondary
  if (!secondary) return primary
  
  console.log(`[ScraperRouter] 合并追踪结果...`)
  
  // 合并事件列表（去重）
  const mergedEvents = [...(primary.events || []), ...(secondary.events || [])]
  const uniqueEvents = []
  const eventKeys = new Set()
  
  mergedEvents.forEach(event => {
    const key = `${event.date}_${event.location}_${event.event}`
    if (!eventKeys.has(key)) {
      eventKeys.add(key)
      uniqueEvents.push(event)
    }
  })
  
  // 按日期排序（最新的在前）
  uniqueEvents.sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date) - new Date(a.date)
  })
  
  // 合并结果，优先使用有值的字段
  return {
    ...primary,
    billNumber: primary.billNumber || secondary.billNumber,
    containerNumber: primary.containerNumber || secondary.containerNumber,
    vessel: primary.vessel || secondary.vessel,
    voyage: primary.voyage || secondary.voyage,
    portOfLoading: primary.portOfLoading || secondary.portOfLoading,
    portOfDischarge: primary.portOfDischarge || secondary.portOfDischarge,
    etd: primary.etd || secondary.etd,
    eta: primary.eta || secondary.eta,
    atd: primary.atd || secondary.atd,
    ata: primary.ata || secondary.ata,
    containerType: primary.containerType || secondary.containerType,
    sealNumber: primary.sealNumber || secondary.sealNumber,
    grossWeight: primary.grossWeight || secondary.grossWeight,
    volume: primary.volume || secondary.volume,
    events: uniqueEvents,
    // 标记这是合并后的结果
    merged: true,
    sources: [
      primary.source || 'unknown',
      secondary.source || 'unknown'
    ].filter((v, i, a) => a.indexOf(v) === i) // 去重
  }
}

/**
 * 获取支持的船公司列表
 * @returns {Array} 船公司列表
 */
export function getSupportedCarriers() {
  return [
    { code: 'COSU', name: 'COSCO Shipping', scraper: 'coscoScraper' },
    { code: 'OOCL', name: 'OOCL', scraper: 'coscoScraper' },
    { code: 'MAEU', name: 'Maersk', scraper: 'maerskScraper' },
    { code: 'MSKU', name: 'Maersk (Sealand)', scraper: 'maerskScraper' },
    { code: 'MSCU', name: 'MSC', scraper: 'trackipiScraper' },
    { code: 'CMAU', name: 'CMA CGM', scraper: 'trackipiScraper' },
    { code: 'HLCU', name: 'Hapag-Lloyd', scraper: 'trackipiScraper' },
    { code: 'EGLV', name: 'Evergreen', scraper: 'trackipiScraper' },
    { code: 'YMLU', name: 'Yang Ming', scraper: 'trackipiScraper' },
    { code: 'ZIMU', name: 'ZIM', scraper: 'trackipiScraper' },
    { code: 'OTHER', name: '其他船公司', scraper: 'trackipiScraper' },
  ]
}

/**
 * 清理所有爬虫缓存
 */
export { clearCache, getCacheStats }

// 导出单个爬虫（用于测试）
export { coscoScraper, maerskScraper, trackipiScraper }

export default {
  trackByContainer,
  trackByBillNumber,
  smartTrack,
  getSupportedCarriers,
  clearCache,
  getCacheStats,
}

