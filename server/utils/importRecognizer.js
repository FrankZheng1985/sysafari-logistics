/**
 * 智能导入识别引擎
 * 统一处理 Excel、PDF 等格式的供应商报价导入
 */

import { parseExcel, suggestFieldMapping, extractDataWithMapping } from './excelParser.js'
import { parseQuotationPdf } from './pdfParser.js'
import { recognizeScannedPdf, extractDataFromOcrText } from './ocrService.js'

/**
 * 检测文件类型
 * @param {string} filename - 文件名
 * @param {Buffer} buffer - 文件内容
 * @returns {string} 文件类型
 */
export function detectFileType(filename, buffer) {
  const ext = filename.toLowerCase().split('.').pop()
  
  // 根据扩展名判断
  if (['xlsx', 'xls'].includes(ext)) {
    return 'excel'
  }
  if (ext === 'pdf') {
    return 'pdf'
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image'
  }
  
  // 根据文件头判断
  if (buffer) {
    const header = buffer.slice(0, 4).toString('hex')
    if (header.startsWith('504b')) return 'excel' // ZIP/XLSX
    if (header.startsWith('25504446')) return 'pdf' // PDF
    if (header.startsWith('ffd8ff')) return 'image' // JPEG
    if (header.startsWith('89504e47')) return 'image' // PNG
  }
  
  return 'unknown'
}

/**
 * 智能解析导入文件
 * @param {Buffer} fileBuffer - 文件内容
 * @param {string} filename - 文件名
 * @param {Object} options - 解析选项
 * @returns {Object} 解析结果
 */
export async function parseImportFile(fileBuffer, filename, options = {}) {
  const fileType = detectFileType(filename, fileBuffer)
  
  switch (fileType) {
    case 'excel':
      return await parseExcelFile(fileBuffer, options)
    case 'pdf':
      return await parsePdfFile(fileBuffer, options)
    case 'image':
      return await parseImageFile(fileBuffer, options)
    default:
      return {
        success: false,
        error: '不支持的文件格式'
      }
  }
}

/**
 * 解析 Excel 文件
 */
async function parseExcelFile(fileBuffer, options) {
  const result = await parseExcel(fileBuffer)
  
  if (!result.success) {
    return result
  }
  
  // 处理每个 Sheet
  const processedSheets = result.sheets.map(sheet => {
    // 自动识别字段映射
    const fieldMapping = suggestFieldMapping(sheet.headers)
    
    // 提取数据
    const extractedData = extractDataWithMapping(sheet, fieldMapping)
    
    return {
      name: sheet.name,
      headers: sheet.headers,
      rowCount: sheet.rowCount,
      fieldMapping,
      data: extractedData,
      rawRows: sheet.rows.slice(0, 5) // 预览前5行原始数据
    }
  })
  
  return {
    success: true,
    fileType: 'excel',
    sheetCount: result.sheetCount,
    sheets: processedSheets,
    totalRecords: processedSheets.reduce((sum, s) => sum + s.data.length, 0)
  }
}

/**
 * 解析 PDF 文件
 */
async function parsePdfFile(fileBuffer, options) {
  // 先尝试作为文字 PDF 解析
  const pdfResult = await parseQuotationPdf(fileBuffer)
  
  if (pdfResult.success && pdfResult.recognizedItems.length > 0) {
    return {
      success: true,
      fileType: 'pdf',
      pageCount: pdfResult.pageCount,
      data: pdfResult.recognizedItems,
      rawText: pdfResult.text,
      totalRecords: pdfResult.recognizedItems.length
    }
  }
  
  // 如果文字 PDF 解析失败或没有识别到数据，尝试 OCR
  const ocrResult = await recognizeScannedPdf(fileBuffer)
  
  if (ocrResult.isScanned) {
    return {
      success: false,
      fileType: 'scanned_pdf',
      message: ocrResult.message,
      needsOcr: true
    }
  }
  
  if (ocrResult.success && ocrResult.text) {
    const extractedData = extractDataFromOcrText(ocrResult.text)
    return {
      success: true,
      fileType: 'pdf',
      pageCount: ocrResult.pageCount,
      data: extractedData,
      rawText: ocrResult.text,
      totalRecords: extractedData.length
    }
  }
  
  return {
    success: false,
    error: 'PDF 解析失败，无法提取有效数据'
  }
}

/**
 * 解析图片文件 (OCR)
 */
async function parseImageFile(fileBuffer, options) {
  // 图片需要 OCR 处理
  return {
    success: false,
    fileType: 'image',
    message: '图片文件需要使用 OCR 识别，请先将图片转换为 Excel 或文字 PDF 格式后再导入',
    needsOcr: true
  }
}

/**
 * 验证并标准化解析后的数据
 * @param {Array} data - 解析出的数据
 * @returns {Object} 验证结果
 */
export function validateAndNormalizeData(data) {
  const validated = []
  const errors = []
  
  data.forEach((item, index) => {
    const normalized = {
      feeName: String(item.feeName || '').trim(),
      feeNameEn: String(item.feeNameEn || '').trim(),
      unit: String(item.unit || '').trim(),
      price: parseFloat(String(item.price || '0').replace(/[,，]/g, '')) || 0,
      currency: detectCurrency(item.currency || item.price),
      routeFrom: String(item.routeFrom || '').trim(),
      routeTo: String(item.routeTo || '').trim(),
      remark: String(item.remark || '').trim(),
      _rowIndex: index + 1,
      _warnings: []
    }
    
    // 验证必填字段
    if (!normalized.feeName) {
      normalized._warnings.push('缺少费用名称')
    }
    
    if (normalized.price <= 0 && normalized.feeName !== '实报实销') {
      normalized._warnings.push('价格无效或为0')
    }
    
    // 检测"实报实销"类型
    if (/实报实销|按实际|actual|market/i.test(item.feeName) || 
        /实报实销|按实际|actual|market/i.test(String(item.price))) {
      normalized.priceType = 'actual'
      normalized._warnings = normalized._warnings.filter(w => !w.includes('价格'))
    }
    
    validated.push(normalized)
  })
  
  return {
    data: validated,
    validCount: validated.filter(d => d._warnings.length === 0).length,
    warningCount: validated.filter(d => d._warnings.length > 0).length,
    totalCount: validated.length
  }
}

/**
 * 检测货币类型
 */
function detectCurrency(value) {
  const str = String(value || '')
  
  if (/[€EUR]|欧元/i.test(str)) return 'EUR'
  if (/[$USD]|美元/i.test(str)) return 'USD'
  if (/[¥CNY]|人民币|元/i.test(str)) return 'CNY'
  
  return 'EUR' // 默认欧元
}

/**
 * 合并多个 Sheet 的数据
 * @param {Array} sheets - Sheet 数组
 * @param {Object} options - 合并选项
 * @returns {Array} 合并后的数据
 */
export function mergeSheetData(sheets, options = {}) {
  const { includeSheetName = true } = options
  
  const merged = []
  
  sheets.forEach(sheet => {
    sheet.data.forEach(item => {
      merged.push({
        ...item,
        _sheetName: includeSheetName ? sheet.name : undefined
      })
    })
  })
  
  return merged
}

export default {
  detectFileType,
  parseImportFile,
  validateAndNormalizeData,
  mergeSheetData
}
