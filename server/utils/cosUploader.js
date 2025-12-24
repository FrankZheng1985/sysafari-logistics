/**
 * 腾讯云 COS 上传工具类
 * 
 * 功能：
 * - 上传文件到 COS
 * - 从 COS 下载文件
 * - 删除 COS 文件
 * - 获取文件列表
 * - 生成临时下载链接
 */

import COS from 'cos-nodejs-sdk-v5'
import fs from 'fs'
import path from 'path'
import cosConfig, { isCosConfigured, getBackupKey } from '../config/cos.js'

// COS 实例（延迟初始化）
let cosClient = null

/**
 * 获取 COS 客户端实例（单例模式）
 */
function getCosClient() {
  if (!cosClient) {
    if (!isCosConfigured()) {
      throw new Error('腾讯云 COS 配置不完整，请检查环境变量')
    }
    
    cosClient = new COS({
      SecretId: cosConfig.secretId,
      SecretKey: cosConfig.secretKey,
      Timeout: cosConfig.timeout
    })
  }
  return cosClient
}

/**
 * 上传文件到 COS
 * @param {string} localPath - 本地文件路径
 * @param {string} cosKey - COS 存储路径（可选，默认使用文件名）
 * @param {Function} onProgress - 进度回调（可选）
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadFile(localPath, cosKey = null, onProgress = null) {
  const cos = getCosClient()
  const fileName = path.basename(localPath)
  const key = cosKey || getBackupKey(fileName)
  
  return new Promise((resolve, reject) => {
    // 获取文件大小
    const fileSize = fs.statSync(localPath).size
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2)
    
    console.log(`📤 开始上传文件到 COS: ${fileName} (${fileSizeMB} MB)`)
    
    cos.uploadFile({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: key,
      FilePath: localPath,
      SliceSize: cosConfig.sliceSize,
      onProgress: (progressData) => {
        const percent = Math.round(progressData.percent * 100)
        if (onProgress) {
          onProgress(percent, progressData)
        }
        // 每 20% 输出一次进度
        if (percent % 20 === 0) {
          console.log(`   上传进度: ${percent}%`)
        }
      }
    }, (err, data) => {
      if (err) {
        console.error('❌ 上传失败:', err.message)
        reject(err)
      } else {
        console.log(`✅ 上传成功: ${key}`)
        resolve({
          success: true,
          key: key,
          location: data.Location,
          etag: data.ETag,
          fileName: fileName,
          fileSize: fileSize
        })
      }
    })
  })
}

/**
 * 从 COS 下载文件
 * @param {string} cosKey - COS 存储路径
 * @param {string} localPath - 本地保存路径
 * @param {Function} onProgress - 进度回调（可选）
 * @returns {Promise<Object>} 下载结果
 */
