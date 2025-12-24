/**
 * 腾讯云 COS 对象存储服务
 * 支持文档管理、报价单PDF等文件的上传和管理
 */

import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'

dotenv.config()

// COS 配置（兼容两种环境变量命名方式）
const cosConfig = {
  SecretId: process.env.COS_SECRET_ID || process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY || process.env.TENCENT_SECRET_KEY,
  Bucket: process.env.COS_BUCKET || process.env.TENCENT_COS_BUCKET,
  Region: process.env.COS_REGION || process.env.TENCENT_COS_REGION || 'ap-guangzhou'
}

// 创建 COS 实例
let cosClient = null

/**
 * 获取 COS 客户端实例
 */
function getCosClient() {
  if (!cosClient && cosConfig.SecretId && cosConfig.SecretKey) {
    cosClient = new COS({
      SecretId: cosConfig.SecretId,
      SecretKey: cosConfig.SecretKey
    })
  }
  return cosClient
}

/**
 * 获取COS配置信息
 */
export function getCosConfig() {
  return {
    bucket: cosConfig.Bucket,
    region: cosConfig.Region
  }
}

/**
 * 检查 COS 配置是否完整
 */
export function checkCosConfig() {
  const { SecretId, SecretKey, Bucket, Region } = cosConfig
  return {
    configured: !!(SecretId && SecretKey && Bucket && Region),
    missing: {
      SecretId: !SecretId,
      SecretKey: !SecretKey,
      Bucket: !Bucket,
      Region: !Region
    }
  }
}

/**
 * MIME类型映射
 */
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed'
}

/**
 * 根据文件扩展名获取MIME类型
 */
export function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * 生成唯一文件名
 */
export function generateUniqueFileName(originalName) {
  const ext = path.extname(originalName)
  const baseName = path.basename(originalName, ext)
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex')
  // 清理文件名中的特殊字符
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_')
  return `${cleanBaseName}_${timestamp}_${random}${ext}`
}

/**
 * 构建文档存储路径
 * 目录结构: /orders/{bill_number}/documents/{document_type}/{filename}
 */
export function buildDocumentKey(options) {
  const { billNumber, documentType, fileName } = options
  const safeFileName = generateUniqueFileName(fileName)
  
  if (billNumber) {
    return `orders/${billNumber}/documents/${documentType || 'other'}/${safeFileName}`
  }
  return `documents/${documentType || 'other'}/${safeFileName}`
}

// ==================== 通用文档上传功能 ====================

/**
 * 上传文档到COS
 * @param {Object} options - 上传选项
 * @param {Buffer|Stream} options.body - 文件内容
 * @param {string} options.fileName - 原始文件名
 * @param {string} options.billNumber - 关联订单号（可选）
 * @param {string} options.documentType - 文档类型（可选）
 * @param {string} options.customKey - 自定义Key（可选，优先级最高）
 * @param {string} options.contentType - MIME类型（可选，自动识别）
 * @returns {Promise<Object>} - 上传结果
 */
export async function uploadDocument(options) {
  const { body, fileName, billNumber, documentType, customKey, contentType } = options
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  // 确定存储Key
  const key = customKey || buildDocumentKey({
    billNumber,
    documentType,
    fileName
  })
  
  // 确定Content-Type
  const mimeType = contentType || getMimeType(fileName)
  
  return new Promise((resolve, reject) => {
    client.putObject({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Key: key,
      Body: body,
      ContentType: mimeType,
      // 设置文件元数据
      'x-cos-meta-original-name': encodeURIComponent(fileName),
      'x-cos-meta-upload-time': new Date().toISOString()
    }, (err, data) => {
      if (err) {
        console.error('COS上传失败:', err)
        reject(err)
      } else {
        const url = `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${key}`
        resolve({
          success: true,
          key,
          url,
          bucket: cosConfig.Bucket,
          region: cosConfig.Region,
          etag: data.ETag,
          mimeType,
          originalName: fileName
        })
      }
    })
  })
}

/**
 * 上传文件Buffer到COS
 * @param {Buffer} buffer - 文件Buffer
 * @param {string} fileName - 文件名
 * @param {Object} options - 额外选项
 */
export async function uploadBuffer(buffer, fileName, options = {}) {
  return uploadDocument({
    body: buffer,
    fileName,
    ...options
  })
}

