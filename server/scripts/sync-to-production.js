/**
 * 同步基础数据到生产环境
 * 
 * 使用方法：
 * 1. 设置环境变量: export PRODUCTION_DATABASE_URL="postgresql://..."
 * 2. 运行: node scripts/sync-to-production.js [--base-only | --hs-only | --all]
 * 
 * 参数说明：
 * --base-only: 只同步基础数据（国家、城市、港口等）
 * --hs-only:   只同步HS税率数据
 * --all:       同步全部数据（默认）
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 生产数据库连接
const PROD_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL

if (!PROD_DATABASE_URL) {
  console.error('❌ 请设置环境变量 PRODUCTION_DATABASE_URL')
  console.log('\n示例:')
  console.log('  export PRODUCTION_DATABASE_URL="postgresql://user:password@host:port/database"')
  console.log('  node scripts/sync-to-production.js')
  process.exit(1)
}

// 解析命令行参数
const args = process.argv.slice(2)
const syncBaseOnly = args.includes('--base-only')
const syncHsOnly = args.includes('--hs-only')
const syncAll = args.includes('--all') || (!syncBaseOnly && !syncHsOnly)

// 导出文件目录
const EXPORTS_DIR = path.join(__dirname, '../exports')

// 基础数据文件（按依赖顺序）
const BASE_DATA_FILES = [
  'countries_data.sql',
  'cities_data.sql',
  'ports_of_loading_data.sql',
  'destination_ports_data.sql',
  'air_ports_data.sql',
  'shipping_companies_data.sql',
  'vat_rates_data.sql',
  'products_data.sql',
  'product_fee_items_data.sql'
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
 * 执行SQL文件
 */
async function executeSqlFile(pool, filePath, fileName) {
  const startTime = Date.now()
  
  try {
    const sql = fs.readFileSync(filePath, 'utf-8')
    
    // 分割为单独的语句执行（处理大文件）
    const statements = sql.split(';\n').filter(s => s.trim())
    
    let successCount = 0
    let errorCount = 0
    
    for (const statement of statements) {
      if (!statement.trim()) continue
      
      try {
        await pool.query(statement)
        successCount++
      } catch (err) {
        errorCount++
        // 忽略重复键错误（ON CONFLICT 处理）
        if (!err.message.includes('duplicate key')) {
          console.error(`    ⚠️ ${err.message.slice(0, 100)}`)
        }
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`  ✅ ${fileName}: ${successCount} 条成功, ${errorCount} 条跳过 (${duration}s)`)
    
    return { success: true, count: successCount }
    
  } catch (err) {
    console.error(`  ❌ ${fileName}: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * 获取HS税率文件列表
 */
function getHsDataFiles() {
  const files = fs.readdirSync(EXPORTS_DIR)
  return files
    .filter(f => f.startsWith('tariff_rates_data_') && f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0])
      const numB = parseInt(b.match(/\d+/)[0])
      return numA - numB
    })
}

/**
 * 验证同步结果
 */
async function verifySync(pool) {
  console.log('\n📊 验证同步结果...')
  
  const tables = [
    'countries',
    'cities', 
    'ports_of_loading',
    'destination_ports',
    'shipping_companies',
    'vat_rates',
    'products',
    'tariff_rates'
  ]
  
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`)
      const count = result.rows[0].count
      console.log(`  ${table}: ${count} 条`)
    } catch (err) {
      console.log(`  ${table}: 查询失败 - ${err.message}`)
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('           同步基础数据到生产环境 v1.0')
  console.log('═══════════════════════════════════════════════════════')
  
  // 连接检查
  console.log('\n🔗 连接到生产数据库...')
  const pool = new pg.Pool({ 
    connectionString: PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    // 测试连接
    await pool.query('SELECT 1')
    console.log('  ✅ 连接成功')
  } catch (err) {
    console.error('  ❌ 连接失败:', err.message)
    process.exit(1)
  }
  
  // 显示待同步数据
  console.log('\n📋 待同步数据:')
  
  if (syncAll || syncBaseOnly) {
    console.log('  基础数据:')
    for (const file of BASE_DATA_FILES) {
      const filePath = path.join(EXPORTS_DIR, file)
      if (fs.existsSync(filePath)) {
        const size = (fs.statSync(filePath).size / 1024).toFixed(1)
        console.log(`    - ${file} (${size} KB)`)
      }
    }
  }
  
  if (syncAll || syncHsOnly) {
    const hsFiles = getHsDataFiles()
    console.log(`  HS税率数据: ${hsFiles.length} 个文件 (~123,000 条)`)
  }
  
  // 用户确认
  console.log('\n⚠️  警告: 此操作将修改生产数据库！')
  const confirmed = await confirm('确认继续?')
  
  if (!confirmed) {
    console.log('\n❌ 操作已取消')
    await pool.end()
    return
  }
  
  const startTime = Date.now()
  let totalSuccess = 0
  
  // 同步基础数据
  if (syncAll || syncBaseOnly) {
    console.log('\n📦 同步基础数据...')
    
    for (const file of BASE_DATA_FILES) {
      const filePath = path.join(EXPORTS_DIR, file)
      
      if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️ 文件不存在: ${file}`)
        continue
      }
      
      const result = await executeSqlFile(pool, filePath, file)
      if (result.success) {
        totalSuccess += result.count
      }
    }
  }
  
  // 同步HS税率数据
  if (syncAll || syncHsOnly) {
    console.log('\n📦 同步HS税率数据...')
    
    const hsFiles = getHsDataFiles()
    
    for (let i = 0; i < hsFiles.length; i++) {
      const file = hsFiles[i]
      const filePath = path.join(EXPORTS_DIR, file)
      
      process.stdout.write(`  [${i + 1}/${hsFiles.length}] `)
      const result = await executeSqlFile(pool, filePath, file)
      if (result.success) {
        totalSuccess += result.count
      }
    }
  }
  
  // 验证结果
  await verifySync(pool)
  
  // 汇总
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`✅ 同步完成！共处理 ${totalSuccess} 条记录，耗时 ${duration}s`)
  console.log('═══════════════════════════════════════════════════════')
  
  await pool.end()
}

main().catch(err => {
  console.error('同步失败:', err)
  process.exit(1)
})
