#!/usr/bin/env node
/**
 * 数据库备份脚本
 * 
 * 功能：
 * - 支持完整备份和增量备份
 * - 自动清理过期备份
 * - 备份记录存储到数据库
 * - 支持定时任务调用
 * 
 * 使用方法：
 *   node backup-database.js                    # 执行完整备份
 *   node backup-database.js --type incremental # 执行增量备份
 *   node backup-database.js --cleanup          # 清理过期备份
 *   node backup-database.js --list             # 列出所有备份
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 配置
const config = {
  // 备份目录
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, '../backups'),
  // 备份保留天数
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
  // 最大保留份数
  maxBackups: parseInt(process.env.BACKUP_MAX_COUNT) || 30,
  // 数据库连接
  databaseUrl: process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
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
 * 执行数据库备份
 */
async function performBackup(type = 'full') {
  const startTime = Date.now()
  const dbConfig = parseDatabaseUrl(config.databaseUrl)
  const fileName = generateBackupFileName(type)
  const filePath = path.join(config.backupDir, fileName)
  
  log('')
  log('╔════════════════════════════════════════════════╗', 'blue')
  log('║       📦 PostgreSQL 数据库备份工具              ║', 'blue')
  log('╚════════════════════════════════════════════════╝', 'blue')
  log('')
  log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}`)
  log(`📝 备份类型: ${type === 'full' ? '完整备份' : '增量备份'}`)
  log(`🗄️  数据库: ${dbConfig.database}`)
  log(`📂 备份路径: ${filePath}`)
  log('')
  
  try {
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
      env: { ...process.env, PGPASSWORD: dbConfig.password }
    })
    
    // 获取文件大小
    const stats = fs.statSync(filePath)
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
    
    // 压缩备份文件
    const compressedPath = `${filePath}.gz`
    await execAsync(`gzip -9 "${filePath}"`)
    
    const compressedStats = fs.statSync(compressedPath)
    const compressedSizeInMB = (compressedStats.size / (1024 * 1024)).toFixed(2)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    log('')
    log('✅ 备份完成！', 'green')
    log(`   📄 文件名: ${fileName}.gz`)
    log(`   📊 原始大小: ${sizeInMB} MB`)
    log(`   📦 压缩后: ${compressedSizeInMB} MB`)
    log(`   ⏱️  耗时: ${duration} 秒`)
    log('')
    
    // 记录备份信息（可选：写入日志文件）
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      fileName: `${fileName}.gz`,
      originalSize: stats.size,
      compressedSize: compressedStats.size,
      duration: parseFloat(duration),
      status: 'success'
    }
    
    appendToBackupLog(logEntry)
    
    return {
      success: true,
      fileName: `${fileName}.gz`,
      size: compressedStats.size,
      duration: parseFloat(duration)
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
    
    appendToBackupLog({
      timestamp: new Date().toISOString(),
      type,
      status: 'failed',
      error: error.message
    })
    
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
  
  // 删除超过保留天数的备份
  for (const file of files) {
    if (file.mtime < cutoffDate) {
      const stats = fs.statSync(file.path)
      fs.unlinkSync(file.path)
      deletedCount++
      deletedSize += stats.size
      log(`   🗑️  删除: ${file.name}`, 'yellow')
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
      }
    }
  }
  
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
function listBackups() {
  log('')
  log('📋 备份文件列表', 'blue')
  log('═'.repeat(70))
  
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
    log('   暂无备份文件', 'yellow')
  } else {
    for (const file of files) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      const date = file.mtime.toLocaleString('zh-CN')
      log(`   ${file.name}  |  ${sizeMB} MB  |  ${date}`)
    }
    
    log('═'.repeat(70))
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    log(`   共 ${files.length} 个备份，总计 ${(totalSize / (1024 * 1024)).toFixed(2)} MB`)
  }
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
    log('   请设置 DATABASE_URL 或 DATABASE_URL_TEST 环境变量', 'yellow')
    process.exit(1)
  }
  
  // 确保备份目录存在
  ensureBackupDir()
  
  // 解析命令行参数
  if (args.includes('--list')) {
    listBackups()
  } else if (args.includes('--cleanup')) {
    await cleanupOldBackups()
  } else {
    const type = args.includes('--type') 
      ? args[args.indexOf('--type') + 1] || 'full'
      : 'full'
    
    const result = await performBackup(type)
    
    if (result.success) {
      // 备份成功后自动清理
      await cleanupOldBackups()
    }
    
    process.exit(result.success ? 0 : 1)
  }
}

// 运行
main().catch(error => {
  log(`❌ 执行错误: ${error.message}`, 'red')
  process.exit(1)
})