/**
 * 批量上传文档
 * @param {Array} files - 文件数组，每个元素包含 { body, fileName, billNumber, documentType }
 * @returns {Promise<Array>} - 上传结果数组
 */
export async function uploadDocuments(files) {
  const results = []
  for (const file of files) {
    try {
      const result = await uploadDocument(file)
      results.push({ success: true, ...result })
    } catch (error) {
      results.push({
        success: false,
        fileName: file.fileName,
        error: error.message
      })
    }
  }
  return results
}

// ==================== 文档删除功能 ====================

/**
 * 删除COS文件
 * @param {string} key - 文件Key
 * @returns {Promise<boolean>}
 */
export async function deleteDocument(key) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  return new Promise((resolve, reject) => {
    client.deleteObject({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Key: key
    }, (err) => {
      if (err) {
        console.error('COS删除文件失败:', err)
        reject(err)
      } else {
        resolve(true)
      }
    })
  })
}

/**
 * 批量删除COS文件
 * @param {Array<string>} keys - 文件Key数组
 * @returns {Promise<Object>}
 */
export async function deleteDocuments(keys) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  if (keys.length === 0) {
    return { deleted: [], errors: [] }
  }
  
  return new Promise((resolve, reject) => {
    client.deleteMultipleObject({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Objects: keys.map(key => ({ Key: key }))
    }, (err, data) => {
      if (err) {
        console.error('COS批量删除失败:', err)
        reject(err)
      } else {
        resolve({
          deleted: data.Deleted || [],
          errors: data.Error || []
        })
      }
    })
  })
}

// ==================== 文档查询功能 ====================

/**
 * 获取订单相关的所有文档
 * @param {string} billNumber - 订单号
 * @returns {Promise<Array>}
 */
export async function getOrderDocuments(billNumber) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  const prefix = `orders/${billNumber}/documents/`
  
  return new Promise((resolve, reject) => {
    client.getBucket({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Prefix: prefix,
      MaxKeys: 1000
    }, (err, data) => {
      if (err) {
        console.error('COS获取文件列表失败:', err)
        reject(err)
        return
      }
      
      const files = (data.Contents || []).map(file => {
        const pathParts = file.Key.split('/')
        const fileName = pathParts.pop()
        const documentType = pathParts.pop() || 'other'
        
        return {
          key: file.Key,
          fileName,
          documentType,
          url: `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${file.Key}`,
          lastModified: file.LastModified,
          size: file.Size
        }
      })
      
      // 按时间降序排列
      files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      
      resolve(files)
    })
  })
}

/**
 * 按前缀获取文件列表
 * @param {string} prefix - 文件前缀
 * @param {number} maxKeys - 最大返回数量
 * @returns {Promise<Array>}
 */
export async function listByPrefix(prefix, maxKeys = 1000) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  return new Promise((resolve, reject) => {
    client.getBucket({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Prefix: prefix,
      MaxKeys: maxKeys
    }, (err, data) => {
      if (err) {
        console.error('COS获取文件列表失败:', err)
        reject(err)
        return
      }
      
      const files = (data.Contents || []).map(file => ({
        key: file.Key,
        url: `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${file.Key}`,
        lastModified: file.LastModified,
        size: file.Size,
        etag: file.ETag
      }))
      
      resolve(files)
    })
  })
}

/**
 * 获取文件元数据
 * @param {string} key - 文件Key
 * @returns {Promise<Object>}
 */
export async function getFileMetadata(key) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  return new Promise((resolve, reject) => {
    client.headObject({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Key: key
    }, (err, data) => {
      if (err) {
        if (err.statusCode === 404) {
          resolve(null)
        } else {
          reject(err)
        }
      } else {
        resolve({
          contentType: data.headers['content-type'],
          contentLength: parseInt(data.headers['content-length'], 10),
          lastModified: data.headers['last-modified'],
          etag: data.headers['etag'],
          // 自定义元数据
          originalName: data.headers['x-cos-meta-original-name'] 
            ? decodeURIComponent(data.headers['x-cos-meta-original-name'])
            : null,
          uploadTime: data.headers['x-cos-meta-upload-time']
        })
      }
    })
  })
}

/**
 * 检查文件是否存在
 * @param {string} key - 文件Key
 * @returns {Promise<boolean>}
 */
