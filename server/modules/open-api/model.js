/**
 * 开放 API 模块 - 数据模型
 * 供客户 ERP/WMS 系统对接使用
 */

import { getDatabase } from '../../config/database.js'

// ==================== 订单管理 ====================

/**
 * 批量创建订单（来自客户系统）
 */
export async function createOrders(customerId, orders, callbackUrl) {
  const db = getDatabase()
  const results = []
  
  for (const orderData of orders) {
    try {
      const result = await createSingleOrder(db, customerId, orderData, callbackUrl)
      results.push({
        success: true,
        externalOrderNo: orderData.externalOrderNo,
        orderId: result.orderId,
        status: result.status
      })
    } catch (error) {
      results.push({
        success: false,
        externalOrderNo: orderData.externalOrderNo,
        error: error.message
      })
    }
  }
  
  return results
}

/**
 * 创建单个订单
 */
async function createSingleOrder(db, customerId, data, callbackUrl) {
  const {
    externalOrderNo,
    billNumber,
    containerNumber,
    shipper,
    shipperAddress,
    shipperContact,
    consignee,
    portOfLoading,
    portOfDischarge,
    placeOfDelivery,
    etd,
    eta,
    pieces,
    weight,
    volume,
    description,
    containerType,
    serviceType,
    remark,
    cargoItems,
    importer
  } = data
  
  // 检查外部订单号是否重复
  if (externalOrderNo) {
    const existing = await db.prepare(`
      SELECT id FROM bills_of_lading 
      WHERE customer_id = ? AND external_order_no = ?
    `).get(customerId, externalOrderNo)
    
    if (existing) {
      throw new Error(`外部订单号 ${externalOrderNo} 已存在`)
    }
  }
  
  // 生成订单号
  const orderId = await generateOrderNumber(db)
  
  // 插入订单
  await db.prepare(`
    INSERT INTO bills_of_lading (
      id, bill_number, container_number, external_order_no,
      customer_id, shipper, shipper_address, shipper_contact,
      consignee, port_of_loading, port_of_discharge, place_of_delivery,
      etd, eta, pieces, weight, volume,
      cargo_description, container_type, service_type, remark,
      callback_url, status, source_channel,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '草稿', 'api', NOW(), NOW())
  `).run(
    orderId,
    billNumber || null,
    containerNumber || null,
    externalOrderNo || null,
    customerId,
    shipper || null,
    shipperAddress || null,
    shipperContact || null,
    consignee || null,
    portOfLoading || null,
    portOfDischarge || null,
    placeOfDelivery || null,
    etd || null,
    eta || null,
    pieces || null,
    weight || null,
    volume || null,
    description || null,
    containerType || null,
    serviceType || null,
    remark || null,
    callbackUrl || null
  )
  
  // 保存进口商信息
  if (importer) {
    await saveImporterInfo(db, orderId, importer)
  }
  
  // 创建货物明细
  if (cargoItems && cargoItems.length > 0) {
    await createCargoItems(db, orderId, customerId, cargoItems)
  }
  
  return {
    orderId,
    externalOrderNo,
    status: '草稿'
  }
}

/**
 * 保存进口商信息
 */
async function saveImporterInfo(db, orderId, importer) {
  const { name, companyName, taxNumber, taxType, country, address } = importer
  
  // 这里可以关联到 customer_tax_numbers 表或者保存到订单扩展字段
  await db.prepare(`
    UPDATE bills_of_lading SET
      importer_name = ?,
      importer_company = ?,
      importer_tax_number = ?,
      importer_tax_type = ?,
      importer_country = ?,
      importer_address = ?
    WHERE id = ?
  `).run(name, companyName, taxNumber, taxType, country, address, orderId)
}

/**
 * 创建货物明细
 */
