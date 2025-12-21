/**
 * 承运商API适配器基类
 * 定义标准接口，所有承运商适配器必须实现这些方法
 */

export class BaseCarrierAdapter {
  constructor(config = {}) {
    this.carrierCode = config.carrierCode || 'UNKNOWN'
    this.carrierName = config.carrierName || '未知承运商'
    this.apiConfig = config.apiConfig || {}
    this.timeout = config.timeout || 30000
  }

  /**
   * 获取适配器信息
   */
  getInfo() {
    return {
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      apiEnabled: this.isConfigured(),
      supportedFeatures: this.getSupportedFeatures()
    }
  }

  /**
   * 检查API是否已配置
   */
  isConfigured() {
    return false
  }

  /**
   * 获取支持的功能列表
   */
  getSupportedFeatures() {
    return {
      createShipment: false,
      getLabel: false,
      getTracking: false,
      cancelShipment: false,
      validateAddress: false,
      getRates: false
    }
  }

  /**
   * 创建运单 (下单)
   * @param {Object} shipmentData - 运单数据
   * @returns {Promise<Object>} 创建结果
   */
  async createShipment(shipmentData) {
    throw new Error(`${this.carrierName} 适配器未实现 createShipment 方法`)
  }

  /**
   * 获取面单
   * @param {string} trackingNo - 运单号
   * @param {Object} options - 选项 (格式、尺寸等)
   * @returns {Promise<Object>} 面单数据
   */
  async getLabel(trackingNo, options = {}) {
    throw new Error(`${this.carrierName} 适配器未实现 getLabel 方法`)
  }

  /**
   * 查询轨迹
   * @param {string} trackingNo - 运单号
   * @returns {Promise<Object>} 轨迹数据
   */
  async getTracking(trackingNo) {
    throw new Error(`${this.carrierName} 适配器未实现 getTracking 方法`)
  }

  /**
   * 取消运单
   * @param {string} trackingNo - 运单号
   * @returns {Promise<Object>} 取消结果
   */
  async cancelShipment(trackingNo) {
    throw new Error(`${this.carrierName} 适配器未实现 cancelShipment 方法`)
  }

  /**
   * 地址校验
   * @param {Object} address - 地址信息
   * @returns {Promise<Object>} 校验结果
   */
  async validateAddress(address) {
    throw new Error(`${this.carrierName} 适配器未实现 validateAddress 方法`)
  }

  /**
   * 获取实时报价
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 报价结果
   */
  async getRates(params) {
    throw new Error(`${this.carrierName} 适配器未实现 getRates 方法`)
  }

  /**
   * 标准化地址格式
   */
  normalizeAddress(address) {
    return {
      name: address.name || address.contactName || '',
      company: address.company || address.companyName || '',
      street1: address.street1 || address.address || address.addressLine1 || '',
      street2: address.street2 || address.addressLine2 || '',
      city: address.city || '',
      state: address.state || address.province || '',
      postalCode: address.postalCode || address.zipCode || address.postcode || '',
      country: address.country || address.countryCode || '',
      phone: address.phone || address.telephone || '',
      email: address.email || ''
    }
  }

  /**
   * 标准化运单数据格式
   */
  normalizeShipmentData(data) {
    return {
      sender: this.normalizeAddress(data.sender || data.shipper || {}),
      receiver: this.normalizeAddress(data.receiver || data.consignee || data.recipient || {}),
      packages: this.normalizePackages(data.packages || data.parcels || [data]),
      service: data.service || data.serviceType || 'standard',
      reference: data.reference || data.referenceNo || '',
      description: data.description || data.goodsDescription || '',
      value: data.value || data.declaredValue || 0,
      currency: data.currency || 'EUR'
    }
  }

  /**
   * 标准化包裹数据
   */
  normalizePackages(packages) {
    if (!Array.isArray(packages)) {
      packages = [packages]
    }

    return packages.map((pkg, index) => ({
      packageNo: pkg.packageNo || `PKG${index + 1}`,
      weight: parseFloat(pkg.weight) || 0,
      length: parseFloat(pkg.length) || 0,
      width: parseFloat(pkg.width) || 0,
      height: parseFloat(pkg.height) || 0,
      description: pkg.description || ''
    }))
  }

  /**
   * 标准化轨迹事件
   */
  normalizeTrackingEvent(event) {
    return {
      timestamp: event.timestamp || event.time || event.eventTime || new Date().toISOString(),
      status: event.status || event.eventCode || '',
      description: event.description || event.eventDescription || event.message || '',
      location: event.location || event.eventLocation || '',
      rawData: event
    }
  }

  /**
   * HTTP请求封装
   */
  async makeRequest(url, options = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorBody}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('请求超时')
      }
      throw error
    }
  }

  /**
   * 日志记录
   */
  log(level, message, data = {}) {
    const logData = {
      carrier: this.carrierCode,
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    }
    
    if (level === 'error') {
      console.error(`[${this.carrierCode}]`, message, data)
    } else {
      console.log(`[${this.carrierCode}]`, message, data)
    }
  }
}

export default BaseCarrierAdapter
