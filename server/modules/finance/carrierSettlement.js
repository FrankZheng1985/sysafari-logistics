/**
 * 承运商结算服务
 * 账单导入、对账、结算单生成
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 结算单管理 ====================

/**
 * 获取结算单列表
 */
export async function getSettlements(params = {}) {
  const db = getDatabase()
  const { 
    carrierId, 
    reconcileStatus, 
    paymentStatus, 
    startDate, 
    endDate,
    page = 1, 
    pageSize = 20 
  } = params
  
  let query = `
    SELECT s.*, c.carrier_name, c.carrier_code 
    FROM carrier_settlements s
    LEFT JOIN last_mile_carriers c ON s.carrier_id = c.id
    WHERE 1=1
  `
  const queryParams = []
  
  if (carrierId) {
    query += ' AND s.carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (reconcileStatus) {
    query += ' AND s.reconcile_status = ?'
    queryParams.push(reconcileStatus)
  }
  
  if (paymentStatus) {
    query += ' AND s.payment_status = ?'
    queryParams.push(paymentStatus)
  }
  
  if (startDate) {
    query += ' AND s.period_start >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND s.period_end <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = query.replace(
    'SELECT s.*, c.carrier_name, c.carrier_code',
    'SELECT COUNT(*) as total'
  )
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertSettlementToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取结算单详情
 */
export async function getSettlementById(id) {
  const db = getDatabase()
  const settlement = await db.prepare(`
    SELECT s.*, c.carrier_name, c.carrier_code
    FROM carrier_settlements s
    LEFT JOIN last_mile_carriers c ON s.carrier_id = c.id
    WHERE s.id = ?
  `).get(id)
  
  if (!settlement) return null
  
  // 获取结算明细
  const items = await db.prepare(`
    SELECT * FROM carrier_settlement_items WHERE settlement_id = ? ORDER BY ship_date
  `).all(id)
  
  return {
    ...convertSettlementToCamelCase(settlement),
    items: items.map(convertItemToCamelCase)
  }
}

/**
 * 创建结算单
 */
export async function createSettlement(data) {
  const db = getDatabase()
  
  const settlementNo = `STL-${Date.now()}`
  
  const result = await db.prepare(`
    INSERT INTO carrier_settlements (
      settlement_no, carrier_id, carrier_name, period_start, period_end,
      total_shipments, total_weight, carrier_bill_amount, system_calc_amount,
      difference_amount, currency, reconcile_status, payment_status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?)
    RETURNING id
  `).get(
    settlementNo,
    data.carrierId,
    data.carrierName || '',
    data.periodStart,
    data.periodEnd,
    data.totalShipments || 0,
    data.totalWeight || 0,
    data.carrierBillAmount || 0,
    data.systemCalcAmount || 0,
    data.differenceAmount || 0,
    data.currency || 'EUR',
    data.remark || ''
  )
  
  return {
    id: result.id,
    settlementNo
  }
}

/**
 * 更新结算单
 */
export async function updateSettlement(id, data) {
  const db = getDatabase()
  
  const fields = []
  const values = []
  
  if (data.reconcileStatus !== undefined) {
    fields.push('reconcile_status = ?')
    values.push(data.reconcileStatus)
    if (data.reconcileStatus === 'confirmed') {
      fields.push('reconciled_at = ?')
      values.push(new Date().toISOString())
    }
  }
  
  if (data.paymentStatus !== undefined) {
    fields.push('payment_status = ?')
    values.push(data.paymentStatus)
    if (data.paymentStatus === 'paid') {
      fields.push('paid_at = ?')
      values.push(new Date().toISOString())
    }
  }
  
  if (data.paidAmount !== undefined) {
    fields.push('paid_amount = ?')
    values.push(data.paidAmount)
  }
  
  if (data.carrierBillAmount !== undefined) {
    fields.push('carrier_bill_amount = ?')
    values.push(data.carrierBillAmount)
  }
  
  if (data.carrierInvoiceUrl !== undefined) {
    fields.push('carrier_invoice_url = ?')
    values.push(data.carrierInvoiceUrl)
  }
  
  if (data.remark !== undefined) {
    fields.push('remark = ?')
    values.push(data.remark)
  }
  
  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)
  
  const result = await db.prepare(`
    UPDATE carrier_settlements SET ${fields.join(', ')} WHERE id = ?
  `).run(...values)
  
  return result.changes > 0
}

