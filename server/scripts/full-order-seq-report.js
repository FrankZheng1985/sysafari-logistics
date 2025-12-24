/**
 * 订单序号完整性报告
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
    console.log('\n' + '='.repeat(60))
    console.log('📋 订单序号完整性报告')
    console.log('='.repeat(60) + '\n')

    // 1. 基本统计
    console.log('【1】基本统计')
    console.log('-'.repeat(40))
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(order_seq) as orders_with_seq,
        MIN(order_seq) as min_seq,
        MAX(order_seq) as max_seq,
        COUNT(*) FILTER (WHERE is_void = 1) as void_orders
      FROM bills_of_lading
    `)
    
    const { total_orders, orders_with_seq, min_seq, max_seq, void_orders } = stats.rows[0]
    const expectedSeqs = parseInt(max_seq) - parseInt(min_seq) + 1
    const actualSeqs = parseInt(orders_with_seq)
    
    console.log(`  总订单数: ${total_orders}`)
    console.log(`  有效订单: ${parseInt(total_orders) - parseInt(void_orders)}`)
    console.log(`  作废订单: ${void_orders}`)
    console.log(`  序号范围: ${min_seq} ~ ${max_seq}`)
    console.log(`  理论序号数: ${expectedSeqs}`)
    console.log(`  实际使用数: ${actualSeqs}`)

    // 2. 检查重复的序号
    console.log('\n【2】重复序号检查')
    console.log('-'.repeat(40))
    const duplicates = await client.query(`
      SELECT order_seq, COUNT(*) as count
      FROM bills_of_lading
      WHERE order_seq IS NOT NULL
      GROUP BY order_seq
      HAVING COUNT(*) > 1
      ORDER BY order_seq
    `)

    if (duplicates.rows.length === 0) {
      console.log('  ✅ 没有重复的订单序号')
    } else {
      console.log(`  ⚠️ 发现 ${duplicates.rows.length} 个重复的序号:`)
      for (const d of duplicates.rows) {
        console.log(`\n  order_seq = ${d.order_seq} (BP25${String(d.order_seq).padStart(5, '0')}), 共 ${d.count} 条:`)
        const orders = await client.query(`
          SELECT id, bill_number, transport_method, customer_name, created_at
          FROM bills_of_lading
          WHERE order_seq = $1
        `, [d.order_seq])
        orders.rows.forEach(o => {
          console.log(`    - ${o.bill_number} | ${o.transport_method || '海运'} | ${o.customer_name}`)
        })
      }
    }

    // 3. 检查空缺的序号
    console.log('\n【3】空缺序号检查')
    console.log('-'.repeat(40))
    const allSeqs = await client.query(`
      SELECT order_seq FROM bills_of_lading WHERE order_seq IS NOT NULL ORDER BY order_seq
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
      console.log(`  对应订单号: ${missingSeqs.map(s => `BP25${String(s).padStart(5, '0')}`).join(', ')}`)
    }

    // 4. 序列号表状态
    console.log('\n【4】序列号表状态')
    console.log('-'.repeat(40))
    const seqStatus = await client.query(`SELECT * FROM order_sequences WHERE business_type = 'BILL'`)
    const seq = seqStatus.rows[0]
    console.log(`  当前序号: ${seq.current_seq}`)
    console.log(`  最后更新: ${seq.updated_at}`)
    
    // 检查是否同步
    if (parseInt(seq.current_seq) < parseInt(max_seq)) {
      console.log(`  ⚠️ 序列号(${seq.current_seq})小于数据库最大值(${max_seq})，需要同步`)
    } else if (parseInt(seq.current_seq) > parseInt(max_seq)) {
      console.log(`  ⚠️ 序列号(${seq.current_seq})大于数据库最大值(${max_seq})，可能有被删除的订单`)
    } else {
      console.log(`  ✅ 序列号与数据库同步`)
    }

    // 5. 检查无序号订单
    console.log('\n【5】无序号订单检查')
    console.log('-'.repeat(40))
    const noSeqCount = await client.query(`
      SELECT COUNT(*) as count FROM bills_of_lading 
      WHERE order_seq IS NULL AND (is_void = 0 OR is_void IS NULL)
    `)
    
    if (parseInt(noSeqCount.rows[0].count) === 0) {
      console.log('  ✅ 所有有效订单都有序号')
    } else {
      console.log(`  ⚠️ 有 ${noSeqCount.rows[0].count} 条订单没有序号`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('📋 报告完成')
    console.log('='.repeat(60) + '\n')

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(console.error)

