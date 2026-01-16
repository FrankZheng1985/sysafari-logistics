/**
 * HS编码匹配引擎
 * 实现精确匹配、前缀匹配、历史学习匹配三级策略
 */

import { getDatabase } from '../../config/database.js'

// 匹配阈值配置
const MATCH_CONFIG = {
  AUTO_APPROVE_THRESHOLD: 100,  // 自动通过的置信度阈值（只有100%精确匹配才自动通过）
  EXACT_MATCH_CONFIDENCE: 100,  // 精确匹配置信度
  PREFIX_8_CONFIDENCE: 90,      // 8位前缀匹配置信度
  PREFIX_6_CONFIDENCE: 80,      // 6位前缀匹配置信度
  HISTORY_MATCH_CONFIDENCE: 85, // 历史匹配置信度
  FUZZY_MATCH_CONFIDENCE: 60    // 模糊匹配置信度
}

/**
 * 执行HS编码匹配
 * @param {Object} item - 商品信息
 * @param {string} item.customerHsCode - 客户提供的HS编码
 * @param {string} item.productName - 商品名称
 * @param {string} item.productNameEn - 英文名称
 * @param {string} item.material - 材质
 * @param {string} item.originCountry - 原产国代码（如 CN），用于查询正确的关税税率
 */
export async function matchHsCode(item) {
  const { customerHsCode, productName, productNameEn, material, originCountry = 'CN' } = item
  
  // 1. 如果有客户提供的HS编码，先尝试精确匹配
  if (customerHsCode) {
    const exactResult = await doExactMatch(customerHsCode, originCountry)
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
    const prefix8Match = await doPrefixMatch(prefix8, originCountry)
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
    const prefix6Match = await doPrefixMatch(prefix6, originCountry)
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
    // 规范化历史记录中的 HS 编码为 10 位
    const normalizedHsCode = normalizeHsCode(historyMatch.matched_hs_code)
    const tariffData = await doExactMatch(normalizedHsCode, originCountry)
    return {
      matchedHsCode: normalizedHsCode,
      matchConfidence: Math.min(MATCH_CONFIG.HISTORY_MATCH_CONFIDENCE, 70 + historyMatch.match_count * 5),
      matchSource: 'history',
      tariffData: tariffData
    }
  }
  
  // 5. 尝试模糊匹配 (基于商品名称和材质)
  if (productName) {
    const fuzzyMatch = await fuzzyMatchByName(productName, originCountry, material)
    if (fuzzyMatch) {
      // 如果匹配时使用了材质信息，提高置信度
      const confidence = material && fuzzyMatch.material 
        ? Math.min(MATCH_CONFIG.FUZZY_MATCH_CONFIDENCE + 10, 65)  // 材质匹配提高置信度
        : MATCH_CONFIG.FUZZY_MATCH_CONFIDENCE
      return {
        matchedHsCode: fuzzyMatch.hsCode,
        matchConfidence: confidence,
        matchSource: material ? 'fuzzy_material' : 'fuzzy',
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

// 常见中文国家名到ISO代码的映射
const COUNTRY_NAME_TO_CODE = {
  '中国': 'CN',
  '美国': 'US',
  '德国': 'DE',
  '日本': 'JP',
  '韩国': 'KR',
  '英国': 'GB',
  '法国': 'FR',
  '意大利': 'IT',
  '西班牙': 'ES',
  '越南': 'VN',
  '印度': 'IN',
  '泰国': 'TH',
  '马来西亚': 'MY',
  '印度尼西亚': 'ID',
  '台湾': 'TW',
  '香港': 'HK',
}

/**
 * 将原产国名称转换为ISO代码
 */
function normalizeCountryCode(country) {
  if (!country) return 'CN'
  const trimmed = country.trim()
  // 如果已经是2位代码，直接返回
  if (/^[A-Z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }
  // 查找中文名称映射
  return COUNTRY_NAME_TO_CODE[trimmed] || trimmed
}

/**
 * 精确匹配HS编码
 * @param {string} hsCode - HS编码
 * @param {string} originCountry - 原产国代码或名称，用于查询特定税率（如反倾销税）
 */
async function doExactMatch(hsCode, originCountry = 'CN') {
  const db = getDatabase()
  
  // 规范化原产国代码（支持中文名称转换为ISO代码）
  originCountry = normalizeCountryCode(originCountry)
  
  // 首先尝试匹配特定原产国的税率（可能包含反倾销税等）
  let row = await db.prepare(`
    SELECT 
      hs_code, goods_description, goods_description_cn, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name, origin_country_code
    FROM tariff_rates 
    WHERE hs_code = ?
      AND origin_country_code = ?
      AND is_active = 1
    ORDER BY anti_dumping_rate DESC, duty_rate DESC
    LIMIT 1
  `).get(hsCode.trim(), originCountry)
  
  // 如果没有特定原产国的税率，查找通用税率
  if (!row) {
    row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE hs_code = ?
        AND (origin_country_code IS NULL OR origin_country_code = '' OR origin_country_code = 'ERGA_OMNES')
        AND is_active = 1
      LIMIT 1
    `).get(hsCode.trim())
  }
  
  // 最后回退到基础查询
  if (!row) {
    row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE hs_code = ?
      LIMIT 1
    `).get(hsCode.trim())
  }
  
  if (row) {
    return convertTariffRow(row)
  }
  return null
}

/**
 * 前缀匹配HS编码
 * @param {string} prefix - HS编码前缀
 * @param {string} originCountry - 原产国代码，用于查询特定税率
 */
async function doPrefixMatch(prefix, originCountry = 'CN') {
  const db = getDatabase()
  
  // 首先尝试匹配特定原产国的税率
  let row = await db.prepare(`
    SELECT 
      hs_code, goods_description, goods_description_cn, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name, origin_country_code
    FROM tariff_rates 
    WHERE hs_code LIKE ?
      AND origin_country_code = ?
      AND is_active = 1
    ORDER BY anti_dumping_rate DESC, hs_code ASC
    LIMIT 1
  `).get(prefix + '%', originCountry)
  
  // 如果没有特定原产国的税率，查找通用税率
  if (!row) {
    row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE hs_code LIKE ?
        AND (origin_country_code IS NULL OR origin_country_code = '' OR origin_country_code = 'ERGA_OMNES')
        AND is_active = 1
      ORDER BY hs_code ASC
      LIMIT 1
    `).get(prefix + '%')
  }
  
  // 最后回退到基础查询
  if (!row) {
    row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE hs_code LIKE ?
      ORDER BY hs_code ASC
      LIMIT 1
    `).get(prefix + '%')
  }
  
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
  // 使用 IS NOT DISTINCT FROM 来正确处理 NULL 值比较（PostgreSQL 兼容）
  let row = await db.prepare(`
    SELECT matched_hs_code, match_count
    FROM hs_match_history 
    WHERE product_name = $1 
      AND material IS NOT DISTINCT FROM $2
    ORDER BY match_count DESC
    LIMIT 1
  `).get(productName, material || null)
  
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
 * 基于商品名称和材质的模糊匹配
 * @param {string} productName - 商品名称
 * @param {string} originCountry - 原产国代码，用于查询特定税率
 * @param {string} material - 材质信息
 */
async function fuzzyMatchByName(productName, originCountry = 'CN', material = null) {
  const db = getDatabase()
  
  // 如果有材质信息，优先基于材质匹配
  if (material) {
    // 1. 首先尝试 商品名+材质+原产国 匹配
    let row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE (goods_description_cn ILIKE ? OR goods_description ILIKE ?)
        AND (material ILIKE ? OR goods_description ILIKE ? OR goods_description_cn ILIKE ?)
        AND origin_country_code = ?
        AND is_active = 1
      ORDER BY 
        CASE WHEN material ILIKE ? THEN 0 ELSE 1 END,
        LENGTH(COALESCE(goods_description_cn, '')) ASC
      LIMIT 1
    `).get(
      `%${productName}%`, `%${productName}%`,
      `%${material}%`, `%${material}%`, `%${material}%`,
      originCountry,
      `%${material}%`
    )
    
    if (row) {
      return convertTariffRow(row)
    }
    
    // 2. 尝试 商品名+材质（无原产国限制）
    row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE (goods_description_cn ILIKE ? OR goods_description ILIKE ?)
        AND (material ILIKE ? OR goods_description ILIKE ? OR goods_description_cn ILIKE ?)
        AND is_active = 1
      ORDER BY 
        CASE WHEN material ILIKE ? THEN 0 ELSE 1 END,
        LENGTH(COALESCE(goods_description_cn, '')) ASC
      LIMIT 1
    `).get(
      `%${productName}%`, `%${productName}%`,
      `%${material}%`, `%${material}%`, `%${material}%`,
      `%${material}%`
    )
    
    if (row) {
      return convertTariffRow(row)
    }
  }
  
  // 3. 如果没有材质或材质匹配失败，回退到原逻辑
  // 首先尝试匹配特定原产国的税率
  let row = await db.prepare(`
    SELECT 
      hs_code, goods_description, goods_description_cn, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name, origin_country_code
    FROM tariff_rates 
    WHERE (goods_description_cn ILIKE ? OR goods_description ILIKE ?)
      AND origin_country_code = ?
      AND is_active = 1
    ORDER BY LENGTH(COALESCE(goods_description_cn, '')) ASC
    LIMIT 1
  `).get(`%${productName}%`, `%${productName}%`, originCountry)
  
  // 如果没有特定原产国的税率，查找通用税率
  if (!row) {
    row = await db.prepare(`
      SELECT 
        hs_code, goods_description, goods_description_cn, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        unit_code, unit_name, origin_country_code
      FROM tariff_rates 
      WHERE goods_description_cn ILIKE ? OR goods_description ILIKE ?
      ORDER BY LENGTH(COALESCE(goods_description_cn, '')) ASC
      LIMIT 1
    `).get(`%${productName}%`, `%${productName}%`)
  }
  
  if (row) {
    return convertTariffRow(row)
  }
  return null
}

/**
 * 规范化 HS 编码为 10 位（欧盟 TARIC 标准）
 * 如果编码少于 10 位，在末尾补 0
 */
function normalizeHsCode(hsCode) {
  if (!hsCode) return hsCode
  const cleaned = hsCode.replace(/[^0-9]/g, '')
  if (cleaned.length >= 10) return cleaned.substring(0, 10)
  return cleaned.padEnd(10, '0')
}

/**
 * 转换税率行数据
 */
function convertTariffRow(row) {
  return {
    hsCode: normalizeHsCode(row.hs_code),
    productName: row.goods_description_cn || row.goods_description,
    productNameEn: row.goods_description,
    material: row.material,
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    unitCode: row.unit_code,
    unitName: row.unit_name,
    originCountryCode: row.origin_country_code || ''
  }
}

/**
 * 批量执行HS匹配
 */
export async function batchMatchHsCodes(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取待匹配的货物（包含原产国信息）
  const items = await db.prepare(`
    SELECT id, product_name, product_name_en, customer_hs_code, material, origin_country
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
      material: item.material,
      originCountry: item.origin_country || 'CN'  // 默认使用 CN（中国）作为原产国
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
  
  // HS编码格式验证：必须是8-10位数字
  if (hsCode) {
    // 移除可能的空格
    hsCode = hsCode.trim()
    // 检查长度，如果超过10位则截取前10位
    if (hsCode.length > 10) {
      console.warn(`[HS编码验证] 编码过长(${hsCode.length}位)，截取前10位: ${hsCode} -> ${hsCode.slice(0, 10)}`)
      hsCode = hsCode.slice(0, 10)
    }
    // 检查是否为纯数字
    if (!/^\d{8,10}$/.test(hsCode)) {
      throw new Error(`HS编码格式错误：${hsCode}，必须是8-10位数字`)
    }
  }
  
  // 先获取商品的原产国信息
  const itemInfo = await db.prepare(`
    SELECT origin_country FROM cargo_items WHERE id = ?
  `).get(itemId)
  const originCountry = itemInfo?.origin_country || 'CN'
  
  // 根据原产国获取税率信息
  const tariffData = await doExactMatch(hsCode, originCountry)
  
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
    SELECT import_id, product_name, product_name_en, material
    FROM cargo_items WHERE id = ?
  `).get(itemId)
  
  if (item) {
    await updateMatchHistory(item.product_name, item.product_name_en, item.material, hsCode)
    // 更新导入批次的统计信息
    await updateImportStats(item.import_id)
  }
  
  return true
}

/**
 * 更新导入批次的统计信息
 */
async function updateImportStats(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 统计已匹配和待审核数量
  const stats = await db.prepare(`
    SELECT 
      COUNT(CASE WHEN match_status IN ('approved', 'auto_approved') THEN 1 END) as matched,
      COUNT(CASE WHEN match_status IN ('review', 'pending', 'no_match') THEN 1 END) as pending
    FROM cargo_items WHERE import_id = $1
  `).get(importId)
  
  // 更新批次统计
  await db.prepare(`
    UPDATE cargo_imports SET
      matched_items = $1,
      pending_items = $2,
      updated_at = $3
    WHERE id = $4
  `).run(stats?.matched || 0, stats?.pending || 0, now, importId)
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
  
  // 收集需要更新统计的批次ID
  const importIds = new Set()
  
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
        SELECT import_id, product_name, product_name_en, material, matched_hs_code
        FROM cargo_items WHERE id = ?
      `).get(itemId)
      
      if (item) {
        importIds.add(item.import_id)
        if (item.matched_hs_code) {
          await updateMatchHistory(item.product_name, item.product_name_en, item.material, item.matched_hs_code)
        }
      }
    } else {
      // 获取 import_id 用于更新统计
      const item = await db.prepare('SELECT import_id FROM cargo_items WHERE id = ?').get(itemId)
      if (item) {
        importIds.add(item.import_id)
      }
    }
  }
  
  // 更新所有相关批次的统计信息
  for (const importId of importIds) {
    await updateImportStats(importId)
  }
  
  return { updatedCount: itemIds.length }
}

/**
 * 更新历史匹配记录
 * 人工审核通过的结果会记录或更新到 hs_match_history 表
 * - 如果商品名+材质已存在，更新 HS 编码并增加匹配次数
 * - 如果不存在，插入新记录
 */
export async function updateMatchHistory(productName, productNameEn, material, hsCode) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 检查是否存在（基于商品名+材质）
  // 使用 IS NOT DISTINCT FROM 来正确处理 NULL 值比较（PostgreSQL 兼容）
  const existing = await db.prepare(`
    SELECT id, matched_hs_code FROM hs_match_history 
    WHERE product_name = $1 AND material IS NOT DISTINCT FROM $2
  `).get(productName, material || null)
  
  if (existing) {
    // 更新现有记录：更新 HS 编码、英文名、匹配次数
    // 人工审核的 HS 编码会覆盖之前的记录（以人工审核为准）
    await db.prepare(`
      UPDATE hs_match_history SET
        matched_hs_code = ?,
        product_name_en = COALESCE(?, product_name_en),
        match_count = match_count + 1,
        last_matched_at = ?
      WHERE id = ?
    `).run(hsCode, productNameEn, now, existing.id)
    
    // 如果 HS 编码发生变化，记录日志
    if (existing.matched_hs_code !== hsCode) {
      console.log(`[HS匹配记录更新] 商品: ${productName}, 材质: ${material || '无'}, HS编码: ${existing.matched_hs_code} -> ${hsCode}`)
    }
  } else {
    // 插入新记录
    await db.prepare(`
      INSERT INTO hs_match_history (product_name, product_name_en, material, matched_hs_code, match_count, last_matched_at, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(productName, productNameEn, material, hsCode, now, now)
    
    console.log(`[HS匹配记录新增] 商品: ${productName}, 材质: ${material || '无'}, HS编码: ${hsCode}`)
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
    WHERE import_id = ? AND match_status IN ('review', 'no_match', 'pending')
  `).get(importId)
  
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('review', 'no_match', 'pending')
    ORDER BY match_confidence DESC, item_no ASC
    LIMIT ? OFFSET ?
  `).all(importId, pageSize, offset)
  
  return {
    list: (rows || []).map(row => convertCargoItemRow(row)),
    total: parseInt(countResult?.total) || 0,
    page,
    pageSize
  }
}

/**
 * 获取已匹配列表（包括自动通过和人工审核通过的）
 */
export async function getMatchedItems(importId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20 } = params
  
  const offset = (page - 1) * pageSize
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total 
    FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('approved', 'auto_approved')
  `).get(importId)
  
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('approved', 'auto_approved')
    ORDER BY item_no ASC
    LIMIT ? OFFSET ?
  `).all(importId, pageSize, offset)
  
  return {
    list: (rows || []).map(row => convertCargoItemRow(row)),
    total: parseInt(countResult?.total) || 0,
    page,
    pageSize
  }
}

/**
 * 转换货物明细行数据
 */
function convertCargoItemRow(row) {
  return {
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
    unitPrice: parseFloat(row.unit_price) || 0,
    totalValue: parseFloat(row.total_value) || 0,
    originCountry: row.origin_country,
    material: row.material,
    materialEn: row.material_en,
    usageScenario: row.usage_scenario,
    matchStatus: row.match_status,
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by
  }
}

/**
 * 更新货物明细信息（原产地、材质、用途等）
 */
export async function updateCargoItemDetail(itemId, data) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const { 
    originCountry, 
    material, 
    materialEn, 
    usageScenario,
    productName,
    productNameEn,
    updateTariff = true
  } = data
  
  // 构建更新语句
  const updates = []
  const values = []
  
  if (originCountry !== undefined) {
    updates.push('origin_country = ?')
    values.push(originCountry)
  }
  if (material !== undefined) {
    updates.push('material = ?')
    values.push(material)
  }
  if (materialEn !== undefined) {
    updates.push('material_en = ?')
    values.push(materialEn)
  }
  if (usageScenario !== undefined) {
    updates.push('usage_scenario = ?')
    values.push(usageScenario)
  }
  if (productName !== undefined) {
    updates.push('product_name = ?')
    values.push(productName)
  }
  if (productNameEn !== undefined) {
    updates.push('product_name_en = ?')
    values.push(productNameEn)
  }
  
  if (updates.length === 0) {
    return { success: false, message: '没有需要更新的字段' }
  }
  
  updates.push('updated_at = ?')
  values.push(now)
  values.push(itemId)
  
  await db.prepare(
    `UPDATE cargo_items SET ${updates.join(', ')} WHERE id = ?`
  ).run(...values)
  
  // 如果更新了原产地且需要更新税率
  let tariffUpdated = false
  if (originCountry && updateTariff) {
    // 获取当前商品的HS编码
    const item = await db.prepare(
      'SELECT matched_hs_code, customer_hs_code FROM cargo_items WHERE id = ?'
    ).get(itemId)
    
    const hsCode = item?.matched_hs_code || item?.customer_hs_code
    if (hsCode) {
      // 根据新原产地获取税率
      const tariffData = await doExactMatch(hsCode, originCountry)
      if (tariffData) {
        await db.prepare(`
          UPDATE cargo_items SET
            duty_rate = ?,
            vat_rate = ?,
            anti_dumping_rate = ?,
            countervailing_rate = ?
          WHERE id = ?
        `).run(
          tariffData.dutyRate,
          tariffData.vatRate,
          tariffData.antiDumpingRate,
          tariffData.countervailingRate,
          itemId
        )
        tariffUpdated = true
      }
    }
  }
  
  return { 
    success: true, 
    tariffUpdated,
    message: tariffUpdated ? '商品信息和税率已更新' : '商品信息已更新'
  }
}

