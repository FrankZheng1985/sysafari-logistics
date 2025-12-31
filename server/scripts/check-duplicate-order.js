/**
 * 检查重复订单号问题
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
    console.log('📋 检查重复订单号 BP2500535')
    console.log('========================================\n')

    // 查询 order_seq = 535 的所有订单
    const orders = await client.query(`
      SELECT 
        id, 
        bill_number, 
        container_number, 
        order_seq,
        transport_method,
        customer_name,
        shipper,
        port_of_loading,
        port_of_discharge,
        created_at
      FROM bills_of_lading
      WHERE order_seq = 535
      ORDER BY created_at
    `)
    
    console.log(`找到 ${orders.rows.length} 条 order_seq=535 的订单:\n`)
    
    orders.rows.forEach((o, i) => {
      console.log(`${i + 1}. ID: ${o.id}`)
      console.log(`   提单号: ${o.bill_number}`)
      console.log(`   集装箱号: ${o.container_number}`)
      console.log(`   运输方式: ${o.transport_method || '海运'}`)
      console.log(`   客户: ${o.customer_name}`)
      console.log(`   起运港: ${o.port_of_loading} → 目的港: ${o.port_of_discharge}`)
      console.log(`   创建时间: ${o.created_at}`)
      console.log('')
    })

    // 查询当前最大的 order_seq
    console.log('========================================')
    console.log('📊 当前订单序号统计')
    console.log('========================================\n')
    
    const maxSeq = await client.query(`
      SELECT MAX(order_seq) as max_seq FROM bills_of_lading
    `)
    console.log(`当前最大 order_seq: ${maxSeq.rows[0].max_seq}`)

    // 查找重复的 order_seq
    const duplicates = await client.query(`
      SELECT order_seq, COUNT(*) as count
      FROM bills_of_lading
      WHERE order_seq IS NOT NULL
      GROUP BY order_seq
      HAVING COUNT(*) > 1
      ORDER BY order_seq
    `)
    
    if (duplicates.rows.length > 0) {
      console.log(`\n发现 ${duplicates.rows.length} 个重复的订单序号:`)
      duplicates.rows.forEach(d => {
        console.log(`  - order_seq ${d.order_seq}: ${d.count} 条`)
      })
    } else {
      console.log('\n没有发现重复的订单序号')
    }

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

