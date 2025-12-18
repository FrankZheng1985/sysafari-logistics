/**
 * OCR模块控制器
 * 
 * 处理运输单OCR识别请求
 */

import { recognizeTransportDocument, checkOcrConfig } from './tencentOcrService.js'
import { parseTransportDocument, detectTransportType } from './documentParser.js'
import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

/**
 * 检查OCR配置状态
 */
export async function getOcrStatus(req, res) {
  try {
    const config = checkOcrConfig()
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        configured: config.configured,
        message: config.configured 
          ? 'OCR服务已配置' 
          : '请设置环境变量 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY'
      }
    })
  } catch (error) {
    console.error('检查OCR配置失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '检查配置失败'
    })
  }
}

/**
 * 解析运输单文件
 * 支持：PDF、图片(JPG/PNG)、Excel
 */
export async function parseTransportDoc(req, res) {
  try {
    const { transportType } = req.body // 运输方式: sea/air/rail/truck
    const file = req.file
    
    if (!file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请上传文件'
      })
    }
    
    const fileExt = path.extname(file.originalname).toLowerCase()
    const mimeType = file.mimetype
    
    let parsedData = null
    let ocrText = ''
    
    // 根据文件类型处理
    if (fileExt === '.xlsx' || fileExt === '.xls') {
      // Excel文件处理
      parsedData = await parseExcelFile(file.buffer, transportType)
    } else if (fileExt === '.pdf' || mimeType === 'application/pdf') {
      // PDF文件处理
      const ocrResult = await recognizeTransportDocument(file.buffer, 'pdf')
      
      if (!ocrResult.success) {
        return res.status(500).json({
          errCode: 500,
          msg: ocrResult.error || 'OCR识别失败'
        })
      }
      
      ocrText = ocrResult.data.fullText || ''
      
      // 如果没有指定运输方式，自动检测
      const finalTransportType = transportType || detectTransportType(ocrText)
      parsedData = parseTransportDocument(ocrText, finalTransportType)
      
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(fileExt)) {
      // 图片文件处理
      const ocrResult = await recognizeTransportDocument(file.buffer, 'image')
      
      if (!ocrResult.success) {
        return res.status(500).json({
          errCode: 500,
          msg: ocrResult.error || 'OCR识别失败'
        })
      }
      
      ocrText = ocrResult.data.fullText || ''
      
      // 如果没有指定运输方式，自动检测
      const finalTransportType = transportType || detectTransportType(ocrText)
      parsedData = parseTransportDocument(ocrText, finalTransportType)
      
    } else {
      return res.status(400).json({
        errCode: 400,
        msg: '不支持的文件格式，请上传 PDF、图片(JPG/PNG) 或 Excel 文件'
      })
    }
    
    // 返回解析结果
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        ...parsedData,
        _ocrText: ocrText, // 原始OCR文本（用于调试）
        _fileName: file.originalname,
        _fileType: fileExt
      }
    })
    
  } catch (error) {
    console.error('解析运输单失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '解析失败'
    })
  }
}

/**
 * 解析Excel文件
 * @param {Buffer} buffer - 文件Buffer
 * @param {string} transportType - 运输方式
 * @returns {Object} 解析结果
 */
async function parseExcelFile(buffer, transportType) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)
    
    if (!jsonData || jsonData.length === 0) {
      return {
        transportType: transportType || 'sea',
        error: 'Excel文件为空'
      }
    }
    
    // 取第一行数据
    const firstRow = jsonData[0]
    
    // 通用字段映射
    const fieldMappings = {
      // 中文字段名
      '主单号': 'billNumber',
      '提单号': 'billNumber',
      '运单号': 'billNumber',
      '集装箱号': 'containerNumber',
      '箱号': 'containerNumber',
      '船名航次': 'vessel',
      '航班号': 'flightNumber',
      '列车号': 'trainNumber',
      '车牌号': 'vehicleNumber',
      '起运港': 'portOfLoading',
      '装货港': 'portOfLoading',
      '发货地': 'portOfLoading',
      '目的港': 'portOfDischarge',
      '卸货港': 'portOfDischarge',
      '收货地': 'portOfDischarge',
      '件数': 'pieces',
      '毛重': 'grossWeight',
      '毛重(KG)': 'grossWeight',
      '体积': 'volume',
      '体积(CBM)': 'volume',
      '发货人': 'shipper',
      '收货人': 'consignee',
      '船公司': 'shippingCompany',
      '航空公司': 'airline',
      '承运人': 'carrier',
      'ETA': 'eta',
      '预计到港': 'eta',
      // 英文字段名
      'Bill Number': 'billNumber',
      'B/L No': 'billNumber',
      'AWB': 'billNumber',
      'Container No': 'containerNumber',
      'Vessel': 'vessel',
      'Flight': 'flightNumber',
      'POL': 'portOfLoading',
      'POD': 'portOfDischarge',
      'Pieces': 'pieces',
      'Gross Weight': 'grossWeight',
      'Volume': 'volume',
      'Shipper': 'shipper',
      'Consignee': 'consignee',
    }
    
    // 映射字段
    const result = {
      transportType: transportType || 'sea'
    }
    
    for (const [excelField, modelField] of Object.entries(fieldMappings)) {
      if (firstRow[excelField] !== undefined && firstRow[excelField] !== null) {
        result[modelField] = firstRow[excelField]
      }
    }
    
    // 清理数值字段
    if (result.pieces) result.pieces = parseInt(result.pieces, 10) || null
    if (result.grossWeight) result.grossWeight = parseFloat(result.grossWeight) || null
    if (result.volume) result.volume = parseFloat(result.volume) || null
    
    return result
    
  } catch (error) {
    console.error('解析Excel文件失败:', error)
    return {
      transportType: transportType || 'sea',
      error: 'Excel解析失败: ' + error.message
    }
  }
}

/**
 * 批量解析运输单（从Excel）
 */
export async function batchParseTransportDocs(req, res) {
  try {
    const { transportType } = req.body
    const file = req.file
    
    if (!file) {
      return res.status(400).json({
        errCode: 400,
        msg: '请上传Excel文件'
      })
    }
    
    const fileExt = path.extname(file.originalname).toLowerCase()
    
    if (!['.xlsx', '.xls'].includes(fileExt)) {
      return res.status(400).json({
        errCode: 400,
        msg: '批量导入仅支持Excel文件'
      })
    }
    
    const workbook = xlsx.read(file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)
    
    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        errCode: 400,
        msg: 'Excel文件为空'
      })
    }
    
    // 解析每一行
    const results = jsonData.map((row, index) => {
      const fieldMappings = {
        '主单号': 'billNumber',
        '提单号': 'billNumber',
        '集装箱号': 'containerNumber',
        '船名航次': 'vessel',
        '航班号': 'flightNumber',
        '起运港': 'portOfLoading',
        '目的港': 'portOfDischarge',
        '件数': 'pieces',
        '毛重': 'grossWeight',
        '体积': 'volume',
        '发货人': 'shipper',
        '收货人': 'consignee',
      }
      
      const parsed = {
        _rowIndex: index + 1,
        transportType: transportType || 'sea'
      }
      
      for (const [excelField, modelField] of Object.entries(fieldMappings)) {
        if (row[excelField] !== undefined) {
          parsed[modelField] = row[excelField]
        }
      }
      
      return parsed
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: results.length,
        items: results
      }
    })
    
  } catch (error) {
    console.error('批量解析失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: error.message || '批量解析失败'
    })
  }
}

export default {
  getOcrStatus,
  parseTransportDoc,
  batchParseTransportDocs
}
