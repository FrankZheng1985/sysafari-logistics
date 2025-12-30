/**
 * 申报价值分析模块
 * 记录历史申报数据，分析最低通过价值，提供申报建议
 */

import { getDatabase } from '../../config/database.js'

/**
 * 规范化 HS 编码为 10 位
 */
function normalizeHsCode(hsCode) {
  if (!hsCode) return hsCode
  const cleaned = hsCode.replace(/[^0-9]/g, '')
  if (cleaned.length >= 10) return cleaned.substring(0, 10)
  return cleaned.padEnd(10, '0')
}

/**
 * 记录申报价值
 * @param {Object} data - 申报数据
 */
export async function recordDeclarationValue(data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const {
    hsCode,
    productName,
    productNameEn,
    originCountry,
    originCountryCode,
    declaredUnitPrice,
    priceUnit = 'PCS',
    declaredQuantity,
    declaredTotalValue,
    currency = 'EUR',
    declarationResult = 'pending',
    customsAdjustedPrice,
    adjustmentReason,
    declarationDate,
    customsOffice,
    billNo,
    importId,
    itemId,
    createdBy
  } = data
  
  const result = await db.prepare(`
    INSERT INTO declaration_value_records (
      hs_code, product_name, product_name_en, origin_country, origin_country_code,
      declared_unit_price, price_unit, declared_quantity, declared_total_value, currency,
      declaration_result, customs_adjusted_price, adjustment_reason,
      declaration_date, customs_office, bill_no, import_id, item_id, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    normalizeHsCode(hsCode),
    productName,
    productNameEn,
    originCountry,
    originCountryCode,
    declaredUnitPrice,
    priceUnit,
    declaredQuantity,
    declaredTotalValue,
    currency,
    declarationResult,
    customsAdjustedPrice,
    adjustmentReason,
    declarationDate || now.split('T')[0],
    customsOffice,
    billNo,
    importId,
    itemId,
    createdBy,
    now,
    now
  )
  
  return result?.id
}

/**
 * 更新申报结果
 * @param {number} recordId - 记录ID
 * @param {string} result - 申报结果: passed/questioned/rejected
 * @param {number} adjustedPrice - 海关调整价格（如有）
 * @param {string} adjustmentReason - 调整原因
 */
export async function updateDeclarationResult(recordId, result, adjustedPrice = null, adjustmentReason = null) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE declaration_value_records SET
      declaration_result = ?,
      customs_adjusted_price = COALESCE(?, customs_adjusted_price),
      adjustment_reason = COALESCE(?, adjustment_reason),
      updated_at = ?
    WHERE id = ?
  `).run(result, adjustedPrice, adjustmentReason, now, recordId)
  
  return true
}

/**
 * 批量记录申报结果
 * @param {number} importId - 导入批次ID
 * @param {string} result - 统一申报结果
 */
export async function batchUpdateDeclarationResult(importId, result) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const updated = await db.prepare(`
    UPDATE declaration_value_records SET
      declaration_result = ?,
      updated_at = ?
    WHERE import_id = ? AND declaration_result = 'pending'
  `).run(result, now, importId)
  
  return updated.changes || 0
}

/**
 * 获取HS编码的申报价值统计
 * @param {string} hsCode - HS编码
 * @param {string} originCountry - 原产国（可选）
 * @param {string} priceUnit - 价格单位（可选）
 */
