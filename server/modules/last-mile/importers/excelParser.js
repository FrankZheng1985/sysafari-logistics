/**
 * Excel报价表解析器
 * 支持xlsx、xls、csv格式
 */

import xlsx from 'xlsx'

/**
 * 解析Excel文件
 * @param {Buffer} fileBuffer - 文件Buffer
 * @param {Object} options - 解析选项
 * @returns {Object} 解析结果
 */
export function parseExcel(fileBuffer, options = {}) {
  const {
    sheetName = null,
    headerRow = 1,
    dataStartRow = 2
  } = options

  try {
    // 读取Excel文件
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' })
    
    // 选择工作表
    const targetSheet = sheetName || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[targetSheet]
    
    if (!worksheet) {
      return {
        success: false,
        error: `工作表 "${targetSheet}" 不存在`
      }
    }
    
    // 转换为JSON（带表头）
    const rawData = xlsx.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: ''
    })
    
    if (rawData.length < headerRow) {
      return {
        success: false,
        error: '文件数据为空或格式不正确'
      }
    }
    
    // 提取表头
    const headers = rawData[headerRow - 1].map((h, idx) => ({
      index: idx,
      column: getColumnLetter(idx),
      value: String(h || '').trim(),
      originalValue: h
    }))
    
    // 提取数据行
    const dataRows = rawData.slice(dataStartRow - 1).map((row, rowIdx) => ({
      rowNumber: dataStartRow + rowIdx,
      cells: row.map((cell, cellIdx) => ({
        column: getColumnLetter(cellIdx),
        value: cell,
        formatted: formatCellValue(cell)
      }))
    }))
    
    // 获取工作表信息
    const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1')
    
    return {
      success: true,
      data: {
        sheetName: targetSheet,
        availableSheets: workbook.SheetNames,
        totalRows: rawData.length,
        totalColumns: headers.length,
        range: {
          startRow: 1,
          endRow: range.e.r + 1,
          startCol: getColumnLetter(range.s.c),
          endCol: getColumnLetter(range.e.c)
        },
        headers,
        rows: dataRows,
        rawData
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `解析Excel失败: ${error.message}`
    }
  }
}

/**
 * 解析矩阵型报价表
 * 格式：
 *         Zone1   Zone2   Zone3
 * 0-5kg    5.00    6.00    7.00
 * 5-10kg   8.00    9.50   11.00
 */
export function parseMatrixFormat(rawData, options = {}) {
  const {
    zoneRow = 0,           // Zone所在行（0-based）
    weightColumn = 0,      // 重量所在列（0-based）
    dataStartRow = 1,      // 数据开始行
    dataStartColumn = 1    // 数据开始列
  } = options

  try {
    // 提取Zone列表
    const zoneHeaders = rawData[zoneRow].slice(dataStartColumn).filter(z => z)
    
    // 提取重量段和价格
    const rateData = []
    
    for (let i = dataStartRow; i < rawData.length; i++) {
      const row = rawData[i]
      const weightRange = String(row[weightColumn] || '').trim()
      
      if (!weightRange) continue
      
      // 解析重量范围
      const { from, to } = parseWeightRange(weightRange)
      
      if (from === null || to === null) continue
      
      // 提取各Zone价格
      for (let j = 0; j < zoneHeaders.length; j++) {
        const price = parsePrice(row[dataStartColumn + j])
        
        if (price !== null) {
          rateData.push({
            zoneCode: String(zoneHeaders[j]).trim(),
            weightFrom: from,
            weightTo: to,
            price: price,
            originalWeight: weightRange,
            originalZone: zoneHeaders[j],
            originalPrice: row[dataStartColumn + j]
          })
        }
      }
    }
    
    return {
      success: true,
      format: 'matrix',
      zones: zoneHeaders.map(z => String(z).trim()),
      weightRanges: extractUniqueWeightRanges(rateData),
      rateCount: rateData.length,
      rates: rateData
    }
  } catch (error) {
    return {
      success: false,
      error: `解析矩阵格式失败: ${error.message}`
    }
  }
}

/**
 * 解析列表型报价表
 * 格式：
 * Zone    Weight_From  Weight_To   Price
 * Zone1      0           5         5.00
 */
