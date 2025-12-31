/**
 * 船公司跟踪API适配器
 * 
 * 支持各船公司直连API：
 *    - 马士基 (Maersk)
 *    - 中远海运 (COSCO)
 *    - 地中海航运 (MSC)
 *    - 达飞轮船 (CMA CGM)
 *    - 长荣海运 (Evergreen)
 *    - 赫伯罗特 (Hapag-Lloyd)
 *    - 东方海外 (OOCL)
 */

import { NODE_TYPES, TRACKING_STATUS } from '../model.js'

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
  
  // 识别船公司代码（从提单号或集装箱号前4位）
  const number = trackingNumber || containerNumber || ''
  const carrierCode = number.substring(0, 4).toUpperCase()
  const carrier = CARRIER_CODES[carrierCode]
  
  console.log(`跟踪查询: ${number}, 识别船公司: ${carrier || '未知'}`)
  
  // 1. 尝试使用船公司直连 API（数据更准确）
  if (carrier && config?.apiKey) {
    try {
      console.log(`🚢 尝试使用 ${carrier.toUpperCase()} 官方API...`)
      let result = null
      
      switch (carrier) {
        case 'maersk':
          result = await fetchMaerskTracking(trackingNumber, containerNumber, config)
          break
        case 'cosco':
          result = await fetchCoscoTracking(trackingNumber, containerNumber, config)
          break
        case 'msc':
          result = await fetchMscTracking(trackingNumber, containerNumber, config)
          break
        case 'cmacgm':
          result = await fetchCmaCgmTracking(trackingNumber, containerNumber, config)
          break
        case 'oocl':
          result = await fetchOoclTracking(trackingNumber, containerNumber, config)
          break
        case 'hapag':
          result = await fetchHapagTracking(trackingNumber, containerNumber, config)
          break
        case 'evergreen':
          result = await fetchEvergreenTracking(trackingNumber, containerNumber, config)
          break
      }
      
      if (result && (result.events?.length > 0 || result.eta)) {
        console.log(`✅ ${carrier.toUpperCase()} 官方API 返回数据`)
        return result
      }
    } catch (error) {
      console.error(`${carrier} 官方API调用失败:`, error.message)
    }
  }
  
  // 2. 尝试通用跟踪API
  if (config && config.apiUrl && !config.providerCode) {
    try {
      return await fetchGenericTracking(trackingNumber, containerNumber, config)
    } catch (error) {
      console.error('通用跟踪API调用失败:', error.message)
    }
  }
  
  // 没有有效的API配置，返回null（不返回模拟数据）
  console.log('⚠️ 未配置有效API，无法获取真实数据')
  return null
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
    return null
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
    return null
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
    return null
  }
}

/**
 * CMA CGM 达飞轮船 API 跟踪
 * OAuth 2.0 认证
 */