export async function getDeclarationStats(hsCode, originCountry = null, priceUnit = null) {
  const db = getDatabase()
  const normalizedHsCode = normalizeHsCode(hsCode)
  
  let query = `
    SELECT 
      hs_code,
      origin_country,
      price_unit,
      COUNT(*) as total_count,
      COUNT(CASE WHEN declaration_result = 'passed' THEN 1 END) as pass_count,
      COUNT(CASE WHEN declaration_result = 'questioned' THEN 1 END) as questioned_count,
      COUNT(CASE WHEN declaration_result = 'rejected' THEN 1 END) as rejected_count,
      MIN(CASE WHEN declaration_result = 'passed' THEN declared_unit_price END) as min_pass_price,
      MAX(CASE WHEN declaration_result = 'passed' THEN declared_unit_price END) as max_pass_price,
      AVG(CASE WHEN declaration_result = 'passed' THEN declared_unit_price END) as avg_pass_price,
      PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY declared_unit_price) 
        FILTER (WHERE declaration_result = 'passed') as p10_pass_price,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY declared_unit_price) 
        FILTER (WHERE declaration_result = 'passed') as p25_pass_price,
      MIN(CASE WHEN declaration_result = 'questioned' OR declaration_result = 'rejected' 
          THEN declared_unit_price END) as min_problem_price
    FROM declaration_value_records
    WHERE hs_code = ? AND declared_unit_price > 0
  `
  const params = [normalizedHsCode]
  
  if (originCountry) {
    query += ` AND (origin_country ILIKE ? OR origin_country_code = ?)`
    params.push(`%${originCountry}%`, originCountry)
  }
  
  if (priceUnit) {
    query += ` AND price_unit = ?`
    params.push(priceUnit)
  }
  
  query += ` GROUP BY hs_code, origin_country, price_unit`
  
  const rows = await db.prepare(query).all(...params)
  
  if (!rows || rows.length === 0) {
    return {
      found: false,
      hsCode: normalizedHsCode,
      message: '暂无该HS编码的历史申报记录'
    }
  }
  
  // 如果有多条记录（不同原产国/单位），返回最相关的一条
  const stats = rows[0]
  const totalCount = parseInt(stats.total_count) || 0
  const passCount = parseInt(stats.pass_count) || 0
  const passRate = totalCount > 0 ? Math.round(passCount * 100 / totalCount) : 0
  
  // 计算建议最低安全价格
  // 使用10分位数或最低通过价格的较高者
  const minPassPrice = parseFloat(stats.min_pass_price) || 0
  const p10PassPrice = parseFloat(stats.p10_pass_price) || minPassPrice
  const suggestedMinPrice = Math.max(minPassPrice, p10PassPrice * 0.95)
  
  return {
    found: true,
    hsCode: normalizedHsCode,
    originCountry: stats.origin_country,
    priceUnit: stats.price_unit,
    stats: {
      totalCount,
      passCount,
      questionedCount: parseInt(stats.questioned_count) || 0,
      rejectedCount: parseInt(stats.rejected_count) || 0,
      passRate,
      minPassPrice: Math.round(minPassPrice * 100) / 100,
      maxPassPrice: Math.round(parseFloat(stats.max_pass_price) * 100) / 100 || 0,
      avgPassPrice: Math.round(parseFloat(stats.avg_pass_price) * 100) / 100 || 0,
      p10PassPrice: Math.round(p10PassPrice * 100) / 100,
      p25PassPrice: Math.round(parseFloat(stats.p25_pass_price) * 100) / 100 || 0,
      minProblemPrice: Math.round(parseFloat(stats.min_problem_price) * 100) / 100 || 0
    },
    suggestedMinPrice: Math.round(suggestedMinPrice * 100) / 100,
    riskLevel: passRate >= 90 ? 'low' : (passRate >= 70 ? 'medium' : 'high')
  }
}

/**
 * 检查申报价值风险
 * @param {string} hsCode - HS编码
 * @param {number} declaredPrice - 拟申报价格
 * @param {string} originCountry - 原产国
 * @param {string} priceUnit - 价格单位
 */
export async function checkDeclarationRisk(hsCode, declaredPrice, originCountry = null, priceUnit = null) {
  const stats = await getDeclarationStats(hsCode, originCountry, priceUnit)
  
  if (!stats.found) {
    return {
      riskLevel: 'unknown',
      message: '暂无历史申报数据参考',
      suggestion: '建议参考市场价格合理申报'
    }
  }
  
  const { minPassPrice, avgPassPrice, p10PassPrice } = stats.stats
  const suggestedMinPrice = stats.suggestedMinPrice
  
  let riskLevel = 'low'
  let warnings = []
  let suggestions = []
  
  // 价格低于历史最低通过价格
  if (declaredPrice < minPassPrice && minPassPrice > 0) {
    riskLevel = 'high'
    warnings.push(`申报价格 €${declaredPrice} 低于历史最低通过价格 €${minPassPrice}`)
    suggestions.push(`建议调整至 €${suggestedMinPrice} 以上`)
  }
  // 价格低于10分位数
  else if (declaredPrice < p10PassPrice && p10PassPrice > 0) {
    riskLevel = 'medium'
    warnings.push(`申报价格 €${declaredPrice} 处于历史较低水平 (低于90%的通过申报)`)
    suggestions.push(`建议参考平均通过价格 €${avgPassPrice}`)
  }
  // 价格明显低于平均水平
  else if (declaredPrice < avgPassPrice * 0.7 && avgPassPrice > 0) {
    riskLevel = 'medium'
    warnings.push(`申报价格 €${declaredPrice} 明显低于平均通过价格 €${avgPassPrice}`)
  }
  
  // 检查通过率
  if (stats.stats.passRate < 70) {
    if (riskLevel === 'low') riskLevel = 'medium'
    warnings.push(`该HS编码历史申报通过率较低 (${stats.stats.passRate}%)`)
  }
  
  return {
    riskLevel,
    declaredPrice,
    hsCode: stats.hsCode,
    originCountry: stats.originCountry,
    priceUnit: stats.priceUnit,
    historicalStats: stats.stats,
    suggestedMinPrice,
    warnings,
    suggestions,
    isRisky: riskLevel !== 'low'
  }
}

/**
 * 批量检查导入批次的申报价值风险
 * @param {number} importId - 导入批次ID
 */
