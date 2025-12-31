/**
 * 修复缺失订单号的提单记录
 * 为已存在但没有 order_seq 和 order_number 的提单补充订单号
 * 
 * 使用方法: node server/scripts/fix-missing-order-numbers.js
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

// 数据库连接配置 - 使用与应用相同的配置
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置 DATABASE_URL，请检查 .env 文件')
  process.exit(1)
}

const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
})

console.log(`📦 数据库: ${isLocalhost ? '本地' : '远程'}`)

async function fixMissingOrderNumbers() {
  const client = await pool.connect()
  
  try {
    console.log('🔍 查找缺失订单号的记录...')
    
    // 1. 查找所有缺失 order_seq 或 order_number 的记录
    const missingResult = await client.query(`
      SELECT id, bill_number, container_number, create_time
      FROM bills_of_lading 
      WHERE (order_seq IS NULL OR order_number IS NULL OR order_number = '')
        AND is_void = 0
      ORDER BY create_time ASC, id ASC
    `)
    
    const missingRecords = missingResult.rows
    console.log(`📋 找到 ${missingRecords.length} 条缺失订单号的记录`)
    
    if (missingRecords.length === 0) {
      console.log('✅ 所有记录都已有订单号，无需修复')
      return
    }
    
    // 2. 获取当前序列号
    const seqResult = await client.query(
      "SELECT current_seq FROM order_sequences WHERE business_type = 'BILL'"
    )
    let currentSeq = seqResult.rows[0]?.current_seq || 0
    
    console.log(`📊 当前序列号: ${currentSeq}`)
    
    // 3. 获取年份后两位
    const year = new Date().getFullYear().toString().slice(-2)
    
    // 4. 批量更新
    let successCount = 0
    let errorCount = 0
    
    for (const record of missingRecords) {
      try {
        currentSeq++
        const orderNumber = `BP${year}${String(currentSeq).padStart(5, '0')}`
        
        await client.query(`
          UPDATE bills_of_lading 
          SET order_seq = $1, order_number = $2, updated_at = NOW()
          WHERE id = $3
        `, [currentSeq, orderNumber, record.id])
        
        console.log(`  ✅ ${record.bill_number || record.container_number} -> ${orderNumber}`)
        successCount++
      } catch (err) {
        console.error(`  ❌ ${record.bill_number}: ${err.message}`)
        errorCount++
      }
    }
    
    // 5. 更新序列号计数器
    await client.query(
      "UPDATE order_sequences SET current_seq = $1, updated_at = NOW() WHERE business_type = 'BILL'",
      [currentSeq]
    )
    
    console.log('')
    console.log('========== 修复完成 ==========')
    console.log(`✅ 成功: ${successCount} 条`)
    console.log(`❌ 失败: ${errorCount} 条`)
    console.log(`📊 新序列号: ${currentSeq}`)
    
  } catch (err) {
    console.error('❌ 修复失败:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行
fixMissingOrderNumbers()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(err => {
    console.error('💥 脚本执行失败:', err)
    process.exit(1)
  })

