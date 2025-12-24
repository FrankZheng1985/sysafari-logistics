#!/usr/bin/env node
/**
 * 数据库备份脚本
 * 
 * 功能：
 * - 支持完整备份和增量备份
 * - 自动上传到腾讯云 COS
 * - 自动清理过期备份
 * - 备份记录存储到数据库
 * - 支持定时任务调用
 * 
 * 使用方法：
 *   node backup-database.js                    # 执行完整备份
 *   node backup-database.js --type incremental # 执行增量备份
 *   node backup-database.js --cleanup          # 清理过期备份
 *   node backup-database.js --list             # 列出所有备份
 *   node backup-database.js --no-upload        # 备份但不上传到 COS
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 动态导入 COS 工具（避免循环依赖）
let cosUploader = null
async function getCosUploader() {
  if (!cosUploader) {
    try {
      cosUploader = await import('../utils/cosUploader.js')
    } catch (error) {
      console.warn('⚠️ COS 模块加载失败，将跳过云端上传:', error.message)
    }
  }
  return cosUploader
}

// 配置
const config = {
  // 备份目录
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, '../backups'),
  // 备份保留天数
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
  // 最大保留份数
  maxBackups: parseInt(process.env.BACKUP_MAX_COUNT) || 30,
  // 数据库连接
  databaseUrl: process.env.DATABASE_URL_PROD || process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * 解析数据库连接字符串
 */
function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.slice(1),
      user: parsed.username,
      password: parsed.password
    }
  } catch (error) {
    log('❌ 无法解析数据库连接字符串', 'red')
    process.exit(1)
  }
}

/**
 * 获取数据库连接
 */
async function getDbConnection() {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  })
  return pool
}

/**
 * 确保备份目录存在
 */
function ensureBackupDir() {
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true })
    log(`📁 创建备份目录: ${config.backupDir}`, 'blue')
  }
}

/**
 * 生成备份文件名
 */
function generateBackupFileName(type = 'full') {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .split('.')[0]
  return `backup_${type}_${timestamp}.sql`
}

/**
 * 记录备份到数据库
 */
