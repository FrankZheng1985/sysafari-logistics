/**
 * 报价计算器
 * 用于计算清关费用和综合报价
 */

import { calculateItemTax } from '../cargo/taxCalc.js'

// ==================== 清关费用配置 ====================

// 基础清关费用
export const CLEARANCE_FEES = {
  // 基础清关费
  BASE_FEE: 100,              // EUR
  
  // 按HS CODE数量计费
  HS_CODE_FEE: 15,            // 每个HS CODE EUR
  HS_CODE_FREE_COUNT: 3,      // 免费HS CODE数量
  
  // 按货值计费（阶梯费率）
  VALUE_TIERS: [
    { max: 5000, rate: 0.005 },     // 货值 ≤ 5000: 0.5%
    { max: 20000, rate: 0.004 },    // 5000 < 货值 ≤ 20000: 0.4%
    { max: 50000, rate: 0.003 },    // 20000 < 货值 ≤ 50000: 0.3%
    { max: Infinity, rate: 0.002 }  // 货值 > 50000: 0.2%
  ],
  
  // 最低清关费
  MIN_CLEARANCE_FEE: 150,     // EUR
  
  // 附加费用
  TAX_NUMBER_FEE: 400,        // 税号使用费（如果客户没有税号）
  SPECIAL_GOODS_FEE: 50,      // 特殊商品处理费
  WEEKEND_FEE: 80,            // 周末加急费
  EXPRESS_FEE: 150            // 加急处理费
}

/**
 * 计算清关费用
 * @param {Object} clearanceData - 清关数据
 * @param {Array} clearanceData.items - 货物明细
 * @param {number} clearanceData.totalValue - 货物总值
 * @param {number} clearanceData.hsCodeCount - HS CODE 数量
 * @param {boolean} clearanceData.hasTaxNumber - 是否有税号
 * @param {boolean} clearanceData.isSpecialGoods - 是否特殊商品
 * @param {boolean} clearanceData.isExpress - 是否加急
 */
export function calculateClearanceFee(clearanceData) {
  const {
    items = [],
    totalValue = 0,
    hsCodeCount = 0,
    hasTaxNumber = true,
    isSpecialGoods = false,
    isExpress = false
  } = clearanceData
  
  let fee = CLEARANCE_FEES.BASE_FEE
  const breakdown = {
    baseFee: CLEARANCE_FEES.BASE_FEE
  }
  
  // HS CODE 费用
  const chargeableHsCodes = Math.max(0, hsCodeCount - CLEARANCE_FEES.HS_CODE_FREE_COUNT)
  if (chargeableHsCodes > 0) {
    const hsCodeFee = chargeableHsCodes * CLEARANCE_FEES.HS_CODE_FEE
    fee += hsCodeFee
    breakdown.hsCodeFee = hsCodeFee
    breakdown.hsCodeCount = hsCodeCount
    breakdown.chargeableHsCodes = chargeableHsCodes
  }
  
  // 货值服务费（阶梯计算）
  if (totalValue > 0) {
    let valueFee = 0
    let remainingValue = totalValue
    let prevMax = 0
    
    for (const tier of CLEARANCE_FEES.VALUE_TIERS) {
      if (remainingValue <= 0) break
      
      const tierValue = Math.min(remainingValue, tier.max - prevMax)
      valueFee += tierValue * tier.rate
      remainingValue -= tierValue
      prevMax = tier.max
    }
    
    fee += valueFee
    breakdown.valueFee = Math.round(valueFee * 100) / 100
    breakdown.totalValue = totalValue
  }
  
  // 税号使用费
  if (!hasTaxNumber) {
    fee += CLEARANCE_FEES.TAX_NUMBER_FEE
    breakdown.taxNumberFee = CLEARANCE_FEES.TAX_NUMBER_FEE
  }
  
  // 特殊商品处理费
  if (isSpecialGoods) {
    fee += CLEARANCE_FEES.SPECIAL_GOODS_FEE
    breakdown.specialGoodsFee = CLEARANCE_FEES.SPECIAL_GOODS_FEE
  }
  
  // 加急费
  if (isExpress) {
    fee += CLEARANCE_FEES.EXPRESS_FEE
    breakdown.expressFee = CLEARANCE_FEES.EXPRESS_FEE
  }
  
  // 应用最低费用
  if (fee < CLEARANCE_FEES.MIN_CLEARANCE_FEE) {
    fee = CLEARANCE_FEES.MIN_CLEARANCE_FEE
    breakdown.appliedMinFee = true
  }
  
  return {
    clearanceFee: Math.round(fee * 100) / 100,
    breakdown,
    currency: 'EUR'
  }
}

