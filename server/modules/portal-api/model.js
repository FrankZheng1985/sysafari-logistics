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
    shipStatus,
    customsStatus,
    deliveryStatus,
    billNumber, 
    startDate, 
    endDate, 
    page = 1, 
    pageSize = 20 
  } = params
  
  let sql = `
    SELECT 
      b.id, b.order_number, b.bill_number, b.container_number,
      b.shipper, b.consignee, b.port_of_loading, b.port_of_discharge,
      b.place_of_delivery, b.transport_method, b.container_type,
      b.pieces, b.weight, b.volume, b.status, b.ship_status,
      b.customs_status, b.delivery_status,
      b.etd, b.eta, b.ata, b.external_order_no,
      b.customer_name, b.customer_code,
      b.created_at, b.updated_at
    FROM bills_of_lading b
    WHERE b.customer_id = $1
  `
  const conditions = [customerId]
  let paramIndex = 2
  
  if (status) {
    sql += ` AND b.status = $${paramIndex++}`
    conditions.push(status)
  }
  
  // 船运状态筛选 - 未到港
  if (shipStatus === 'not_arrived') {
    sql += ` AND b.ship_status = '未到港'`
  }
  
  // 已到港状态筛选（已到港但未清关放行、未送达）
  if (shipStatus === 'arrived') {
    sql += ` AND b.ship_status = '已到港' AND (b.customs_status IS NULL OR b.customs_status = '' OR b.customs_status != '已放行') AND (b.delivery_status IS NULL OR b.delivery_status = '' OR b.delivery_status NOT IN ('已送达')) AND b.status != '已完成'`
  }
  
  // 清关状态筛选 - 已放行
  if (customsStatus === 'cleared') {
    sql += ` AND b.customs_status = '已放行'`
  }
  
  // 派送状态筛选
  if (deliveryStatus === 'delivering') {
    sql += ` AND (b.delivery_status = '派送中' OR b.delivery_status = '待派送')`
  } else if (deliveryStatus === 'delivered') {
    sql += ` AND (b.delivery_status = '已送达' OR b.status = '已完成')`
  }
  
  if (billNumber) {
    sql += ` AND (b.bill_number LIKE $${paramIndex} OR b.container_number LIKE $${paramIndex + 1} OR b.order_number LIKE $${paramIndex + 2})`
    conditions.push(`%${billNumber}%`, `%${billNumber}%`, `%${billNumber}%`)
    paramIndex += 3
  }
  if (startDate) {
    sql += ` AND b.created_at >= $${paramIndex++}`
    conditions.push(startDate)
  }
  if (endDate) {
    sql += ` AND b.created_at <= $${paramIndex++}`
    conditions.push(endDate)
  }
  
  // 计数
  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
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
      b.id, b.order_number, b.bill_number, b.container_number,
      b.shipper, b.consignee, b.notify_party,
      b.port_of_loading, b.port_of_discharge, b.place_of_delivery,
      b.transport_method, b.container_type,
      b.pieces, b.weight, b.volume, b.description,
      b.status, b.ship_status, b.customs_status, b.delivery_status,
      b.doc_swap_status, b.doc_swap_time,
      b.customs_release_time, b.actual_arrival_date,
      b.etd, b.eta, b.ata,
      b.vessel, b.voyage,
      b.external_order_no, b.remark,
      b.customer_name, b.customer_code,
      b.created_at, b.updated_at
    FROM bills_of_lading b
    WHERE b.id = $1 AND b.customer_id = $2
  `).get(orderId, customerId)
  
  if (!row) return null
  
  return convertOrderDetailToCamelCase(row)
}

/**
 * 转换订单详情为驼峰格式
 */
function convertOrderDetailToCamelCase(row) {
  // 状态标准化
  let displayStatus = row.status
  if (row.status === 'pending') {
    displayStatus = '进行中'
  }
  
  // 构建进度节点
  const progressSteps = buildProgressSteps(row)
  
  return {
    id: row.id,
    orderNumber: row.order_number,
    billNumber: row.bill_number,
    containerNumber: row.container_number,
    externalOrderNo: row.external_order_no,
    shipper: row.shipper,
    consignee: row.consignee,
    notifyParty: row.notify_party,
    portOfLoading: row.port_of_loading,
    portOfDischarge: row.port_of_discharge,
    placeOfDelivery: row.place_of_delivery,
    transportMethod: row.transport_method,
    containerType: row.container_type,
    pieces: row.pieces,
    weight: row.weight,
    volume: row.volume,
    description: row.description,
    status: displayStatus,
    rawStatus: row.status,
    shipStatus: row.ship_status,
    customsStatus: row.customs_status,
    deliveryStatus: row.delivery_status,
    docSwapStatus: row.doc_swap_status,
    docSwapTime: row.doc_swap_time,
    customsReleaseTime: row.customs_release_time,
    actualArrivalDate: row.actual_arrival_date,
    vessel: row.vessel,
    voyage: row.voyage,
    etd: row.etd,
    eta: row.eta,
    ata: row.ata,
    remark: row.remark,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progressSteps
  }
}

/**
 * 构建订单进度节点
 */
function buildProgressSteps(row) {
  const steps = []
  
  // 1. 已接单
  steps.push({
    key: 'accepted',
    label: '已接单',
    completed: true,
    time: row.created_at
  })
  
  // 2. 已发运
  const isShipped = ['已发运', '运输中', '已到港'].includes(row.ship_status) || 
                    row.status === '已完成'
  steps.push({
    key: 'shipped',
    label: '已发运',
    completed: isShipped,
    time: row.etd
  })
  
  // 3. 已到港
  const isArrived = row.ship_status === '已到港' || row.status === '已完成'
  steps.push({
    key: 'arrived',
    label: '已到港',
    completed: isArrived,
    time: row.ata || row.actual_arrival_date
  })
  
  // 4. 换单完成
  const isDocSwapped = row.doc_swap_status === '已换单' || row.status === '已完成'
  steps.push({
    key: 'doc_swap',
    label: '换单完成',
    completed: isDocSwapped,
    time: row.doc_swap_time
  })
  
  // 5. 清关放行
  const isCustomsCleared = row.customs_status === '已放行' || row.status === '已完成'
  steps.push({
    key: 'customs',
    label: '清关放行',
    completed: isCustomsCleared,
    time: row.customs_release_time
  })
  
  // 6. 已送达
  const isDelivered = row.delivery_status === '已送达' || row.status === '已完成'
  steps.push({
    key: 'delivered',
    label: '已送达',
    completed: isDelivered,
    time: null
  })
  
  return steps
}

/**
 * 获取客户的订单统计
 */
export async function getCustomerOrderStats(customerId) {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN ship_status = '未到港' THEN 1 END) as not_arrived,
      COUNT(CASE WHEN ship_status = '已到港' AND (customs_status IS NULL OR customs_status = '' OR customs_status != '已放行') AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达')) AND status != '已完成' THEN 1 END) as arrived,
      COUNT(CASE WHEN customs_status = '已放行' AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达')) AND status != '已完成' THEN 1 END) as customs_cleared,
      COUNT(CASE WHEN delivery_status = '派送中' OR delivery_status = '待派送' THEN 1 END) as delivering,
      COUNT(CASE WHEN delivery_status = '已送达' OR status = '已完成' THEN 1 END) as delivered
    FROM bills_of_lading
    WHERE customer_id = $1
  `).get(customerId)
  
  return {
    total: parseInt(stats?.total) || 0,
    notArrived: parseInt(stats?.not_arrived) || 0,
    arrived: parseInt(stats?.arrived) || 0,
    customsCleared: parseInt(stats?.customs_cleared) || 0,
    delivering: parseInt(stats?.delivering) || 0,
    delivered: parseInt(stats?.delivered) || 0
  }
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
      i.status, i.paid_amount, 
      COALESCE(i.total_amount, 0) - COALESCE(i.paid_amount, 0) as balance,
      i.bill_id, i.container_numbers, i.pdf_url, i.excel_url,
      i.items, i.notes,
      b.bill_number,
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
      i.id, i.invoice_number, i.invoice_date, i.due_date,
      i.subtotal, i.tax_amount, i.total_amount, i.currency,
      i.status, i.paid_amount, 
      COALESCE(i.total_amount, 0) - COALESCE(i.paid_amount, 0) as balance,
      i.bill_id, i.container_numbers, i.pdf_url, i.excel_url,
      i.items, i.notes, i.created_at,
      b.bill_number
    FROM invoices i
    LEFT JOIN bills_of_lading b ON i.bill_id = b.id
    WHERE i.id = $1 AND i.customer_id = $2
  `).get(invoiceId, customerId)
  
  if (!invoice) return null
  
  return convertInvoiceToCamelCase(invoice)
}

// ==================== 应付账款 ====================

/**
 * 获取客户的应付账款汇总
 */
export async function getCustomerPayables(customerId) {
  const db = getDatabase()
  
  // 获取应付账款汇总（计算 balance = total_amount - paid_amount）
  const summary = await db.prepare(`
    SELECT
      COUNT(*) as total_invoices,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(paid_amount), 0) as paid_amount,
      COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as balance,
      COUNT(CASE WHEN status = 'unpaid' OR status = '未付款' THEN 1 END) as unpaid_count,
      COUNT(CASE WHEN status = 'partial' OR status = '部分付款' THEN 1 END) as partial_count,
      COUNT(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', '已付款') THEN 1 END) as overdue_count,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', '已付款') THEN total_amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as overdue_amount
    FROM invoices
    WHERE customer_id = ? AND status NOT IN ('cancelled', '已取消')
  `).get(customerId)
  
  // 获取账龄分析
  const aging = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN total_amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as current,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - INTERVAL '30 days' THEN total_amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as days_1_30,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - INTERVAL '30 days' AND due_date >= CURRENT_DATE - INTERVAL '60 days' THEN total_amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as days_31_60,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - INTERVAL '60 days' AND due_date >= CURRENT_DATE - INTERVAL '90 days' THEN total_amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as days_61_90,
      COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - INTERVAL '90 days' THEN total_amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as days_over_90
    FROM invoices
    WHERE customer_id = ? AND status NOT IN ('paid', '已付款', 'cancelled', '已取消')
  `).get(customerId)
  
  return {
    summary: {
      totalInvoices: parseInt(summary?.total_invoices) || 0,
      totalAmount: parseFloat(summary?.total_amount || 0),
      paidAmount: parseFloat(summary?.paid_amount || 0),
      balance: parseFloat(summary?.balance || 0),
      unpaidCount: parseInt(summary?.unpaid_count) || 0,
      partialCount: parseInt(summary?.partial_count) || 0,
      overdueCount: parseInt(summary?.overdue_count) || 0,
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
  // 状态标准化：pending -> 进行中
  let displayStatus = row.status
  if (row.status === 'pending') {
    displayStatus = '进行中'
  }
  
  return {
    id: row.id,
    orderNumber: row.order_number,
    billNumber: row.bill_number,
    containerNumber: row.container_number,
    externalOrderNo: row.external_order_no,
    shipper: row.shipper,
    consignee: row.consignee,
    portOfLoading: row.port_of_loading,
    portOfDischarge: row.port_of_discharge,
    placeOfDelivery: row.place_of_delivery,
    transportMethod: row.transport_method,
    containerType: row.container_type,
    pieces: row.pieces,
    weight: row.weight,
    volume: row.volume,
    status: displayStatus,
    rawStatus: row.status,
    shipStatus: row.ship_status,
    customsStatus: row.customs_status,
    deliveryStatus: row.delivery_status,
    etd: row.etd,
    eta: row.eta,
    ata: row.ata,
    customerName: row.customer_name,
    customerCode: row.customer_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertInvoiceToCamelCase(row) {
  // 解析 container_numbers
  let containerNumbers = []
  try {
    if (row.container_numbers) {
      containerNumbers = typeof row.container_numbers === 'string' 
        ? JSON.parse(row.container_numbers) 
        : row.container_numbers
    }
  } catch (e) {
    // 解析失败则保持为空数组
  }

  // 解析并标准化 items 数据结构
  let items = []
  try {
    if (row.items) {
      const rawItems = typeof row.items === 'string' 
        ? JSON.parse(row.items) 
        : row.items
      
      // 标准化数据结构（兼容两种格式）
      items = rawItems.map(item => ({
        feeName: item.description || item.fee_name || item.feeName || '费用',
        feeNameEn: item.descriptionEn || item.fee_name_en || item.feeNameEn || null,
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitValue || item.unit_price || item.unitPrice || 0),
        amount: parseFloat(item.amount || 0),
        unit: item.unit || '项'
      }))
    }
  } catch (e) {
    // 解析失败则保持为空数组
  }

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
    containerNumbers,
    items,
    pdfUrl: row.pdf_url,
    excelUrl: row.excel_url,
    notes: row.notes,
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

// ==================== 客户询价同步 ====================

/**
 * 获取客户的询价列表（客户门户使用）
 */
export async function getCustomerInquiries(customerId, params = {}) {
  const db = getDatabase()
  const { status, page = 1, pageSize = 20 } = params
  
  let sql = `
    SELECT 
      id, inquiry_number, customer_id, customer_name, inquiry_type, status,
      clearance_data, transport_data, transport_quote,
      estimated_duty, estimated_vat, estimated_other_tax, clearance_fee, transport_fee,
      total_quote, currency, valid_until, quoted_at, quoted_by_name,
      assigned_to_name, due_at, processed_at, is_overdue, priority, source,
      crm_quote_id, transport_price_id, notes, created_at, updated_at
    FROM customer_inquiries
    WHERE customer_id = $1
  `
  const conditions = [customerId]
  let paramIndex = 2
  
  if (status) {
    sql += ` AND status = $${paramIndex++}`
    conditions.push(status)
  }
  
  // 计数
  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await db.prepare(countSql).get(...conditions)
  
  // 分页
  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  conditions.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(sql).all(...conditions)
  
  return {
    list: rows.map(convertInquiryToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取客户的单个询价详情
 */
export async function getCustomerInquiryById(customerId, inquiryId) {
  const db = getDatabase()
  
  const row = await db.prepare(`
    SELECT 
      id, inquiry_number, customer_id, customer_name, inquiry_type, status,
      clearance_data, transport_data, transport_quote,
      estimated_duty, estimated_vat, estimated_other_tax, clearance_fee, transport_fee,
      total_quote, currency, valid_until, quoted_at, quoted_by_name,
      assigned_to_name, due_at, processed_at, is_overdue, priority, source,
      crm_quote_id, transport_price_id, notes, created_at, updated_at
    FROM customer_inquiries
    WHERE customer_id = $1 AND id = $2
  `).get(customerId, inquiryId)
  
  return row ? convertInquiryToCamelCase(row) : null
}

/**
 * 获取客户的询价统计
 */
export async function getCustomerInquiryStats(customerId) {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'quoted' THEN 1 END) as quoted,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted
    FROM customer_inquiries
    WHERE customer_id = $1
  `).get(customerId)
  
  return {
    total: parseInt(stats?.total) || 0,
    pending: parseInt(stats?.pending) || 0,
    quoted: parseInt(stats?.quoted) || 0,
    accepted: parseInt(stats?.accepted) || 0
  }
}

function convertInquiryToCamelCase(row) {
  // 解析 JSON 字段
  let clearanceData = null
  let transportData = null
  let transportQuote = null
  
  try {
    if (row.clearance_data) {
      clearanceData = typeof row.clearance_data === 'string' 
        ? JSON.parse(row.clearance_data) 
        : row.clearance_data
    }
    if (row.transport_data) {
      transportData = typeof row.transport_data === 'string' 
        ? JSON.parse(row.transport_data) 
        : row.transport_data
    }
    if (row.transport_quote) {
      transportQuote = typeof row.transport_quote === 'string' 
        ? JSON.parse(row.transport_quote) 
        : row.transport_quote
    }
  } catch (e) {
    // 解析失败保持原值
  }
  
  return {
    id: row.id,
    inquiryNumber: row.inquiry_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    inquiryType: row.inquiry_type,
    status: row.status,
    
    // 清关数据
    clearanceData,
    estimatedDuty: parseFloat(row.estimated_duty) || 0,
    estimatedVat: parseFloat(row.estimated_vat) || 0,
    estimatedOtherTax: parseFloat(row.estimated_other_tax) || 0,
    clearanceFee: parseFloat(row.clearance_fee) || 0,
    
    // 运输数据
    transportData,
    transportQuote,
    transportFee: parseFloat(row.transport_fee) || 0,
    
    // 报价
    totalQuote: parseFloat(row.total_quote) || 0,
    currency: row.currency || 'EUR',
    validUntil: row.valid_until,
    quotedAt: row.quoted_at,
    quotedByName: row.quoted_by_name,
    
    // 分配信息
    assignedToName: row.assigned_to_name,
    dueAt: row.due_at,
    processedAt: row.processed_at,
    isOverdue: row.is_overdue,
    priority: row.priority || 'normal',
    source: row.source || 'portal',
    
    // 关联
    crmQuoteId: row.crm_quote_id,
    transportPriceId: row.transport_price_id,
    
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ==================== 基础数据查询 ====================

/**
 * 获取起运港列表
 */
export async function getPortsOfLoading(country, search) {
  const db = getDatabase()
  let sql = `
    SELECT id, port_code, port_name_cn, port_name_en, country, country_code, 
           city, description, status
    FROM ports_of_loading
    WHERE status = 'active'
  `
  const params = []
  let paramIndex = 1
  
  if (country) {
    sql += ` AND (country = $${paramIndex} OR country_code = $${paramIndex})`
    params.push(country)
    paramIndex++
  }
  
  if (search) {
    sql += ` AND (port_name_cn ILIKE $${paramIndex} OR port_name_en ILIKE $${paramIndex} OR port_code ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  sql += ` ORDER BY port_name_cn LIMIT 100`
  
  const result = await db.query(sql, params)
  return result.rows.map(row => ({
    id: row.id,
    code: row.port_code,
    nameCn: row.port_name_cn,
    nameEn: row.port_name_en,
    country: row.country,
    countryCode: row.country_code,
    city: row.city,
    label: `${row.port_name_cn} (${row.port_code})`
  }))
}

/**
 * 获取目的港列表
 */
export async function getDestinationPorts(country, search) {
  const db = getDatabase()
  let sql = `
    SELECT id, port_code, port_name_cn, port_name_en, country, country_code, 
           city, description, status
    FROM destination_ports
    WHERE status = 'active'
  `
  const params = []
  let paramIndex = 1
  
  if (country) {
    sql += ` AND (country = $${paramIndex} OR country_code = $${paramIndex})`
    params.push(country)
    paramIndex++
  }
  
  if (search) {
    sql += ` AND (port_name_cn ILIKE $${paramIndex} OR port_name_en ILIKE $${paramIndex} OR port_code ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  sql += ` ORDER BY port_name_cn LIMIT 100`
  
  const result = await db.query(sql, params)
  return result.rows.map(row => ({
    id: row.id,
    code: row.port_code,
    nameCn: row.port_name_cn,
    nameEn: row.port_name_en,
    country: row.country,
    countryCode: row.country_code,
    city: row.city,
    label: `${row.port_name_cn} (${row.port_code})`
  }))
}

/**
 * 获取机场列表
 */
export async function getAirPorts(country, search) {
  const db = getDatabase()
  let sql = `
    SELECT id, port_code, port_name_cn, port_name_en, country, country_code, 
           city, description, status
    FROM air_ports
    WHERE status = 'active'
  `
  const params = []
  let paramIndex = 1
  
  if (country) {
    sql += ` AND (country = $${paramIndex} OR country_code = $${paramIndex})`
    params.push(country)
    paramIndex++
  }
  
  if (search) {
    sql += ` AND (port_name_cn ILIKE $${paramIndex} OR port_name_en ILIKE $${paramIndex} OR port_code ILIKE $${paramIndex} OR city ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  sql += ` ORDER BY port_name_cn LIMIT 100`
  
  const result = await db.query(sql, params)
  return result.rows.map(row => ({
    id: row.id,
    code: row.port_code,
    nameCn: row.port_name_cn,
    nameEn: row.port_name_en,
    country: row.country,
    countryCode: row.country_code,
    city: row.city,
    label: `${row.port_name_cn} (${row.port_code})`
  }))
}

/**
 * 获取国家列表
 */
export async function getCountries(region, search) {
  const db = getDatabase()
  let sql = `
    SELECT id, country_code, country_name_cn, country_name_en, region, currency, timezone, status
    FROM countries
    WHERE status = 'active'
  `
  const params = []
  let paramIndex = 1
  
  if (region) {
    sql += ` AND region = $${paramIndex}`
    params.push(region)
    paramIndex++
  }
  
  if (search) {
    sql += ` AND (country_name_cn ILIKE $${paramIndex} OR country_name_en ILIKE $${paramIndex} OR country_code ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  sql += ` ORDER BY country_name_cn LIMIT 100`
  
  const result = await db.query(sql, params)
  return result.rows.map(row => ({
    id: row.id,
    code: row.country_code,
    nameCn: row.country_name_cn,
    nameEn: row.country_name_en,
    region: row.region,
    currency: row.currency,
    timezone: row.timezone,
    label: `${row.country_name_cn} (${row.country_code})`
  }))
}

/**
 * 获取城市列表
 */
export async function getCities(countryCode, search, level) {
  const db = getDatabase()
  let sql = `
    SELECT id, city_code, city_name_cn, city_name_en, country_code, parent_id, level, postal_code, status
    FROM cities
    WHERE status = 'active'
  `
  const params = []
  let paramIndex = 1
  
  if (countryCode) {
    sql += ` AND country_code = $${paramIndex}`
    params.push(countryCode)
    paramIndex++
  }
  
  if (level) {
    sql += ` AND level = $${paramIndex}`
    params.push(level)
    paramIndex++
  }
  
  if (search) {
    sql += ` AND (city_name_cn ILIKE $${paramIndex} OR city_name_en ILIKE $${paramIndex} OR city_code ILIKE $${paramIndex} OR postal_code ILIKE $${paramIndex})`
    params.push(`%${search}%`)
    paramIndex++
  }
  
  sql += ` ORDER BY city_name_cn LIMIT 100`
  
  const result = await db.query(sql, params)
  return result.rows.map(row => ({
    id: row.id,
    code: row.city_code,
    nameCn: row.city_name_cn,
    nameEn: row.city_name_en,
    countryCode: row.country_code,
    parentId: row.parent_id,
    level: row.level,
    postalCode: row.postal_code,
    label: row.city_name_cn
  }))
}

/**
 * 获取常用位置列表（汇总起运港、目的港和城市）
 */
export async function getLocations(type, search) {
  const db = getDatabase()
  const locations = []
  
  // 搜索条件
  const searchCondition = search ? `%${search}%` : null
  
  // 根据类型获取不同数据
  if (type === 'origin' || type === 'all') {
    // 起运港
    let sql = `
      SELECT 'port_of_loading' as type, id, port_code as code, port_name_cn as name_cn, 
             port_name_en as name_en, country, country_code, city
      FROM ports_of_loading
      WHERE status = 'active'
    `
    const params = []
    if (searchCondition) {
      sql += ` AND (port_name_cn ILIKE $1 OR port_name_en ILIKE $1 OR port_code ILIKE $1 OR city ILIKE $1)`
      params.push(searchCondition)
    }
    sql += ` ORDER BY port_name_cn LIMIT 30`
    
    const result = await db.query(sql, params)
    locations.push(...result.rows.map(row => ({
      type: 'port',
      subType: 'loading',
      id: row.id,
      code: row.code,
      nameCn: row.name_cn,
      nameEn: row.name_en,
      country: row.country,
      countryCode: row.country_code,
      city: row.city,
      label: `${row.name_cn} (${row.code})`
    })))
  }
  
  if (type === 'destination' || type === 'all') {
    // 目的港
    let sql = `
      SELECT 'destination_port' as type, id, port_code as code, port_name_cn as name_cn, 
             port_name_en as name_en, country, country_code, city
      FROM destination_ports
      WHERE status = 'active'
    `
    const params = []
    if (searchCondition) {
      sql += ` AND (port_name_cn ILIKE $1 OR port_name_en ILIKE $1 OR port_code ILIKE $1 OR city ILIKE $1)`
      params.push(searchCondition)
    }
    sql += ` ORDER BY port_name_cn LIMIT 30`
    
    const result = await db.query(sql, params)
    locations.push(...result.rows.map(row => ({
      type: 'port',
      subType: 'destination',
      id: row.id,
      code: row.code,
      nameCn: row.name_cn,
      nameEn: row.name_en,
      country: row.country,
      countryCode: row.country_code,
      city: row.city,
      label: `${row.name_cn} (${row.code})`
    })))
    
    // 欧洲城市（主要是德国、法国、荷兰、比利时、意大利、西班牙等）
    let citySql = `
      SELECT 'city' as type, id, city_code as code, city_name_cn as name_cn, 
             city_name_en as name_en, country_code, postal_code
      FROM cities
      WHERE status = 'active' 
        AND country_code IN ('DE', 'FR', 'NL', 'BE', 'IT', 'ES', 'PL', 'AT', 'CH', 'CZ', 'GB')
    `
    const cityParams = []
    if (searchCondition) {
      citySql += ` AND (city_name_cn ILIKE $1 OR city_name_en ILIKE $1 OR city_code ILIKE $1 OR postal_code ILIKE $1)`
      cityParams.push(searchCondition)
    }
    citySql += ` ORDER BY city_name_cn LIMIT 30`
    
    const cityResult = await db.query(citySql, cityParams)
    locations.push(...cityResult.rows.map(row => ({
      type: 'city',
      subType: 'european',
      id: row.id,
      code: row.code,
      nameCn: row.name_cn,
      nameEn: row.name_en,
      countryCode: row.country_code,
      postalCode: row.postal_code,
      label: `${row.name_cn}${row.postal_code ? ' (' + row.postal_code + ')' : ''}`
    })))
  }
  
  return locations
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
  createOrderDraft,
  
  // 客户询价
  getCustomerInquiries,
  getCustomerInquiryById,
  getCustomerInquiryStats,
  
  // 基础数据
  getPortsOfLoading,
  getDestinationPorts,
  getAirPorts,
  getCountries,
  getCities,
  getLocations
}

