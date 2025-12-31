/**
 * HS编码税率优化模块
 * 实现智能推荐低税率、规避反倾销税的HS编码
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
 * 计算总税负
 * @param {Object} params - 税率参数
 * @param {number} params.dutyRate - 关税率(%)
 * @param {number} params.antiDumpingRate - 反倾销税率(%)
 * @param {number} params.countervailingRate - 反补贴税率(%)
 * @param {number} params.vatRate - 增值税率(%)
 * @param {number} cifValue - CIF货值
 * @returns {Object} 税负明细
 */
export function calculateTotalTaxBurden(params, cifValue = 10000) {
  const {
    dutyRate = 0,
    antiDumpingRate = 0,
    countervailingRate = 0,
    vatRate = 19
  } = params

  // 关税 = CIF × 关税率
  const dutyAmount = cifValue * (dutyRate / 100)
  
  // 反倾销税 = CIF × 反倾销税率
  const antiDumpingAmount = cifValue * (antiDumpingRate / 100)
  
  // 反补贴税 = CIF × 反补贴税率
  const countervailingAmount = cifValue * (countervailingRate / 100)
  
  // 其他税费小计
  const otherTaxAmount = antiDumpingAmount + countervailingAmount
  
  // 税基 = CIF + 关税 + 其他税费
  const vatBase = cifValue + dutyAmount + otherTaxAmount
  
  // 增值税 = 税基 × 增值税率
  const vatAmount = vatBase * (vatRate / 100)
  
  // 总税负
  const totalTax = dutyAmount + otherTaxAmount + vatAmount
  
  // 总税率(相对于CIF的百分比)
  const effectiveTaxRate = (totalTax / cifValue) * 100

  return {
    dutyAmount: Math.round(dutyAmount * 100) / 100,
    antiDumpingAmount: Math.round(antiDumpingAmount * 100) / 100,
    countervailingAmount: Math.round(countervailingAmount * 100) / 100,
    otherTaxAmount: Math.round(otherTaxAmount * 100) / 100,
    vatBase: Math.round(vatBase * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100
  }
}

/**
 * 分析HS编码税率风险
 * @param {string} hsCode - HS编码
 * @param {string} originCountry - 原产国
 * @returns {Object} 风险分析结果
 */
export async function analyzeHsCodeTaxRisk(hsCode, originCountry = null) {
  const db = getDatabase()
  const normalizedHsCode = normalizeHsCode(hsCode)
  
  // 查询当前HS编码的税率
  let query = `
    SELECT 
      hs_code, goods_description_cn, goods_description, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      origin_country, origin_country_code
    FROM tariff_rates 
    WHERE hs_code = ?
  `
  const params = [normalizedHsCode]
  
  // 如果指定原产国，优先查询特定原产国的税率
  if (originCountry) {
    query += ` AND (origin_country ILIKE ? OR origin_country_code = ? OR origin_country IS NULL)`
    params.push(`%${originCountry}%`, originCountry)
  }
  
  query += ` ORDER BY anti_dumping_rate DESC LIMIT 1`
  
  const row = await db.prepare(query).get(...params)
  
  if (!row) {
    return {
      found: false,
      hsCode: normalizedHsCode,
      message: '未找到该HS编码的税率信息'
    }
  }
  
  const dutyRate = parseFloat(row.duty_rate) || 0
  const antiDumpingRate = parseFloat(row.anti_dumping_rate) || 0
  const countervailingRate = parseFloat(row.countervailing_rate) || 0
  const vatRate = parseFloat(row.vat_rate) || 19
  
  // 计算总税负
  const taxBurden = calculateTotalTaxBurden({
    dutyRate,
    antiDumpingRate,
    countervailingRate,
    vatRate
  })
  
  // 判断风险等级
  let riskLevel = 'low'
  let riskReasons = []
  
  if (antiDumpingRate > 0) {
    if (antiDumpingRate >= 30) {
      riskLevel = 'high'
      riskReasons.push(`反倾销税率极高 (${antiDumpingRate}%)`)
    } else if (antiDumpingRate >= 10) {
      riskLevel = 'high'
      riskReasons.push(`存在反倾销税 (${antiDumpingRate}%)`)
    } else {
      riskLevel = 'medium'
      riskReasons.push(`存在低额反倾销税 (${antiDumpingRate}%)`)
    }
  }
  
  if (countervailingRate > 0) {
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
    riskReasons.push(`存在反补贴税 (${countervailingRate}%)`)
  }
  
  if (dutyRate >= 15) {
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
    riskReasons.push(`关税率较高 (${dutyRate}%)`)
  }
  
  // 计算有效税率
  const totalRateWithoutVat = dutyRate + antiDumpingRate + countervailingRate
  
  return {
    found: true,
    hsCode: normalizeHsCode(row.hs_code),
    productName: row.goods_description_cn || row.goods_description,
    productNameEn: row.goods_description,
    material: row.material,
    originCountry: row.origin_country,
    rates: {
      dutyRate,
      antiDumpingRate,
      countervailingRate,
      vatRate,
      totalRateWithoutVat
    },
    taxBurden,
    riskLevel,
    riskReasons,
    hasAntiDumping: antiDumpingRate > 0,
    hasCountervailing: countervailingRate > 0
  }
}

/**
 * 查找低税率替代编码
 * @param {string} hsCode - 当前HS编码
 * @param {string} productName - 商品名称（用于相似匹配）
 * @param {string} originCountry - 原产国
 * @param {number} limit - 返回数量
 * @returns {Array} 替代方案列表
 */
export async function findLowerTaxAlternatives(hsCode, productName = null, originCountry = null, limit = 10) {
  const db = getDatabase()
  const normalizedHsCode = normalizeHsCode(hsCode)
  
  // 获取当前编码的税率信息
  const currentTariff = await analyzeHsCodeTaxRisk(hsCode, originCountry)
  if (!currentTariff.found) {
    return { current: null, alternatives: [], message: '未找到当前HS编码的税率信息' }
  }
  
  const alternatives = []
  const usedHsCodes = new Set([normalizedHsCode])
  
  // 策略1: 同一8位前缀下搜索
  const prefix8 = normalizedHsCode.substring(0, 8)
  const prefix8Results = await db.prepare(`
    SELECT DISTINCT ON (hs_code)
      hs_code, goods_description_cn, goods_description, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      origin_country
    FROM tariff_rates 
    WHERE hs_code LIKE ?
      AND hs_code != ?
      AND (anti_dumping_rate < ? OR anti_dumping_rate IS NULL OR anti_dumping_rate = 0)
    ORDER BY hs_code, (COALESCE(duty_rate, 0) + COALESCE(anti_dumping_rate, 0) + COALESCE(countervailing_rate, 0)) ASC
    LIMIT ?
  `).all(prefix8 + '%', normalizedHsCode, currentTariff.rates.antiDumpingRate || 999, limit)
  
  for (const row of (prefix8Results || [])) {
    const normalized = normalizeHsCode(row.hs_code)
    if (!usedHsCodes.has(normalized)) {
      usedHsCodes.add(normalized)
      const dutyRate = parseFloat(row.duty_rate) || 0
      const antiDumpingRate = parseFloat(row.anti_dumping_rate) || 0
      const countervailingRate = parseFloat(row.countervailing_rate) || 0
      const vatRate = parseFloat(row.vat_rate) || 19
      
      const taxBurden = calculateTotalTaxBurden({ dutyRate, antiDumpingRate, countervailingRate, vatRate })
      const savings = currentTariff.taxBurden.effectiveTaxRate - taxBurden.effectiveTaxRate
      
      if (savings > 0) {
        alternatives.push({
          hsCode: normalized,
          productName: row.goods_description_cn || row.goods_description,
          productNameEn: row.goods_description,
          material: row.material,
          originCountry: row.origin_country,
          matchType: 'prefix_8',
          matchReason: '同8位前缀细分编码',
          rates: { dutyRate, antiDumpingRate, countervailingRate, vatRate },
          taxBurden,
          savings,
          savingsPercent: Math.round(savings * 100) / 100,
          riskLevel: antiDumpingRate > 0 ? 'medium' : 'low'
        })
      }
    }
  }
  
  // 策略2: 同一6位前缀下搜索
  const prefix6 = normalizedHsCode.substring(0, 6)
  const prefix6Results = await db.prepare(`
    SELECT DISTINCT ON (hs_code)
      hs_code, goods_description_cn, goods_description, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      origin_country
    FROM tariff_rates 
    WHERE hs_code LIKE ?
      AND hs_code NOT LIKE ?
      AND (anti_dumping_rate = 0 OR anti_dumping_rate IS NULL)
    ORDER BY hs_code, (COALESCE(duty_rate, 0) + COALESCE(anti_dumping_rate, 0) + COALESCE(countervailing_rate, 0)) ASC
    LIMIT ?
  `).all(prefix6 + '%', prefix8 + '%', limit)
  
  for (const row of (prefix6Results || [])) {
    const normalized = normalizeHsCode(row.hs_code)
    if (!usedHsCodes.has(normalized)) {
      usedHsCodes.add(normalized)
      const dutyRate = parseFloat(row.duty_rate) || 0
      const antiDumpingRate = parseFloat(row.anti_dumping_rate) || 0
      const countervailingRate = parseFloat(row.countervailing_rate) || 0
      const vatRate = parseFloat(row.vat_rate) || 19
      
      const taxBurden = calculateTotalTaxBurden({ dutyRate, antiDumpingRate, countervailingRate, vatRate })
      const savings = currentTariff.taxBurden.effectiveTaxRate - taxBurden.effectiveTaxRate
      
      if (savings > 0) {
        alternatives.push({
          hsCode: normalized,
          productName: row.goods_description_cn || row.goods_description,
          productNameEn: row.goods_description,
          material: row.material,
          originCountry: row.origin_country,
          matchType: 'prefix_6',
          matchReason: '同6位前缀相关编码',
          rates: { dutyRate, antiDumpingRate, countervailingRate, vatRate },
          taxBurden,
          savings,
          savingsPercent: Math.round(savings * 100) / 100,
          riskLevel: 'low'
        })
      }
    }
  }
  
  // 策略3: 如果有商品名称，进行相似商品搜索
  if (productName && alternatives.length < limit) {
    const similarResults = await db.prepare(`
      SELECT DISTINCT ON (hs_code)
        hs_code, goods_description_cn, goods_description, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        origin_country
      FROM tariff_rates 
      WHERE (goods_description_cn ILIKE ? OR goods_description ILIKE ?)
        AND (anti_dumping_rate = 0 OR anti_dumping_rate IS NULL)
      ORDER BY hs_code, (COALESCE(duty_rate, 0) + COALESCE(anti_dumping_rate, 0)) ASC
      LIMIT ?
    `).all(`%${productName}%`, `%${productName}%`, limit)
    
    for (const row of (similarResults || [])) {
      const normalized = normalizeHsCode(row.hs_code)
      if (!usedHsCodes.has(normalized)) {
        usedHsCodes.add(normalized)
        const dutyRate = parseFloat(row.duty_rate) || 0
        const antiDumpingRate = parseFloat(row.anti_dumping_rate) || 0
        const countervailingRate = parseFloat(row.countervailing_rate) || 0
        const vatRate = parseFloat(row.vat_rate) || 19
        
        const taxBurden = calculateTotalTaxBurden({ dutyRate, antiDumpingRate, countervailingRate, vatRate })
        const savings = currentTariff.taxBurden.effectiveTaxRate - taxBurden.effectiveTaxRate
        
        if (savings > 0) {
          alternatives.push({
            hsCode: normalized,
            productName: row.goods_description_cn || row.goods_description,
            productNameEn: row.goods_description,
            material: row.material,
            originCountry: row.origin_country,
            matchType: 'similar_product',
            matchReason: '相似商品名称',
            rates: { dutyRate, antiDumpingRate, countervailingRate, vatRate },
            taxBurden,
            savings,
            savingsPercent: Math.round(savings * 100) / 100,
            riskLevel: 'low'
          })
        }
      }
    }
  }
  
  // 按节省税率排序
  alternatives.sort((a, b) => b.savings - a.savings)
  
  return {
    current: currentTariff,
    alternatives: alternatives.slice(0, limit),
    totalAlternatives: alternatives.length
  }
}

/**
 * 获取反倾销税风险HS编码列表
 * @param {string} originCountry - 原产国筛选
 * @returns {Array} 风险编码列表
 */
export async function getAntiDumpingRiskCodes(originCountry = 'China') {
  const db = getDatabase()
  
  const rows = await db.prepare(`
    SELECT 
      hs_code, goods_description_cn, goods_description,
      duty_rate, anti_dumping_rate, countervailing_rate,
      origin_country,
      CASE 
        WHEN anti_dumping_rate >= 30 THEN 'critical'
        WHEN anti_dumping_rate >= 20 THEN 'high'
        WHEN anti_dumping_rate >= 10 THEN 'medium'
        ELSE 'low'
      END as risk_level
    FROM tariff_rates 
    WHERE anti_dumping_rate > 0
      AND (origin_country ILIKE ? OR origin_country_code = 'CN' OR origin_country IS NULL)
    ORDER BY anti_dumping_rate DESC
    LIMIT 100
  `).all(`%${originCountry}%`)
  
  return (rows || []).map(row => ({
    hsCode: normalizeHsCode(row.hs_code),
    productName: row.goods_description_cn || row.goods_description,
    dutyRate: parseFloat(row.duty_rate) || 0,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    originCountry: row.origin_country,
    riskLevel: row.risk_level
  }))
}

/**
 * 批量分析货物清单的税率风险
 * @param {number} importId - 导入批次ID
 * @returns {Object} 分析结果
 */
export async function batchAnalyzeImportRisk(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取货物明细
  const items = await db.prepare(`
    SELECT id, matched_hs_code, product_name, origin_country, total_value
    FROM cargo_items 
    WHERE import_id = ? AND matched_hs_code IS NOT NULL
  `).all(importId)
  
  let highRiskCount = 0
  let mediumRiskCount = 0
  let lowRiskCount = 0
  let totalAntiDumping = 0
  const riskItems = []
  
  for (const item of (items || [])) {
    const analysis = await analyzeHsCodeTaxRisk(item.matched_hs_code, item.origin_country)
    
    if (analysis.found) {
      // 更新货物明细的风险信息
      let itemRisk = 'low'
      if (analysis.riskLevel === 'high') {
        highRiskCount++
        itemRisk = 'high'
        riskItems.push({
          itemId: item.id,
          hsCode: item.matched_hs_code,
          productName: item.product_name,
          riskLevel: 'high',
          antiDumpingRate: analysis.rates.antiDumpingRate,
          reasons: analysis.riskReasons
        })
      } else if (analysis.riskLevel === 'medium') {
        mediumRiskCount++
        itemRisk = 'medium'
      } else {
        lowRiskCount++
      }
      
      if (analysis.hasAntiDumping) {
        totalAntiDumping += analysis.rates.antiDumpingRate
      }
      
      // 更新货物明细
      await db.prepare(`
        UPDATE cargo_items SET
          declaration_risk = ?,
          inspection_risk = ?
        WHERE id = ?
      `).run(itemRisk, itemRisk, item.id)
    }
  }
  
  // 计算整体风险评分 (0-100)
  const totalItems = (items || []).length
  let riskScore = 0
  if (totalItems > 0) {
    riskScore = Math.round(
      (highRiskCount * 100 + mediumRiskCount * 50 + lowRiskCount * 10) / totalItems
    )
  }
  
  // 确定整体风险等级
  let overallRiskLevel = 'low'
  if (highRiskCount > 0 || riskScore >= 60) {
    overallRiskLevel = 'high'
  } else if (mediumRiskCount > 0 || riskScore >= 30) {
    overallRiskLevel = 'medium'
  }
  
  // 更新导入批次的风险评估
  await db.prepare(`
    UPDATE cargo_imports SET
      risk_score = ?,
      risk_level = ?,
      risk_analyzed_at = ?,
      risk_notes = ?
    WHERE id = ?
  `).run(
    riskScore,
    overallRiskLevel,
    now,
    `高风险: ${highRiskCount}, 中风险: ${mediumRiskCount}, 低风险: ${lowRiskCount}`,
    importId
  )
  
  return {
    importId,
    totalItems,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    riskScore,
    overallRiskLevel,
    riskItems,
    analyzedAt: now
  }
}

/**
 * 搜索同前缀的所有HS编码及税率
 * @param {string} prefix - HS编码前缀(4/6/8位)
 * @param {number} limit - 返回数量
 */
export async function searchByPrefix(prefix, limit = 50) {
  const db = getDatabase()
  
  const rows = await db.prepare(`
    SELECT 
      hs_code, goods_description_cn, goods_description, material,
      duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
      origin_country
    FROM tariff_rates 
    WHERE hs_code LIKE ?
    ORDER BY 
      (COALESCE(duty_rate, 0) + COALESCE(anti_dumping_rate, 0) + COALESCE(countervailing_rate, 0)) ASC,
      hs_code ASC
    LIMIT ?
  `).all(prefix + '%', limit)
  
  return (rows || []).map(row => {
    const dutyRate = parseFloat(row.duty_rate) || 0
    const antiDumpingRate = parseFloat(row.anti_dumping_rate) || 0
    const countervailingRate = parseFloat(row.countervailing_rate) || 0
    const vatRate = parseFloat(row.vat_rate) || 19
    
    return {
      hsCode: normalizeHsCode(row.hs_code),
      productName: row.goods_description_cn || row.goods_description,
      productNameEn: row.goods_description,
      material: row.material,
      originCountry: row.origin_country,
      rates: { dutyRate, antiDumpingRate, countervailingRate, vatRate },
      totalRateWithoutVat: dutyRate + antiDumpingRate + countervailingRate,
      hasAntiDumping: antiDumpingRate > 0,
      riskLevel: antiDumpingRate >= 10 ? 'high' : (antiDumpingRate > 0 ? 'medium' : 'low')
    }
  })
}

export default {
  calculateTotalTaxBurden,
  analyzeHsCodeTaxRisk,
  findLowerTaxAlternatives,
  getAntiDumpingRiskCodes,
  batchAnalyzeImportRisk,
  searchByPrefix
}