async function recordBackup(pool, backupInfo) {
  try {
    const result = await pool.query(`
      INSERT INTO backup_records (
        backup_name, backup_type, backup_size, backup_path, backup_status,
        started_at, completed_at, error_message, created_by,
        cos_key, is_cloud_synced, file_name, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      backupInfo.backupName,
      backupInfo.backupType,
      backupInfo.backupSize,
      backupInfo.backupPath,
      backupInfo.status,
      backupInfo.startedAt,
      backupInfo.completedAt,
      backupInfo.errorMessage,
      backupInfo.createdBy || 'system',
      backupInfo.cosKey,
      backupInfo.isCloudSynced ? 1 : 0,
      backupInfo.fileName,
      backupInfo.description
    ])
    return result.rows[0]?.id
  } catch (error) {
    console.error('记录备份信息失败:', error.message)
    return null
  }
}

/**
 * 更新备份记录
 */
async function updateBackupRecord(pool, id, updates) {
  try {
    const fields = []
    const values = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
      fields.push(`${dbKey} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }

    values.push(id)
    await pool.query(
      `UPDATE backup_records SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  } catch (error) {
    console.error('更新备份记录失败:', error.message)
  }
}

/**
 * 执行数据库备份
 */
async function performBackup(type = 'full', options = {}) {
  const startTime = Date.now()
  const startedAt = new Date()
  const dbConfig = parseDatabaseUrl(config.databaseUrl)
  const fileName = generateBackupFileName(type)
  const filePath = path.join(config.backupDir, fileName)
  const compressedFileName = `${fileName}.gz`
  const compressedPath = `${filePath}.gz`
  
  const pool = await getDbConnection()
  let backupId = null
  
  log('')
  log('╔════════════════════════════════════════════════════════════╗', 'cyan')
  log('║       📦 PostgreSQL 数据库备份工具 (COS 云存储版)           ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════╝', 'cyan')
  log('')
  log(`⏰ 开始时间: ${startedAt.toLocaleString('zh-CN')}`)
  log(`📝 备份类型: ${type === 'full' ? '完整备份' : '增量备份'}`)
  log(`🗄️  数据库: ${dbConfig.database}`)
  log(`📂 备份路径: ${filePath}`)
  log('')
  
  try {
    // 创建初始备份记录
    backupId = await recordBackup(pool, {
      backupName: `${type}_backup_${startedAt.toISOString().split('T')[0]}`,
      backupType: type,
      backupSize: 0,
      backupPath: compressedPath,
      status: 'running',
      startedAt: startedAt,
      completedAt: null,
      errorMessage: null,
      fileName: compressedFileName,
      description: `${type === 'full' ? '完整' : '增量'}数据库备份`,
      cosKey: null,
      isCloudSynced: false
    })
    
    // 设置 PGPASSWORD 环境变量
    process.env.PGPASSWORD = dbConfig.password
    
    // 构建 pg_dump 命令
    let command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database}`
    
    if (type === 'full') {
      // 完整备份：包含所有数据
      command += ' --format=plain --no-owner --no-acl'
    } else {
      // 增量备份：只备份数据（不含结构）
      command += ' --format=plain --no-owner --no-acl --data-only'
    }
    
    command += ` > "${filePath}"`
    
    log('🔄 正在执行备份...', 'yellow')
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: dbConfig.password },
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer
    })
    
    // 获取文件大小
    const stats = fs.statSync(filePath)
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
    
    log('🗜️  正在压缩备份文件...', 'yellow')
    
    // 压缩备份文件
    await execAsync(`gzip -9 "${filePath}"`)
    
    const compressedStats = fs.statSync(compressedPath)
    const compressedSizeInMB = (compressedStats.size / (1024 * 1024)).toFixed(2)
    
    log('')
    log('✅ 本地备份完成！', 'green')
    log(`   📄 文件名: ${compressedFileName}`)
    log(`   📊 原始大小: ${sizeInMB} MB`)
    log(`   📦 压缩后: ${compressedSizeInMB} MB`)
    log('')
    
    // 上传到 COS（如果配置了且未禁用）
    let cosKey = null
    let isCloudSynced = false
    
    if (!options.noUpload) {
      const cos = await getCosUploader()
      if (cos && cos.isCosConfigured && cos.isCosConfigured()) {
        try {
          log('☁️  正在上传到腾讯云 COS...', 'yellow')
          const uploadResult = await cos.uploadFile(compressedPath)
          cosKey = uploadResult.key
          isCloudSynced = true
          log(`✅ 云端上传成功: ${cosKey}`, 'green')
        } catch (uploadError) {
          log(`⚠️ 云端上传失败: ${uploadError.message}`, 'yellow')
          log('   备份文件已保存到本地', 'yellow')
        }
      } else {
        log('ℹ️  未配置腾讯云 COS，跳过云端上传', 'blue')
      }
    } else {
      log('ℹ️  已禁用云端上传', 'blue')
    }
    
    const completedAt = new Date()
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    // 更新备份记录
    if (backupId) {
      await updateBackupRecord(pool, backupId, {
        backupSize: compressedStats.size,
        backupStatus: 'completed',
        completedAt: completedAt,
        cosKey: cosKey,
        isCloudSynced: isCloudSynced ? 1 : 0
      })
    }
    
    log('')
    log('═'.repeat(60), 'cyan')
    log(`⏱️  总耗时: ${duration} 秒`)
    log(`💾 本地路径: ${compressedPath}`)
    if (cosKey) {
      log(`☁️  云端路径: ${cosKey}`)
    }
    log('═'.repeat(60), 'cyan')
    log('')
    
    // 记录备份信息到日志文件
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      fileName: compressedFileName,
      originalSize: stats.size,
      compressedSize: compressedStats.size,
      duration: parseFloat(duration),
      cosKey,
      isCloudSynced,
      status: 'success'
    }
    
    appendToBackupLog(logEntry)
    
    await pool.end()
    
    return {
      success: true,
      backupId,
      fileName: compressedFileName,
      filePath: compressedPath,
      size: compressedStats.size,
      duration: parseFloat(duration),
      cosKey,
      isCloudSynced
    }
    
  } catch (error) {
    log('')
    log('❌ 备份失败！', 'red')
    log(`   错误信息: ${error.message}`, 'red')
    log('')
    
    // 清理可能存在的不完整文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath)
    }
    
    // 更新备份记录状态
    if (backupId) {
      await updateBackupRecord(pool, backupId, {
        backupStatus: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
      })
    }
    
    appendToBackupLog({
      timestamp: new Date().toISOString(),
      type,
      status: 'failed',
      error: error.message
    })
    
    await pool.end()
    
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 清理过期备份
 */
