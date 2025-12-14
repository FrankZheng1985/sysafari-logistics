/**
 * TMS运输管理模块 - 数据模型
 * 包含：CMR管理、派送跟踪、异常处理、服务商管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== CMR派送状态常量 ====================

export const CMR_STATUS = {
  NOT_DELIVERED: '未派送',
  DELIVERING: '派送中',
  DELIVERED: '已送达',
  EXCEPTION: '订单异常',
  CLOSED: '异常关闭'
}

export const CMR_STEPS = {
  STEP1_PICKUP: 1,        // 预计提货时间
  STEP2_DESTINATION: 2,   // 预计到达目的地
  STEP3_DELIVERY: 3,      // 派送时间
  STEP4_UNLOADING: 4,     // 卸货完成
  STEP5_CONFIRM: 5        // 确认送达
}

export const EXCEPTION_STATUS = {
  OPEN: 'open',           // 异常待处理
  FOLLOWING: 'following', // 跟进中
  RESOLVED: 'resolved',   // 已解决
  CLOSED: 'closed'        // 已关闭
}

// ==================== CMR列表查询 ====================

/**
 * 获取CMR管理列表
 * 
 * 订单流转规则:
 * - undelivered（未派送）: 已到港 + 清关放行 + 查验通过（无查验或已放行）+ 派送状态为未派送
 * - delivering（派送中）: 派送状态为派送中
 * - exception（订单异常）: 派送状态为订单异常或异常关闭
 * - archived（已归档）: 派送状态为已送达或已完成
 */
