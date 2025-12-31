/**
 * 智能列映射器
 * 自动识别报价表中的Zone、重量、价格等列
 */

// 列类型关键词映射
const COLUMN_PATTERNS = {
  zone: {
    keywords: ['zone', 'area', '区域', '分区', 'region', 'dest', '目的地'],
    patterns: [/^z\d+$/i, /^zone\s*\d+$/i, /^区域\d+$/i]
  },
  weightFrom: {
    keywords: ['weight_from', 'weight from', 'min_weight', 'min weight', '起始重量', '最小重量', 'from', '从'],
    patterns: [/^from$/i, /^min$/i]
  },
  weightTo: {
    keywords: ['weight_to', 'weight to', 'max_weight', 'max weight', '截止重量', '最大重量', 'to', '至'],
    patterns: [/^to$/i, /^max$/i]
  },
  weight: {
    keywords: ['weight', 'kg', '重量', 'gewicht', 'poids'],
    patterns: [/^\d+[-~]\d*\s*(kg)?$/i, /^up\s*to/i]
  },
  purchasePrice: {
    keywords: ['purchase', 'cost', 'buy', '采购', '成本', '进价', 'einkauf', 'achat'],
    patterns: [/^cost$/i, /^purchase$/i]
  },
  salesPrice: {
    keywords: ['sales', 'sell', 'price', '销售', '售价', '报价', 'verkauf', 'vente'],
    patterns: [/^price$/i, /^sell$/i]
  },
  price: {
    keywords: ['price', 'rate', 'amount', '价格', '费率', '金额', 'preis', 'prix', 'tarif'],
    patterns: [/^eur$/i, /^usd$/i, /^cny$/i, /€/, /\$/]
  },
  currency: {
    keywords: ['currency', 'curr', '币种', '货币'],
    patterns: [/^curr$/i]
  },
  service: {
    keywords: ['service', 'product', '服务', '产品', 'dienst'],
    patterns: [/^svc$/i]
  }
}

/**
 * 自动映射列
 * @param {Array} headers - 表头数组 [{index, column, value}]
 * @param {Array} sampleRows - 样本数据行
 * @returns {Object} 列映射结果
 */
export function autoMapColumns(headers, sampleRows = []) {
  const mapping = {
    zone: null,
    weightFrom: null,
    weightTo: null,
    weight: null,
    purchasePrice: null,
    salesPrice: null,
    price: null,
    currency: null,
    service: null
  }
  
  const confidence = {}
  const suggestions = []
  
  // 遍历表头进行匹配
  headers.forEach((header, idx) => {
    const headerValue = String(header.value || '').toLowerCase().trim()
    
    if (!headerValue) return
    
    // 检查每种列类型
    for (const [colType, patterns] of Object.entries(COLUMN_PATTERNS)) {
      const score = calculateMatchScore(headerValue, patterns, sampleRows, idx)
      
      if (score > 0) {
        if (!mapping[colType] || score > (confidence[colType] || 0)) {
          mapping[colType] = {
            index: idx,
            column: header.column,
            headerValue: header.value
          }
          confidence[colType] = score
        }
      }
    }
  })
  
  // 如果同时有weight但没有weightFrom/weightTo，检查是否为范围格式
  if (mapping.weight && !mapping.weightFrom && !mapping.weightTo) {
    // 检查weight列的数据是否为范围格式
    const weightCol = mapping.weight.index
    const hasRangeFormat = sampleRows.some(row => {
      const val = row.cells?.[weightCol]?.value || row[weightCol]
      return /\d+[-~]\d+/.test(String(val))
    })
    
    if (hasRangeFormat) {
      suggestions.push({
        type: 'info',
        message: '检测到重量列包含范围格式（如0-5kg），将自动解析'
      })
    }
  }
  
  // 如果只有price没有purchasePrice/salesPrice，默认作为采购价
  if (mapping.price && !mapping.purchasePrice && !mapping.salesPrice) {
    mapping.purchasePrice = mapping.price
    suggestions.push({
      type: 'info',
      message: '价格列将默认作为采购价使用，如需区分请手动调整'
    })
  }
  
  // 检测是否为矩阵格式
  const matrixDetection = detectMatrixFormat(headers, sampleRows)
  
  return {
    mapping,
    confidence,
    suggestions,
    matrixFormat: matrixDetection,
    unmappedColumns: headers.filter(h => 
      !Object.values(mapping).some(m => m?.index === h.index)
    )
  }
}

