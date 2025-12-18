/**
 * HS编码匹配引擎
 * 实现精确匹配、前缀匹配、历史学习匹配三级策略
 */

import { getDatabase } from '../../config/database.js'

// 匹配阈值配置
const MATCH_CONFIG = {
  AUTO_APPROVE_THRESHOLD: 90,  // 自动通过的置信度阈值
  EXACT_MATCH_CONFIDENCE: 100,  // 精确匹配置信度
  PREFIX_8_CONFIDENCE: 90,      // 8位前缀匹配置信度
  PREFIX_6_CONFIDENCE: 80,      // 6位前缀匹配置信度
  HISTORY_MATCH_CONFIDENCE: 85, // 历史匹配置信度
  FUZZY_MATCH_CONFIDENCE: 60    // 模糊匹配置信度
}

/**
 * 执行HS编码匹配
 */
export async function matchHsCode(item) {
  const { customerHsCode, productName, productNameEn, material } = item
  
  // 1. 如果有客户提供的HS编码，先尝试精确匹配
  if (customerHsCode) {
    const exactResult = await doExactMatch(customerHsCode)
    if (exactResult) {
      return {
        matchedHsCode: exactResult.hsCode,
        matchConfidence: MATCH_CONFIG.EXACT_MATCH_CONFIDENCE,
        matchSource: 'exact',
        tariffData: exactResult
      }
    }
    
    // 2. 尝试前缀匹配 (8位)
    const prefix8 = customerHsCode.substring(0, 8)
    const prefix8Match = await doPrefixMatch(prefix8)
    if (prefix8Match) {
      return {
        matchedHsCode: prefix8Match.hsCode,
        matchConfidence: MATCH_CONFIG.PREFIX_8_CONFIDENCE,
        matchSource: 'prefix_8',
        tariffData: prefix8Match
      }
    }
    
    // 3. 尝试前缀匹配 (6位)
    const prefix6 = customerHsCode.substring(0, 6)
    const prefix6Match = await doPrefixMatch(prefix6)
    if (prefix6Match) {
      return {
        matchedHsCode: prefix6Match.hsCode,
        matchConfidence: MATCH_CONFIG.PREFIX_6_CONFIDENCE,
        matchSource: 'prefix_6',
        tariffData: prefix6Match
      }
    }
  }
  
  // 4. 尝试历史学习匹配
  const historyMatch = await matchFromHistory(productName, productNameEn, material)
  if (historyMatch) {
    const tariffData = await doExactMatch(historyMatch.matched_hs_code)
    return {
      matchedHsCode: historyMatch.matched_hs_code,
      matchConfidence: Math.min(MATCH_CONFIG.HISTORY_MATCH_CONFIDENCE, 70 + historyMatch.match_count * 5),
      matchSource: 'history',
      tariffData: tariffData
    }
  }
  
  // 5. 尝试模糊匹配 (基于商品名称)
  if (productName) {
    const fuzzyMatch = await fuzzyMatchByName(productName)
    if (fuzzyMatch) {
      return {
        matchedHsCode: fuzzyMatch.hsCode,
        matchConfidence: MATCH_CONFIG.FUZZY_MATCH_CONFIDENCE,
        matchSource: 'fuzzy',
        tariffData: fuzzyMatch
      }
    }
  }
  
  // 未匹配到
  return {
    matchedHsCode: null,
    matchConfidence: 0,
    matchSource: null,
    tariffData: null
  }
}

/**
 * 精确匹配HS编码
 */
async function doExactMatch(hsCode) {
  const db = getDatabase()
  const row = await db.prepare(`
    SELECT 
      hs_code, goods_description, goods_description_cn, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name
    FROM tariff_rates 
    WHERE hs_code = ?
    LIMIT 1
  `).get(hsCode.trim())
  
  if (row) {
    return convertTariffRow(row)
  }
  return null
}

/**
 * 前缀匹配HS编码
 */
async function doPrefixMatch(prefix) {
  const db = getDatabase()
  const row = await db.prepare(`
    SELECT 
      hs_code, goods_description, goods_description_cn, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name
    FROM tariff_rates 
    WHERE hs_code LIKE ?
    ORDER BY hs_code ASC
    LIMIT 1
  `).get(prefix + '%')
  
  if (row) {
    return convertTariffRow(row)
  }
  return null
}

