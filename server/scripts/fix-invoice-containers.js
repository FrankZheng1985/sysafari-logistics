/**
 * 修复所有发票的集装箱号和提单号数据
 */
import { getDatabase } from '../config/database.js'

async function fixInvoiceContainers() {
  const db = getDatabase()
  
  // 获取客户的所有发票
  const invoices = await db.prepare(`
    SELECT id, invoice_number, bill_id, fee_ids, container_numbers
    FROM invoices 
    WHERE customer_id = '00fd24b6-1520-480e-acd3-4df5a38c34be'
  `).all()
  
  console.log('找到', invoices.length, '条发票')
  
  for (const invoice of invoices) {
    console.log('\n处理发票:', invoice.invoice_number)
    
    let billIds = []
    let feeIds = []
    
    // 解析 bill_id（可能是逗号分隔的多个ID）
    if (invoice.bill_id) {
      billIds = invoice.bill_id.split(',').map(id => id.trim()).filter(Boolean)
    }
    
    // 解析 fee_ids
    if (invoice.fee_ids) {
      try {
        feeIds = JSON.parse(invoice.fee_ids)
      } catch {}
    }
    
    console.log('  bill_ids:', billIds)
    console.log('  fee_ids:', feeIds.length, '条')
    
    // 收集所有相关的柜号和提单号
    const containerNumbers = new Set()
    const billNumbers = new Set()
    
    // 1. 从 bills_of_lading 表获取柜号
    if (billIds.length > 0) {
      for (const billId of billIds) {
        const bill = await db.prepare(`
          SELECT bill_number, container_number 
          FROM bills_of_lading 
          WHERE id = $1
        `).get(billId)
        
        if (bill) {
          if (bill.bill_number) billNumbers.add(bill.bill_number)
          if (bill.container_number) containerNumbers.add(bill.container_number)
        }
      }
    }
    
    // 2. 从费用记录获取提单号
    if (feeIds.length > 0) {
      const placeholders = feeIds.map((_, i) => `$${i + 1}`).join(',')
      const fees = await db.prepare(`
        SELECT DISTINCT bill_number, bill_id 
        FROM fees 
        WHERE id IN (${placeholders})
      `).all(...feeIds)
      
      for (const fee of fees) {
        if (fee.bill_number) billNumbers.add(fee.bill_number)
        
        // 从费用关联的提单获取柜号
        if (fee.bill_id) {
          const bill = await db.prepare(`
            SELECT container_number FROM bills_of_lading WHERE id = $1
          `).get(fee.bill_id)
          if (bill?.container_number) containerNumbers.add(bill.container_number)
        }
      }
    }
    
    const containerArr = Array.from(containerNumbers)
    const billNumberArr = Array.from(billNumbers)
    
    console.log('  找到柜号:', containerArr)
    console.log('  找到提单号:', billNumberArr)
    
    // 更新发票
    // 取第一个 bill_id 作为主关联
    const primaryBillId = billIds[0] || null
    
    await db.prepare(`
      UPDATE invoices 
      SET container_numbers = $1,
          bill_id = $2
      WHERE id = $3
    `).run(
      JSON.stringify(containerArr),
      primaryBillId,
      invoice.id
    )
    
    console.log('  ✅ 已更新')
  }
  
  console.log('\n\n=== 更新完成，验证结果 ===')
  const updated = await db.prepare(`
    SELECT 
      i.invoice_number, 
      i.container_numbers,
      b.bill_number,
      b.container_number
    FROM invoices i
    LEFT JOIN bills_of_lading b ON i.bill_id = b.id
    WHERE i.customer_id = '00fd24b6-1520-480e-acd3-4df5a38c34be'
    ORDER BY i.invoice_number
  `).all()
  
  updated.forEach(inv => {
    console.log(inv.invoice_number, '柜号:', inv.container_numbers, '提单:', inv.bill_number)
  })
  
  process.exit(0)
}

fixInvoiceContainers().catch(err => {
  console.error(err)
  process.exit(1)
})

