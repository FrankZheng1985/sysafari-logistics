/**
 * Trackipi 聚合集装箱追踪爬虫
 * 
 * 目标网站: https://www.trackipi.com/container
 * 数据格式: HTML (需要解析)
 * 
 * 特点：
 * - 免费服务
 * - 支持多家船公司
 * - 作为其他船公司爬虫的备选方案
 */

import { BaseScraper, createTrackingResult, parseDate } from './baseScraper.js'

// Trackipi 网站 URL
const TRACKIPI_BASE = 'https://www.trackipi.com'
const TRACKIPI_SEARCH_API = `${TRACKIPI_BASE}/api/container`

/**
 * Trackipi 爬虫类
 */
export class TrackipiScraper extends BaseScraper {
  constructor() {
    super({
      name: 'Trackipi',
      baseUrl: TRACKIPI_BASE,
      timeout: 45000, // Trackipi 可能较慢
      maxRetries: 2,
    })
  }

  /**
   * 根据集装箱号追踪
   * @param {string} containerNumber - 集装箱号
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByContainer(containerNumber) {
    if (!containerNumber) {
      throw new Error('集装箱号不能为空')
    }

    // 检查缓存
    const cacheKey = `trackipi_cntr_${containerNumber}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    console.log(`[Trackipi] 按集装箱号查询: ${containerNumber}`)

    try {
      // 尝试使用 API 接口
      const result = await this.fetchFromApi(containerNumber)
      if (result) {
        this.setCache(cacheKey, result)
        return result
      }

      // 如果 API 失败，尝试解析网页
      const htmlResult = await this.fetchFromHtml(containerNumber)
      if (htmlResult) {
        this.setCache(cacheKey, htmlResult)
        return htmlResult
      }

      return null
    } catch (error) {
      console.error(`[Trackipi] 查询失败:`, error.message)
      return null
    }
  }

  /**
   * 根据提单号追踪（Trackipi 主要支持集装箱号）
   * @param {string} billNumber - 提单号
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByBillNumber(billNumber) {
    // Trackipi 主要通过集装箱号查询
    // 尝试直接用提单号查询
    console.log(`[Trackipi] 按提单号查询: ${billNumber}`)
    
    // 检查缓存
    const cacheKey = `trackipi_bl_${billNumber}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    try {
      const result = await this.fetchFromApi(billNumber)
      if (result) {
        this.setCache(cacheKey, result)
        return result
      }
      return null
    } catch (error) {
      console.error(`[Trackipi] 提单查询失败:`, error.message)
      return null
    }
  }

  /**
   * 从 API 获取数据
   * @param {string} trackingNumber - 追踪号
   * @returns {Promise<Object>} 追踪结果
   */
  async fetchFromApi(trackingNumber) {
    try {
      // Trackipi 可能使用这种 API 格式
      const apiUrl = `${TRACKIPI_SEARCH_API}/${encodeURIComponent(trackingNumber)}`
      
      const response = await this.fetchWithRetry(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Referer': `${TRACKIPI_BASE}/container`,
        },
      })

