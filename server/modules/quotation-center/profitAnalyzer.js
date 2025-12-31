/**
 * 利润分析器
 * 提供费率卡利润分析、承运商成本对比等功能
 */

import { getDatabase } from '../../config/database.js'

/**
 * 计算单个运单的利润
 * @param {Object} params - 计算参数
 * @param {number} params.purchaseCost - 采购成本
 * @param {number} params.salesAmount - 销售金额
 * @param {Array} params.surcharges - 附加费列表
 * @returns {Object} 利润分析结果
 */
export function calculateShipmentProfit(params) {
  const { purchaseCost = 0, salesAmount = 0, surcharges = [] } = params
  
  // 计算附加费
  let purchaseSurcharges = 0
  let salesSurcharges = 0
  
  surcharges.forEach(surcharge => {
    if (surcharge.chargeType === 'fixed') {
      purchaseSurcharges += surcharge.purchaseAmount || 0
      salesSurcharges += surcharge.salesAmount || 0
    } else if (surcharge.chargeType === 'percentage') {
      const rate = (surcharge.percentage || 0) / 100
      purchaseSurcharges += purchaseCost * rate
      salesSurcharges += salesAmount * rate
    }
  })
  
  const totalPurchase = purchaseCost + purchaseSurcharges
  const totalSales = salesAmount + salesSurcharges
  const profit = totalSales - totalPurchase
  const profitRate = totalPurchase > 0 ? (profit / totalPurchase * 100) : 0
  
  return {
    purchaseCost,
    purchaseSurcharges,
    totalPurchase,
    salesAmount,
    salesSurcharges,
    totalSales,
    profit,
    profitRate: parseFloat(profitRate.toFixed(2))
  }
}

/**
 * 批量计算利润（根据利润率自动设置销售价）
 * @param {number} purchasePrice - 采购价
 * @param {number} marginRate - 目标利润率（百分比）
 * @returns {Object} 计算结果
 */
export function calculateSalesPriceByMargin(purchasePrice, marginRate) {
  if (!purchasePrice || purchasePrice <= 0) {
    return { salesPrice: 0, marginAmount: 0 }
  }
  
  const marginAmount = purchasePrice * (marginRate / 100)
  const salesPrice = purchasePrice + marginAmount
  
  return {
    salesPrice: parseFloat(salesPrice.toFixed(2)),
    marginAmount: parseFloat(marginAmount.toFixed(2))
  }
}

/**
 * 根据销售价反推利润率
 * @param {number} purchasePrice - 采购价
 * @param {number} salesPrice - 销售价
 * @returns {Object} 计算结果
 */
export function calculateMarginFromPrices(purchasePrice, salesPrice) {
  if (!purchasePrice || purchasePrice <= 0) {
    return { marginRate: 0, marginAmount: 0 }
  }
  
  const marginAmount = salesPrice - purchasePrice
  const marginRate = (marginAmount / purchasePrice) * 100
  
  return {
    marginRate: parseFloat(marginRate.toFixed(2)),
    marginAmount: parseFloat(marginAmount.toFixed(2))
  }
}

/**
 * 批量应用利润率到费率明细
 * @param {Array} tiers - 费率明细列表
 * @param {number} marginRate - 目标利润率
 * @returns {Array} 更新后的费率明细
 */
export function applyMarginToTiers(tiers, marginRate) {
  return tiers.map(tier => {
    if (tier.purchasePrice && tier.purchasePrice > 0) {
      const result = calculateSalesPriceByMargin(tier.purchasePrice, marginRate)
      return {
        ...tier,
        salesPrice: result.salesPrice,
        marginRate,
        marginAmount: result.marginAmount
      }
    }
    return tier
  })
}

/**
 * 分析费率卡的利润分布
 * @param {Array} tiers - 费率明细列表
 * @returns {Object} 利润分析结果
 */
export function analyzeRateCardProfit(tiers) {
  const validTiers = tiers.filter(t => t.purchasePrice && t.salesPrice)
  
  if (validTiers.length === 0) {
    return {
      tierCount: tiers.length,
      pricedCount: 0,
      profitStats: null
    }
  }
  
  const profits = validTiers.map(t => ({
    zoneCode: t.zoneCode,
    weightRange: `${t.weightFrom}-${t.weightTo}`,
    purchasePrice: t.purchasePrice,
    salesPrice: t.salesPrice,
    profit: t.salesPrice - t.purchasePrice,
    profitRate: ((t.salesPrice - t.purchasePrice) / t.purchasePrice * 100).toFixed(2)
  }))
  
  const profitAmounts = profits.map(p => p.profit)
  const profitRates = profits.map(p => parseFloat(p.profitRate))
  
  return {
    tierCount: tiers.length,
    pricedCount: validTiers.length,
    profitStats: {
      minProfit: Math.min(...profitAmounts),
      maxProfit: Math.max(...profitAmounts),
      avgProfit: parseFloat((profitAmounts.reduce((a, b) => a + b, 0) / profitAmounts.length).toFixed(2)),
      minProfitRate: Math.min(...profitRates),
      maxProfitRate: Math.max(...profitRates),
      avgProfitRate: parseFloat((profitRates.reduce((a, b) => a + b, 0) / profitRates.length).toFixed(2))
    },
    details: profits
  }
}

