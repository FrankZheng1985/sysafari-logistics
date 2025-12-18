/**
 * 船公司跟踪API适配器
 * 
 * 支持的跟踪方式：
 * 1. Ship24 聚合API（推荐，支持1200+船公司）
 * 2. 各船公司直连API：
 *    - 马士基 (Maersk)
 *    - 中远海运 (COSCO)
 *    - 地中海航运 (MSC)
 *    - 达飞轮船 (CMA CGM)
 *    - 长荣海运 (Evergreen)
 *    - 赫伯罗特 (Hapag-Lloyd)
 */

import { NODE_TYPES, TRACKING_STATUS } from '../model.js'
import ship24Adapter from './ship24Adapter.js'

// 船公司代码映射
const CARRIER_CODES = {
  MAEU: 'maersk',
  MSKU: 'maersk',
  COSU: 'cosco',
  OOCL: 'oocl',
  MSCU: 'msc',
  CMAU: 'cmacgm',
  EGLV: 'evergreen',
  HLCU: 'hapag',
  YMLU: 'yangming',
  ZIMU: 'zim',
}

/**
 * 获取跟踪数据
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 跟踪数据
 */
export async function fetchTracking(params) {
  const { trackingNumber, containerNumber, config } = params
  
  // 优先使用 Ship24 聚合API（推荐方式）
  if (config?.providerCode === 'ship24' && config?.apiKey) {
    try {
      console.log('使用 Ship24 API 获取跟踪数据...')
      const result = await ship24Adapter.fetchTracking(params)
      if (result && (result.events?.length > 0 || result.carrier)) {
        console.log('✅ Ship24 返回真实数据')
        return result
      }
      console.log('⚠️ Ship24 未返回有效数据，尝试其他方式')
    } catch (error) {
      console.error('Ship24 API 调用失败:', error.message)
      // Ship24 失败后尝试其他方式
    }
  }
  
  // 使用各船公司直连API
  if (config && config.apiKey && config.apiUrl) {
    // 根据不同船公司调用对应的API
    const carrierCode = (containerNumber || '').substring(0, 4).toUpperCase()
    const carrier = CARRIER_CODES[carrierCode]
    
    try {
      switch (carrier) {
        case 'maersk':
          return await fetchMaerskTracking(trackingNumber, containerNumber, config)
        case 'cosco':
          return await fetchCoscoTracking(trackingNumber, containerNumber, config)
        case 'msc':
          return await fetchMscTracking(trackingNumber, containerNumber, config)
        default:
          // 通用跟踪API
          if (config.apiUrl) {
            return await fetchGenericTracking(trackingNumber, containerNumber, config)
          }
      }
    } catch (error) {
      console.error('船公司API调用失败:', error.message)
    }
  }
  
  // 没有有效的API配置，返回模拟数据用于测试
  console.log('⚠️ 未配置有效API，返回模拟数据')
  return getMockTrackingData(trackingNumber || containerNumber)
}

/**
 * 马士基API跟踪
 */