async function createCargoItems(db, orderId, customerId, items) {
  const batchId = `API-${Date.now()}`
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    await db.prepare(`
      INSERT INTO cargo_import_items (
        order_id, batch_id, serial_no,
        product_code, product_name, product_name_en,
        hs_code, material, material_en, origin_country,
        quantity, unit, carton_count, pallet_count,
        unit_price, total_value, gross_weight, net_weight,
        reference_no, product_image, remark,
        status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `).run(
      orderId,
      batchId,
      item.serialNo || (i + 1).toString(),
      item.productCode || null,
      item.productName,
      item.productNameEn,
      item.hsCode || null,
      item.material || null,
      item.materialEn || null,
      item.originCountry || '中国',
      item.quantity,
      item.unit || 'PCS',
      item.cartonCount || null,
      item.palletCount || null,
      item.unitPrice,
      item.totalValue || (item.quantity * item.unitPrice),
      item.grossWeight || null,
      item.netWeight || null,
      item.referenceNo || null,
      item.productImage || null,
      item.remark || null
    )
  }
}

/**
 * 获取订单详情（通过订单ID或外部订单号）
 */
export async function getOrderDetail(customerId, identifier) {
  const db = getDatabase()
  
  // 支持通过订单ID或外部订单号查询
  const order = await db.prepare(`
    SELECT b.*, c.customer_name, c.customer_code
    FROM bills_of_lading b
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE b.customer_id = ? AND (b.id = ? OR b.external_order_no = ?)
  `).get(customerId, identifier, identifier)
  
  if (!order) return null
  
  // 获取货物明细
  const cargoItems = await db.prepare(`
    SELECT * FROM cargo_import_items 
    WHERE order_id = ?
    ORDER BY serial_no
  `).all(order.id)
  
  // 获取物流跟踪记录
  const trackingHistory = await db.prepare(`
    SELECT * FROM tracking_history 
    WHERE bill_id = ?
    ORDER BY created_at DESC
  `).all(order.id)
  
  return {
    ...convertOrderToCamelCase(order),
    cargoItems: cargoItems.map(convertCargoItemToCamelCase),
    trackingHistory: trackingHistory.map(convertTrackingToCamelCase)
  }
}

/**
 * 更新订单信息
 */
export async function updateOrder(customerId, identifier, data) {
  const db = getDatabase()
  
  // 查找订单
  const order = await db.prepare(`
    SELECT id, status FROM bills_of_lading 
    WHERE customer_id = ? AND (id = ? OR external_order_no = ?)
  `).get(customerId, identifier, identifier)
  
  if (!order) {
    throw new Error('订单不存在')
  }
  
  // 只允许更新草稿状态的订单
  if (order.status !== '草稿') {
    throw new Error('只能更新草稿状态的订单')
  }
  
  const updates = ['updated_at = NOW()']
  const values = []
  
  const allowedFields = [
    'billNumber', 'containerNumber', 'shipper', 'consignee',
    'portOfLoading', 'portOfDischarge', 'placeOfDelivery',
    'etd', 'eta', 'pieces', 'weight', 'volume', 'remark'
  ]
  
  const fieldMapping = {
    billNumber: 'bill_number',
    containerNumber: 'container_number',
    shipper: 'shipper',
    consignee: 'consignee',
    portOfLoading: 'port_of_loading',
    portOfDischarge: 'port_of_discharge',
    placeOfDelivery: 'place_of_delivery',
    etd: 'etd',
    eta: 'eta',
    pieces: 'pieces',
    weight: 'weight',
    volume: 'volume',
    remark: 'remark'
  }
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${fieldMapping[field]} = ?`)
      values.push(data[field])
    }
  }
  
  values.push(order.id)
  
  await db.prepare(`UPDATE bills_of_lading SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  
  return { success: true, orderId: order.id }
}

// ==================== 订单状态查询 ====================

/**
 * 批量查询订单状态
 */
