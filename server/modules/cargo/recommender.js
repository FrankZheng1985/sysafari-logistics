/**
 * HS编码智能推荐服务
 * 基于历史匹配记录实现学习型推荐
 */

import { getDatabase } from '../../config/database.js'

/**
 * 获取HS编码推荐
 * @param {Object} params - 商品信息
 * @param {string} params.productName - 商品名称
 * @param {string} params.productNameEn - 英文名称
 * @param {string} params.material - 材质
 * @param {string} params.originCountry - 原产国代码（如 CN）
 * @param {number} limit - 返回数量
 */
export async function getRecommendations(params, limit = 5) {
  const { productName, productNameEn, material, originCountry = 'CN' } = params
  const db = getDatabase()
  
  const recommendations = []
  const usedHsCodes = new Set()
  
  // 1. 从历史匹配记录中查找精确匹配
  if (productName) {
    const exactMatches = await db.prepare(`
      SELECT h.matched_hs_code as hs_code, h.match_count, h.product_name,
             t.goods_description_cn as tariff_name, t.goods_description as product_name_en, 
             t.duty_rate, t.vat_rate, t.anti_dumping_rate, t.countervailing_rate
      FROM hs_match_history h
      LEFT JOIN tariff_rates t ON h.matched_hs_code = t.hs_code
      WHERE h.product_name = ?
      ORDER BY h.match_count DESC
      LIMIT ?
    `).all(productName, limit)
    
    for (const row of (exactMatches || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        // 根据原产国查询特定税率
        const tariffByOrigin = await getTariffByOriginCountry(db, row.hs_code, originCountry)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: Math.min(95, 70 + row.match_count * 5),
          source: 'history_exact',
          reason: `历史匹配 ${row.match_count} 次`,
          productName: row.tariff_name || row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: tariffByOrigin?.dutyRate ?? (parseFloat(row.duty_rate) || 0),
          vatRate: tariffByOrigin?.vatRate ?? (parseFloat(row.vat_rate) || 19),
          antiDumpingRate: tariffByOrigin?.antiDumpingRate ?? (parseFloat(row.anti_dumping_rate) || 0),
          countervailingRate: tariffByOrigin?.countervailingRate ?? (parseFloat(row.countervailing_rate) || 0),
          originCountry: originCountry
        })
      }
    }
  }
  
  // 2. 如果历史记录不足，从历史记录中模糊查找
  if (recommendations.length < limit && productName) {
    const fuzzyHistory = await db.prepare(`
      SELECT h.matched_hs_code as hs_code, h.match_count, h.product_name,
             t.goods_description_cn as tariff_name, t.goods_description as product_name_en, 
             t.duty_rate, t.vat_rate, t.anti_dumping_rate, t.countervailing_rate
      FROM hs_match_history h
      LEFT JOIN tariff_rates t ON h.matched_hs_code = t.hs_code
      WHERE h.product_name ILIKE ?
      ORDER BY h.match_count DESC
      LIMIT ?
    `).all(`%${productName}%`, limit)
    
    for (const row of (fuzzyHistory || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        // 根据原产国查询特定税率
        const tariffByOrigin = await getTariffByOriginCountry(db, row.hs_code, originCountry)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: Math.min(80, 50 + row.match_count * 3),
          source: 'history_fuzzy',
          reason: `相似商品历史匹配`,
          productName: row.tariff_name || row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: tariffByOrigin?.dutyRate ?? (parseFloat(row.duty_rate) || 0),
          vatRate: tariffByOrigin?.vatRate ?? (parseFloat(row.vat_rate) || 19),
          antiDumpingRate: tariffByOrigin?.antiDumpingRate ?? (parseFloat(row.anti_dumping_rate) || 0),
          countervailingRate: tariffByOrigin?.countervailingRate ?? (parseFloat(row.countervailing_rate) || 0),
          originCountry: originCountry
        })
        if (recommendations.length >= limit) break
      }
    }
  }
  
  // 3. 如果仍不足，从税率库中模糊查找（优先匹配指定原产国）
  if (recommendations.length < limit && productName) {
    const tariffMatch = await db.prepare(`
      SELECT hs_code, goods_description_cn as product_name, goods_description as product_name_en, 
             duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, origin_country_code
      FROM tariff_rates
      WHERE (goods_description_cn ILIKE ? OR goods_description ILIKE ?)
      ORDER BY 
        CASE WHEN origin_country_code = ? THEN 0 ELSE 1 END,
        LENGTH(COALESCE(goods_description_cn, '')) ASC
      LIMIT ?
    `).all(`%${productName}%`, `%${productName}%`, originCountry, limit)
    
    for (const row of (tariffMatch || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        // 根据原产国查询特定税率
        const tariffByOrigin = await getTariffByOriginCountry(db, row.hs_code, originCountry)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: 50,
          source: 'tariff_fuzzy',
          reason: '税率库商品名匹配',
          productName: row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: tariffByOrigin?.dutyRate ?? (parseFloat(row.duty_rate) || 0),
          vatRate: tariffByOrigin?.vatRate ?? (parseFloat(row.vat_rate) || 19),
          antiDumpingRate: tariffByOrigin?.antiDumpingRate ?? (parseFloat(row.anti_dumping_rate) || 0),
          countervailingRate: tariffByOrigin?.countervailingRate ?? (parseFloat(row.countervailing_rate) || 0),
          originCountry: originCountry
        })
        if (recommendations.length >= limit) break
      }
    }
  }
  
  // 4. 如果有材质信息，尝试基于材质匹配
  if (recommendations.length < limit && material) {
    const materialMatch = await db.prepare(`
      SELECT hs_code, goods_description_cn as product_name, goods_description as product_name_en, material, 
             duty_rate, vat_rate, anti_dumping_rate, countervailing_rate
      FROM tariff_rates
      WHERE material ILIKE ?
      ORDER BY hs_code ASC
      LIMIT ?
    `).all(`%${material}%`, limit)
    
    for (const row of (materialMatch || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        // 根据原产国查询特定税率
        const tariffByOrigin = await getTariffByOriginCountry(db, row.hs_code, originCountry)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: 40,
          source: 'material_match',
          reason: `材质匹配: ${row.material}`,
          productName: row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: tariffByOrigin?.dutyRate ?? (parseFloat(row.duty_rate) || 0),
          vatRate: tariffByOrigin?.vatRate ?? (parseFloat(row.vat_rate) || 19),
          antiDumpingRate: tariffByOrigin?.antiDumpingRate ?? (parseFloat(row.anti_dumping_rate) || 0),
          countervailingRate: tariffByOrigin?.countervailingRate ?? (parseFloat(row.countervailing_rate) || 0),
          originCountry: originCountry
        })
        if (recommendations.length >= limit) break
      }
    }
  }
  
  // 按置信度排序
  recommendations.sort((a, b) => b.confidence - a.confidence)
  
  return recommendations.slice(0, limit)
}

