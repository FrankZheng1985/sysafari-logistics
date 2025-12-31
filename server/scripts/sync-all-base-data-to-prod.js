/**
 * 综合同步脚本 - 同步所有基础数据到生产环境
 * 
 * 使用方法：
 * node scripts/sync-all-base-data-to-prod.js [--table=表名]
 * 
 * 参数：
 * --table=xxx  只同步指定的表
 * --dry-run    只显示差异，不执行同步
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接配置
const DEV_DATABASE_URL = process.env.DATABASE_URL_LOCAL || 'postgresql://fengzheng@localhost:5432/logistics_dev'
const PROD_DATABASE_URL = process.env.DATABASE_URL_PROD

// 解析命令行参数
const args = process.argv.slice(2)
const targetTable = args.find(a => a.startsWith('--table='))?.split('=')[1]
const dryRun = args.includes('--dry-run')

// 需要同步的表配置
const SYNC_TABLES = [
  {
    name: 'service_fee_categories',
    idField: 'id',
    conflictField: 'id',
    description: '服务费类别'
  },
  {
    name: 'service_providers',
    idField: 'id',
    conflictField: 'provider_code',
    description: '服务商'
  },
  {
    name: 'transport_methods',
    idField: 'id',
    conflictField: 'id',
    description: '运输方式'
  },
  {
    name: 'roles',
    idField: 'id',
    conflictField: 'role_code',
    description: '角色'
  },
  {
    name: 'system_settings',
    idField: 'id',
    conflictField: 'setting_key',
    description: '系统设置'
  },
  {
    name: 'alert_rules',
    idField: 'id',
    conflictField: 'id',
    description: '警报规则'
  },
  {
    name: 'products',
    idField: 'id',
    conflictField: 'product_code',
    description: '产品'
  },
  {
    name: 'suppliers',
    idField: 'id',
    conflictField: 'supplier_code',
    description: '供应商'
  },
  {
    name: 'customers',
    idField: 'id',
    conflictField: 'id',
    description: '客户'
  },
  {
    name: 'customer_tax_numbers',
    idField: 'id',
    conflictField: 'id',
    description: '客户税号'
  },
  {
    name: 'shared_tax_numbers',
    idField: 'id',
    conflictField: 'id',
    description: '共享税号'
  },
  {
    name: 'users',
    idField: 'id',
    conflictField: 'id',
    description: '用户'
  },
  {
    name: 'order_sequences',
    idField: 'id',
    conflictField: 'id',
    description: '订单序列'
  }
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
 * 获取表的所有列名
 */
