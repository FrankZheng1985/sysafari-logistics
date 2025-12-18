/**
 * 物流跟踪模块 - 数据模型
 * 
 * 包含：跟踪记录、API配置、手动节点管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 跟踪状态常量 ====================

export const TRACKING_STATUS = {
  PENDING: 'pending',           // 待发运
  IN_TRANSIT: 'in_transit',     // 运输中
  ARRIVED: 'arrived',           // 已到达
  CUSTOMS: 'customs',           // 清关中
  DELIVERED: 'delivered',       // 已签收
  EXCEPTION: 'exception',       // 异常
}

export const TRANSPORT_TYPES = {
  SEA: 'sea',     // 海运
  AIR: 'air',     // 空运
  RAIL: 'rail',   // 铁路
  TRUCK: 'truck', // 卡航
}

export const NODE_TYPES = {
  // 通用节点
  DEPARTURE: 'departure',         // 发运
  IN_TRANSIT: 'in_transit',       // 运输中
  ARRIVAL: 'arrival',             // 到达
  CUSTOMS_START: 'customs_start', // 开始清关
  CUSTOMS_CLEAR: 'customs_clear', // 清关放行
  DELIVERY: 'delivery',           // 派送
  SIGNED: 'signed',               // 签收
  
  // 海运特有节点
  VESSEL_DEPARTED: 'vessel_departed',   // 船舶离港
  VESSEL_ARRIVED: 'vessel_arrived',     // 船舶到港
  CONTAINER_UNLOAD: 'container_unload', // 卸柜
  
  // 空运特有节点
  FLIGHT_DEPARTED: 'flight_departed', // 航班起飞
  FLIGHT_ARRIVED: 'flight_arrived',   // 航班降落
  CARGO_READY: 'cargo_ready',         // 货物就绪
  
  // 铁路特有节点
  TRAIN_DEPARTED: 'train_departed', // 列车发车
  BORDER_CROSS: 'border_cross',     // 过境
  TRAIN_ARRIVED: 'train_arrived',   // 列车到站
  
  // 卡航特有节点
  TRUCK_DEPARTED: 'truck_departed', // 卡车发车
  CHECKPOINT: 'checkpoint',         // 中转站
  TRUCK_ARRIVED: 'truck_arrived',   // 卡车到达
}

// ==================== 跟踪记录管理 ====================

/**
 * 获取提单的跟踪记录
 * @param {string} billId - 提单ID
 * @returns {Promise<Array>} 跟踪记录列表
 */
export async function getTrackingRecords(billId) {
  const db = getDatabase()
  
  const records = await db.prepare(`
    SELECT * FROM tracking_records 
    WHERE bill_id = ? 
    ORDER BY event_time DESC, created_at DESC
  `).all(billId)
  
  return records.map(convertTrackingRecordToCamelCase)
}

/**
 * 添加跟踪记录
 * @param {Object} data - 跟踪数据
 * @returns {Promise<Object>} 创建结果
 */
