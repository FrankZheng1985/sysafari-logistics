/**
 * 检查所有重复订单号
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
    console.log('📋 检查所有重复订单序号')
    console.log('========================================\n')

    // 查询所有重复订单序号的订单
    const orders = await client.query(`
      SELECT 
        id, 
        bill_number, 
        container_number, 
        order_seq,
        transport_method,
        customer_name,
        port_of_loading,
        port_of_discharge,
        created_at
      FROM bills_of_lading
      WHERE order_seq IN (535, 536, 537, 538)
      ORDER BY order_seq, created_at
    `)
    
    let currentSeq = null
    orders.rows.forEach((o, i) => {
      if (o.order_seq !== currentSeq) {
        currentSeq = o.order_seq
        console.log(`\n📦 order_seq = ${currentSeq} (订单号: BP25${String(currentSeq).padStart(5, '0')})`)
        console.log('-'.repeat(60))
      }
      
      const orderNum = `BP25${String(o.order_seq).padStart(5, '0')}`
      console.log(`  ${i + 1}. ID: ${o.id}`)
      console.log(`     提单号: ${o.bill_number}`)
      console.log(`     集装箱号: ${o.container_number}`)
      console.log(`     运输方式: ${o.transport_method || '海运'}`)
      console.log(`     客户: ${o.customer_name}`)
      console.log(`     航线: ${o.port_of_loading} → ${o.port_of_discharge}`)
      console.log(`     创建时间: ${o.created_at || '未知'}`)
    })

    // 获取当前最大序号
    const maxSeq = await client.query(`SELECT MAX(order_seq) as max_seq FROM bills_of_lading`)
    console.log(`\n\n当前最大 order_seq: ${maxSeq.rows[0].max_seq}`)
    
    // 计算新序号
    const nextSeq = parseInt(maxSeq.rows[0].max_seq) + 1
    console.log(`建议为铁路订单分配新序号: ${nextSeq}, ${nextSeq + 1}, ${nextSeq + 2}, ${nextSeq + 3}`)

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