/**
 * 计算匹配分数
 */
function calculateMatchScore(headerValue, patterns, sampleRows, colIndex) {
  let score = 0
  
  // 关键词匹配
  for (const keyword of patterns.keywords) {
    if (headerValue.includes(keyword.toLowerCase())) {
      score += 0.6
      break
    }
  }
  
  // 正则匹配
  for (const pattern of patterns.patterns) {
    if (pattern.test(headerValue)) {
      score += 0.4
      break
    }
  }
  
  // 数据内容推断
  if (sampleRows.length > 0 && score < 0.5) {
    const sampleValues = sampleRows
      .map(row => row.cells?.[colIndex]?.value || row[colIndex])
      .filter(v => v !== undefined && v !== null && v !== '')
    
    if (sampleValues.length > 0) {
      // 检查是否都是数字（可能是价格）
      const allNumeric = sampleValues.every(v => !isNaN(parseFloat(String(v).replace(/[€$¥,]/g, ''))))
      if (allNumeric) {
        score += 0.2
      }
      
      // 检查是否包含Zone模式
      const hasZonePattern = sampleValues.some(v => /zone|z\d|区域/i.test(String(v)))
      if (hasZonePattern) {
        score += 0.3
      }
      
      // 检查是否为重量范围
      const hasWeightRange = sampleValues.some(v => /\d+[-~]\d+\s*(kg)?/i.test(String(v)))
      if (hasWeightRange) {
        score += 0.3
      }
    }
  }
  
  return score
}

/**
 * 检测矩阵格式
 */
function detectMatrixFormat(headers, sampleRows) {
  // 矩阵格式特征：
  // 1. 第一列通常是重量范围
  // 2. 其他列是Zone名称
  // 3. 数据单元格是价格数字
  
  if (headers.length < 3) {
    return { isMatrix: false }
  }
  
  const firstColHeader = String(headers[0]?.value || '').toLowerCase()
  const otherHeaders = headers.slice(1)
  
  // 检查其他列是否像Zone
  const zonePattern = /zone|z\d|区域|\d+/i
  const likelyZoneHeaders = otherHeaders.filter(h => 
    zonePattern.test(String(h.value))
  )
  
  // 如果大部分其他列都像Zone
  if (likelyZoneHeaders.length >= otherHeaders.length * 0.5) {
    // 检查第一列数据是否为重量范围
    const firstColData = sampleRows.map(row => row.cells?.[0]?.value || row[0])
    const weightRangePattern = /\d+[-~]\d*\s*(kg)?|up\s*to|以下|以上/i
    const hasWeightRanges = firstColData.filter(v => 
      weightRangePattern.test(String(v))
    ).length >= firstColData.length * 0.5
    
    if (hasWeightRanges) {
      return {
        isMatrix: true,
        confidence: 0.8,
        detected: {
          zoneRow: 0,
          weightColumn: 0,
          dataStartRow: 1,
          dataStartColumn: 1,
          zones: otherHeaders.map(h => String(h.value).trim())
        }
      }
    }
  }
  
  return { isMatrix: false }
}

/**
 * 验证映射完整性
 */
