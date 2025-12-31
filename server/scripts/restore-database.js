#!/usr/bin/env node
/**
 * 数据库恢复脚本
 * 
 * 功能：
 * - 从本地或腾讯云 COS 恢复数据库
 * - 支持完整恢复和部分恢复
 * - 记录恢复日志
 * - 恢复前自动备份
 * 
 * 使用方法：
 *   node restore-database.js --id <backup_id>     # 从备份记录 ID 恢复
 *   node restore-database.js --file <file_path>  # 从本地文件恢复
 *   node restore-database.js --list              # 列出可恢复的备份
 *   node restore-database.js --no-backup         # 恢复前不创建备份
 * 
 * 警告：恢复操作会覆盖现有数据，请谨慎使用！
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'
import readline from 'readline'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 动态导入模块
let cosUploader = null
async function getCosUploader() {
  if (!cosUploader) {
    try {
      cosUploader = await import('../utils/cosUploader.js')
    } catch (error) {
      console.warn('⚠️ COS 模块加载失败:', error.message)
    }
  }
  return cosUploader
}

// 配置
const config = {
  // 临时目录
  tempDir: process.env.BACKUP_DIR || path.join(__dirname, '../backups'),
  // 数据库连接（恢复到生产环境）
  databaseUrl: process.env.DATABASE_URL_PROD || process.env.DATABASE_URL || process.env.DATABASE_URL_TEST
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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
 * 用户确认
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${message} (yes/no): ${colors.reset}`, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

/**
 * 获取备份记录
 */
async function getBackupRecord(pool, backupId) {
  const result = await pool.query(
    `SELECT * FROM backup_records WHERE id = $1`,
    [backupId]
  )
  return result.rows[0]
}

/**
 * 列出可恢复的备份
 */
