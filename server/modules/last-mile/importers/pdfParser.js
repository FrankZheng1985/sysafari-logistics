/**
 * PDF报价表解析器
 * 使用腾讯云OCR识别PDF中的表格
 */

import fetch from 'node-fetch'
import crypto from 'crypto'

// 腾讯云API配置
const TENCENT_OCR_CONFIG = {
  secretId: process.env.TENCENT_SECRET_ID,
  secretKey: process.env.TENCENT_SECRET_KEY,
  region: 'ap-guangzhou',
  endpoint: 'ocr.tencentcloudapi.com'
}

/**
 * 解析PDF文件（使用OCR）
 * @param {Buffer} fileBuffer - PDF文件Buffer
 * @param {Object} options - 解析选项
 * @returns {Object} 解析结果
 */
export async function parsePdf(fileBuffer, options = {}) {
  const { pageNumber = 1 } = options
  
  // 检查OCR配置
  if (!TENCENT_OCR_CONFIG.secretId || !TENCENT_OCR_CONFIG.secretKey) {
    return {
      success: false,
      error: 'OCR服务未配置（需要TENCENT_SECRET_ID和TENCENT_SECRET_KEY环境变量）',
      configMissing: true
    }
  }
  
  try {
    // 将PDF转换为Base64
    const pdfBase64 = fileBuffer.toString('base64')
    
    // 调用腾讯云表格OCR
    const ocrResult = await callTableOCR(pdfBase64, 'PDF')
    
    if (!ocrResult.success) {
      return ocrResult
    }
    
    // 转换OCR结果为标准格式
    const standardData = convertOCRToStandard(ocrResult.data)
    
    return {
      success: true,
      data: standardData,
      rawOCR: ocrResult.data
    }
  } catch (error) {
    return {
      success: false,
      error: `PDF解析失败: ${error.message}`
    }
  }
}

/**
 * 解析图片中的表格（用于PDF页面转图片后识别）
 * @param {Buffer} imageBuffer - 图片Buffer
 * @returns {Object} 解析结果
 */
export async function parseImage(imageBuffer) {
  if (!TENCENT_OCR_CONFIG.secretId || !TENCENT_OCR_CONFIG.secretKey) {
    return {
      success: false,
      error: 'OCR服务未配置',
      configMissing: true
    }
  }
  
  try {
    const imageBase64 = imageBuffer.toString('base64')
    const ocrResult = await callTableOCR(imageBase64, 'Image')
    
    if (!ocrResult.success) {
      return ocrResult
    }
    
    const standardData = convertOCRToStandard(ocrResult.data)
    
    return {
      success: true,
      data: standardData,
      rawOCR: ocrResult.data
    }
  } catch (error) {
    return {
      success: false,
      error: `图片解析失败: ${error.message}`
    }
  }
}

/**
 * 调用腾讯云表格OCR API
 */
async function callTableOCR(base64Data, fileType) {
  const action = 'RecognizeTableOCR'
  const version = '2018-11-19'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date().toISOString().split('T')[0]
  
  const payload = JSON.stringify({
    ImageBase64: base64Data,
    IsPdf: fileType === 'PDF',
    PdfPageNumber: 1
  })
  
  // 构建请求签名
  const headers = buildTencentHeaders(action, version, timestamp, date, payload)
  
  try {
    const response = await fetch(`https://${TENCENT_OCR_CONFIG.endpoint}`, {
      method: 'POST',
      headers,
      body: payload
    })
    
    const result = await response.json()
    
    if (result.Response && result.Response.Error) {
      return {
        success: false,
        error: `OCR识别失败: ${result.Response.Error.Message}`
      }
    }
    
    return {
      success: true,
      data: result.Response
    }
  } catch (error) {
    return {
      success: false,
      error: `OCR API调用失败: ${error.message}`
    }
  }
}

/**
 * 构建腾讯云API请求头
 */
function buildTencentHeaders(action, version, timestamp, date, payload) {
  const { secretId, secretKey, region, endpoint } = TENCENT_OCR_CONFIG
  const service = 'ocr'
  
  // 计算签名
  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex')
  
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`
  const signedHeaders = 'content-type;host'
  
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n')
  
  const algorithm = 'TC3-HMAC-SHA256'
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n')
  
  // 计算签名
  const secretDate = hmacSha256(`TC3${secretKey}`, date)
  const secretService = hmacSha256(secretDate, service)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = hmacSha256(secretSigning, stringToSign, 'hex')
  
  const authorization = [
    `${algorithm} Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ')
  
  return {
    'Authorization': authorization,
    'Content-Type': 'application/json',
    'Host': endpoint,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': region
  }
}

/**
 * HMAC-SHA256加密
 */
function hmacSha256(key, data, encoding = 'buffer') {
  const hmac = crypto.createHmac('sha256', key)
  hmac.update(data)
  return encoding === 'hex' ? hmac.digest('hex') : hmac.digest()
}

/**
 * 将OCR结果转换为标准格式
 */
function convertOCRToStandard(ocrData) {
  const tables = ocrData.TableDetections || []
  
  if (tables.length === 0) {
    return {
      success: false,
      error: '未检测到表格'
    }
  }
  
  // 处理第一个表格
  const table = tables[0]
  const cells = table.Cells || []
  
  // 构建表格矩阵
  let maxRow = 0
  let maxCol = 0
  
  cells.forEach(cell => {
    maxRow = Math.max(maxRow, cell.RowTl, cell.RowBr)
    maxCol = Math.max(maxCol, cell.ColTl, cell.ColBr)
  })
  
  // 初始化矩阵
  const matrix = Array(maxRow + 1).fill(null).map(() => 
    Array(maxCol + 1).fill('')
  )
  
  // 填充单元格
  cells.forEach(cell => {
    const text = cell.Text || ''
    for (let r = cell.RowTl; r <= cell.RowBr; r++) {
      for (let c = cell.ColTl; c <= cell.ColBr; c++) {
        matrix[r][c] = text
      }
    }
  })
  
  // 构建标准格式
  const headers = matrix[0].map((value, idx) => ({
    index: idx,
    column: getColumnLetter(idx),
    value: String(value || '').trim()
  }))
  
  const rows = matrix.slice(1).map((row, rowIdx) => ({
    rowNumber: rowIdx + 2,
    cells: row.map((cell, cellIdx) => ({
      column: getColumnLetter(cellIdx),
      value: cell,
      formatted: String(cell || '').trim()
    }))
  }))
  
  return {
    sheetName: 'OCR识别结果',
    totalRows: matrix.length,
    totalColumns: maxCol + 1,
    headers,
    rows,
    rawData: matrix,
    confidence: table.Confidence || 0,
    tableCount: tables.length
  }
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
 * 检查OCR配置状态
 */
export function checkOCRConfig() {
  return {
    configured: !!(TENCENT_OCR_CONFIG.secretId && TENCENT_OCR_CONFIG.secretKey),
    provider: 'tencent'
  }
}

export default {
  parsePdf,
  parseImage,
  checkOCRConfig
}
