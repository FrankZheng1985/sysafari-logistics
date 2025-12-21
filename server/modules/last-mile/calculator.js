/**
 * 最后里程费用计算器
 * 核心功能：根据重量+Zone计算采购价、销售价、利润
 */

import { getDatabase } from '../../config/database.js'

/**
 * 计算体积重量
 * @param {Object} dimensions - 尺寸 {length, width, height} 单位：厘米
 * @param {number} factor - 体积重系数（默认5000，即1立方米=200kg）
 * @returns {number} 体积重量（kg）
 */
export function calculateVolumeWeight(dimensions, factor = 5000) {
  if (!dimensions || !dimensions.length || !dimensions.width || !dimensions.height) {
    return 0
  }
  
  const { length, width, height } = dimensions
  return (length * width * height) / factor
}

/**
 * 计算计费重量
 * @param {number} actualWeight - 实际重量（kg）
 * @param {number} volumeWeight - 体积重量（kg）
 * @returns {number} 计费重量（取较大值）
 */
export function calculateChargeableWeight(actualWeight, volumeWeight) {
  return Math.max(actualWeight || 0, volumeWeight || 0)
}

/**
 * 根据邮编匹配Zone
 * @param {number} carrierId - 承运商ID
 * @param {string} postalCode - 邮编
 * @param {string} country - 国家代码
 * @returns {Object|null} Zone信息
 */
export async function matchZoneByPostalCode(carrierId, postalCode, country = null) {
  const db = getDatabase()
  
  // 首先尝试精确匹配邮编前缀
  const zones = await db.prepare(`
    SELECT * FROM last_mile_zones WHERE carrier_id = ? ORDER BY sort_order
  `).all(carrierId)
  
  for (const zone of zones) {
    // 检查邮编前缀匹配
    if (zone.postal_prefixes) {
      const prefixes = typeof zone.postal_prefixes === 'string' 
        ? JSON.parse(zone.postal_prefixes) 
        : zone.postal_prefixes
      
      for (const prefix of prefixes) {
        if (postalCode && postalCode.startsWith(prefix)) {
          return {
            id: zone.id,
            zoneCode: zone.zone_code,
            zoneName: zone.zone_name
          }
        }
      }
    }
    
    // 检查国家匹配
    if (country && zone.countries) {
      const countries = typeof zone.countries === 'string'
        ? JSON.parse(zone.countries)
        : zone.countries
      
      if (countries.includes(country)) {
        return {
          id: zone.id,
          zoneCode: zone.zone_code,
          zoneName: zone.zone_name
        }
      }
    }
  }
  
  return null
}

/**
 * 查找匹配的费率
 * @param {number} rateCardId - 费率卡ID
 * @param {string} zoneCode - Zone编码
 * @param {number} weight - 计费重量
 * @returns {Object|null} 费率信息
 */
export async function findMatchingRate(rateCardId, zoneCode, weight) {
  const db = getDatabase()
  
  // 查找匹配的重量段
  const tier = await db.prepare(`
    SELECT * FROM rate_card_tiers 
    WHERE rate_card_id = ? 
    AND zone_code = ? 
    AND weight_from <= ? 
    AND weight_to >= ?
    ORDER BY weight_from
    LIMIT 1
  `).get(rateCardId, zoneCode, weight, weight)
  
  if (!tier) {
    // 如果没有精确匹配，查找最高重量段
    const maxTier = await db.prepare(`
      SELECT * FROM rate_card_tiers 
      WHERE rate_card_id = ? 
      AND zone_code = ? 
      ORDER BY weight_to DESC
      LIMIT 1
    `).get(rateCardId, zoneCode)
    
    if (maxTier && weight > maxTier.weight_to) {
      // 超出最高重量段，使用最高段价格
      return {
        tierId: maxTier.id,
        weightFrom: parseFloat(maxTier.weight_from),
        weightTo: parseFloat(maxTier.weight_to),
        purchasePrice: maxTier.purchase_price ? parseFloat(maxTier.purchase_price) : null,
        salesPrice: maxTier.sales_price ? parseFloat(maxTier.sales_price) : null,
        priceUnit: maxTier.price_unit,
        exceeded: true,
        excessWeight: weight - parseFloat(maxTier.weight_to)
      }
    }
    
    return null
  }
  
  return {
    tierId: tier.id,
    weightFrom: parseFloat(tier.weight_from),
    weightTo: parseFloat(tier.weight_to),
    purchasePrice: tier.purchase_price ? parseFloat(tier.purchase_price) : null,
    purchaseMinCharge: tier.purchase_min_charge ? parseFloat(tier.purchase_min_charge) : null,
    salesPrice: tier.sales_price ? parseFloat(tier.sales_price) : null,
    salesMinCharge: tier.sales_min_charge ? parseFloat(tier.sales_min_charge) : null,
    priceUnit: tier.price_unit,
    marginRate: tier.margin_rate ? parseFloat(tier.margin_rate) : null
  }
}

