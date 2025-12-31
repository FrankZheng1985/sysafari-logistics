/**
 * TARIC 数据下载器
 * 从欧盟官方数据源下载 TARIC 数据
 */

import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 本地数据存储目录
const DATA_DIR = path.join(__dirname, '../../data/taric')

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

// ==================== 数据源配置 ====================

/**
 * EU TARIC 数据源配置
 * 
 * 官方数据下载地址：
 * - CIRCABC: https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa
 * - Open Data Portal: https://data.europa.eu/
 * 
 * 注意：CIRCABC 需要登录才能下载，这里提供手动上传的替代方案
 */
const DATA_SOURCES = {
  // TARIC 商品分类编码（Nomenclature）
  nomenclature: {
    name: 'TARIC Nomenclature',
    description: '欧盟商品分类编码（CN8/TARIC）',
    localFile: 'Nomenclature_EN.xlsx',
    // 官方下载需要登录，建议手动下载后放到 data/taric/ 目录
    manualDownloadUrl: 'https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa'
  },
  // TARIC 关税税率（Duties）
  duties: {
    name: 'TARIC Duties',
    description: '欧盟进口关税数据',
    localFile: 'Duties_Import.xlsx',
    manualDownloadUrl: 'https://circabc.europa.eu/ui/group/0e5f18c2-4b2f-42e9-aed4-dfe50ae1263b/library/fdb16dca-3e48-4644-b685-d8ccfd88adfa'
  }
}

// ==================== 下载功能 ====================

/**
 * 下载文件
 * @param {string} url - 下载地址
 * @param {string} destPath - 保存路径
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<string>} 保存的文件路径
 */
export function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TaricSync/1.0)',
        'Accept': '*/*'
      },
      timeout: 60000
    }, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject)
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${response.statusCode}`))
        return
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10) || 0
      let downloadedSize = 0
      
      const file = fs.createWriteStream(destPath)
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        if (onProgress && totalSize > 0) {
          onProgress(Math.round((downloadedSize / totalSize) * 100))
        }
      })
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        resolve(destPath)
      })
      
      file.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })
    
    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('下载超时'))
    })
  })
}

/**
 * 检查本地数据文件状态
 */
export function checkLocalFiles() {
  ensureDataDir()
  
  const status = {}
  
  for (const [key, source] of Object.entries(DATA_SOURCES)) {
    const filePath = path.join(DATA_DIR, source.localFile)
    const exists = fs.existsSync(filePath)
    
    let fileInfo = null
    if (exists) {
      const stats = fs.statSync(filePath)
      fileInfo = {
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        modifiedTime: stats.mtime.toISOString(),
        modifiedTimeFormatted: stats.mtime.toLocaleString('zh-CN')
      }
    }
    
    status[key] = {
      name: source.name,
      description: source.description,
      localFile: source.localFile,
      filePath,
      exists,
      fileInfo,
      manualDownloadUrl: source.manualDownloadUrl
    }
  }
  
  return status
}

/**
 * 获取本地数据文件路径
 */
export function getLocalFilePath(type) {
  const source = DATA_SOURCES[type]
  if (!source) {
    throw new Error(`未知的数据类型: ${type}`)
  }
  
  const filePath = path.join(DATA_DIR, source.localFile)
  if (!fs.existsSync(filePath)) {
    return null
  }
  
  return filePath
}

/**
 * 保存上传的数据文件
 */
export async function saveUploadedFile(type, fileBuffer, originalName) {
  ensureDataDir()
  
  const source = DATA_SOURCES[type]
  if (!source) {
    throw new Error(`未知的数据类型: ${type}`)
  }
  
  // 确定文件名
  let fileName = source.localFile
  if (originalName) {
    // 保留原始文件扩展名
    const ext = path.extname(originalName)
    if (ext) {
      fileName = source.localFile.replace(/\.[^.]+$/, ext)
    }
  }
  
  const filePath = path.join(DATA_DIR, fileName)
  
  // 如果已存在，先备份
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + '.backup.' + Date.now()
    fs.renameSync(filePath, backupPath)
  }
  
  // 保存新文件
  fs.writeFileSync(filePath, fileBuffer)
  
  const stats = fs.statSync(filePath)
  return {
    filePath,
    fileName,
    size: stats.size,
    sizeFormatted: formatFileSize(stats.size)
  }
}

/**
 * 读取本地数据文件
 */
export function readLocalFile(type) {
  const filePath = getLocalFilePath(type)
  if (!filePath) {
    return null
  }
  
  return fs.readFileSync(filePath)
}

/**
 * 获取 TARIC 版本号（基于文件修改时间）
 */
export function getTaricVersion() {
  const nomenclaturePath = getLocalFilePath('nomenclature')
  const dutiesPath = getLocalFilePath('duties')
  
  let version = new Date().toISOString().split('T')[0].replace(/-/g, '')
  
  // 使用最新文件的修改时间作为版本号
  const files = [nomenclaturePath, dutiesPath].filter(f => f)
  if (files.length > 0) {
    let latestTime = 0
    for (const file of files) {
      const stat = fs.statSync(file)
      if (stat.mtime.getTime() > latestTime) {
        latestTime = stat.mtime.getTime()
        version = stat.mtime.toISOString().split('T')[0].replace(/-/g, '')
      }
    }
  }
  
  return version
}

// ==================== 辅助函数 ====================

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ==================== 导出 ====================

export default {
  downloadFile,
  checkLocalFiles,
  getLocalFilePath,
  saveUploadedFile,
  readLocalFile,
  getTaricVersion,
  DATA_DIR,
  DATA_SOURCES
}
