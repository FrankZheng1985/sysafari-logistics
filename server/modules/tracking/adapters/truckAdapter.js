/**
 * 卡航/卡车跟踪适配器
 * 
 * 主要支持：
 * - 手动节点录入
 * - 第三方货运平台API（货车帮、满帮等）
 * - GPS定位集成（可选）
 */

import { NODE_TYPES, TRACKING_STATUS } from '../model.js'

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
  
  // 根据配置的API类型调用不同的服务
  const apiType = config.apiType || 'generic'
  
  switch (apiType) {
    case 'huochebang':
      return await fetchHuochebangTracking(trackingNumber, config)
    case 'manbang':
      return await fetchManbangTracking(trackingNumber, config)
    case 'gps':
      return await fetchGpsTracking(trackingNumber, config)
    default:
      if (config.apiUrl) {
        return await fetchGenericTruckTracking(trackingNumber, config)
      }
      return getMockTrackingData(trackingNumber)
  }
}

/**
 * 货车帮API跟踪
 */
async function fetchHuochebangTracking(orderNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/api/tracking/order`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderNo: orderNumber }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`货车帮 API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('货车帮API调用失败:', error)
    return getMockTrackingData(orderNumber)
  }
}

/**
 * 满帮API跟踪
 */
async function fetchManbangTracking(orderNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/openapi/logistics/track`,
      {
        method: 'POST',
        headers: {
          'AppKey': config.apiKey,
          'AppSecret': config.apiSecret || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ waybillNo: orderNumber }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`满帮 API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('满帮API调用失败:', error)
    return getMockTrackingData(orderNumber)
  }
}

/**
 * GPS定位跟踪
 */