async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 
    ORDER BY ordinal_position
  `, [tableName])
  return result.rows.map(r => r.column_name)
}

/**
 * 同步单个表
 */
async function syncTable(devPool, prodPool, tableConfig) {
  const { name, idField, conflictField, description } = tableConfig
  
  console.log(`\n📦 同步 ${description} (${name})...`)
  
  try {
    // 获取开发环境数据
    const devResult = await devPool.query(`SELECT * FROM ${name}`)
    const devData = devResult.rows
    console.log(`   开发环境: ${devData.length} 条`)
    
    // 获取生产环境数据
    let prodCount = 0
    let prodIds = new Set()
    try {
      const prodResult = await prodPool.query(`SELECT ${idField} FROM ${name}`)
      prodCount = prodResult.rows.length
      prodIds = new Set(prodResult.rows.map(r => r[idField]))
    } catch (e) {
      console.log(`   ⚠️ 生产环境表不存在或查询失败: ${e.message}`)
      return { table: name, success: false, error: e.message }
    }
    console.log(`   生产环境: ${prodCount} 条`)
    
    const diff = devData.length - prodCount
    if (diff === 0 && devData.every(d => prodIds.has(d[idField]))) {
      console.log(`   ✅ 数据已一致，跳过`)
      return { table: name, success: true, inserted: 0, updated: 0 }
    }
    
    if (dryRun) {
      console.log(`   [DRY-RUN] 将同步 ${devData.length} 条记录`)
      return { table: name, success: true, inserted: 0, updated: 0, dryRun: true }
    }
    
    // 获取列名
    const columns = await getTableColumns(devPool, name)
    
    // 构建 UPSERT SQL
    const columnList = columns.join(', ')
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const updateList = columns
      .filter(c => c !== conflictField && c !== 'created_at')
      .map(c => `${c} = EXCLUDED.${c}`)
      .join(', ')
    
    const upsertSql = `
      INSERT INTO ${name} (${columnList})
      VALUES (${placeholders})
      ON CONFLICT (${conflictField}) DO UPDATE SET ${updateList}
    `
    
    let insertCount = 0
    let updateCount = 0
    let errorCount = 0
    
    for (const row of devData) {
      try {
        const values = columns.map(c => row[c])
        await prodPool.query(upsertSql, values)
        
        if (prodIds.has(row[idField])) {
          updateCount++
        } else {
          insertCount++
        }
      } catch (err) {
        errorCount++
        if (!err.message.includes('duplicate key')) {
          console.log(`   ⚠️ 错误: ${err.message.slice(0, 50)}`)
        }
      }
    }
    
    console.log(`   ✅ 完成: 新增 ${insertCount}, 更新 ${updateCount}, 失败 ${errorCount}`)
    return { table: name, success: true, inserted: insertCount, updated: updateCount, errors: errorCount }
    
  } catch (err) {
    console.log(`   ❌ 失败: ${err.message}`)
    return { table: name, success: false, error: err.message }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('           综合数据同步：开发环境 → 生产环境')
  console.log('═══════════════════════════════════════════════════════════════')
  
  if (dryRun) {
    console.log('\n⚠️  DRY-RUN 模式：只显示差异，不执行同步')
  }
  
  if (targetTable) {
    console.log(`\n🎯 目标表: ${targetTable}`)
  }

  if (!PROD_DATABASE_URL) {
    console.error('❌ 请设置生产环境数据库 URL (DATABASE_URL_PROD)')
    process.exit(1)
  }

  const devPool = new pg.Pool({
    connectionString: DEV_DATABASE_URL,
    ssl: false
  })

  const prodPool = new pg.Pool({
    connectionString: PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    // 测试连接
    console.log('\n🔗 测试数据库连接...')
    await devPool.query('SELECT 1')
    console.log('  ✅ 开发环境连接成功')
    await prodPool.query('SELECT 1')
    console.log('  ✅ 生产环境连接成功')

    // 确定要同步的表
    let tablesToSync = SYNC_TABLES
    if (targetTable) {
      tablesToSync = SYNC_TABLES.filter(t => t.name === targetTable)
      if (tablesToSync.length === 0) {
        console.error(`\n❌ 未找到表: ${targetTable}`)
        console.log('可用的表:', SYNC_TABLES.map(t => t.name).join(', '))
        process.exit(1)
      }
    }

    // 显示待同步表
    console.log('\n📋 待同步表:')
    for (const table of tablesToSync) {
      console.log(`  - ${table.name} (${table.description})`)
    }

    if (!dryRun) {
      // 用户确认
      console.log('\n⚠️  警告: 此操作将修改生产数据库！')
      const confirmed = await confirm('确认继续?')

      if (!confirmed) {
        console.log('\n❌ 操作已取消')
        return
      }
    }

    // 执行同步
    const startTime = Date.now()
    const results = []

    for (const table of tablesToSync) {
      const result = await syncTable(devPool, prodPool, table)
      results.push(result)
    }

    // 汇总
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('                       同步汇总')
    console.log('═══════════════════════════════════════════════════════════════')
    
    let totalInserted = 0
    let totalUpdated = 0
    let failedTables = []
    
    for (const r of results) {
      if (r.success) {
        totalInserted += r.inserted || 0
        totalUpdated += r.updated || 0
        console.log(`  ✅ ${r.table}: 新增 ${r.inserted || 0}, 更新 ${r.updated || 0}`)
      } else {
        failedTables.push(r.table)
        console.log(`  ❌ ${r.table}: ${r.error}`)
      }
    }
    
    console.log('')
    console.log(`  📊 总计: 新增 ${totalInserted} 条, 更新 ${totalUpdated} 条`)
    if (failedTables.length > 0) {
      console.log(`  ⚠️ 失败: ${failedTables.join(', ')}`)
    }
    console.log(`  ⏱️  耗时: ${duration}s`)
    console.log('═══════════════════════════════════════════════════════════════')

  } catch (err) {
    console.error('\n❌ 同步过程出错:', err.message)
    process.exit(1)
  } finally {
    await devPool.end()
    await prodPool.end()
  }
}

main().catch(err => {
  console.error('同步失败:', err)
  process.exit(1)
})

