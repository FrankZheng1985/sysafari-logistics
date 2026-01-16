/**
 * 税费计算服务
 * 实现关税、增值税、反倾销税、反补贴税计算
 * 支持完整的 Incoterms 2020 贸易条款和精准原产地税率匹配
 */

import { getDatabase } from '../../config/database.js'

// ==================== Incoterms 贸易条款定义 ====================

/**
 * Incoterms 2020 贸易条款
 * 用于计算完税价格
 */
export const INCOTERMS = {
  // E组 - 发货
  EXW: { code: 'EXW', name: 'Ex Works', nameCn: '工厂交货', group: 'E' },
  
  // F组 - 主运费未付
  FCA: { code: 'FCA', name: 'Free Carrier', nameCn: '货交承运人', group: 'F' },
  FAS: { code: 'FAS', name: 'Free Alongside Ship', nameCn: '船边交货', group: 'F' },
  FOB: { code: 'FOB', name: 'Free on Board', nameCn: '船上交货', group: 'F' },
  
  // C组 - 主运费已付
  CFR: { code: 'CFR', name: 'Cost and Freight', nameCn: '成本加运费', group: 'C' },
  CIF: { code: 'CIF', name: 'Cost, Insurance, Freight', nameCn: '成本、保险加运费', group: 'C' },
  CPT: { code: 'CPT', name: 'Carriage Paid To', nameCn: '运费付至', group: 'C' },
  CIP: { code: 'CIP', name: 'Carriage and Insurance Paid To', nameCn: '运费、保险费付至', group: 'C' },
  
  // D组 - 到达
  DAP: { code: 'DAP', name: 'Delivered at Place', nameCn: '目的地交货', group: 'D' },
  DPU: { code: 'DPU', name: 'Delivered at Place Unloaded', nameCn: '卸货地交货', group: 'D' },
  DDP: { code: 'DDP', name: 'Delivered Duty Paid', nameCn: '完税后交货', group: 'D' },
  
  // 旧版（仍常用）
  DDU: { code: 'DDU', name: 'Delivered Duty Unpaid', nameCn: '未完税交货', group: 'D' }
}

/**
 * 获取所有 Incoterms 列表
 */
