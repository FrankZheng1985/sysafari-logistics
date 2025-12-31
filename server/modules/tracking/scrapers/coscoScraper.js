/**
 * COSCO (中远海运) 集装箱追踪爬虫
 * 
 * 目标网站: https://elines.coscoshipping.com/ebusiness/cargoTracking
 * 数据格式: JSON API
 * 
 * 支持：
 * - 提单号查询 (COSU开头)
 * - 集装箱号查询 (COSU/OOCL前缀)
 */

import { BaseScraper, createTrackingResult, parseDate } from './baseScraper.js'

// COSCO API 端点
const COSCO_API_BASE = 'https://elines.coscoshipping.com/ebtracking/public'

// COSCO 追踪查询 API
const TRACK_BY_BL_API = `${COSCO_API_BASE}/cargoTrackingByBl`
const TRACK_BY_CONTAINER_API = `${COSCO_API_BASE}/cargoTrackingByContainer`

/**
 * COSCO 爬虫类
 */
export class CoscoScraper extends BaseScraper {
  constructor() {
    super({
      name: 'COSCO',
      baseUrl: COSCO_API_BASE,
      timeout: 30000,
      maxRetries: 3,
    })
  }

  /**
   * 根据提单号追踪
   * @param {string} billNumber - 提单号 (如 COSU6435174570)
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByBillNumber(billNumber) {
    if (!billNumber) {
      throw new Error('提单号不能为空')
    }

    // 检查缓存
    const cacheKey = `cosco_bl_${billNumber}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    console.log(`[COSCO] 按提单号查询: ${billNumber}`)

    try {
      const response = await this.fetchWithRetry(TRACK_BY_BL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://elines.coscoshipping.com',
          'Referer': 'https://elines.coscoshipping.com/ebusiness/cargoTracking',
        },
        body: JSON.stringify({
          blNo: billNumber.toUpperCase(),
        }),
      })

      const data = await response.json()
      
      if (data.code !== '0' && data.code !== 0) {
        console.warn(`[COSCO] 查询失败: ${data.message || data.msg || '未知错误'}`)
        return null
      }

      const result = this.normalizeData(data.data || data.content || data)
      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      console.error(`[COSCO] 提单查询失败:`, error.message)
      return null
    }
  }

  /**
   * 根据集装箱号追踪
   * @param {string} containerNumber - 集装箱号 (如 COSU1234567)
   * @returns {Promise<Object>} 追踪结果
   */
  async trackByContainer(containerNumber) {
    if (!containerNumber) {
      throw new Error('集装箱号不能为空')
    }

    // 检查缓存
    const cacheKey = `cosco_cntr_${containerNumber}`
    const cached = this.getFromCache(cacheKey)
    if (cached) return cached

    console.log(`[COSCO] 按集装箱号查询: ${containerNumber}`)

    try {
      const response = await this.fetchWithRetry(TRACK_BY_CONTAINER_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://elines.coscoshipping.com',
          'Referer': 'https://elines.coscoshipping.com/ebusiness/cargoTracking',
        },
        body: JSON.stringify({
          containerNo: containerNumber.toUpperCase(),
        }),
      })

      const data = await response.json()
      
      if (data.code !== '0' && data.code !== 0) {
        console.warn(`[COSCO] 查询失败: ${data.message || data.msg || '未知错误'}`)
        return null
      }

      const result = this.normalizeData(data.data || data.content || data)
      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      console.error(`[COSCO] 集装箱查询失败:`, error.message)
      return null
    }
  }

  /**
   * 标准化 COSCO 响应数据
   * @param {Object} rawData - COSCO 原始数据
   * @returns {Object} 标准化数据
   */
  normalizeData(rawData) {
    if (!rawData) return null

    // COSCO API 可能返回数组或单个对象
    const shipment = Array.isArray(rawData) ? rawData[0] : rawData
    
    if (!shipment) return null

    // 提取容器信息（如果有多个容器）
    const containers = shipment.containers || shipment.containerList || []
    const firstContainer = containers[0] || {}

    // 提取事件列表
    const events = this.normalizeEvents(
      shipment.trackingPath || 
      shipment.cargoTrackingList || 
      firstContainer.trackingPath ||
      []
    )

    return createTrackingResult({
      containerNumber: firstContainer.containerNo || shipment.containerNo || null,
      billNumber: shipment.blNo || shipment.billOfLading || null,
      carrier: 'COSCO Shipping',
      carrierCode: 'COSU',
      vessel: shipment.vesselName || shipment.vessel || null,
      voyage: shipment.voyage || shipment.voyageNo || null,
      portOfLoading: shipment.pol || shipment.portOfLoading || shipment.loadPort || null,
      portOfDischarge: shipment.pod || shipment.portOfDischarge || shipment.dischargePort || null,
      etd: parseDate(shipment.etd || shipment.estimatedDepartureDate),
      eta: parseDate(shipment.eta || shipment.estimatedArrivalDate),
      atd: parseDate(shipment.atd || shipment.actualDepartureDate),
      ata: parseDate(shipment.ata || shipment.actualArrivalDate),
      status: this.mapStatus(shipment.status || shipment.currentStatus),
      containerType: firstContainer.containerType || firstContainer.cntrType || null,
      sealNumber: firstContainer.sealNo || firstContainer.sealNumber || null,
      grossWeight: parseFloat(shipment.grossWeight) || null,
      volume: parseFloat(shipment.volume || shipment.measurement) || null,
      events,
    }, 'cosco_scraper')
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
      date: parseDate(event.eventDate || event.timeOfIssue || event.date),
      time: event.eventTime || event.time || null,
      location: event.location || event.place || event.port || null,
      event: event.eventDescription || event.event || event.status || null,
      vessel: event.vessel || event.vesselName || null,
      voyage: event.voyage || event.voyageNo || null,
    })).filter(e => e.date || e.event)
  }

  /**
   * 映射状态到标准状态
   * @param {string} status - COSCO 状态
   * @returns {string} 标准状态
   */
  mapStatus(status) {
    if (!status) return 'UNKNOWN'
    
    const statusLower = status.toLowerCase()
    
    if (statusLower.includes('delivered') || statusLower.includes('完成')) {
      return 'DELIVERED'
    }
    if (statusLower.includes('arrived') || statusLower.includes('到港')) {
      return 'ARRIVED'
    }
    if (statusLower.includes('discharged') || statusLower.includes('卸货')) {
      return 'DISCHARGED'
    }
    if (statusLower.includes('departed') || statusLower.includes('离港')) {
      return 'DEPARTED'
    }
    if (statusLower.includes('loaded') || statusLower.includes('装船')) {
      return 'LOADED'
    }
    if (statusLower.includes('transit') || statusLower.includes('运输')) {
      return 'IN_TRANSIT'
    }
    if (statusLower.includes('booked') || statusLower.includes('订舱')) {
      return 'BOOKED'
    }
    
    return 'IN_TRANSIT'
  }
}

// 导出单例
export const coscoScraper = new CoscoScraper()

export default coscoScraper

