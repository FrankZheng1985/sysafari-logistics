/**
 * 客户门户 API 模块 - 数据模型
 * 用于客户门户系统的数据访问（基于客户ID过滤）
 */

import { getDatabase } from '../../config/database.js'

// ==================== 订单查询 ====================

/**
 * 获取客户的订单列表
 */
export async function getCustomerOrders(customerId, params = {}) {
  const db = getDatabase()
  const { 
    status, 
    billNumber, 
    startDate, 
    endDate, 
    page = 1, 
    pageSize = 20 
  } = params
  
  let sql = `
    SELECT 
      b.id, b.bill_number, b.container_number, b.mawb_number,
      b.shipper, b.consignee, b.port_of_loading, b.port_of_discharge,
      b.place_of_delivery, b.transport_method, b.cargo_type,
      b.pieces, b.weight, b.volume, b.status, b.ship_status,
      b.etd, b.eta, b.ata, b.external_order_no,
      b.created_at, b.updated_at
    FROM bills_of_lading b
    WHERE b.customer_id = ?
  `
  const conditions = [customerId]
  
  if (status) {
    sql += ` AND b.status = ?`
    conditions.push(status)
  }
  if (billNumber) {
    sql += ` AND (b.bill_number LIKE ? OR b.container_number LIKE ?)`
    conditions.push(`%${billNumber}%`, `%${billNumber}%`)
  }
  if (startDate) {
    sql += ` AND b.created_at >= ?`
    conditions.push(startDate)
  }
  if (endDate) {
    sql += ` AND b.created_at <= ?`
    conditions.push(endDate)
  }
  
  // 计数
  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`
  conditions.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(sql).all(...conditions)
  
  return {
    list: rows.map(convertOrderToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取客户的单个订单详情
 */
export async function getCustomerOrderById(customerId, orderId) {
  const db = getDatabase()
  const row = await db.prepare(`
    SELECT 
      b.*,
      c.customer_name, c.customer_code
    FROM bills_of_lading b
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE b.id = ? AND b.customer_id = ?
  `).get(orderId, customerId)
  
  if (!row) return null
  
  // 获取货物明细
  const cargoItems = await db.prepare(`
    SELECT * FROM cargo_import_items 
    WHERE order_id = ?
    ORDER BY serial_no
  `).all(orderId)
  
  // 获取物流跟踪记录
  const trackingHistory = await db.prepare(`
    SELECT * FROM tracking_history 
    WHERE bill_id = ?
    ORDER BY created_at DESC
  `).all(orderId)
  
  return {
    ...convertOrderToCamelCase(row),
    cargoItems: cargoItems.map(convertCargoItemToCamelCase),
    trackingHistory: trackingHistory.map(convertTrackingToCamelCase)
  }
}

/**
 * 获取客户的订单统计
 */
export async function getCustomerOrderStats(customerId) {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = '草稿' THEN 1 END) as draft,
      COUNT(CASE WHEN status = '待发运' THEN 1 END) as pending,
      COUNT(CASE WHEN status IN ('已发运', '运输中') THEN 1 END) as shipping,
      COUNT(CASE WHEN status = '已到港' THEN 1 END) as arrived,
      COUNT(CASE WHEN status = '已签收' THEN 1 END) as completed
    FROM bills_of_lading
    WHERE customer_id = ?
  `).get(customerId)
  
  return stats
}

// ==================== 账单查询 ====================

/**
 * 获取客户的账单列表
 */
