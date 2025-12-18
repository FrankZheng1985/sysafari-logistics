/**
 * 订单管理模块 - 数据模型
 * 包含：提单、包裹、报关单、标签、操作日志、文件管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 提单相关 ====================

/**
 * 获取提单列表
 * 
 * 订单流转规则：
 * - Schedule（进行中）: 状态不是"已完成"、"已归档"、"已取消"的活跃订单，且派送状态不是"已送达"或"异常关闭"
 * - History（已完成）: 状态是"已完成"、"已归档"、"已取消"，或者派送状态是"已送达"、"异常关闭"的订单
 * - Draft（草稿）: 状态为草稿的订单
 * - Void（已作废）: 已作废的订单
 */
export async function getBills(params = {}) {
  const db = getDatabase()
  const { 
    type,
    status, 
    shipStatus, 
    customsStatus,
    inspection,
    deliveryStatus,
    search, 
    page = 1, 
    pageSize = 20,
    sortField = 'created_at',
    sortOrder = 'DESC',
    forInvoiceType  // 用于新建发票时过滤已完成财务流程的订单：'sales' | 'purchase'
  } = params
  
  let query = 'SELECT * FROM bills_of_lading WHERE 1=1'
  const queryParams = []
  
  // 根据 type 参数筛选（订单流转规则）
  if (type) {
    switch (type) {
      case 'schedule':
        // Schedule: 进行中的订单
        // 排除已完成、已归档、已取消的状态，以及派送已送达或异常关闭的订单
        query += ` AND is_void = 0 
                   AND status NOT IN ('已完成', '已归档', '已取消') 
                   AND (delivery_status IS NULL OR delivery_status NOT IN ('已送达', '异常关闭'))`
        break
      case 'history':
        // History: 已完成的订单
        // 包含状态为已完成、已归档、已取消，或者派送状态为已送达、异常关闭的订单
        query += ` AND is_void = 0 
                   AND (status IN ('已完成', '已归档', '已取消') 
                        OR delivery_status IN ('已送达', '异常关闭'))`
        
        // 如果是为新建发票筛选，排除已经开具发票并完成收付款的订单
        if (forInvoiceType) {
          // 排除该类型发票状态为 'paid' 的订单
          query += ` AND id NOT IN (
            SELECT DISTINCT bill_id FROM invoices 
            WHERE invoice_type = ? AND status = 'paid' AND bill_id IS NOT NULL
          )`
          queryParams.push(forInvoiceType)
        }
        break
      case 'draft':
        // Draft: 草稿订单
        query += ' AND status = ? AND is_void = 0'
        queryParams.push('draft')
        break
      case 'void':
        // Void: 已作废的订单
        query += ' AND is_void = 1'
        break
      default:
        query += ' AND is_void = 0'
    }
  } else if (status) {
    // 兼容旧的 status 参数
    if (status === 'void') {
      query += ' AND is_void = 1'
    } else if (status === 'draft') {
      query += ' AND status = ? AND is_void = 0'
      queryParams.push('draft')
    } else if (status === 'active') {
      query += ' AND status = ? AND is_void = 0'
      queryParams.push('active')
    }
  } else {
    query += ' AND is_void = 0'
  }
  
  // 船运状态
  if (shipStatus) {
    query += ' AND ship_status = ?'
    queryParams.push(shipStatus)
  }
  
  // 清关状态
  if (customsStatus) {
    query += ' AND customs_status = ?'
    queryParams.push(customsStatus)
  }
  
  // 查验状态
  if (inspection) {
    query += ' AND inspection = ?'
    queryParams.push(inspection)
  }
  
  // 派送状态（仅在没有使用 type 参数时生效）
  if (deliveryStatus && !type) {
    query += ' AND delivery_status = ?'
    queryParams.push(deliveryStatus)
  }
  
  // 搜索
  if (search) {
    query += ` AND (
      bill_number LIKE ? OR 
      container_number LIKE ? OR 
      shipper LIKE ? OR 
      consignee LIKE ? OR
      vessel LIKE ?
    )`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 排序和分页
  const allowedSortFields = ['created_at', 'bill_number', 'eta', 'etd', 'updated_at']
  const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at'
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
  
  query += ` ORDER BY ${safeSortField} ${safeSortOrder} LIMIT ? OFFSET ?`
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertBillToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据ID获取提单
 */
export async function getBillById(id) {
  const db = getDatabase()
  const bill = await db.prepare('SELECT * FROM bills_of_lading WHERE id = ?').get(id)
  return bill ? convertBillToCamelCase(bill) : null
}

/**
 * 根据提单号获取提单
 */
export async function getBillByNumber(billNumber) {
  const db = getDatabase()
  const bill = await db.prepare('SELECT * FROM bills_of_lading WHERE bill_number = ?').get(billNumber)
  return bill ? convertBillToCamelCase(bill) : null
}

/**
 * 创建提单
 */
export async function createBill(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = await db.prepare(`
    INSERT INTO bills_of_lading (
      id, bill_number, container_number, vessel, voyage,
      shipper, consignee, notify_party,
      port_of_loading, port_of_discharge, place_of_delivery,
      pieces, weight, volume, description,
      etd, eta, status, ship_status, customs_status,
      inspection, delivery_status, remark, operator,
      customer_id, customer_name, customer_code,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      NOW(), NOW()
    )
  `).run(
    id,
    data.billNumber,
    data.containerNumber || '',
    data.vessel || '',
    data.voyage || '',
    data.shipper || '',
    data.consignee || '',
    data.notifyParty || '',
    data.portOfLoading || '',
    data.portOfDischarge || '',
    data.placeOfDelivery || '',
    data.pieces || 0,
    data.weight || 0,
    data.volume || 0,
    data.description || '',
    data.etd || null,
    data.eta || null,
    data.status || 'active',
    data.shipStatus || '未到港',
    data.customsStatus || '未放行',
    data.inspection || '-',
    data.deliveryStatus || '待派送',
    data.remark || '',
    data.operator || '系统',
    data.customerId || null,
    data.customerName || null,
    data.customerCode || null
  )
  
  return { id, changes: result.changes }
}

/**
 * 更新提单
 */
export async function updateBill(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    billNumber: 'bill_number',
    containerNumber: 'container_number',
    vessel: 'vessel',
    voyage: 'voyage',
    shipper: 'shipper',
    consignee: 'consignee',
    notifyParty: 'notify_party',
    portOfLoading: 'port_of_loading',
    portOfDischarge: 'port_of_discharge',
    placeOfDelivery: 'place_of_delivery',
    pieces: 'pieces',
    weight: 'weight',
    volume: 'volume',
    description: 'description',
    etd: 'etd',
    eta: 'eta',
    ata: 'ata',
    actualArrivalDate: 'actual_arrival_date',
    status: 'status',
    shipStatus: 'ship_status',
    docSwapStatus: 'doc_swap_status',
    docSwapTime: 'doc_swap_time',
    customsStatus: 'customs_status',
    inspection: 'inspection',
    deliveryStatus: 'delivery_status',
    remark: 'remark',
    isVoid: 'is_void',
    voidReason: 'void_reason',
    voidTime: 'void_time',
    voidBy: 'void_by',
    // 客户关联字段
    customerId: 'customer_id',
    customerName: 'customer_name',
    customerCode: 'customer_code'
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
  
  const result = await db.prepare(`UPDATE bills_of_lading SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 作废提单
 */
export async function voidBill(id, reason, operator) {
  const db = getDatabase()
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET is_void = 1, 
        void_reason = ?, 
        void_time = ?,
        updated_at = NOW()
    WHERE id = ?
  `).run(reason, now, id)
  
  return result.changes > 0
}

/**
 * 恢复提单
 */
export async function restoreBill(id) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET is_void = 0, 
        void_reason = NULL, 
        void_time = NULL,
        updated_at = NOW()
    WHERE id = ?
  `).run(id)
  
  return result.changes > 0
}

/**
 * 删除提单（硬删除，谨慎使用）
 */
export async function deleteBill(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM bills_of_lading WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 提单状态更新 ====================

/**
 * 更新船运状态
 */
export async function updateBillShipStatus(id, shipStatus, actualArrivalDate = null) {
  const db = getDatabase()
  
  let query = `
    UPDATE bills_of_lading 
    SET ship_status = ?,
        updated_at = NOW()
  `
  const params = [shipStatus]
  
  if (actualArrivalDate) {
    query = `
      UPDATE bills_of_lading 
      SET ship_status = ?,
          actual_arrival_date = ?,
          updated_at = NOW()
    `
    params.push(actualArrivalDate)
  }
  
  query += ' WHERE id = ?'
  params.push(id)
  
  const result = await db.prepare(query).run(...params)
  return result.changes > 0
}

/**
 * 更新换单状态
 * @param {number} id - 提单ID
 * @param {string} docSwapStatus - 换单状态
 * @param {string} docSwapAgent - 代理商名称（可选，记录在操作日志中）
 * @param {number} docSwapFee - 换单费用（可选，记录在操作日志中）
 */
export async function updateBillDocSwapStatus(id, docSwapStatus, docSwapAgent, docSwapFee) {
  const db = getDatabase()
  
  // PostgreSQL 需要将 NOW() 转换为 TEXT 类型以匹配 doc_swap_time 列
  const isPostgres = db.isPostgres
  const nowExpr = isPostgres ? "TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')" : "NOW()"
  const updatedAtExpr = isPostgres ? "NOW()" : "NOW()"
  
  // 注意: docSwapAgent 和 docSwapFee 目前记录在操作日志中
  // 如果需要持久化到主表，请先添加数据库字段
  
  const sql = `
    UPDATE bills_of_lading
    SET doc_swap_status = ?,
        doc_swap_time = CASE WHEN ? = '已换单' THEN ${nowExpr} ELSE doc_swap_time END,
        updated_at = ${updatedAtExpr}
    WHERE id = ?
  `
  
  const result = await db.prepare(sql).run(docSwapStatus, docSwapStatus, id)
  return result && result.changes > 0
}

/**
 * 更新清关状态
 */
export async function updateBillCustomsStatus(id, customsStatus) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE bills_of_lading 
    SET customs_status = ?,
        updated_at = NOW()
    WHERE id = ?
  `).run(customsStatus, id)
  
  return result.changes > 0
}