/**
 * 获取附加费
 * @param {number} rateCardId - 费率卡ID
 * @param {Object} params - 可选参数用于条件过滤
 * @returns {Array} 附加费列表
 */
export async function getSurcharges(rateCardId, params = {}) {
  const db = getDatabase()
  
  const surcharges = await db.prepare(`
    SELECT * FROM rate_card_surcharges WHERE rate_card_id = ?
  `).all(rateCardId)
  
  return surcharges
    .filter(s => {
      // 如果附加费有条件，检查是否满足
      if (s.conditions) {
        const conditions = typeof s.conditions === 'string' ? JSON.parse(s.conditions) : s.conditions
        // 这里可以根据实际需求实现条件检查逻辑
        // 例如：远程地区附加费、超重附加费等
      }
      return true
    })
    .map(s => ({
      id: s.id,
      code: s.surcharge_code,
      name: s.surcharge_name,
      chargeType: s.charge_type,
      purchaseAmount: s.purchase_amount ? parseFloat(s.purchase_amount) : 0,
      salesAmount: s.sales_amount ? parseFloat(s.sales_amount) : 0,
      percentage: s.percentage ? parseFloat(s.percentage) : 0,
      isMandatory: s.is_mandatory === 1
    }))
}

/**
 * 计算运费（核心计算函数）
 * @param {Object} params - 计算参数
 * @returns {Object} 计算结果
 */
