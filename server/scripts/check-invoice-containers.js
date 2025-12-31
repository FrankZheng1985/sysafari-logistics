/**
 * 检查发票的集装箱号数据
 */
import { getDatabase } from '../config/database.js'

async function checkInvoiceContainers() {
  const db = getDatabase()
  
  console.log('\n=== 所有发票的柜号/提单信息 ===')
  const invoices = await db.prepare(`
    SELECT 
      i.invoice_number, 
      i.container_numbers,
      i.bill_id,
      b.bill_number,
      b.container_number as bl_container
    FROM invoices i
    LEFT JOIN bills_of_lading b ON i.bill_id = b.id
    WHERE i.customer_id = '00fd24b6-1520-480e-acd3-4df5a38c34be'
    ORDER BY i.invoice_number
  `).all()
  
  invoices.forEach(inv => {
    console.log('\n发票:', inv.invoice_number)
    console.log('  container_numbers:', inv.container_numbers)
    console.log('  bill_id:', inv.bill_id)
    console.log('  提单号:', inv.bill_number)
    console.log('  提单柜号:', inv.bl_container)
  })

  // 检查费用表中的柜号
  console.log('\n\n=== 从费用表查询柜号 ===')
  for (const inv of invoices) {
    if (inv.bill_id) {
      const fees = await db.prepare('SELECT DISTINCT container_number, bill_number FROM fees WHERE bill_id = $1').all(inv.bill_id)
      console.log(inv.invoice_number, '关联费用柜号:', fees)
    }
  }

  process.exit(0)
}

checkInvoiceContainers().catch(err => {
  console.error(err)
  process.exit(1)
})

