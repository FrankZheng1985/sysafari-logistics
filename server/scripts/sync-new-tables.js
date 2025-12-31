/**
 * 同步新表到各环境数据库
 * 
 * 功能：
 * 1. 从本地开发环境读取新表结构
 * 2. 同步到生产环境和演示环境（不更新订单相关表）
 * 
 * 使用方法：
 * 1. 设置环境变量
 *    export DATABASE_URL="本地数据库连接字符串"
 *    export PROD_DATABASE_URL="生产数据库连接字符串"（可选）
 *    export DEMO_DATABASE_URL="演示数据库连接字符串"（可选）
 * 
 * 2. 运行脚本
 *    node server/scripts/sync-new-tables.js
 */

import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

// 数据库连接配置
const DEV_URL = process.env.DATABASE_URL
const PROD_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL_PROD
const DEMO_URL = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL_TEST

// 需要同步的新表（非订单表）
const NEW_TABLES = [
  'api_integrations',
  'api_usage_records',
  'api_recharge_records',
  'tracking_api_configs'
]

// 订单相关表（不更新）
const ORDER_TABLES = [
  'bills_of_lading',
  'packages',
  'declarations',
  'labels',
  'last_mile_orders',
  'fees',
  'invoices',
  'payments',
  'clearance_documents',
  'clearance_document_items',
  'void_applications',
  'operation_logs',
  'bill_files'
]

// 创建数据库连接池
function createPool(connectionString, envName) {
  if (!connectionString) {
    return null
  }
  
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
  return {
    pool: new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 5
    }),
    name: envName
  }
}

// 获取表的完整DDL
async function getTableDDL(pool, tableName) {
  // 获取列定义
  const columnsResult = await pool.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      column_default,
      is_nullable,
      ordinal_position
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName])
  
  if (columnsResult.rows.length === 0) {
    return null
  }
  
  // 构建列定义
  const columns = columnsResult.rows.map(col => {
    let def = col.column_name
    
    // 数据类型
    if (col.data_type === 'character varying') {
      def += ` VARCHAR(${col.character_maximum_length})`
    } else if (col.data_type === 'numeric') {
      if (col.numeric_precision && col.numeric_scale) {
        def += ` NUMERIC(${col.numeric_precision},${col.numeric_scale})`
      } else {
        def += ' NUMERIC'
      }
    } else if (col.data_type === 'integer') {
      // 检查是否是SERIAL类型
      if (col.column_default && col.column_default.includes('nextval')) {
        def += ' SERIAL'
      } else {
        def += ' INTEGER'
      }
    } else if (col.data_type === 'text') {
      def += ' TEXT'
    } else if (col.data_type === 'timestamp without time zone') {
      def += ' TIMESTAMP'
    } else if (col.data_type === 'date') {
      def += ' DATE'
    } else if (col.data_type === 'jsonb') {
      def += ' JSONB'
    } else {
      def += ` ${col.data_type.toUpperCase()}`
    }
    
    // 默认值
    if (col.column_default && !col.column_default.includes('nextval')) {
      def += ` DEFAULT ${col.column_default}`
    }
    
    // NOT NULL
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL'
    }
    
    return def
  }).join(',\n    ')
  
  // 获取主键约束
  const pkResult = await pool.query(`
    SELECT 
      a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass
    AND i.indisprimary
    ORDER BY a.attnum
  `, [tableName])
  
  const primaryKeys = pkResult.rows.map(r => r.attname)
  
  // 获取外键约束
  const fkResult = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = $1
  `, [tableName])
  
  // 构建CREATE TABLE语句
  let ddl = `CREATE TABLE IF NOT EXISTS ${tableName} (\n    ${columns}`
  
  if (primaryKeys.length > 0) {
    ddl += `,\n    PRIMARY KEY (${primaryKeys.join(', ')})`
  }
  
  ddl += '\n)'
  
  // 添加外键约束
  const fkStatements = []
  for (const fk of fkResult.rows) {
    fkStatements.push(
      `ALTER TABLE ${tableName} ADD CONSTRAINT ${fk.constraint_name} ` +
      `FOREIGN KEY (${fk.column_name}) ` +
      `REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name}) ` +
      `ON DELETE CASCADE`
    )
  }
  
  return { ddl, fkStatements }
}

// 获取索引定义
async function getIndexDDL(pool, tableName) {
  const result = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes 
    WHERE tablename = $1 AND schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
  `, [tableName])
  
  return result.rows.map(r => r.indexdef.replace(/CREATE INDEX/, 'CREATE INDEX IF NOT EXISTS'))
}