export async function addTrackingRecord(data) {
  const db = getDatabase()
  const id = generateId('trk')
  
  const now = new Date().toISOString()
  
  await db.prepare(`
    INSERT INTO tracking_records (
      id, bill_id, transport_type, tracking_number,
      node_type, node_name, status, location,
      event_time, remark, source, operator,
      latitude, longitude, raw_data,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.billId,
    data.transportType || 'sea',
    data.trackingNumber || '',
    data.nodeType || NODE_TYPES.IN_TRANSIT,
    data.nodeName || '',
    data.status || TRACKING_STATUS.IN_TRANSIT,
    data.location || '',
    data.eventTime || now,
    data.remark || '',
    data.source || 'manual', // manual | api
    data.operator || '系统',
    data.latitude || null,
    data.longitude || null,
    data.rawData ? JSON.stringify(data.rawData) : null,
    now,
    now
  )
  
  return { id }
}

/**
 * 批量添加跟踪记录
 * @param {Array} records - 跟踪记录数组
 * @returns {Promise<Object>} 创建结果
 */
export async function batchAddTrackingRecords(records) {
  const db = getDatabase()
  const now = new Date().toISOString()
  const ids = []
  
  const stmt = db.prepare(`
    INSERT INTO tracking_records (
      id, bill_id, transport_type, tracking_number,
      node_type, node_name, status, location,
      event_time, remark, source, operator,
      latitude, longitude, raw_data,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  for (const data of records) {
    const id = generateId('trk')
    ids.push(id)
    
    await stmt.run(
      id,
      data.billId,
      data.transportType || 'sea',
      data.trackingNumber || '',
      data.nodeType || NODE_TYPES.IN_TRANSIT,
      data.nodeName || '',
      data.status || TRACKING_STATUS.IN_TRANSIT,
      data.location || '',
      data.eventTime || now,
      data.remark || '',
      data.source || 'api',
      data.operator || '系统',
      data.latitude || null,
      data.longitude || null,
      data.rawData ? JSON.stringify(data.rawData) : null,
      now,
      now
    )
  }
  
  return { ids, count: ids.length }
}

/**
 * 更新跟踪记录
 * @param {string} id - 记录ID
 * @param {Object} data - 更新数据
 * @returns {Promise<boolean>} 更新结果
 */
export async function updateTrackingRecord(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    nodeType: 'node_type',
    nodeName: 'node_name',
    status: 'status',
    location: 'location',
    eventTime: 'event_time',
    remark: 'remark',
    latitude: 'latitude',
    longitude: 'longitude',
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)
  
  const result = await db.prepare(`UPDATE tracking_records SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除跟踪记录
 * @param {string} id - 记录ID
 * @returns {Promise<boolean>} 删除结果
 */
export async function deleteTrackingRecord(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM tracking_records WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== API配置管理 ====================

/**
 * 获取跟踪API配置列表
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 配置列表
 */
export async function getTrackingApiConfigs(params = {}) {
  const db = getDatabase()
  const { transportType, status, provider } = params
  
  let query = 'SELECT * FROM tracking_api_configs WHERE 1=1'
  const queryParams = []
  
  if (transportType) {
    query += ' AND transport_type = ?'
    queryParams.push(transportType)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (provider) {
    query += ' AND provider_code = ?'
    queryParams.push(provider)
  }
  
  query += ' ORDER BY transport_type, provider_name'
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertApiConfigToCamelCase),
    total: list.length
  }
}

/**
 * 获取单个API配置
 * @param {string} id - 配置ID
 * @returns {Promise<Object|null>} 配置详情
 */
export async function getTrackingApiConfigById(id) {
  const db = getDatabase()
  const config = await db.prepare('SELECT * FROM tracking_api_configs WHERE id = ?').get(id)
  return config ? convertApiConfigToCamelCase(config) : null
}

/**
 * 创建API配置
 * @param {Object} data - 配置数据
 * @returns {Promise<Object>} 创建结果
 */
export async function createTrackingApiConfig(data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const result = await db.prepare(`
    INSERT INTO tracking_api_configs (
      provider_code, provider_name, transport_type,
      api_type, api_url, api_key, api_secret,
      extra_config, status, description,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.providerCode,
    data.providerName,
    data.transportType || 'sea',
    data.apiType || 'rest',
    data.apiUrl || '',
    data.apiKey || '',
    data.apiSecret || '',
    data.extraConfig ? JSON.stringify(data.extraConfig) : null,
    data.status || 'active',
    data.description || '',
    now,
    now
  )
  
  return { id: result.id }
}

/**
 * 更新API配置
 * @param {string} id - 配置ID
 * @param {Object} data - 更新数据
 * @returns {Promise<boolean>} 更新结果
 */
export async function updateTrackingApiConfig(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    providerCode: 'provider_code',
    providerName: 'provider_name',
    transportType: 'transport_type',
    apiType: 'api_type',
    apiUrl: 'api_url',
    apiKey: 'api_key',
    apiSecret: 'api_secret',
    status: 'status',
    description: 'description',
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.extraConfig !== undefined) {
    fields.push('extra_config = ?')
    values.push(data.extraConfig ? JSON.stringify(data.extraConfig) : null)
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)
  
  const result = await db.prepare(`UPDATE tracking_api_configs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除API配置
 * @param {string} id - 配置ID
 * @returns {Promise<boolean>} 删除结果
 */
export async function deleteTrackingApiConfig(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM tracking_api_configs WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 手动节点管理（卡航专用） ====================

/**
 * 获取预设节点模板
 * @param {string} transportType - 运输方式
 * @returns {Array} 节点模板列表
 */
export function getNodeTemplates(transportType) {
  const templates = {
    sea: [
      { nodeType: NODE_TYPES.DEPARTURE, nodeName: '离港', order: 1 },
      { nodeType: NODE_TYPES.VESSEL_DEPARTED, nodeName: '船舶启航', order: 2 },
      { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '海上运输中', order: 3 },
      { nodeType: NODE_TYPES.VESSEL_ARRIVED, nodeName: '船舶到港', order: 4 },
      { nodeType: NODE_TYPES.CONTAINER_UNLOAD, nodeName: '卸柜', order: 5 },
      { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 6 },
      { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 7 },
      { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 8 },
      { nodeType: NODE_TYPES.SIGNED, nodeName: '已签收', order: 9 },
    ],
    air: [
      { nodeType: NODE_TYPES.DEPARTURE, nodeName: '交运', order: 1 },
      { nodeType: NODE_TYPES.FLIGHT_DEPARTED, nodeName: '航班起飞', order: 2 },
      { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '空中运输', order: 3 },
      { nodeType: NODE_TYPES.FLIGHT_ARRIVED, nodeName: '航班降落', order: 4 },
      { nodeType: NODE_TYPES.CARGO_READY, nodeName: '货物就绪', order: 5 },
      { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 6 },
      { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 7 },
      { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 8 },
      { nodeType: NODE_TYPES.SIGNED, nodeName: '已签收', order: 9 },
    ],
    rail: [
      { nodeType: NODE_TYPES.DEPARTURE, nodeName: '发站装车', order: 1 },
      { nodeType: NODE_TYPES.TRAIN_DEPARTED, nodeName: '列车发车', order: 2 },
      { nodeType: NODE_TYPES.BORDER_CROSS, nodeName: '过境', order: 3 },
      { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '铁路运输中', order: 4 },
      { nodeType: NODE_TYPES.TRAIN_ARRIVED, nodeName: '列车到站', order: 5 },
      { nodeType: NODE_TYPES.CUSTOMS_START, nodeName: '开始清关', order: 6 },
      { nodeType: NODE_TYPES.CUSTOMS_CLEAR, nodeName: '清关放行', order: 7 },
      { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 8 },
      { nodeType: NODE_TYPES.SIGNED, nodeName: '已签收', order: 9 },
    ],
    truck: [
      { nodeType: NODE_TYPES.DEPARTURE, nodeName: '发车', order: 1 },
      { nodeType: NODE_TYPES.TRUCK_DEPARTED, nodeName: '卡车出发', order: 2 },
      { nodeType: NODE_TYPES.CHECKPOINT, nodeName: '中转站', order: 3 },
      { nodeType: NODE_TYPES.BORDER_CROSS, nodeName: '过境', order: 4 },
      { nodeType: NODE_TYPES.IN_TRANSIT, nodeName: '运输中', order: 5 },
      { nodeType: NODE_TYPES.TRUCK_ARRIVED, nodeName: '到达目的地', order: 6 },
      { nodeType: NODE_TYPES.DELIVERY, nodeName: '派送中', order: 7 },
      { nodeType: NODE_TYPES.SIGNED, nodeName: '签收', order: 8 },
    ],
  }
  
  return templates[transportType] || templates.sea
}

// ==================== 统计查询 ====================

/**
 * 获取提单的最新跟踪状态
 * @param {string} billId - 提单ID
 * @returns {Promise<Object|null>} 最新状态
 */
export async function getLatestTrackingStatus(billId) {
  const db = getDatabase()
  
  const record = await db.prepare(`
    SELECT * FROM tracking_records 
    WHERE bill_id = ? 
    ORDER BY event_time DESC, created_at DESC 
    LIMIT 1
  `).get(billId)
  
  return record ? convertTrackingRecordToCamelCase(record) : null
}

/**
 * 获取跟踪统计数据
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} 统计数据
 */
export async function getTrackingStats(params = {}) {
  const db = getDatabase()
  const { transportType, startDate, endDate } = params
  
  let whereClause = '1=1'
  const queryParams = []
  
  if (transportType) {
    whereClause += ' AND transport_type = ?'
    queryParams.push(transportType)
  }
  
  if (startDate) {
    whereClause += ' AND event_time >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND event_time <= ?'
    queryParams.push(endDate)
  }
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(DISTINCT bill_id) as total_bills,
      COUNT(*) as total_records,
      SUM(CASE WHEN status = 'in_transit' THEN 1 ELSE 0 END) as in_transit,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'exception' THEN 1 ELSE 0 END) as exceptions
    FROM tracking_records
    WHERE ${whereClause}
  `).get(...queryParams)
  
  return {
    totalBills: stats.total_bills || 0,
    totalRecords: stats.total_records || 0,
    inTransit: stats.in_transit || 0,
    delivered: stats.delivered || 0,
    exceptions: stats.exceptions || 0,
  }
}

// ==================== 数据转换函数 ====================

function convertTrackingRecordToCamelCase(row) {
  if (!row) return null
  
  return {
    id: row.id,
    billId: row.bill_id,
    transportType: row.transport_type,
    trackingNumber: row.tracking_number,
    nodeType: row.node_type,
    nodeName: row.node_name,
    status: row.status,
    location: row.location,
    eventTime: row.event_time,
    remark: row.remark,
    source: row.source,
    operator: row.operator,
    latitude: row.latitude,
    longitude: row.longitude,
    rawData: row.raw_data ? JSON.parse(row.raw_data) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function convertApiConfigToCamelCase(row) {
  if (!row) return null
  
  return {
    id: row.id,
    providerCode: row.provider_code,
    providerName: row.provider_name,
    transportType: row.transport_type,
    apiType: row.api_type,
    apiUrl: row.api_url,
    apiKey: row.api_key,
    apiSecret: row.api_secret,
    extraConfig: row.extra_config ? JSON.parse(row.extra_config) : null,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export default {
  // 常量
  TRACKING_STATUS,
  TRANSPORT_TYPES,
  NODE_TYPES,
  
  // 跟踪记录
  getTrackingRecords,
  addTrackingRecord,
  batchAddTrackingRecords,
  updateTrackingRecord,
  deleteTrackingRecord,
  
  // API配置
  getTrackingApiConfigs,
  getTrackingApiConfigById,
  createTrackingApiConfig,
  updateTrackingApiConfig,
  deleteTrackingApiConfig,
  
  // 手动节点
  getNodeTemplates,
  
  // 统计查询
  getLatestTrackingStatus,
  getTrackingStats,
}
