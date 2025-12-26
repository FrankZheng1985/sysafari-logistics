/**
 * 执行数据库迁移脚本
 * 用于添加供应商关联和利润设置字段到 product_fee_items 表
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置数据库连接字符串')
  process.exit(1)
}

async function runMigration() {
  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: !isLocalhost ? { rejectUnauthorized: false } : false
  })

  const client = await pool.connect()
  
  try {
    console.log('🚀 开始执行数据库迁移...')
    
    // 添加新字段
    const alterStatements = [
      "ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_id TEXT",
      "ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_price_id INTEGER",
      "ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0",
      "ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS profit_type TEXT DEFAULT 'amount'",
      "ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS profit_value NUMERIC DEFAULT 0",
      "ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_name TEXT"
    ]
    
    for (const sql of alterStatements) {
      try {
        await client.query(sql)
        console.log(`✅ ${sql.split(' ').slice(0, 6).join(' ')}...`)
      } catch (err) {
        if (err.code === '42701') { // duplicate column
          console.log(`⏭️  字段已存在，跳过: ${sql.split(' ')[5]}`)
        } else {
          throw err
        }
      }
    }
    
    // 创建索引
    try {
      await client.query("CREATE INDEX IF NOT EXISTS idx_product_fee_items_supplier ON product_fee_items(supplier_id)")
      console.log('✅ 创建索引 idx_product_fee_items_supplier')
    } catch (err) {
      console.log('⏭️  索引已存在')
    }
    
    // 验证
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_fee_items' 
        AND column_name IN ('supplier_id', 'supplier_price_id', 'cost_price', 'profit_type', 'profit_value', 'supplier_name')
      ORDER BY column_name
    `)
    
    console.log('\n📋 新增字段验证:')
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
    console.log('\n✅ 数据库迁移完成！')
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration().catch(err => {
  console.error(err)
  process.exit(1)
})

