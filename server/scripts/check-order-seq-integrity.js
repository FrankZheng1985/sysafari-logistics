/**
 * 检查订单序号完整性
 * 1. 检查是否有重复的序号
 * 2. 检查是否有空缺的序号
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
    console.log('📋 订单序号完整性检查')
    console.log('========================================\n')

    // 1. 基本统计
    console.log('📊 基本统计:')
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(order_seq) as orders_with_seq,
        MIN(order_seq) as min_seq,
        MAX(order_seq) as max_seq
      FROM bills_of_lading
      WHERE is_void = 0 OR is_void IS NULL
    `)
    
    const { total_orders, orders_with_seq, min_seq, max_seq } = stats.rows[0]
    console.log(`  总订单数: ${total_orders}`)
    console.log(`  有序号的订单: ${orders_with_seq}`)
    console.log(`  序号范围: ${min_seq} ~ ${max_seq}`)
    console.log(`  理论应有序号数: ${max_seq - min_seq + 1}`)

    // 2. 检查重复的序号
    console.log('\n🔍 检查重复序号:')
    const duplicates = await client.query(`
      SELECT order_seq, COUNT(*) as count
      FROM bills_of_lading
      WHERE order_seq IS NOT NULL AND (is_void = 0 OR is_void IS NULL)
      GROUP BY order_seq
      HAVING COUNT(*) > 1
      ORDER BY order_seq
    `)

    if (duplicates.rows.length === 0) {
      console.log('  ✅ 没有重复的订单序号')
    } else {
      console.log(`  ⚠️ 发现 ${duplicates.rows.length} 个重复的序号:`)
      for (const d of duplicates.rows) {
        console.log(`\n  order_seq = ${d.order_seq} (${d.count}条):`)
        const orders = await client.query(`
          SELECT id, bill_number, transport_method, customer_name, created_at
          FROM bills_of_lading
          WHERE order_seq = $1 AND (is_void = 0 OR is_void IS NULL)
        `, [d.order_seq])
        orders.rows.forEach(o => {
          console.log(`    - ${o.bill_number} | ${o.transport_method || '海运'} | ${o.customer_name}`)
        })
      }
    }

    // 3. 检查空缺的序号
    console.log('\n🔍 检查空缺序号:')
    const allSeqs = await client.query(`
      SELECT order_seq
      FROM bills_of_lading
      WHERE order_seq IS NOT NULL AND (is_void = 0 OR is_void IS NULL)
      ORDER BY order_seq
    `)

    const seqSet = new Set(allSeqs.rows.map(r => r.order_seq))
    const minSeq = parseInt(min_seq)
    const maxSeq = parseInt(max_seq)
    const missingSeqs = []

    for (let i = minSeq; i <= maxSeq; i++) {
      if (!seqSet.has(i)) {
        missingSeqs.push(i)
      }
    }

    if (missingSeqs.length === 0) {
      console.log('  ✅ 没有空缺的序号')
    } else {
      console.log(`  ⚠️ 发现 ${missingSeqs.length} 个空缺的序号:`)
      
      // 分组显示连续的空缺
      let ranges = []
      let start = missingSeqs[0]
      let end = missingSeqs[0]
      
      for (let i = 1; i < missingSeqs.length; i++) {
        if (missingSeqs[i] === end + 1) {
          end = missingSeqs[i]
        } else {
          ranges.push(start === end ? `${start}` : `${start}-${end}`)
          start = missingSeqs[i]
          end = missingSeqs[i]
        }
      }
      ranges.push(start === end ? `${start}` : `${start}-${end}`)
      
      console.log(`  空缺序号: ${ranges.join(', ')}`)
      
      // 检查这些序号是否被作废的订单使用
      if (missingSeqs.length <= 20) {
        const voidOrders = await client.query(`
          SELECT order_seq, bill_number, is_void
          FROM bills_of_lading
          WHERE order_seq = ANY($1)
        `, [missingSeqs])
        
        if (voidOrders.rows.length > 0) {
          console.log('\n  这些序号的订单状态:')
          voidOrders.rows.forEach(o => {
            const status = o.is_void ? '已作废' : '有效'
            console.log(`    - ${o.order_seq}: ${o.bill_number} (${status})`)
          })
        }
      }
    }

    // 4. 检查没有序号的订单
    console.log('\n🔍 检查无序号订单:')
    const noSeqOrders = await client.query(`
      SELECT id, bill_number, transport_method, customer_name, created_at
      FROM bills_of_lading
      WHERE order_seq IS NULL AND (is_void = 0 OR is_void IS NULL)
      ORDER BY created_at DESC
      LIMIT 10
    `)

    if (noSeqOrders.rows.length === 0) {
      console.log('  ✅ 所有有效订单都有序号')
    } else {
      const countResult = await client.query(`
        SELECT COUNT(*) as count FROM bills_of_lading 
        WHERE order_seq IS NULL AND (is_void = 0 OR is_void IS NULL)
      `)
      console.log(`  ⚠️ 发现 ${countResult.rows[0].count} 条无序号订单 (显示前10条):`)
      noSeqOrders.rows.forEach(o => {
        console.log(`    - ${o.bill_number} | ${o.transport_method || '海运'} | ${o.customer_name}`)
      })
    }

    console.log('\n========================================')
    console.log('✅ 检查完成')
    console.log('========================================\n')

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

