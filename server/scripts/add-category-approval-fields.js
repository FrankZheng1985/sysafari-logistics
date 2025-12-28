/**
 * 添加费用分类审批相关字段
 * 运行方式: node server/scripts/add-category-approval-fields.js
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

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
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  })

  const client = await pool.connect()

  try {
    console.log('🚀 开始添加费用分类审批相关字段...\n')

    // 0. 先确保表存在
    console.log('0️⃣ 确保 fee_item_approvals 表存在...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_item_approvals (
        id SERIAL PRIMARY KEY,
        fee_id TEXT,
        fee_name TEXT NOT NULL,
        fee_name_en TEXT,
        category TEXT DEFAULT 'other',
        amount DECIMAL(12,2),
        currency TEXT DEFAULT 'EUR',
        unit TEXT DEFAULT '次',
        supplier_id TEXT,
        supplier_name TEXT,
        description TEXT,
        requested_by TEXT,
        requested_by_name TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_by_name TEXT,
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        converted_to_price_id INTEGER,
        converted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('   ✅ 表结构确认完成')

    // 1. 添加 approval_type 字段
    console.log('1️⃣ 添加 approval_type 字段...')
    try {
      await client.query(`
        ALTER TABLE fee_item_approvals 
        ADD COLUMN IF NOT EXISTS approval_type VARCHAR(50) DEFAULT 'fee_item'
      `)
      console.log('   ✅ approval_type 字段添加成功')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ⏭️ approval_type 字段已存在，跳过')
      } else {
        throw err
      }
    }

    // 2. 添加 parent_category_id 字段
    console.log('2️⃣ 添加 parent_category_id 字段...')
    try {
      await client.query(`
        ALTER TABLE fee_item_approvals 
        ADD COLUMN IF NOT EXISTS parent_category_id INTEGER DEFAULT NULL
      `)
      console.log('   ✅ parent_category_id 字段添加成功')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ⏭️ parent_category_id 字段已存在，跳过')
      } else {
        throw err
      }
    }

    // 3. 添加 parent_category_name 字段
    console.log('3️⃣ 添加 parent_category_name 字段...')
    try {
      await client.query(`
        ALTER TABLE fee_item_approvals 
        ADD COLUMN IF NOT EXISTS parent_category_name VARCHAR(200) DEFAULT NULL
      `)
      console.log('   ✅ parent_category_name 字段添加成功')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ⏭️ parent_category_name 字段已存在，跳过')
      } else {
        throw err
      }
    }

    // 4. 添加 converted_to_category_id 字段
    console.log('4️⃣ 添加 converted_to_category_id 字段...')
    try {
      await client.query(`
        ALTER TABLE fee_item_approvals 
        ADD COLUMN IF NOT EXISTS converted_to_category_id INTEGER DEFAULT NULL
      `)
      console.log('   ✅ converted_to_category_id 字段添加成功')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ⏭️ converted_to_category_id 字段已存在，跳过')
      } else {
        throw err
      }
    }

    // 5. 创建索引
    console.log('5️⃣ 创建索引...')
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_type 
        ON fee_item_approvals(approval_type)
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_parent_category 
        ON fee_item_approvals(parent_category_id)
      `)
      console.log('   ✅ 索引创建成功')
    } catch (err) {
      console.log('   ⏭️ 索引可能已存在:', err.message)
    }

    // 6. 更新现有数据
    console.log('6️⃣ 更新现有数据...')
    const updateResult = await client.query(`
      UPDATE fee_item_approvals 
      SET approval_type = 'fee_item' 
      WHERE approval_type IS NULL
    `)
    console.log(`   ✅ 更新了 ${updateResult.rowCount} 条记录`)

    console.log('\n✅ 迁移完成！费用项审批表现在支持新费用分类审批。')

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

