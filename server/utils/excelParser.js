/**
 * Excel 文件解析工具
 * 支持 .xlsx 和 .xls 格式，多 Sheet 解析
 */

/**
 * 解析 Excel 文件
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @returns {Object} 解析结果 { sheets: [{ name, data: [] }] }
 */
export async function parseExcel(fileBuffer) {
  try {
    // 动态导入 xlsx 库
    const XLSX = await import('xlsx')
    
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    
    const sheets = workbook.SheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,  // 返回数组格式
        defval: ''  // 默认空值
      })
      
      // 提取表头和数据行
      const headers = data[0] || []
      const rows = data.slice(1).filter(row => row.some(cell => cell !== ''))
      
      return {
        name: sheetName,
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length
      }
    })
    
    return {
      success: true,
      sheetCount: sheets.length,
      sheets
    }
  } catch (error) {
    console.error('Excel 解析失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 将解析的数据转换为统一格式
 * @param {Object} sheetData - 单个 Sheet 的数据
 * @returns {Array} 转换后的对象数组
 */
export function convertSheetToObjects(sheetData) {
  const { headers, rows } = sheetData
  
  return rows.map(row => {
    const obj = {}
    headers.forEach((header, index) => {
      if (header) {
        obj[header] = row[index] || ''
      }
    })
    return obj
  })
}

/**
 * 自动识别可能的字段映射
 * @param {Array} headers - 表头数组
 * @returns {Object} 字段映射建议
 */
export function suggestFieldMapping(headers) {
  const fieldPatterns = {
    feeName: ['服务', '项目', '费用', 'service', 'item', 'fee', 'name', '名称', '服务名称', '费用名称', '项目名称'],
    feeNameEn: ['英文', 'english', 'en', 'service_en', 'item_en'],
    unit: ['单位', 'unit', '计量', '计费单位'],
    price: ['价格', '单价', 'price', 'rate', '结算单价', '报价', '金额', 'amount'],
    currency: ['货币', '币种', 'currency', 'ccy'],
    routeFrom: ['起始', '出发', 'from', 'origin', '起运', '提柜'],
    routeTo: ['目的', '到达', 'to', 'destination', '终点', '还柜', '送仓'],
    remark: ['备注', '说明', 'remark', 'note', 'comment', '描述']
  }
  
  const mapping = {}
  const normalizedHeaders = headers.map(h => String(h).toLowerCase().trim())
  
  Object.entries(fieldPatterns).forEach(([fieldName, patterns]) => {
    headers.forEach((header, index) => {
      const normalized = normalizedHeaders[index]
      if (patterns.some(p => normalized.includes(p.toLowerCase()))) {
        if (!mapping[fieldName]) {
          mapping[fieldName] = { columnIndex: index, originalHeader: header }
        }
      }
    })
  })
  
  return mapping
}

/**
 * 根据映射提取数据
 * @param {Object} sheetData - Sheet 数据
 * @param {Object} fieldMapping - 字段映射
 * @returns {Array} 提取的数据
 */
export function extractDataWithMapping(sheetData, fieldMapping) {
  const { rows } = sheetData
  
  return rows.map(row => {
    const extracted = {}
    
    Object.entries(fieldMapping).forEach(([fieldName, mapping]) => {
      if (mapping && mapping.columnIndex !== undefined) {
        extracted[fieldName] = row[mapping.columnIndex] || ''
      }
    })
    
    return extracted
  }).filter(item => item.feeName || item.price) // 过滤空行
}

export default {
  parseExcel,
  convertSheetToObjects,
  suggestFieldMapping,
  extractDataWithMapping
}
