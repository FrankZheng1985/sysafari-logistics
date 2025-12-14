/**
 * SQLite 到 PostgreSQL 数据迁移脚本
 * 
 * 使用方法:
 * 1. 设置环境变量 DATABASE_URL
 * 2. 运行: node scripts/migrate-to-pg.js
 */

import Database from 'better-sqlite3'
import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { Pool } = pg

// 配置
const SQLITE_PATH = join(__dirname, '../data/orders.db')
const SCHEMA_PATH = join(__dirname, 'pg-init-schema.sql')

// PostgreSQL 连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// 需要迁移的表（按依赖顺序）
const TABLES_TO_MIGRATE = [
  'order_sequences',
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'shipping_companies',
  'container_codes',
  'countries',
  'ports_of_loading',
  'destination_ports',
  'air_ports',
  'transport_methods',
  'service_fee_categories',
  'service_fees',
  'transport_prices',
  'transport_pricing',
  'service_providers',
  'vat_rates',
  'tariff_rates',
  'tariff_rate_history',
  'system_settings',
  'security_settings',
  'system_configs',
  'basic_data',
  'customers',
  'customer_contacts',
  'customer_follow_ups',
  'sales_opportunities',
  'quotations',
  'contracts',
  'customer_feedbacks',
  'bills_of_lading',
  'packages',
  'declarations',
  'labels',
  'last_mile_orders',
  'fees',
  'invoices',
  'payments',
  'operation_logs',
  'bill_files',
  'user_bill_assignments',
  'login_attempts',
  'verification_codes',
  'login_logs',
  'clearance_document_types',
  'clearance_documents',
  'clearance_document_items',
  'void_applications',
  'document_templates',
  'document_versions',
  'documents'
]

/**
 * 初始化 PostgreSQL 表结构
 */
async function initSchema() {
  console.log('\n📦 正在初始化 PostgreSQL 表结构...')
  
  const schema = readFileSync(SCHEMA_PATH, 'utf-8')
  const client = await pool.connect()
  
  try {
    await client.query(schema)
    console.log('✅ PostgreSQL 表结构初始化完成')
  } catch (error) {
    console.error('❌ 表结构初始化失败:', error.message)
    throw error
  } finally {
    client.release()
  }
}

/**
 * 迁移单个表的数据
 */
async function migrateTable(sqliteDb, tableName) {
  const client = await pool.connect()
  
  try {
    // 检查 SQLite 表是否存在
    const tableExists = sqliteDb.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName)
    
    if (!tableExists) {
      console.log(`⏭️  跳过 ${tableName}（SQLite 中不存在）`)
      return 0
    }
    
    // 获取 SQLite 表数据
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all()
    
    if (rows.length === 0) {
      console.log(`⏭️  跳过 ${tableName}（无数据）`)
      return 0
    }
    
    // 获取列名
    const columns = Object.keys(rows[0])
    
    // 构建 INSERT 语句
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`
    
    // 批量插入
    await client.query('BEGIN')
    
    let insertedCount = 0
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col]
        // 处理 NULL 和特殊值
        if (val === null || val === undefined) return null
        return val
      })
      
      try {
        await client.query(insertSQL, values)
        insertedCount++
      } catch (err) {
        // 忽略重复键错误，继续插入
        if (!err.message.includes('duplicate key')) {
          console.error(`   ⚠️ 插入错误 (${tableName}):`, err.message)
        }
      }
    }
    
    await client.query('COMMIT')
    console.log(`✅ ${tableName}: ${insertedCount}/${rows.length} 条记录`)
    return insertedCount
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`❌ 迁移 ${tableName} 失败:`, error.message)
    return 0
  } finally {
    client.release()
  }
}

/**
 * 更新 PostgreSQL 序列（自增ID）
 */
async function updateSequences() {
  console.log('\n🔄 正在更新自增序列...')
  
  const client = await pool.connect()
  
  // 需要更新序列的表
  const tablesWithSerial = [
    'operation_logs', 'bill_files', 'basic_data', 'ports_of_loading',
    'destination_ports', 'air_ports', 'countries', 'service_fee_categories',
    'transport_methods', 'service_fees', 'transport_prices', 'system_settings',
    'tariff_rates', 'tariff_rate_history', 'users', 'roles', 'permissions',
    'role_permissions', 'user_bill_assignments', 'shipping_companies',
    'container_codes', 'login_attempts', 'verification_codes', 'login_logs',
    'security_settings', 'vat_rates', 'service_providers', 'transport_pricing',
    'clearance_document_types', 'document_templates', 'document_versions'
  ]
  
  try {
    for (const table of tablesWithSerial) {
      try {
        // 获取当前最大 ID
        const result = await client.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM ${table}`)
        const maxId = result.rows[0].max_id
        
        if (maxId > 0) {
          // 更新序列
          await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), $1, true)`, [maxId])
          console.log(`   ${table}: 序列更新到 ${maxId}`)
        }
      } catch (err) {
        // 某些表可能没有序列，忽略错误
      }
    }
    console.log('✅ 自增序列更新完成')
  } finally {
    client.release()
  }
}

/**
 * 主迁移函数
 */
async function migrate() {
  console.log('🚀 开始 SQLite → PostgreSQL 数据迁移')
  console.log('=' .repeat(50))
  
  // 检查环境变量
  if (!process.env.DATABASE_URL) {
    console.error('❌ 错误: 请设置 DATABASE_URL 环境变量')
    console.log('\n示例:')
    console.log('export DATABASE_URL="postgresql://user:password@host/database"')
    process.exit(1)
  }
  
  console.log(`📂 SQLite 数据库: ${SQLITE_PATH}`)
  console.log(`🌐 PostgreSQL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`)
  
  // 打开 SQLite 数据库
  const sqliteDb = new Database(SQLITE_PATH, { readonly: true })
  console.log('✅ SQLite 数据库已打开')
  
  // 测试 PostgreSQL 连接
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT current_database() as db')
    console.log(`✅ PostgreSQL 连接成功: ${result.rows[0].db}`)
    client.release()
  } catch (error) {
    console.error('❌ PostgreSQL 连接失败:', error.message)
    process.exit(1)
  }
  
  // 初始化表结构
  await initSchema()
  
  // 迁移数据
  console.log('\n📊 正在迁移数据...')
  let totalMigrated = 0
  
  for (const table of TABLES_TO_MIGRATE) {
    const count = await migrateTable(sqliteDb, table)
    totalMigrated += count
  }
  
  // 更新序列
  await updateSequences()
  
  // 关闭连接
  sqliteDb.close()
  await pool.end()
  
  console.log('\n' + '=' .repeat(50))
  console.log(`🎉 迁移完成！共迁移 ${totalMigrated} 条记录`)
  console.log('\n下一步:')
  console.log('1. 检查 PostgreSQL 数据是否完整')
  console.log('2. 更新后端代码使用 PostgreSQL')
  console.log('3. 部署到 Render')
}

// 运行迁移
migrate().catch(err => {
  console.error('❌ 迁移失败:', err)
  process.exit(1)
})