export async function getOrdersStatus(customerId, params = {}) {
  const db = getDatabase()
  const { updatedAfter, orderIds, page = 1, pageSize = 50 } = params
  
  let sql = `
    SELECT 
      b.id as order_id, b.external_order_no, b.bill_number, b.container_number,
      b.status, b.ship_status, b.customs_status, b.delivery_status,
      b.eta, b.ata, b.updated_at as last_updated
    FROM bills_of_lading b
    WHERE b.customer_id = ?
  `
  const conditions = [customerId]
  
  if (updatedAfter) {
    sql += ` AND b.updated_at > ?`
    conditions.push(updatedAfter)
  }
  
  if (orderIds && orderIds.length > 0) {
    sql += ` AND (b.id IN (${orderIds.map(() => '?').join(',')}) OR b.external_order_no IN (${orderIds.map(() => '?').join(',')}))`
    conditions.push(...orderIds, ...orderIds)
  }
  
  // 计数
  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`
  conditions.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(sql).all(...conditions)
  
  return {
    orders: rows.map(row => ({
      orderId: row.order_id,
      externalOrderNo: row.external_order_no,
      billNumber: row.bill_number,
      containerNumber: row.container_number,
      status: row.status,
      shipStatus: row.ship_status,
      customsStatus: row.customs_status,
      deliveryStatus: row.delivery_status,
      eta: row.eta,
      ata: row.ata,
      lastUpdated: row.last_updated
    })),
    total: countResult?.total || 0,
    page,
    pageSize,
    hasMore: (page * pageSize) < (countResult?.total || 0)
  }
}

/**
 * 获取订单物流跟踪信息
 */
export async function getOrderTracking(customerId, identifier) {
  const db = getDatabase()
  
  // 查找订单
  const order = await db.prepare(`
    SELECT id, external_order_no, status, bill_number
    FROM bills_of_lading 
    WHERE customer_id = ? AND (id = ? OR external_order_no = ?)
  `).get(customerId, identifier, identifier)
  
  if (!order) {
    return null
  }
  
  // 获取物流跟踪记录
  const timeline = await db.prepare(`
    SELECT 
      tracking_time as time,
      status,
      description,
      location,
      carrier,
      tracking_number
    FROM tracking_history 
    WHERE bill_id = ?
    ORDER BY tracking_time ASC
  `).all(order.id)
  
  return {
    orderId: order.id,
    externalOrderNo: order.external_order_no,
    currentStatus: order.status,
    timeline: timeline.map(t => ({
      time: t.time,
      status: t.status,
      description: t.description,
      location: t.location || undefined,
      carrier: t.carrier || undefined,
      trackingNumber: t.tracking_number || undefined
    }))
  }
}

// ==================== 账单查询 ====================

/**
 * 获取账单列表
 */
export async function getInvoices(customerId, params = {}) {
  const db = getDatabase()
  const { status, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let sql = `
    SELECT 
      i.id, i.invoice_number, i.invoice_date, i.due_date,
      i.subtotal, i.tax_amount, i.total_amount, i.currency,
      i.status, i.paid_amount, i.balance,
      i.bill_id, b.bill_number, b.external_order_no
    FROM invoices i
    LEFT JOIN bills_of_lading b ON i.bill_id = b.id
    WHERE i.customer_id = ?
  `
  const conditions = [customerId]
  
  if (status) {
    sql += ` AND i.status = ?`
    conditions.push(status)
  }
  if (startDate) {
    sql += ` AND i.invoice_date >= ?`
    conditions.push(startDate)
  }
  if (endDate) {
    sql += ` AND i.invoice_date <= ?`
    conditions.push(endDate)
  }
  
  // 计数
  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY i.invoice_date DESC LIMIT ? OFFSET ?`
  conditions.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(sql).all(...conditions)
  
  return {
    invoices: rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      subtotal: parseFloat(row.subtotal || 0),
      taxAmount: parseFloat(row.tax_amount || 0),
      totalAmount: parseFloat(row.total_amount || 0),
      currency: row.currency,
      status: row.status,
      paidAmount: parseFloat(row.paid_amount || 0),
      balance: parseFloat(row.balance || 0),
      billId: row.bill_id,
      billNumber: row.bill_number,
      externalOrderNo: row.external_order_no
    })),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取账户余额
 */
