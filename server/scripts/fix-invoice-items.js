/**
 * 修复发票 INV20250000003 的费用明细
 */
import { getDatabase } from '../config/database.js'

async function fixInvoiceItems() {
  const db = getDatabase()
  
  try {
    // 获取发票信息
    const invoice = await db.prepare("SELECT * FROM invoices WHERE invoice_number = 'INV20250000003'").get()
    
    if (!invoice) {
      console.log('发票不存在')
      return
    }
    
    console.log('发票ID:', invoice.id)
    console.log('当前 items:', invoice.items)
    
    // 获取关联账单的费用记录
    const fees = await db.prepare('SELECT * FROM fees WHERE bill_id = $1').all(invoice.bill_id)
    console.log('\n找到费用记录:', fees.length, '条')
    
    if (fees.length === 0) {
      console.log('没有关联的费用记录')
      return
    }
    
    // 汇总费用（按费用名称分组）
    const summary = {}
    fees.forEach(fee => {
      const key = fee.fee_name || 'Other'
      if (!summary[key]) {
        summary[key] = {
          description: key,
          descriptionEn: fee.fee_name_en || null,
          quantity: 0,
          totalAmount: 0
        }
      }
      summary[key].quantity += 1
      summary[key].totalAmount += parseFloat(fee.amount) || 0
    })
    
    // 转换为 items 格式
    const items = Object.values(summary).map(item => ({
      description: item.description,
      descriptionEn: item.descriptionEn,
      quantity: item.quantity,
      unitValue: item.quantity > 0 ? item.totalAmount / item.quantity : 0,
      amount: item.totalAmount
    }))
    
    console.log('\n生成的 items:')
    console.log(JSON.stringify(items, null, 2))
    
    // 获取费用 IDs
    const feeIds = fees.map(f => f.id)
    
    // 更新发票
    await db.prepare(`
      UPDATE invoices 
      SET items = $1, fee_ids = $2 
      WHERE id = $3
    `).run(JSON.stringify(items), JSON.stringify(feeIds), invoice.id)
    
    console.log('\n✅ 发票 INV20250000003 已更新')
    
    // 验证更新
    const updated = await db.prepare("SELECT items, fee_ids FROM invoices WHERE invoice_number = 'INV20250000003'").get()
    console.log('\n更新后的 items:', updated.items)
    
  } catch (error) {
    console.error('错误:', error)
  }
  
  process.exit(0)
}

fixInvoiceItems()