export function getIncotermsList() {
  return Object.values(INCOTERMS)
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
 * 四舍五入到指定小数位
 */
function roundToDecimal(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

// ==================== 完税价格计算 ====================

/**
 * 根据 Incoterm 计算完税价格（CIF价格）
 * 
 * 完税价格计算规则（符合欧盟海关标准）：
 * - CIF/CIP: 完税价格 = 申报货值（已含国际运费+保险费）
 * - CFR/CPT: 完税价格 = 申报货值 + 保险费（已含国际运费）
 * - FOB/FCA/FAS: 完税价格 = 申报货值 + 国际运费 + 保险费
 * - EXW: 完税价格 = 申报货值 + 出口内陆运费 + 国际运费 + 保险费
 * - DAP/DDU: 完税价格 = 申报货值 - 进口国内陆运费（已含运费保险，需扣除进口国境内费用）
 * - DPU: 完税价格 = 申报货值 - 进口国内陆运费 - 卸货费
 * - DDP: 完税价格需反算（申报价值已包含关税和增值税）
 * 
 * @param {Object} params - 计算参数
 * @param {string} params.incoterm - 贸易条款代码
 * @param {number} params.declaredValue - 申报货值（发票金额）
 * @param {number} params.internationalFreight - 国际运费
 * @param {number} params.domesticFreightExport - 出口国内陆运费
 * @param {number} params.domesticFreightImport - 进口国内陆运费
 * @param {number} params.unloadingCost - 卸货费（DPU专用）
 * @param {number} params.insuranceCost - 保险费（如果为0，自动按货值0.3%估算）
 * @param {number} params.dutyRate - 关税率（百分比，如5表示5%）
 * @param {number} params.vatRate - 增值税率（百分比，如19表示19%）
 * @returns {Object} 完税价格计算结果
 */
export function calculateCustomsValue(params) {
  const {
    incoterm = 'FOB',
    declaredValue = 0,
    internationalFreight = 0,
    domesticFreightExport = 0,
    domesticFreightImport = 0,
    unloadingCost = 0,
    insuranceCost = 0,
    dutyRate = 0,
    vatRate = 19
  } = params
  
  const value = parseFloat(declaredValue) || 0
  const intlFreight = parseFloat(internationalFreight) || 0
  const domFreightExport = parseFloat(domesticFreightExport) || 0
  const domFreightImport = parseFloat(domesticFreightImport) || 0
  const unloading = parseFloat(unloadingCost) || 0
  
  // 保险费：如果未提供，按货值0.3%估算（欧盟海关常用估算比例）
  let insurance = parseFloat(insuranceCost) || 0
  const isInsuranceEstimated = insurance === 0
  if (isInsuranceEstimated && value > 0) {
    insurance = value * 0.003
  }
  
  let customsValue = 0
  let freightComponent = 0
  let insuranceComponent = insurance
  let calculation = ''
  let formulaDescription = ''
  
  const incotermUpper = incoterm.toUpperCase()
  
  switch (incotermUpper) {
    case 'CIF':
    case 'CIP':
      // 已含国际运费和保险费，直接使用
      customsValue = value
      freightComponent = 0
      insuranceComponent = 0
      calculation = `${value.toFixed(2)}`
      formulaDescription = 'CIF = 发票价（已含运费+保险）'
      break
      
    case 'CFR':
    case 'CPT':
      // 已含国际运费，需加保险费
      customsValue = value + insurance
      freightComponent = 0
      insuranceComponent = insurance
      calculation = `${value.toFixed(2)} + ${insurance.toFixed(2)}`
      formulaDescription = 'CIF = 发票价 + 保险费'
      break
      
    case 'FOB':
    case 'FCA':
    case 'FAS':
      // 需加国际运费和保险费
      customsValue = value + intlFreight + insurance
      freightComponent = intlFreight
      insuranceComponent = insurance
      calculation = `${value.toFixed(2)} + ${intlFreight.toFixed(2)} + ${insurance.toFixed(2)}`
      formulaDescription = 'CIF = 发票价 + 国际运费 + 保险费'
      break
      
    case 'EXW':
      // 需加出口内陆运费、国际运费和保险费
      customsValue = value + domFreightExport + intlFreight + insurance
      freightComponent = domFreightExport + intlFreight
      insuranceComponent = insurance
      calculation = `${value.toFixed(2)} + ${domFreightExport.toFixed(2)} + ${intlFreight.toFixed(2)} + ${insurance.toFixed(2)}`
      formulaDescription = 'CIF = 发票价 + 出口内陆运费 + 国际运费 + 保险费'
      break
      
    case 'DAP':
    case 'DDU':
      // 已含所有运费和保险，需扣除进口国内陆运费
      customsValue = value - domFreightImport
      freightComponent = -domFreightImport
      insuranceComponent = 0
      calculation = `${value.toFixed(2)} - ${domFreightImport.toFixed(2)}`
      formulaDescription = 'CIF = 发票价 - 进口内陆运费'
      break
      
    case 'DPU':
      // 已含所有费用，需扣除进口内陆运费和卸货费
      customsValue = value - domFreightImport - unloading
      freightComponent = -(domFreightImport + unloading)
      insuranceComponent = 0
      calculation = `${value.toFixed(2)} - ${domFreightImport.toFixed(2)} - ${unloading.toFixed(2)}`
      formulaDescription = 'CIF = 发票价 - 进口内陆运费 - 卸货费'
      break
      
    case 'DDP': {
      // DDP 反算：申报价值已包含关税和增值税
      // 设完税价格为 X
      // 申报价值 = X + X×关税率 + (X + X×关税率)×增值税率 + 进口内陆运费
      // 简化：申报价值 = X × (1 + 关税率) × (1 + 增值税率) + 进口内陆运费
      // 反推：X = (申报价值 - 进口内陆运费) / ((1 + 关税率) × (1 + 增值税率))
      const duty = parseFloat(dutyRate) / 100 || 0
      const vat = parseFloat(vatRate) / 100 || 0.19
      const divisor = (1 + duty) * (1 + vat)
      const netValue = value - domFreightImport
      customsValue = netValue / divisor
      freightComponent = -domFreightImport
      insuranceComponent = 0
      calculation = `(${value.toFixed(2)} - ${domFreightImport.toFixed(2)}) / ((1 + ${(duty * 100).toFixed(1)}%) × (1 + ${(vat * 100).toFixed(1)}%))`
      formulaDescription = 'CIF = (发票价 - 进口内陆运费) / ((1 + 关税率) × (1 + 增值税率))'
      break
    }
      
    default:
      // 默认按 FOB 处理
      customsValue = value + intlFreight + insurance
      freightComponent = intlFreight
      insuranceComponent = insurance
      calculation = `${value.toFixed(2)} + ${intlFreight.toFixed(2)} + ${insurance.toFixed(2)}`
      formulaDescription = 'CIF = 发票价 + 国际运费 + 保险费 [默认FOB]'
  }
  
  // 确保完税价格不为负数
  if (customsValue < 0) {
    customsValue = 0
  }
  
  return {
    customsValue: roundToDecimal(customsValue, 2),
    declaredValue: roundToDecimal(value, 2),
    freightComponent: roundToDecimal(freightComponent, 2),
    insuranceComponent: roundToDecimal(insuranceComponent, 2),
    unloadingCost: roundToDecimal(unloading, 2),
    isInsuranceEstimated,
    incoterm: incotermUpper,
    calculation,
    formulaDescription
  }
}

/**
 * 分摊运费和保险费到每个商品
 * 
 * @param {Array} items - 商品列表
 * @param {Object} params - 分摊参数
 * @param {number} params.totalFreight - 总运费
 * @param {number} params.totalInsurance - 总保险费
 * @param {string} params.method - 分摊方式: 'by_value' 按货值 | 'by_weight' 按重量
 * @returns {Array} 带分摊金额的商品列表
 */
export function allocateFreightAndInsurance(items, params) {
  const {
    totalFreight = 0,
    totalInsurance = 0,
    method = 'by_value'
  } = params
  
  if (!items || items.length === 0) {
    return []
  }
  
  const freight = parseFloat(totalFreight) || 0
  const insurance = parseFloat(totalInsurance) || 0
  
  // 计算分摊基数
  let totalBase = 0
  if (method === 'by_weight') {
    totalBase = items.reduce((sum, item) => sum + (parseFloat(item.grossWeight) || parseFloat(item.netWeight) || 0), 0)
  } else {
    totalBase = items.reduce((sum, item) => sum + (parseFloat(item.totalValue) || 0), 0)
  }
  
  if (totalBase === 0) {
    // 如果基数为0，平均分摊
    const avgFreight = freight / items.length
    const avgInsurance = insurance / items.length
    return items.map(item => ({
      ...item,
      freightAllocation: roundToDecimal(avgFreight, 2),
      insuranceAllocation: roundToDecimal(avgInsurance, 2)
    }))
  }
  
  // 按比例分摊
  return items.map(item => {
    let itemBase
    if (method === 'by_weight') {
      itemBase = parseFloat(item.grossWeight) || parseFloat(item.netWeight) || 0
    } else {
      itemBase = parseFloat(item.totalValue) || 0
    }
    
    const ratio = itemBase / totalBase
    const freightAllocation = freight * ratio
    const insuranceAllocation = insurance * ratio
    
    return {
      ...item,
      freightAllocation: roundToDecimal(freightAllocation, 2),
      insuranceAllocation: roundToDecimal(insuranceAllocation, 2)
    }
  })
}

// ==================== 原产地和材质税率匹配 ====================

/**
 * 根据 HS 编码、原产国和材质精确查询税率
 * 优先匹配特定原产国的税率（特别是反倾销税和反补贴税）
 * 如果提供了材质信息，会尝试匹配更精确的税率
 * 
 * @param {string} hsCode - HS编码
 * @param {string} originCountryCode - 原产国代码（ISO 2位）
 * @param {string} material - 材质信息（可选）
 * @returns {Object|null} 税率信息
 */
export async function getTariffByOrigin(hsCode, originCountryCode = 'CN', material = null) {
  const db = getDatabase()
  const normalizedHsCode = normalizeHsCode(hsCode)
  
  if (!normalizedHsCode) {
    return null
  }
  
  // 查询策略：
  // 1. 如果有材质，首先精确匹配 HS编码 + 原产国 + 材质
  // 2. 精确匹配 HS编码 + 原产国
  // 3. 如果没有，查找通用税率（origin_country_code 为空或 'ERGA_OMNES'）
  // 4. 如果还是没有，尝试前缀匹配
  
  let tariff = null
  
  // 第一步：如果有材质，尝试精确匹配 HS编码 + 原产国 + 材质
  if (material) {
    tariff = await db.prepare(`
      SELECT 
        id, hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, geographical_area, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        preferential_rate, third_country_duty,
        measure_type, data_source
      FROM tariff_rates 
      WHERE hs_code = $1 
        AND origin_country_code = $2
        AND (material ILIKE $3 OR goods_description ILIKE $3 OR goods_description_cn ILIKE $3)
        AND is_active = 1
      ORDER BY anti_dumping_rate DESC, duty_rate DESC
      LIMIT 1
    `).get(normalizedHsCode, originCountryCode, `%${material}%`)
    
    // 尝试无原产国限制的材质匹配
    if (!tariff) {
      tariff = await db.prepare(`
        SELECT 
          id, hs_code, hs_code_10, goods_description, goods_description_cn,
          origin_country, origin_country_code, geographical_area, material,
          duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
          preferential_rate, third_country_duty,
          measure_type, data_source
        FROM tariff_rates 
        WHERE hs_code = $1 
          AND (material ILIKE $2 OR goods_description ILIKE $2 OR goods_description_cn ILIKE $2)
          AND is_active = 1
        ORDER BY 
          CASE WHEN origin_country_code = $3 THEN 0 ELSE 1 END,
          anti_dumping_rate DESC, duty_rate DESC
        LIMIT 1
      `).get(normalizedHsCode, `%${material}%`, originCountryCode)
    }
  }
  
  // 第二步：精确匹配 HS编码 + 原产国
  if (!tariff) {
    tariff = await db.prepare(`
      SELECT 
        id, hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, geographical_area, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        preferential_rate, third_country_duty,
        measure_type, data_source
      FROM tariff_rates 
      WHERE hs_code = $1 
        AND origin_country_code = $2
        AND is_active = 1
      ORDER BY anti_dumping_rate DESC, duty_rate DESC
      LIMIT 1
    `).get(normalizedHsCode, originCountryCode)
  }
  
  // 第三步：查找通用税率
  if (!tariff) {
    tariff = await db.prepare(`
      SELECT 
        id, hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, geographical_area, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        preferential_rate, third_country_duty,
        measure_type, data_source
      FROM tariff_rates 
      WHERE hs_code = $1 
        AND (origin_country_code IS NULL OR origin_country_code = '' OR origin_country_code = 'ERGA_OMNES')
        AND is_active = 1
      ORDER BY duty_rate DESC
      LIMIT 1
    `).get(normalizedHsCode)
  }
  
  // 第四步：前缀匹配（8位）
  if (!tariff) {
    const prefix8 = normalizedHsCode.substring(0, 8)
    tariff = await db.prepare(`
      SELECT 
        id, hs_code, hs_code_10, goods_description, goods_description_cn,
        origin_country, origin_country_code, geographical_area, material,
        duty_rate, vat_rate, anti_dumping_rate, countervailing_rate,
        preferential_rate, third_country_duty,
        measure_type, data_source
      FROM tariff_rates 
      WHERE hs_code LIKE $1
        AND (origin_country_code = $2 OR origin_country_code IS NULL OR origin_country_code = '')
        AND is_active = 1
      ORDER BY 
        CASE WHEN origin_country_code = $2 THEN 0 ELSE 1 END,
        anti_dumping_rate DESC, duty_rate DESC
      LIMIT 1
    `).get(prefix8 + '%', originCountryCode)
  }
  
  if (!tariff) {
    return null
  }
  
  return {
    id: tariff.id,
    hsCode: tariff.hs_code,
    hsCode10: tariff.hs_code_10,
    goodsDescription: tariff.goods_description,
    goodsDescriptionCn: tariff.goods_description_cn,
    originCountry: tariff.origin_country,
    originCountryCode: tariff.origin_country_code,
    geographicalArea: tariff.geographical_area,
    material: tariff.material,
    dutyRate: parseFloat(tariff.duty_rate) || 0,
    vatRate: parseFloat(tariff.vat_rate) || 19,
    antiDumpingRate: parseFloat(tariff.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(tariff.countervailing_rate) || 0,
    preferentialRate: tariff.preferential_rate,
    thirdCountryDuty: tariff.third_country_duty,
    measureType: tariff.measure_type,
    dataSource: tariff.data_source
  }
}

// ==================== 税费计算 ====================

/**
 * 计算单个商品的税费
 * @param {Object} item - 商品数据
 * @param {number} item.customsValue - 完税价格（CIF价格）
 * @param {number} item.totalValue - 货值（兼容旧逻辑）
 * @param {number} item.dutyRate - 关税率(%)
 * @param {number} item.vatRate - 增值税率(%)
 * @param {number} item.antiDumpingRate - 反倾销税率(%)
 * @param {number} item.countervailingRate - 反补贴税率(%)
 */
export function calculateItemTax(item) {
  // 优先使用完税价格，如果没有则使用货值（兼容旧数据）
  const cifValue = parseFloat(item.customsValue) || parseFloat(item.totalValue) || 0
  const dutyRate = parseFloat(item.dutyRate) || 0
  const vatRate = parseFloat(item.vatRate) || 19 // 默认增值税率19%
  const antiDumpingRate = parseFloat(item.antiDumpingRate) || 0
  const countervailingRate = parseFloat(item.countervailingRate) || 0
  
  // 关税 = 完税价格 × 关税率
  const dutyAmount = cifValue * (dutyRate / 100)
  
  // 反倾销税 = 完税价格 × 反倾销税率
  const antiDumpingAmount = cifValue * (antiDumpingRate / 100)
  
  // 反补贴税 = 完税价格 × 反补贴税率
  const countervailingAmount = cifValue * (countervailingRate / 100)
  
  // 其他税费合计（反倾销+反补贴）
  const otherTaxAmount = antiDumpingAmount + countervailingAmount
  
  // 增值税 = (完税价格 + 关税 + 其他税) × 增值税率
  const vatBase = cifValue + dutyAmount + otherTaxAmount
  const vatAmount = vatBase * (vatRate / 100)
  
  // 总税费 = 关税 + 增值税 + 其他税费
  const totalTax = dutyAmount + vatAmount + otherTaxAmount
  
  return {
    customsValue: roundToDecimal(cifValue, 2),
    dutyAmount: roundToDecimal(dutyAmount, 2),
    vatAmount: roundToDecimal(vatAmount, 2),
    antiDumpingAmount: roundToDecimal(antiDumpingAmount, 2),
    countervailingAmount: roundToDecimal(countervailingAmount, 2),
    otherTaxAmount: roundToDecimal(otherTaxAmount, 2),
    totalTax: roundToDecimal(totalTax, 2)
  }
}

/**
 * 计算整个导入批次的税费（支持完税价格计算）
 * 
 * @param {number} importId - 导入批次ID
 * @param {Object} options - 计算选项
 * @param {boolean} options.recalculateCustomsValue - 是否重新计算完税价格
 * @param {boolean} options.updateOriginTariffs - 是否根据原产地更新税率
 */
export async function calculateImportTax(importId, options = {}) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const { recalculateCustomsValue = false, updateOriginTariffs = false } = options
  
  console.log(`[税费计算] 开始计算 importId=${importId}, options=`, options)
  
  // 获取批次信息（包含贸易条件）
  const batch = await db.prepare('SELECT * FROM cargo_imports WHERE id = ?').get(importId)
  if (!batch) {
    throw new Error('导入批次不存在')
  }
  
  console.log(`[税费计算] 批次信息: incoterm=${batch.incoterm}, domestic_freight_import=${batch.domestic_freight_import}, prepaid_duties=${batch.prepaid_duties}`)
  
  // 获取已匹配的货物明细
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = $1 AND match_status IN ('matched', 'auto_approved', 'approved')
  `).all(importId)
  
  // 如果需要重新计算完税价格，先分摊运费和保险费
  let itemsWithAllocation = rows.map(r => ({
    ...r,
    totalValue: parseFloat(r.total_value) || 0,
    grossWeight: parseFloat(r.gross_weight) || 0,
    netWeight: parseFloat(r.net_weight) || 0
  }))
  
  if (recalculateCustomsValue && batch.incoterm) {
    // 计算需要分摊的运费和保险费
    const incoterm = batch.incoterm || 'FOB'
    const intlFreight = parseFloat(batch.international_freight) || 0
    const domFreightExport = parseFloat(batch.domestic_freight_export) || 0
    const insurance = parseFloat(batch.insurance_cost) || 0
    
    // 根据 Incoterm 确定需要分摊的运费
    let totalFreightToAllocate = 0
    switch (incoterm.toUpperCase()) {
      case 'EXW':
        totalFreightToAllocate = domFreightExport + intlFreight
        break
      case 'FOB':
      case 'FCA':
      case 'FAS':
        totalFreightToAllocate = intlFreight
        break
      case 'CFR':
      case 'CPT':
      case 'CIF':
      case 'CIP':
      case 'DAP':
      case 'DPU':
      case 'DDU':
      case 'DDP':
        totalFreightToAllocate = 0 // 这些条款不需要额外加运费
        break
      default:
        totalFreightToAllocate = intlFreight
    }
    
    // 保险费估算（如果未提供）
    const totalValue = itemsWithAllocation.reduce((sum, item) => sum + item.totalValue, 0)
    const insuranceToAllocate = insurance > 0 ? insurance : (totalValue * 0.003)
    
    // 分摊运费和保险费
    const method = batch.freight_allocation_method || 'by_value'
    itemsWithAllocation = allocateFreightAndInsurance(itemsWithAllocation, {
      totalFreight: totalFreightToAllocate,
      totalInsurance: insuranceToAllocate,
      method
    })
  }
  
  let totalValue = 0
  let totalCustomsValue = 0
  let totalDuty = 0
  let totalVat = 0
  let totalOtherTax = 0
  let totalTax = 0
  
  const itemsWithTax = []
  
  for (const row of itemsWithAllocation) {
    // 如果需要根据原产地和材质更新税率
    let tariffData = null
    if (updateOriginTariffs) {
      const originCode = row.origin_country_code || 'CN'
      const hsCode = row.matched_hs_code
      const material = row.material || null  // 获取材质信息用于更精确的税率匹配
      if (hsCode) {
        tariffData = await getTariffByOrigin(hsCode, originCode, material)
      }
    }
    
    // 计算完税价格
    const declaredValue = parseFloat(row.total_value) || 0
    const freightAlloc = parseFloat(row.freightAllocation) || parseFloat(row.freight_allocation) || 0
    const insuranceAlloc = parseFloat(row.insuranceAllocation) || parseFloat(row.insurance_allocation) || 0
    
    // 获取当前行的税率（用于DDP反算）
    const currentDutyRate = tariffData?.dutyRate ?? parseFloat(row.duty_rate) ?? 0
    const currentVatRate = tariffData?.vatRate ?? parseFloat(row.vat_rate) ?? 19
    
    // 完税价格计算（根据 Incoterm 统一调用 calculateCustomsValue）
    let customsValue
    let calculationResult = null
    
    if (!recalculateCustomsValue) {
      customsValue = parseFloat(row.customs_value) || declaredValue
    } else {
      const incoterm = (batch.incoterm || 'FOB').toUpperCase()
      const domFreightImport = parseFloat(batch.domestic_freight_import) || 0
      const unloadingCost = parseFloat(batch.unloading_cost) || 0
      
      // 计算该商品分摊的进口内陆运费和卸货费（按货值比例）
      const totalBatchValue = itemsWithAllocation.reduce((sum, item) => sum + item.totalValue, 0)
      const itemShareRatio = totalBatchValue > 0 ? (declaredValue / totalBatchValue) : 0
      const itemDomFreightImportShare = domFreightImport * itemShareRatio
      const itemUnloadingShare = unloadingCost * itemShareRatio
      
      // 使用统一的 calculateCustomsValue 函数处理所有 Incoterms
      calculationResult = calculateCustomsValue({
        incoterm: incoterm,
        declaredValue: declaredValue,
        internationalFreight: freightAlloc,  // 已分摊的国际运费
        domesticFreightExport: 0,  // 出口内陆运费（通常在商品价格中）
        domesticFreightImport: itemDomFreightImportShare,
        unloadingCost: itemUnloadingShare,
        insuranceCost: insuranceAlloc,  // 已分摊的保险费
        dutyRate: currentDutyRate,
        vatRate: currentVatRate
      })
      
      customsValue = calculationResult.customsValue
      
      console.log(`[税费计算] 商品 ${row.id}: incoterm=${incoterm}, 公式=${calculationResult.formulaDescription}`)
      console.log(`[税费计算] 计算过程: ${calculationResult.calculation} = ${customsValue}`)
    }
    
    const item = {
      id: row.id,
      customsValue: roundToDecimal(customsValue, 2),
      totalValue: declaredValue,
      dutyRate: currentDutyRate,
      vatRate: currentVatRate,
      antiDumpingRate: tariffData?.antiDumpingRate ?? parseFloat(row.anti_dumping_rate) ?? 0,
      countervailingRate: tariffData?.countervailingRate ?? parseFloat(row.countervailing_rate) ?? 0
    }
    
    const taxResult = calculateItemTax(item)
    
    // 更新货物明细的税费和完税价格
    await db.prepare(`
      UPDATE cargo_items SET
        customs_value = $1,
        freight_allocation = $2,
        insurance_allocation = $3,
        duty_rate = $4,
        vat_rate = $5,
        anti_dumping_rate = $6,
        countervailing_rate = $7,
        duty_amount = $8,
        vat_amount = $9,
        other_tax_amount = $10,
        total_tax = $11,
        updated_at = $12
      WHERE id = $13
    `).run(
      item.customsValue,
      freightAlloc,
      insuranceAlloc,
      item.dutyRate,
      item.vatRate,
      item.antiDumpingRate,
      item.countervailingRate,
      taxResult.dutyAmount,
      taxResult.vatAmount,
      taxResult.otherTaxAmount,
      taxResult.totalTax,
      now,
      item.id
    )
    
    // 累计统计
    totalValue += declaredValue
    totalCustomsValue += item.customsValue
    totalDuty += taxResult.dutyAmount
    totalVat += taxResult.vatAmount
    totalOtherTax += taxResult.otherTaxAmount
    totalTax += taxResult.totalTax
    
    itemsWithTax.push({
      ...row,
      customsValue,
      freightAllocation: freightAlloc,
      insuranceAllocation: insuranceAlloc,
      ...taxResult,
      tariffUpdated: !!tariffData
    })
  }
  
  // 更新导入批次的税费统计
  await db.prepare(`
    UPDATE cargo_imports SET
      total_value = $1,
      total_customs_value = $2,
      total_duty = $3,
      total_vat = $4,
      total_other_tax = $5,
      updated_at = $6
    WHERE id = $7
  `).run(totalValue, totalCustomsValue, totalDuty, totalVat, totalOtherTax, now, importId)
  
  return {
    itemCount: rows.length,
    totalValue: roundToDecimal(totalValue, 2),
    totalCustomsValue: roundToDecimal(totalCustomsValue, 2),
    totalDuty: roundToDecimal(totalDuty, 2),
    totalVat: roundToDecimal(totalVat, 2),
    totalOtherTax: roundToDecimal(totalOtherTax, 2),
    totalTax: roundToDecimal(totalTax, 2),
    items: itemsWithTax
  }
}

/**
 * 更新贸易条件和运费信息
 * 
 * @param {number} importId - 导入批次ID
 * @param {Object} tradeTerms - 贸易条件数据
 */
export async function updateTradeTerms(importId, tradeTerms) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  const {
    incoterm,
    internationalFreight,
    domesticFreightExport,
    domesticFreightImport,
    unloadingCost,
    insuranceCost,
    prepaidDuties,
    freightAllocationMethod
  } = tradeTerms
  
  await db.prepare(`
    UPDATE cargo_imports SET
      incoterm = COALESCE($1, incoterm),
      international_freight = COALESCE($2, international_freight),
      domestic_freight_export = COALESCE($3, domestic_freight_export),
      domestic_freight_import = COALESCE($4, domestic_freight_import),
      unloading_cost = COALESCE($5, unloading_cost),
      insurance_cost = COALESCE($6, insurance_cost),
      prepaid_duties = COALESCE($7, prepaid_duties),
      freight_allocation_method = COALESCE($8, freight_allocation_method),
      updated_at = $9
    WHERE id = $10
  `).run(
    incoterm || null,
    internationalFreight ?? null,
    domesticFreightExport ?? null,
    domesticFreightImport ?? null,
    unloadingCost ?? null,
    insuranceCost ?? null,
    prepaidDuties ?? null,
    freightAllocationMethod || null,
    now,
    importId
  )
  
  return true
}

/**
 * 更新商品原产地
 * 
 * @param {number} itemId - 商品ID
 * @param {string} originCountryCode - 原产国代码
 * @param {boolean} updateTariff - 是否同时更新税率
 */
export async function updateItemOrigin(itemId, originCountryCode, updateTariff = true) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取当前商品信息
  const item = await db.prepare('SELECT * FROM cargo_items WHERE id = $1').get(itemId)
  if (!item) {
    throw new Error('商品不存在')
  }
  
  let tariffData = null
  if (updateTariff && item.matched_hs_code) {
    // 传入材质信息用于更精确的税率匹配
    tariffData = await getTariffByOrigin(item.matched_hs_code, originCountryCode, item.material)
  }
  
  // 更新原产地和税率
  if (tariffData) {
    await db.prepare(`
      UPDATE cargo_items SET
        origin_country_code = $1,
        duty_rate = $2,
        vat_rate = $3,
        anti_dumping_rate = $4,
        countervailing_rate = $5,
        updated_at = $6
      WHERE id = $7
    `).run(
      originCountryCode,
      tariffData.dutyRate,
      tariffData.vatRate,
      tariffData.antiDumpingRate,
      tariffData.countervailingRate,
      now,
      itemId
    )
  } else {
    await db.prepare(`
      UPDATE cargo_items SET
        origin_country_code = $1,
        updated_at = $2
      WHERE id = $3
    `).run(originCountryCode, now, itemId)
  }
  
  return {
    itemId,
    originCountryCode,
    tariffUpdated: !!tariffData,
    tariff: tariffData
  }
}

/**
 * 更新清关类型
 */
export async function updateClearanceType(importId, clearanceType) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE cargo_imports SET
      clearance_type = ?,
      updated_at = ?
    WHERE id = ?
  `).run(clearanceType, now, importId)
  
  return true
}

/**
 * 获取导入批次的税费详情（包含贸易条件和完税价格）
 */
export async function getTaxDetails(importId) {
  const db = getDatabase()
  
  // 获取批次信息
  const batch = await db.prepare('SELECT * FROM cargo_imports WHERE id = $1').get(importId)
  if (!batch) {
    return null
  }
  
  // 清关类型：40-普通清关，42-递延清关
  const clearanceType = batch.clearance_type || '40'
  const isDeferred = clearanceType === '42'
  
  // 贸易条件信息
  const incoterm = batch.incoterm || 'FOB'
  const incotermInfo = INCOTERMS[incoterm] || INCOTERMS.FOB
  
  // 获取货物明细
  const rows = await db.prepare(`
    SELECT * FROM cargo_items 
    WHERE import_id = $1 AND match_status IN ('matched', 'auto_approved', 'approved')
    ORDER BY item_no ASC
  `).all(importId)
  
  const items = rows.map(row => ({
    id: row.id,
    itemNo: row.item_no,
    productName: row.product_name,
    productNameEn: row.product_name_en,
    productImage: row.product_image || null,
    customerOrderNo: row.customer_order_no || null,
    palletCount: parseFloat(row.pallet_count) || 0,
    referenceNo: row.reference_no || null,
    matchedHsCode: row.matched_hs_code,
    quantity: parseFloat(row.quantity) || 0,
    unitName: row.unit_name,
    unitPrice: parseFloat(row.unit_price) || 0,
    totalValue: parseFloat(row.total_value) || 0,
    // 完税价格相关
    customsValue: parseFloat(row.customs_value) || parseFloat(row.total_value) || 0,
    freightAllocation: parseFloat(row.freight_allocation) || 0,
    insuranceAllocation: parseFloat(row.insurance_allocation) || 0,
    // 原产地
    originCountry: row.origin_country,
    originCountryCode: row.origin_country_code || 'CN',
    material: row.material,
    grossWeight: parseFloat(row.gross_weight) || 0,
    netWeight: parseFloat(row.net_weight) || 0,
    // 税率
    dutyRate: parseFloat(row.duty_rate) || 0,
    vatRate: parseFloat(row.vat_rate) || 19,
    antiDumpingRate: parseFloat(row.anti_dumping_rate) || 0,
    countervailingRate: parseFloat(row.countervailing_rate) || 0,
    // 税额
    dutyAmount: parseFloat(row.duty_amount) || 0,
    vatAmount: parseFloat(row.vat_amount) || 0,
    otherTaxAmount: parseFloat(row.other_tax_amount) || 0,
    totalTax: parseFloat(row.total_tax) || 0
  }))
  
  // 按HS编码分组统计
  const byHsCode = {}
  for (const item of items) {
    const key = item.matchedHsCode || 'unknown'
    if (!byHsCode[key]) {
      byHsCode[key] = {
        hsCode: key,
        itemCount: 0,
        totalValue: 0,
        totalCustomsValue: 0,
        totalDuty: 0,
        totalVat: 0,
        totalOtherTax: 0,
        totalTax: 0
      }
    }
    byHsCode[key].itemCount++
    byHsCode[key].totalValue += item.totalValue
    byHsCode[key].totalCustomsValue += item.customsValue
    byHsCode[key].totalDuty += item.dutyAmount
    byHsCode[key].totalVat += item.vatAmount
    byHsCode[key].totalOtherTax += item.otherTaxAmount
    byHsCode[key].totalTax += item.totalTax
  }
  
  // 根据清关类型计算实际应付税费
  const totalValue = parseFloat(batch.total_value) || 0
  const totalCustomsValue = parseFloat(batch.total_customs_value) || totalValue
  const totalDuty = parseFloat(batch.total_duty) || 0
  const totalVat = parseFloat(batch.total_vat) || 0
  const totalOtherTax = parseFloat(batch.total_other_tax) || 0
  
  // 42号递延清关：增值税递延，不在进口时缴纳
  const payableVat = isDeferred ? 0 : totalVat
  const deferredVat = isDeferred ? totalVat : 0
  
  return {
    batch: {
      id: batch.id,
      importNo: batch.import_no,
      customerId: batch.customer_id,
      customerName: batch.customer_name,
      containerNo: batch.container_no,
      billNumber: batch.bill_number,
      totalItems: batch.total_items,
      matchedItems: batch.matched_items,
      totalValue: totalValue,
      totalCustomsValue: totalCustomsValue,
      totalDuty: totalDuty,
      totalVat: totalVat,
      totalOtherTax: totalOtherTax,
      customerConfirmed: batch.customer_confirmed,
      customerConfirmedAt: batch.customer_confirmed_at,
      confirmPdfPath: batch.confirm_pdf_path,
      status: batch.status,
      clearanceType: clearanceType,
      // 贸易条件信息
      incoterm: incoterm,
      incotermName: incotermInfo.name,
      incotermNameCn: incotermInfo.nameCn,
      internationalFreight: parseFloat(batch.international_freight) || 0,
      domesticFreightExport: parseFloat(batch.domestic_freight_export) || 0,
      domesticFreightImport: parseFloat(batch.domestic_freight_import) || 0,
      unloadingCost: parseFloat(batch.unloading_cost) || 0,
      insuranceCost: parseFloat(batch.insurance_cost) || 0,
      prepaidDuties: parseFloat(batch.prepaid_duties) || 0,
      freightAllocationMethod: batch.freight_allocation_method || 'by_value',
      // 发货方信息
      shipperName: batch.shipper_name,
      shipperAddress: batch.shipper_address,
      shipperContact: batch.shipper_contact,
      // 进口商信息
      importerCustomerId: batch.importer_customer_id,
      importerName: batch.importer_name,
      importerTaxId: batch.importer_tax_id,
      importerTaxNumber: batch.importer_tax_number,
      importerTaxType: batch.importer_tax_type,
      importerCountry: batch.importer_country,
      importerCompanyName: batch.importer_company_name,
      importerAddress: batch.importer_address
    },
    items,
    summary: {
      totalValue: roundToDecimal(totalValue, 2),
      totalCustomsValue: roundToDecimal(totalCustomsValue, 2),
      totalDuty: roundToDecimal(totalDuty, 2),
      totalVat: roundToDecimal(totalVat, 2),           // 计算的增值税总额
      payableVat: roundToDecimal(payableVat, 2),       // 实际应付增值税
      deferredVat: roundToDecimal(deferredVat, 2),     // 递延增值税
      totalOtherTax: roundToDecimal(totalOtherTax, 2),
      // 实际应付税费 = 关税 + 应付增值税 + 其他税
      totalTax: roundToDecimal(totalDuty + payableVat + totalOtherTax, 2),
      // 贸易条件
      incoterm: incoterm,
      incotermLabel: `${incoterm} - ${incotermInfo.nameCn}`,
      // 递延清关说明
      clearanceType: clearanceType,
      clearanceTypeLabel: clearanceType === '42' ? '42号递延清关' : '40号普通清关',
      isDeferred: isDeferred
    },
    byHsCode: Object.values(byHsCode)
  }
}

/**
 * 标记客户已确认
 */
export async function markCustomerConfirmed(importId, confirmedBy) {
  const db = getDatabase()
  const now = new Date().toISOString()

  await db.prepare(`
    UPDATE cargo_imports SET
      customer_confirmed = 1,
      customer_confirmed_at = ?,
      customer_confirmed_by = ?,
      status = 'confirmed',
      updated_at = ?
    WHERE id = ?
  `).run(now, confirmedBy, now, importId)

  // 确认后自动保存到匹配记录表
  try {
    const hsMatchRecords = await import('./hsMatchRecords.js')
    const taxDetails = await getTaxDetails(importId)
    if (taxDetails && taxDetails.items) {
      await hsMatchRecords.batchSaveFromTaxCalc(
        importId,
        taxDetails.items.map(item => ({
          ...item,
          importNo: taxDetails.importNo,
          containerNo: taxDetails.containerNo,
          customerName: taxDetails.customerName
        }))
      )
      console.log(`✅ 已保存 ${taxDetails.items.length} 条匹配记录到 hs_match_records`)
    }
  } catch (error) {
    // 保存匹配记录失败不影响主流程
    console.error('保存匹配记录失败:', error.message)
  }

  return true
}

/**
 * 更新PDF路径
 */
export async function updateConfirmPdfPath(importId, pdfPath) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  await db.prepare(`
    UPDATE cargo_imports SET
      confirm_pdf_path = ?,
      updated_at = ?
    WHERE id = ?
  `).run(pdfPath, now, importId)
  
  return true
}

