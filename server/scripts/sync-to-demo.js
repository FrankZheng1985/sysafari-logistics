/**
 * 同步本地数据到演示环境数据库
 * 
 * 使用方法：
 * export TARGET_DATABASE_URL="演示数据库连接字符串"
 * node server/scripts/sync-to-demo.js
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载本地环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接配置
const SOURCE_URL = process.env.DATABASE_URL // 本地数据库
const TARGET_URL = process.env.TARGET_DATABASE_URL // 演示数据库

if (!SOURCE_URL) {
  console.error('❌ 错误: 未配置本地数据库连接 DATABASE_URL')
  process.exit(1)
}

if (!TARGET_URL) {
  console.error('❌ 错误: 未配置目标数据库连接 TARGET_DATABASE_URL')
  process.exit(1)
}

// 需要同步的所有表（按依赖顺序）
const ALL_TABLES = [
  // 基础数据表（无外键依赖）
  'order_sequences',
  'countries',
  'shipping_companies',
  'container_codes',
  'ports_of_loading',
  'destination_ports',
  'air_ports',
  'transport_methods',
  'vat_rates',
  'service_fee_categories',
  'service_fees',
  'service_providers',
  'tariff_rates',
  'tariff_rate_history',
  'transport_prices',
  'transport_pricing',
  'clearance_document_types',
  'system_settings',
  'system_configs',
  'document_templates',
  
  // 用户和权限表
  'roles',
  'permissions',
  'role_permissions',
  'users',
  'login_attempts',
  'login_logs',
  'verification_codes',
  'security_settings',
  'auth0_pending_users',
  
  // 客户相关表
  'customers',
  'customer_contacts',
  'customer_follow_ups',
  'customer_feedbacks',
  'sales_opportunities',
  'quotations',
  'contracts',
  
  // 业务数据表
  'bills_of_lading',
  'bill_files',
  'packages',
  'declarations',
  'labels',
  'last_mile_orders',
  'user_bill_assignments',
  'clearance_documents',
  'clearance_document_items',
  'void_applications',
  
  // 财务表
  'fees',
  'invoices',
  'payments',
  
  // 文档表
  'documents',
  'document_versions',
  
  // 日志表（最后）
  'operation_logs'
]

// 创建数据库连接池
function createPool(connectionString, isLocal = false) {
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
  return new pg.Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 5
  })
}

// 获取表的所有数据
async function getTableData(pool, tableName) {
  try {
    const result = await pool.query(`SELECT * FROM ${tableName}`)
    return result.rows
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return null // 表不存在
    }
    throw err
  }
}

// 获取表的列信息
async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName])
  return result.rows.map(r => r.column_name)
}

// 清空表数据（使用 DELETE 避免权限问题）
async function truncateTable(pool, tableName) {
  try {
    await pool.query(`DELETE FROM ${tableName}`)
    return true
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return false
    }
    // 外键约束错误，稍后处理
    if (err.message.includes('violates foreign key')) {
      return 'fk_error'
    }
    throw err
  }
}

// 插入数据
async function insertData(pool, tableName, rows, columns) {
  if (rows.length === 0) return 0
  
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    let inserted = 0
    for (const row of rows) {
      const values = columns.map(col => row[col])
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      const colNames = columns.join(', ')
      
      try {
        await client.query(
          `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`,
          values
        )
        inserted++
      } catch (err) {
        // 忽略重复键错误，继续插入
        if (!err.message.includes('duplicate key')) {
          console.error(`   ⚠️ 插入错误 (${tableName}):`, err.message.substring(0, 100))
        }
      }
    }
    
    await client.query('COMMIT')
    return inserted
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// 主函数
async function main() {
  console.log('🚀 开始同步本地数据到演示环境...\n')
  
  const sourcePool = createPool(SOURCE_URL, true)
  const targetPool = createPool(TARGET_URL)
  
  try {
    // 测试连接
    console.log('📡 测试数据库连接...')
    const sourceTest = await sourcePool.query('SELECT current_database() as db')
    console.log(`   ✅ 本地数据库: ${sourceTest.rows[0].db}`)
    
    const targetTest = await targetPool.query('SELECT current_database() as db')
    console.log(`   ✅ 演示数据库: ${targetTest.rows[0].db}`)
    console.log('')
    
    let syncedTables = 0
    let totalRows = 0
    
    // 第一阶段：按逆序清空表（处理外键依赖）
    console.log('🗑️ 清空演示数据库表...')
    const reverseTables = [...ALL_TABLES].reverse()
    for (const tableName of reverseTables) {
      try {
        await targetPool.query(`DELETE FROM ${tableName}`)
        console.log(`   ✅ 已清空 ${tableName}`)
      } catch (err) {
        if (!err.message.includes('does not exist')) {
          console.log(`   ⚠️ ${tableName}: ${err.message.substring(0, 50)}`)
        }
      }
    }
    console.log('')
    
    // 第二阶段：按正序插入数据
    console.log('📥 同步数据...')
    for (const tableName of ALL_TABLES) {
      process.stdout.write(`   📋 ${tableName}...`)
      
      // 获取源数据
      const sourceData = await getTableData(sourcePool, tableName)
      if (sourceData === null) {
        console.log(' ⏭️ 表不存在(本地)')
        continue
      }
      
      // 获取列信息
      const columns = await getTableColumns(sourcePool, tableName)
      if (columns.length === 0) {
        console.log(' ⏭️ 无列信息')
        continue
      }
      
      // 检查目标表是否存在
      try {
        await targetPool.query(`SELECT 1 FROM ${tableName} LIMIT 1`)
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(' ⏭️ 表不存在(演示)')
          continue
        }
      }
      
      // 插入数据
      if (sourceData.length > 0) {
        const inserted = await insertData(targetPool, tableName, sourceData, columns)
        console.log(` ✅ ${inserted}/${sourceData.length} 条`)
        totalRows += inserted
      } else {
        console.log(' ✅ 0 条')
      }
      
      syncedTables++
    }
    
    // 重置序列
    console.log('\n🔄 重置自增序列...')
    const sequences = await targetPool.query(`
      SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    `)
    for (const seq of sequences.rows) {
      try {
        const tableName = seq.sequence_name.replace('_id_seq', '')
        await targetPool.query(`
          SELECT setval('${seq.sequence_name}', COALESCE((SELECT MAX(id) FROM ${tableName}), 1))
        `)
      } catch (err) {
        // 忽略序列重置错误
      }
    }
    
    console.log('\n' + '='.repeat(50))
    console.log(`✅ 同步完成！`)
    console.log(`   📊 同步表数: ${syncedTables}`)
    console.log(`   📝 总记录数: ${totalRows}`)
    console.log('='.repeat(50))
    
  } catch (err) {
    console.error('\n❌ 同步失败:', err.message)
    throw err
  } finally {
    await sourcePool.end()
    await targetPool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