export async function batchCheckDeclarationRisk(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取货物明细
  const items = await db.prepare(`
    SELECT 
      id, matched_hs_code, product_name, origin_country,
      unit_price, quantity, unit_name, total_value
    FROM cargo_items 
    WHERE import_id = ? AND matched_hs_code IS NOT NULL
  `).all(importId)
  
  const riskResults = []
  let highRiskCount = 0
  let mediumRiskCount = 0
  
  for (const item of (items || [])) {
    if (!item.unit_price || item.unit_price <= 0) continue
    
    const riskCheck = await checkDeclarationRisk(
      item.matched_hs_code,
      parseFloat(item.unit_price),
      item.origin_country,
      item.unit_name
    )
    
    // 更新货物明细的风险信息
    await db.prepare(`
      UPDATE cargo_items SET
        declaration_risk = ?,
        min_safe_price = ?,
        price_warning = ?
      WHERE id = ?
    `).run(
      riskCheck.riskLevel,
      riskCheck.suggestedMinPrice,
      riskCheck.warnings.join('; '),
      item.id
    )
    
    if (riskCheck.riskLevel === 'high') {
      highRiskCount++
      riskResults.push({
        itemId: item.id,
        hsCode: item.matched_hs_code,
        productName: item.product_name,
        declaredPrice: item.unit_price,
        ...riskCheck
      })
    } else if (riskCheck.riskLevel === 'medium') {
      mediumRiskCount++
      riskResults.push({
        itemId: item.id,
        hsCode: item.matched_hs_code,
        productName: item.product_name,
        declaredPrice: item.unit_price,
        ...riskCheck
      })
    }
  }
  
  return {
    importId,
    totalItems: (items || []).length,
    highRiskCount,
    mediumRiskCount,
    riskItems: riskResults,
    analyzedAt: now
  }
}

/**
 * 从货物明细批量创建申报记录
 * @param {number} importId - 导入批次ID
 * @param {string} billNo - 提单号
 * @param {number} createdBy - 创建人ID
 */
export async function createDeclarationRecordsFromImport(importId, billNo, createdBy) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取货物明细
  const items = await db.prepare(`
    SELECT 
      id, matched_hs_code, product_name, product_name_en,
      origin_country, origin_country_code, unit_price, unit_name,
      quantity, total_value
    FROM cargo_items 
    WHERE import_id = ? AND matched_hs_code IS NOT NULL
  `).all(importId)
  
  let createdCount = 0
  
  for (const item of (items || [])) {
    if (!item.unit_price || item.unit_price <= 0) continue
    
    await db.prepare(`
      INSERT INTO declaration_value_records (
        hs_code, product_name, product_name_en, origin_country, origin_country_code,
        declared_unit_price, price_unit, declared_quantity, declared_total_value,
        declaration_result, declaration_date, bill_no, import_id, item_id, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizeHsCode(item.matched_hs_code),
      item.product_name,
      item.product_name_en,
      item.origin_country,
      item.origin_country_code,
      item.unit_price,
      item.unit_name || 'PCS',
      item.quantity,
      item.total_value,
      now.split('T')[0],
      billNo,
      importId,
      item.id,
      createdBy,
      now,
      now
    )
    createdCount++
  }
  
  return { createdCount }
}

/**
 * 获取申报价值历史记录
 * @param {Object} params - 查询参数
 */
export async function getDeclarationHistory(params = {}) {
  const db = getDatabase()
  const { hsCode, originCountry, result, startDate, endDate, page = 1, pageSize = 20 } = params
  const offset = (page - 1) * pageSize
  
  let whereClause = '1=1'
  const queryParams = []
  
  if (hsCode) {
    whereClause += ' AND hs_code = ?'
    queryParams.push(normalizeHsCode(hsCode))
  }
  
  if (originCountry) {
    whereClause += ' AND (origin_country ILIKE ? OR origin_country_code = ?)'
    queryParams.push(`%${originCountry}%`, originCountry)
  }
  
  if (result) {
    whereClause += ' AND declaration_result = ?'
    queryParams.push(result)
  }
  
  if (startDate) {
    whereClause += ' AND declaration_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND declaration_date <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM declaration_value_records WHERE ${whereClause}
  `).get(...queryParams)
  
  // 获取列表
  const rows = await db.prepare(`
    SELECT * FROM declaration_value_records 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams, pageSize, offset)
  
  return {
    list: (rows || []).map(row => ({
      id: row.id,
      hsCode: row.hs_code,
      productName: row.product_name,
      originCountry: row.origin_country,
      declaredUnitPrice: parseFloat(row.declared_unit_price) || 0,
      priceUnit: row.price_unit,
      declaredQuantity: parseFloat(row.declared_quantity) || 0,
      declaredTotalValue: parseFloat(row.declared_total_value) || 0,
      declarationResult: row.declaration_result,
      customsAdjustedPrice: parseFloat(row.customs_adjusted_price) || null,
      adjustmentReason: row.adjustment_reason,
      declarationDate: row.declaration_date,
      billNo: row.bill_no,
      importId: row.import_id,
      createdAt: row.created_at
    })),
    total: parseInt(countResult?.total) || 0,
    page,
    pageSize
  }
}

export default {
  recordDeclarationValue,
  updateDeclarationResult,
  batchUpdateDeclarationResult,
  getDeclarationStats,
  checkDeclarationRisk,
  batchCheckDeclarationRisk,
  createDeclarationRecordsFromImport,
  getDeclarationHistory
}