      const data = await response.json()
      return this.normalizeData(data)
    } catch (error) {
      console.log(`[Trackipi] API 请求失败，尝试 HTML 解析: ${error.message}`)
      return null
    }
  }

  /**
   * 从 HTML 页面获取数据
   * @param {string} containerNumber - 集装箱号
   * @returns {Promise<Object>} 追踪结果
   */
  async fetchFromHtml(containerNumber) {
    try {
      // 访问追踪页面
      const pageUrl = `${TRACKIPI_BASE}/container/${encodeURIComponent(containerNumber)}`
      const html = await this.fetchHtml(pageUrl)
      
      // 解析 HTML 提取数据
      return this.parseHtmlResponse(html, containerNumber)
    } catch (error) {
      console.error(`[Trackipi] HTML 解析失败:`, error.message)
      return null
    }
  }

  /**
   * 解析 HTML 响应
   * @param {string} html - HTML 内容
   * @param {string} containerNumber - 集装箱号
   * @returns {Object} 追踪结果
   */
  parseHtmlResponse(html, containerNumber) {
    if (!html) return null

    try {
      // 基本数据提取（使用正则表达式）
      const result = {
        containerNumber,
        carrier: null,
        vessel: null,
        voyage: null,
        portOfLoading: null,
        portOfDischarge: null,
        etd: null,
        eta: null,
        status: null,
        events: [],
      }

      // 尝试提取 JSON 数据（某些页面嵌入 JSON）
      const jsonMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})<\/script>/i)
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1])
          return this.normalizeData(jsonData)
        } catch (e) {
          // JSON 解析失败，继续使用正则
        }
      }

      // 提取船公司
      const carrierMatch = html.match(/(?:Carrier|Ship(?:ping)?\s*Line)[:\s]*([A-Za-z\s]+?)(?:<|,|\n)/i)
      if (carrierMatch) result.carrier = carrierMatch[1].trim()

      // 提取船名
      const vesselMatch = html.match(/(?:Vessel|Ship)[:\s]*([A-Z][A-Za-z0-9\s]+?)(?:<|,|\n)/i)
      if (vesselMatch) result.vessel = vesselMatch[1].trim()

      // 提取航次
      const voyageMatch = html.match(/(?:Voyage|VOY)[:\s]*([A-Z0-9\-]+)/i)
      if (voyageMatch) result.voyage = voyageMatch[1].trim()

      // 提取起运港
      const polMatch = html.match(/(?:POL|Port\s*of\s*Loading|Origin)[:\s]*([A-Za-z\s,]+?)(?:<|\n)/i)
      if (polMatch) result.portOfLoading = polMatch[1].trim()

      // 提取目的港
      const podMatch = html.match(/(?:POD|Port\s*of\s*Discharge|Destination)[:\s]*([A-Za-z\s,]+?)(?:<|\n)/i)
      if (podMatch) result.portOfDischarge = podMatch[1].trim()

      // 提取 ETA
      const etaMatch = html.match(/ETA[:\s]*(\d{1,2}[-\/\s][A-Za-z]{3}[-\/\s]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i)
      if (etaMatch) result.eta = parseDate(etaMatch[1])

      // 提取 ETD
      const etdMatch = html.match(/ETD[:\s]*(\d{1,2}[-\/\s][A-Za-z]{3}[-\/\s]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i)
      if (etdMatch) result.etd = parseDate(etdMatch[1])

      // 提取状态
      const statusMatch = html.match(/(?:Status|Current\s*Status)[:\s]*([A-Za-z\s]+?)(?:<|\n)/i)
      if (statusMatch) result.status = statusMatch[1].trim()

      // 提取事件列表（表格或列表格式）
      const eventsHtml = html.match(/<table[^>]*class="[^"]*tracking[^"]*"[^>]*>([\s\S]*?)<\/table>/i)
      if (eventsHtml) {
        result.events = this.parseEventsFromTable(eventsHtml[1])
      }

      return createTrackingResult(result, 'trackipi_scraper')
    } catch (error) {
      console.error(`[Trackipi] HTML 解析错误:`, error.message)
      return null
    }
  }

  /**
   * 从表格解析事件
   * @param {string} tableHtml - 表格 HTML
   * @returns {Array} 事件列表
   */
  parseEventsFromTable(tableHtml) {
    const events = []
    
    // 匹配表格行
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowMatch
    
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const row = rowMatch[1]
      
      // 提取单元格
      const cells = []
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      let cellMatch
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        // 清理 HTML 标签
        const text = cellMatch[1].replace(/<[^>]+>/g, '').trim()
        cells.push(text)
      }
      
      if (cells.length >= 2) {
        events.push({
          date: parseDate(cells[0]),
          location: cells[1] || null,
          event: cells[2] || cells[1] || null,
          vessel: cells[3] || null,
        })
      }
    }
    
    return events.filter(e => e.date || e.event)
  }

  /**
   * 标准化 Trackipi 数据
   * @param {Object} rawData - 原始数据
   * @returns {Object} 标准化数据
   */
  normalizeData(rawData) {
    if (!rawData) return null

    // 适配不同的数据结构
    const tracking = rawData.tracking || rawData.data || rawData.container || rawData
    
    if (!tracking) return null

    const events = this.normalizeEvents(
      tracking.events || tracking.history || tracking.milestones || []
    )

    return createTrackingResult({
      containerNumber: tracking.containerNumber || tracking.container_no || tracking.cntr || null,
      billNumber: tracking.billNumber || tracking.bl_no || tracking.blNo || null,
      carrier: tracking.carrier || tracking.shippingLine || tracking.line || null,
      carrierCode: tracking.carrierCode || tracking.scac || null,
      vessel: tracking.vessel || tracking.vesselName || null,
      voyage: tracking.voyage || tracking.voyageNo || null,
      portOfLoading: tracking.pol || tracking.portOfLoading || tracking.origin || null,
      portOfDischarge: tracking.pod || tracking.portOfDischarge || tracking.destination || null,
      etd: parseDate(tracking.etd || tracking.departure),
      eta: parseDate(tracking.eta || tracking.arrival),
      atd: parseDate(tracking.atd),
      ata: parseDate(tracking.ata),
      status: tracking.status || tracking.currentStatus || null,
      containerType: tracking.containerType || tracking.cntrType || null,
      sealNumber: tracking.sealNo || tracking.sealNumber || null,
      grossWeight: parseFloat(tracking.weight) || null,
      volume: parseFloat(tracking.volume) || null,
      events,
    }, 'trackipi_scraper')
  }

  /**
   * 标准化事件列表
   * @param {Array} rawEvents - 原始事件列表
   * @returns {Array} 标准化事件列表
   */
  normalizeEvents(rawEvents) {
    if (!Array.isArray(rawEvents)) return []

    return rawEvents.map(event => ({
      date: parseDate(event.date || event.timestamp || event.time),
      location: event.location || event.place || event.port || null,
      event: event.event || event.description || event.status || event.activity || null,
      vessel: event.vessel || null,
      voyage: event.voyage || null,
    })).filter(e => e.date || e.event)
  }
}

// 导出单例
export const trackipiScraper = new TrackipiScraper()

export default trackipiScraper

