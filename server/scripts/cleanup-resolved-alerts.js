/**
 * 清理已解决的历史预警
 * 检查所有已付清发票和已完成订单，自动消除其相关预警
 * 
 * 运行方式: node scripts/cleanup-resolved-alerts.js
 */

import { getDatabase } from '../config/database.js'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

async function cleanupResolvedAlerts() {
  console.log('🔄 开始清理已解决的历史预警...\n')
  
  // 等待数据库连接就绪
  await new Promise(resolve => setTimeout(resolve, 1000))
  const db = getDatabase()
  let totalCleaned = 0
  
  // 1. 清理已付清发票的预警（账期即将到期、应收逾期）
  console.log('📋 检查已付清发票的预警...')
  const paidInvoiceAlerts = await db.prepare(`
    UPDATE alert_logs 
    SET status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '发票已付清，系统自动清理历史预警'
    WHERE status = 'active'
      AND related_type = 'invoice'
      AND alert_type IN ('payment_term_due', 'payment_due')
      AND related_id IN (
        SELECT id::text FROM invoices WHERE status = 'paid'
      )
  `).run()
  
  console.log(`   ✅ 已清理 ${paidInvoiceAlerts.changes} 条发票相关预警`)
  totalCleaned += paidInvoiceAlerts.changes
  
  // 2. 清理已完成订单的预警（订单超期）
  console.log('📋 检查已完成订单的预警...')
  const completedOrderAlerts = await db.prepare(`
    UPDATE alert_logs 
    SET status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '订单已完成，系统自动清理历史预警'
    WHERE status = 'active'
      AND related_type = 'order'
      AND alert_type = 'order_overdue'
      AND related_id IN (
        SELECT id::text FROM bills_of_lading WHERE status IN ('已完成', '已归档')
      )
  `).run()
  
  console.log(`   ✅ 已清理 ${completedOrderAlerts.changes} 条订单相关预警`)
  totalCleaned += completedOrderAlerts.changes
  
  // 3. 清理客户多笔逾期预警（检查客户是否还有多笔逾期）
  console.log('📋 检查客户多笔逾期预警...')
  const customerOverdueAlerts = await db.prepare(`
    UPDATE alert_logs 
    SET status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '客户逾期发票已减少，系统自动清理历史预警'
    WHERE status = 'active'
      AND related_type = 'customer'
      AND alert_type = 'customer_overdue'
      AND related_id NOT IN (
        SELECT customer_id::text 
        FROM invoices 
        WHERE status = 'pending' 
          AND invoice_type = 'sales' 
          AND due_date < CURRENT_DATE
        GROUP BY customer_id
        HAVING COUNT(*) >= 2
      )
  `).run()
  
  console.log(`   ✅ 已清理 ${customerOverdueAlerts.changes} 条客户多笔逾期预警`)
  totalCleaned += customerOverdueAlerts.changes
  
  // 4. 清理信用超限预警（检查客户是否还超限）
  console.log('📋 检查信用超限预警...')
  const creditLimitAlerts = await db.prepare(`
    UPDATE alert_logs 
    SET status = 'handled', 
        handled_by = '系统自动清理', 
        handled_at = NOW(), 
        handle_remark = '客户信用已恢复，系统自动清理历史预警'
    WHERE status = 'active'
      AND related_type = 'customer'
      AND alert_type = 'credit_limit'
      AND related_id NOT IN (
        SELECT c.id::text
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id AND i.status = 'pending' AND i.invoice_type = 'sales'
        WHERE c.credit_limit > 0
        GROUP BY c.id, c.credit_limit
        HAVING COALESCE(SUM(i.total_amount - i.paid_amount), 0) > c.credit_limit
      )
  `).run()
  
  console.log(`   ✅ 已清理 ${creditLimitAlerts.changes} 条信用超限预警`)
  totalCleaned += creditLimitAlerts.changes
  
  console.log(`\n✅ 清理完成！共清理 ${totalCleaned} 条历史预警`)
  
  // 显示当前预警统计
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'active') as active_count,
      COUNT(*) FILTER (WHERE status = 'handled') as handled_count,
      COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count
    FROM alert_logs
  `).get()
  
  console.log('\n📊 当前预警统计:')
  console.log(`   待处理: ${stats.active_count}`)
  console.log(`   已处理: ${stats.handled_count}`)
  console.log(`   已忽略: ${stats.ignored_count}`)
  
  return totalCleaned
}

// 主函数
async function main() {
  try {
    await cleanupResolvedAlerts()
    process.exit(0)
  } catch (error) {
    console.error('❌ 清理失败:', error)
    process.exit(1)
  }
}

main()
