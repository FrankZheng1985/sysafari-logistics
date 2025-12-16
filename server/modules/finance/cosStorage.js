/**
 * 腾讯云COS存储服务
 * 
 * 用于上传和管理发票文件
 */

import COS from 'cos-nodejs-sdk-v5'

// COS客户端实例
let cosClient = null

/**
 * 获取COS客户端
 */
function getCosClient() {
  if (!cosClient) {
    const secretId = process.env.TENCENT_SECRET_ID
    const secretKey = process.env.TENCENT_SECRET_KEY
    
    if (!secretId || !secretKey) {
      throw new Error('腾讯云配置缺失：请设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY 环境变量')
    }
    
    cosClient = new COS({
      SecretId: secretId,
      SecretKey: secretKey
    })
  }
  return cosClient
}

/**
 * 获取COS配置
 */
function getCosConfig() {
  const bucket = process.env.TENCENT_COS_BUCKET
  const region = process.env.TENCENT_COS_REGION || 'ap-guangzhou'
  
  if (!bucket) {
    throw new Error('COS配置缺失：请设置 TENCENT_COS_BUCKET 环境变量')
  }
  
  return { bucket, region }
}

/**
 * 上传文件到COS
 * @param {Buffer} buffer - 文件内容
 * @param {string} key - 文件路径/名称
 * @param {string} contentType - 文件MIME类型
 * @returns {Promise<string>} 文件URL
 */
export async function uploadFile(buffer, key, contentType) {
  const cos = getCosClient()
  const { bucket, region } = getCosConfig()
  
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }, (err, data) => {
      if (err) {
        console.error('COS上传失败:', err)
        reject(err)
      } else {
        // 生成访问URL
        const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`
        resolve(url)
      }
    })
  })
}

/**
 * 上传发票PDF
 * @param {Buffer} pdfBuffer - PDF文件内容
 * @param {string} invoiceNumber - 发票编号
 * @returns {Promise<string>} PDF文件URL
 */
export async function uploadInvoicePDF(pdfBuffer, invoiceNumber) {
  const year = new Date().getFullYear()
  const key = `invoices/${year}/${invoiceNumber}.pdf`
  return uploadFile(pdfBuffer, key, 'application/pdf')
}

/**
 * 上传对账单Excel
 * @param {Buffer} excelBuffer - Excel文件内容
 * @param {string} invoiceNumber - 发票编号
 * @returns {Promise<string>} Excel文件URL
 */
export async function uploadStatementExcel(excelBuffer, invoiceNumber) {
  const year = new Date().getFullYear()
  const key = `invoices/${year}/${invoiceNumber}_statement.xlsx`
  return uploadFile(excelBuffer, key, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

/**
 * 获取文件临时访问URL（带签名）
 * @param {string} key - 文件路径
 * @param {number} expires - 有效期（秒），默认1小时
 * @returns {Promise<string>} 带签名的临时URL
 */
export async function getSignedUrl(key, expires = 3600) {
  const cos = getCosClient()
  const { bucket, region } = getCosConfig()
  
  return new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: bucket,
      Region: region,
      Key: key,
      Sign: true,
      Expires: expires
    }, (err, data) => {
      if (err) {
        console.error('获取签名URL失败:', err)
        reject(err)
      } else {
        resolve(data.Url)
      }
    })
  })
}

/**
 * 从URL提取文件Key
 * @param {string} url - 文件URL
 * @returns {string} 文件Key
 */
export function extractKeyFromUrl(url) {
  if (!url) return null
  try {
    const urlObj = new URL(url)
    // 移除开头的斜杠
    return urlObj.pathname.replace(/^\//, '')
  } catch {
    return null
  }
}

/**
 * 删除COS文件
 * @param {string} key - 文件路径
 */
export async function deleteFile(key) {
  const cos = getCosClient()
  const { bucket, region } = getCosConfig()
  
  return new Promise((resolve, reject) => {
    cos.deleteObject({
      Bucket: bucket,
      Region: region,
      Key: key
    }, (err, data) => {
      if (err) {
        console.error('COS删除失败:', err)
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

/**
 * 检查COS配置是否完整
 */
export function checkCosConfig() {
  const secretId = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY
  const bucket = process.env.TENCENT_COS_BUCKET
  const region = process.env.TENCENT_COS_REGION
  
  return {
    configured: !!(secretId && secretKey && bucket),
    hasSecretId: !!secretId,
    hasSecretKey: !!secretKey,
    hasBucket: !!bucket,
    hasRegion: !!region,
    bucket,
    region: region || 'ap-guangzhou'
  }
}

export default {
  uploadFile,
  uploadInvoicePDF,
  uploadStatementExcel,
  getSignedUrl,
  extractKeyFromUrl,
  deleteFile,
  checkCosConfig
}