export async function getCustomerInvoices(customerId, params = {}) {
  const db = getDatabase()
  const { status, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let sql = `
    SELECT 
      i.id, i.invoice_number, i.invoice_date, i.due_date,
      i.subtotal, i.tax_amount, i.total_amount, i.currency,
      i.status, i.paid_amount, i.balance,
      i.bill_id, b.bill_number,
      i.created_at
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
    list: rows.map(convertInvoiceToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取客户的单个账单详情
 */
export async function getCustomerInvoiceById(customerId, invoiceId) {
  const db = getDatabase()
  
  const invoice = await db.prepare(`
    SELECT 
      i.*,
      b.bill_number, b.container_number
    FROM invoices i
    LEFT JOIN bills_of_lading b ON i.bill_id = b.id
    WHERE i.id = ? AND i.customer_id = ?
  `).get(invoiceId, customerId)
  
  if (!invoice) return null
  
  // 获取费用明细
  const feeItems = await db.prepare(`
    SELECT * FROM invoice_items 
    WHERE invoice_id = ?
    ORDER BY sort_order
  `).all(invoiceId)
  
  return {
    ...convertInvoiceToCamelCase(invoice),
    feeItems: feeItems.map(convertFeeItemToCamelCase)
  }
}

// ==================== 应付账款 ====================

/**
 * 获取客户的应付账款汇总
 */
export async function getCustomerPayables(customerId) {
  const db = getDatabase()
  
  // 获取应付账款汇总
  const summary = await db.prepare(`
    SELECT
      COUNT(*) as total_invoices,
      SUM(total_amount) as total_amount,
      SUM(paid_amount) as paid_amount,
      SUM(balance) as balance,
      COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
      COUNT(CASE WHEN due_date < date('now') AND status != 'paid' THEN 1 END) as overdue_count,
      SUM(CASE WHEN due_date < date('now') AND status != 'paid' THEN balance ELSE 0 END) as overdue_amount
    FROM invoices
    WHERE customer_id = ? AND status != 'cancelled'
  `).get(customerId)
  
  // 获取账龄分析
  const aging = await db.prepare(`
    SELECT
      SUM(CASE WHEN due_date >= date('now') THEN balance ELSE 0 END) as current,
      SUM(CASE WHEN due_date < date('now') AND due_date >= date('now', '-30 days') THEN balance ELSE 0 END) as days_1_30,
      SUM(CASE WHEN due_date < date('now', '-30 days') AND due_date >= date('now', '-60 days') THEN balance ELSE 0 END) as days_31_60,
      SUM(CASE WHEN due_date < date('now', '-60 days') AND due_date >= date('now', '-90 days') THEN balance ELSE 0 END) as days_61_90,
      SUM(CASE WHEN due_date < date('now', '-90 days') THEN balance ELSE 0 END) as days_over_90
    FROM invoices
    WHERE customer_id = ? AND status != 'paid' AND status != 'cancelled'
  `).get(customerId)
  
  return {
    summary: {
      totalInvoices: summary?.total_invoices || 0,
      totalAmount: parseFloat(summary?.total_amount || 0),
      paidAmount: parseFloat(summary?.paid_amount || 0),
      balance: parseFloat(summary?.balance || 0),
      unpaidCount: summary?.unpaid_count || 0,
      partialCount: summary?.partial_count || 0,
      overdueCount: summary?.overdue_count || 0,
      overdueAmount: parseFloat(summary?.overdue_amount || 0)
    },
    aging: {
      current: parseFloat(aging?.current || 0),
      days1To30: parseFloat(aging?.days_1_30 || 0),
      days31To60: parseFloat(aging?.days_31_60 || 0),
      days61To90: parseFloat(aging?.days_61_90 || 0),
      daysOver90: parseFloat(aging?.days_over_90 || 0)
    }
  }
}

// ==================== 订单创建 ====================

/**
 * 创建订单草稿（来自客户门户）
 */
export async function createOrderDraft(customerId, data) {
  const db = getDatabase()
  
  const {
    externalOrderNo,
    billNumber,
    containerNumber,
    shipper,
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
    cargoItems
  } = data
  
  // 生成订单号
  const orderNumber = await generateOrderNumber(db)
  
  // 插入订单
  const result = await db.prepare(`
    INSERT INTO bills_of_lading (
      id, bill_number, container_number, external_order_no,
      customer_id, shipper, consignee,
      port_of_loading, port_of_discharge, place_of_delivery,
      etd, eta, pieces, weight, volume,
      cargo_description, container_type, service_type, remark,
      status, source_channel,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '草稿', 'portal', NOW(), NOW())
  `).run(
    orderNumber,
    billNumber || null,
    containerNumber || null,
    externalOrderNo || null,
    customerId,
    shipper || null,
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
    remark || null
  )
  
  // 如果有货物明细，创建货物导入批次
  if (cargoItems && cargoItems.length > 0) {
    await createCargoItems(db, orderNumber, customerId, cargoItems)
  }
  
  return {
    orderId: orderNumber,
    externalOrderNo,
    status: '草稿'
  }
}

/**
 * 创建货物明细
 */
async function createCargoItems(db, orderId, customerId, items) {
  // 创建导入批次
  const batchId = `BATCH-${Date.now()}`
  
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
 * 生成订单号
 */
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

// ==================== 数据转换函数 ====================

function convertOrderToCamelCase(row) {
  return {
    id: row.id,
    billNumber: row.bill_number,
    containerNumber: row.container_number,
    mawbNumber: row.mawb_number,
    externalOrderNo: row.external_order_no,
    shipper: row.shipper,
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
    etd: row.etd,
    eta: row.eta,
    ata: row.ata,
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
    id: row.id,
    time: row.tracking_time || row.created_at,
    status: row.status,
    description: row.description,
    location: row.location,
    carrier: row.carrier,
    trackingNumber: row.tracking_number
  }
}

function convertInvoiceToCamelCase(row) {
  return {
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
    createdAt: row.created_at
  }
}

function convertFeeItemToCamelCase(row) {
  return {
    id: row.id,
    feeName: row.fee_name,
    feeNameEn: row.fee_name_en,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: parseFloat(row.unit_price || 0),
    amount: parseFloat(row.amount || 0),
    taxRate: row.tax_rate,
    taxAmount: parseFloat(row.tax_amount || 0),
    totalAmount: parseFloat(row.total_amount || 0),
    remark: row.remark
  }
}

export default {
  // 订单查询
  getCustomerOrders,
  getCustomerOrderById,
  getCustomerOrderStats,
  
  // 账单查询
  getCustomerInvoices,
  getCustomerInvoiceById,
  
  // 应付账款
  getCustomerPayables,
  
  // 订单创建
  createOrderDraft
}

