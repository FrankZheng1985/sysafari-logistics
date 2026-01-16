/**
 * 执行数据库迁移：添加 invoiced_amount 字段
 * 支持费用部分开票功能
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

if (!DATABASE_URL) {
  console.error('❌ 未配置 DATABASE_URL')
  process.exit(1)
}

const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')

const pool = new pg.Pool({ 
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
})

async function migrate() {
  const client = await pool.connect()
  
  try {
    console.log('=' .repeat(60))
    console.log('🚀 开始执行数据库迁移：添加 invoiced_amount 字段')
    console.log('=' .repeat(60))
    
    // 1. 检查字段是否已存在
    const checkColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'fees' AND column_name = 'invoiced_amount'
    `)
    
    if (checkColumn.rows.length > 0) {
      console.log('ℹ️  invoiced_amount 字段已存在，跳过添加步骤')
    } else {
      // 添加 invoiced_amount 字段
      await client.query(`ALTER TABLE fees ADD COLUMN invoiced_amount NUMERIC DEFAULT 0`)
      console.log('✅ 成功添加 invoiced_amount 字段')
    }
    
    // 2. 更新现有已开票费用的 invoiced_amount
    const updateResult = await client.query(`
      UPDATE fees 
      SET invoiced_amount = amount 
      WHERE invoice_status = 'invoiced' 
        AND (invoiced_amount IS NULL OR invoiced_amount = 0)
    `)
    console.log(`✅ 更新了 ${updateResult.rowCount} 条已开票费用的 invoiced_amount`)
    
    // 3. 确保 invoiced_amount 不为 NULL
    const nullFixResult = await client.query(`
      UPDATE fees 
      SET invoiced_amount = 0 
      WHERE invoiced_amount IS NULL
    `)
    console.log(`✅ 修复了 ${nullFixResult.rowCount} 条 invoiced_amount 为 NULL 的记录`)
    
    // 4. 验证结果
    const stats = await client.query(`
      SELECT 
        invoice_status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(invoiced_amount) as total_invoiced_amount
      FROM fees 
      GROUP BY invoice_status
      ORDER BY invoice_status
    `)
    
    console.log('\n📊 费用开票状态统计:')
    console.log('-'.repeat(60))
    console.log('状态\t\t数量\t费用总额\t已开票金额')
    console.log('-'.repeat(60))
    stats.rows.forEach(row => {
      const status = row.invoice_status || 'null'
      console.log(`${status}\t\t${row.count}\t${parseFloat(row.total_amount || 0).toFixed(2)}\t${parseFloat(row.total_invoiced_amount || 0).toFixed(2)}`)
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

migrate().catch(err => {
  console.error(err)
  process.exit(1)
})