// ==================== 结算明细管理 ====================

/**
 * 获取结算明细列表
 */
export async function getSettlementItems(settlementId) {
  const db = getDatabase()
  const items = await db.prepare(`
    SELECT i.*, s.shipment_no, s.receiver_name, s.receiver_city
    FROM carrier_settlement_items i
    LEFT JOIN last_mile_shipments s ON i.shipment_id = s.id
    WHERE i.settlement_id = ?
    ORDER BY i.ship_date
  `).all(settlementId)
  
  return items.map(convertItemToCamelCase)
}

/**
 * 添加结算明细
 */
export async function addSettlementItem(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO carrier_settlement_items (
      settlement_id, shipment_id, tracking_no, ship_date,
      carrier_weight, carrier_amount, system_weight, system_amount,
      weight_diff, amount_diff, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    RETURNING id
  `).get(
    data.settlementId,
    data.shipmentId || null,
    data.trackingNo,
    data.shipDate,
    data.carrierWeight || 0,
    data.carrierAmount || 0,
    data.systemWeight || 0,
    data.systemAmount || 0,
    data.weightDiff || 0,
    data.amountDiff || 0
  )
  
  return { id: result.id }
}

/**
 * 批量添加结算明细
 */
export async function batchAddSettlementItems(settlementId, items) {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    INSERT INTO carrier_settlement_items (
      settlement_id, shipment_id, tracking_no, ship_date,
      carrier_weight, carrier_amount, system_weight, system_amount,
      weight_diff, amount_diff, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `)
  
  let successCount = 0
  
  for (const item of items) {
    try {
      stmt.run(
        settlementId,
        item.shipmentId || null,
        item.trackingNo,
        item.shipDate,
        item.carrierWeight || 0,
        item.carrierAmount || 0,
        item.systemWeight || 0,
        item.systemAmount || 0,
        item.weightDiff || 0,
        item.amountDiff || 0
      )
      successCount++
    } catch (e) {
      console.error('添加结算明细失败:', e)
    }
  }
  
  return { successCount, totalCount: items.length }
}

/**
 * 更新结算明细状态
 */
