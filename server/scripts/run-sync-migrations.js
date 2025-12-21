/**
 * 执行综合数据库迁移脚本
 * 将新功能模块的表结构同步到指定环境
 * 
 * 使用方法：
 *   同步到生产环境: node run-sync-migrations.js --env=prod
 *   同步到演示环境: node run-sync-migrations.js --env=demo
 *   同步到本地环境: node run-sync-migrations.js --env=local
 *   只检查不执行: node run-sync-migrations.js --env=prod --dry-run
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 解析命令行参数
const args = process.argv.slice(2)
const envArg = args.find(a => a.startsWith('--env='))?.split('=')[1] || 'local'
const isDryRun = args.includes('--dry-run')

// 数据库连接配置
const DB_CONFIGS = {
  local: process.env.DATABASE_URL,
  prod: process.env.DATABASE_URL_PROD || process.env.PROD_DATABASE_URL,
  demo: process.env.DATABASE_URL_TEST || process.env.DEMO_DATABASE_URL
}

// 订单相关表（不会被修改）
const ORDER_TABLES = [
  'bills_of_lading', 'packages', 'declarations', 'labels',
  'fees', 'invoices', 'payments', 'clearance_documents',
  'operation_logs', 'bill_files'
]

/**
 * 用户确认
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * 获取数据库中现有的表
 */
async function getExistingTables(pool) {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  return result.rows.map(r => r.table_name)
}

/**
 * 主函数
 */
async function main() {
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('        数据库迁移同步工具 v1.0')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  
  // 获取数据库连接
  const dbUrl = DB_CONFIGS[envArg]
  
  if (!dbUrl) {
    console.error(`❌ 错误: 未配置 ${envArg} 环境的数据库连接`)
    console.log('')
    console.log('请在 .env 文件中配置以下环境变量:')
    console.log('  - DATABASE_URL (本地)')
    console.log('  - DATABASE_URL_PROD (生产)')
    console.log('  - DATABASE_URL_TEST (演示)')
    process.exit(1)
  }
  
  const envNames = { local: '本地', prod: '生产', demo: '演示' }
  console.log(`🎯 目标环境: ${envNames[envArg]}`)
  console.log(`📋 模式: ${isDryRun ? '仅检查（不执行）' : '执行迁移'}`)
  console.log('')
  
  // 连接数据库
  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  })
  
  try {
    // 测试连接
    console.log('🔌 连接数据库...')
    await pool.query('SELECT 1')
    console.log('  ✅ 连接成功')
    console.log('')
    
    // 获取现有表
    const existingTables = await getExistingTables(pool)
    console.log(`📊 现有表数量: ${existingTables.length}`)
    
    // 需要创建的新表
    const newTables = [
      'last_mile_carriers', 'last_mile_zones', 'unified_rate_cards',
      'rate_card_tiers', 'rate_card_surcharges', 'last_mile_shipments',
      'last_mile_tracking', 'carrier_settlements', 'carrier_settlement_items',
      'rate_import_templates', 'rate_import_logs',
      'commission_rules', 'commission_tiers', 'commission_records', 'commission_settlements',
      'login_attempts', 'security_audit_logs', 'ip_blacklist', 'api_rate_limits',
      'password_history', 'active_sessions', 'backup_records',
      'penalty_rules', 'penalty_records',
      'hs_match_records', 'hs_declaration_history',
      'approval_requests', 'approval_workflows', 'approval_records',
      'contract_templates', 'contract_signatures'
    ]
    
    const missingTables = newTables.filter(t => !existingTables.includes(t))
    const existingNewTables = newTables.filter(t => existingTables.includes(t))
    
    console.log('')
    console.log('📋 迁移分析:')
    console.log(`  - 需要创建的新表: ${missingTables.length} 张`)
    console.log(`  - 已存在的表: ${existingNewTables.length} 张`)
    console.log('')
    
    if (missingTables.length > 0) {
      console.log('  缺失的表:')
      missingTables.forEach(t => console.log(`    - ${t}`))
      console.log('')
    }
    
    if (isDryRun) {
    console.log('═══════════════════════════════════════════════════════')
    console.log('ℹ️  仅检查模式，未执行任何修改')
    console.log('═══════════════════════════════════════════════════════')
    return
  }
    
    // 确认执行
    if (envArg !== 'local') {
      console.log(`⚠️  警告: 即将修改 ${envNames[envArg]} 环境的数据库！`)
      console.log('   订单相关表不会被修改。')
      const confirmed = await confirm('确认继续?')
      
      if (!confirmed) {
        console.log('\n❌ 操作已取消')
        return
      }
    }
    
    // 读取迁移脚本
    const sqlFile = path.join(__dirname, 'sync-all-migrations.sql')
    if (!fs.existsSync(sqlFile)) {
      console.error('❌ 找不到迁移脚本: sync-all-migrations.sql')
      process.exit(1)
    }
    
    const sql = fs.readFileSync(sqlFile, 'utf-8')
    
    console.log('')
    console.log('🔄 执行迁移...')
    console.log('')
    
    // 执行迁移
    const startTime = Date.now()
    await pool.query(sql)
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    // 验证结果
    console.log('')
    console.log('📊 验证迁移结果...')
    const newExistingTables = await getExistingTables(pool)
    const createdTables = newTables.filter(t => newExistingTables.includes(t) && !existingTables.includes(t))
    
    console.log(`  新创建的表: ${createdTables.length} 张`)
    if (createdTables.length > 0) {
      createdTables.forEach(t => console.log(`    ✅ ${t}`))
    }
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`✅ 迁移完成！耗时 ${duration}s`)
    console.log('═══════════════════════════════════════════════════════')
    
  } catch (err) {
    console.error('❌ 迁移失败:', err.message)
    if (err.position) {
      console.error('   错误位置:', err.position)
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
