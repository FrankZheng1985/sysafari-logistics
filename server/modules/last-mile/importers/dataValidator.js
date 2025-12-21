/**
 * 报价数据校验器
 * 验证导入数据的完整性和正确性
 */

/**
 * 校验导入的费率数据
 * @param {Array} rates - 费率数据数组
 * @param {Object} options - 校验选项
 * @returns {Object} 校验结果
 */
export function validateRates(rates, options = {}) {
  const {
    requirePurchasePrice = true,
    requireSalesPrice = false,
    allowNegativePrice = false,
    maxPrice = 10000,
    minWeight = 0,
    maxWeight = 10000
  } = options

  const errors = []
  const warnings = []
  const validRates = []
  const invalidRates = []

  rates.forEach((rate, index) => {
    const rowErrors = []
    const rowWarnings = []
    const rowNum = rate.rowNumber || (index + 1)

    // Zone校验
    if (!rate.zoneCode || String(rate.zoneCode).trim() === '') {
      rowErrors.push(`第${rowNum}行: Zone不能为空`)
    }

    // 重量校验
    if (rate.weightFrom === null || rate.weightFrom === undefined) {
      rowErrors.push(`第${rowNum}行: 起始重量不能为空`)
    } else if (rate.weightFrom < minWeight) {
      rowErrors.push(`第${rowNum}行: 起始重量不能小于${minWeight}`)
    } else if (rate.weightFrom > maxWeight) {
      rowErrors.push(`第${rowNum}行: 起始重量超过最大值${maxWeight}`)
    }

    if (rate.weightTo === null || rate.weightTo === undefined) {
      rowErrors.push(`第${rowNum}行: 截止重量不能为空`)
    } else if (rate.weightTo < rate.weightFrom) {
      rowErrors.push(`第${rowNum}行: 截止重量不能小于起始重量`)
    } else if (rate.weightTo > maxWeight) {
      rowWarnings.push(`第${rowNum}行: 截止重量超过${maxWeight}，请确认`)
    }

    // 价格校验
    if (requirePurchasePrice && (rate.purchasePrice === null || rate.purchasePrice === undefined)) {
      rowErrors.push(`第${rowNum}行: 采购价不能为空`)
    }

    if (requireSalesPrice && (rate.salesPrice === null || rate.salesPrice === undefined)) {
      rowErrors.push(`第${rowNum}行: 销售价不能为空`)
    }

    if (!allowNegativePrice) {
      if (rate.purchasePrice !== null && rate.purchasePrice < 0) {
        rowErrors.push(`第${rowNum}行: 采购价不能为负数`)
      }
      if (rate.salesPrice !== null && rate.salesPrice < 0) {
        rowErrors.push(`第${rowNum}行: 销售价不能为负数`)
      }
    }

    if (rate.purchasePrice !== null && rate.purchasePrice > maxPrice) {
      rowWarnings.push(`第${rowNum}行: 采购价${rate.purchasePrice}超过${maxPrice}，请确认`)
    }

    if (rate.salesPrice !== null && rate.salesPrice > maxPrice) {
      rowWarnings.push(`第${rowNum}行: 销售价${rate.salesPrice}超过${maxPrice}，请确认`)
    }

    // 利润校验
    if (rate.purchasePrice !== null && rate.salesPrice !== null) {
      if (rate.salesPrice < rate.purchasePrice) {
        rowWarnings.push(`第${rowNum}行: 销售价低于采购价，将产生亏损`)
      }
    }

    // 汇总结果
    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      invalidRates.push({
        ...rate,
        errors: rowErrors,
        warnings: rowWarnings
      })
    } else {
      if (rowWarnings.length > 0) {
        warnings.push(...rowWarnings)
      }
      validRates.push({
        ...rate,
        warnings: rowWarnings
      })
    }
  })

  return {
    valid: errors.length === 0,
    totalRows: rates.length,
    validCount: validRates.length,
    invalidCount: invalidRates.length,
    errors,
    warnings,
    validRates,
    invalidRates
  }
}

/**
 * 检查重复数据
 * @param {Array} rates - 费率数据数组
 * @returns {Object} 重复检查结果
 */
export function checkDuplicates(rates) {
  const seen = new Map()
  const duplicates = []

  rates.forEach((rate, index) => {
    const key = `${rate.zoneCode}|${rate.weightFrom}|${rate.weightTo}`
    
    if (seen.has(key)) {
      duplicates.push({
        key,
        firstIndex: seen.get(key),
        duplicateIndex: index,
        zone: rate.zoneCode,
        weightRange: `${rate.weightFrom}-${rate.weightTo}`,
        message: `Zone ${rate.zoneCode} 重量段 ${rate.weightFrom}-${rate.weightTo}kg 存在重复`
      })
    } else {
      seen.set(key, index)
    }
  })

  return {
    hasDuplicates: duplicates.length > 0,
    duplicateCount: duplicates.length,
    duplicates
  }
}

/**
 * 检查重量段连续性
 * @param {Array} rates - 费率数据数组
 * @returns {Object} 连续性检查结果
 */