export function validateMapping(mapping, format = 'list') {
  const errors = []
  const warnings = []
  
  if (format === 'matrix') {
    // 矩阵格式只需要确认Zone和重量位置
    if (!mapping.matrixFormat?.isMatrix) {
      warnings.push('未能自动检测到矩阵格式，请手动确认Zone和重量位置')
    }
  } else {
    // 列表格式需要Zone、重量、价格
    if (!mapping.zone) {
      errors.push('未找到Zone列')
    }
    
    if (!mapping.weight && !mapping.weightFrom) {
      errors.push('未找到重量列')
    }
    
    if (!mapping.price && !mapping.purchasePrice && !mapping.salesPrice) {
      errors.push('未找到价格列')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 应用列映射转换数据
 */
export function applyMapping(rawData, mapping, options = {}) {
  const {
    headerRow = 0,
    dataStartRow = 1,
    format = 'list'
  } = options
  
  if (format === 'matrix' && mapping.matrixFormat?.isMatrix) {
    return applyMatrixMapping(rawData, mapping.matrixFormat.detected)
  }
  
  return applyListMapping(rawData, mapping, dataStartRow)
}

/**
 * 应用列表格式映射
 */
function applyListMapping(rawData, mapping, dataStartRow) {
  const results = []
  
  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i]
    
    const record = {
      rowNumber: i + 1
    }
    
    // Zone
    if (mapping.zone) {
      record.zoneCode = String(row[mapping.zone.index] || '').trim()
    }
    
    // 重量
    if (mapping.weightFrom && mapping.weightTo) {
      record.weightFrom = parseFloat(row[mapping.weightFrom.index]) || 0
      record.weightTo = parseFloat(row[mapping.weightTo.index]) || 0
    } else if (mapping.weight) {
      const weightVal = String(row[mapping.weight.index] || '')
      const range = parseWeightRange(weightVal)
      record.weightFrom = range.from
      record.weightTo = range.to
    }
    
    // 价格
    if (mapping.purchasePrice) {
      record.purchasePrice = parsePrice(row[mapping.purchasePrice.index])
    }
    if (mapping.salesPrice) {
      record.salesPrice = parsePrice(row[mapping.salesPrice.index])
    }
    if (!record.purchasePrice && !record.salesPrice && mapping.price) {
      record.purchasePrice = parsePrice(row[mapping.price.index])
    }
    
    // 验证记录有效性
    if (record.zoneCode && record.weightFrom !== undefined && 
        (record.purchasePrice || record.salesPrice)) {
      results.push(record)
    }
  }
  
  return results
}

/**
 * 应用矩阵格式映射
 */
function applyMatrixMapping(rawData, matrixConfig) {
  const {
    zoneRow,
    weightColumn,
    dataStartRow,
    dataStartColumn,
    zones
  } = matrixConfig
  
  const results = []
  
  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i]
    const weightVal = String(row[weightColumn] || '').trim()
    
    if (!weightVal) continue
    
    const range = parseWeightRange(weightVal)
    if (range.from === null || range.to === null) continue
    
    // 遍历各Zone价格
    for (let j = 0; j < zones.length; j++) {
      const price = parsePrice(row[dataStartColumn + j])
      
      if (price !== null) {
        results.push({
          rowNumber: i + 1,
          zoneCode: zones[j],
          weightFrom: range.from,
          weightTo: range.to,
          purchasePrice: price,
          originalWeight: weightVal,
          originalZone: zones[j]
        })
      }
    }
  }
  
  return results
}

/**
 * 解析重量范围
 */
function parseWeightRange(str) {
  if (!str) return { from: null, to: null }
  
  const cleaned = String(str).replace(/kg|g|公斤|千克/gi, '').trim()
  
  // 格式: "0-5", "0~5", "0 - 5"
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)/)
  if (rangeMatch) {
    return {
      from: parseFloat(rangeMatch[1]),
      to: parseFloat(rangeMatch[2])
    }
  }
  
  // 格式: "up to 5", "5以下"
  const upToMatch = cleaned.match(/(?:up\s*to|以下|不超过)\s*(\d+(?:\.\d+)?)/i)
  if (upToMatch) {
    return { from: 0, to: parseFloat(upToMatch[1]) }
  }
  
  // 格式: "5以上", "over 5", "5+"
  const overMatch = cleaned.match(/(?:over|以上|超过|\+)\s*(\d+(?:\.\d+)?)/i)
  if (overMatch) {
    return { from: parseFloat(overMatch[1]), to: 9999 }
  }
  
  return { from: null, to: null }
}

/**
 * 解析价格
 */
function parsePrice(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  
  const cleaned = String(value)
    .replace(/[€$¥£]/g, '')
    .replace(/,/g, '')
    .trim()
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export default {
  autoMapColumns,
  validateMapping,
  applyMapping,
  COLUMN_PATTERNS
}