/**
 * 更新单个商品的税费信息
 * @param {number} itemId - 商品ID
 * @param {Object} updates - 更新的字段
 */
export async function updateCargoItemTax(itemId, updates) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 获取当前商品信息
  const item = await db.prepare('SELECT * FROM cargo_items WHERE id = ?').get(itemId)
  if (!item) {
    throw new Error('商品不存在')
  }
  
  // 如果修改了HS编码，尝试从税率库获取新的税率
  let newTariffData = null
  // 规范化 HS 编码为 10 位
  const normalizedInputHsCode = updates.matchedHsCode ? normalizeHsCode(updates.matchedHsCode) : null
  const matchedHsCode = normalizedInputHsCode || item.matched_hs_code
  
  if (normalizedInputHsCode && normalizedInputHsCode !== item.matched_hs_code) {
    // HS编码发生变化，尝试从税率库获取税率
    // 优先精确匹配 10 位编码
    let tariff = await db.prepare(`
      SELECT duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, goods_description_cn, hs_code
      FROM tariff_rates 
      WHERE hs_code = ?
    `).get(normalizedInputHsCode)
    
    // 如果精确匹配失败，尝试前缀匹配
    if (!tariff) {
      tariff = await db.prepare(`
        SELECT duty_rate, vat_rate, anti_dumping_rate, countervailing_rate, goods_description_cn, hs_code
        FROM tariff_rates 
        WHERE hs_code LIKE ?
        ORDER BY hs_code ASC
        LIMIT 1
      `).get(normalizedInputHsCode.substring(0, 8) + '%')
    }
    
    if (tariff) {
      newTariffData = {
        dutyRate: parseFloat(tariff.duty_rate) || 0,
        vatRate: parseFloat(tariff.vat_rate) || 19,
        antiDumpingRate: parseFloat(tariff.anti_dumping_rate) || 0,
        countervailingRate: parseFloat(tariff.countervailing_rate) || 0
      }
    }
  }
  
  // 合并更新字段（如果有新税率数据且用户没有手动指定，则使用新税率）
  const totalValue = updates.totalValue !== undefined ? parseFloat(updates.totalValue) : parseFloat(item.total_value) || 0
  const dutyRate = updates.dutyRate !== undefined ? parseFloat(updates.dutyRate) : 
                   (newTariffData ? newTariffData.dutyRate : parseFloat(item.duty_rate) || 0)
  const vatRate = updates.vatRate !== undefined ? parseFloat(updates.vatRate) : 
                  (newTariffData ? newTariffData.vatRate : parseFloat(item.vat_rate) || 19)
  const antiDumpingRate = updates.antiDumpingRate !== undefined ? parseFloat(updates.antiDumpingRate) : 
                          (newTariffData ? newTariffData.antiDumpingRate : parseFloat(item.anti_dumping_rate) || 0)
  const countervailingRate = updates.countervailingRate !== undefined ? parseFloat(updates.countervailingRate) : 
                             (newTariffData ? newTariffData.countervailingRate : parseFloat(item.countervailing_rate) || 0)
  
  // 重新计算税费
  const taxResult = calculateItemTax({
    totalValue,
    dutyRate,
    vatRate,
    antiDumpingRate,
    countervailingRate
  })
  
  // 获取商品品名（如果有更新）
  const productName = updates.productName !== undefined ? updates.productName : item.product_name

  // 更新商品信息
  await db.prepare(`
    UPDATE cargo_items SET
      product_name = ?,
      matched_hs_code = ?,
      total_value = ?,
      duty_rate = ?,
      vat_rate = ?,
      anti_dumping_rate = ?,
      countervailing_rate = ?,
      duty_amount = ?,
      vat_amount = ?,
      other_tax_amount = ?,
      total_tax = ?,
      match_status = 'approved',
      updated_at = ?
    WHERE id = ?
  `).run(
    productName,
    matchedHsCode,
    totalValue,
    dutyRate,
    vatRate,
    antiDumpingRate,
    countervailingRate,
    taxResult.dutyAmount,
    taxResult.vatAmount,
    taxResult.otherTaxAmount,
    taxResult.totalTax,
    now,
    itemId
  )
  
  // 更新导入批次的汇总
  await updateImportSummary(item.import_id)
  
  return {
    id: itemId,
    matchedHsCode,
    totalValue,
    dutyRate,
    vatRate,
    antiDumpingRate,
    countervailingRate,
    ...taxResult,
    tariffUpdated: !!newTariffData
  }
}

