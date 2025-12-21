/**
 * 报价导入管理器
 * 统一管理Excel/PDF解析、列映射、数据校验
 */

import * as excelParser from './excelParser.js'
import * as pdfParser from './pdfParser.js'
import * as columnMapper from './columnMapper.js'
import * as dataValidator from './dataValidator.js'

/**
 * 解析上传的报价文件
 * @param {Buffer} fileBuffer - 文件内容
 * @param {string} fileName - 文件名
 * @param {Object} options - 解析选项
 * @returns {Object} 解析结果
 */
export async function parseFile(fileBuffer, fileName, options = {}) {
  const fileType = getFileType(fileName)
  
  let parseResult
  
  switch (fileType) {
    case 'excel':
      parseResult = excelParser.parseExcel(fileBuffer, options)
      break
    case 'pdf':
      parseResult = await pdfParser.parsePdf(fileBuffer, options)
      break
    case 'csv':
      parseResult = excelParser.parseExcel(fileBuffer, { ...options, type: 'csv' })
      break
    default:
      return {
        success: false,
        error: `不支持的文件类型: ${fileType}`
      }
  }
  
  if (!parseResult.success) {
    return parseResult
  }
  
  // 检测格式并自动映射列
  const formatDetection = excelParser.detectFormat(parseResult.data.rawData)
  const autoMapping = columnMapper.autoMapColumns(
    parseResult.data.headers,
    parseResult.data.rows.slice(0, 5)
  )
  
  return {
    success: true,
    fileType,
    fileName,
    data: parseResult.data,
    formatDetection,
    autoMapping,
    rawOCR: parseResult.rawOCR // PDF OCR原始数据
  }
}

/**
 * 预览导入数据
 * @param {Object} parseResult - 解析结果
 * @param {Object} mapping - 列映射配置
 * @param {Object} options - 预览选项
 * @returns {Object} 预览结果
 */
export function previewImport(parseResult, mapping, options = {}) {
  const {
    headerRow = 0,
    dataStartRow = 1,
    format = 'auto',
    previewLimit = 100
  } = options
  
  // 确定格式
  let actualFormat = format
  if (format === 'auto') {
    actualFormat = mapping.matrixFormat?.isMatrix ? 'matrix' : 'list'
  }
  
  // 应用映射转换数据
  let rates
  if (actualFormat === 'matrix') {
    rates = excelParser.parseMatrixFormat(
      parseResult.data.rawData,
      mapping.matrixFormat?.detected || {
        zoneRow: 0,
        weightColumn: 0,
        dataStartRow: 1,
        dataStartColumn: 1
      }
    )
    if (rates.success) {
      rates = rates.rates
    } else {
      return { success: false, error: rates.error }
    }
  } else {
    rates = columnMapper.applyMapping(
      parseResult.data.rawData,
      mapping,
      { headerRow, dataStartRow, format: actualFormat }
    )
  }
  
  // 验证数据
  const validation = dataValidator.fullValidation(rates, options)
  
  // 生成预览数据（限制数量）
  const previewRates = rates.slice(0, previewLimit)
  
  return {
    success: true,
    format: actualFormat,
    totalRecords: rates.length,
    previewRecords: previewRates.length,
    rates: previewRates,
    allRates: rates, // 完整数据用于确认导入
    validation,
    summary: validation.summary
  }
}

/**
 * 确认导入
 * @param {Array} rates - 验证通过的费率数据
 * @param {Object} rateCardInfo - 费率卡信息
 * @param {Object} db - 数据库连接
 * @returns {Object} 导入结果
 */
export async function confirmImport(rates, rateCardInfo, db) {
  const {
    carrierId,
    rateCardName,
    rateCardCode,
    rateType = 'last_mile',
    serviceType = 'standard',
    validFrom,
    validUntil,
    currency = 'EUR',
    importedBy
  } = rateCardInfo
  
  try {
    // 创建费率卡
    const rateCardResult = await db.prepare(`
      INSERT INTO unified_rate_cards (
        rate_card_code, rate_card_name, carrier_id, rate_type, 
        service_type, valid_from, valid_until, currency, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      rateCardCode || `RC-${Date.now()}`,
      rateCardName,
      carrierId,
      rateType,
      serviceType,
      validFrom || new Date().toISOString().split('T')[0],
      validUntil || null,
      currency
    )
    
    const rateCardId = rateCardResult.lastInsertRowid
    
    // 批量插入费率明细
    const insertStmt = db.prepare(`
      INSERT INTO rate_card_tiers (
        rate_card_id, zone_code, weight_from, weight_to,
        purchase_price, sales_price, price_unit
      ) VALUES (?, ?, ?, ?, ?, ?, 'per_kg')
    `)
    
    let successCount = 0
    let failCount = 0
    
    for (const rate of rates) {
      try {
        insertStmt.run(
          rateCardId,
          rate.zoneCode,
          rate.weightFrom,
          rate.weightTo,
          rate.purchasePrice || null,
          rate.salesPrice || null
        )
        successCount++
      } catch (err) {
        console.error('插入费率失败:', err)
        failCount++
      }
    }
    
    // 记录导入日志
    await db.prepare(`
      INSERT INTO rate_import_logs (
        carrier_id, rate_card_id, file_name, file_type,
        status, total_rows, success_rows, failed_rows, imported_by
      ) VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)
    `).run(
      carrierId,
      rateCardId,
      rateCardInfo.fileName || 'unknown',
      rateCardInfo.fileType || 'excel',
      rates.length,
      successCount,
      failCount,
      importedBy || 'system'
    )
    
    return {
      success: true,
      rateCardId,
      totalRecords: rates.length,
      successCount,
      failCount,
      message: `成功导入 ${successCount} 条费率记录`
    }
  } catch (error) {
    console.error('导入失败:', error)
    return {
      success: false,
      error: `导入失败: ${error.message}`
    }
  }
}

/**
 * 获取文件类型
 */
function getFileType(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase()
  
  if (['xlsx', 'xls'].includes(ext)) {
    return 'excel'
  }
  if (ext === 'csv') {
    return 'csv'
  }
  if (ext === 'pdf') {
    return 'pdf'
  }
  
  return 'unknown'
}

/**
 * 检查OCR服务状态
 */
export function checkOCRStatus() {
  return pdfParser.checkOCRConfig()
}

// 导出所有子模块
export {
  excelParser,
  pdfParser,
  columnMapper,
  dataValidator
}

export default {
  parseFile,
  previewImport,
  confirmImport,
  checkOCRStatus,
  getFileType,
  excelParser,
  pdfParser,
  columnMapper,
  dataValidator
}