export async function downloadFile(cosKey, localPath, onProgress = null) {
  const cos = getCosClient()
  
  return new Promise((resolve, reject) => {
    console.log(`📥 开始从 COS 下载文件: ${cosKey}`)
    
    // 确保目录存在
    const dir = path.dirname(localPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    cos.getObject({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: cosKey,
      Output: fs.createWriteStream(localPath),
      onProgress: (progressData) => {
        const percent = Math.round(progressData.percent * 100)
        if (onProgress) {
          onProgress(percent, progressData)
        }
      }
    }, (err, data) => {
      if (err) {
        console.error('❌ 下载失败:', err.message)
        reject(err)
      } else {
        const fileSize = fs.statSync(localPath).size
        console.log(`✅ 下载成功: ${localPath}`)
        resolve({
          success: true,
          localPath: localPath,
          fileSize: fileSize,
          contentLength: data.headers['content-length']
        })
      }
    })
  })
}

/**
 * 删除 COS 文件
 * @param {string} cosKey - COS 存储路径
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteFile(cosKey) {
  const cos = getCosClient()
  
  return new Promise((resolve, reject) => {
    console.log(`🗑️  删除 COS 文件: ${cosKey}`)
    
    cos.deleteObject({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: cosKey
    }, (err, data) => {
      if (err) {
        console.error('❌ 删除失败:', err.message)
        reject(err)
      } else {
        console.log(`✅ 删除成功: ${cosKey}`)
        resolve({
          success: true,
          key: cosKey
        })
      }
    })
  })
}

/**
 * 批量删除 COS 文件
 * @param {string[]} cosKeys - COS 存储路径数组
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteFiles(cosKeys) {
  const cos = getCosClient()
  
  return new Promise((resolve, reject) => {
    console.log(`🗑️  批量删除 ${cosKeys.length} 个 COS 文件`)
    
    cos.deleteMultipleObject({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Objects: cosKeys.map(key => ({ Key: key }))
    }, (err, data) => {
      if (err) {
        console.error('❌ 批量删除失败:', err.message)
        reject(err)
      } else {
        console.log(`✅ 批量删除成功: ${data.Deleted?.length || 0} 个文件`)
        resolve({
          success: true,
          deleted: data.Deleted || [],
          errors: data.Error || []
        })
      }
    })
  })
}

/**
 * 获取 COS 文件列表
 * @param {string} prefix - 路径前缀（可选）
 * @param {number} maxKeys - 最大返回数量（默认100）
 * @returns {Promise<Object[]>} 文件列表
 */
export async function listFiles(prefix = null, maxKeys = 100) {
  const cos = getCosClient()
  const searchPrefix = prefix || cosConfig.backupPath
  
  return new Promise((resolve, reject) => {
    cos.getBucket({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Prefix: searchPrefix,
      MaxKeys: maxKeys
    }, (err, data) => {
      if (err) {
        console.error('❌ 获取文件列表失败:', err.message)
        reject(err)
      } else {
        const files = (data.Contents || []).map(item => ({
          key: item.Key,
          fileName: path.basename(item.Key),
          size: parseInt(item.Size),
          lastModified: item.LastModified,
          etag: item.ETag,
          storageClass: item.StorageClass
        }))
        resolve(files)
      }
    })
  })
}

/**
 * 获取文件元信息
 * @param {string} cosKey - COS 存储路径
 * @returns {Promise<Object>} 文件信息
 */
export async function getFileInfo(cosKey) {
  const cos = getCosClient()
  
  return new Promise((resolve, reject) => {
    cos.headObject({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: cosKey
    }, (err, data) => {
      if (err) {
        if (err.statusCode === 404) {
          resolve(null) // 文件不存在
        } else {
          reject(err)
        }
      } else {
        resolve({
          key: cosKey,
          size: parseInt(data.headers['content-length']),
          lastModified: data.headers['last-modified'],
          etag: data.headers['etag'],
          contentType: data.headers['content-type']
        })
      }
    })
  })
}

/**
 * 生成临时下载链接（带签名）
 * @param {string} cosKey - COS 存储路径
 * @param {number} expires - 链接有效期（秒，默认1小时）
 * @returns {Promise<string>} 下载链接
 */
export async function getSignedUrl(cosKey, expires = null) {
  const cos = getCosClient()
  const expireTime = expires || cosConfig.signExpires
  
  return new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: cosKey,
      Sign: true,
      Expires: expireTime
    }, (err, data) => {
      if (err) {
        console.error('❌ 生成下载链接失败:', err.message)
        reject(err)
      } else {
        resolve(data.Url)
      }
    })
  })
}

/**
 * 检查文件是否存在
 * @param {string} cosKey - COS 存储路径
 * @returns {Promise<boolean>} 是否存在
 */
export async function fileExists(cosKey) {
  try {
    const info = await getFileInfo(cosKey)
    return info !== null
  } catch (error) {
    return false
  }
}

/**
 * 复制文件
 * @param {string} sourceKey - 源文件路径
 * @param {string} targetKey - 目标文件路径
 * @returns {Promise<Object>} 复制结果
 */
export async function copyFile(sourceKey, targetKey) {
  const cos = getCosClient()
  
  return new Promise((resolve, reject) => {
    cos.putObjectCopy({
      Bucket: cosConfig.bucket,
      Region: cosConfig.region,
      Key: targetKey,
      CopySource: `${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com/${sourceKey}`
    }, (err, data) => {
      if (err) {
        console.error('❌ 复制失败:', err.message)
        reject(err)
      } else {
        console.log(`✅ 复制成功: ${sourceKey} -> ${targetKey}`)
        resolve({
          success: true,
          sourceKey,
          targetKey,
          etag: data.ETag
        })
      }
    })
  })
}

export default {
  uploadFile,
  downloadFile,
  deleteFile,
  deleteFiles,
  listFiles,
  getFileInfo,
  getSignedUrl,
  fileExists,
  copyFile,
  isCosConfigured
}

