/**
 * 修复重复订单序号
 * 已获得用户授权
 */

import dotenv from 'dotenv'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

// 需要更新序号的订单
const ORDERS_TO_UPDATE = [
  { bill_number: 'WAE2025112600084', old_seq: 535, new_seq: 547 },
  { bill_number: 'WAE2025120200043', old_seq: 536, new_seq: 548 },
  { bill_number: 'WAE2025120300144', old_seq: 537, new_seq: 549 },
  { bill_number: '010501258939', old_seq: 538, new_seq: 550 },
]

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL_PROD
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  const client = await pool.connect()

  try {
    console.log('\n========================================')
    console.log('🔧 修复重复订单序号')
    console.log('========================================\n')

    await client.query('BEGIN')
    console.log('📦 事务已开始\n')

    for (const order of ORDERS_TO_UPDATE) {
      console.log(`🔄 更新订单: ${order.bill_number}`)
      console.log(`   ${order.old_seq} → ${order.new_seq}`)
      
      const result = await client.query(`
        UPDATE bills_of_lading
        SET order_seq = $1, updated_at = NOW()
        WHERE bill_number = $2
      `, [order.new_seq, order.bill_number])
      
      if (result.rowCount > 0) {
        console.log(`   ✅ 更新成功`)
      } else {
        console.log(`   ⚠️ 未找到订单`)
      }
    }

    await client.query('COMMIT')
    console.log('\n✅ 事务已提交')

    // 验证结果
    console.log('\n========================================')
    console.log('📋 验证结果')
    console.log('========================================\n')

    // 检查是否还有重复
    const duplicates = await client.query(`
      SELECT order_seq, COUNT(*) as count
      FROM bills_of_lading
      WHERE order_seq IS NOT NULL
      GROUP BY order_seq
      HAVING COUNT(*) > 1
    `)

    if (duplicates.rows.length === 0) {
      console.log('✅ 没有重复的订单序号了')
    } else {
      console.log('⚠️ 仍有重复的订单序号:')
      duplicates.rows.forEach(d => {
        console.log(`  - order_seq ${d.order_seq}: ${d.count} 条`)
      })
    }

    // 显示更新后的订单
    console.log('\n更新后的订单:')
    const updatedOrders = await client.query(`
      SELECT bill_number, order_seq, transport_method
      FROM bills_of_lading
      WHERE bill_number IN ('WAE2025112600084', 'WAE2025120200043', 'WAE2025120300144', '010501258939',
                            '010501331342', '010501321495', '010501318460', '149509272452')
      ORDER BY order_seq
    `)

    updatedOrders.rows.forEach(o => {
      const orderNum = `BP25${String(o.order_seq).padStart(5, '0')}`
      console.log(`  ${orderNum}: ${o.bill_number} (${o.transport_method || '海运'})`)
    })

    console.log('\n========================================')
    console.log('🎉 修复完成！')
    console.log('========================================\n')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ 发生错误，已回滚:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