async function cleanupOldBackups() {
  log('')
  log('🧹 开始清理过期备份...', 'yellow')
  
  const pool = await getDbConnection()
  const cos = await getCosUploader()
  
  // 本地文件清理
  const files = fs.readdirSync(config.backupDir)
    .filter(f => f.startsWith('backup_') && f.endsWith('.gz'))
    .map(f => ({
      name: f,
      path: path.join(config.backupDir, f),
      mtime: fs.statSync(path.join(config.backupDir, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime) // 按修改时间倒序
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays)
  
  let deletedCount = 0
  let deletedSize = 0
  const deletedCosKeys = []
  
  // 删除超过保留天数的备份
  for (const file of files) {
    if (file.mtime < cutoffDate) {
      const stats = fs.statSync(file.path)
      fs.unlinkSync(file.path)
      deletedCount++
      deletedSize += stats.size
      log(`   🗑️  删除本地: ${file.name}`, 'yellow')
      
      // 查找对应的 COS 文件
      try {
        const record = await pool.query(
          'SELECT cos_key FROM backup_records WHERE file_name = $1 AND cos_key IS NOT NULL',
          [file.name]
        )
        if (record.rows[0]?.cos_key) {
          deletedCosKeys.push(record.rows[0].cos_key)
        }
      } catch (e) {
        // 忽略查询错误
      }
    }
  }
  
  // 如果备份数量超过最大值，删除最老的
  const remainingFiles = files.filter(f => fs.existsSync(f.path))
  if (remainingFiles.length > config.maxBackups) {
    const toDelete = remainingFiles.slice(config.maxBackups)
    for (const file of toDelete) {
      if (fs.existsSync(file.path)) {
        const stats = fs.statSync(file.path)
        fs.unlinkSync(file.path)
        deletedCount++
        deletedSize += stats.size
        log(`   🗑️  删除（超出数量限制）: ${file.name}`, 'yellow')
        
        // 查找对应的 COS 文件
        try {
          const record = await pool.query(
            'SELECT cos_key FROM backup_records WHERE file_name = $1 AND cos_key IS NOT NULL',
            [file.name]
          )
          if (record.rows[0]?.cos_key) {
            deletedCosKeys.push(record.rows[0].cos_key)
          }
        } catch (e) {
          // 忽略查询错误
        }
      }
    }
  }
  
  // 删除 COS 上的文件
  if (deletedCosKeys.length > 0 && cos && cos.isCosConfigured && cos.isCosConfigured()) {
    try {
      log(`   ☁️  删除云端文件 ${deletedCosKeys.length} 个...`, 'yellow')
      await cos.deleteFiles(deletedCosKeys)
    } catch (e) {
      log(`   ⚠️ 云端文件删除失败: ${e.message}`, 'yellow')
    }
  }
  
  // 更新数据库记录
  try {
    await pool.query(
      `DELETE FROM backup_records WHERE created_at < $1`,
      [cutoffDate]
    )
  } catch (e) {
    // 忽略删除错误
  }
  
  await pool.end()
  
  if (deletedCount > 0) {
    const freedMB = (deletedSize / (1024 * 1024)).toFixed(2)
    log('')
    log(`✅ 清理完成：删除 ${deletedCount} 个文件，释放 ${freedMB} MB 空间`, 'green')
  } else {
    log('   没有需要清理的备份文件', 'blue')
  }
  log('')
}

/**
 * 列出所有备份
 */
async function listBackups() {
  log('')
  log('📋 备份文件列表', 'blue')
  log('═'.repeat(80))
  
  const pool = await getDbConnection()
  
  try {
    // 从数据库获取备份记录
    const result = await pool.query(`
      SELECT id, backup_name, backup_type, backup_size, backup_status,
             cos_key, is_cloud_synced, file_name, created_at
      FROM backup_records
      ORDER BY created_at DESC
      LIMIT 50
    `)
    
    if (result.rows.length === 0) {
      log('   暂无备份记录', 'yellow')
    } else {
      log('')
      log('ID   | 文件名                              | 大小      | 状态     | 云同步 | 时间', 'blue')
      log('-'.repeat(100))
      
      for (const record of result.rows) {
        const sizeMB = record.backup_size ? (record.backup_size / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'
        const date = new Date(record.created_at).toLocaleString('zh-CN')
        const cloudStatus = record.is_cloud_synced ? '✓' : '✗'
        const status = record.backup_status === 'completed' ? '完成' : 
                      record.backup_status === 'running' ? '进行中' : '失败'
        
        log(`${String(record.id).padEnd(4)} | ${(record.file_name || record.backup_name).padEnd(35)} | ${sizeMB.padEnd(9)} | ${status.padEnd(8)} | ${cloudStatus.padEnd(6)} | ${date}`)
      }
      
      log('-'.repeat(100))
      
      const totalSize = result.rows.reduce((sum, r) => sum + (r.backup_size || 0), 0)
      const cloudCount = result.rows.filter(r => r.is_cloud_synced).length
      log(`共 ${result.rows.length} 条记录，总计 ${(totalSize / (1024 * 1024)).toFixed(2)} MB，${cloudCount} 个已同步到云端`)
    }
  } catch (error) {
    log(`   获取备份记录失败: ${error.message}`, 'red')
    
    // 降级：显示本地文件
    log('')
    log('   本地文件列表:', 'yellow')
    const files = fs.readdirSync(config.backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.gz'))
      .map(f => {
        const stats = fs.statSync(path.join(config.backupDir, f))
        return {
          name: f,
          size: stats.size,
          mtime: stats.mtime
        }
      })
      .sort((a, b) => b.mtime - a.mtime)
    
    if (files.length === 0) {
      log('   暂无本地备份文件', 'yellow')
    } else {
      for (const file of files) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
        const date = file.mtime.toLocaleString('zh-CN')
        log(`   ${file.name}  |  ${sizeMB} MB  |  ${date}`)
      }
    }
  }
  
  await pool.end()
  log('')
}

/**
 * 追加备份日志
 */
function appendToBackupLog(entry) {
  const logFile = path.join(config.backupDir, 'backup.log')
  const logLine = JSON.stringify(entry) + '\n'
  fs.appendFileSync(logFile, logLine)
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  
  // 检查数据库连接配置
  if (!config.databaseUrl) {
    log('❌ 错误：未配置数据库连接字符串', 'red')
    log('   请设置 DATABASE_URL_PROD 或 DATABASE_URL 环境变量', 'yellow')
    process.exit(1)
  }
  
  // 确保备份目录存在
  ensureBackupDir()
  
  // 解析命令行参数
  if (args.includes('--list')) {
    await listBackups()
  } else if (args.includes('--cleanup')) {
    await cleanupOldBackups()
  } else {
    const type = args.includes('--type') 
      ? args[args.indexOf('--type') + 1] || 'full'
      : 'full'
    
    const noUpload = args.includes('--no-upload')
    
    const result = await performBackup(type, { noUpload })
    
    if (result.success) {
      // 备份成功后自动清理
      await cleanupOldBackups()
    }
    
    process.exit(result.success ? 0 : 1)
  }
}

// 导出函数供其他模块调用
export { performBackup, cleanupOldBackups, listBackups }

// 运行
main().catch(error => {
  log(`❌ 执行错误: ${error.message}`, 'red')
  process.exit(1)
})
