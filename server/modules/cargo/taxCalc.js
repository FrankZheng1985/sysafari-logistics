/**
 * 税费计算服务
 * 实现关税、增值税、反倾销税、反补贴税计算
 */

import { getDatabase } from '../../config/database.js'

/**
 * 计算单个商品的税费
 * @param {Object} item - 商品数据
 * @param {number} item.totalValue - CIF货值
 * @param {number} item.dutyRate - 关税率(%)
 * @param {number} item.vatRate - 增值税率(%)
 * @param {number} item.antiDumpingRate - 反倾销税率(%)
 * @param {number} item.countervailingRate - 反补贴税率(%)
 */
export function calculateItemTax(item) {
  const cifValue = parseFloat(item.totalValue) || 0
  const dutyRate = parseFloat(item.dutyRate) || 0
  const vatRate = parseFloat(item.vatRate) || 19 // 默认增值税率19%
  const antiDumpingRate = parseFloat(item.antiDumpingRate) || 0
  const countervailingRate = parseFloat(item.countervailingRate) || 0
  
  // 关税 = CIF货值 × 关税率
  const dutyAmount = cifValue * (dutyRate / 100)
  
  // 反倾销税 = CIF货值 × 反倾销税率
  const antiDumpingAmount = cifValue * (antiDumpingRate / 100)
  
  // 反补贴税 = CIF货值 × 反补贴税率
  const countervailingAmount = cifValue * (countervailingRate / 100)
  
  // 其他税费合计（反倾销+反补贴）
  const otherTaxAmount = antiDumpingAmount + countervailingAmount
  
  // 增值税 = (CIF货值 + 关税 + 其他税) × 增值税率
  const vatBase = cifValue + dutyAmount + otherTaxAmount
  const vatAmount = vatBase * (vatRate / 100)
  
  // 总税费 = 关税 + 增值税 + 其他税费
  const totalTax = dutyAmount + vatAmount + otherTaxAmount
  
  return {
    dutyAmount: roundToDecimal(dutyAmount, 2),
    vatAmount: roundToDecimal(vatAmount, 2),
    antiDumpingAmount: roundToDecimal(antiDumpingAmount, 2),
    countervailingAmount: roundToDecimal(countervailingAmount, 2),
    otherTaxAmount: roundToDecimal(otherTaxAmount, 2),
    totalTax: roundToDecimal(totalTax, 2)
  }
}

/**
 * 四舍五入到指定小数位
 */
function roundToDecimal(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * 计算整个导入批次的税费
 */
export async function calculateImportTax(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取已匹配的货物明细
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('matched', 'auto_approved', 'approved')
  `).all(importId)
  
  let totalValue = 0
  let totalDuty = 0
  let totalVat = 0
  let totalOtherTax = 0
  let totalTax = 0
  
  const itemsWithTax = []
  
  for (const row of rows) {
    const item = {
      id: row.id,
      totalValue: parseFloat(row.total_value) || 0,
      dutyRate: parseFloat(row.duty_rate) || 0,
      vatRate: parseFloat(row.vat_rate) || 19,
      antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(row.countervailing_rate) || 0
    }
    
    const taxResult = calculateItemTax(item)
    
    // 更新货物明细的税费
    await db.prepare(`
      UPDATE cargo_items SET
        duty_amount = ?,
        vat_amount = ?,
        other_tax_amount = ?,
        total_tax = ?
      WHERE id = ?
    `).run(
      taxResult.dutyAmount,
      taxResult.vatAmount,
      taxResult.otherTaxAmount,
      taxResult.totalTax,
      item.id
    )
    
    // 累计统计
    totalValue += item.totalValue
    totalDuty += taxResult.dutyAmount
    totalVat += taxResult.vatAmount
    totalOtherTax += taxResult.otherTaxAmount
    totalTax += taxResult.totalTax
    
    itemsWithTax.push({
      ...row,
      ...taxResult
    })
  }
  
  // 更新导入批次的税费统计
  await db.prepare(`
    UPDATE cargo_imports SET
      total_value = ?,
      total_duty = ?,
      total_vat = ?,
      total_other_tax = ?,
      updated_at = ?
    WHERE id = ?
  `).run(totalValue, totalDuty, totalVat, totalOtherTax, now, importId)
  
  return {
    itemCount: rows.length,
    totalValue: roundToDecimal(totalValue, 2),
    totalDuty: roundToDecimal(totalDuty, 2),
    totalVat: roundToDecimal(totalVat, 2),
    totalOtherTax: roundToDecimal(totalOtherTax, 2),
    totalTax: roundToDecimal(totalTax, 2),
    items: itemsWithTax
  }
}

/**
 * 更新清关类型
 */
export async function updateClearanceType(importId, clearanceType) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE cargo_imports SET
      clearance_type = ?,
      updated_at = ?
    WHERE id = ?
  `).run(clearanceType, now, importId)
  
  return true
}

/**
 * 获取导入批次的税费详情
 */