/**
 * 更新查验状态
 */
export async function updateBillInspection(id, inspectionData) {
  const db = getDatabase()
  const fields = ['inspection = ?', "updated_at = NOW()"]
  const values = [inspectionData.inspection]
  
  if (inspectionData.inspectionDetail !== undefined) {
    fields.push('inspection_detail = ?')
    values.push(typeof inspectionData.inspectionDetail === 'string' 
      ? inspectionData.inspectionDetail 
      : JSON.stringify(inspectionData.inspectionDetail))
  }
  if (inspectionData.estimatedTime !== undefined) {
    fields.push('inspection_estimated_time = ?')
    values.push(inspectionData.estimatedTime)
  }
  if (inspectionData.startTime !== undefined) {
    fields.push('inspection_start_time = ?')
    values.push(inspectionData.startTime)
  }
  if (inspectionData.endTime !== undefined) {
    fields.push('inspection_end_time = ?')
    values.push(inspectionData.endTime)
  }
  if (inspectionData.result !== undefined) {
    fields.push('inspection_result = ?')
    values.push(inspectionData.result)
  }
  if (inspectionData.resultNote !== undefined) {
    fields.push('inspection_result_note = ?')
    values.push(inspectionData.resultNote)
  }
  if (inspectionData.releaseTime !== undefined) {
    fields.push('inspection_release_time = ?')
    values.push(inspectionData.releaseTime)
  }
  if (inspectionData.confirmedTime !== undefined) {
    fields.push('inspection_confirmed_time = ?')
    values.push(inspectionData.confirmedTime)
  }
  
  values.push(id)
  
  const result = await db.prepare(`UPDATE bills_of_lading SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 更新派送状态
 */
export async function updateBillDelivery(id, deliveryData) {
  const db = getDatabase()
  const fields = ['delivery_status = ?', "updated_at = NOW()"]
  const values = [deliveryData.deliveryStatus]
  
  // CMR详细字段 - 前端发送的字段名带 "cmr" 前缀
  const cmrFields = {
    cmrEstimatedPickupTime: 'cmr_estimated_pickup_time',
    cmrServiceProvider: 'cmr_service_provider',
    cmrDeliveryAddress: 'cmr_delivery_address',
    cmrEstimatedArrivalTime: 'cmr_estimated_arrival_time',
    cmrActualArrivalTime: 'cmr_actual_arrival_time',
    cmrUnloadingCompleteTime: 'cmr_unloading_complete_time',
    cmrConfirmedTime: 'cmr_confirmed_time',
    cmrHasException: 'cmr_has_exception',
    cmrExceptionNote: 'cmr_exception_note',
    cmrExceptionTime: 'cmr_exception_time',
    cmrExceptionStatus: 'cmr_exception_status',
    cmrExceptionRecords: 'cmr_exception_records',
    cmrNotes: 'cmr_notes'
  }
  
  Object.entries(cmrFields).forEach(([jsField, dbField]) => {
    if (deliveryData[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      const value = jsField === 'cmrExceptionRecords' && typeof deliveryData[jsField] !== 'string'
        ? JSON.stringify(deliveryData[jsField])
        : deliveryData[jsField]
      values.push(value)
    }
  })
  
  values.push(id)
  
  const result = await db.prepare(`UPDATE bills_of_lading SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

// ==================== 操作日志 ====================

/**
 * 获取操作日志
 */
export async function getOperationLogs(billId, module = null) {
  const db = getDatabase()
  
  let query = 'SELECT * FROM operation_logs WHERE bill_id = ?'
  const params = [billId]
  
  if (module) {
    query += ' AND module = ?'
    params.push(module)
  }
  
  query += ' ORDER BY operation_time DESC'
  
  const logs = await db.prepare(query).all(...params)
  return logs.map(convertOperationLogToCamelCase)
}

/**
 * 添加操作日志
 */
export async function addOperationLog(data) {
  const db = getDatabase()
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  
  const result = await db.prepare(`
    INSERT INTO operation_logs (
      bill_id, operation_type, operation_name,
      old_value, new_value, remark,
      operator, operator_id, module,
      operation_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.billId,
    data.operationType,
    data.operationName,
    data.oldValue || null,
    data.newValue || null,
    data.remark || null,
    data.operator || '系统',
    data.operatorId || null,
    data.module || 'order',
    now
  )
  
  return { id: result.lastInsertRowid }
}

// ==================== 提单文件 ====================

/**
 * 获取提单文件列表
 */
export async function getBillFiles(billId) {
  const db = getDatabase()
  const files = await db.prepare('SELECT * FROM bill_files WHERE bill_id = ? ORDER BY upload_time DESC').all(billId)
  return files.map(convertBillFileToCamelCase)
}

/**
 * 添加提单文件
 */
export async function addBillFile(data) {
  const db = getDatabase()
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  
  const result = await db.prepare(`
    INSERT INTO bill_files (
      bill_id, file_name, file_path, file_type,
      original_size, compressed_size, upload_by, upload_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.billId,
    data.fileName,
    data.filePath,
    data.fileType,
    data.originalSize,
    data.compressedSize || data.originalSize,
    data.uploadBy || '系统',
    now
  )
  
  return { id: result.lastInsertRowid }
}

/**
 * 删除提单文件
 */
export async function deleteBillFile(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM bill_files WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 根据ID获取文件
 */
export async function getBillFileById(id) {
  const db = getDatabase()
  const file = await db.prepare('SELECT * FROM bill_files WHERE id = ?').get(id)
  return file ? convertBillFileToCamelCase(file) : null
}

// ==================== 统计相关 ====================

/**
 * 获取提单统计数据
 */
export async function getBillStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_void = 0 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_void = 1 THEN 1 ELSE 0 END) as void,
      SUM(CASE WHEN ship_status = '未到港' AND is_void = 0 THEN 1 ELSE 0 END) as notArrived,
      SUM(CASE WHEN ship_status = '已到港' AND is_void = 0 THEN 1 ELSE 0 END) as arrived,
      SUM(CASE WHEN customs_status = '未放行' AND is_void = 0 THEN 1 ELSE 0 END) as notCleared,
      SUM(CASE WHEN customs_status = '已放行' AND is_void = 0 THEN 1 ELSE 0 END) as cleared,
      SUM(CASE WHEN inspection != '-' AND inspection != '已放行' AND is_void = 0 THEN 1 ELSE 0 END) as inspecting,
      SUM(CASE WHEN delivery_status = '派送中' AND is_void = 0 THEN 1 ELSE 0 END) as delivering,
      SUM(CASE WHEN delivery_status = '已送达' AND is_void = 0 THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN delivery_status = '订单异常' AND is_void = 0 THEN 1 ELSE 0 END) as exception
    FROM bills_of_lading
  `).get()
  
  return stats
}

/**
 * 获取CMR管理列表（按派送状态分类）
 * 
 * CMR管理显示规则：
 * - undelivered（待派送）: 已到港且清关放行，查验通过（无查验或已放行），派送状态为待派送
 * - delivering（派送中）: 派送状态为派送中
 * - exception（订单异常）: 派送状态为订单异常或异常关闭
 * - archived（已归档）: 派送状态为已送达
 */
export async function getCMRList(type = 'delivering', params = {}) {
  const db = getDatabase()
  const { search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM bills_of_lading WHERE is_void = 0'
  const queryParams = []
  
  // 根据类型筛选
  switch (type) {
    case 'undelivered':
      // 待派送: 已到港、清关放行、查验通过（无查验或已放行），派送状态为待派送
      query += ` AND ship_status = '已到港' 
                 AND customs_status = '已放行' 
                 AND (inspection = '-' OR inspection = '已放行')
                 AND delivery_status = '待派送'`
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
      // 已归档（已送达）
      query += " AND delivery_status = '已送达'"
      break
    default:
      // 默认显示所有非待派送的订单
      query += " AND delivery_status != '待派送'"
  }
  
  // 搜索
  if (search) {
    query += ` AND (bill_number LIKE ? OR container_number LIKE ? OR shipper LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertBillToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取查验管理列表
 */
export async function getInspectionList(type = 'pending', params = {}) {
  const db = getDatabase()
  const { search, page = 1, pageSize = 20 } = params
  
  let query = "SELECT * FROM bills_of_lading WHERE (is_void = 0 OR is_void IS NULL) AND status != '草稿'"
  const queryParams = []
  
  // 根据类型筛选 (支持 pending/released 和旧的 inspection/release)
  switch (type) {
    case 'pending':
    case 'inspection':
      // 待处理: 待查验/查验中/已查验/查验放行，排除已完成派送的
      query += " AND inspection IN ('待查验', '查验中', '已查验', '查验放行') AND (delivery_status IS NULL OR delivery_status NOT IN ('已送达', '已完成'))"
      break
    case 'released':
    case 'release':
      // 已放行
      query += " AND inspection = '已放行'"
      break
    default:
      // 默认显示待处理
      query += " AND inspection IN ('待查验', '查验中', '已查验', '查验放行')"
  }
  
  // 搜索
  if (search) {
    query += ` AND (bill_number LIKE ? OR container_number LIKE ? OR shipper LIKE ?)`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertBillToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

// ==================== 数据转换函数 ====================

export function convertBillToCamelCase(row) {
  if (!row) return null
  
  return {
    id: row.id,
    billId: row.bill_id,
    billNumber: row.bill_number,
    containerNumber: row.container_number,
    actualContainerNo: row.actual_container_no,
    vessel: row.vessel,
    voyage: row.voyage,
    shipper: row.shipper,
    consignee: row.consignee,
    notifyParty: row.notify_party,
    portOfLoading: row.port_of_loading,
    portOfDischarge: row.port_of_discharge,
    placeOfDelivery: row.place_of_delivery,
    pieces: row.pieces,
    weight: row.weight,
    volume: row.volume,
    description: row.description,
    etd: row.etd,
    eta: row.eta,
    ata: row.ata,
    actualArrivalDate: row.actual_arrival_date,
    status: row.status,
    shipStatus: row.ship_status,
    docSwapStatus: row.doc_swap_status,
    docSwapTime: row.doc_swap_time,
    customsStatus: row.customs_status,
    inspection: row.inspection,
    inspectionDetail: row.inspection_detail,
    inspectionEstimatedTime: row.inspection_estimated_time,
    inspectionStartTime: row.inspection_start_time,
    inspectionEndTime: row.inspection_end_time,
    inspectionResult: row.inspection_result,
    inspectionResultNote: row.inspection_result_note,
    inspectionReleaseTime: row.inspection_release_time,
    inspectionConfirmedTime: row.inspection_confirmed_time,
    deliveryStatus: row.delivery_status,
    cmrEstimatedPickupTime: row.cmr_estimated_pickup_time,
    cmrServiceProvider: row.cmr_service_provider,
    cmrDeliveryAddress: row.cmr_delivery_address,
    cmrEstimatedArrivalTime: row.cmr_estimated_arrival_time,
    cmrActualArrivalTime: row.cmr_actual_arrival_time,
    cmrUnloadingCompleteTime: row.cmr_unloading_complete_time,
    cmrConfirmedTime: row.cmr_confirmed_time,
    cmrHasException: row.cmr_has_exception,
    cmrExceptionNote: row.cmr_exception_note,
    cmrExceptionTime: row.cmr_exception_time,
    cmrExceptionStatus: row.cmr_exception_status,
    cmrExceptionRecords: row.cmr_exception_records,
    remark: row.remark,
    operator: row.operator,
    isVoid: row.is_void === 1,
    voidReason: row.void_reason,
    voidTime: row.void_time,
    voidBy: row.void_by,
    // 客户关联字段
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    // 创建者信息
    creator: row.creator,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertOperationLogToCamelCase(row) {
  return {
    id: String(row.id),
    billId: row.bill_id,
    operationType: row.operation_type,
    operationName: row.operation_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    remark: row.remark,
    operator: row.operator,
    operatorId: row.operator_id,
    module: row.module,
    operationTime: row.operation_time
  }
}

export function convertBillFileToCamelCase(row) {
  return {
    id: String(row.id),
    billId: row.bill_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileType: row.file_type,
    originalSize: row.original_size,
    compressedSize: row.compressed_size,
    uploadBy: row.upload_by,
    uploadTime: row.upload_time
  }
}

// ==================== 作废申请相关 ====================

/**
 * 检查提单是否有操作记录或费用
 */
export async function checkBillHasOperations(billId) {
  const db = getDatabase()
  
  // 检查操作日志（排除创建操作）
  const logsResult = await db.prepare(`
    SELECT COUNT(*) as count FROM operation_logs 
    WHERE bill_id = ? AND operation_type != 'create'
  `).get(billId)
  const logsCount = Number(logsResult?.count || 0)
  
  // 检查费用记录
  const feesResult = await db.prepare(`
    SELECT COUNT(*) as count FROM fees WHERE bill_id = ?
  `).get(billId)
  const feesCount = Number(feesResult?.count || 0)
  
  console.log(`检查提单 ${billId} 操作记录: 日志=${logsCount}, 费用=${feesCount}`)
  
  return {
    hasOperations: logsCount > 0 || feesCount > 0,
    operationsCount: logsCount,
    feesCount: feesCount
  }
}

/**
 * 创建作废申请
 */
export async function createVoidApplication(data) {
  const db = getDatabase()
  const id = generateId('va')
  
  await db.prepare(`
    INSERT INTO void_applications (id, bill_id, reason, applicant_id, applicant_name, fees_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.billId, data.reason, data.applicantId || 'admin', data.applicantName || 'Admin', data.feesJson || null)
  
  // 更新提单状态为待审批
  await db.prepare(`
    UPDATE bills_of_lading SET status = '待审批作废' WHERE id = ?
  `).run(data.billId)
  
  return id
}

/**
 * 获取作废申请列表
 */
export async function getVoidApplications(params = {}) {
  const db = getDatabase()
  const { status, userId } = params
  
  let query = `
    SELECT va.*, b.bill_number, b.container_number 
    FROM void_applications va
    LEFT JOIN bills_of_lading b ON va.bill_id = b.id
    WHERE 1=1
  `
  const queryParams = []
  
  if (status) {
    query += ' AND va.status = ?'
    queryParams.push(status)
  }
  
  // 如果指定了用户ID，筛选该用户需要审批的申请
  if (userId) {
    query += ` AND (
      (va.status = 'pending_supervisor' AND va.supervisor_id = ?) OR
      (va.status = 'pending_finance' AND va.finance_id = ?)
    )`
    queryParams.push(userId, userId)
  }
  
  query += ' ORDER BY va.created_at DESC'
  
  const applications = await db.prepare(query).all(...queryParams)
  
  return applications.map(app => ({
    id: app.id,
    billId: app.bill_id,
    billNumber: app.bill_number,
    containerNumber: app.container_number,
    reason: app.reason,
    status: app.status,
    applicantId: app.applicant_id,
    applicantName: app.applicant_name,
    supervisorId: app.supervisor_id,
    supervisorName: app.supervisor_name,
    supervisorApprovedAt: app.supervisor_approved_at,
    supervisorComment: app.supervisor_comment,
    financeId: app.finance_id,
    financeName: app.finance_name,
    financeApprovedAt: app.finance_approved_at,
    financeComment: app.finance_comment,
    feesJson: app.fees_json,
    createdAt: app.created_at
  }))
}

/**
 * 获取单个作废申请详情
 */
export async function getVoidApplicationById(id) {
  const db = getDatabase()
  const app = await db.prepare(`
    SELECT va.*, b.bill_number, b.container_number 
    FROM void_applications va
    LEFT JOIN bills_of_lading b ON va.bill_id = b.id
    WHERE va.id = ?
  `).get(id)
  
  if (!app) return null
  
  return {
    id: app.id,
    billId: app.bill_id,
    billNumber: app.bill_number,
    containerNumber: app.container_number,
    reason: app.reason,
    status: app.status,
    applicantId: app.applicant_id,
    applicantName: app.applicant_name,
    supervisorId: app.supervisor_id,
    supervisorName: app.supervisor_name,
    supervisorApprovedAt: app.supervisor_approved_at,
    supervisorComment: app.supervisor_comment,
    financeId: app.finance_id,
    financeName: app.finance_name,
    financeApprovedAt: app.finance_approved_at,
    financeComment: app.finance_comment,
    feesJson: app.fees_json,
    createdAt: app.created_at
  }
}

/**
 * 审批通过作废申请
 */
export async function approveVoidApplication(id, approverId, approverName, comment) {
  const db = getDatabase()
  const app = await db.prepare('SELECT * FROM void_applications WHERE id = ?').get(id)
  
  if (!app) return { success: false, message: '申请不存在' }
  
  const now = new Date().toISOString()
  
  if (app.status === 'pending_supervisor') {
    // 上级审批通过，转到财务审批
    await db.prepare(`
      UPDATE void_applications 
      SET status = 'pending_finance', 
          supervisor_id = ?, supervisor_name = ?, 
          supervisor_approved_at = ?, supervisor_comment = ?
      WHERE id = ?
    `).run(approverId, approverName, now, comment || '', id)
    
    return { success: true, message: '上级审批通过，等待财务审批', nextStatus: 'pending_finance' }
    
  } else if (app.status === 'pending_finance') {
    // 财务审批通过，正式作废
    await db.prepare(`
      UPDATE void_applications 
      SET status = 'approved', 
          finance_id = ?, finance_name = ?, 
          finance_approved_at = ?, finance_comment = ?
      WHERE id = ?
    `).run(approverId, approverName, now, comment || '', id)
    
    // 正式作废提单
    await db.prepare(`
      UPDATE bills_of_lading 
      SET is_void = 1, void_reason = ?, void_time = ?, status = '已作废'
      WHERE id = ?
    `).run(app.reason, now, app.bill_id)
    
    return { success: true, message: '财务审批通过，提单已作废', nextStatus: 'approved' }
  }
  
  return { success: false, message: '当前状态不可审批' }
}

/**
 * 拒绝作废申请
 */
export async function rejectVoidApplication(id, rejecterId, rejecterName, comment) {
  const db = getDatabase()
  const app = await db.prepare('SELECT * FROM void_applications WHERE id = ?').get(id)
  
  if (!app) return { success: false, message: '申请不存在' }
  
  const now = new Date().toISOString()
  
  if (app.status === 'pending_supervisor') {
    await db.prepare(`
      UPDATE void_applications 
      SET status = 'rejected', 
          supervisor_id = ?, supervisor_name = ?, 
          supervisor_approved_at = ?, supervisor_comment = ?
      WHERE id = ?
    `).run(rejecterId, rejecterName, now, comment || '', id)
  } else if (app.status === 'pending_finance') {
    await db.prepare(`
      UPDATE void_applications 
      SET status = 'rejected', 
          finance_id = ?, finance_name = ?, 
          finance_approved_at = ?, finance_comment = ?
      WHERE id = ?
    `).run(rejecterId, rejecterName, now, comment || '', id)
  }
  
  // 恢复提单状态
  await db.prepare(`
    UPDATE bills_of_lading SET status = '已到港' WHERE id = ?
  `).run(app.bill_id)
  
  return { success: true, message: '申请已拒绝' }
}

// ==================== 系统配置相关 ====================

/**
 * 获取系统配置
 */
export async function getSystemConfig(key) {
  const db = getDatabase()
  const config = await db.prepare('SELECT value FROM system_configs WHERE key = ?').get(key)
  return config?.value || null
}

/**
 * 设置系统配置
 */
export async function setSystemConfig(key, value, description) {
  const db = getDatabase()
  await db.prepare(`
    INSERT OR REPLACE INTO system_configs (key, value, description, updated_at)
    VALUES (?, ?, COALESCE(?, (SELECT description FROM system_configs WHERE key = ?)), NOW())
  `).run(key, value, description, key)
  return true
}

/**
 * 获取所有系统配置
 */
export async function getAllSystemConfigs() {
  const db = getDatabase()
  const configs = await db.prepare('SELECT * FROM system_configs').all()
  return configs.map(c => ({
    key: c.key,
    value: c.value,
    description: c.description,
    updatedAt: c.updated_at
  }))
}

export default {
  // 提单CRUD
  getBills,
  getBillById,
  getBillByNumber,
  createBill,
  updateBill,
  voidBill,
  restoreBill,
  deleteBill,
  
  // 状态更新
  updateBillShipStatus,
  updateBillDocSwapStatus,
  updateBillCustomsStatus,
  updateBillInspection,
  updateBillDelivery,
  
  // 操作日志
  getOperationLogs,
  addOperationLog,
  
  // 文件管理
  getBillFiles,
  addBillFile,
  deleteBillFile,
  getBillFileById,
  
  // 统计和列表
  getBillStats,
  getCMRList,
  getInspectionList,
  
  // 转换函数
  convertBillToCamelCase,
  convertOperationLogToCamelCase,
  convertBillFileToCamelCase,
  
  // 作废申请相关
  checkBillHasOperations,
  createVoidApplication,
  getVoidApplications,
  getVoidApplicationById,
  approveVoidApplication,
  rejectVoidApplication,
  
  // 系统配置
  getSystemConfig,
  setSystemConfig,
  getAllSystemConfigs
}