async function fetchCmaCgmTracking(billNumber, containerNumber, config) {
  try {
    // CMA CGM 使用 OAuth 2.0，需要先获取 access token
    let accessToken = config.accessToken
    
    // 如果没有有效的 access token，先获取
    if (!accessToken && config.clientId && config.clientSecret) {
      const tokenResponse = await fetch(`${config.apiUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      })
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        accessToken = tokenData.access_token
      }
    }
    
    // 如果仍然没有 token，使用 apiKey 作为备选
    const authHeader = accessToken 
      ? `Bearer ${accessToken}` 
      : `Bearer ${config.apiKey}`
    
    const response = await fetch(
      `${config.apiUrl}/tracking/v1/shipments/${billNumber || containerNumber}`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`CMA CGM API error: ${response.status}`)
    }
    
    const data = await response.json()
    return normalizeCmaCgmResponse(data, billNumber || containerNumber)
  } catch (error) {
    console.error('达飞轮船API调用失败:', error)
    throw error // 抛出错误让上层处理降级
  }
}

/**
 * OOCL 东方海外 API 跟踪
 */
async function fetchOoclTracking(billNumber, containerNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/cargoTracking/query?blNo=${billNumber}`,
      {
        headers: {
          'apiKey': config.apiKey,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`OOCL API error: ${response.status}`)
    }
    
    const data = await response.json()
    return normalizeOoclResponse(data, billNumber || containerNumber)
  } catch (error) {
    console.error('东方海外API调用失败:', error)
    throw error
  }
}

/**
 * Hapag-Lloyd 赫伯罗特 API 跟踪
 */
async function fetchHapagTracking(billNumber, containerNumber, config) {
  try {
    // Hapag-Lloyd 支持按集装箱号或提单号查询
    const endpoint = containerNumber 
      ? `/track/v1/containers/${containerNumber}`
      : `/track/v1/shipments/${billNumber}`
    
    const response = await fetch(
      `${config.apiUrl}${endpoint}`,
      {
        headers: {
          'X-API-Key': config.apiKey,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Hapag-Lloyd API error: ${response.status}`)
    }
    
    const data = await response.json()
    return normalizeHapagResponse(data, billNumber || containerNumber)
  } catch (error) {
    console.error('赫伯罗特API调用失败:', error)
    throw error
  }
}

/**
 * Evergreen 长荣海运 API 跟踪
 */
async function fetchEvergreenTracking(billNumber, containerNumber, config) {
  try {
    const response = await fetch(
      `${config.apiUrl}/tracking/cargo?blNo=${billNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Evergreen API error: ${response.status}`)
    }
    
    const data = await response.json()
    return normalizeEvergreenResponse(data, billNumber || containerNumber)
  } catch (error) {
    console.error('长荣海运API调用失败:', error)
    throw error
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
    return null
  }
}

// ==================== 响应数据标准化函数 ====================

/**
 * 标准化 CMA CGM 达飞轮船 API 响应
 */
function normalizeCmaCgmResponse(data, trackingNumber) {
  // CMA CGM 响应结构适配
  const shipment = data?.shipment || data
  const events = data?.events || shipment?.events || []
  
  return {
    trackingNumber: shipment?.billOfLading || trackingNumber,
    carrier: 'CMA CGM',
    carrierCode: 'CMAU',
    vessel: shipment?.vessel?.name || null,
    voyage: shipment?.vessel?.voyage || null,
    terminal: shipment?.destination?.terminal || extractTerminalFromEvents(events),
    terminalCode: null,
    eta: shipment?.eta || shipment?.estimatedArrival || null,
    etd: shipment?.etd || shipment?.estimatedDeparture || null,
    ata: shipment?.ata || shipment?.actualArrival || null,
    pieces: shipment?.cargo?.packageCount || null,
    grossWeight: shipment?.cargo?.weight?.value || null,
    volume: shipment?.cargo?.volume?.value || null,
    containerNumber: shipment?.container?.number || null,
    containerType: shipment?.container?.type || null,
    sealNumber: shipment?.container?.sealNumber || null,
    originPort: shipment?.origin?.port || shipment?.origin?.name || null,
    destinationPort: shipment?.destination?.port || shipment?.destination?.name || null,
    status: shipment?.status || null,
    events: normalizeEvents(events, 'cmacgm'),
    _dataSource: 'cmacgm_official',
    _raw: data,
  }
}

/**
 * 标准化 OOCL 东方海外 API 响应
 */
function normalizeOoclResponse(data, trackingNumber) {
  const shipment = data?.cargoTrackingInfo || data
  const events = shipment?.trackingEvents || []
  
  return {
    trackingNumber: shipment?.blNo || trackingNumber,
    carrier: 'OOCL',
    carrierCode: 'OOCL',
    vessel: shipment?.vesselName || null,
    voyage: shipment?.voyageNo || null,
    terminal: shipment?.dischargeTerminal || extractTerminalFromEvents(events),
    terminalCode: null,
    eta: shipment?.eta || null,
    etd: shipment?.etd || null,
    ata: shipment?.ata || null,
    pieces: shipment?.packageQty || null,
    grossWeight: shipment?.grossWeight || null,
    volume: shipment?.measurement || null,
    containerNumber: shipment?.containerNo || null,
    containerType: shipment?.containerType || null,
    sealNumber: shipment?.sealNo || null,
    originPort: shipment?.polName || shipment?.pol || null,
    destinationPort: shipment?.podName || shipment?.pod || null,
    status: shipment?.currentStatus || null,
    events: normalizeEvents(events, 'oocl'),
    _dataSource: 'oocl_official',
    _raw: data,
  }
}

/**
 * 标准化 Hapag-Lloyd 赫伯罗特 API 响应
 */
function normalizeHapagResponse(data, trackingNumber) {
  const shipment = data?.shipment || data?.container || data
  const events = data?.events || shipment?.events || []
  
  return {
    trackingNumber: shipment?.blNumber || shipment?.referenceNumber || trackingNumber,
    carrier: 'Hapag-Lloyd',
    carrierCode: 'HLCU',
    vessel: shipment?.vessel || null,
    voyage: shipment?.voyage || null,
    terminal: shipment?.destinationTerminal || extractTerminalFromEvents(events),
    terminalCode: null,
    eta: shipment?.estimatedTimeOfArrival || shipment?.eta || null,
    etd: shipment?.estimatedTimeOfDeparture || shipment?.etd || null,
    ata: shipment?.actualTimeOfArrival || null,
    pieces: shipment?.numberOfPackages || null,
    grossWeight: shipment?.grossWeight || null,
    volume: shipment?.volume || null,
    containerNumber: shipment?.containerNumber || null,
    containerType: shipment?.containerType || shipment?.equipmentType || null,
    sealNumber: shipment?.sealNumber || null,
    originPort: shipment?.portOfLoading || null,
    destinationPort: shipment?.portOfDischarge || null,
    status: shipment?.transportStatus || null,
    events: normalizeEvents(events, 'hapag'),
    _dataSource: 'hapag_official',
    _raw: data,
  }
}

/**
 * 标准化 Evergreen 长荣海运 API 响应
 */
function normalizeEvergreenResponse(data, trackingNumber) {
  const shipment = data?.trackingResult || data
  const events = shipment?.events || data?.events || []
  
  return {
    trackingNumber: shipment?.blNo || trackingNumber,
    carrier: 'Evergreen',
    carrierCode: 'EGLV',
    vessel: shipment?.vesselName || null,
    voyage: shipment?.voyageNo || null,
    terminal: shipment?.dischargeTerminal || extractTerminalFromEvents(events),
    terminalCode: null,
    eta: shipment?.eta || null,
    etd: shipment?.etd || null,
    ata: shipment?.ata || null,
    pieces: shipment?.pkgQty || null,
    grossWeight: shipment?.weight || null,
    volume: shipment?.cbm || null,
    containerNumber: shipment?.containerNo || null,
    containerType: shipment?.cntrType || null,
    sealNumber: shipment?.sealNo || null,
    originPort: shipment?.polName || null,
    destinationPort: shipment?.podName || null,
    status: shipment?.currentStatus || null,
    events: normalizeEvents(events, 'evergreen'),
    _dataSource: 'evergreen_official',
    _raw: data,
  }
}

/**
 * 从事件列表中提取码头信息
 */
function extractTerminalFromEvents(events) {
  if (!events || events.length === 0) return null
  
  // 优先查找卸货/到港事件
  for (const event of events) {
    const eventType = (event.eventType || event.type || '').toLowerCase()
    const status = (event.status || event.description || '').toLowerCase()
    
    if (eventType.includes('discharge') || eventType.includes('arrival') ||
        status.includes('discharge') || status.includes('unload')) {
      if (event.terminal || event.facility || event.location?.terminal) {
        return event.terminal || event.facility || event.location?.terminal
      }
    }
  }
  
  // 找不到卸货事件，返回最后一个有码头信息的事件
  for (const event of events.reverse()) {
    if (event.terminal || event.facility) {
      return event.terminal || event.facility
    }
  }
  
  return null
}

/**
 * 标准化事件列表
 */
function normalizeEvents(events, carrierCode) {
  if (!events || events.length === 0) return []
  
  return events.map(event => {
    // 不同船公司的事件结构适配
    let eventTime, eventType, location, description, terminal, vessel
    
    switch (carrierCode) {
      case 'cmacgm':
        eventTime = event.timestamp || event.dateTime
        eventType = event.type || event.eventCode
        location = event.location?.name || event.place
        description = event.description || event.eventDescription
        terminal = event.location?.terminal || event.facility
        vessel = event.vessel
        break
        
      case 'oocl':
        eventTime = event.eventDate || event.timestamp
        eventType = event.eventCode || event.eventType
        location = event.locationName || event.location
        description = event.eventDesc || event.description
        terminal = event.terminal
        vessel = event.vessel
        break
        
      case 'hapag':
        eventTime = event.eventDateTime || event.timestamp
        eventType = event.eventType || event.code
        location = event.location || event.place
        description = event.eventDescription || event.description
        terminal = event.terminal || event.facility
        vessel = event.vessel || event.vesselName
        break
        
      case 'evergreen':
        eventTime = event.eventDate || event.dateTime
        eventType = event.eventCode || event.eventType
        location = event.location || event.place
        description = event.eventDesc || event.description
        terminal = event.terminal
        vessel = event.vessel
        break
        
      default:
        eventTime = event.timestamp || event.dateTime || event.eventDate
        eventType = event.type || event.eventType || event.eventCode
        location = event.location || event.place
        description = event.description || event.eventDescription
        terminal = event.terminal || event.facility
        vessel = event.vessel
    }
    
    return {
      eventType: mapEventType(eventType),
      eventTime,
      location,
      description,
      terminal,
      vessel,
    }
  })
}

/**
 * 映射事件类型到系统标准类型
 */
function mapEventType(rawType) {
  if (!rawType) return 'IN_TRANSIT'
  
  const type = rawType.toLowerCase()
  
  if (type.includes('gate') && type.includes('out')) return 'GATE_OUT'
  if (type.includes('gate') && type.includes('in')) return 'GATE_IN'
  if (type.includes('load') && !type.includes('unload')) return 'VESSEL_DEPARTED'
  if (type.includes('depart') || type.includes('sail')) return 'VESSEL_DEPARTED'
  if (type.includes('arriv')) return 'VESSEL_ARRIVED'
  if (type.includes('discharge') || type.includes('unload')) return 'DISCHARGED'
  if (type.includes('customs') && type.includes('release')) return 'CUSTOMS_RELEASED'
  if (type.includes('customs') || type.includes('clearance')) return 'CUSTOMS_HOLD'
  if (type.includes('deliver')) return 'DELIVERED'
  
  return 'IN_TRANSIT'
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
  
  // 检查是否所有字段都是null，如果是则返回null（表示没有真实数据）
  const hasAnyData = Object.values(info).some(value => value !== null && value !== undefined)
  if (!hasAnyData) {
    return null
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