async function fetchGpsTracking(vehicleNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/gps/track?vehicleNo=${encodeURIComponent(vehicleNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`GPS API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('GPS跟踪API调用失败:', error)
    return getMockTrackingData(vehicleNumber)
  }
}

/**
 * 通用卡车跟踪API
 */
async function fetchGenericTruckTracking(trackingNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}?trackingNo=${encodeURIComponent(trackingNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Truck API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('通用卡车跟踪API调用失败:', error)
    return getMockTrackingData(trackingNumber)
  }
}

/**
 * 获取模拟跟踪数据
 */
function getMockTrackingData(trackingNumber) {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const hourMs = 60 * 60 * 1000
  
  return {
    trackingNumber,
    vehicleNumber: '豫A12345',
    driverName: '张师傅',
    driverPhone: '138****1234',
    events: [
      {
        eventType: 'TRUCK_DEPARTED',
        eventTime: new Date(now.getTime() - 8 * dayMs).toISOString(),
        location: '西安',
        description: '卡车发车',
        latitude: 34.3416,
        longitude: 108.9398,
      },
      {
        eventType: 'CHECKPOINT',
        eventTime: new Date(now.getTime() - 6 * dayMs).toISOString(),
        location: '乌鲁木齐',
        description: '到达中转站',
        latitude: 43.8256,
        longitude: 87.6168,
      },
      {
        eventType: 'BORDER_CROSS',
        eventTime: new Date(now.getTime() - 5 * dayMs).toISOString(),
        location: '霍尔果斯口岸',
        description: '出境',
        latitude: 44.2127,
        longitude: 80.4182,
      },
      {
        eventType: 'IN_TRANSIT',
        eventTime: new Date(now.getTime() - 3 * dayMs).toISOString(),
        location: '哈萨克斯坦',
        description: '运输中',
      },
      {
        eventType: 'CHECKPOINT',
        eventTime: new Date(now.getTime() - 1 * dayMs).toISOString(),
        location: '莫斯科',
        description: '到达中转站',
        latitude: 55.7558,
        longitude: 37.6173,
      },
      {
        eventType: 'IN_TRANSIT',
        eventTime: new Date(now.getTime() - 12 * hourMs).toISOString(),
        location: '波兰',
        description: '运输中',
      },
    ],
  }
}

/**
 * 将原始跟踪数据转换为统一格式
 */
export function normalizeRecords(rawData, billId, transportType = 'truck') {
  if (!rawData || !rawData.events) {
    return []
  }
  
  // 卡航事件类型映射
  const eventTypeMap = {
    'TRUCK_DEPARTED': { nodeType: NODE_TYPES.TRUCK_DEPARTED, status: TRACKING_STATUS.IN_TRANSIT, name: '卡车发车' },
    'CHECKPOINT': { nodeType: NODE_TYPES.CHECKPOINT, status: TRACKING_STATUS.IN_TRANSIT, name: '中转站' },
    'BORDER_CROSS': { nodeType: NODE_TYPES.BORDER_CROSS, status: TRACKING_STATUS.IN_TRANSIT, name: '过境' },
    'IN_TRANSIT': { nodeType: NODE_TYPES.IN_TRANSIT, status: TRACKING_STATUS.IN_TRANSIT, name: '运输中' },
    'TRUCK_ARRIVED': { nodeType: NODE_TYPES.TRUCK_ARRIVED, status: TRACKING_STATUS.ARRIVED, name: '到达目的地' },
    'CUSTOMS_HOLD': { nodeType: NODE_TYPES.CUSTOMS_START, status: TRACKING_STATUS.CUSTOMS, name: '清关中' },
    'CUSTOMS_RELEASED': { nodeType: NODE_TYPES.CUSTOMS_CLEAR, status: TRACKING_STATUS.CUSTOMS, name: '清关放行' },
    'DELIVERY': { nodeType: NODE_TYPES.DELIVERY, status: TRACKING_STATUS.IN_TRANSIT, name: '派送中' },
    'DELIVERED': { nodeType: NODE_TYPES.SIGNED, status: TRACKING_STATUS.DELIVERED, name: '已签收' },
  }
  
  return rawData.events.map(event => {
    const mapping = eventTypeMap[event.eventType] || {
      nodeType: NODE_TYPES.IN_TRANSIT,
      status: TRACKING_STATUS.IN_TRANSIT,
      name: event.eventType
    }
    
    const record = {
      billId,
      transportType,
      trackingNumber: rawData.trackingNumber,
      nodeType: mapping.nodeType,
      nodeName: event.description || mapping.name,
      status: mapping.status,
      location: event.location || '',
      eventTime: event.eventTime,
      remark: rawData.vehicleNumber ? `车牌: ${rawData.vehicleNumber}` : '',
      source: 'api',
      operator: '系统',
      rawData: event,
    }
    
    // 添加GPS坐标（如果有）
    if (event.latitude && event.longitude) {
      record.latitude = event.latitude
      record.longitude = event.longitude
    }
    
    return record
  })
}

/**
 * 获取卡航跟踪节点模板
 */
export function getNodeTemplates() {
  return [
    { nodeType: NODE_TYPES.DEPARTURE, nodeName: '发车', order: 1 },
    { nodeType: NODE_TYPES.TRUCK_DEPARTED, nodeName: '卡车出发', order: 2 },
    { nodeType: NODE_TYPES.CHECKPOINT, nodeName: '中转站', order: 3 },
    { nodeType: NODE_TYPES.BORDER_CROSS, nodeName: '过境', order: 4 },
    { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '运输中', order: 5 },
    { nodeType: NODE_TYPES.TRUCK_ARRIVED, nodeName: '到达目的地', order: 6 },
    { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 7 },
    { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 8 },
    { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 9 },
    { nodeType: NODE_TYPES.SIGNED, nodeName: '签收', order: 10 },
  ]
}

/**
 * 创建手动跟踪节点
 * @param {Object} data - 节点数据
 * @returns {Object} 格式化的节点记录
 */
export function createManualNode(data) {
  return {
    billId: data.billId,
    transportType: 'truck',
    trackingNumber: data.trackingNumber || '',
    nodeType: data.nodeType || NODE_TYPES.CHECKPOINT,
    nodeName: data.nodeName || '',
    status: data.status || TRACKING_STATUS.IN_TRANSIT,
    location: data.location || '',
    eventTime: data.eventTime || new Date().toISOString(),
    remark: data.remark || '',
    source: 'manual',
    operator: data.operator || '操作员',
    latitude: data.latitude || null,
    longitude: data.longitude || null,
  }
}

export default {
  fetchTracking,
  normalizeRecords,
  getNodeTemplates,
  createManualNode,
}
