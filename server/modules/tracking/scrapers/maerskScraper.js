/**
 * Maersk (马士基) 集装箱追踪爬虫
 * 
 * 目标网站: https://www.maersk.com/tracking
 * 数据格式: JSON API
 * 
 * 支持：
 * - 提单号查询 (MAEU/MSKU开头)
 * - 集装箱号查询
 */

import { BaseScraper, createTrackingResult, parseDate } from './baseScraper.js'

// Maersk 追踪 API
const MAERSK_API_BASE = 'https://api.maersk.com/track'
const MAERSK_TRACKING_URL = 'https://www.maersk.com/tracking'

/**
 * Maersk 爬虫类
 */
export class MaerskScraper extends BaseScraper {
  constructor() {
    super({
      name: 'Maersk',
      baseUrl: MAERSK_API_BASE,
      timeout: 30000,
      maxRetries: 3,
    })
  }

  /**
   * 根据提单号追踪
   * @param {string} billNumber - 提单号 (如 MAEU1234567890)
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByBillNumber(billNumber) {
    if (!billNumber) {
      throw new Error('提单号不能为空')
    }

    // 检查缓存
    const cacheKey = `maersk_bl_${billNumber}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    console.log(`[Maersk] 按提单号查询: ${billNumber}`)

    try {
      // 尝试公开 API
      const result = await this.fetchFromPublicApi(billNumber, 'billOfLading')
      if (result) {
        this.setCache(cacheKey, result)
        return result
      }

      // 备选：解析网页
      const htmlResult = await this.fetchFromHtml(billNumber)
      if (htmlResult) {
        this.setCache(cacheKey, htmlResult)
        return htmlResult
      }

      return null
    } catch (error) {
      console.error(`[Maersk] 提单查询失败:`, error.message)
      return null
    }
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
    const cacheKey = `maersk_cntr_${containerNumber}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    console.log(`[Maersk] 按集装箱号查询: ${containerNumber}`)

    try {
      const result = await this.fetchFromPublicApi(containerNumber, 'container')
      if (result) {
        this.setCache(cacheKey, result)
        return result
      }

      // 备选：解析网页
      const htmlResult = await this.fetchFromHtml(containerNumber)
      if (htmlResult) {
        this.setCache(cacheKey, htmlResult)
        return htmlResult
      }

      return null
    } catch (error) {
      console.error(`[Maersk] 集装箱查询失败:`, error.message)
      return null
    }
  }

  /**
   * 从 Maersk 公开 API 获取数据
   * @param {string} trackingNumber - 追踪号
   * @param {string} type - 类型 (billOfLading/container)
   * @returns {Promise<Object>} 追踪结果
   */
  async fetchFromPublicApi(trackingNumber, type = 'billOfLading') {
    try {
      // Maersk 公开追踪 API
      const apiUrl = `${MAERSK_API_BASE}/${trackingNumber}?type=${type}`
      
      const response = await this.fetchWithRetry(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'Referer': MAERSK_TRACKING_URL,
        },
      })

