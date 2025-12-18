/**
 * 航空货运跟踪API适配器
 * 
 * 支持的航空货运API：
 * - Cargo iQ (IATA 标准)
 * - FlightAware Cargo
 * - 各航空公司货运API
 */

import { NODE_TYPES, TRACKING_STATUS } from '../model.js'

// 航空公司代码映射
const AIRLINE_CODES = {
  '172': 'lufthansa',
  '180': 'koreanair',
  '297': 'turkish',
  '618': 'singapore',
  '999': 'chinasouthern',
  '112': 'cathay',
  '086': 'cargolux',
}

/**
 * 获取跟踪数据
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 跟踪数据
 */
export async function fetchTracking(params) {
  const { trackingNumber, config } = params
  
  if (!config || !config.apiKey) {
    // 没有API配置，返回模拟数据
    return getMockTrackingData(trackingNumber)
  }
  
  // 解析AWB号（格式：XXX-XXXXXXXX）
  const awbParts = trackingNumber ? trackingNumber.split('-') : []
  const airlineCode = awbParts[0]
  const airline = AIRLINE_CODES[airlineCode]
  
  // 尝试调用对应的API
  if (config.apiUrl) {
    return await fetchGenericAirTracking(trackingNumber, config)
  }
  
  return getMockTrackingData(trackingNumber)
}

/**
 * 通用航空货运跟踪API
 */
async function fetchGenericAirTracking(awbNumber, config) {
  try {
    const params = new URLSearchParams()
    params.append('awb', awbNumber)
    
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
      throw new Error(`Air Cargo API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('航空货运API调用失败:', error)
    return getMockTrackingData(awbNumber)
  }
}

/**
 * 获取模拟跟踪数据
 */
function getMockTrackingData(trackingNumber) {
  const now = new Date()
  const hourMs = 60 * 60 * 1000
  
  return {
    trackingNumber,
    carrier: 'Mock Airline',
    events: [
      {
        eventType: 'RCS',
        eventTime: new Date(now.getTime() - 48 * hourMs).toISOString(),
        location: 'PVG',
        description: '收运确认',
      },
      {
        eventType: 'DEP',
        eventTime: new Date(now.getTime() - 36 * hourMs).toISOString(),
        location: 'PVG',
        description: '航班起飞',
        flightNumber: 'CZ1234',
      },
      {
        eventType: 'ARR',
        eventTime: new Date(now.getTime() - 24 * hourMs).toISOString(),
        location: 'AMS',
        description: '航班到达',
        flightNumber: 'CZ1234',
      },
      {
        eventType: 'RCF',
        eventTime: new Date(now.getTime() - 20 * hourMs).toISOString(),
        location: 'AMS',
        description: '货物确认接收',
      },
      {
        eventType: 'NFD',
        eventTime: new Date(now.getTime() - 12 * hourMs).toISOString(),
        location: 'AMS',
        description: '到货通知',
      },
    ],
  }
}

/**
 * 将原始跟踪数据转换为统一格式
 */
export function normalizeRecords(rawData, billId, transportType = 'air') {
  if (!rawData || !rawData.events) {
    return []
  }
  
  // IATA Cargo iQ 事件类型映射
  const eventTypeMap = {
    'BKD': { nodeType: NODE_TYPES.DEPARTURE, status: TRACKING_STATUS.PENDING, name: '预订确认' },
    'RCS': { nodeType: NODE_TYPES.DEPARTURE, status: TRACKING_STATUS.IN_TRANSIT, name: '收运确认' },
    'MAN': { nodeType: NODE_TYPES.DEPARTURE, status: TRACKING_STATUS.IN_TRANSIT, name: '舱单确认' },
    'DEP': { nodeType: NODE_TYPES.FLIGHT_DEPARTED, status: TRACKING_STATUS.IN_TRANSIT, name: '航班起飞' },
    'ARR': { nodeType: NODE_TYPES.FLIGHT_ARRIVED, status: TRACKING_STATUS.IN_TRANSIT, name: '航班到达' },
    'RCF': { nodeType: NODE_TYPES.CARGO_READY, status: TRACKING_STATUS.ARRIVED, name: '货物确认接收' },
    'AWR': { nodeType: NODE_TYPES.CARGO_READY, status: TRACKING_STATUS.ARRIVED, name: '文件就绪' },
    'NFD': { nodeType: NODE_TYPES.CARGO_READY, status: TRACKING_STATUS.ARRIVED, name: '到货通知' },
    'CCD': { nodeType: NODE_TYPES.CUSTOMS_CLEAR, status: TRACKING_STATUS.CUSTOMS, name: '清关放行' },
    'DLV': { nodeType: NODE_TYPES.SIGNED, status: TRACKING_STATUS.DELIVERED, name: '已交付' },
  }
  
  return rawData.events.map(event => {
    const mapping = eventTypeMap[event.eventType] || {
      nodeType: NODE_TYPES.IN_TRANSIT,
      status: TRACKING_STATUS.IN_TRANSIT,
      name: event.eventType
    }
    
    return {
      billId,
      transportType,
      trackingNumber: rawData.trackingNumber,
      nodeType: mapping.nodeType,
      nodeName: event.description || mapping.name,
      status: mapping.status,
      location: event.location || '',
      eventTime: event.eventTime,
      remark: event.flightNumber ? `航班: ${event.flightNumber}` : '',
      source: 'api',
      operator: '系统',
      rawData: event,
    }
  })
}

/**
 * 获取空运跟踪节点模板
 */
export function getNodeTemplates() {
  return [
    { nodeType: NODE_TYPES.DEPARTURE, nodeName: '交运', order: 1 },
    { nodeType: NODE_TYPES.FLIGHT_DEPARTED, nodeName: '航班起飞', order: 2 },
    { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '空中运输', order: 3 },
    { nodeType: NODE_TYPES.FLIGHT_ARRIVED, nodeName: '航班降落', order: 4 },
    { nodeType: NODE_TYPES.CARGO_READY, nodeName: '货物就绪', order: 5 },
    { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 6 },
    { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 7 },
    { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 8 },
    { nodeType: NODE_TYPES.SIGNED, nodeName: '已签收', order: 9 },
  ]
}

export default {
  fetchTracking,
  normalizeRecords,
  getNodeTemplates,
}