/**
 * 从历史匹配记录中查找
 */
async function matchFromHistory(productName, productNameEn, material) {
  const db = getDatabase()
  
  // 首先尝试精确匹配商品名+材质
  let row = await db.prepare(`
    SELECT matched_hs_code, match_count
    FROM hs_match_history 
    WHERE product_name = ? 
      AND (material = ? OR (material IS NULL AND ? IS NULL))
    ORDER BY match_count DESC
    LIMIT 1
  `).get(productName, material || null, material || null)
  
  if (row) {
    return row
  }
  
  // 然后尝试只匹配商品名
  row = await db.prepare(`
    SELECT matched_hs_code, match_count
    FROM hs_match_history 
    WHERE product_name = ?
    ORDER BY match_count DESC
    LIMIT 1
  `).get(productName)
  
  return row || null
}

/**
 * 基于商品名称的模糊匹配
 */
async function fuzzyMatchByName(productName) {
  const db = getDatabase()
  
  // 使用ILIKE进行模糊匹配
  const row = await db.prepare(`
    SELECT 
      hs_code, goods_description, goods_description_cn, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name
    FROM tariff_rates 
    WHERE goods_description_cn ILIKE ? OR goods_description ILIKE ?
    ORDER BY LENGTH(COALESCE(goods_description_cn, '')) ASC
    LIMIT 1
  `).get(`%${productName}%`, `%${productName}%`)
  
  if (row) {
    return convertTariffRow(row)
  }
  return null
}

/**
 * 转换税率行数据
 */
function convertTariffRow(row) {
  return {
    hsCode: row.hs_code,
    productName: row.goods_description_cn || row.goods_description,
    productNameEn: row.goods_description,
    material: row.material,
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    unitCode: row.unit_code,
    unitName: row.unit_name
  }
}

/**
 * 批量执行HS匹配
 */
export async function batchMatchHsCodes(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取待匹配的货物
  const items = await db.prepare(`
    SELECT id, product_name, product_name_en, customer_hs_code, material
    FROM cargo_items 
    WHERE import_id = ? AND match_status = 'pending'
  `).all(importId)
  
  let matchedCount = 0
  let reviewCount = 0
  
  for (const item of (items || [])) {
    const matchResult = await matchHsCode({
      customerHsCode: item.customer_hs_code,
      productName: item.product_name,
      productNameEn: item.product_name_en,
      material: item.material
    })
    
    let status = 'review'
    if (matchResult.matchConfidence >= MATCH_CONFIG.AUTO_APPROVE_THRESHOLD) {
      status = 'auto_approved'
      matchedCount++
    } else if (matchResult.matchConfidence > 0) {
      status = 'review'
      reviewCount++
    } else {
      status = 'no_match'
      reviewCount++
    }
    
    // 更新货物明细
    await db.prepare(`
      UPDATE cargo_items SET
        matched_hs_code = ?,
        match_confidence = ?,
        match_source = ?,
        duty_rate = ?,
        vat_rate = ?,
        anti_dumping_rate = ?,
        countervailing_rate = ?,
        match_status = ?
      WHERE id = ?
    `).run(
      matchResult.matchedHsCode,
      matchResult.matchConfidence,
      matchResult.matchSource,
      matchResult.tariffData?.dutyRate || 0,
      matchResult.tariffData?.vatRate || 19,
      matchResult.tariffData?.antiDumpingRate || 0,
      matchResult.tariffData?.countervailingRate || 0,
      status,
      item.id
    )
  }
  
  // 更新导入批次状态
  await db.prepare(`
    UPDATE cargo_imports SET
      matched_items = matched_items + ?,
      pending_items = ?,
      status = 'reviewing',
      updated_at = ?
    WHERE id = ?
  `).run(matchedCount, reviewCount, now, importId)
  
  return {
    total: (items || []).length,
    matched: matchedCount,
    review: reviewCount
  }
}

/**
 * 人工审核确认匹配
 */
