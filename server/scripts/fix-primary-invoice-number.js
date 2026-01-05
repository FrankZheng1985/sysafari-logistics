/**
 * 修复脚本：为已收款的订单补充主发票号
 * 
 * 问题：发票收款后，订单的 primary_invoice_number 字段没有被自动更新
 * 解决：查找所有已付清的销售发票，更新关联订单的主发票号
 * 
 * 运行方式：node server/scripts/fix-primary-invoice-number.js
 */

import { getDatabase } from '../config/database.js'

async function fixPrimaryInvoiceNumbers() {
  const db = getDatabase()
  
  console.log('========================================')
  console.log('开始修复订单主发票号...')
  console.log('========================================\n')
  
  // 1. 查找所有已付清的销售发票
  const paidInvoices = await db.prepare(`
    SELECT id, invoice_number, bill_id, customer_name, total_amount
    FROM invoices 
    WHERE invoice_type = 'sales' 
      AND status = 'paid'
      AND bill_id IS NOT NULL
      AND bill_id != ''
    ORDER BY created_at ASC
  `).all()
  
  console.log(`找到 ${paidInvoices.length} 张已付清的销售发票\n`)
  
  let fixedCount = 0
  let skippedCount = 0
  
  for (const invoice of paidInvoices) {
    // 处理多订单关联的情况
    const billIds = invoice.bill_id.split(',').map(id => id.trim()).filter(id => id)
    
    for (const billId of billIds) {
      // 检查订单是否已有主发票号
      const bill = await db.prepare(`
        SELECT id, order_number, bill_number, primary_invoice_number, payment_confirmed
        FROM bills_of_lading WHERE id = ?
      `).get(billId)
      
      if (!bill) {
        console.log(`⚠️  订单 ${billId} 不存在，跳过`)
        continue
      }
      
      if (bill.primary_invoice_number) {
        // console.log(`⏭️  订单 ${bill.order_number || bill.bill_number} 已有主发票号 ${bill.primary_invoice_number}，跳过`)
        skippedCount++
        continue
      }
      
      // 更新订单的主发票号
      await db.prepare(`
        UPDATE bills_of_lading 
        SET primary_invoice_number = ?, 
            payment_confirmed = 1,
            updated_at = NOW()
        WHERE id = ?
      `).run(invoice.invoice_number, billId)
      
      console.log(`✅ 订单 ${bill.order_number || bill.bill_number} 主发票号已设置为 ${invoice.invoice_number}`)
      fixedCount++
    }
  }
  
  console.log('\n========================================')
  console.log('修复完成!')
  console.log(`- 已修复: ${fixedCount} 个订单`)
  console.log(`- 已跳过: ${skippedCount} 个订单（已有主发票号）`)
  console.log('========================================')
}

// 运行修复
fixPrimaryInvoiceNumbers()
  .then(() => {
    console.log('\n脚本执行完毕')
    process.exit(0)
  })
  .catch(err => {
    console.error('修复失败:', err)
    process.exit(1)
  })