/**
 * 获取导入批次的匹配统计（整票货物统计，不区分匹配状态）
 */
export async function getMatchingStats(importId) {
  const db = getDatabase()
  
  // 整票统计：统计整个批次的所有商品，不区分匹配状态
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN match_status IN ('approved', 'auto_approved') THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN match_status IN ('review', 'no_match', 'pending') THEN 1 ELSE 0 END) as unmatched,
      SUM(CASE WHEN origin_country IS NULL OR origin_country = '' THEN 1 ELSE 0 END) as missingOrigin,
      SUM(CASE WHEN material IS NULL OR material = '' THEN 1 ELSE 0 END) as missingMaterial,
      SUM(COALESCE(total_value, 0)) as totalValue,
      SUM(COALESCE(duty_amount, 0)) as totalDuty,
      SUM(COALESCE(vat_amount, 0)) as totalVat,
      SUM(COALESCE(other_tax_amount, 0)) as totalOtherTax,
      SUM(COALESCE(total_tax, 0)) as totalTax
    FROM cargo_items 
    WHERE import_id = ?
  `).get(importId)
  
  // 唯一品名数量（整票）
  const productNameCount = await db.prepare(`
    SELECT COUNT(DISTINCT product_name) as count
    FROM cargo_items 
    WHERE import_id = ? AND product_name IS NOT NULL AND product_name != ''
  `).get(importId)
  
  // 唯一HS Code数量（整票，包括客户HS和匹配后的HS）
  const hsCodeCount = await db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(matched_hs_code, customer_hs_code)) as count
    FROM cargo_items 
    WHERE import_id = ? 
      AND (matched_hs_code IS NOT NULL AND matched_hs_code != '' 
           OR customer_hs_code IS NOT NULL AND customer_hs_code != '')
  `).get(importId)
  
  return {
    total: parseInt(stats?.total) || 0,
    matched: parseInt(stats?.matched) || 0,
    unmatched: parseInt(stats?.unmatched) || 0,
    missingOrigin: parseInt(stats?.missingorigin) || 0,
    missingMaterial: parseInt(stats?.missingmaterial) || 0,
    uniqueProductNames: parseInt(productNameCount?.count) || 0,
    uniqueHsCodes: parseInt(hsCodeCount?.count) || 0,
    totalValue: parseFloat(stats?.totalvalue) || 0,
    totalDuty: parseFloat(stats?.totalduty) || 0,
    totalVat: parseFloat(stats?.totalvat) || 0,
    totalTax: parseFloat(stats?.totaltax) || 0
  }
}

export default {
  MATCH_CONFIG,
  matchHsCode,
  batchMatchHsCodes,
  approveMatch,
  batchApprove,
  updateMatchHistory,
  getReviewItems,
  getMatchedItems,
  updateCargoItemDetail,
  getMatchingStats
}