export function parseListFormat(rawData, columnMapping) {
  const {
    zoneColumn,
    weightFromColumn,
    weightToColumn,
    priceColumn,
    headerRow = 0,
    dataStartRow = 1
  } = columnMapping

  try {
    const rateData = []
    
    for (let i = dataStartRow; i < rawData.length; i++) {
      const row = rawData[i]
      
      const zoneCode = String(row[zoneColumn] || '').trim()
      const weightFrom = parseNumber(row[weightFromColumn])
      const weightTo = parseNumber(row[weightToColumn])
      const price = parsePrice(row[priceColumn])
      
      if (zoneCode && weightFrom !== null && weightTo !== null && price !== null) {
        rateData.push({
          zoneCode,
          weightFrom,
          weightTo,
          price,
          originalRow: i + 1
        })
      }
    }
    
    return {
      success: true,
      format: 'list',
      zones: [...new Set(rateData.map(r => r.zoneCode))],
      weightRanges: extractUniqueWeightRanges(rateData),
      rateCount: rateData.length,
      rates: rateData
    }
  } catch (error) {
    return {
      success: false,
      error: `解析列表格式失败: ${error.message}`
    }
  }
}

/**
 * 自动检测报价表格式
 */
export function detectFormat(rawData) {
  if (!rawData || rawData.length < 2) {
    return { format: 'unknown', confidence: 0 }
  }

  // 检查是否为矩阵格式
  const firstRow = rawData[0]
  const secondRow = rawData[1]
  
  // 矩阵格式特征：第一行有多个Zone标识，第一列有重量范围
  const zonePatterns = /zone|区域|z\d+/i
  const weightPatterns = /\d+[-~]\d*\s*(kg|g)?|up\s*to|以下|以上/i
  
  const hasZoneHeader = firstRow.slice(1).some(cell => 
    zonePatterns.test(String(cell))
  )
  const hasWeightColumn = weightPatterns.test(String(secondRow[0]))
  
  if (hasZoneHeader || hasWeightColumn) {
    return {
      format: 'matrix',
      confidence: hasZoneHeader && hasWeightColumn ? 0.9 : 0.7,
      detected: {
        zoneRow: 0,
        weightColumn: 0,
        dataStartRow: 1,
        dataStartColumn: 1
      }
    }
  }
  
  // 列表格式特征：有Zone、Weight、Price等列标题
  const listHeaders = ['zone', 'weight', 'price', '重量', '价格', '区域']
  const headerMatches = firstRow.filter(cell => 
    listHeaders.some(h => String(cell).toLowerCase().includes(h))
  ).length
  
  if (headerMatches >= 2) {
    return {
      format: 'list',
      confidence: headerMatches >= 3 ? 0.9 : 0.7,
      detected: {
        headerRow: 0,
        dataStartRow: 1
      }
    }
  }
  
  return { format: 'unknown', confidence: 0 }
}

// ==================== 辅助函数 ====================

/**
 * 解析重量范围字符串
 */
export function parseWeightRange(str) {
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
    return {
      from: 0,
      to: parseFloat(upToMatch[1])
    }
  }
  
  // 格式: "5以上", "over 5"
  const overMatch = cleaned.match(/(?:over|以上|超过)\s*(\d+(?:\.\d+)?)/i)
  if (overMatch) {
    return {
      from: parseFloat(overMatch[1]),
      to: 9999
    }
  }
  
  // 格式: "+5", "5+"
  const plusMatch = cleaned.match(/\+?\s*(\d+(?:\.\d+)?)\s*\+?/)
  if (plusMatch && cleaned.includes('+')) {
    return {
      from: parseFloat(plusMatch[1]),
      to: 9999
    }
  }
  
  return { from: null, to: null }
}

/**
 * 解析价格
 */
export function parsePrice(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  if (typeof value === 'number') {
    return value
  }
  
  // 清理价格字符串
  const cleaned = String(value)
    .replace(/[€$¥£]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim()
  
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * 解析数字
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  if (typeof value === 'number') {
    return value
  }
  
  const num = parseFloat(String(value).replace(/,/g, '').trim())
  return isNaN(num) ? null : num
}

/**
 * 获取列字母
 */
function getColumnLetter(index) {
  let letter = ''
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter
    index = Math.floor(index / 26) - 1
  }
  return letter
}

/**
 * 格式化单元格值
 */
function formatCellValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value
  return String(value).trim()
}

/**
 * 提取唯一重量范围
 */
function extractUniqueWeightRanges(rateData) {
  const seen = new Set()
  return rateData
    .filter(r => {
      const key = `${r.weightFrom}-${r.weightTo}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(r => ({
      from: r.weightFrom,
      to: r.weightTo,
      label: `${r.weightFrom}-${r.weightTo}kg`
    }))
    .sort((a, b) => a.from - b.from)
}

export default {
  parseExcel,
  parseMatrixFormat,
  parseListFormat,
  detectFormat,
  parseWeightRange,
  parsePrice,
  parseNumber
}