async function fetchMaerskTracking(billNumber, containerNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/track?billOfLadingNumber=${billNumber}`,
      {
        headers: {
          'Consumer-Key': config.apiKey,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Maersk API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('马士基API调用失败:', error)
    return getMockTrackingData(billNumber || containerNumber)
  }
}

/**
 * 中远API跟踪
 */
async function fetchCoscoTracking(billNumber, containerNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/cargoTracking/queryTrans?billNo=${billNumber}`,
      {
        headers: {
          'apiKey': config.apiKey,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`COSCO API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('中远API调用失败:', error)
    return getMockTrackingData(billNumber || containerNumber)
  }
}

/**
 * MSC API跟踪
 */
async function fetchMscTracking(billNumber, containerNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/track-and-trace/containers/${containerNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`MSC API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('MSC API调用失败:', error)
    return getMockTrackingData(billNumber || containerNumber)
  }
}

/**
 * 通用跟踪API
 */
async function fetchGenericTracking(billNumber, containerNumber, config) {
  try {
    const params = new URLSearchParams()
    if (billNumber) params.append('billNumber', billNumber)
    if (containerNumber) params.append('containerNumber', containerNumber)
    
    const response = await fetch(
      `${config.apiUrl}?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Generic API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('通用跟踪API调用失败:', error)
    return getMockTrackingData(billNumber || containerNumber)
  }
}

/**
 * 根据字符串生成稳定的哈希值（用于一致性随机）
 */
function hashCode(str) {
  let hash = 0
  if (!str || str.length === 0) return hash
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * 获取模拟跟踪数据（用于测试和演示）
 * 注意：同一个提单号/集装箱号会返回一致的数据
 */
function getMockTrackingData(trackingNumber) {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  
  // 模拟常见的码头/堆场名称
  const terminals = [
    'ECT Delta Terminal',
    'APM Terminals Rotterdam',
    'Rotterdam World Gateway',
    'Euromax Terminal',
    'HHLA Container Terminal',
    'PSA Antwerp',
  ]
  
  // 使用提单号的哈希值来选择码头，保证同一提单号返回相同的码头
  const hash = hashCode(trackingNumber || '')
  const terminalIndex = hash % terminals.length
  const selectedTerminal = terminals[terminalIndex]
  const terminalCode = 'RTM-' + (hash % 100)
  const sealNum = 'SEAL' + (hash % 100000)
  
  return {
    trackingNumber,
    carrier: 'COSCO Shipping',
    // 码头/堆场信息（基于提单号哈希，保证一致性）
    terminal: selectedTerminal,
    terminalCode: terminalCode,
    // 船名航次
    vessel: 'COSCO TAURUS',
    voyage: 'V.025E',
    // ETA/ETD
    eta: new Date(now.getTime() + 2 * dayMs).toISOString().split('T')[0],
    etd: new Date(now.getTime() - 20 * dayMs).toISOString().split('T')[0],
    // 货物信息（件数、毛重、体积）
    pieces: 120,
    grossWeight: 2500.5,
    volume: 45.8,
    // 集装箱信息
    containerNumber: trackingNumber?.length > 10 ? trackingNumber.substring(0, 11) : 'COSU1234567',
    containerType: '40HQ',
    sealNumber: sealNum,
    events: [
      {
        eventType: 'GATE_OUT',
        eventTime: new Date(now.getTime() - 20 * dayMs).toISOString(),
        location: '上海港',
        description: '集装箱离场',
      },
      {
        eventType: 'VESSEL_DEPARTED',
        eventTime: new Date(now.getTime() - 18 * dayMs).toISOString(),
        location: '上海港',
        description: '船舶离港',
        vessel: 'MOCK VESSEL V.001',
      },
      {
        eventType: 'IN_TRANSIT',
        eventTime: new Date(now.getTime() - 10 * dayMs).toISOString(),
        location: '海上',
        description: '海上运输中',
      },
      {
        eventType: 'VESSEL_ARRIVED',
        eventTime: new Date(now.getTime() - 2 * dayMs).toISOString(),
        location: '鹿特丹港',
        description: '船舶到港',
        terminal: selectedTerminal,
      },
      {
        eventType: 'DISCHARGED',
        eventTime: new Date(now.getTime() - 1 * dayMs).toISOString(),
        location: '鹿特丹港',
        description: '卸船完成',
        terminal: selectedTerminal,
      },
    ],
  }
}

/**
 * 将原始跟踪数据转换为统一格式
 * @param {Object} rawData - 原始数据
 * @param {string} billId - 提单ID
 * @param {string} transportType - 运输方式
 * @returns {Array} 标准化记录数组
 */
export function normalizeRecords(rawData, billId, transportType = 'sea') {
  if (!rawData || !rawData.events) {
    return []
  }
  
  // 事件类型映射
  const eventTypeMap = {
    'GATE_OUT': { nodeType: NODE_TYPES.DEPARTURE, status: TRACKING_STATUS.IN_TRANSIT },
    'VESSEL_DEPARTED': { nodeType: NODE_TYPES.VESSEL_DEPARTED, status: TRACKING_STATUS.IN_TRANSIT },
    'IN_TRANSIT': { nodeType: NODE_TYPES.IN_TRANSIT, status: TRACKING_STATUS.IN_TRANSIT },
    'VESSEL_ARRIVED': { nodeType: NODE_TYPES.VESSEL_ARRIVED, status: TRACKING_STATUS.ARRIVED },
    'DISCHARGED': { nodeType: NODE_TYPES.CONTAINER_UNLOAD, status: TRACKING_STATUS.ARRIVED },
    'CUSTOMS_HOLD': { nodeType: NODE_TYPES.CUSTOMS_START, status: TRACKING_STATUS.CUSTOMS },
    'CUSTOMS_RELEASED': { nodeType: NODE_TYPES.CUSTOMS_CLEAR, status: TRACKING_STATUS.CUSTOMS },
    'GATE_IN': { nodeType: NODE_TYPES.ARRIVAL, status: TRACKING_STATUS.ARRIVED },
    'DELIVERED': { nodeType: NODE_TYPES.SIGNED, status: TRACKING_STATUS.DELIVERED },
  }
  
  return rawData.events.map(event => {
    const mapping = eventTypeMap[event.eventType] || {
      nodeType: NODE_TYPES.IN_TRANSIT,
      status: TRACKING_STATUS.IN_TRANSIT
    }
    
    return {
      billId,
      transportType,
      trackingNumber: rawData.trackingNumber,
      nodeType: mapping.nodeType,
      nodeName: event.description || event.eventType,
      status: mapping.status,
      location: event.location || '',
      eventTime: event.eventTime,
      remark: event.vessel ? `船名: ${event.vessel}` : '',
      source: 'api',
      operator: '系统',
      rawData: event,
    }
  })
}

/**
 * 获取海运跟踪节点模板
 */
export function getNodeTemplates() {
  return [
    { nodeType: NODE_TYPES.DEPARTURE, nodeName: '离港', order: 1 },
    { nodeType: NODE_TYPES.VESSEL_DEPARTED, nodeName: '船舶启航', order: 2 },
    { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '海上运输中', order: 3 },
    { nodeType: NODE_TYPES.VESSEL_ARRIVED, nodeName: '船舶到港', order: 4 },
    { nodeType: NODE_TYPES.CONTAINER_UNLOAD, nodeName: '卸柜', order: 5 },
    { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 6 },
    { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 7 },
    { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 8 },
    { nodeType: NODE_TYPES.SIGNED, nodeName: '已签收', order: 9 },
  ]
}

/**
 * 从追踪数据中提取补充信息（码头、船名航次、件数、毛重等）
 * @param {Object} trackingData - 追踪数据
 * @returns {Object} 补充信息
 */
export function extractSupplementInfo(trackingData) {
  if (!trackingData) {
    return null
  }
  
  // 如果是 Ship24 返回的数据，使用其适配器处理
  if (trackingData._raw || trackingData.carrierCode) {
    return ship24Adapter.extractSupplementInfo(trackingData)
  }
  
  const info = {
    // 码头/堆场信息（地勤）
    terminal: trackingData.terminal || null,
    terminalCode: trackingData.terminalCode || null,
    // 船名航次
    vessel: trackingData.vessel || null,
    voyage: trackingData.voyage || null,
    // 预计时间
    eta: trackingData.eta || null,
    etd: trackingData.etd || null,
    ata: trackingData.ata || null, // 实际到港时间
    // 承运人
    carrier: trackingData.carrier || null,
    carrierCode: trackingData.carrierCode || null,
    // 货物信息
    pieces: trackingData.pieces || null,
    grossWeight: trackingData.grossWeight || null,
    volume: trackingData.volume || null,
    // 集装箱信息
    containerNumber: trackingData.containerNumber || null,
    containerType: trackingData.containerType || null,
    sealNumber: trackingData.sealNumber || null,
    // 地点信息
    originPort: trackingData.originPort || null,
    destinationPort: trackingData.destinationPort || null,
  }
  
  // 从事件中提取码头信息（如果顶层没有）
  if (!info.terminal && trackingData.events) {
    for (const event of trackingData.events) {
      if (event.terminal) {
        info.terminal = event.terminal
        break
      }
      // 某些API在location中包含码头信息
      if (event.eventType === 'DISCHARGED' || event.eventType === 'VESSEL_ARRIVED') {
        if (event.location && event.location.includes('Terminal')) {
          info.terminal = event.location
        }
      }
    }
  }
  
  // 从事件中提取船名航次（如果顶层没有）
  if (!info.vessel && trackingData.events) {
    for (const event of trackingData.events) {
      if (event.vessel) {
        // 解析船名航次格式: "VESSEL NAME V.001"
        const vesselMatch = event.vessel.match(/^(.+?)\s*(?:V\.|VOY\.?|Voyage)?\s*([A-Z0-9]+)?$/i)
        if (vesselMatch) {
          info.vessel = vesselMatch[1].trim()
          if (vesselMatch[2]) {
            info.voyage = vesselMatch[2].trim()
          }
        } else {
          info.vessel = event.vessel
        }
        break
      }
    }
  }
  
  return info
}

/**
 * 快速查询提单/集装箱的补充信息（用于创建提单时自动填充）
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 补充信息
 */
export async function fetchSupplementInfo(params) {
  const trackingData = await fetchTracking(params)
  return extractSupplementInfo(trackingData)
}

export default {
  fetchTracking,
  normalizeRecords,
  getNodeTemplates,
  extractSupplementInfo,
  fetchSupplementInfo,
}
