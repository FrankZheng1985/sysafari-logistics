/**
 * 数据库备份定时任务调度器
 * 
 * 功能：
 * - 定时自动备份数据库
 * - 自动清理过期备份
 * - 支持配置备份频率
 */

import cron from 'node-cron'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDatabase } from '../config/database.js'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 备份脚本路径
const backupScriptPath = path.join(__dirname, '../scripts/backup-database.js')

/**
 * 获取备份设置
 */
async function getBackupSettings() {
  try {
    const db = getDatabase()
    const settings = await db.prepare(`
      SELECT setting_key, setting_value FROM security_settings 
      WHERE setting_key LIKE 'backup_%'
    `).all()
    
    const result = {}
    for (const s of settings) {
      result[s.setting_key] = s.setting_value
    }
    
    return {
      enabled: result.backup_enabled !== 'false',
      frequency: result.backup_frequency || 'daily',
      time: result.backup_time || '03:00',
      retentionCount: parseInt(result.backup_retention_count) || 30
    }
  } catch (error) {
    console.error('获取备份设置失败:', error.message)
    return {
      enabled: true,
      frequency: 'daily',
      time: '03:00',
      retentionCount: 30
    }
  }
}

/**
 * 执行备份
 * 备份脚本会自动记录备份信息到数据库，包括 COS 上传状态
 */
async function executeBackup(type = 'full') {
  console.log(`🔄 [${new Date().toLocaleString('zh-CN')}] 开始执行${type === 'full' ? '完整' : '增量'}备份...`)
  
  try {
    const { stdout, stderr } = await execAsync(`node "${backupScriptPath}" --type ${type}`, {
      timeout: 600000, // 10分钟超时（大数据库可能需要更长时间）
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    })
    
    if (stdout) console.log(stdout)
    if (stderr && !stderr.includes('warning')) console.error(stderr)
    
    // 备份脚本已经记录到数据库，这里不需要重复记录
    console.log(`✅ [${new Date().toLocaleString('zh-CN')}] 备份任务完成`)
    
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleString('zh-CN')}] 备份失败:`, error.message)
    // 备份脚本内部会处理失败记录
  }
}

/**
 * 生成 cron 表达式
 */
function getCronExpression(frequency, time) {
  const [hour, minute] = time.split(':').map(Number)
  
  switch (frequency) {
    case 'hourly':
      return `${minute} * * * *`
    case 'daily':
      return `${minute} ${hour} * * *`
    case 'weekly':
      return `${minute} ${hour} * * 0` // 每周日
    case 'monthly':
      return `${minute} ${hour} 1 * *` // 每月1日
    default:
      return `${minute} ${hour} * * *` // 默认每天
  }
}

// 当前运行的任务
let currentTask = null

/**
 * 启动备份调度器
 */
export async function startBackupScheduler() {
  const settings = await getBackupSettings()
  
  if (!settings.enabled) {
    console.log('📦 自动备份已禁用')
    return
  }
  
  const cronExpression = getCronExpression(settings.frequency, settings.time)
  
  console.log('📦 启动数据库备份调度器')
  console.log(`   频率: ${settings.frequency}`)
  console.log(`   时间: ${settings.time}`)
  console.log(`   Cron: ${cronExpression}`)
  console.log(`   保留份数: ${settings.retentionCount}`)
  
  // 停止之前的任务
  if (currentTask) {
    currentTask.stop()
  }
  
  // 启动新任务
  currentTask = cron.schedule(cronExpression, async () => {
    await executeBackup('full')
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  })
}

/**
 * 停止备份调度器
 */
export function stopBackupScheduler() {
  if (currentTask) {
    currentTask.stop()
    currentTask = null
    console.log('📦 数据库备份调度器已停止')
  }
}

/**
 * 手动触发备份
 */
export async function triggerBackup(type = 'full') {
  await executeBackup(type)
}

/**
 * 获取备份历史
 */
export async function getBackupHistory(limit = 20) {
  try {
    const db = getDatabase()
    const records = await db.prepare(`
      SELECT * FROM backup_records 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit)
    
    return records
  } catch (error) {
    console.error('获取备份历史失败:', error.message)
    return []
  }
}

export default {
  startBackupScheduler,
  stopBackupScheduler,
  triggerBackup,
  getBackupHistory
}
