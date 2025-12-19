/**
 * 统一物流跟踪服务
 * 
 * 整合各渠道的跟踪API，提供统一的查询接口
 * 
 * 支持的配置方式：
 * 1. 数据库配置 (tracking_api_configs 表)
 * 2. 环境变量配置 (SHIP24_API_KEY)
 */

import { 
  getTrackingRecords, 
  addTrackingRecord, 
  batchAddTrackingRecords,
  getTrackingApiConfigs,
  getLatestTrackingStatus,
  TRACKING_STATUS,
  NODE_TYPES
} from './model.js'

// 从环境变量获取 Ship24 API Key（优先级最高）
const SHIP24_API_KEY = process.env.SHIP24_API_KEY

// 导入各渠道适配器
import shipAdapter from './adapters/shipAdapter.js'
import airAdapter from './adapters/airAdapter.js'
import railAdapter from './adapters/railAdapter.js'
import truckAdapter from './adapters/truckAdapter.js'

// 适配器映射
const adapters = {
  sea: shipAdapter,
  air: airAdapter,
  rail: railAdapter,
  truck: truckAdapter,
}

/**
 * 获取提单的跟踪信息
 * @param {string} billId - 提单ID
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 跟踪信息
 */
export async function getTrackingInfo(billId, options = {}) {
  const { refresh = false, transportType } = options
  
  // 获取已有的跟踪记录
  const existingRecords = await getTrackingRecords(billId)
  
  // 获取最新状态
  const latestStatus = await getLatestTrackingStatus(billId)
  
  // 如果需要刷新且有运输方式，尝试从外部API获取最新数据
  if (refresh && transportType) {
    try {
      const newRecords = await fetchExternalTracking(billId, transportType, options)
      if (newRecords && newRecords.length > 0) {
        // 保存新记录
        await batchAddTrackingRecords(newRecords)
        // 重新获取
        const updatedRecords = await getTrackingRecords(billId)
        return {
          records: updatedRecords,
          latestStatus: updatedRecords[0] || null,
          refreshed: true,
        }
      }
    } catch (error) {
      console.error('刷新跟踪数据失败:', error)
      // 失败时返回现有数据
    }
  }
  
  return {
    records: existingRecords,
    latestStatus,
    refreshed: false,
  }
}

/**
 * 从外部API获取跟踪数据
 * @param {string} billId - 提单ID
 * @param {string} transportType - 运输方式
 * @param {Object} options - 选项（包含跟踪号等）
 * @returns {Promise<Array>} 跟踪记录数组
 */
export async function fetchExternalTracking(billId, transportType, options = {}) {
  const adapter = adapters[transportType]
  
  if (!adapter) {
    console.warn(`不支持的运输方式: ${transportType}`)
    return []
  }
  
  // 获取API配置（优先使用环境变量中的 Ship24 配置）
  let config = null
  
  if (SHIP24_API_KEY && transportType === 'sea') {
    // 使用环境变量配置的 Ship24
    config = {
      providerCode: 'ship24',
      providerName: 'Ship24 (环境变量)',
      apiKey: SHIP24_API_KEY,
      apiUrl: 'https://api.ship24.com/public/v1',
    }
  } else {
    // 从数据库获取配置
    const configs = await getTrackingApiConfigs({
      transportType,
      status: 'active'
    })
    
    if (!configs.list || configs.list.length === 0) {
      console.warn(`未找到${transportType}的API配置，将使用模拟数据`)
    }
    config = configs.list?.[0] || null
  }
  
  try {
    // 调用适配器获取跟踪数据
    const trackingData = await adapter.fetchTracking({
      billId,
      trackingNumber: options.trackingNumber,
      containerNumber: options.containerNumber,
      config,
    })
    
    // 转换为统一格式
    return adapter.normalizeRecords(trackingData, billId, transportType)
  } catch (error) {
    console.error(`获取${transportType}跟踪数据失败:`, error)
    throw error
  }
}

/**
 * 手动添加跟踪节点
 * @param {Object} data - 节点数据
 * @returns {Promise<Object>} 创建结果
 */
export async function addManualTrackingNode(data) {
  const record = {
    billId: data.billId,
    transportType: data.transportType || 'truck',
    trackingNumber: data.trackingNumber || '',
    nodeType: data.nodeType || NODE_TYPES.CHECKPOINT,
    nodeName: data.nodeName || '',
    status: data.status || TRACKING_STATUS.IN_TRANSIT,
    location: data.location || '',
    eventTime: data.eventTime || new Date().toISOString(),
    remark: data.remark || '',
    source: 'manual',
    operator: data.operator || '操作员',
    latitude: data.latitude,
    longitude: data.longitude,
  }
  
  return await addTrackingRecord(record)
}