/**
 * 按Zone分组分析利润
 * @param {Array} tiers - 费率明细列表
 * @returns {Object} 按Zone分组的利润分析
 */
export function analyzeByZone(tiers) {
  const zoneGroups = {}
  
  tiers.forEach(tier => {
    const zone = tier.zoneCode || 'default'
    if (!zoneGroups[zone]) {
      zoneGroups[zone] = []
    }
    zoneGroups[zone].push(tier)
  })
  
  const result = {}
  
  Object.entries(zoneGroups).forEach(([zone, zoneTiers]) => {
    const validTiers = zoneTiers.filter(t => t.purchasePrice && t.salesPrice)
    
    if (validTiers.length === 0) {
      result[zone] = {
        tierCount: zoneTiers.length,
        pricedCount: 0,
        avgPurchase: null,
        avgSales: null,
        avgProfit: null,
        avgProfitRate: null
      }
      return
    }
    
    const purchases = validTiers.map(t => t.purchasePrice)
    const sales = validTiers.map(t => t.salesPrice)
    const profits = validTiers.map(t => t.salesPrice - t.purchasePrice)
    const profitRates = validTiers.map(t => (t.salesPrice - t.purchasePrice) / t.purchasePrice * 100)
    
    result[zone] = {
      tierCount: zoneTiers.length,
      pricedCount: validTiers.length,
      avgPurchase: parseFloat((purchases.reduce((a, b) => a + b, 0) / purchases.length).toFixed(2)),
      avgSales: parseFloat((sales.reduce((a, b) => a + b, 0) / sales.length).toFixed(2)),
      avgProfit: parseFloat((profits.reduce((a, b) => a + b, 0) / profits.length).toFixed(2)),
      avgProfitRate: parseFloat((profitRates.reduce((a, b) => a + b, 0) / profitRates.length).toFixed(2))
    }
  })
  
  return result
}

/**
 * 获取月度利润趋势
 */
export async function getMonthlyProfitTrend(params = {}) {
  const db = getDatabase()
  const { carrierId, months = 12 } = params
  
  let query = `
    SELECT 
      to_char(created_at, 'YYYY-MM') as month,
      carrier_code,
      COUNT(*) as shipment_count,
      SUM(purchase_cost) as total_purchase,
      SUM(sales_amount) as total_sales,
      SUM(profit_amount) as total_profit
    FROM last_mile_shipments
    WHERE status IN ('created', 'in_transit', 'delivered')
    AND created_at >= NOW() - INTERVAL '${months} months'
  `
  const queryParams = []
  
  if (carrierId) {
    query += ' AND carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  query += ' GROUP BY to_char(created_at, \'YYYY-MM\'), carrier_code ORDER BY month DESC'
  
  const results = await db.prepare(query).all(...queryParams)
  
  return results.map(r => ({
    month: r.month,
    carrierCode: r.carrier_code,
    shipmentCount: r.shipment_count,
    totalPurchase: r.total_purchase ? parseFloat(r.total_purchase) : 0,
    totalSales: r.total_sales ? parseFloat(r.total_sales) : 0,
    totalProfit: r.total_profit ? parseFloat(r.total_profit) : 0,
    avgProfitRate: r.total_purchase > 0 
      ? parseFloat(((r.total_profit || 0) / r.total_purchase * 100).toFixed(2))
      : 0
  }))
}

/**
 * 获取Zone利润排名
 */
export async function getZoneProfitRanking(params = {}) {
  const db = getDatabase()
  const { carrierId, startDate, endDate } = params
  
  let query = `
    SELECT 
      zone_code,
      COUNT(*) as shipment_count,
      SUM(weight) as total_weight,
      SUM(purchase_cost) as total_purchase,
      SUM(sales_amount) as total_sales,
      SUM(profit_amount) as total_profit,
      AVG(profit_amount) as avg_profit
    FROM last_mile_shipments
    WHERE status IN ('created', 'in_transit', 'delivered')
    AND zone_code IS NOT NULL
  `
  const queryParams = []
  
  if (carrierId) {
    query += ' AND carrier_id = ?'
    queryParams.push(carrierId)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  query += ' GROUP BY zone_code ORDER BY total_profit DESC'
  
  const results = await db.prepare(query).all(...queryParams)
  
  return results.map((r, index) => ({
    rank: index + 1,
    zoneCode: r.zone_code,
    shipmentCount: r.shipment_count,
    totalWeight: r.total_weight ? parseFloat(r.total_weight) : 0,
    totalPurchase: r.total_purchase ? parseFloat(r.total_purchase) : 0,
    totalSales: r.total_sales ? parseFloat(r.total_sales) : 0,
    totalProfit: r.total_profit ? parseFloat(r.total_profit) : 0,
    avgProfit: r.avg_profit ? parseFloat(r.avg_profit.toFixed(2)) : 0,
    profitRate: r.total_purchase > 0 
      ? parseFloat(((r.total_profit || 0) / r.total_purchase * 100).toFixed(2))
      : 0
  }))
}

export default {
  calculateShipmentProfit,
  calculateSalesPriceByMargin,
  calculateMarginFromPrices,
  applyMarginToTiers,
  analyzeRateCardProfit,
  analyzeByZone,
  getMonthlyProfitTrend,
  getZoneProfitRanking
}
