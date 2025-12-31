/**
 * 腾讯云OCR服务 - 运输单识别
 * 
 * 支持识别：海运提单(B/L)、空运单(AWB)、铁路运单、卡航运单
 * 文档: https://cloud.tencent.com/document/product/866
 */

import tencentcloud from 'tencentcloud-sdk-nodejs-ocr'
import fs from 'fs'
import path from 'path'

const OcrClient = tencentcloud.ocr.v20181119.Client

// 创建OCR客户端实例
function createOcrClient() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  
  if (!secretId || !secretKey) {
    console.warn('腾讯云OCR配置缺失，将使用模拟模式')
    return null
  }
  
  const clientConfig = {
    credential: {
      secretId: secretId,
      secretKey: secretKey,
    },
    region: 'ap-guangzhou',
    profile: {
      httpProfile: {
        endpoint: 'ocr.tencentcloudapi.com',
      },
    },
  }
  
  return new OcrClient(clientConfig)
}

/**
 * 通用文档OCR识别
 * @param {string} imageBase64 - 图片的Base64编码
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeDocument(imageBase64) {
  try {
    const client = createOcrClient()
    
    if (!client) {
      // 模拟模式：返回空结果
      return {
        success: true,
        data: {
          textDetections: [],
          fullText: '',
          _mock: true
        }
      }
    }
    
    // 移除Base64前缀
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const base64WithoutPrefix = base64Data.replace(/^data:[^;]+;base64,/, '')
    
    // 调用通用印刷体识别接口
    const response = await client.GeneralAccurateOCR({
      ImageBase64: base64WithoutPrefix
    })
    
    return {
      success: true,
      data: {
        textDetections: response.TextDetections || [],
        fullText: (response.TextDetections || []).map(t => t.DetectedText).join('\n'),
        _raw: response
      }
    }
  } catch (error) {
    console.error('文档OCR识别失败:', error)
    return {
      success: false,
      error: error.message || '识别失败',
      errorCode: error.code || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 表格OCR识别（适用于运输单中的表格数据）
 * @param {string} imageBase64 - 图片的Base64编码
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeTable(imageBase64) {
  try {
    const client = createOcrClient()
    
    if (!client) {
      return {
        success: true,
        data: {
          tableDetections: [],
          _mock: true
        }
      }
    }
    
    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '')
    
    // 调用表格识别接口
    const response = await client.TableOCR({
      ImageBase64: base64Data
    })
    
    return {
      success: true,
      data: {
        tableDetections: response.TableDetections || [],
        _raw: response
      }
    }
  } catch (error) {
    console.error('表格OCR识别失败:', error)
    return {
      success: false,
      error: error.message || '识别失败',
      errorCode: error.code || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 将PDF转换为图片Base64（需要安装pdf2pic或类似库）
 * 简化版本：直接读取PDF并尝试识别
 * @param {Buffer} pdfBuffer - PDF文件Buffer
 * @returns {Promise<string>} Base64编码
 */
export async function pdfToBase64(pdfBuffer) {
  // 直接返回PDF的Base64（腾讯云支持PDF识别）
  return pdfBuffer.toString('base64')
}

/**
 * 识别运输单（支持图片和PDF）
 * @param {Buffer} fileBuffer - 文件Buffer
 * @param {string} fileType - 文件类型 (image/pdf)
 * @returns {Promise<Object>} 识别结果
 */
export async function recognizeTransportDocument(fileBuffer, fileType = 'image') {
  try {
    const client = createOcrClient()
    
    if (!client) {
      // 模拟模式
      return {
        success: true,
        data: {
          textDetections: [],
          fullText: '',
          _mock: true
        }
      }
    }
    
    let base64Data = fileBuffer.toString('base64')
    
    if (fileType === 'pdf') {
      // PDF文件处理
      const response = await client.GeneralAccurateOCR({
        ImageBase64: base64Data,
        IsPdf: true,
        PdfPageNumber: 1 // 只识别第一页
      })
      
      return {
        success: true,
        data: {
          textDetections: response.TextDetections || [],
          fullText: (response.TextDetections || []).map(t => t.DetectedText).join('\n'),
          _raw: response
        }
      }
    } else {
      // 图片文件处理
      const response = await client.GeneralAccurateOCR({
        ImageBase64: base64Data
      })
      
      return {
        success: true,
        data: {
          textDetections: response.TextDetections || [],
          fullText: (response.TextDetections || []).map(t => t.DetectedText).join('\n'),
          _raw: response
        }
      }
    }
  } catch (error) {
    console.error('运输单OCR识别失败:', error)
    return {
      success: false,
      error: error.message || '识别失败',
      errorCode: error.code || 'UNKNOWN_ERROR'
    }
  }
}

/**
 * 检查腾讯云OCR配置是否完整
 * @returns {Object} 配置状态
 */
export function checkOcrConfig() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  
  return {
    configured: !!(secretId && secretKey),
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey
  }
}

export default {
  recognizeDocument,
  recognizeTable,
  recognizeTransportDocument,
  pdfToBase64,
  checkOcrConfig
}