/**
 * 估算关税和增值税
 * @param {Array} items - 货物明细
 */
export function estimateTaxes(items) {
  let totalDuty = 0
  let totalVat = 0
  let totalOtherTax = 0
  let totalValue = 0
  
  const itemsWithTax = items.map(item => {
    const taxResult = calculateItemTax({
      totalValue: item.value || item.cifValue || 0,
      dutyRate: item.dutyRate || 0,
      vatRate: item.vatRate || 19, // 默认德国增值税率
      antiDumpingRate: item.antiDumpingRate || 0,
      countervailingRate: item.countervailingRate || 0
    })
    
    totalDuty += taxResult.dutyAmount
    totalVat += taxResult.vatAmount
    totalOtherTax += taxResult.otherTaxAmount
    totalValue += parseFloat(item.value || item.cifValue || 0)
    
    return {
      ...item,
      tax: taxResult
    }
  })
  
  return {
    items: itemsWithTax,
    summary: {
      totalValue: Math.round(totalValue * 100) / 100,
      totalDuty: Math.round(totalDuty * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalOtherTax: Math.round(totalOtherTax * 100) / 100,
      totalTax: Math.round((totalDuty + totalVat + totalOtherTax) * 100) / 100
    },
    currency: 'EUR'
  }
}

/**
 * 计算综合报价（清关 + 运输）
 */
export function calculateTotalQuote(params) {
  const {
    clearanceResult,   // 清关费用计算结果
    taxResult,         // 关税估算结果
    transportResult    // 运输费用计算结果
  } = params
  
  let totalQuote = 0
  const breakdown = {}
  
  // 清关费用
  if (clearanceResult) {
    totalQuote += clearanceResult.clearanceFee
    breakdown.clearanceFee = clearanceResult.clearanceFee
    breakdown.clearanceBreakdown = clearanceResult.breakdown
  }
  
  // 预估税费（不计入报价，仅供参考）
  if (taxResult) {
    breakdown.estimatedDuty = taxResult.summary.totalDuty
    breakdown.estimatedVat = taxResult.summary.totalVat
    breakdown.estimatedOtherTax = taxResult.summary.totalOtherTax
    breakdown.estimatedTotalTax = taxResult.summary.totalTax
  }
  
  // 运输费用
  if (transportResult) {
    totalQuote += transportResult.totalCost
    breakdown.transportFee = transportResult.totalCost
    breakdown.transportBreakdown = transportResult.breakdown
    breakdown.tolls = transportResult.tolls
    breakdown.fuelSurcharge = transportResult.fuelSurcharge
  }
  
  return {
    totalQuote: Math.round(totalQuote * 100) / 100,
    breakdown,
    currency: 'EUR',
    // 生成有效期（7天后）
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
}

/**
 * 根据货物重量和体积推荐卡车
 */
export function recommendTruckByGoods(goods) {
  const { weight = 0, volume = 0, isRefrigerated = false, isHazardous = false } = goods
  
  let category = 'van'
  
  // 根据特殊需求确定类别
  if (isHazardous) {
    category = 'hazmat'
  } else if (isRefrigerated) {
    category = 'reefer'
  } else if (weight > 10000 || volume > 50) {
    category = 'semi'
  } else if (weight > 5000 || volume > 30) {
    category = 'box'
  }
  
  return {
    recommendedCategory: category,
    weight,
    volume,
    criteria: {
      isRefrigerated,
      isHazardous
    }
  }
}

export default {
  CLEARANCE_FEES,
  calculateClearanceFee,
  estimateTaxes,
  calculateTotalQuote,
  recommendTruckByGoods
}

