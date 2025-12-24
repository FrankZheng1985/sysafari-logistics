/**
 * 检查重复客户情况（连接生产数据库）
 */

import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

async function main() {
  // 连接生产数据库
  const DATABASE_URL = process.env.DATABASE_URL_PROD
  if (!DATABASE_URL) {
    console.error('❌ 未配置生产数据库连接')
    process.exit(1)
  }

  console.log('🔗 连接到生产数据库...')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  const client = await pool.connect()

  try {
    console.log('\n========================================')
    console.log('📋 检查重复客户情况')
    console.log('========================================\n')

    // 查询包含"傲"和"VAT"的客户
    console.log('1️⃣ 查询相关客户:')
    const customers = await client.query(`
      SELECT id, customer_code, customer_name, company_name, customer_type, status, created_at
      FROM customers 
      WHERE customer_name LIKE '%傲%' AND customer_name LIKE '%VAT%'
      ORDER BY created_at
    `)
    
    customers.rows.forEach(c => {
      console.log(`  - ${c.customer_code}: ${c.customer_name} (创建于: ${c.created_at})`)
    })

    // 查询需要检查的订单
    console.log('\n2️⃣ 查询相关订单:')
    const orders = await client.query(`
      SELECT id, bill_number, container_number, customer_id, customer_name, shipper, order_seq, created_at
      FROM bills_of_lading
      WHERE bill_number IN ('010501331342', '010501321495', '010501318460', '149509272452')
         OR (customer_name LIKE '%傲%' AND customer_name LIKE '%VAT%')
      ORDER BY created_at DESC
      LIMIT 20
    `)
    
    orders.rows.forEach(o => {
      const orderNum = o.order_seq ? `BP${new Date(o.created_at).getFullYear().toString().slice(-2)}${String(o.order_seq).padStart(5, '0')}` : '未知'
      console.log(`  - ${orderNum} | 提单号: ${o.bill_number}`)
      console.log(`    客户: ${o.customer_name} | customer_id: ${o.customer_id}`)
    })

    // 查询两个客户的订单数量
    console.log('\n3️⃣ 客户订单统计:')
    const stats = await client.query(`
      SELECT customer_id, customer_name, COUNT(*) as order_count
      FROM bills_of_lading
      WHERE customer_name LIKE '%傲%' AND customer_name LIKE '%VAT%'
      GROUP BY customer_id, customer_name
    `)
    
    stats.rows.forEach(s => {
      console.log(`  - ${s.customer_name}: ${s.order_count} 条订单 (ID: ${s.customer_id})`)
    })

    console.log('\n========================================')
    console.log('✅ 检查完成')
    console.log('========================================\n')

  } catch (error) {
    console.error('❌ 查询错误:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