export async function updateSettlementItemStatus(itemId, status) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE carrier_settlement_items SET status = ? WHERE id = ?
  `).run(status, itemId)
  return result.changes > 0
}

// ==================== 账单导入与对账 ====================

/**
 * 导入承运商账单并进行对账
 * @param {Object} params - 导入参数
 * @param {number} params.carrierId - 承运商ID
 * @param {string} params.periodStart - 结算周期开始
 * @param {string} params.periodEnd - 结算周期结束
 * @param {Array} params.billItems - 账单明细 [{trackingNo, weight, amount, shipDate}]
 */
export async function importBillAndReconcile(params) {
  const db = getDatabase()
  const { carrierId, periodStart, periodEnd, billItems, carrierName, currency = 'EUR' } = params
  
  // 1. 获取系统运单数据进行匹配
  const systemShipments = await db.prepare(`
    SELECT id, shipment_no, carrier_tracking_no, weight, chargeable_weight,
           purchase_cost, shipped_at
    FROM last_mile_shipments
    WHERE carrier_id = ?
    AND shipped_at >= ?
    AND shipped_at <= ?
  `).all(carrierId, periodStart, periodEnd + 'T23:59:59')
  
  // 建立运单号索引
  const shipmentMap = new Map()
  systemShipments.forEach(s => {
    if (s.carrier_tracking_no) {
      shipmentMap.set(s.carrier_tracking_no, s)
    }
  })
  
  // 2. 对账处理
  const reconcileItems = []
  let totalCarrierAmount = 0
  let totalSystemAmount = 0
  let matchedCount = 0
  let unmatchedCount = 0
  
  for (const billItem of billItems) {
    const systemShipment = shipmentMap.get(billItem.trackingNo)
    
    const item = {
      trackingNo: billItem.trackingNo,
      shipDate: billItem.shipDate || null,
      carrierWeight: billItem.weight || 0,
      carrierAmount: billItem.amount || 0,
      shipmentId: null,
      systemWeight: 0,
      systemAmount: 0,
      weightDiff: 0,
      amountDiff: 0,
      status: 'pending'
    }
    
    totalCarrierAmount += item.carrierAmount
    
    if (systemShipment) {
      item.shipmentId = systemShipment.id
      item.systemWeight = systemShipment.chargeable_weight || systemShipment.weight || 0
      item.systemAmount = systemShipment.purchase_cost || 0
      item.weightDiff = item.carrierWeight - item.systemWeight
      item.amountDiff = item.carrierAmount - item.systemAmount
      
      totalSystemAmount += item.systemAmount
      
      // 判断是否匹配
      const amountTolerance = 0.5 // 金额误差容忍度
      if (Math.abs(item.amountDiff) <= amountTolerance) {
        item.status = 'matched'
        matchedCount++
      } else {
        item.status = 'disputed'
      }
    } else {
      item.status = 'unmatched'
      unmatchedCount++
    }
    
    reconcileItems.push(item)
  }
  
  // 3. 创建结算单
  const settlement = await createSettlement({
    carrierId,
    carrierName,
    periodStart,
    periodEnd,
    totalShipments: billItems.length,
    totalWeight: billItems.reduce((sum, i) => sum + (i.weight || 0), 0),
    carrierBillAmount: totalCarrierAmount,
    systemCalcAmount: totalSystemAmount,
    differenceAmount: totalCarrierAmount - totalSystemAmount,
    currency
  })
  
  // 4. 批量添加结算明细
  await batchAddSettlementItems(settlement.id, reconcileItems)
  
  return {
    success: true,
    data: {
      settlementId: settlement.id,
      settlementNo: settlement.settlementNo,
      totalItems: billItems.length,
      matchedCount,
      unmatchedCount,
      disputedCount: billItems.length - matchedCount - unmatchedCount,
      carrierBillAmount: totalCarrierAmount,
      systemCalcAmount: totalSystemAmount,
      differenceAmount: totalCarrierAmount - totalSystemAmount
    }
  }
}

/**
 * 按周期自动生成结算单
 */
export async function generateSettlementByPeriod(carrierId, periodStart, periodEnd) {
  const db = getDatabase()
  
  // 获取周期内的运单
  const shipments = await db.prepare(`
    SELECT id, shipment_no, carrier_tracking_no, weight, chargeable_weight,
           purchase_cost, shipped_at
    FROM last_mile_shipments
    WHERE carrier_id = ?
    AND shipped_at >= ?
    AND shipped_at <= ?
    AND status IN ('created', 'in_transit', 'delivered')
  `).all(carrierId, periodStart, periodEnd + 'T23:59:59')
  
  if (shipments.length === 0) {
    return {
      success: false,
      error: '该周期内无运单数据'
    }
  }
  
  // 获取承运商信息
  const carrier = await db.prepare(`
    SELECT carrier_name FROM last_mile_carriers WHERE id = ?
  `).get(carrierId)
  
  // 计算汇总
  const totalWeight = shipments.reduce((sum, s) => sum + (s.chargeable_weight || s.weight || 0), 0)
  const totalAmount = shipments.reduce((sum, s) => sum + (s.purchase_cost || 0), 0)
  
  // 创建结算单
  const settlement = await createSettlement({
    carrierId,
    carrierName: carrier?.carrier_name || '',
    periodStart,
    periodEnd,
    totalShipments: shipments.length,
    totalWeight,
    systemCalcAmount: totalAmount,
    carrierBillAmount: 0, // 待导入承运商账单后更新
    differenceAmount: 0 - totalAmount
  })
  
  // 添加明细
  const items = shipments.map(s => ({
    shipmentId: s.id,
    trackingNo: s.carrier_tracking_no || s.shipment_no,
    shipDate: s.shipped_at?.split('T')[0],
    systemWeight: s.chargeable_weight || s.weight || 0,
    systemAmount: s.purchase_cost || 0,
    carrierWeight: 0,
    carrierAmount: 0,
    weightDiff: 0,
    amountDiff: 0
  }))
  
  await batchAddSettlementItems(settlement.id, items)
  
  return {
    success: true,
    data: {
      settlementId: settlement.id,
      settlementNo: settlement.settlementNo,
      totalShipments: shipments.length,
      totalWeight,
      totalAmount
    }
  }
}

/**
 * 获取结算统计
 */
export async function getSettlementStats(params = {}) {
  const db = getDatabase()
  const { carrierId, year, month } = params
  
  let query = `
    SELECT 
      COUNT(*) as total_settlements,
      SUM(total_shipments) as total_shipments,
      SUM(carrier_bill_amount) as total_carrier_amount,
      SUM(system_calc_amount) as total_system_amount,
      SUM(difference_amount) as total_difference,
      SUM(CASE WHEN payment_status = 'paid' THEN paid_amount ELSE 0 END) as total_paid,
      SUM(CASE WHEN payment_status = 'unpaid' THEN carrier_bill_amount ELSE 0 END) as total_unpaid
    FROM carrier_settlements
    WHERE 1=1
  `
  const queryParams = []
  
  if (carrierId) {
    query += ' AND carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (year && month) {
    query += ` AND to_char(period_start, 'YYYY-MM') = ?`
    queryParams.push(`${year}-${String(month).padStart(2, '0')}`)
  } else if (year) {
    query += ` AND to_char(period_start, 'YYYY') = ?`
    queryParams.push(String(year))
  }
  
  const result = await db.prepare(query).get(...queryParams)
  
  return {
    totalSettlements: result?.total_settlements || 0,
    totalShipments: result?.total_shipments || 0,
    totalCarrierAmount: result?.total_carrier_amount || 0,
    totalSystemAmount: result?.total_system_amount || 0,
    totalDifference: result?.total_difference || 0,
    totalPaid: result?.total_paid || 0,
    totalUnpaid: result?.total_unpaid || 0
  }
}

// ==================== 辅助函数 ====================

function convertSettlementToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    settlementNo: row.settlement_no,
    carrierId: row.carrier_id,
    carrierName: row.carrier_name,
    carrierCode: row.carrier_code,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalShipments: row.total_shipments,
    totalWeight: row.total_weight,
    carrierBillAmount: row.carrier_bill_amount,
    systemCalcAmount: row.system_calc_amount,
    differenceAmount: row.difference_amount,
    currency: row.currency,
    reconcileStatus: row.reconcile_status,
    reconciledAt: row.reconciled_at,
    paymentStatus: row.payment_status,
    paidAmount: row.paid_amount,
    paidAt: row.paid_at,
    carrierInvoiceUrl: row.carrier_invoice_url,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertItemToCamelCase(row) {
  if (!row) return null
  return {
    id: row.id,
    settlementId: row.settlement_id,
    shipmentId: row.shipment_id,
    trackingNo: row.tracking_no,
    shipDate: row.ship_date,
    carrierWeight: row.carrier_weight,
    carrierAmount: row.carrier_amount,
    systemWeight: row.system_weight,
    systemAmount: row.system_amount,
    weightDiff: row.weight_diff,
    amountDiff: row.amount_diff,
    status: row.status,
    shipmentNo: row.shipment_no,
    receiverName: row.receiver_name,
    receiverCity: row.receiver_city,
    createdAt: row.created_at
  }
}

export default {
  // 结算单
  getSettlements,
  getSettlementById,
  createSettlement,
  updateSettlement,
  
  // 结算明细
  getSettlementItems,
  addSettlementItem,
  batchAddSettlementItems,
  updateSettlementItemStatus,
  
  // 账单导入与对账
  importBillAndReconcile,
  generateSettlementByPeriod,
  getSettlementStats
}