// 同步表到目标数据库
async function syncTable(sourcePool, targetPool, tableName) {
  try {
    // 检查源表是否存在
    const sourceCheck = await sourcePool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName])
    
    if (!sourceCheck.rows[0].exists) {
      console.log(`   ⏭️  ${tableName}: 源表不存在`)
      return false
    }
    
    // 获取表结构
    const tableInfo = await getTableDDL(sourcePool, tableName)
    if (!tableInfo) {
      console.log(`   ⚠️  ${tableName}: 无法获取表结构`)
      return false
    }
    
    // 创建表
    await targetPool.query(tableInfo.ddl)
    
    // 创建外键（如果存在）
    for (const fkSql of tableInfo.fkStatements) {
      try {
        await targetPool.query(fkSql)
      } catch (err) {
        // 忽略外键已存在错误
        if (!err.message.includes('already exists')) {
          console.warn(`   ⚠️  ${tableName}: 外键创建失败 - ${err.message.substring(0, 50)}`)
        }
      }
    }
    
    // 创建索引
    const indexes = await getIndexDDL(sourcePool, tableName)
    for (const indexSql of indexes) {
      try {
        await targetPool.query(indexSql)
      } catch (err) {
        // 忽略索引已存在错误
        if (!err.message.includes('already exists')) {
          console.warn(`   ⚠️  ${tableName}: 索引创建失败 - ${err.message.substring(0, 50)}`)
        }
      }
    }
    
    console.log(`   ✅ ${tableName}: 表结构同步成功`)
    return true
    
  } catch (err) {
    console.error(`   ❌ ${tableName}: ${err.message}`)
    return false
  }
}

// 同步初始数据（仅限api_integrations）
async function syncInitialData(sourcePool, targetPool) {
  try {
    // 检查目标表是否有数据
    const checkResult = await targetPool.query('SELECT COUNT(*) as count FROM api_integrations')
    if (checkResult.rows[0].count > 0) {
      console.log('   ⏭️  api_integrations: 已有数据，跳过初始化')
      return
    }
    
    // 从源数据库读取数据
    const sourceData = await sourcePool.query('SELECT * FROM api_integrations')
    
    if (sourceData.rows.length === 0) {
      console.log('   ⏭️  api_integrations: 源表无数据')
      return
    }
    
    // 插入数据
    for (const row of sourceData.rows) {
      const columns = Object.keys(row)
      const values = columns.map((_, i) => `$${i + 1}`).join(', ')
      const placeholders = columns.map(col => row[col])
      
      await targetPool.query(
        `INSERT INTO api_integrations (${columns.join(', ')}) VALUES (${values}) ON CONFLICT (api_code) DO NOTHING`,
        placeholders
      )
    }
    
    console.log(`   ✅ api_integrations: 初始化数据同步成功 (${sourceData.rows.length} 条)`)
    
  } catch (err) {
    console.warn(`   ⚠️  api_integrations: 数据同步失败 - ${err.message.substring(0, 50)}`)
  }
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('        新表同步工具')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  
  // 检查环境变量
  if (!DEV_URL) {
    console.error('❌ 错误: 未配置开发环境数据库连接 (DATABASE_URL)')
    process.exit(1)
  }
  
  if (!PROD_URL && !DEMO_URL) {
    console.error('❌ 错误: 至少需要配置一个目标环境 (PROD_DATABASE_URL 或 DEMO_DATABASE_URL)')
    process.exit(1)
  }
  
  console.log('📊 环境配置:')
  console.log(`   源环境 (开发): ${DEV_URL ? '✅' : '❌'}`)
  console.log(`   目标环境 (生产): ${PROD_URL ? '✅' : '❌'}`)
  console.log(`   目标环境 (演示): ${DEMO_URL ? '✅' : '❌'}`)
  console.log('')
  console.log('📋 需要同步的表:')
  NEW_TABLES.forEach(t => console.log(`   - ${t}`))
  console.log('')
  console.log('🚫 不更新的表（订单相关）:')
  ORDER_TABLES.forEach(t => console.log(`   - ${t}`))
  console.log('')
  
  // 创建连接池
  const devConn = createPool(DEV_URL, '开发环境')
  const prodConn = PROD_URL ? createPool(PROD_URL, '生产环境') : null
  const demoConn = DEMO_URL ? createPool(DEMO_URL, '演示环境') : null
  
  const targetConns = [prodConn, demoConn].filter(c => c !== null)
  
  try {
    // 测试连接
    console.log('🔌 测试数据库连接...')
    await devConn.pool.query('SELECT 1')
    console.log('   ✅ 开发环境连接成功')
    
    for (const conn of targetConns) {
      await conn.pool.query('SELECT 1')
      console.log(`   ✅ ${conn.name}连接成功`)
    }
    console.log('')
    
    // 同步到各目标环境
    for (const targetConn of targetConns) {
      console.log(`═══════════════════════════════════════════════════════`)
      console.log(`同步到 ${targetConn.name}...`)
      console.log(`═══════════════════════════════════════════════════════`)
      console.log('')
      
      let successCount = 0
      
      for (const tableName of NEW_TABLES) {
        const success = await syncTable(devConn.pool, targetConn.pool, tableName)
        if (success) successCount++
      }
      
      // 同步初始数据
      console.log('')
      console.log('📦 同步初始数据...')
      await syncInitialData(devConn.pool, targetConn.pool)
      
      console.log('')
      console.log(`✅ ${targetConn.name}同步完成: ${successCount}/${NEW_TABLES.length} 个表`)
      console.log('')
    }
    
    console.log('═══════════════════════════════════════════════════════')
    console.log('✅ 所有环境同步完成！')
    console.log('═══════════════════════════════════════════════════════')
    
  } catch (err) {
    console.error('❌ 同步失败:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    // 关闭连接
    await devConn.pool.end()
    for (const conn of targetConns) {
      await conn.pool.end()
    }
  }
}

main()