export function getCMRList(params = {}) {
  const db = getDatabase()
  const { type = 'undelivered', search, page = 1, pageSize = 20 } = params
  
  let query = "SELECT * FROM bills_of_lading WHERE (is_void = 0 OR is_void IS NULL) AND status != '草稿'"
  const queryParams = []
  
  // 根据类型筛选（遵循订单流转规则）
  switch (type) {
    case 'undelivered':
    case 'pending':
      // 未派送: 必须已到港 + 清关放行 + 查验通过（无查验或已放行）+ 派送状态为未派送
      query += ` AND ship_status = '已到港' 
                 AND customs_status = '已放行' 
                 AND (inspection = '-' OR inspection = '已放行' OR inspection IS NULL)
                 AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status = '未派送' OR delivery_status = '待派送')`
      break
    case 'delivering':
      // 派送中
      query += " AND (delivery_status = '派送中' OR delivery_status = '配送中')"
      break
    case 'exception':
      // 订单异常
      query += " AND (delivery_status = '订单异常' OR delivery_status = '异常关闭')"
      break
    case 'archived':
    case 'delivered':
      // 已归档（已送达或已完成）
      query += " AND (delivery_status = '已送达' OR delivery_status = '已完成')"
      break
    case 'all':
      // 所有订单（用于搜索等场景）
      break
    default:
      // 默认显示未派送
      query += ` AND ship_status = '已到港' 
                 AND customs_status = '已放行' 
                 AND (inspection = '-' OR inspection = '已放行' OR inspection IS NULL)
                 AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status = '未派送' OR delivery_status = '待派送')`
  }
  
  // 搜索
  if (search) {
    query += ` AND (bill_number LIKE ? OR container_number LIKE ? OR shipper LIKE ? OR consignee LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  // 分页和排序
  query += ' ORDER BY order_seq DESC, updated_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
  // 获取各状态统计（遵循流转规则）
  const stats = getCMRStats()
  
  return {
    list: list.map(convertCMRToCamelCase),
    total: totalResult.total,
    page,
    pageSize,
    stats
  }
}

/**
 * 获取CMR统计数据
 * 
 * 统计规则（遵循订单流转规则）:
 * - undelivered: 已到港 + 清关放行 + 查验通过 + 未派送
 * - delivering: 派送中
 * - exception: 订单异常 + 异常关闭
 * - archived: 已送达 + 已完成
 */
export function getCMRStats() {
  const db = getDatabase()
  
  const stats = db.prepare(`
    SELECT 
      SUM(CASE 
        WHEN ship_status = '已到港' 
             AND customs_status = '已放行' 
             AND (inspection = '-' OR inspection = '已放行' OR inspection IS NULL)
             AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status = '未派送' OR delivery_status = '待派送')
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as undelivered,
      SUM(CASE 
        WHEN (delivery_status = '派送中' OR delivery_status = '配送中')
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as delivering,
      SUM(CASE 
        WHEN (delivery_status = '订单异常' OR delivery_status = '异常关闭')
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as exception,
      SUM(CASE 
        WHEN (delivery_status = '已送达' OR delivery_status = '已完成')
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as archived
    FROM bills_of_lading
  `).get()
  
  return {
    undelivered: stats.undelivered || 0,
    delivering: stats.delivering || 0,
    exception: stats.exception || 0,
    archived: stats.archived || 0
  }
}

/**
 * 根据ID获取CMR详情
 */
export function getCMRById(id) {
  const db = getDatabase()
  const bill = db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
  return bill ? convertCMRToCamelCase(bill) : null
}

// ==================== CMR派送流程 ====================

/**
 * 开始派送（Step 1: 预计提货时间）
 */
export function startDelivery(id, data) {
  const db = getDatabase()
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '派送中',
        cmr_estimated_pickup_time = ?,
        cmr_service_provider = ?,
        cmr_current_step = 1,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.estimatedPickupTime,
    data.serviceProvider || '',
    id
  )
  
  return result.changes > 0
}

/**
 * 更新目的地信息（Step 2: 预计到达目的地）
 */
export function updateDestination(id, data) {
  const db = getDatabase()
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_delivery_address = ?,
        cmr_estimated_arrival_time = ?,
        cmr_current_step = 2,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.deliveryAddress,
    data.estimatedArrivalTime,
    id
  )
  
  return result.changes > 0
}

/**
 * 记录派送时间（Step 3: 实际派送时间）
 */
export function recordDeliveryTime(id, data) {
  const db = getDatabase()
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_actual_arrival_time = ?,
        cmr_current_step = 3,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.actualArrivalTime,
    id
  )
  
  return result.changes > 0
}

/**
 * 卸货完成（Step 4: 卸货完成时间）
 */
export function completeUnloading(id, data) {
  const db = getDatabase()
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_unloading_complete_time = ?,
        cmr_current_step = 4,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.unloadingCompleteTime,
    id
  )
  
  return result.changes > 0
}

/**
 * 确认送达（Step 5: 最终确认）
 */
export function confirmDelivery(id, data) {
  const db = getDatabase()
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '已送达',
        cmr_confirmed_time = ?,
        cmr_current_step = 5,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.confirmedTime || new Date().toISOString(),
    id
  )
  
  return result.changes > 0
}

/**
 * 更新CMR详细信息（一次性更新多个步骤）
 */
export function updateCMRDetail(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  // 派送状态
  if (data.deliveryStatus !== undefined) {
    fields.push('delivery_status = ?')
    values.push(data.deliveryStatus)
  }
  
  // 当前步骤
  if (data.currentStep !== undefined) {
    fields.push('cmr_current_step = ?')
    values.push(data.currentStep)
  }
  
  // Step 1: 提货信息
  if (data.estimatedPickupTime !== undefined) {
    fields.push('cmr_estimated_pickup_time = ?')
    values.push(data.estimatedPickupTime)
  }
  if (data.serviceProvider !== undefined) {
    fields.push('cmr_service_provider = ?')
    values.push(data.serviceProvider)
  }
  
  // Step 2: 目的地信息
  if (data.deliveryAddress !== undefined) {
    fields.push('cmr_delivery_address = ?')
    values.push(data.deliveryAddress)
  }
  if (data.estimatedArrivalTime !== undefined) {
    fields.push('cmr_estimated_arrival_time = ?')
    values.push(data.estimatedArrivalTime)
  }
  
  // Step 3: 实际派送时间
  if (data.actualArrivalTime !== undefined) {
    fields.push('cmr_actual_arrival_time = ?')
    values.push(data.actualArrivalTime)
  }
  
  // Step 4: 卸货完成时间
  if (data.unloadingCompleteTime !== undefined) {
    fields.push('cmr_unloading_complete_time = ?')
    values.push(data.unloadingCompleteTime)
  }
  
  // Step 5: 确认时间
  if (data.confirmedTime !== undefined) {
    fields.push('cmr_confirmed_time = ?')
    values.push(data.confirmedTime)
  }
  
  // 备注
  if (data.remark !== undefined) {
    fields.push('cmr_remark = ?')
    values.push(data.remark)
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = db.prepare(`UPDATE bills_of_lading SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

// ==================== 异常处理 ====================

/**
 * 标记异常
 */
export function markException(id, data) {
  const db = getDatabase()
  
  // 获取现有的异常记录
  const bill = db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
  let records = []
  
  if (bill && bill.cmr_exception_records) {
    try {
      records = JSON.parse(bill.cmr_exception_records)
    } catch (e) {
      records = []
    }
  }
  
  // 添加新的异常记录
  records.push({
    id: generateId(),
    type: 'exception',
    note: data.exceptionNote,
    operator: data.operator || '系统',
    time: new Date().toISOString(),
    step: data.currentStep || null
  })
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '订单异常',
        cmr_has_exception = 1,
        cmr_exception_note = ?,
        cmr_exception_time = datetime('now', 'localtime'),
        cmr_exception_status = 'open',
        cmr_exception_records = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    data.exceptionNote,
    JSON.stringify(records),
    id
  )
  
  return result.changes > 0
}

/**
 * 处理异常 - 继续跟进
 */
export function followUpException(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
  let records = []
  
  if (bill && bill.cmr_exception_records) {
    try {
      records = JSON.parse(bill.cmr_exception_records)
    } catch (e) {
      records = []
    }
  }
  
  // 添加跟进记录
  records.push({
    id: generateId(),
    type: 'follow_up',
    note: data.followUpNote,
    operator: data.operator || '系统',
    time: new Date().toISOString()
  })
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_exception_status = 'following',
        cmr_exception_records = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    JSON.stringify(records),
    id
  )
  
  return result.changes > 0
}

/**
 * 处理异常 - 解决并继续派送
 */
export function resolveAndContinue(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = db.prepare('SELECT cmr_exception_records, cmr_current_step FROM bills_of_lading WHERE id = ?').get(id)
  let records = []
  
  if (bill && bill.cmr_exception_records) {
    try {
      records = JSON.parse(bill.cmr_exception_records)
    } catch (e) {
      records = []
    }
  }
  
  // 添加解决记录
  records.push({
    id: generateId(),
    type: 'resolved_continue',
    note: data.resolveNote,
    operator: data.operator || '系统',
    time: new Date().toISOString()
  })
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '派送中',
        cmr_has_exception = 0,
        cmr_exception_status = 'resolved',
        cmr_exception_records = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    JSON.stringify(records),
    id
  )
  
  return result.changes > 0
}

/**
 * 处理异常 - 标记已解决（不继续派送）
 */
export function markResolved(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
  let records = []
  
  if (bill && bill.cmr_exception_records) {
    try {
      records = JSON.parse(bill.cmr_exception_records)
    } catch (e) {
      records = []
    }
  }
  
  // 添加解决记录
  records.push({
    id: generateId(),
    type: 'resolved',
    note: data.resolveNote,
    operator: data.operator || '系统',
    time: new Date().toISOString()
  })
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_exception_status = 'resolved',
        cmr_exception_records = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    JSON.stringify(records),
    id
  )
  
  return result.changes > 0
}

/**
 * 处理异常 - 关闭订单
 */
export function closeOrder(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
  let records = []
  
  if (bill && bill.cmr_exception_records) {
    try {
      records = JSON.parse(bill.cmr_exception_records)
    } catch (e) {
      records = []
    }
  }
  
  // 添加关闭记录
  records.push({
    id: generateId(),
    type: 'closed',
    note: data.closeNote,
    operator: data.operator || '系统',
    time: new Date().toISOString()
  })
  
  const result = db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '异常关闭',
        cmr_exception_status = 'closed',
        cmr_exception_records = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    JSON.stringify(records),
    id
  )
  
  return result.changes > 0
}

