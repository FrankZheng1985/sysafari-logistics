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
 * @param {number} limit - 返回数量
 */
export async function getRecommendations(params, limit = 5) {
  const { productName, productNameEn, material } = params
  const db = getDatabase()
  
  const recommendations = []
  const usedHsCodes = new Set()
  
  // 1. 从历史匹配记录中查找精确匹配
  if (productName) {
    const exactMatches = await db.prepare(`
      SELECT h.matched_hs_code as hs_code, h.match_count, h.product_name,
             t.goods_description_cn as tariff_name, t.goods_description as product_name_en, t.duty_rate, t.vat_rate
      FROM hs_match_history h
      LEFT JOIN tariff_rates t ON h.matched_hs_code = t.hs_code
      WHERE h.product_name = ?
      ORDER BY h.match_count DESC
      LIMIT ?
    `).all(productName, limit)
    
    for (const row of (exactMatches || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: Math.min(95, 70 + row.match_count * 5),
          source: 'history_exact',
          reason: `历史匹配 ${row.match_count} 次`,
          productName: row.tariff_name || row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: parseFloat(row.duty_rate) || 0,
          vatRate: parseFloat(row.vat_rate) || 19
        })
      }
    }
  }
  
  // 2. 如果历史记录不足，从历史记录中模糊查找
  if (recommendations.length < limit && productName) {
    const fuzzyHistory = await db.prepare(`
      SELECT h.matched_hs_code as hs_code, h.match_count, h.product_name,
             t.goods_description_cn as tariff_name, t.goods_description as product_name_en, t.duty_rate, t.vat_rate
      FROM hs_match_history h
      LEFT JOIN tariff_rates t ON h.matched_hs_code = t.hs_code
      WHERE h.product_name ILIKE ?
      ORDER BY h.match_count DESC
      LIMIT ?
    `).all(`%${productName}%`, limit)
    
    for (const row of (fuzzyHistory || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: Math.min(80, 50 + row.match_count * 3),
          source: 'history_fuzzy',
          reason: `相似商品历史匹配`,
          productName: row.tariff_name || row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: parseFloat(row.duty_rate) || 0,
          vatRate: parseFloat(row.vat_rate) || 19
        })
        if (recommendations.length >= limit) break
      }
    }
  }
  
  // 3. 如果仍不足，从税率库中模糊查找
  if (recommendations.length < limit && productName) {
    const tariffMatch = await db.prepare(`
      SELECT hs_code, goods_description_cn as product_name, goods_description as product_name_en, duty_rate, vat_rate
      FROM tariff_rates
      WHERE goods_description_cn ILIKE ? OR goods_description ILIKE ?
      ORDER BY LENGTH(COALESCE(goods_description_cn, '')) ASC
      LIMIT ?
    `).all(`%${productName}%`, `%${productName}%`, limit)
    
    for (const row of (tariffMatch || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: 50,
          source: 'tariff_fuzzy',
          reason: '税率库商品名匹配',
          productName: row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: parseFloat(row.duty_rate) || 0,
          vatRate: parseFloat(row.vat_rate) || 19
        })
        if (recommendations.length >= limit) break
      }
    }
  }
  
  // 4. 如果有材质信息，尝试基于材质匹配
  if (recommendations.length < limit && material) {
    const materialMatch = await db.prepare(`
      SELECT hs_code, goods_description_cn as product_name, goods_description as product_name_en, material, duty_rate, vat_rate
      FROM tariff_rates
      WHERE material ILIKE ?
      ORDER BY hs_code ASC
      LIMIT ?
    `).all(`%${material}%`, limit)
    
    for (const row of (materialMatch || [])) {
      if (!usedHsCodes.has(row.hs_code)) {
        usedHsCodes.add(row.hs_code)
        recommendations.push({
          hsCode: row.hs_code,
          confidence: 40,
          source: 'material_match',
          reason: `材质匹配: ${row.material}`,
          productName: row.product_name,
          productNameEn: row.product_name_en,
          dutyRate: parseFloat(row.duty_rate) || 0,
          vatRate: parseFloat(row.vat_rate) || 19
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
    hsCode: row.hs_code,
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
