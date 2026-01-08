/**
 * TMS运输管理模块 - 数据模型
 * 包含：CMR管理、派送跟踪、异常处理、服务商管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== CMR派送状态常量 ====================

export const CMR_STATUS = {
  NOT_DELIVERED: '待派送',
  DELIVERING: '派送中',
  DELIVERED: '已送达',
  EXCEPTION: '订单异常',
  CLOSED: '异常关闭'
}

// 简化为3步流程
export const CMR_STEPS = {
  STEP1_PICKUP: 1,        // 提货
  STEP2_ARRIVAL: 2,       // 到达
  STEP3_CONFIRM: 3        // 确认送达
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
 * - undelivered（待派送）: 已到港 + 派送状态为待派送
 * - delivering（派送中）: 派送状态为派送中
 * - exception（订单异常）: 派送状态为订单异常或异常关闭
 * - archived（已归档）: 派送状态为已送达或已完成
 */
export async function getCMRList(params = {}) {
  const db = getDatabase()
  const { type = 'undelivered', search, page = 1, pageSize = 20 } = params
  
  let query = "SELECT * FROM bills_of_lading WHERE (is_void = 0 OR is_void IS NULL) AND status != '草稿'"
  const queryParams = []
  
  // 根据类型筛选（遵循订单流转规则）
  switch (type) {
    case 'undelivered':
    case 'pending':
      // 待派送: 已到港 + 派送状态为待派送或空值（不要求清关放行和查验通过）
      query += ` AND ship_status = '已到港' 
                 AND (delivery_status = '待派送' OR delivery_status IS NULL OR delivery_status = '')`
      break
    case 'delivering':
      // 派送中
      query += " AND delivery_status = '派送中'"
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
      // 默认显示待派送（已到港 + 待派送或空值）
      query += ` AND ship_status = '已到港' 
                 AND (delivery_status = '待派送' OR delivery_status IS NULL OR delivery_status = '')`
  }
  
  // 搜索
  if (search) {
    query += ` AND (bill_number LIKE ? OR container_number LIKE ? OR shipper LIKE ? OR consignee LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页和排序
  query += ' ORDER BY order_seq DESC, updated_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  // 获取各状态统计（遵循流转规则）
  const stats = await getCMRStats()
  
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
 * - undelivered: 已到港 + 待派送或空值（不要求清关放行和查验通过）
 * - delivering: 派送中
 * - exception: 订单异常 + 异常关闭
 * - archived: 已送达 + 已完成
 */
export async function getCMRStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      SUM(CASE 
        WHEN ship_status = '已到港' 
             AND (delivery_status = '待派送' OR delivery_status IS NULL OR delivery_status = '')
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as undelivered,
      SUM(CASE 
        WHEN delivery_status = '派送中'
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
        THEN 1 ELSE 0 END) as archived,
      SUM(CASE 
        WHEN cmr_current_step = 1
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as step1,
      SUM(CASE 
        WHEN cmr_current_step = 2
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as step2,
      SUM(CASE 
        WHEN cmr_current_step >= 3
             AND (is_void = 0 OR is_void IS NULL)
             AND status != '草稿'
        THEN 1 ELSE 0 END) as step3
    FROM bills_of_lading
  `).get()
  
  // 简化为3步流程统计
  return {
    undelivered: Number(stats.undelivered || 0),
    delivering: Number(stats.delivering || 0),
    exception: Number(stats.exception || 0),
    archived: Number(stats.archived || 0),
    stepDistribution: {
      step1: Number(stats.step1 || 0),
      step2: Number(stats.step2 || 0),
      step3: Number(stats.step3 || 0)
    }
  }
}

/**
 * 根据ID获取CMR详情
 */
export async function getCMRById(id) {
  const db = getDatabase()
  const bill = await db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
  return bill ? convertCMRToCamelCase(bill) : null
}

// ==================== CMR派送流程 ====================

/**
 * 开始派送（Step 1: 预计提货时间）
 */
