/**
 * 检查空缺序号的详细情况
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
    console.log('📋 检查空缺序号 528-533 详情')
    console.log('========================================\n')

    // 检查这些序号是否存在于已作废的订单中
    const voidOrders = await client.query(`
      SELECT order_seq, bill_number, container_number, customer_name, is_void, status
      FROM bills_of_lading
      WHERE order_seq BETWEEN 528 AND 533
      ORDER BY order_seq
    `)

    if (voidOrders.rows.length > 0) {
      console.log('找到这些序号的订单:')
      voidOrders.rows.forEach(o => {
        const status = o.is_void === 1 ? '已作废' : '有效'
        console.log(`  ${o.order_seq}: ${o.bill_number} | ${o.customer_name} | ${status}`)
      })
    } else {
      console.log('这些序号没有对应的订单记录')
    }

    // 查看序号表的当前状态
    console.log('\n📊 序列号表状态:')
    const seqStatus = await client.query(`
      SELECT * FROM order_sequences WHERE business_type = 'BILL'
    `)
    console.log(seqStatus.rows[0])

    // 检查 527 和 534 附近的订单
    console.log('\n📋 527-534 附近的订单:')
    const nearbyOrders = await client.query(`
      SELECT order_seq, bill_number, container_number, customer_name, transport_method, created_at
      FROM bills_of_lading
      WHERE order_seq BETWEEN 525 AND 540
      ORDER BY order_seq
    `)
    
    nearbyOrders.rows.forEach(o => {
      const mark = (o.order_seq >= 528 && o.order_seq <= 533) ? '❌' : '✅'
      console.log(`  ${mark} ${o.order_seq}: ${o.bill_number} | ${o.transport_method || '海运'} | ${o.customer_name}`)
    })

    // 检查是否有被删除的订单记录（如果有审计日志的话）
    console.log('\n🔍 检查删除记录...')
    try {
      const deletedLogs = await client.query(`
        SELECT * FROM audit_logs 
        WHERE table_name = 'bills_of_lading' 
          AND action = 'DELETE'
        ORDER BY created_at DESC
        LIMIT 10
      `)
      if (deletedLogs.rows.length > 0) {
        console.log('最近的删除记录:')
        deletedLogs.rows.forEach(log => {
          console.log(`  ${log.created_at}: ${log.old_values}`)
        })
      }
    } catch (e) {
      console.log('  (没有审计日志表)')
    }

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