/**
 * 批量刷新跟踪状态
 * @param {Array<string>} billIds - 提单ID数组
 * @param {string} transportType - 运输方式
 * @returns {Promise<Object>} 刷新结果
 */
export async function batchRefreshTracking(billIds, transportType) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  }
  
  for (const billId of billIds) {
    try {
      await getTrackingInfo(billId, { refresh: true, transportType })
      results.success++
    } catch (error) {
      results.failed++
      results.errors.push({ billId, error: error.message })
    }
  }
  
  return results
}

/**
 * 获取运输方式的跟踪节点模板
 * @param {string} transportType - 运输方式
 * @returns {Array} 节点模板
 */
export function getTrackingNodeTemplates(transportType) {
  const adapter = adapters[transportType]
  
  if (adapter && adapter.getNodeTemplates) {
    return adapter.getNodeTemplates()
  }
  
  // 默认节点模板
  return [
    { nodeType: NODE_TYPES.DEPARTURE, nodeName: '发运', order: 1 },
    { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '运输中', order: 2 },
    { nodeType: NODE_TYPES.ARRIVAL, nodeName: '到达', order: 3 },
    { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 4 },
    { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 5 },
    { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送', order: 6 },
    { nodeType: NODE_TYPES.SIGNED, nodeName: '签收', order: 7 },
  ]
}

/**
 * 计算预计到达时间
 * @param {string} transportType - 运输方式
 * @param {string} origin - 起运地
 * @param {string} destination - 目的地
 * @param {Date} departureTime - 发运时间
 * @returns {Date|null} 预计到达时间
 */
export function calculateETA(transportType, origin, destination, departureTime) {
  // 基于运输方式的大致运输时间（天数）
  const transitDays = {
    sea: 30,    // 海运约30天
    air: 3,     // 空运约3天
    rail: 15,   // 铁路约15天
    truck: 10,  // 卡航约10天
  }
  
  const days = transitDays[transportType] || 15
  const eta = new Date(departureTime)
  eta.setDate(eta.getDate() + days)
  
  return eta
}

/**
 * 根据提单号/集装箱号获取补充信息（码头、船名航次等）
 * 用于创建提单时自动填充未识别的字段
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 补充信息
 */
export async function getSupplementInfo(params) {
  const { trackingNumber, containerNumber, transportType = 'sea' } = params
  
  const adapter = adapters[transportType]
  
  if (!adapter) {
    console.warn(`不支持的运输方式: ${transportType}`)
    return null
  }
  
  // 获取API配置（优先使用环境变量中的 Ship24 配置）
  let config = null
  
  if (SHIP24_API_KEY && transportType === 'sea') {
    // 使用环境变量配置的 Ship24
    console.log('使用环境变量配置的 Ship24 API')
    config = {
      providerCode: 'ship24',
      providerName: 'Ship24 (环境变量)',
      apiKey: SHIP24_API_KEY,
      apiUrl: 'https://api.ship24.com/public/v1',
    }
  } else {
    // 从数据库获取配置
    const configs = await getTrackingApiConfigs({
      transportType,
      status: 'active'
    })
    config = configs.list?.[0] || null
  }
  
  try {
    // 调用适配器获取跟踪数据
    const trackingData = await adapter.fetchTracking({
      trackingNumber,
      containerNumber,
      config,
    })
    
    // 如果适配器返回null，说明没有真实数据，直接返回null
    if (!trackingData) {
      console.log('未获取到真实跟踪数据，返回null')
      return null
    }
    
    // 提取补充信息
    if (adapter.extractSupplementInfo) {
      const supplementInfo = adapter.extractSupplementInfo(trackingData)
      // 如果提取的信息为空，返回null
      if (!supplementInfo) {
        console.log('提取的补充信息为空，返回null')
        return null
      }
      return supplementInfo
    }
    
    // 默认返回基本信息（如果所有字段都是null，返回null）
    const defaultInfo = {
      terminal: trackingData?.terminal || null,
      vessel: trackingData?.vessel || null,
      voyage: trackingData?.voyage || null,
      eta: trackingData?.eta || null,
      etd: trackingData?.etd || null,
      ata: trackingData?.ata || null,
      carrier: trackingData?.carrier || null,
    }
    
    // 检查是否有任何有效数据
    const hasAnyData = Object.values(defaultInfo).some(value => value !== null && value !== undefined)
    return hasAnyData ? defaultInfo : null
  } catch (error) {
    console.error('获取补充信息失败:', error)
    return null
  }
}

export default {
  getTrackingInfo,
  fetchExternalTracking,
  addManualTrackingNode,
  batchRefreshTracking,
  getTrackingNodeTemplates,
  calculateETA,
  getSupplementInfo,
}