export async function startDelivery(id, data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '派送中',
        cmr_estimated_pickup_time = ?,
        cmr_service_provider = ?,
        cmr_current_step = 1,
        updated_at = NOW()
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
export async function updateDestination(id, data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_delivery_address = ?,
        cmr_estimated_arrival_time = ?,
        cmr_current_step = 2,
        updated_at = NOW()
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
export async function recordDeliveryTime(id, data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_actual_arrival_time = ?,
        cmr_current_step = 3,
        updated_at = NOW()
    WHERE id = ?
  `).run(
    data.actualArrivalTime,
    id
  )
  
  return result.changes > 0
}

/**
 * 卸货完成（Step 4: 卸货完成时间）
 * 注意：设置卸货完成时间时，自动将订单状态标记为"已完成"
 */
export async function completeUnloading(id, data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_unloading_complete_time = ?,
        cmr_current_step = 4,
        status = '已完成',
        complete_time = NOW(),
        updated_at = NOW()
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
export async function confirmDelivery(id, data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '已送达',
        cmr_confirmed_time = ?,
        cmr_current_step = 5,
        updated_at = NOW()
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
export async function updateCMRDetail(id, data) {
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
  // 注意：设置卸货完成时间时，自动将订单状态标记为"已完成"
  if (data.unloadingCompleteTime !== undefined) {
    fields.push('cmr_unloading_complete_time = ?')
    values.push(data.unloadingCompleteTime)
    // 如果设置了卸货完成时间，自动将订单状态标记为"已完成"
    if (data.unloadingCompleteTime) {
      fields.push("status = ?")
      values.push('已完成')
      fields.push("complete_time = NOW()")
    }
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
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE bills_of_lading SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

// ==================== 异常处理 ====================

/**
 * 标记异常
 */
export async function markException(id, data) {
  const db = getDatabase()
  
  // 获取现有的异常记录
  const bill = await db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
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
  
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')

  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '订单异常',
        cmr_has_exception = 1,
        cmr_exception_note = ?,
        cmr_exception_time = ?,
        cmr_exception_status = 'open',
        cmr_exception_records = ?,
        updated_at = NOW()
    WHERE id = ?
  `).run(
    data.exceptionNote,
    now,
    JSON.stringify(records),
    id
  )
  
  return result.changes > 0
}

/**
 * 处理异常 - 继续跟进
 */
export async function followUpException(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = await db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
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
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_exception_status = 'following',
        cmr_exception_records = ?,
        updated_at = NOW()
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
export async function resolveAndContinue(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = await db.prepare('SELECT cmr_exception_records, cmr_current_step FROM bills_of_lading WHERE id = ?').get(id)
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
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '派送中',
        cmr_has_exception = 0,
        cmr_exception_status = 'resolved',
        cmr_exception_records = ?,
        updated_at = NOW()
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
export async function markResolved(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = await db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
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
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET cmr_exception_status = 'resolved',
        cmr_exception_records = ?,
        updated_at = NOW()
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
export async function closeOrder(id, data) {
  const db = getDatabase()
  
  // 获取现有记录
  const bill = await db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
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
  
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET delivery_status = '异常关闭',
        cmr_exception_status = 'closed',
        cmr_exception_records = ?,
        updated_at = NOW()
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
export async function getExceptionHistory(id) {
  const db = getDatabase()
  const bill = await db.prepare('SELECT cmr_exception_records FROM bills_of_lading WHERE id = ?').get(id)
  
  if (!bill || !bill.cmr_exception_records) {
    return []
  }
  
  try {
    return JSON.parse(bill.cmr_exception_records)
  } catch (e) {
    return []
  }
}

// ==================== 运输供应商管理（原服务商功能，现已合并到供应商模块） ====================

// 运输相关的供应商类型（仅包含运输/配送类型）
const TRANSPORT_SUPPLIER_TYPES = [
  'delivery',           // 配送
  'trucking',           // 卡车运输
  'overseas_trucking',  // 海外卡车运输
  'transport',          // 运输
  'shipping',           // 海运
  'forwarder',          // 货代
  'logistics'           // 物流
]

/**
 * 获取运输供应商列表（从供应商表获取运输相关类型）
 */
export async function getServiceProviders(params = {}) {
  const db = getDatabase()
  const { type, status = 'active', search, page = 1, pageSize = 20 } = params
  
  // 只获取运输相关类型的供应商（支持多类型字段，使用 LIKE 匹配）
  const typeConditions = TRANSPORT_SUPPLIER_TYPES.map(t => 
    `(supplier_type = ? OR supplier_type LIKE ? OR supplier_type LIKE ? OR supplier_type LIKE ?)`
  ).join(' OR ')
  let query = `SELECT * FROM suppliers WHERE (${typeConditions})`
  const queryParams = []
  TRANSPORT_SUPPLIER_TYPES.forEach(t => {
    queryParams.push(t, `${t},%`, `%,${t},%`, `%,${t}`)
  })
  
  if (type) {
    // 支持精确匹配单类型或包含在多类型中
    query += ` AND (supplier_type = ? OR supplier_type LIKE ? OR supplier_type LIKE ? OR supplier_type LIKE ?)`
    queryParams.push(type, `${type},%`, `%,${type},%`, `%,${type}`)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (supplier_name LIKE ? OR supplier_code LIKE ? OR contact_person LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY supplier_name LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertSupplierToServiceProvider),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取运输供应商
 */
export async function getServiceProviderById(id) {
  const db = getDatabase()
  const provider = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
  return provider ? convertSupplierToServiceProvider(provider) : null
}

/**
 * 创建运输供应商（写入供应商表）
 */
export async function createServiceProvider(data) {
  const db = getDatabase()
  const id = generateId('sup')
  
  await db.prepare(`
    INSERT INTO suppliers (
      id, supplier_code, supplier_name, short_name, supplier_type, contact_person,
      contact_phone, contact_email, address, remark, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.providerCode,
    data.providerName,
    data.providerName?.substring(0, 10) || '',
    data.serviceType || 'delivery',
    data.contactPerson || '',
    data.contactPhone || '',
    data.contactEmail || '',
    data.address || '',
    data.description || '',
    data.status || 'active'
  )
  
  return { id }
}

/**
 * 更新运输供应商
 */
export async function updateServiceProvider(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    providerCode: 'supplier_code',
    providerName: 'supplier_name',
    serviceType: 'supplier_type',
    contactPerson: 'contact_person',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    address: 'address',
    description: 'remark',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除运输供应商
 */
export async function deleteServiceProvider(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 将供应商数据转换为服务商格式（保持API兼容性）
 */
function convertSupplierToServiceProvider(row) {
  return {
    id: String(row.id),
    providerCode: row.supplier_code,
    providerName: row.supplier_name,
    serviceType: row.supplier_type,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    address: row.address,
    description: row.remark,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

// ==================== 操作日志 ====================

/**
 * 记录TMS操作日志
 */
export async function addTMSLog(data) {
  const db = getDatabase()
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  
  try {
    await db.prepare(`
      INSERT INTO operation_logs (
        bill_id, operation_type, operation_name,
        old_value, new_value, remark,
        operator, operator_id, module,
        operation_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tms', ?)
    `).run(
      data.billId,
      data.operationType,
      data.operationName,
      data.oldValue || null,
      data.newValue || null,
      data.remark || null,
      data.operator || '系统',
      data.operatorId || null,
      now
    )
  } catch (error) {
    console.error('记录TMS日志失败:', error.message)
  }
}

/**
 * 获取TMS操作日志
 */
export async function getTMSLogs(billId) {
  const db = getDatabase()
  const logs = await db.prepare(`
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
    vessel: row.vessel,
    shipper: row.shipper,
    consignee: row.consignee,
    portOfDischarge: row.port_of_discharge,
    placeOfDelivery: row.place_of_delivery,
    pieces: row.pieces,
    weight: row.weight,
    
    // 船期信息
    etd: row.etd,
    eta: row.eta,
    ata: row.ata,

    // 状态信息
    status: row.status,  // 订单状态（已完成等）
    deliveryStatus: row.delivery_status,
    customsStatus: row.customs_status,
    customsReleaseTime: row.customs_release_time,
    
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
    
    // Reference List（收货地址详情）
    referenceList: row.reference_list ? (typeof row.reference_list === 'string' ? JSON.parse(row.reference_list) : row.reference_list) : [],
    
    // 时间戳
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

// convertServiceProviderToCamelCase 已移除，使用 convertSupplierToServiceProvider 替代

// ==================== 考核条件管理 ====================

/**
 * 考核条件类型常量
 */
export const CONDITION_TYPES = {
  TIME_LIMIT: 'time_limit',        // 时效考核
  PRICE_STANDARD: 'price_standard', // 价格标准
  EFFICIENCY: 'efficiency',         // 效率指标
  PROVIDER_SCORE: 'provider_score'  // 服务商评分
}

/**
 * 比较操作符常量
 */
export const OPERATORS = {
  LTE: '<=',      // 小于等于
  GTE: '>=',      // 大于等于
  EQ: '=',        // 等于
  BETWEEN: 'between' // 范围
}

/**
 * 预警级别常量
 */
export const ALERT_LEVELS = {
  WARNING: 'warning',   // 警告
  ERROR: 'error',       // 错误
  CRITICAL: 'critical'  // 严重
}

/**
 * 适用范围类型常量
 */
export const SCOPE_TYPES = {
  GLOBAL: 'global',           // 全局
  ROUTE: 'route',             // 按路线
  PROVIDER: 'provider',       // 按服务商
  SERVICE_TYPE: 'service_type' // 按服务类型
}

/**
 * 获取考核条件列表
 */
export async function getConditions(params = {}) {
  const db = getDatabase()
  const { type, status, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM tms_assessment_conditions WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND condition_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (condition_code LIKE ? OR condition_name LIKE ? OR metric_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY condition_type, created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertConditionToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取考核条件
 */
export async function getConditionById(id) {
  const db = getDatabase()
  const condition = await db.prepare('SELECT * FROM tms_assessment_conditions WHERE id = ?').get(id)
  return condition ? convertConditionToCamelCase(condition) : null
}

/**
 * 创建考核条件
 */
export async function createCondition(data) {
  const db = getDatabase()
  
  // 检查条件编码是否已存在
  const existing = await db.prepare('SELECT id FROM tms_assessment_conditions WHERE condition_code = ?').get(data.conditionCode)
  if (existing) {
    throw new Error('条件编码已存在')
  }
  
  const result = await db.prepare(`
    INSERT INTO tms_assessment_conditions (
      condition_code, condition_name, condition_type, metric_name,
      operator, threshold_value, threshold_value2, unit,
      weight, scope_type, scope_values, alert_enabled,
      alert_level, description, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    RETURNING id
  `).get(
    data.conditionCode,
    data.conditionName,
    data.conditionType,
    data.metricName || '',
    data.operator || '<=',
    data.thresholdValue || 0,
    data.thresholdValue2 || null,
    data.unit || '',
    data.weight || 100,
    data.scopeType || 'global',
    data.scopeValues ? JSON.stringify(data.scopeValues) : null,
    data.alertEnabled ? 1 : 0,
    data.alertLevel || 'warning',
    data.description || '',
    data.status || 'active'
  )
  
  return { id: result.id }
}

/**
 * 更新考核条件
 */
export async function updateCondition(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    conditionCode: 'condition_code',
    conditionName: 'condition_name',
    conditionType: 'condition_type',
    metricName: 'metric_name',
    operator: 'operator',
    thresholdValue: 'threshold_value',
    thresholdValue2: 'threshold_value2',
    unit: 'unit',
    weight: 'weight',
    scopeType: 'scope_type',
    alertEnabled: 'alert_enabled',
    alertLevel: 'alert_level',
    description: 'description',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      if (jsField === 'alertEnabled') {
        values.push(data[jsField] ? 1 : 0)
      } else {
        values.push(data[jsField])
      }
    }
  })
  
  // 特殊处理 scopeValues (需要JSON序列化)
  if (data.scopeValues !== undefined) {
    fields.push('scope_values = ?')
    values.push(data.scopeValues ? JSON.stringify(data.scopeValues) : null)
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE tms_assessment_conditions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除考核条件
 */
export async function deleteCondition(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM tms_assessment_conditions WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 匹配适用的考核条件
 * @param {Object} params - 匹配参数
 * @param {string} params.type - 条件类型
 * @param {string} params.providerId - 服务商ID
 * @param {string} params.routeCode - 路线编码
 * @param {string} params.serviceType - 服务类型
 */
export async function matchConditions(params = {}) {
  const db = getDatabase()
  const { type, providerId, routeCode, serviceType } = params
  
  let query = "SELECT * FROM tms_assessment_conditions WHERE status = 'active'"
  const queryParams = []
  
  if (type) {
    query += ' AND condition_type = ?'
    queryParams.push(type)
  }
  
  const allConditions = await db.prepare(query).all(...queryParams)
  
  // 过滤匹配的条件
  const matchedConditions = allConditions.filter(condition => {
    const scopeType = condition.scope_type
    
    // 全局条件总是匹配
    if (scopeType === 'global') return true
    
    // 解析scopeValues
    let scopeValues = []
    if (condition.scope_values) {
      try {
        scopeValues = JSON.parse(condition.scope_values)
      } catch (e) {
        scopeValues = []
      }
    }
    
    // 按范围类型匹配
    switch (scopeType) {
      case 'provider':
        return providerId && scopeValues.includes(String(providerId))
      case 'route':
        return routeCode && scopeValues.includes(routeCode)
      case 'service_type':
        return serviceType && scopeValues.includes(serviceType)
      default:
        return true
    }
  })
  
  return matchedConditions.map(convertConditionToCamelCase)
}

/**
 * 获取考核条件统计
 */
export async function getConditionStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      condition_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
      SUM(CASE WHEN alert_enabled = 1 THEN 1 ELSE 0 END) as alert_count
    FROM tms_assessment_conditions
    GROUP BY condition_type
  `).all()
  
  return stats.map(row => ({
    conditionType: row.condition_type,
    total: row.total,
    activeCount: row.active_count,
    alertCount: row.alert_count
  }))
}

// ==================== 考核结果管理 ====================

/**
 * 记录考核结果
 */
export async function recordAssessmentResult(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO tms_assessment_results (
      provider_id, provider_name, bill_id, bill_number,
      condition_id, condition_code, condition_type,
      actual_value, threshold_value, is_passed, score,
      assessment_time, period, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())
    RETURNING id
  `).get(
    data.providerId || null,
    data.providerName || '',
    data.billId || null,
    data.billNumber || '',
    data.conditionId,
    data.conditionCode || '',
    data.conditionType,
    data.actualValue,
    data.thresholdValue,
    data.isPassed ? 1 : 0,
    data.score || 0,
    data.period || new Date().toISOString().slice(0, 7), // 默认当前月份
    data.remark || ''
  )
  
  return { id: result.id }
}

/**
 * 获取考核报表
 */
export async function getAssessmentReport(params = {}) {
  const db = getDatabase()
  const { providerId, conditionType, period, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM tms_assessment_results WHERE 1=1'
  const queryParams = []
  
  if (providerId) {
    query += ' AND provider_id = ?'
    queryParams.push(providerId)
  }
  
  if (conditionType) {
    query += ' AND condition_type = ?'
    queryParams.push(conditionType)
  }
  
  if (period) {
    query += ' AND period = ?'
    queryParams.push(period)
  }
  
  if (startDate) {
    query += ' AND assessment_time >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND assessment_time <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY assessment_time DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertAssessmentResultToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取服务商排名
 */
export async function getProviderRanking(params = {}) {
  const db = getDatabase()
  const { conditionType, period, limit = 10 } = params
  
  let query = `
    SELECT 
      provider_id,
      provider_name,
      COUNT(*) as total_assessments,
      SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_count,
      ROUND(AVG(score), 2) as avg_score,
      ROUND(SUM(CASE WHEN is_passed = 1 THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 2) as pass_rate
    FROM tms_assessment_results
    WHERE provider_id IS NOT NULL
  `
  const queryParams = []
  
  if (conditionType) {
    query += ' AND condition_type = ?'
    queryParams.push(conditionType)
  }
  
  if (period) {
    query += ' AND period = ?'
    queryParams.push(period)
  }
  
  query += `
    GROUP BY provider_id, provider_name
    ORDER BY avg_score DESC, pass_rate DESC
    LIMIT ?
  `
  queryParams.push(limit)
  
  const rankings = await db.prepare(query).all(...queryParams)
  
  return rankings.map((row, index) => ({
    rank: index + 1,
    providerId: row.provider_id,
    providerName: row.provider_name,
    totalAssessments: row.total_assessments,
    passedCount: row.passed_count,
    avgScore: row.avg_score,
    passRate: row.pass_rate
  }))
}

/**
 * 获取考核汇总统计
 */
export async function getAssessmentSummary(params = {}) {
  const db = getDatabase()
  const { period } = params
  
  let query = `
    SELECT 
      condition_type,
      COUNT(*) as total,
      SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed,
      ROUND(AVG(score), 2) as avg_score
    FROM tms_assessment_results
    WHERE 1=1
  `
  const queryParams = []
  
  if (period) {
    query += ' AND period = ?'
    queryParams.push(period)
  }
  
  query += ' GROUP BY condition_type'
  
  const summary = await db.prepare(query).all(...queryParams)
  
  return summary.map(row => ({
    conditionType: row.condition_type,
    total: row.total,
    passed: row.passed,
    failed: row.total - row.passed,
    passRate: row.total > 0 ? ((row.passed / row.total) * 100).toFixed(2) : 0,
    avgScore: row.avg_score
  }))
}

/**
 * 转换考核条件为驼峰命名
 */
export function convertConditionToCamelCase(row) {
  if (!row) return null
  
  // 解析scopeValues
  let scopeValues = null
  if (row.scope_values) {
    try {
      scopeValues = JSON.parse(row.scope_values)
    } catch (e) {
      scopeValues = null
    }
  }
  
  return {
    id: row.id,
    conditionCode: row.condition_code,
    conditionName: row.condition_name,
    conditionType: row.condition_type,
    metricName: row.metric_name,
    operator: row.operator,
    thresholdValue: row.threshold_value,
    thresholdValue2: row.threshold_value2,
    unit: row.unit,
    weight: row.weight,
    scopeType: row.scope_type,
    scopeValues: scopeValues,
    alertEnabled: row.alert_enabled === 1,
    alertLevel: row.alert_level,
    description: row.description,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

/**
 * 转换考核结果为驼峰命名
 */
export function convertAssessmentResultToCamelCase(row) {
  if (!row) return null
  
  return {
    id: row.id,
    providerId: row.provider_id,
    providerName: row.provider_name,
    billId: row.bill_id,
    billNumber: row.bill_number,
    conditionId: row.condition_id,
    conditionCode: row.condition_code,
    conditionType: row.condition_type,
    actualValue: row.actual_value,
    thresholdValue: row.threshold_value,
    isPassed: row.is_passed === 1,
    score: row.score,
    assessmentTime: row.assessment_time,
    period: row.period,
    remark: row.remark,
    createTime: row.created_at
  }
}

export default {
  // 常量
  CMR_STATUS,
  CMR_STEPS,
  EXCEPTION_STATUS,
  CONDITION_TYPES,
  OPERATORS,
  ALERT_LEVELS,
  SCOPE_TYPES,
  
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
  
  // 考核条件管理
  getConditions,
  getConditionById,
  createCondition,
  updateCondition,
  deleteCondition,
  matchConditions,
  getConditionStats,
  
  // 考核结果管理
  recordAssessmentResult,
  getAssessmentReport,
  getProviderRanking,
  getAssessmentSummary,
  
  // 日志
  addTMSLog,
  getTMSLogs
}

// ==================== 最后里程集成 ====================

/**
 * 获取最后里程承运商列表（用于TMS派送选择）
 */
export async function getLastMileCarriers(params = {}) {
  const db = getDatabase()
  const { type, status = 'active' } = params
  
  let query = 'SELECT * FROM last_mile_carriers WHERE status = ?'
  const queryParams = [status]
  
  if (type) {
    query += ' AND carrier_type = ?'
    queryParams.push(type)
  }
  
  query += ' ORDER BY carrier_code'
  
  const carriers = await db.prepare(query).all(...queryParams)
  
  return carriers.map(row => ({
    id: row.id,
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name,
    carrierNameEn: row.carrier_name_en,
    carrierType: row.carrier_type,
    countryCode: row.country_code,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    apiEnabled: row.api_enabled === 1
  }))
}