export async function calculateFreight(params) {
  const {
    carrierId,
    rateCardId,
    zoneCode,
    postalCode,
    country,
    weight,
    dimensions,
    serviceType = 'standard',
    includeSurcharges = true
  } = params
  
  const db = getDatabase()
  
  // 1. 计算计费重量
  const volumeWeight = dimensions ? calculateVolumeWeight(dimensions) : 0
  const chargeableWeight = calculateChargeableWeight(weight, volumeWeight)
  
  // 2. 确定Zone
  let zone = null
  let finalZoneCode = zoneCode
  
  if (!zoneCode && postalCode && carrierId) {
    zone = await matchZoneByPostalCode(carrierId, postalCode, country)
    if (zone) {
      finalZoneCode = zone.zoneCode
    }
  }
  
  if (!finalZoneCode) {
    return {
      success: false,
      error: '无法确定Zone',
      details: { carrierId, postalCode, country }
    }
  }
  
  // 3. 获取费率卡
  let activeRateCardId = rateCardId
  
  if (!activeRateCardId && carrierId) {
    // 查找有效的费率卡
    const today = new Date().toISOString().split('T')[0]
    const rateCard = await db.prepare(`
      SELECT id FROM unified_rate_cards 
      WHERE carrier_id = ? 
      AND status = 'active' 
      AND valid_from <= ? 
      AND (valid_until IS NULL OR valid_until >= ?)
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
    `).get(carrierId, today, today)
    
    if (rateCard) {
      activeRateCardId = rateCard.id
    }
  }
  
  if (!activeRateCardId) {
    return {
      success: false,
      error: '未找到有效的费率卡',
      details: { carrierId, serviceType }
    }
  }
  
  // 4. 查找费率
  const rate = await findMatchingRate(activeRateCardId, finalZoneCode, chargeableWeight)
  
  if (!rate) {
    return {
      success: false,
      error: '未找到匹配的费率',
      details: { rateCardId: activeRateCardId, zoneCode: finalZoneCode, weight: chargeableWeight }
    }
  }
  
  // 5. 计算基础费用
  let purchaseCost = 0
  let salesAmount = 0
  
  if (rate.priceUnit === 'per_kg') {
    purchaseCost = rate.purchasePrice ? rate.purchasePrice * chargeableWeight : 0
    salesAmount = rate.salesPrice ? rate.salesPrice * chargeableWeight : 0
  } else if (rate.priceUnit === 'per_shipment') {
    purchaseCost = rate.purchasePrice || 0
    salesAmount = rate.salesPrice || 0
  }
  
  // 应用最低收费
  if (rate.purchaseMinCharge && purchaseCost < rate.purchaseMinCharge) {
    purchaseCost = rate.purchaseMinCharge
  }
  if (rate.salesMinCharge && salesAmount < rate.salesMinCharge) {
    salesAmount = rate.salesMinCharge
  }
  
  // 6. 计算附加费
  let surchargeDetails = []
  let totalPurchaseSurcharge = 0
  let totalSalesSurcharge = 0
  
  if (includeSurcharges) {
    const surcharges = await getSurcharges(activeRateCardId, { weight: chargeableWeight, zoneCode: finalZoneCode })
    
    surcharges.filter(s => s.isMandatory).forEach(s => {
      let purchaseSurcharge = 0
      let salesSurcharge = 0
      
      if (s.chargeType === 'fixed') {
        purchaseSurcharge = s.purchaseAmount
        salesSurcharge = s.salesAmount
      } else if (s.chargeType === 'percentage') {
        purchaseSurcharge = purchaseCost * (s.percentage / 100)
        salesSurcharge = salesAmount * (s.percentage / 100)
      }
      
      totalPurchaseSurcharge += purchaseSurcharge
      totalSalesSurcharge += salesSurcharge
      
      surchargeDetails.push({
        code: s.code,
        name: s.name,
        purchaseAmount: parseFloat(purchaseSurcharge.toFixed(2)),
        salesAmount: parseFloat(salesSurcharge.toFixed(2))
      })
    })
  }
  
  // 7. 计算总费用和利润
  const totalPurchase = purchaseCost + totalPurchaseSurcharge
  const totalSales = salesAmount + totalSalesSurcharge
  const profit = totalSales - totalPurchase
  const profitRate = totalPurchase > 0 ? (profit / totalPurchase * 100) : 0
  
  return {
    success: true,
    data: {
      // 重量信息
      actualWeight: weight,
      volumeWeight: parseFloat(volumeWeight.toFixed(2)),
      chargeableWeight: parseFloat(chargeableWeight.toFixed(2)),
      
      // Zone信息
      zoneCode: finalZoneCode,
      zoneName: zone?.zoneName || finalZoneCode,
      
      // 费率信息
      rateCardId: activeRateCardId,
      rateTierId: rate.tierId,
      priceUnit: rate.priceUnit,
      weightRange: `${rate.weightFrom}-${rate.weightTo}`,
      
      // 基础费用
      basePurchasePrice: rate.purchasePrice,
      baseSalesPrice: rate.salesPrice,
      purchaseCost: parseFloat(purchaseCost.toFixed(2)),
      salesAmount: parseFloat(salesAmount.toFixed(2)),
      
      // 附加费
      surcharges: surchargeDetails,
      totalPurchaseSurcharge: parseFloat(totalPurchaseSurcharge.toFixed(2)),
      totalSalesSurcharge: parseFloat(totalSalesSurcharge.toFixed(2)),
      
      // 总计
      totalPurchase: parseFloat(totalPurchase.toFixed(2)),
      totalSales: parseFloat(totalSales.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      profitRate: parseFloat(profitRate.toFixed(2)),
      
      // 货币
      currency: 'EUR'
    }
  }
}

/**
 * 批量计算多个承运商的报价（用于比价）
 * @param {Object} params - 计算参数
 * @returns {Array} 各承运商报价结果
 */
export async function calculateMultiCarrierQuotes(params) {
  const {
    carrierIds,
    zoneCode,
    postalCode,
    country,
    weight,
    dimensions
  } = params
  
  const db = getDatabase()
  
  // 如果没有指定承运商，获取所有启用的承运商
  let carriers = []
  if (carrierIds && carrierIds.length > 0) {
    carriers = await db.prepare(`
      SELECT id, carrier_code, carrier_name FROM last_mile_carriers 
      WHERE id IN (${carrierIds.map(() => '?').join(',')}) AND status = 'active'
    `).all(...carrierIds)
  } else {
    carriers = await db.prepare(`
      SELECT id, carrier_code, carrier_name FROM last_mile_carriers WHERE status = 'active'
    `).all()
  }
  
  const quotes = []
  
  for (const carrier of carriers) {
    const result = await calculateFreight({
      carrierId: carrier.id,
      zoneCode,
      postalCode,
      country,
      weight,
      dimensions
    })
    
    quotes.push({
      carrierId: carrier.id,
      carrierCode: carrier.carrier_code,
      carrierName: carrier.carrier_name,
      ...result
    })
  }
  
  // 按采购成本排序
  quotes.sort((a, b) => {
    if (!a.success) return 1
    if (!b.success) return -1
    return a.data.totalPurchase - b.data.totalPurchase
  })
  
  return quotes
}

/**
 * 快速报价（简化接口）
 */
export async function quickQuote(params) {
  const { carrierId, zoneCode, weight } = params
  
  const result = await calculateFreight({
    carrierId,
    zoneCode,
    weight,
    includeSurcharges: false
  })
  
  if (!result.success) {
    return result
  }
  
  return {
    success: true,
    data: {
      purchaseCost: result.data.purchaseCost,
      salesAmount: result.data.salesAmount,
      profit: result.data.profit,
      currency: result.data.currency
    }
  }
}

export default {
  calculateVolumeWeight,
  calculateChargeableWeight,
  matchZoneByPostalCode,
  findMatchingRate,
  getSurcharges,
  calculateFreight,
  calculateMultiCarrierQuotes,
  quickQuote
}
