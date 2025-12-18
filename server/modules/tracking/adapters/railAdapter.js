/**
 * 中欧班列跟踪API适配器
 * 
 * 支持的铁路跟踪平台：
 * - 中欧班列综合服务平台
 * - 国铁货运追踪
 * - 中亚铁路跟踪
 */

import { NODE_TYPES, TRACKING_STATUS } from '../model.js'

/**
 * 获取跟踪数据
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 跟踪数据
 */
export async function fetchTracking(params) {
  const { trackingNumber, containerNumber, config } = params
  
  if (!config || !config.apiKey) {
    // 没有API配置，返回模拟数据
    return getMockTrackingData(trackingNumber || containerNumber)
  }
  
  // 调用铁路跟踪API
  if (config.apiUrl) {
    return await fetchRailTracking(trackingNumber, containerNumber, config)
  }
  
  return getMockTrackingData(trackingNumber || containerNumber)
}

/**
 * 铁路跟踪API调用
 */
async function fetchRailTracking(waybillNumber, containerNumber, config) {
  try {
    const params = new URLSearchParams()
    if (waybillNumber) params.append('waybillNo', waybillNumber)
    if (containerNumber) params.append('containerNo', containerNumber)
    
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
      throw new Error(`Rail Tracking API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('铁路跟踪API调用失败:', error)
    return getMockTrackingData(waybillNumber || containerNumber)
  }
}

/**
 * 获取模拟跟踪数据
 */
function getMockTrackingData(trackingNumber) {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  
  return {
    trackingNumber,
    trainNumber: 'X8001',
    events: [
      {
        eventType: 'LOADING',
        eventTime: new Date(now.getTime() - 15 * dayMs).toISOString(),
        location: '西安国际港站',
        description: '装车完成',
      },
      {
        eventType: 'TRAIN_DEPARTED',
        eventTime: new Date(now.getTime() - 14 * dayMs).toISOString(),
        location: '西安国际港站',
        description: '班列发车',
        trainNumber: 'X8001',
      },
      {
        eventType: 'BORDER_EXIT',
        eventTime: new Date(now.getTime() - 10 * dayMs).toISOString(),
        location: '阿拉山口',
        description: '出境换装',
      },
      {
        eventType: 'BORDER_ENTRY',
        eventTime: new Date(now.getTime() - 9 * dayMs).toISOString(),
        location: '多斯特克',
        description: '入境哈萨克斯坦',
      },
      {
        eventType: 'IN_TRANSIT',
        eventTime: new Date(now.getTime() - 5 * dayMs).toISOString(),
        location: '铁路运输中',
        description: '途经白俄罗斯',
      },
      {
        eventType: 'BORDER_ENTRY_EU',
        eventTime: new Date(now.getTime() - 2 * dayMs).toISOString(),
        location: '马拉舍维奇',
        description: '入境波兰(EU)',
      },
      {
        eventType: 'TRAIN_ARRIVED',
        eventTime: new Date(now.getTime() - 1 * dayMs).toISOString(),
        location: '杜伊斯堡',
        description: '班列到站',
      },
    ],
  }
}

/**
 * 将原始跟踪数据转换为统一格式
 */
export function normalizeRecords(rawData, billId, transportType = 'rail') {
  if (!rawData || !rawData.events) {
    return []
  }
  
  // 铁路事件类型映射
  const eventTypeMap = {
    'LOADING': { nodeType: NODE_TYPES.DEPARTURE, status: TRACKING_STATUS.PENDING, name: '装车完成' },
    'TRAIN_DEPARTED': { nodeType: NODE_TYPES.TRAIN_DEPARTED, status: TRACKING_STATUS.IN_TRANSIT, name: '班列发车' },
    'BORDER_EXIT': { nodeType: NODE_TYPES.BORDER_CROSS, status: TRACKING_STATUS.IN_TRANSIT, name: '出境换装' },
    'BORDER_ENTRY': { nodeType: NODE_TYPES.BORDER_CROSS, status: TRACKING_STATUS.IN_TRANSIT, name: '入境' },
    'BORDER_ENTRY_EU': { nodeType: NODE_TYPES.BORDER_CROSS, status: TRACKING_STATUS.IN_TRANSIT, name: '入境欧盟' },
    'IN_TRANSIT': { nodeType: NODE_TYPES.IN_TRANSIT, status: TRACKING_STATUS.IN_TRANSIT, name: '运输中' },
    'TRAIN_ARRIVED': { nodeType: NODE_TYPES.TRAIN_ARRIVED, status: TRACKING_STATUS.ARRIVED, name: '班列到站' },
    'UNLOADING': { nodeType: NODE_TYPES.ARRIVAL, status: TRACKING_STATUS.ARRIVED, name: '卸车' },
    'CUSTOMS_HOLD': { nodeType: NODE_TYPES.CUSTOMS_START, status: TRACKING_STATUS.CUSTOMS, name: '清关中' },
    'CUSTOMS_RELEASED': { nodeType: NODE_TYPES.CUSTOMS_CLEAR, status: TRACKING_STATUS.CUSTOMS, name: '清关放行' },
    'DELIVERED': { nodeType: NODE_TYPES.SIGNED, status: TRACKING_STATUS.DELIVERED, name: '已交付' },
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
      remark: event.trainNumber ? `班列: ${event.trainNumber}` : '',
      source: 'api',
      operator: '系统',
      rawData: event,
    }
  })
}

/**
 * 获取铁路跟踪节点模板
 */
export function getNodeTemplates() {
  return [
    { nodeType: NODE_TYPES.DEPARTURE, nodeName: '发站装车', order: 1 },
    { nodeType: NODE_TYPES.TRAIN_DEPARTED, nodeName: '列车发车', order: 2 },
    { nodeType: NODE_TYPES.BORDER_CROSS, nodeName: '出境换装', order: 3 },
    { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '铁路运输中', order: 4 },
    { nodeType: NODE_TYPES.BORDER_CROSS, nodeName: '入境欧盟', order: 5 },
    { nodeType: NODE_TYPES.TRAIN_ARRIVED, nodeName: '列车到站', order: 6 },
    { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 7 },
    { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 8 },
    { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 9 },
    { nodeType: NODE_TYPES.SIGNED, nodeName: '已签收', order: 10 },
  ]
}

export default {
  fetchTracking,
  normalizeRecords,
  getNodeTemplates,
}
