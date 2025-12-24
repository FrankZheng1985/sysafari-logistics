/**
 * 腾讯云 COS 配置
 * 
 * 用于数据库备份文件的云端存储
 * 
 * 环境变量配置：
 * - TENCENT_COS_SECRET_ID: 腾讯云 SecretId
 * - TENCENT_COS_SECRET_KEY: 腾讯云 SecretKey
 * - TENCENT_COS_BUCKET: COS 存储桶名称
 * - TENCENT_COS_REGION: COS 地域（如 ap-guangzhou）
 * - TENCENT_COS_BACKUP_PATH: 备份文件存储路径前缀
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// COS 配置
const cosConfig = {
  // 腾讯云 API 密钥（兼容两种命名方式）
  secretId: process.env.TENCENT_COS_SECRET_ID || process.env.TENCENT_SECRET_ID || '',
  secretKey: process.env.TENCENT_COS_SECRET_KEY || process.env.TENCENT_SECRET_KEY || '',
  
  // 存储桶配置
  bucket: process.env.TENCENT_COS_BUCKET || '',
  region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
  
  // 备份文件路径前缀
  backupPath: process.env.TENCENT_COS_BACKUP_PATH || 'backups/database/',
  
  // 临时链接有效期（秒）
  signExpires: 3600, // 1小时
  
  // 分片上传配置
  sliceSize: 1024 * 1024 * 5, // 5MB 分片
  
  // 超时配置（毫秒）
  timeout: 60000 * 10 // 10分钟
}

/**
 * 检查 COS 配置是否完整
 */
export function isCosConfigured() {
  return !!(
    cosConfig.secretId && 
    cosConfig.secretKey && 
    cosConfig.bucket && 
    cosConfig.region
  )
}

/**
 * 获取 COS 配置
 */
export function getCosConfig() {
  return { ...cosConfig }
}

/**
 * 获取备份文件的 COS Key
 * @param {string} fileName - 文件名
 */
export function getBackupKey(fileName) {
  return `${cosConfig.backupPath}${fileName}`
}

export default cosConfig

