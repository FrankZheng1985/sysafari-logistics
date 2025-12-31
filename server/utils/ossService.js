/**
 * 阿里云 OSS 对象存储服务
 * 用于上传和管理报价单PDF文件
 */

import OSS from 'ali-oss'
import dotenv from 'dotenv'

dotenv.config()

// OSS 配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
}

// OSS 客户端实例
let ossClient = null

/**
 * 获取 OSS 客户端实例
 */
function getOssClient() {
  if (!ossClient && ossConfig.accessKeyId && ossConfig.accessKeySecret && ossConfig.bucket) {
    ossClient = new OSS({
      region: ossConfig.region,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket
    })
  }
  return ossClient
}

/**
 * 检查 OSS 配置是否完整
 */
export function checkOssConfig() {
  const { region, accessKeyId, accessKeySecret, bucket } = ossConfig
  return {
    configured: !!(accessKeyId && accessKeySecret && bucket),
    missing: {
      accessKeyId: !accessKeyId,
      accessKeySecret: !accessKeySecret,
      bucket: !bucket,
      region: !region
    }
  }
}

/**
 * 上传报价单PDF到OSS
 * @param {Object} options - 上传选项
 * @param {string} options.customerId - 客户ID
 * @param {string} options.quoteNumber - 报价单号
 * @param {Buffer} options.pdfBuffer - PDF文件Buffer
 * @returns {Promise<Object>} - 上传结果，包含文件URL
 */
export async function uploadQuotationPdf({ customerId, quoteNumber, pdfBuffer }) {
  const client = getOssClient()
  
  if (!client) {
    throw new Error('OSS 未配置，请检查环境变量')
  }
  
  const key = `quotations/${customerId}/${quoteNumber}.pdf`
  
  try {
    const result = await client.put(key, pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf'
      }
    })
    
    // 构建访问URL
    const url = result.url || `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${key}`
    
    return {
      success: true,
      key,
      url,
      etag: result.etag
    }
  } catch (err) {
    console.error('OSS上传失败:', err)
    throw err
  }
}

/**
 * 获取客户最新的报价单PDF URL
 * @param {string} customerId - 客户ID
 * @returns {Promise<Object|null>} - 最新报价单信息
 */
export async function getLatestQuotationPdf(customerId) {
  const client = getOssClient()
  
  if (!client) {
    throw new Error('OSS 未配置，请检查环境变量')
  }
  
  try {
    const result = await client.list({
      prefix: `quotations/${customerId}/`,
      'max-keys': 100
    })
    
    const files = result.objects || []
    if (files.length === 0) {
      return null
    }
    
    // 按最后修改时间排序，取最新的
    files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
    const latest = files[0]
    
    const url = `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${latest.name}`
    return {
      key: latest.name,
      url,
      lastModified: latest.lastModified,
      size: latest.size
    }
  } catch (err) {
    console.error('OSS获取文件列表失败:', err)
    throw err
  }
}

/**
 * 获取客户所有报价单PDF历史
 * @param {string} customerId - 客户ID
 * @returns {Promise<Array>} - 报价单列表
 */
export async function getQuotationHistory(customerId) {
  const client = getOssClient()
  
  if (!client) {
    throw new Error('OSS 未配置，请检查环境变量')
  }
  
  try {
    const result = await client.list({
      prefix: `quotations/${customerId}/`,
      'max-keys': 1000
    })
    
    const files = (result.objects || []).map(file => {
      // 从name中提取报价单号
      const fileName = file.name.split('/').pop()
      const quoteNumber = fileName.replace('.pdf', '')
      
      return {
        key: file.name,
        quoteNumber,
        url: `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${file.name}`,
        lastModified: file.lastModified,
        size: file.size
      }
    })
    
    // 按时间降序排列
    files.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
    
    return files
  } catch (err) {
    console.error('OSS获取文件列表失败:', err)
    throw err
  }
}

/**
 * 删除报价单PDF
 * @param {string} key - 文件Key
 * @returns {Promise<boolean>}
 */
export async function deleteQuotationPdf(key) {
  const client = getOssClient()
  
  if (!client) {
    throw new Error('OSS 未配置，请检查环境变量')
  }
  
  try {
    await client.delete(key)
    return true
  } catch (err) {
    console.error('OSS删除文件失败:', err)
    throw err
  }
}

/**
 * 生成临时访问URL（带签名，适用于私有Bucket）
 * @param {string} key - 文件Key
 * @param {number} expires - 有效期（秒），默认1小时
 * @returns {string} - 签名URL
 */
export function getSignedUrl(key, expires = 3600) {
  const client = getOssClient()
  
  if (!client) {
    throw new Error('OSS 未配置，请检查环境变量')
  }
  
  return client.signatureUrl(key, { expires })
}

export default {
  checkOssConfig,
  uploadQuotationPdf,
  getLatestQuotationPdf,
  getQuotationHistory,
  deleteQuotationPdf,
  getSignedUrl
}
