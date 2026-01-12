/**
 * 清理已解决预警的执行脚本
 * 使用方法:
 *   - 本地: cd server && node scripts/run-cleanup-alerts.js
 *   - 生产: ssh aliyun-ecs "cd /var/www/prod/server && node scripts/run-cleanup-alerts.js"
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ 错误: 未找到 DATABASE_URL 环境变量')
  process.exit(1)
}

async function runCleanup() {
  console.log('🔧 开始清理已解决的预警记录...')
  console.log('=' .repeat(50))
  
  const isAliyunRDS = DATABASE_URL.includes('aliyuncs.com') || DATABASE_URL.includes('rds.aliyuncs')
  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  })
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // 1. 清理已收款发票的 "应收逾期" 预警
    console.log('\n📌 1. 清理已收款发票的"应收逾期"预警...')
    const result1 = await client.query(`
      UPDATE alert_logs 
      SET 
        status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '发票已收款，系统自动清理历史预警'
      WHERE 
        status = 'active' 
        AND alert_type = 'payment_due' 
        AND related_type = 'invoice'
        AND related_id IN (
          SELECT id::text FROM invoices WHERE status = 'paid'
        )
    `)
    console.log(`   ✅ 已清理 ${result1.rowCount} 条"应收逾期"预警`)
    
    // 2. 清理已收款发票的 "账期即将到期" 预警
    console.log('\n📌 2. 清理已收款发票的"账期即将到期"预警...')
    const result2 = await client.query(`
      UPDATE alert_logs 
      SET 
        status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '发票已收款，系统自动清理历史预警'
      WHERE 
        status = 'active' 
        AND alert_type = 'payment_term_due' 
        AND related_type = 'invoice'
        AND related_id IN (
          SELECT id::text FROM invoices WHERE status = 'paid'
        )
    `)
    console.log(`   ✅ 已清理 ${result2.rowCount} 条"账期即将到期"预警`)
    
    // 3. 清理已完成订单的 "订单超期" 预警
    console.log('\n📌 3. 清理已完成订单的"订单超期"预警...')
    const result3 = await client.query(`
      UPDATE alert_logs 
      SET 
        status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '订单已完成，系统自动清理历史预警'
      WHERE 
        status = 'active' 
        AND alert_type = 'order_overdue' 
        AND related_type = 'order'
        AND related_id IN (
          SELECT id::text FROM bills_of_lading WHERE status = 'completed'
        )
    `)
    console.log(`   ✅ 已清理 ${result3.rowCount} 条"订单超期"预警`)
    
    // 4. 清理客户已无逾期的 "客户多笔逾期" 预警
    console.log('\n📌 4. 清理客户逾期已减少的"客户多笔逾期"预警...')
    const result4 = await client.query(`
      UPDATE alert_logs 
      SET 
        status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '客户逾期发票已减少，系统自动清理历史预警'
      WHERE 
        status = 'active' 
        AND alert_type = 'customer_overdue' 
        AND related_type = 'customer'
        AND related_id IN (
          SELECT c.id::text
          FROM customers c
          LEFT JOIN invoices i ON i.customer_id = c.id 
            AND i.status = 'pending' 
            AND i.invoice_type = 'sales'
            AND i.due_date < CURRENT_DATE
          GROUP BY c.id
          HAVING COUNT(i.id) < 2
        )
    `)
    console.log(`   ✅ 已清理 ${result4.rowCount} 条"客户多笔逾期"预警`)
    
    // 5. 统计当前预警状态
    console.log('\n📊 预警统计汇总:')
    const stats = await client.query(`
      SELECT 
        alert_type,
        COUNT(*) FILTER (WHERE status = 'active') as still_active,
        COUNT(*) FILTER (WHERE status = 'handled') as handled,
        COUNT(*) FILTER (WHERE status = 'ignored') as ignored,
        COUNT(*) as total
      FROM alert_logs
      GROUP BY alert_type
      ORDER BY alert_type
    `)
    
    console.log('   ' + '-'.repeat(75))
    console.log('   | 预警类型               | 待处理 | 已处理 | 已忽略 | 总计 |')
    console.log('   ' + '-'.repeat(75))
    for (const row of stats.rows) {
      const type = row.alert_type.padEnd(22)
      console.log(`   | ${type} | ${String(row.still_active).padStart(6)} | ${String(row.handled).padStart(6)} | ${String(row.ignored).padStart(6)} | ${String(row.total).padStart(4)} |`)
    }
    console.log('   ' + '-'.repeat(75))
    
    await client.query('COMMIT')
    
    const totalCleaned = result1.rowCount + result2.rowCount + result3.rowCount + result4.rowCount
    console.log('\n' + '='.repeat(50))
    console.log(`✅ 清理完成！共处理 ${totalCleaned} 条历史预警`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ 清理失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runCleanup().catch(err => {
  console.error(err)
  process.exit(1)
})
