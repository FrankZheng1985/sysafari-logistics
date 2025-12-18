/**
 * PDF 文件解析工具
 * 支持文字 PDF 的文本提取
 */

/**
 * 解析 PDF 文件，提取文本内容
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @returns {Object} 解析结果
 */
export async function parsePdf(fileBuffer) {
  try {
    // 动态导入 pdf-parse 库
    const pdfParse = await import('pdf-parse').then(m => m.default || m)
    
    const data = await pdfParse(fileBuffer)
    
    return {
      success: true,
      text: data.text,
      pageCount: data.numpages,
      info: data.info
    }
  } catch (error) {
    console.error('PDF 解析失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 从 PDF 文本中提取表格数据
 * 尝试识别表格结构
 * @param {string} text - PDF 文本内容
 * @returns {Array} 提取的数据行
 */
export function extractTableFromText(text) {
  // 按行分割
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  // 尝试识别表格行（包含多个数字或制表符分隔的内容）
  const tableRows = []
  
  lines.forEach(line => {
    // 检测是否像表格行（包含价格数字）
    const pricePattern = /[\d,]+\.?\d*\s*[€$¥]|[€$¥]\s*[\d,]+\.?\d*/
    const tabSeparated = line.includes('\t')
    const multipleSpaces = line.includes('  ')
    
    if (pricePattern.test(line) || tabSeparated || multipleSpaces) {
      // 尝试分割成列
      let columns
      if (tabSeparated) {
        columns = line.split('\t').map(c => c.trim())
      } else if (multipleSpaces) {
        columns = line.split(/\s{2,}/).map(c => c.trim())
      } else {
        columns = [line]
      }
      
      tableRows.push(columns)
    }
  })
  
  return tableRows
}

/**
 * 智能解析 PDF 报价表
 * @param {Buffer} fileBuffer - 文件 Buffer
 * @returns {Object} 解析结果
 */
export async function parseQuotationPdf(fileBuffer) {
  const parseResult = await parsePdf(fileBuffer)
  
  if (!parseResult.success) {
    return parseResult
  }
  
  const tableData = extractTableFromText(parseResult.text)
  
  // 尝试识别表头和数据
  const result = {
    success: true,
    text: parseResult.text,
    pageCount: parseResult.pageCount,
    extractedRows: tableData,
    recognizedItems: []
  }
  
  // 尝试从文本中识别费用项
  const feePatterns = [
    // 格式: 费用名称 金额
    /(.+?)\s+([\d,]+\.?\d*)\s*([€$¥]|EUR|USD|CNY)?/g,
    // 格式: 金额 费用名称
    /([€$¥]|EUR|USD|CNY)?\s*([\d,]+\.?\d*)\s+(.+)/g
  ]
  
  const lines = parseResult.text.split('\n')
  lines.forEach(line => {
    // 简单的费用项识别
    const match = line.match(/(.+?)\s+([\d,]+\.?\d*)\s*[€$¥EUR]?/)
    if (match && match[1].length < 50 && !isNaN(parseFloat(match[2].replace(',', '')))) {
      result.recognizedItems.push({
        feeName: match[1].trim(),
        price: parseFloat(match[2].replace(',', '')),
        originalLine: line
      })
    }
  })
  
  return result
}

export default {
  parsePdf,
  extractTableFromText,
  parseQuotationPdf
}
