/**
 * 执行费用分类父子层级迁移脚本
 * 运行方式: node server/scripts/run-fee-category-migration.js
 */

import pg from 'pg'
import fs from 'fs'
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
    console.log('🚀 开始执行费用分类父子层级迁移...\n')

    // 1. 添加 parent_id 字段
    console.log('1️⃣ 添加 parent_id 字段...')
    try {
      await client.query(`
        ALTER TABLE service_fee_categories 
        ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL
      `)
      console.log('   ✅ parent_id 字段添加成功')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ⏭️ parent_id 字段已存在，跳过')
      } else {
        throw err
      }
    }

    // 2. 添加 level 字段
    console.log('2️⃣ 添加 level 字段...')
    try {
      await client.query(`
        ALTER TABLE service_fee_categories 
        ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1
      `)
      console.log('   ✅ level 字段添加成功')
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ⏭️ level 字段已存在，跳过')
      } else {
        throw err
      }
    }

    // 3. 创建索引
    console.log('3️⃣ 创建索引...')
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_service_fee_categories_parent 
        ON service_fee_categories(parent_id)
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_service_fee_categories_level 
        ON service_fee_categories(level)
      `)
      console.log('   ✅ 索引创建成功')
    } catch (err) {
      console.log('   ⏭️ 索引可能已存在:', err.message)
    }

    // 4. 更新现有数据
    console.log('4️⃣ 更新现有数据层级为1...')
    const updateResult = await client.query(`
      UPDATE service_fee_categories 
      SET level = 1, parent_id = NULL 
      WHERE level IS NULL
    `)
    console.log(`   ✅ 更新了 ${updateResult.rowCount} 条记录`)

    // 5. 查看结果
    console.log('\n📊 当前费用分类数据:')
    const result = await client.query(`
      SELECT id, name, code, parent_id, level, sort_order, status 
      FROM service_fee_categories 
      ORDER BY COALESCE(parent_id, 0), sort_order, id
    `)
    
    console.log('─'.repeat(80))
    console.log('ID\t层级\t父ID\t名称\t\t\t代码\t\t状态')
    console.log('─'.repeat(80))
    result.rows.forEach(row => {
      const indent = row.level > 1 ? '  └─ ' : ''
      const name = (indent + row.name).padEnd(20)
      console.log(`${row.id}\t${row.level}\t${row.parent_id || '-'}\t${name}\t${row.code.padEnd(15)}\t${row.status}`)
    })
    console.log('─'.repeat(80))
    console.log(`共 ${result.rows.length} 条记录\n`)

    console.log('✅ 迁移完成！费用分类现在支持父子层级结构。')

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