/**
 * 更新导入批次的税费汇总
 */
async function updateImportSummary(importId) {
  const db = getDatabase()
  const now = new Date().toISOString()
  
  // 重新计算汇总
  const summary = await db.prepare(`
    SELECT 
      COALESCE(SUM(total_value), 0) as total_value,
      COALESCE(SUM(duty_amount), 0) as total_duty,
      COALESCE(SUM(vat_amount), 0) as total_vat,
      COALESCE(SUM(other_tax_amount), 0) as total_other_tax
    FROM cargo_items 
    WHERE import_id = ? AND match_status IN ('matched', 'auto_approved', 'approved')
  `).get(importId)
  
  // 更新导入批次
  await db.prepare(`
    UPDATE cargo_imports SET
      total_value = ?,
      total_duty = ?,
      total_vat = ?,
      total_other_tax = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    summary.total_value,
    summary.total_duty,
    summary.total_vat,
    summary.total_other_tax,
    now,
    importId
  )
}

/**
 * 获取统计数据
 */
export async function getDocumentStats() {
  const db = getDatabase()
  
  // 基础统计
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_imports,
      SUM(CASE WHEN status = 'pending' OR status = 'matching' THEN 1 ELSE 0 END) as pending_matching,
      SUM(CASE WHEN status = 'reviewing' THEN 1 ELSE 0 END) as pending_review,
      SUM(CASE WHEN status IN ('confirmed', 'completed') THEN 1 ELSE 0 END) as completed,
      COALESCE(SUM(total_value), 0) as total_value,
      COALESCE(SUM(total_duty + total_vat + total_other_tax), 0) as total_duty
    FROM cargo_imports
  `).get()
  
  // 最近导入记录
  const recentImports = await db.prepare(`
    SELECT
      id, import_no, order_no, customer_name, container_no, bill_number,
      total_items, matched_items, status, created_at
    FROM cargo_imports
    ORDER BY created_at DESC
    LIMIT 10
  `).all()
  
  return {
    totalImports: parseInt(stats?.total_imports) || 0,
    pendingMatching: parseInt(stats?.pending_matching) || 0,
    pendingReview: parseInt(stats?.pending_review) || 0,
    completed: parseInt(stats?.completed) || 0,
    totalValue: parseFloat(stats?.total_value) || 0,
    totalDuty: parseFloat(stats?.total_duty) || 0,
    recentImports: (recentImports || []).map(row => ({
      id: row.id,
      importNo: row.import_no,
      orderNo: row.order_no,
      customerName: row.customer_name,
      containerNo: row.container_no,
      billNumber: row.bill_number,
      totalItems: row.total_items,
      matchedItems: row.matched_items,
      status: row.status,
      createdAt: row.created_at
    }))
  }
}

export default {
  // Incoterms
  INCOTERMS,
  getIncotermsList,
  // 完税价格计算
  calculateCustomsValue,
  allocateFreightAndInsurance,
  // 原产地税率匹配
  getTariffByOrigin,
  // 税费计算
  calculateItemTax,
  calculateImportTax,
  getTaxDetails,
  // 贸易条件更新
  updateTradeTerms,
  updateItemOrigin,
  // 其他
  markCustomerConfirmed,
  updateConfirmPdfPath,
  updateCargoItemTax,
  getDocumentStats
}