/**
 * 根据 HS 编码和原产国查询特定关税税率
 * 特别是反倾销税和反补贴税，这些税率通常与原产国相关
 * @param {Object} db - 数据库连接
 * @param {string} hsCode - HS 编码
 * @param {string} originCountryCode - 原产国代码
 * @returns {Object|null} 税率信息
 */
async function getTariffByOriginCountry(db, hsCode, originCountryCode) {
  if (!hsCode || !originCountryCode) return null
  
  // 首先精确匹配原产国
  let tariff = await db.prepare(`
    SELECT duty_rate, vat_rate, anti_dumping_rate, countervailing_rate
    FROM tariff_rates 
    WHERE hs_code = ?
      AND origin_country_code = ?
      AND is_active = 1
    ORDER BY anti_dumping_rate DESC, duty_rate DESC
    LIMIT 1
  `).get(hsCode, originCountryCode)
  
  if (tariff) {
    return {
      dutyRate: parseFloat(tariff.duty_rate) || 0,
      vatRate: parseFloat(tariff.vat_rate) || 19,
      antiDumpingRate: parseFloat(tariff.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(tariff.countervailing_rate) || 0
    }
  }
  
  // 如果没有特定原产国的税率，查找通用税率
  tariff = await db.prepare(`
    SELECT duty_rate, vat_rate, anti_dumping_rate, countervailing_rate
    FROM tariff_rates 
    WHERE hs_code = ?
      AND (origin_country_code IS NULL OR origin_country_code = '' OR origin_country_code = 'ERGA_OMNES')
      AND is_active = 1
    ORDER BY duty_rate DESC
    LIMIT 1
  `).get(hsCode)
  
  if (tariff) {
    return {
      dutyRate: parseFloat(tariff.duty_rate) || 0,
      vatRate: parseFloat(tariff.vat_rate) || 19,
      antiDumpingRate: parseFloat(tariff.anti_dumping_rate) || 0,
      countervailingRate: parseFloat(tariff.countervailing_rate) || 0
    }
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
 * 根据HS编码搜索税率库
 */
export async function searchTariffByHsCode(hsCodePrefix, limit = 20) {
  const db = getDatabase()

  const rows = await db.prepare(`
    SELECT
      hs_code, goods_description_cn, goods_description, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name, origin_country, origin_country_code
    FROM tariff_rates
    WHERE hs_code LIKE ?
    ORDER BY hs_code ASC
    LIMIT ?
  `).all(hsCodePrefix + '%', limit)

  return (rows || []).map(row => ({
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
    originCountry: row.origin_country || '',
    originCountryCode: row.origin_country_code || ''
  }))
}

/**
 * 根据商品名称搜索税率库
 */
export async function searchTariffByName(keyword, limit = 20) {
  const db = getDatabase()
  
  const rows = await db.prepare(`
    SELECT 
      hs_code, goods_description_cn, goods_description, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      unit_code, unit_name
    FROM tariff_rates
    WHERE goods_description_cn ILIKE ? OR goods_description ILIKE ?
    ORDER BY LENGTH(COALESCE(goods_description_cn, '')) ASC
    LIMIT ?
  `).all(`%${keyword}%`, `%${keyword}%`, limit)
  
  return (rows || []).map(row => ({
    hsCode: normalizeHsCode(row.hs_code),
    productName: row.goods_description_cn || row.goods_description,
    productNameEn: row.goods_description,
    material: row.material,
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    unitCode: row.unit_code,
    unitName: row.unit_name
  }))
}

/**
 * 获取匹配历史统计
 */
export async function getMatchHistoryStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_records,
      SUM(match_count) as total_matches,
      COUNT(DISTINCT matched_hs_code) as unique_hs_codes
    FROM hs_match_history
  `).get()
  
  const recentRows = await db.prepare(`
    SELECT product_name, matched_hs_code, match_count, last_matched_at
    FROM hs_match_history
    ORDER BY last_matched_at DESC
    LIMIT 10
  `).all()
  
  return {
    totalRecords: parseInt(stats?.total_records) || 0,
    totalMatches: parseInt(stats?.total_matches) || 0,
    uniqueHsCodes: parseInt(stats?.unique_hs_codes) || 0,
    recentMatches: (recentRows || []).map(row => ({
      productName: row.product_name,
      hsCode: row.matched_hs_code,
      matchCount: row.match_count,
      lastMatchedAt: row.last_matched_at
    }))
  }
}

export default {
  getRecommendations,
  searchTariffByHsCode,
  searchTariffByName,
  getMatchHistoryStats
}
