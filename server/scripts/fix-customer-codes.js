/**
 * 修复客户编号脚本
 * 将同一年月的客户编号序号改为递增（0001, 0002, 0003...）
 * 
 * 使用方法：
 * 1. 预览模式（不修改数据）：node fix-customer-codes.js
 * 2. 执行修复：node fix-customer-codes.js --execute
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function fixCustomerCodes(execute = false) {
  const client = await pool.connect()
  
  try {
    console.log('='.repeat(60))
    console.log('客户编号修复脚本')
    console.log('='.repeat(60))
    console.log(`模式: ${execute ? '🔧 执行修复' : '👀 预览模式（不修改数据）'}`)
    console.log('')

    // 1. 查询所有需要修复的客户（按年月分组）
    // 客户编号格式：首字母 + 年月(4位) + 序号(4位)
    // 例如：AYZZ25120001
    const customersResult = await client.query(`
      SELECT 
        id, 
        customer_code, 
        customer_name,
        created_at,
        SUBSTRING(customer_code FROM LENGTH(customer_code) - 7 FOR 4) as year_month,
        CAST(RIGHT(customer_code, 4) AS INTEGER) as current_seq
      FROM customers 
      WHERE customer_code IS NOT NULL 
        AND customer_code ~ '^[A-Z]+[0-9]{8}$'
      ORDER BY year_month, created_at, id
    `)

    if (customersResult.rows.length === 0) {
      console.log('没有找到需要修复的客户编号')
      return
    }

    console.log(`找到 ${customersResult.rows.length} 个客户`)
    console.log('')

    // 2. 按年月分组
    const customersByYearMonth = {}
    for (const row of customersResult.rows) {
      const yearMonth = row.year_month
      if (!customersByYearMonth[yearMonth]) {
        customersByYearMonth[yearMonth] = []
      }
      customersByYearMonth[yearMonth].push(row)
    }

    console.log('按年月分组统计:')
    for (const [yearMonth, customers] of Object.entries(customersByYearMonth)) {
      console.log(`  ${yearMonth}: ${customers.length} 个客户`)
    }
    console.log('')

    // 3. 生成修复计划
    const updates = []
    
    for (const [yearMonth, customers] of Object.entries(customersByYearMonth)) {
      console.log(`\n📅 年月 ${yearMonth}:`)
      console.log('-'.repeat(50))
      
      let seq = 1
      for (const customer of customers) {
        const oldCode = customer.customer_code
        // 提取首字母前缀（去掉最后8位：年月4位+序号4位）
        const prefix = oldCode.slice(0, -8)
        const newSeq = seq.toString().padStart(4, '0')
        const newCode = `${prefix}${yearMonth}${newSeq}`
        
        if (oldCode !== newCode) {
          updates.push({
            id: customer.id,
            customerName: customer.customer_name,
            oldCode,
            newCode
          })
          console.log(`  ❌ ${customer.customer_name}`)
          console.log(`     ${oldCode} → ${newCode}`)
        } else {
          console.log(`  ✓ ${customer.customer_name}: ${oldCode} (无需修改)`)
        }
        
        seq++
      }
    }

    console.log('')
    console.log('='.repeat(60))
    console.log(`需要修复的客户编号: ${updates.length} 个`)
    console.log('='.repeat(60))

    if (updates.length === 0) {
      console.log('✅ 所有客户编号已经是正确的，无需修复')
      return
    }

    // 4. 执行修复
    if (execute) {
      console.log('')
      console.log('🔧 开始执行修复...')
      
      await client.query('BEGIN')
      
      try {
        for (const update of updates) {
          await client.query(
            'UPDATE customers SET customer_code = $1, updated_at = NOW() WHERE id = $2',
            [update.newCode, update.id]
          )
          console.log(`  ✓ ${update.customerName}: ${update.oldCode} → ${update.newCode}`)
        }
        
        // 5. 更新序列号表
        console.log('')
        console.log('📊 更新序列号表...')
        
        for (const [yearMonth, customers] of Object.entries(customersByYearMonth)) {
          const businessType = `CUSTOMER_${yearMonth}`
          const maxSeq = customers.length
          
          // 插入或更新序列号
          await client.query(`
            INSERT INTO order_sequences (business_type, current_seq, description, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (business_type) DO UPDATE SET current_seq = $2, updated_at = NOW()
          `, [businessType, maxSeq, `客户编号序列 - 20${yearMonth.slice(0,2)}年${yearMonth.slice(2)}月`])
          
          console.log(`  ✓ ${businessType}: 序列号设置为 ${maxSeq}`)
        }
        
        await client.query('COMMIT')
        
        console.log('')
        console.log('✅ 修复完成！')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    } else {
      console.log('')
      console.log('💡 这是预览模式，数据没有被修改')
      console.log('   要执行修复，请运行: node fix-customer-codes.js --execute')
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 解析命令行参数
const execute = process.argv.includes('--execute')
fixCustomerCodes(execute).catch(console.error)