/**
 * 获取异常历史记录
 */
export function getExceptionHistory(id) {
  const db = getDatabase()
  const bill = db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
  
  if (!bill || !bill.cmr_exception_records) {
    return []
  }
  
  try {
    return JSON.parse(bill.cmr_exception_records)
  } catch (e) {
    return []
  }
}

// ==================== 服务商管理 ====================

/**
 * 获取服务商列表
 */
export function getServiceProviders(params = {}) {
  const db = getDatabase()
  const { type, status = 'active', search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM service_providers WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND service_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (provider_name LIKE ? OR provider_code LIKE ? OR contact_person LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY provider_name LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertServiceProviderToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取服务商
 */
export function getServiceProviderById(id) {
  const db = getDatabase()
  const provider = db.prepare('SELECT * FROM service_providers WHERE id = ?').get(id)
  return provider ? convertServiceProviderToCamelCase(provider) : null
}

/**
 * 创建服务商
 */
export function createServiceProvider(data) {
  const db = getDatabase()
  
  const result = db.prepare(`
    INSERT INTO service_providers (
      provider_code, provider_name, service_type, contact_person,
      contact_phone, contact_email, address, description, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `).run(
    data.providerCode,
    data.providerName,
    data.serviceType || 'delivery',
    data.contactPerson || '',
    data.contactPhone || '',
    data.contactEmail || '',
    data.address || '',
    data.description || '',
    data.status || 'active'
  )
  
  return { id: result.lastInsertRowid }
}

/**
 * 更新服务商
 */
export function updateServiceProvider(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    providerCode: 'provider_code',
    providerName: 'provider_name',
    serviceType: 'service_type',
    contactPerson: 'contact_person',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    address: 'address',
    description: 'description',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = datetime("now", "localtime")')
  values.push(id)
  
  const result = db.prepare(`UPDATE service_providers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除服务商
 */
export function deleteServiceProvider(id) {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM service_providers WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 操作日志 ====================

/**
 * 记录TMS操作日志
 */
export function addTMSLog(data) {
  const db = getDatabase()
  
  try {
    db.prepare(`
      INSERT INTO operation_logs (
        bill_id, operation_type, operation_name,
        old_value, new_value, remark,
        operator, operator_id, module,
        operation_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tms', datetime('now', 'localtime'))
    `).run(
      data.billId,
      data.operationType,
      data.operationName,
      data.oldValue || null,
      data.newValue || null,
      data.remark || null,
      data.operator || '系统',
      data.operatorId || null
    )
  } catch (error) {
    console.error('记录TMS日志失败:', error.message)
  }
}

/**
 * 获取TMS操作日志
 */
export function getTMSLogs(billId) {
  const db = getDatabase()
  const logs = db.prepare(`
    SELECT * FROM operation_logs 
    WHERE bill_id = ? AND module = 'tms'
    ORDER BY operation_time DESC
  `).all(billId)
  
  return logs.map(log => ({
    id: log.id,
    billId: log.bill_id,
    operationType: log.operation_type,
    operationName: log.operation_name,
    oldValue: log.old_value,
    newValue: log.new_value,
    remark: log.remark,
    operator: log.operator,
    operatorId: log.operator_id,
    operationTime: log.operation_time
  }))
}

// ==================== 数据转换函数 ====================

export function convertCMRToCamelCase(row) {
  if (!row) return null
  
  // 解析异常记录
  let exceptionRecords = []
  if (row.cmr_exception_records) {
    try {
      exceptionRecords = JSON.parse(row.cmr_exception_records)
    } catch (e) {
      exceptionRecords = []
    }
  }
  
  return {
    id: row.id,
    billNumber: row.bill_number,
    containerNumber: row.container_number,
    actualContainerNo: row.actual_container_no,
    vessel: row.vessel,
    shipper: row.shipper,
    consignee: row.consignee,
    portOfDischarge: row.port_of_discharge,
    placeOfDelivery: row.place_of_delivery,
    pieces: row.pieces,
    weight: row.weight,
    
    // 状态信息
    deliveryStatus: row.delivery_status,
    customsStatus: row.customs_status,
    
    // CMR详细信息
    cmrCurrentStep: row.cmr_current_step || 0,
    cmrEstimatedPickupTime: row.cmr_estimated_pickup_time,
    cmrServiceProvider: row.cmr_service_provider,
    cmrDeliveryAddress: row.cmr_delivery_address,
    cmrEstimatedArrivalTime: row.cmr_estimated_arrival_time,
    cmrActualArrivalTime: row.cmr_actual_arrival_time,
    cmrUnloadingCompleteTime: row.cmr_unloading_complete_time,
    cmrConfirmedTime: row.cmr_confirmed_time,
    cmrRemark: row.cmr_remark,
    
    // 异常信息
    cmrHasException: row.cmr_has_exception === 1,
    cmrExceptionNote: row.cmr_exception_note,
    cmrExceptionTime: row.cmr_exception_time,
    cmrExceptionStatus: row.cmr_exception_status,
    cmrExceptionRecords: exceptionRecords,
    
    // 时间戳
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertServiceProviderToCamelCase(row) {
  return {
    id: String(row.id),
    providerCode: row.provider_code,
    providerName: row.provider_name,
    serviceType: row.service_type,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    address: row.address,
    description: row.description,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export default {
  // 常量
  CMR_STATUS,
  CMR_STEPS,
  EXCEPTION_STATUS,
  
  // CMR列表
  getCMRList,
  getCMRStats,
  getCMRById,
  
  // CMR派送流程
  startDelivery,
  updateDestination,
  recordDeliveryTime,
  completeUnloading,
  confirmDelivery,
  updateCMRDetail,
  
  // 异常处理
  markException,
  followUpException,
  resolveAndContinue,
  markResolved,
  closeOrder,
  getExceptionHistory,
  
  // 服务商管理
  getServiceProviders,
  getServiceProviderById,
  createServiceProvider,
  updateServiceProvider,
  deleteServiceProvider,
  
  // 日志
  addTMSLog,
  getTMSLogs,
  
  // 转换函数
  convertCMRToCamelCase,
  convertServiceProviderToCamelCase
}

