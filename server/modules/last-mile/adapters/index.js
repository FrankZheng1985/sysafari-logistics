/**
 * 承运商API适配器管理器
 * 统一管理和调用各承运商API适配器
 */

import { BaseCarrierAdapter } from './baseAdapter.js'
import { DHLAdapter } from './dhlAdapter.js'
import { DPDAdapter } from './dpdAdapter.js'
import { UPSAdapter } from './upsAdapter.js'

// 注册的适配器类
const ADAPTER_REGISTRY = {
  DHL: DHLAdapter,
  DPD: DPDAdapter,
  UPS: UPSAdapter
}

// 适配器实例缓存
const adapterCache = new Map()

/**
 * 获取适配器实例
 * @param {string} carrierCode - 承运商代码
 * @param {Object} config - 配置信息
 * @returns {BaseCarrierAdapter} 适配器实例
 */
export function getAdapter(carrierCode, config = {}) {
  const code = carrierCode?.toUpperCase()
  
  // 检查缓存
  const cacheKey = `${code}_${JSON.stringify(config.apiConfig || {})}`
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey)
  }
  
  // 创建新实例
  const AdapterClass = ADAPTER_REGISTRY[code]
  
  if (!AdapterClass) {
    // 返回基础适配器（未实现具体功能）
    const baseAdapter = new BaseCarrierAdapter({
      carrierCode: code,
      carrierName: config.carrierName || code,
      ...config
    })
    return baseAdapter
  }
  
  const adapter = new AdapterClass(config)
  adapterCache.set(cacheKey, adapter)
  
  return adapter
}

/**
 * 根据承运商ID获取适配器
 * @param {number} carrierId - 承运商ID
 * @param {Object} db - 数据库连接
 * @returns {Promise<BaseCarrierAdapter>} 适配器实例
 */
export async function getAdapterByCarrierId(carrierId, db) {
  const carrier = await db.prepare(`
    SELECT * FROM last_mile_carriers WHERE id = ?
  `).get(carrierId)
  
  if (!carrier) {
    throw new Error(`承运商不存在: ${carrierId}`)
  }
  
  // 解析API配置
  let apiConfig = {}
  if (carrier.api_config) {
    try {
      apiConfig = typeof carrier.api_config === 'string' 
        ? JSON.parse(carrier.api_config) 
        : carrier.api_config
    } catch (e) {
      console.error('解析API配置失败:', e)
    }
  }
  
  return getAdapter(carrier.carrier_code, {
    carrierName: carrier.carrier_name,
    apiConfig
  })
}

/**
 * 获取所有已注册的适配器信息
 * @returns {Array} 适配器信息列表
 */
export function getRegisteredAdapters() {
  return Object.entries(ADAPTER_REGISTRY).map(([code, AdapterClass]) => {
    const instance = new AdapterClass({})
    return {
      carrierCode: code,
      carrierName: instance.carrierName,
      isConfigured: instance.isConfigured(),
      supportedFeatures: instance.getSupportedFeatures()
    }
  })
}

/**
 * 检查承运商API是否可用
 * @param {string} carrierCode - 承运商代码
 * @param {Object} apiConfig - API配置
 * @returns {Object} 检查结果
 */
export function checkAdapterStatus(carrierCode, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  
  return {
    carrierCode: adapter.carrierCode,
    carrierName: adapter.carrierName,
    isConfigured: adapter.isConfigured(),
    supportedFeatures: adapter.getSupportedFeatures()
  }
}

/**
 * 注册自定义适配器
 * @param {string} carrierCode - 承运商代码
 * @param {Class} AdapterClass - 适配器类（必须继承BaseCarrierAdapter）
 */
export function registerAdapter(carrierCode, AdapterClass) {
  if (!(AdapterClass.prototype instanceof BaseCarrierAdapter)) {
    throw new Error('适配器必须继承 BaseCarrierAdapter')
  }
  
  ADAPTER_REGISTRY[carrierCode.toUpperCase()] = AdapterClass
  
  // 清除可能存在的缓存实例
  for (const key of adapterCache.keys()) {
    if (key.startsWith(carrierCode.toUpperCase())) {
      adapterCache.delete(key)
    }
  }
}

/**
 * 创建运单（统一入口）
 * @param {string} carrierCode - 承运商代码
 * @param {Object} shipmentData - 运单数据
 * @param {Object} apiConfig - API配置
 */
export async function createShipment(carrierCode, shipmentData, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  return adapter.createShipment(shipmentData)
}

/**
 * 获取面单（统一入口）
 */
export async function getLabel(carrierCode, trackingNo, options = {}, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  return adapter.getLabel(trackingNo, options)
}

/**
 * 查询轨迹（统一入口）
 */
export async function getTracking(carrierCode, trackingNo, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  return adapter.getTracking(trackingNo)
}

/**
 * 取消运单（统一入口）
 */
export async function cancelShipment(carrierCode, trackingNo, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  return adapter.cancelShipment(trackingNo)
}

/**
 * 地址校验（统一入口）
 */
export async function validateAddress(carrierCode, address, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  return adapter.validateAddress(address)
}

/**
 * 获取实时报价（统一入口）
 */
export async function getRates(carrierCode, params, apiConfig = {}) {
  const adapter = getAdapter(carrierCode, { apiConfig })
  return adapter.getRates(params)
}

/**
 * 批量查询多个承运商报价
 */
export async function getMultiCarrierRates(params, carrierCodes = []) {
  const codes = carrierCodes.length > 0 
    ? carrierCodes 
    : Object.keys(ADAPTER_REGISTRY)
  
  const results = await Promise.allSettled(
    codes.map(code => getRates(code, params))
  )
  
  return codes.map((code, index) => {
    const result = results[index]
    if (result.status === 'fulfilled' && result.value.success) {
      return {
        carrierCode: code,
        success: true,
        rates: result.value.data.rates
      }
    }
    return {
      carrierCode: code,
      success: false,
      error: result.reason?.message || result.value?.error || '获取报价失败'
    }
  })
}

// 导出适配器类供外部扩展使用
export {
  BaseCarrierAdapter,
  DHLAdapter,
  DPDAdapter,
  UPSAdapter
}

export default {
  getAdapter,
  getAdapterByCarrierId,
  getRegisteredAdapters,
  checkAdapterStatus,
  registerAdapter,
  createShipment,
  getLabel,
  getTracking,
  cancelShipment,
  validateAddress,
  getRates,
  getMultiCarrierRates
}