export async function getTaxDetails(importId) {
  const db = getDatabase()
  
  // 获取批次信息
  const batch = await db.prepare('SELECT * FROM cargo_imports WHERE id = ?').get(importId)
  if (!batch) {
    return null
  }
  
  // 清关类型：40-普通清关，42-递延清关
  const clearanceType = batch.clearance_type || '40'
  const isDeferred = clearanceType === '42'
  
  // 获取货物明细
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('matched', 'auto_approved', 'approved')
    ORDER BY item_no ASC
  `).all(importId)
  
  const items = rows.map(row => ({
    id: row.id,
    itemNo: row.item_no,
    productName: row.product_name,
    productNameEn: row.product_name_en,
    matchedHsCode: row.matched_hs_code,
    quantity: parseFloat(row.quantity) || 0,
    unitName: row.unit_name,
    unitPrice: parseFloat(row.unit_price) || 0,
    totalValue: parseFloat(row.total_value) || 0,
    originCountry: row.origin_country,
    material: row.material,
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    dutyAmount: parseFloat(row.duty_amount) || 0,
    vatAmount: parseFloat(row.vat_amount) || 0,
    otherTaxAmount: parseFloat(row.other_tax_amount) || 0,
    totalTax: parseFloat(row.total_tax) || 0
  }))
  
  // 按HS编码分组统计
  const byHsCode = {}
  for (const item of items) {
    const key = item.matchedHsCode || 'unknown'
    if (!byHsCode[key]) {
      byHsCode[key] = {
        hsCode: key,
        itemCount: 0,
        totalValue: 0,
        totalDuty: 0,
        totalVat: 0,
        totalOtherTax: 0,
        totalTax: 0
      }
    }
    byHsCode[key].itemCount++
    byHsCode[key].totalValue += item.totalValue
    byHsCode[key].totalDuty += item.dutyAmount
    byHsCode[key].totalVat += item.vatAmount
    byHsCode[key].totalOtherTax += item.otherTaxAmount
    byHsCode[key].totalTax += item.totalTax
  }
  
  // 根据清关类型计算实际应付税费
  const totalValue = parseFloat(batch.total_value) || 0
  const totalDuty = parseFloat(batch.total_duty) || 0
  const totalVat = parseFloat(batch.total_vat) || 0
  const totalOtherTax = parseFloat(batch.total_other_tax) || 0
  
  // 42号递延清关：增值税递延，不在进口时缴纳
  const payableVat = isDeferred ? 0 : totalVat
  const deferredVat = isDeferred ? totalVat : 0
  
  return {
    batch: {
      id: batch.id,
      importNo: batch.import_no,
      customerName: batch.customer_name,
      containerNo: batch.container_no,
      billNumber: batch.bill_number,
      totalItems: batch.total_items,
      matchedItems: batch.matched_items,
      totalValue: totalValue,
      totalDuty: totalDuty,
      totalVat: totalVat,
      totalOtherTax: totalOtherTax,
      customerConfirmed: batch.customer_confirmed,
      customerConfirmedAt: batch.customer_confirmed_at,
      confirmPdfPath: batch.confirm_pdf_path,
      status: batch.status,
      clearanceType: clearanceType
    },
    items,
    summary: {
      totalValue: roundToDecimal(totalValue, 2),
      totalDuty: roundToDecimal(totalDuty, 2),
      totalVat: roundToDecimal(totalVat, 2),           // 计算的增值税总额
      payableVat: roundToDecimal(payableVat, 2),       // 实际应付增值税
      deferredVat: roundToDecimal(deferredVat, 2),     // 递延增值税
      totalOtherTax: roundToDecimal(totalOtherTax, 2),
      // 实际应付税费 = 关税 + 应付增值税 + 其他税
      totalTax: roundToDecimal(totalDuty + payableVat + totalOtherTax, 2),
      // 递延清关说明
      clearanceType: clearanceType,
      clearanceTypeLabel: clearanceType === '42' ? '42号递延清关' : '40号普通清关',
      isDeferred: isDeferred
    },
    byHsCode: Object.values(byHsCode)
  }
}

/**
 * 标记客户已确认
 */
export async function markCustomerConfirmed(importId, confirmedBy) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE cargo_imports SET
      customer_confirmed = 1,
      customer_confirmed_at = ?,
      customer_confirmed_by = ?,
      status = 'confirmed',
      updated_at = ?
    WHERE id = ?
  `).run(now, confirmedBy, now, importId)
  
  return true
}

/**
 * 更新PDF路径
 */
export async function updateConfirmPdfPath(importId, pdfPath) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE cargo_imports SET
      confirm_pdf_path = ?,
      updated_at = ?
    WHERE id = ?
  `).run(pdfPath, now, importId)
  
  return true
}

/**
 * 获取统计数据
 */
export async function getDocumentStats() {
  const db = getDatabase()
  
  // 基础统计
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_imports,
      SUM(CASE WHEN status = 'pending' OR status = 'matching' THEN 1 ELSE 0 END) as pending_matching,
      SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as pending_review,
      SUM(CASE WHEN status IN ('confirmed', 'completed') THEN 1 ELSE 0 END) as completed,
      COALESCE(SUM(total_value), 0) as total_value,
      COALESCE(SUM(total_duty + total_vat + total_other_tax), 0) as total_duty
    FROM cargo_imports
  `).get()
  
  // 最近导入记录
  const recentImports = await db.prepare(`
    SELECT
      id, import_no, order_no, customer_name, container_no, bill_number,
      total_items, matched_items, status, created_at
    FROM cargo_imports
    ORDER BY created_at DESC
    LIMIT 10
  `).all()
  
  return {
    totalImports: parseInt(stats?.total_imports) || 0,
    pendingMatching: parseInt(stats?.pending_matching) || 0,
    pendingReview: parseInt(stats?.pending_review) || 0,
    completed: parseInt(stats?.completed) || 0,
    totalValue: parseFloat(stats?.total_value) || 0,
    totalDuty: parseFloat(stats?.total_duty) || 0,
    recentImports: (recentImports || []).map(row => ({
      id: row.id,
      importNo: row.import_no,
      orderNo: row.order_no,
      customerName: row.customer_name,
      containerNo: row.container_no,
      billNumber: row.bill_number,
      totalItems: row.total_items,
      matchedItems: row.matched_items,
      status: row.status,
      createdAt: row.created_at
    }))
  }
}

export default {
  calculateItemTax,
  calculateImportTax,
  getTaxDetails,
  markCustomerConfirmed,
  updateConfirmPdfPath,
  getDocumentStats
}