async function listAvailableBackups() {
  const pool = await getDbConnection()
  
  log('')
  log('📋 可恢复的备份列表', 'blue')
  log('═'.repeat(90))
  
  try {
    const result = await pool.query(`
      SELECT id, backup_name, backup_type, backup_size, backup_status,
             backup_path, cos_key, is_cloud_synced, file_name, 
             restore_count, restored_at, created_at
      FROM backup_records
      WHERE backup_status = 'completed'
      ORDER BY created_at DESC
      LIMIT 30
    `)
    
    if (result.rows.length === 0) {
      log('   暂无可恢复的备份', 'yellow')
    } else {
      log('')
      log('ID   | 类型   | 文件名                              | 大小      | 来源   | 恢复次数 | 创建时间', 'blue')
      log('-'.repeat(110))
      
      for (const record of result.rows) {
        const sizeMB = record.backup_size ? (record.backup_size / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'
        const date = new Date(record.created_at).toLocaleString('zh-CN')
        const source = record.is_cloud_synced ? '云端' : '本地'
        const type = record.backup_type === 'full' ? '完整' : '增量'
        
        log(`${String(record.id).padEnd(4)} | ${type.padEnd(6)} | ${(record.file_name || record.backup_name).substring(0, 35).padEnd(35)} | ${sizeMB.padEnd(9)} | ${source.padEnd(6)} | ${String(record.restore_count || 0).padEnd(8)} | ${date}`)
      }
      
      log('-'.repeat(110))
      log('')
      log('使用方法: node restore-database.js --id <ID> 来恢复指定备份', 'cyan')
    }
  } catch (error) {
    log(`   获取备份列表失败: ${error.message}`, 'red')
  }
  
  await pool.end()
  log('')
}

/**
 * 记录恢复操作
 */
async function recordRestore(pool, restoreInfo) {
  try {
    const result = await pool.query(`
      INSERT INTO restore_records (
        backup_id, backup_name, restore_type, restore_status,
        started_at, completed_at, error_message, restored_by, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      restoreInfo.backupId,
      restoreInfo.backupName,
      restoreInfo.restoreType || 'full',
      restoreInfo.status,
      restoreInfo.startedAt,
      restoreInfo.completedAt,
      restoreInfo.errorMessage,
      restoreInfo.restoredBy || 'system',
      restoreInfo.ipAddress || 'localhost'
    ])
    return result.rows[0]?.id
  } catch (error) {
    console.error('记录恢复信息失败:', error.message)
    return null
  }
}

/**
 * 更新恢复记录
 */
async function updateRestoreRecord(pool, id, updates) {
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
      `UPDATE restore_records SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  } catch (error) {
    console.error('更新恢复记录失败:', error.message)
  }
}

/**
 * 更新备份记录的恢复信息
 */
async function updateBackupRestoreInfo(pool, backupId) {
  try {
    await pool.query(`
      UPDATE backup_records 
      SET restored_at = NOW(), 
          restore_count = COALESCE(restore_count, 0) + 1
      WHERE id = $1
    `, [backupId])
  } catch (error) {
    console.error('更新备份恢复信息失败:', error.message)
  }
}

/**
 * 从 COS 下载备份文件
 */
async function downloadFromCos(cosKey, localPath) {
  const cos = await getCosUploader()
  if (!cos || !cos.isCosConfigured || !cos.isCosConfigured()) {
    throw new Error('COS 未配置，无法从云端下载')
  }
  
  log('☁️  从腾讯云 COS 下载备份文件...', 'yellow')
  await cos.downloadFile(cosKey, localPath)
  log('✅ 下载完成', 'green')
}

/**
 * 执行数据库恢复
 */
async function performRestore(options = {}) {
  const startTime = Date.now()
  const startedAt = new Date()
  const dbConfig = parseDatabaseUrl(config.databaseUrl)
  
  const pool = await getDbConnection()
  let restoreId = null
  let backupRecord = null
  let localFilePath = null
  let needCleanup = false
  
  log('')
  log('╔════════════════════════════════════════════════════════════╗', 'magenta')
  log('║       🔄 PostgreSQL 数据库恢复工具                          ║', 'magenta')
  log('╚════════════════════════════════════════════════════════════╝', 'magenta')
  log('')
  
  try {
    // 获取备份信息
    if (options.backupId) {
      backupRecord = await getBackupRecord(pool, options.backupId)
      if (!backupRecord) {
        throw new Error(`找不到 ID 为 ${options.backupId} 的备份记录`)
      }
      
      log(`📝 备份记录: #${backupRecord.id} - ${backupRecord.backup_name}`)
      log(`📅 创建时间: ${new Date(backupRecord.created_at).toLocaleString('zh-CN')}`)
      log(`📊 备份大小: ${(backupRecord.backup_size / (1024 * 1024)).toFixed(2)} MB`)
      log(`🗄️  目标数据库: ${dbConfig.database}`)
      log('')
      
      // 确定文件来源
      if (backupRecord.is_cloud_synced && backupRecord.cos_key) {
        // 从 COS 下载
        localFilePath = path.join(config.tempDir, `restore_${Date.now()}_${backupRecord.file_name}`)
        await downloadFromCos(backupRecord.cos_key, localFilePath)
        needCleanup = true
      } else if (backupRecord.backup_path && fs.existsSync(backupRecord.backup_path)) {
        // 使用本地文件
        localFilePath = backupRecord.backup_path
      } else {
        throw new Error('备份文件不存在（本地和云端均无法访问）')
      }
    } else if (options.filePath) {
      // 直接使用指定文件
      if (!fs.existsSync(options.filePath)) {
        throw new Error(`文件不存在: ${options.filePath}`)
      }
      localFilePath = options.filePath
      log(`📁 使用本地文件: ${localFilePath}`)
      log(`🗄️  目标数据库: ${dbConfig.database}`)
      log('')
    } else {
      throw new Error('请指定 --id 或 --file 参数')
    }
    
    // 安全确认
    log('⚠️  警告：恢复操作将覆盖现有数据！', 'red')
    log('')
    
    if (!options.force) {
      const confirmed = await confirm('确定要继续恢复操作吗？')
      if (!confirmed) {
        log('')
        log('已取消恢复操作', 'yellow')
        await pool.end()
        return { success: false, cancelled: true }
      }
    }
    
    log('')
    
    // 恢复前备份（可选）
    if (!options.noBackup) {
      log('💾 恢复前创建当前数据库备份...', 'yellow')
      try {
        const { performBackup } = await import('./backup-database.js')
        await performBackup('full', { noUpload: true })
        log('✅ 恢复前备份完成', 'green')
      } catch (backupError) {
        log(`⚠️ 恢复前备份失败: ${backupError.message}`, 'yellow')
        log('   继续执行恢复操作...', 'yellow')
      }
      log('')
    }
    
    // 创建恢复记录
    restoreId = await recordRestore(pool, {
      backupId: backupRecord?.id || null,
      backupName: backupRecord?.backup_name || path.basename(localFilePath),
      restoreType: 'full',
      status: 'running',
      startedAt: startedAt,
      completedAt: null,
      errorMessage: null,
      restoredBy: options.restoredBy || 'system',
      ipAddress: options.ipAddress || 'localhost'
    })
    
    // 解压文件（如果是 .gz）
    let sqlFilePath = localFilePath
    if (localFilePath.endsWith('.gz')) {
      log('🗜️  解压备份文件...', 'yellow')
      sqlFilePath = localFilePath.replace('.gz', '')
      await execAsync(`gunzip -k -f "${localFilePath}"`)
      if (needCleanup) {
        // 标记 SQL 文件也需要清理
      }
      log('✅ 解压完成', 'green')
    }
    
    // 执行恢复
    log('🔄 正在恢复数据库...', 'yellow')
    
    process.env.PGPASSWORD = dbConfig.password
    
    const command = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${sqlFilePath}"`
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: dbConfig.password },
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer
    })
    
    const completedAt = new Date()
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    // 更新恢复记录
    if (restoreId) {
      await updateRestoreRecord(pool, restoreId, {
        restoreStatus: 'completed',
        completedAt: completedAt
      })
    }
    
    // 更新备份记录的恢复信息
    if (backupRecord?.id) {
      await updateBackupRestoreInfo(pool, backupRecord.id)
    }
    
    log('')
    log('═'.repeat(60), 'green')
    log('✅ 数据库恢复成功！', 'green')
    log(`⏱️  总耗时: ${duration} 秒`)
    log('═'.repeat(60), 'green')
    log('')
    
    // 清理临时文件
    if (needCleanup) {
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath)
        }
        if (sqlFilePath !== localFilePath && fs.existsSync(sqlFilePath)) {
          fs.unlinkSync(sqlFilePath)
        }
      } catch (e) {
        // 忽略清理错误
      }
    } else if (sqlFilePath !== localFilePath && fs.existsSync(sqlFilePath)) {
      // 只清理解压后的 SQL 文件
      try {
        fs.unlinkSync(sqlFilePath)
      } catch (e) {
        // 忽略
      }
    }
    
    await pool.end()
    
    return {
      success: true,
      restoreId,
      duration: parseFloat(duration)
    }
    
  } catch (error) {
    log('')
    log('❌ 恢复失败！', 'red')
    log(`   错误信息: ${error.message}`, 'red')
    log('')
    
    // 更新恢复记录
    if (restoreId) {
      await updateRestoreRecord(pool, restoreId, {
        restoreStatus: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
      })
    }
    
    // 清理临时文件
    if (needCleanup && localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath)
      } catch (e) {
        // 忽略
      }
    }
    
    await pool.end()
    
    return {
      success: false,
      error: error.message
    }
  }
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
  
  // 确保临时目录存在
  if (!fs.existsSync(config.tempDir)) {
    fs.mkdirSync(config.tempDir, { recursive: true })
  }
  
  // 解析命令行参数
  if (args.includes('--list')) {
    await listAvailableBackups()
  } else if (args.includes('--id') || args.includes('--file')) {
    const options = {
      backupId: args.includes('--id') ? args[args.indexOf('--id') + 1] : null,
      filePath: args.includes('--file') ? args[args.indexOf('--file') + 1] : null,
      noBackup: args.includes('--no-backup'),
      force: args.includes('--force') || args.includes('-f')
    }
    
    const result = await performRestore(options)
    process.exit(result.success ? 0 : 1)
  } else {
    log('')
    log('📖 数据库恢复工具使用说明', 'blue')
    log('═'.repeat(60))
    log('')
    log('用法:', 'cyan')
    log('  node restore-database.js --list                列出可恢复的备份')
    log('  node restore-database.js --id <backup_id>      从备份记录恢复')
    log('  node restore-database.js --file <file_path>    从本地文件恢复')
    log('')
    log('选项:', 'cyan')
    log('  --no-backup    恢复前不创建当前数据库备份')
    log('  --force, -f    跳过确认提示，直接执行恢复')
    log('')
    log('示例:', 'cyan')
    log('  node restore-database.js --id 5')
    log('  node restore-database.js --file ./backups/backup_full_20231224.sql.gz')
    log('  node restore-database.js --id 5 --no-backup --force')
    log('')
  }
}

// 导出函数供其他模块调用
export { performRestore, listAvailableBackups, getBackupRecord }

// 运行
main().catch(error => {
  log(`❌ 执行错误: ${error.message}`, 'red')
  process.exit(1)
})