export async function getBalance(customerId) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    SELECT
      SUM(total_amount) as total_amount,
      SUM(paid_amount) as paid_amount,
      SUM(balance) as balance,
      COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
      SUM(CASE WHEN due_date < date('now') AND status != 'paid' THEN balance ELSE 0 END) as overdue_amount
    FROM invoices
    WHERE customer_id = ? AND status != 'cancelled'
  `).get(customerId)
  
  return {
    totalAmount: parseFloat(result?.total_amount || 0),
    paidAmount: parseFloat(result?.paid_amount || 0),
    balance: parseFloat(result?.balance || 0),
    unpaidCount: result?.unpaid_count || 0,
    overdueAmount: parseFloat(result?.overdue_amount || 0),
    currency: 'EUR'
  }
}

// ==================== Webhook 相关 ====================

/**
 * 记录 Webhook 日志
 */
export async function logWebhook(data) {
  const db = getDatabase()
  const {
    apiKeyId, customerId, webhookUrl, eventType, payload,
    responseStatus, responseBody, status, errorMessage
  } = data
  
  await db.prepare(`
    INSERT INTO webhook_logs (
      api_key_id, customer_id, webhook_url, event_type, payload,
      response_status, response_body, status, error_message, sent_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    apiKeyId || null,
    customerId || null,
    webhookUrl,
    eventType,
    JSON.stringify(payload),
    responseStatus || null,
    responseBody || null,
    status,
    errorMessage || null
  )
}

/**
 * 获取待重试的 Webhook
 */
export async function getPendingWebhooks() {
  const db = getDatabase()
  return await db.prepare(`
    SELECT * FROM webhook_logs 
    WHERE status = 'failed' AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT 100
  `).all()
}

/**
 * 更新 Webhook 重试次数
 */
export async function updateWebhookRetry(id, status, responseStatus, errorMessage) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE webhook_logs 
    SET retry_count = retry_count + 1, 
        status = ?, 
        response_status = ?,
        error_message = ?,
        sent_at = NOW()
    WHERE id = ?
  `).run(status, responseStatus, errorMessage, id)
}

// ==================== 辅助函数 ====================

async function generateOrderNumber(db) {
  const today = new Date()
  const prefix = 'BP' + today.getFullYear().toString().slice(-2) + 
    (today.getMonth() + 1).toString().padStart(2, '0')
  
  const result = await db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, 7) AS INTEGER)) as max_seq
    FROM bills_of_lading
    WHERE id LIKE ?
  `).get(prefix + '%')
  
  const nextSeq = (result?.max_seq || 0) + 1
  return prefix + nextSeq.toString().padStart(4, '0')
}

function convertOrderToCamelCase(row) {
  return {
    id: row.id,
    billNumber: row.bill_number,
    containerNumber: row.container_number,
    mawbNumber: row.mawb_number,
    externalOrderNo: row.external_order_no,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    shipper: row.shipper,
    shipperAddress: row.shipper_address,
    shipperContact: row.shipper_contact,
    consignee: row.consignee,
    portOfLoading: row.port_of_loading,
    portOfDischarge: row.port_of_discharge,
    placeOfDelivery: row.place_of_delivery,
    transportMethod: row.transport_method,
    cargoType: row.cargo_type,
    pieces: row.pieces,
    weight: row.weight,
    volume: row.volume,
    status: row.status,
    shipStatus: row.ship_status,
    customsStatus: row.customs_status,
    deliveryStatus: row.delivery_status,
    etd: row.etd,
    eta: row.eta,
    ata: row.ata,
    callbackUrl: row.callback_url,
    sourceChannel: row.source_channel,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertCargoItemToCamelCase(row) {
  return {
    id: row.id,
    serialNo: row.serial_no,
    productCode: row.product_code,
    productName: row.product_name,
    productNameEn: row.product_name_en,
    hsCode: row.hs_code,
    material: row.material,
    materialEn: row.material_en,
    originCountry: row.origin_country,
    quantity: row.quantity,
    unit: row.unit,
    cartonCount: row.carton_count,
    palletCount: row.pallet_count,
    unitPrice: row.unit_price,
    totalValue: row.total_value,
    grossWeight: row.gross_weight,
    netWeight: row.net_weight,
    referenceNo: row.reference_no,
    productImage: row.product_image,
    remark: row.remark,
    status: row.status
  }
}

function convertTrackingToCamelCase(row) {
  return {
    time: row.tracking_time || row.created_at,
    status: row.status,
    description: row.description,
    location: row.location,
    carrier: row.carrier,
    trackingNumber: row.tracking_number
  }
}

export default {
  // 订单管理
  createOrders,
  getOrderDetail,
  updateOrder,
  
  // 订单状态
  getOrdersStatus,
  getOrderTracking,
  
  // 账单
  getInvoices,
  getBalance,
  
  // Webhook
  logWebhook,
  getPendingWebhooks,
  updateWebhookRetry
}

