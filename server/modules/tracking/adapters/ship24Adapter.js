/**
 * Ship24 第三方跟踪API适配器
 * 
 * Ship24 是一个聚合跟踪服务，支持 1200+ 船公司和快递公司
 * 官方文档: https://docs.ship24.com/
 * 
 * 主要端点:
 * - POST /trackers/track - 创建追踪器并同步获取结果
 * - POST /trackers - 创建追踪器（异步，需要webhook）
 * - GET /trackers/{trackerId}/results - 获取追踪结果
 */

import { NODE_TYPES, TRACKING_STATUS } from '../model.js'

// Ship24 API 基础URL
const SHIP24_API_BASE = 'https://api.ship24.com/public/v1'

/**
 * 使用 Ship24 API 获取跟踪数据
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 跟踪数据
 */
export async function fetchTracking(params) {
  const { trackingNumber, containerNumber, config } = params
  
  if (!config || !config.apiKey) {
    console.warn('Ship24: 未配置 API Key，无法获取真实数据')
    return null
  }
  
  const number = trackingNumber || containerNumber
  if (!number) {
    console.warn('Ship24: 未提供跟踪号或集装箱号')
    return null
  }
  
  try {
    // 使用同步跟踪端点，直接获取结果
    const response = await fetch(`${SHIP24_API_BASE}/trackers/track`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trackingNumber: number,
        // 可选：指定船公司代码加速查询
        // courierCode: ['cosco', 'maersk', 'msc'],
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Ship24 API 错误:', response.status, errorText)
      
      if (response.status === 401) {
        throw new Error('Ship24 API Key 无效或已过期')
      }
      if (response.status === 429) {
        throw new Error('Ship24 API 请求频率超限')
      }
      throw new Error(`Ship24 API 错误: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Ship24 原始响应:', JSON.stringify(data, null, 2))
    
    return parseShip24Response(data, number)
  } catch (error) {
    console.error('Ship24 API 调用失败:', error)
    throw error
  }
}

/**
 * 解析 Ship24 API 响应
 * @param {Object} data - Ship24 响应数据
 * @param {string} trackingNumber - 跟踪号
 * @returns {Object} 统一格式的跟踪数据
 */
function parseShip24Response(data, trackingNumber) {
  // Ship24 响应结构：
  // {
  //   "data": {
  //     "trackings": [{
  //       "shipment": { ... },
  //       "events": [{ ... }]
  //     }]
  //   }
  // }
  
  const tracking = data?.data?.trackings?.[0]
  if (!tracking) {
    console.warn('Ship24: 未找到跟踪数据')
    return {
      trackingNumber,
      carrier: null,
      events: [],
    }
  }
  
  const shipment = tracking.shipment || {}
  const events = tracking.events || []
  
  // 详细日志：记录原始shipment数据结构以便调试
  console.log('=== Ship24 原始 shipment 数据 ===')
  console.log(JSON.stringify(shipment, null, 2))
  
  // 提取货物和集装箱信息
  const delivery = shipment.delivery || {}
  const recipient = shipment.recipient || {}
  const origin = shipment.origin || {}
  
  // 尝试从事件中提取更多信息
  const latestEvent = events[0]
  const arrivalEvent = events.find(e => 
    e.status?.includes('arrived') || 
    e.status?.includes('discharged') ||
    e.statusMilestone === 'arrived'
  )
  const departureEvent = events.find(e => 
    e.status?.includes('departed') || 
    e.statusMilestone === 'departed'
  )
  
  // 从多个可能的字段提取 ETA（Ship24 可能使用不同字段名）
  const eta = extractETA(shipment, delivery, recipient, events)
  const etd = extractETD(shipment, departureEvent, origin, events)
  
  // 详细日志：记录提取的时间信息
  console.log('=== Ship24 时间提取结果 ===')
  console.log({
    eta,
    etd,
    'delivery.estimatedDeliveryDate': delivery.estimatedDeliveryDate,
    'shipment.estimatedArrivalDate': shipment.estimatedArrivalDate,
    'shipment.eta': shipment.eta,
    'recipient.estimatedArrivalDate': recipient?.estimatedArrivalDate,
  })
  
  return {
    trackingNumber: shipment.trackingNumber || trackingNumber,
    carrier: shipment.carrier?.name || shipment.courierName || null,
    carrierCode: shipment.carrier?.code || shipment.courierCode || null,
    
    // 船名航次（从事件或shipment中提取）
    vessel: extractVessel(events, shipment),
    voyage: extractVoyage(events, shipment),
    
    // 码头信息 - 改进：优先从目的港事件或shipment提取
    terminal: extractTerminal(events, shipment, recipient),
    terminalCode: null,
    
    // 时间信息 - 使用改进的提取逻辑
    eta: eta,
    etd: etd,
    ata: arrivalEvent?.datetime || null, // 实际到港时间
    
    // 货物信息（Ship24 可能不返回这些详细信息）
    pieces: shipment.pieces || null,
    grossWeight: shipment.weight?.value || null,
    volume: shipment.volume?.value || null,
    
    // 集装箱信息
    containerNumber: shipment.containerNumber || extractContainerNumber(events) || null,
    containerType: shipment.containerType || null,
    sealNumber: shipment.sealNumber || null,
    
    // 地点信息
    originPort: origin.city || origin.name || null,
    destinationPort: recipient.city || recipient.name || delivery.city || null,
    
    // 状态信息
    status: shipment.statusMilestone || latestEvent?.statusMilestone || null,
    statusDescription: latestEvent?.status || null,
    
    // 原始事件
    events: events.map(event => ({
      eventType: mapShip24EventType(event),
      eventTime: event.datetime || event.timestamp,
      location: formatLocation(event.location),
      description: event.status || event.description,
      terminal: event.location?.facility || null,
      vessel: event.vessel || null,
    })),
    
    // 原始数据（用于调试）
    _raw: tracking,
  }
}

/**
 * 从多个可能的字段提取 ETA（预计到达时间）
 * Ship24 API 可能在不同字段返回 ETA
 */
function extractETA(shipment, delivery, recipient, events) {
  // 按优先级尝试多个可能的字段
  const possibleETA = 
    delivery?.estimatedDeliveryDate ||    // 最常见
    shipment?.estimatedArrivalDate ||     // 有些API用这个字段
    shipment?.eta ||                       // 简写形式
    recipient?.estimatedArrivalDate ||     // 从收件人信息
    shipment?.arrivalDate ||               // 到达日期
    delivery?.eta ||                        // delivery下的eta
    null
  
  // 如果都没有，尝试从事件中提取预计到港时间
  if (!possibleETA && events?.length > 0) {
    // 查找包含ETA信息的事件
    for (const event of events) {
      if (event.estimatedArrivalDate) return event.estimatedArrivalDate
      if (event.eta) return event.eta
      // 从描述中提取
      const match = event.status?.match(/(?:ETA|预计到达)[:\s]*(\d{4}-\d{2}-\d{2})/i)
      if (match) return match[1]
    }
  }
  
  return possibleETA
}

/**
 * 从多个可能的字段提取 ETD（预计离开时间）
 */
function extractETD(shipment, departureEvent, origin, events) {
  // 按优先级尝试多个可能的字段
  const possibleETD = 
    shipment?.estimatedDepartureDate ||    // 最常见
    shipment?.etd ||                        // 简写形式
    origin?.estimatedDepartureDate ||       // 从起运信息
    departureEvent?.datetime ||             // 从离港事件
    shipment?.departureDate ||              // 离开日期
    null
  
  // 如果都没有，尝试从事件中提取
  if (!possibleETD && events?.length > 0) {
    for (const event of events) {
      if (event.estimatedDepartureDate) return event.estimatedDepartureDate
      if (event.etd) return event.etd
      // 从描述中提取
      const match = event.status?.match(/(?:ETD|预计离开)[:\s]*(\d{4}-\d{2}-\d{2})/i)
      if (match) return match[1]
    }
  }
  
  return possibleETD
}

/**
 * 从事件中提取船名
 */
function extractVessel(events, shipment) {
  // 优先从 shipment 中获取
  if (shipment.vessel) return shipment.vessel
  
  // 从事件中查找
  for (const event of events) {
    if (event.vessel) return event.vessel
    // 有些事件描述中包含船名
    const match = event.status?.match(/vessel[:\s]+([A-Z\s]+)/i)
    if (match) return match[1].trim()
  }
  
  return null
}

/**
 * 从事件中提取航次
 */
function extractVoyage(events, shipment) {
  if (shipment.voyage) return shipment.voyage
  
  for (const event of events) {
    if (event.voyage) return event.voyage
    const match = event.status?.match(/(?:voyage|voy\.?)[:\s]+([A-Z0-9]+)/i)
    if (match) return match[1].trim()
  }
  
  return null
}

/**
 * 从事件中提取码头信息
 * 改进：优先从卸货港/目的港相关的事件和shipment信息提取
 */
function extractTerminal(events, shipment, recipient) {
  // 1. 优先从 shipment 的目的港信息提取
  if (shipment?.dischargePort?.facility) {
    return shipment.dischargePort.facility
  }
  if (shipment?.destination?.facility) {
    return shipment.destination.facility
  }
  if (recipient?.facility) {
    return recipient.facility
  }
  if (recipient?.terminal) {
    return recipient.terminal
  }
  
  // 2. 从事件中查找目的港码头（优先卸货事件）
  if (events && events.length > 0) {
    // 先找卸货/到港事件的码头
    for (const event of events) {
      const status = (event.status || '').toLowerCase()
      if (status.includes('discharg') || status.includes('unload') || 
          event.statusMilestone === 'arrived') {
        if (event.location?.facility) {
          return event.location.facility
        }
        if (event.location?.terminal) {
          return event.location.terminal
        }
        // 从location name中提取（如果包含Terminal/Port等关键词）
        if (event.location?.name && 
            (event.location.name.includes('Terminal') || 
             event.location.name.includes('Port') ||
             event.location.name.includes('Container'))) {
          return event.location.name
        }
      }
    }
    
    // 再找其他事件中的facility信息
    for (const event of events) {
      if (event.location?.facility) {
        return event.location.facility
      }
    }
  }
  
  return null
}

/**
 * 从事件中提取集装箱号
 */
function extractContainerNumber(events) {
  for (const event of events) {
    if (event.containerNumber) return event.containerNumber
    // 尝试从描述中匹配集装箱号格式 (4字母+7数字)
    const match = event.status?.match(/([A-Z]{4}\d{7})/i)
    if (match) return match[1].toUpperCase()
  }
  return null
}

/**
 * 格式化位置信息
 */
function formatLocation(location) {
  if (!location) return ''
  
  const parts = []
  if (location.facility) parts.push(location.facility)
  if (location.city) parts.push(location.city)
  if (location.country) parts.push(location.country)
  
  return parts.join(', ') || location.name || ''
}

/**
 * 映射 Ship24 事件类型到系统事件类型
 */
function mapShip24EventType(event) {
  const status = (event.status || '').toLowerCase()
  const milestone = event.statusMilestone || ''
  
  // 根据状态里程碑映射
  const milestoneMap = {
    'pending': 'PENDING',
    'info_received': 'INFO_RECEIVED',
    'in_transit': 'IN_TRANSIT',
    'out_for_delivery': 'OUT_FOR_DELIVERY',
    'failed_attempt': 'FAILED_ATTEMPT',
    'available_for_pickup': 'AVAILABLE_FOR_PICKUP',
    'delivered': 'DELIVERED',
    'exception': 'EXCEPTION',
  }
  
  if (milestoneMap[milestone]) {
    return milestoneMap[milestone]
  }
  
  // 根据状态描述匹配
  if (status.includes('departed') || status.includes('sailing')) {
    return 'VESSEL_DEPARTED'
  }
  if (status.includes('arrived') || status.includes('arrival')) {
    return 'VESSEL_ARRIVED'
  }
  if (status.includes('discharged') || status.includes('unload')) {
    return 'DISCHARGED'
  }
  if (status.includes('gate out') || status.includes('gateout')) {
    return 'GATE_OUT'
  }
  if (status.includes('gate in') || status.includes('gatein')) {
    return 'GATE_IN'
  }
  if (status.includes('customs') && status.includes('release')) {
    return 'CUSTOMS_RELEASED'
  }
  if (status.includes('customs') || status.includes('clearance')) {
    return 'CUSTOMS_HOLD'
  }
  if (status.includes('deliver')) {
    return 'DELIVERED'
  }
  
  return 'IN_TRANSIT'
}

/**
 * 将 Ship24 数据转换为系统统一格式的跟踪记录
 * @param {Object} rawData - Ship24 格式的数据
 * @param {string} billId - 提单ID
 * @param {string} transportType - 运输方式
 * @returns {Array} 标准化记录数组
 */
export function normalizeRecords(rawData, billId, transportType = 'sea') {
  if (!rawData || !rawData.events || rawData.events.length === 0) {
    return []
  }
  
  // 事件类型到系统节点类型的映射
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
      source: 'ship24',
      operator: '系统',
      rawData: event,
    }
  })
}

/**
 * 从追踪数据中提取补充信息
 * @param {Object} trackingData - 追踪数据
 * @returns {Object} 补充信息
 */
export function extractSupplementInfo(trackingData) {
  if (!trackingData) {
    return null
  }
  
  return {
    // 码头/堆场信息
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
    // 状态
    status: trackingData.status || null,
    statusDescription: trackingData.statusDescription || null,
  }
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

export default {
  fetchTracking,
  normalizeRecords,
  extractSupplementInfo,
  getNodeTemplates,
}