export async function fileExists(key) {
  const metadata = await getFileMetadata(key)
  return metadata !== null
}

// ==================== 文档访问功能 ====================

/**
 * 生成临时访问URL（带签名，适用于私有读写的Bucket）
 * @param {string} key - 文件Key
 * @param {number} expires - 有效期（秒），默认1小时
 * @returns {Promise<string>} - 签名URL
 */
export async function getSignedUrl(key, expires = 3600) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  return new Promise((resolve, reject) => {
    client.getObjectUrl({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Key: key,
      Sign: true,
      Expires: expires
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data.Url)
      }
    })
  })
}

/**
 * 生成下载URL（带签名，强制下载）
 * @param {string} key - 文件Key
 * @param {string} fileName - 下载时的文件名
 * @param {number} expires - 有效期（秒）
 * @returns {Promise<string>}
 */
export async function getDownloadUrl(key, fileName, expires = 3600) {
  const client = getCosClient()
  
  if (!client) {
    throw new Error('COS 未配置，请检查环境变量')
  }
  
  return new Promise((resolve, reject) => {
    client.getObjectUrl({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Key: key,
      Sign: true,
      Expires: expires,
      Query: {
        'response-content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
      }
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data.Url)
      }
    })
  })
}

/**
 * 获取公开访问URL（适用于公共读Bucket）
 * @param {string} key - 文件Key
 * @returns {string}
 */
export function getPublicUrl(key) {
  return `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${key}`
}

// ==================== 旧接口兼容（报价单） ====================

/**
 * 上传报价单PDF到COS
 * @param {Object} options - 上传选项
 * @param {string} options.customerId - 客户ID
 * @param {string} options.quoteNumber - 报价单号
 * @param {Buffer} options.pdfBuffer - PDF文件Buffer
 * @returns {Promise<Object>} - 上传结果，包含文件URL
 */
export async function uploadQuotationPdf({ customerId, quoteNumber, pdfBuffer }) {
  const key = `quotations/${customerId}/${quoteNumber}.pdf`
  
  return uploadDocument({
    body: pdfBuffer,
    fileName: `${quoteNumber}.pdf`,
    customKey: key,
    contentType: 'application/pdf'
  })
}

/**
 * 获取客户最新的报价单PDF URL
 * @param {string} customerId - 客户ID
 * @returns {Promise<Object|null>} - 最新报价单信息
 */
export async function getLatestQuotationPdf(customerId) {
  const files = await listByPrefix(`quotations/${customerId}/`, 100)
  
  if (files.length === 0) {
    return null
  }
  
  // 按最后修改时间排序，取最新的
  files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
  const latest = files[0]
  
  return {
    key: latest.key,
    url: latest.url,
    lastModified: latest.lastModified,
    size: latest.size
  }
}

/**
 * 获取客户所有报价单PDF历史
 * @param {string} customerId - 客户ID
 * @returns {Promise<Array>} - 报价单列表
 */
export async function getQuotationHistory(customerId) {
  const files = await listByPrefix(`quotations/${customerId}/`, 1000)
  
  return files.map(file => {
    const fileName = file.key.split('/').pop()
    const quoteNumber = fileName.replace('.pdf', '')
    
    return {
      key: file.key,
      quoteNumber,
      url: file.url,
      lastModified: file.lastModified,
      size: file.size
    }
  }).sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
}

/**
 * 删除报价单PDF
 * @param {string} key - 文件Key
 * @returns {Promise<boolean>}
 */
export async function deleteQuotationPdf(key) {
  return deleteDocument(key)
}

// ==================== 导出 ====================

export default {
  // 配置检查
  checkCosConfig,
  getCosConfig,
  
  // 工具函数
  getMimeType,
  generateUniqueFileName,
  buildDocumentKey,
  
  // 文档上传
  uploadDocument,
  uploadBuffer,
  uploadDocuments,
  
  // 文档删除
  deleteDocument,
  deleteDocuments,
  
  // 文档查询
  getOrderDocuments,
  listByPrefix,
  getFileMetadata,
  fileExists,
  
  // 文档访问
  getSignedUrl,
  getDownloadUrl,
  getPublicUrl,
  
  // 兼容旧接口
  uploadQuotationPdf,
  getLatestQuotationPdf,
  getQuotationHistory,
  deleteQuotationPdf
}
