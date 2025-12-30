/**
 * 查验风险预警模块
 * 记录查验历史，统计查验率，提供风险预警
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
 * 记录查验信息
 * @param {Object} data - 查验数据
 */
export async function recordInspection(data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const {
    hsCode,
    productName,
    productNameEn,
    originCountry,
    originCountryCode,
    containerNo,
    billNo,
    inspectionType,  // none/document/physical/scan/full
    inspectionResult, // passed/failed/pending/released
    inspectionDate,
    inspectionNotes,
    customsOffice,
    inspectorName,
    penaltyAmount,
    delayDays,
    importId,
    itemId,
    createdBy
  } = data
  
  const result = await db.prepare(`
    INSERT INTO inspection_records (
      hs_code, product_name, product_name_en, origin_country, origin_country_code,
      container_no, bill_no, inspection_type, inspection_result, inspection_date,
      inspection_notes, customs_office, inspector_name, penalty_amount, delay_days,
      import_id, item_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    normalizeHsCode(hsCode),
    productName,
    productNameEn,
    originCountry,
    originCountryCode,
    containerNo,
    billNo,
    inspectionType || 'none',
    inspectionResult || 'pending',
    inspectionDate || now.split('T')[0],
    inspectionNotes,
    customsOffice,
    inspectorName,
    penaltyAmount || 0,
    delayDays || 0,
    importId,
    itemId,
    createdBy,
    now,
    now
  )
  
  return result?.id
}

/**
 * 更新查验结果
 * @param {number} recordId - 记录ID
 * @param {Object} updates - 更新数据
 */
export async function updateInspectionResult(recordId, updates) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const {
    inspectionType,
    inspectionResult,
    inspectionNotes,
    penaltyAmount,
    delayDays
  } = updates
  
  await db.prepare(`
    UPDATE inspection_records SET
      inspection_type = COALESCE(?, inspection_type),
      inspection_result = COALESCE(?, inspection_result),
      inspection_notes = COALESCE(?, inspection_notes),
      penalty_amount = COALESCE(?, penalty_amount),
      delay_days = COALESCE(?, delay_days),
      updated_at = ?
    WHERE id = ?
  `).run(
    inspectionType,
    inspectionResult,
    inspectionNotes,
    penaltyAmount,
    delayDays,
    now,
    recordId
  )
  
  return true
}

/**
 * 获取HS编码的查验率统计
 * @param {string} hsCode - HS编码
 * @param {string} originCountry - 原产国（可选）
 */
export async function getInspectionStats(hsCode, originCountry = null) {
  const db = getDatabase()
  const normalizedHsCode = normalizeHsCode(hsCode)
  
  let query = `
    SELECT 
      hs_code,
      origin_country,
      COUNT(*) as total_shipments,
      COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) as inspected_count,
      COUNT(CASE WHEN inspection_type = 'physical' OR inspection_type = 'full' THEN 1 END) as physical_count,
      COUNT(CASE WHEN inspection_type = 'document' THEN 1 END) as document_count,
      COUNT(CASE WHEN inspection_type = 'scan' THEN 1 END) as scan_count,
      COUNT(CASE WHEN inspection_result = 'passed' THEN 1 END) as passed_count,
      COUNT(CASE WHEN inspection_result = 'failed' THEN 1 END) as failed_count,
      SUM(COALESCE(penalty_amount, 0)) as total_penalty,
      AVG(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN delay_days END) as avg_delay_days,
      MAX(delay_days) as max_delay_days
    FROM inspection_records
    WHERE hs_code = ?
  `
  const params = [normalizedHsCode]
  
  if (originCountry) {
    query += ` AND (origin_country ILIKE ? OR origin_country_code = ?)`
    params.push(`%${originCountry}%`, originCountry)
  }
  
  query += ` GROUP BY hs_code, origin_country`
  
  const rows = await db.prepare(query).all(...params)
  
  if (!rows || rows.length === 0) {
    return {
      found: false,
      hsCode: normalizedHsCode,
      message: '暂无该HS编码的查验记录'
    }
  }
  
  const stats = rows[0]
  const totalShipments = parseInt(stats.total_shipments) || 0
  const inspectedCount = parseInt(stats.inspected_count) || 0
  const physicalCount = parseInt(stats.physical_count) || 0
  
  // 计算查验率
  const inspectionRate = totalShipments > 0 
    ? Math.round(inspectedCount * 100 / totalShipments) 
    : 0
  
  const physicalRate = totalShipments > 0 
    ? Math.round(physicalCount * 100 / totalShipments) 
    : 0
  
  // 判断风险等级
  let riskLevel = 'low'
  if (inspectionRate >= 30 || physicalRate >= 20) {
    riskLevel = 'high'
  } else if (inspectionRate >= 15 || physicalRate >= 10) {
    riskLevel = 'medium'
  }
  
  return {
    found: true,
    hsCode: normalizedHsCode,
    originCountry: stats.origin_country,
    stats: {
      totalShipments,
      inspectedCount,
      physicalCount,
      documentCount: parseInt(stats.document_count) || 0,
      scanCount: parseInt(stats.scan_count) || 0,
      passedCount: parseInt(stats.passed_count) || 0,
      failedCount: parseInt(stats.failed_count) || 0,
      inspectionRate,
      physicalRate,
      totalPenalty: Math.round(parseFloat(stats.total_penalty) * 100) / 100 || 0,
      avgDelayDays: Math.round(parseFloat(stats.avg_delay_days) * 10) / 10 || 0,
      maxDelayDays: parseInt(stats.max_delay_days) || 0
    },
    riskLevel,
    isHighRisk: riskLevel === 'high'
  }
}

/**
 * 获取高查验率HS编码列表
 * @param {string} originCountry - 原产国筛选
 * @param {number} minRate - 最低查验率阈值
 */
export async function getHighInspectionRateCodes(originCountry = null, minRate = 15) {
  const db = getDatabase()
  
  let query = `
    SELECT 
      hs_code,
      origin_country,
      COUNT(*) as total_shipments,
      COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) as inspected_count,
      COUNT(CASE WHEN inspection_type = 'physical' OR inspection_type = 'full' THEN 1 END) as physical_count,
      ROUND(
        COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(*), 0), 
        1
      ) as inspection_rate,
      AVG(delay_days) FILTER (WHERE inspection_type IS NOT NULL AND inspection_type != 'none') as avg_delay
    FROM inspection_records
    WHERE 1=1
  `
  const params = []
  
  if (originCountry) {
    query += ` AND (origin_country ILIKE ? OR origin_country_code = ?)`
    params.push(`%${originCountry}%`, originCountry)
  }
  
  query += `
    GROUP BY hs_code, origin_country
    HAVING COUNT(*) >= 3
      AND (COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) >= ?
    ORDER BY inspection_rate DESC
    LIMIT 100
  `
  params.push(minRate)
  
  const rows = await db.prepare(query).all(...params)
  
  // 获取产品名称
  const results = []
  for (const row of (rows || [])) {
    // 查询商品名称
    const tariff = await db.prepare(`
      SELECT goods_description_cn, goods_description 
      FROM tariff_rates WHERE hs_code = ? LIMIT 1
    `).get(row.hs_code)
    
    results.push({
      hsCode: row.hs_code,
      productName: tariff?.goods_description_cn || tariff?.goods_description || '',
      originCountry: row.origin_country,
      totalShipments: parseInt(row.total_shipments) || 0,
      inspectedCount: parseInt(row.inspected_count) || 0,
      physicalCount: parseInt(row.physical_count) || 0,
      inspectionRate: parseFloat(row.inspection_rate) || 0,
      avgDelay: Math.round(parseFloat(row.avg_delay) * 10) / 10 || 0,
      riskLevel: parseFloat(row.inspection_rate) >= 30 ? 'high' : 'medium'
    })
  }
  
  return results
}

/**
 * 分析导入批次的查验风险
 * @param {number} importId - 导入批次ID
 */
export async function analyzeImportInspectionRisk(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取货物明细
  const items = await db.prepare(`
    SELECT 
      id, matched_hs_code, product_name, origin_country,
      quantity, total_value
    FROM cargo_items 
    WHERE import_id = ? AND matched_hs_code IS NOT NULL
  `).all(importId)
  
  const riskItems = []
  let highRiskCount = 0
  let mediumRiskCount = 0
  let lowRiskCount = 0
  let totalRiskScore = 0
  
  for (const item of (items || [])) {
    const stats = await getInspectionStats(item.matched_hs_code, item.origin_country)
    
    let itemRiskLevel = 'low'
    let itemRiskScore = 10
    
    if (stats.found) {
      itemRiskLevel = stats.riskLevel
      
      // 计算风险分数
      if (stats.riskLevel === 'high') {
        itemRiskScore = 80 + Math.min(20, stats.stats.inspectionRate - 30)
        highRiskCount++
        riskItems.push({
          itemId: item.id,
          hsCode: item.matched_hs_code,
          productName: item.product_name,
          originCountry: item.origin_country,
          riskLevel: 'high',
          inspectionRate: stats.stats.inspectionRate,
          physicalRate: stats.stats.physicalRate,
          avgDelayDays: stats.stats.avgDelayDays,
          historicalShipments: stats.stats.totalShipments
        })
      } else if (stats.riskLevel === 'medium') {
        itemRiskScore = 40 + stats.stats.inspectionRate
        mediumRiskCount++
        riskItems.push({
          itemId: item.id,
          hsCode: item.matched_hs_code,
          productName: item.product_name,
          originCountry: item.origin_country,
          riskLevel: 'medium',
          inspectionRate: stats.stats.inspectionRate,
          physicalRate: stats.stats.physicalRate,
          avgDelayDays: stats.stats.avgDelayDays,
          historicalShipments: stats.stats.totalShipments
        })
      } else {
        lowRiskCount++
        itemRiskScore = Math.max(10, stats.stats.inspectionRate)
      }
    } else {
      // 无历史数据，给一个中等的默认风险分
      itemRiskScore = 20
      lowRiskCount++
    }
    
    totalRiskScore += itemRiskScore
    
    // 更新货物明细的查验风险
    await db.prepare(`
      UPDATE cargo_items SET inspection_risk = ? WHERE id = ?
    `).run(itemRiskLevel, item.id)
  }
  
  // 计算整体风险评分 (0-100)
  const totalItems = (items || []).length
  const avgRiskScore = totalItems > 0 ? Math.round(totalRiskScore / totalItems) : 0
  
  // 确定整体风险等级
  let overallRiskLevel = 'low'
  if (highRiskCount > 0 || avgRiskScore >= 60) {
    overallRiskLevel = 'high'
  } else if (mediumRiskCount > 0 || avgRiskScore >= 30) {
    overallRiskLevel = 'medium'
  }
  
  // 生成风险警告
  const warnings = []
  if (highRiskCount > 0) {
    warnings.push(`包含 ${highRiskCount} 个高查验率商品`)
  }
  if (mediumRiskCount > 0) {
    warnings.push(`包含 ${mediumRiskCount} 个中等查验率商品`)
  }
  if (riskItems.some(r => r.avgDelayDays > 3)) {
    warnings.push('部分商品历史查验延误较长')
  }
  
  // 更新导入批次的查验风险评估
  await db.prepare(`
    UPDATE cargo_imports SET
      risk_score = GREATEST(COALESCE(risk_score, 0), ?),
      risk_level = CASE 
        WHEN ? = 'high' OR risk_level = 'high' THEN 'high'
        WHEN ? = 'medium' OR risk_level = 'medium' THEN 'medium'
        ELSE 'low'
      END,
      risk_analyzed_at = ?,
      risk_notes = COALESCE(risk_notes, '') || ' | 查验风险: ' || ?
    WHERE id = ?
  `).run(
    avgRiskScore,
    overallRiskLevel,
    overallRiskLevel,
    now,
    warnings.join(', '),
    importId
  )
  
  return {
    importId,
    totalItems,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    avgRiskScore,
    overallRiskLevel,
    riskItems: riskItems.sort((a, b) => b.inspectionRate - a.inspectionRate),
    warnings,
    needsAttention: overallRiskLevel !== 'low',
    analyzedAt: now
  }
}

/**
 * 从导入批次批量创建查验记录（无查验）
 * @param {number} importId - 导入批次ID
 * @param {string} containerNo - 集装箱号
 * @param {string} billNo - 提单号
 * @param {number} createdBy - 创建人ID
 */
export async function createInspectionRecordsFromImport(importId, containerNo, billNo, createdBy) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取货物明细
  const items = await db.prepare(`
    SELECT 
      id, matched_hs_code, product_name, product_name_en,
      origin_country, origin_country_code
    FROM cargo_items 
    WHERE import_id = ? AND matched_hs_code IS NOT NULL
  `).all(importId)
  
  let createdCount = 0
  
  for (const item of (items || [])) {
    await db.prepare(`
      INSERT INTO inspection_records (
        hs_code, product_name, product_name_en, origin_country, origin_country_code,
        container_no, bill_no, inspection_type, inspection_result, inspection_date,
        import_id, item_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'none', 'released', ?, ?, ?, ?, ?, ?)
    `).run(
      normalizeHsCode(item.matched_hs_code),
      item.product_name,
      item.product_name_en,
      item.origin_country,
      item.origin_country_code,
      containerNo,
      billNo,
      now.split('T')[0],
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
 * 获取查验记录列表
 * @param {Object} params - 查询参数
 */
export async function getInspectionHistory(params = {}) {
  const db = getDatabase()
  const { 
    hsCode, originCountry, inspectionType, inspectionResult, 
    containerNo, startDate, endDate, page = 1, pageSize = 20 
  } = params
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
  
  if (inspectionType) {
    whereClause += ' AND inspection_type = ?'
    queryParams.push(inspectionType)
  }
  
  if (inspectionResult) {
    whereClause += ' AND inspection_result = ?'
    queryParams.push(inspectionResult)
  }
  
  if (containerNo) {
    whereClause += ' AND container_no ILIKE ?'
    queryParams.push(`%${containerNo}%`)
  }
  
  if (startDate) {
    whereClause += ' AND inspection_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    whereClause += ' AND inspection_date <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM inspection_records WHERE ${whereClause}
  `).get(...queryParams)
  
  // 获取列表
  const rows = await db.prepare(`
    SELECT * FROM inspection_records 
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
      containerNo: row.container_no,
      billNo: row.bill_no,
      inspectionType: row.inspection_type,
      inspectionResult: row.inspection_result,
      inspectionDate: row.inspection_date,
      inspectionNotes: row.inspection_notes,
      customsOffice: row.customs_office,
      penaltyAmount: parseFloat(row.penalty_amount) || 0,
      delayDays: parseInt(row.delay_days) || 0,
      importId: row.import_id,
      createdAt: row.created_at
    })),
    total: parseInt(countResult?.total) || 0,
    page,
    pageSize
  }
}

/**
 * 获取查验类型统计
 */
export async function getInspectionTypeSummary() {
  const db = getDatabase()
  
  const rows = await db.prepare(`
    SELECT 
      inspection_type,
      COUNT(*) as count,
      AVG(delay_days) as avg_delay,
      SUM(COALESCE(penalty_amount, 0)) as total_penalty
    FROM inspection_records
    WHERE inspection_type IS NOT NULL
    GROUP BY inspection_type
    ORDER BY count DESC
  `).all()
  
  return (rows || []).map(row => ({
    type: row.inspection_type,
    typeName: getInspectionTypeName(row.inspection_type),
    count: parseInt(row.count) || 0,
    avgDelay: Math.round(parseFloat(row.avg_delay) * 10) / 10 || 0,
    totalPenalty: Math.round(parseFloat(row.total_penalty) * 100) / 100 || 0
  }))
}

/**
 * 获取查验类型中文名称
 */
function getInspectionTypeName(type) {
  const typeMap = {
    'none': '未查验',
    'document': '单证查验',
    'physical': '实物查验',
    'scan': '扫描查验',
    'full': '全面查验'
  }
  return typeMap[type] || type
}

export default {
  recordInspection,
  updateInspectionResult,
  getInspectionStats,
  getHighInspectionRateCodes,
  analyzeImportInspectionRisk,
  createInspectionRecordsFromImport,
  getInspectionHistory,
  getInspectionTypeSummary
}

