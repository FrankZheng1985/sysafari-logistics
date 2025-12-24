/**
 * 查询重复客户的订单详情
 */

import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL_PROD
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  const client = await pool.connect()

  try {
    console.log('\n========================================')
    console.log('📋 重复客户「傲以-自主VAT」的订单详情')
    console.log('========================================\n')

    const orders = await client.query(`
      SELECT 
        id, 
        bill_number, 
        container_number, 
        customer_id, 
        customer_name, 
        shipper,
        order_seq,
        port_of_loading,
        port_of_discharge,
        created_at
      FROM bills_of_lading
      WHERE customer_id = '46fdd706-ea60-46c0-89a3-84ef46e57f0a'
      ORDER BY order_seq
    `)
    
    console.log(`共找到 ${orders.rows.length} 条订单:\n`)
    
    orders.rows.forEach((o, i) => {
      const orderNum = o.order_seq ? `BP25${String(o.order_seq).padStart(5, '0')}` : '未知'
      console.log(`${i + 1}. 订单号: ${orderNum}`)
      console.log(`   提单号: ${o.bill_number}`)
      console.log(`   集装箱号: ${o.container_number}`)
      console.log(`   起运港: ${o.port_of_loading} → 目的港: ${o.port_of_discharge}`)
      console.log(`   客户ID: ${o.customer_id}`)
      console.log('')
    })

    // 输出SQL便于手动修复
    console.log('========================================')
    console.log('📝 修复SQL语句:')
    console.log('========================================\n')

    const billNumbers = orders.rows.map(o => `'${o.bill_number}'`).join(', ')
    
    console.log(`-- 更新订单客户信息
UPDATE bills_of_lading
SET customer_id = 'CUSMJFKVCBZTRH',
    customer_name = '傲翼-自主VAT',
    shipper = '傲翼-自主VAT',
    updated_at = NOW()
WHERE customer_id = '46fdd706-ea60-46c0-89a3-84ef46e57f0a';

-- 删除重复客户
DELETE FROM customers WHERE customer_code = 'CUSMJJPLO66WE4';
`)

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