export async function approveMatch(itemId, hsCode, reviewNote, reviewedBy) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取税率信息
  const tariffData = await doExactMatch(hsCode)
  
  // 更新货物明细
  await db.prepare(`
    UPDATE cargo_items SET
      matched_hs_code = ?,
      match_confidence = 100,
      match_source = 'manual',
      duty_rate = ?,
      vat_rate = ?,
      anti_dumping_rate = ?,
      countervailing_rate = ?,
      match_status = 'approved',
      review_note = ?,
      reviewed_by = ?,
      reviewed_at = ?
    WHERE id = ?
  `).run(
    hsCode,
    tariffData?.dutyRate || 0,
    tariffData?.vatRate || 19,
    tariffData?.antiDumpingRate || 0,
    tariffData?.countervailingRate || 0,
    reviewNote || null,
    reviewedBy || null,
    now,
    itemId
  )
  
  // 获取货物信息并更新历史匹配记录
  const item = await db.prepare(`
    SELECT product_name, product_name_en, material
    FROM cargo_items WHERE id = ?
  `).get(itemId)
  
  if (item) {
    await updateMatchHistory(item.product_name, item.product_name_en, item.material, hsCode)
  }
  
  return true
}

/**
 * 批量审核
 */
export async function batchApprove(itemIds, action, reviewNote, reviewedBy) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  let status = 'approved'
  if (action === 'reject') {
    status = 'rejected'
  }
  
  for (const itemId of itemIds) {
    await db.prepare(`
      UPDATE cargo_items SET
        match_status = ?,
        review_note = ?,
        reviewed_by = ?,
        reviewed_at = ?
      WHERE id = ?
    `).run(status, reviewNote, reviewedBy, now, itemId)
    
    // 如果是批准，更新历史匹配记录
    if (status === 'approved') {
      const item = await db.prepare(`
        SELECT product_name, product_name_en, material, matched_hs_code
        FROM cargo_items WHERE id = ?
      `).get(itemId)
      
      if (item && item.matched_hs_code) {
        await updateMatchHistory(item.product_name, item.product_name_en, item.material, item.matched_hs_code)
      }
    }
  }
  
  return { updatedCount: itemIds.length }
}

/**
 * 更新历史匹配记录
 */
export async function updateMatchHistory(productName, productNameEn, material, hsCode) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 检查是否存在
  const existing = await db.prepare(`
    SELECT id FROM hs_match_history 
    WHERE product_name = ? AND (material = ? OR (material IS NULL AND ? IS NULL))
  `).get(productName, material || null, material || null)
  
  if (existing) {
    // 更新现有记录
    await db.prepare(`
      UPDATE hs_match_history SET
        match_count = match_count + 1,
        last_matched_at = ?
      WHERE id = ?
    `).run(now, existing.id)
  } else {
    // 插入新记录
    await db.prepare(`
      INSERT INTO hs_match_history (product_name, product_name_en, material, matched_hs_code, match_count, last_matched_at, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(productName, productNameEn, material, hsCode, now, now)
  }
}

/**
 * 获取待审核列表
 */
export async function getReviewItems(importId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20 } = params
  
  const offset = (page - 1) * pageSize
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total 
    FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('review', 'no_match')
  `).get(importId)
  
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('review', 'no_match')
    ORDER BY match_confidence DESC, item_no ASC
    LIMIT ? OFFSET ?
  `).all(importId, pageSize, offset)
  
  return {
    list: (rows || []).map(row => ({
      id: row.id,
      importId: row.import_id,
      itemNo: row.item_no,
      productName: row.product_name,
      productNameEn: row.product_name_en,
      customerHsCode: row.customer_hs_code,
      matchedHsCode: row.matched_hs_code,
      matchConfidence: parseFloat(row.match_confidence) || 0,
      matchSource: row.match_source,
      quantity: parseFloat(row.quantity) || 0,
      unitName: row.unit_name,
      totalValue: parseFloat(row.total_value) || 0,
      originCountry: row.origin_country,
      material: row.material,
      matchStatus: row.match_status
    })),
    total: parseInt(countResult?.total) || 0,
    page,
    pageSize
  }
}

export default {
  MATCH_CONFIG,
  matchHsCode,
  batchMatchHsCodes,
  approveMatch,
  batchApprove,
  updateMatchHistory,
  getReviewItems
}