export function checkWeightContinuity(rates) {
  const gaps = []
  const overlaps = []

  // 按Zone分组
  const byZone = {}
  rates.forEach(rate => {
    if (!byZone[rate.zoneCode]) {
      byZone[rate.zoneCode] = []
    }
    byZone[rate.zoneCode].push(rate)
  })

  // 检查每个Zone的重量段
  Object.entries(byZone).forEach(([zone, zoneRates]) => {
    // 按起始重量排序
    const sorted = [...zoneRates].sort((a, b) => a.weightFrom - b.weightFrom)

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      // 检查间隙
      if (next.weightFrom > current.weightTo) {
        gaps.push({
          zone,
          gapFrom: current.weightTo,
          gapTo: next.weightFrom,
          message: `Zone ${zone}: 重量段 ${current.weightTo}kg 到 ${next.weightFrom}kg 之间存在间隙`
        })
      }

      // 检查重叠
      if (next.weightFrom < current.weightTo) {
        overlaps.push({
          zone,
          overlapRange: `${next.weightFrom}-${current.weightTo}`,
          message: `Zone ${zone}: 重量段 ${current.weightFrom}-${current.weightTo}kg 与 ${next.weightFrom}-${next.weightTo}kg 存在重叠`
        })
      }
    }
  })

  return {
    hasGaps: gaps.length > 0,
    hasOverlaps: overlaps.length > 0,
    gaps,
    overlaps,
    zoneCount: Object.keys(byZone).length
  }
}

/**
 * 生成数据摘要
 * @param {Array} rates - 费率数据数组
 * @returns {Object} 数据摘要
 */
export function generateSummary(rates) {
  if (!rates || rates.length === 0) {
    return {
      totalRecords: 0,
      zones: [],
      weightRanges: [],
      priceRange: { min: null, max: null }
    }
  }

  // 提取唯一Zone
  const zones = [...new Set(rates.map(r => r.zoneCode))].sort()

  // 提取唯一重量段
  const weightRanges = []
  const seenRanges = new Set()
  rates.forEach(r => {
    const key = `${r.weightFrom}-${r.weightTo}`
    if (!seenRanges.has(key)) {
      seenRanges.add(key)
      weightRanges.push({
        from: r.weightFrom,
        to: r.weightTo,
        label: `${r.weightFrom}-${r.weightTo}kg`
      })
    }
  })
  weightRanges.sort((a, b) => a.from - b.from)

  // 价格范围
  const purchasePrices = rates
    .map(r => r.purchasePrice)
    .filter(p => p !== null && p !== undefined)
  
  const salesPrices = rates
    .map(r => r.salesPrice)
    .filter(p => p !== null && p !== undefined)

  const allPrices = [...purchasePrices, ...salesPrices]

  return {
    totalRecords: rates.length,
    zones,
    zoneCount: zones.length,
    weightRanges,
    weightRangeCount: weightRanges.length,
    priceRange: {
      min: allPrices.length > 0 ? Math.min(...allPrices) : null,
      max: allPrices.length > 0 ? Math.max(...allPrices) : null
    },
    hasPurchasePrice: purchasePrices.length > 0,
    hasSalesPrice: salesPrices.length > 0,
    purchasePriceCount: purchasePrices.length,
    salesPriceCount: salesPrices.length
  }
}

/**
 * 完整验证流程
 * @param {Array} rates - 费率数据数组
 * @param {Object} options - 校验选项
 * @returns {Object} 完整验证结果
 */
export function fullValidation(rates, options = {}) {
  const rateValidation = validateRates(rates, options)
  const duplicateCheck = checkDuplicates(rateValidation.validRates)
  const continuityCheck = checkWeightContinuity(rateValidation.validRates)
  const summary = generateSummary(rateValidation.validRates)

  // 合并所有警告
  const allWarnings = [
    ...rateValidation.warnings,
    ...duplicateCheck.duplicates.map(d => d.message),
    ...continuityCheck.gaps.map(g => g.message),
    ...continuityCheck.overlaps.map(o => o.message)
  ]

  // 判断整体状态
  let status = 'success'
  if (rateValidation.invalidCount > 0) {
    status = 'error'
  } else if (allWarnings.length > 0) {
    status = 'warning'
  }

  return {
    status,
    valid: rateValidation.valid && !duplicateCheck.hasDuplicates,
    summary,
    validation: rateValidation,
    duplicates: duplicateCheck,
    continuity: continuityCheck,
    allErrors: rateValidation.errors,
    allWarnings,
    canProceed: rateValidation.valid, // 有错误不能继续，有警告可以继续
    message: status === 'success' 
      ? '数据验证通过' 
      : status === 'warning'
        ? `数据验证通过，但有${allWarnings.length}条警告需要注意`
        : `数据验证失败，有${rateValidation.errors.length}条错误`
  }
}

export default {
  validateRates,
  checkDuplicates,
  checkWeightContinuity,
  generateSummary,
  fullValidation
}