      const data = await response.json()
      return this.normalizeData(data)
    } catch (error) {
      console.log(`[Maersk] API 请求失败: ${error.message}`)
      return null
    }
  }

  /**
   * 从网页获取数据
   * @param {string} trackingNumber - 追踪号
   * @returns {Promise<Object>} 追踪结果
   */
  async fetchFromHtml(trackingNumber) {
    try {
      const pageUrl = `${MAERSK_TRACKING_URL}/${encodeURIComponent(trackingNumber)}`
      const html = await this.fetchHtml(pageUrl)
      
      return this.parseHtmlResponse(html, trackingNumber)
    } catch (error) {
      console.error(`[Maersk] HTML 解析失败:`, error.message)
      return null
    }
  }

  /**
   * 解析 HTML 响应
   * @param {string} html - HTML 内容
   * @param {string} trackingNumber - 追踪号
   * @returns {Object} 追踪结果
   */
  parseHtmlResponse(html, trackingNumber) {
    if (!html) return null

    try {
      const result = {
        containerNumber: null,
        billNumber: null,
        carrier: 'Maersk',
        carrierCode: 'MAEU',
        vessel: null,
        voyage: null,
        portOfLoading: null,
        portOfDischarge: null,
        etd: null,
        eta: null,
        status: null,
        events: [],
      }

      // 判断是集装箱号还是提单号
      if (/^[A-Z]{4}\d{7}$/.test(trackingNumber)) {
        result.containerNumber = trackingNumber
      } else {
        result.billNumber = trackingNumber
      }

      // 尝试提取 JSON 数据（Maersk 页面可能嵌入 JSON）
      const jsonMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1])
          const pageProps = jsonData?.props?.pageProps
          if (pageProps?.tracking || pageProps?.shipment) {
            return this.normalizeData(pageProps.tracking || pageProps.shipment)
          }
        } catch (e) {
          // JSON 解析失败，继续使用正则
        }
      }

      // 提取船名
      const vesselMatch = html.match(/(?:Vessel|Ship)[:\s]*([A-Z][A-Za-z0-9\s]+?)(?:<|,|\n)/i)
      if (vesselMatch) result.vessel = vesselMatch[1].trim()

      // 提取航次
      const voyageMatch = html.match(/(?:Voyage)[:\s]*([A-Z0-9\-]+)/i)
      if (voyageMatch) result.voyage = voyageMatch[1].trim()

      // 提取起运港
      const polMatch = html.match(/(?:Origin|From|POL)[:\s]*([A-Za-z\s,]+?)(?:<|\n)/i)
      if (polMatch) result.portOfLoading = polMatch[1].trim()

      // 提取目的港
      const podMatch = html.match(/(?:Destination|To|POD)[:\s]*([A-Za-z\s,]+?)(?:<|\n)/i)
      if (podMatch) result.portOfDischarge = podMatch[1].trim()

      // 提取 ETA
      const etaMatch = html.match(/(?:ETA|Estimated\s*Arrival)[:\s]*(\d{1,2}[-\/\s][A-Za-z]{3}[-\/\s]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i)
      if (etaMatch) result.eta = parseDate(etaMatch[1])

      // 提取状态
      const statusMatch = html.match(/(?:Status)[:\s]*([A-Za-z\s]+?)(?:<|\n)/i)
      if (statusMatch) result.status = statusMatch[1].trim()

      return createTrackingResult(result, 'maersk_scraper')
    } catch (error) {
      console.error(`[Maersk] HTML 解析错误:`, error.message)
      return null
    }
  }

  /**
   * 标准化 Maersk 数据
   * @param {Object} rawData - 原始数据
   * @returns {Object} 标准化数据
   */
  normalizeData(rawData) {
    if (!rawData) return null

    // 适配不同的数据结构
    const tracking = rawData.tracking || rawData.shipment || rawData.data || rawData
    
    if (!tracking) return null

    // 提取容器信息
    const containers = tracking.containers || tracking.equipment || []
    const firstContainer = containers[0] || {}

    // 提取事件列表
    const events = this.normalizeEvents(
      tracking.events || tracking.milestones || tracking.history || []
    )

    return createTrackingResult({
      containerNumber: firstContainer.containerNumber || firstContainer.equipmentNumber || tracking.containerNumber || null,
      billNumber: tracking.billOfLadingNumber || tracking.blNumber || tracking.documentNumber || null,
      carrier: 'Maersk',
      carrierCode: 'MAEU',
      vessel: tracking.vessel?.name || tracking.vesselName || null,
      voyage: tracking.vessel?.voyage || tracking.voyageNumber || null,
      portOfLoading: tracking.origin?.name || tracking.portOfLoading || null,
      portOfDischarge: tracking.destination?.name || tracking.portOfDischarge || null,
      etd: parseDate(tracking.estimatedDeparture || tracking.etd),
      eta: parseDate(tracking.estimatedArrival || tracking.eta),
      atd: parseDate(tracking.actualDeparture || tracking.atd),
      ata: parseDate(tracking.actualArrival || tracking.ata),
      status: this.mapStatus(tracking.status || tracking.currentStatus),
      containerType: firstContainer.containerType || firstContainer.type || null,
      sealNumber: firstContainer.sealNumber || null,
      grossWeight: parseFloat(tracking.weight) || null,
      volume: parseFloat(tracking.volume) || null,
      events,
    }, 'maersk_scraper')
  }

  /**
   * 标准化事件列表
   * @param {Array} rawEvents - 原始事件列表
   * @returns {Array} 标准化事件列表
   */
  normalizeEvents(rawEvents) {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return []
    }

    return rawEvents.map(event => ({
      date: parseDate(event.timestamp || event.date || event.dateTime),
      time: event.time || null,
      location: event.location?.name || event.location || event.place || null,
      event: event.description || event.event || event.status || event.eventName || null,
      vessel: event.vessel?.name || event.vessel || null,
      voyage: event.vessel?.voyage || event.voyage || null,
    })).filter(e => e.date || e.event)
  }

  /**
   * 映射状态
   * @param {string} status - 原始状态
   * @returns {string} 标准状态
   */
  mapStatus(status) {
    if (!status) return 'UNKNOWN'
    
    const statusLower = status.toLowerCase()
    
    if (statusLower.includes('delivered')) return 'DELIVERED'
    if (statusLower.includes('arrived') || statusLower.includes('berthed')) return 'ARRIVED'
    if (statusLower.includes('discharged') || statusLower.includes('unloaded')) return 'DISCHARGED'
    if (statusLower.includes('departed') || statusLower.includes('sailed')) return 'DEPARTED'
    if (statusLower.includes('loaded') || statusLower.includes('on board')) return 'LOADED'
    if (statusLower.includes('transit') || statusLower.includes('underway')) return 'IN_TRANSIT'
    if (statusLower.includes('gate') && statusLower.includes('out')) return 'GATE_OUT'
    if (statusLower.includes('gate') && statusLower.includes('in')) return 'GATE_IN'
    
    return 'IN_TRANSIT'
  }
}

// 导出单例
export const maerskScraper = new MaerskScraper()

export default maerskScraper

