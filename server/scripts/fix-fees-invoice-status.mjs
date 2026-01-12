/**
 * 修复费用的开票状态
 * 将关联到已删除发票的费用状态重置为 'not_invoiced'
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

if (!DATABASE_URL) {
  console.error('❌ 未配置 DATABASE_URL')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function fixFeesInvoiceStatus() {
  const client = await pool.connect()
  
  try {
    console.log('=== 修复费用开票状态 ===\n')
    
    // 1. 找出所有关联到已删除发票的费用
    const result = await client.query(`
      SELECT f.id, f.fee_name, f.amount, f.invoice_status, f.invoice_number,
             b.container_number, i.is_deleted as invoice_deleted
      FROM fees f
      LEFT JOIN bills_of_lading b ON f.bill_id = b.id
      LEFT JOIN invoices i ON f.invoice_number = i.invoice_number
      WHERE f.invoice_status = 'invoiced'
        AND (i.is_deleted = true OR i.id IS NULL)
    `)
    
    console.log(`找到 ${result.rows.length} 条需要修复的费用:\n`)
    
    for (const row of result.rows) {
      console.log(`  ${row.container_number} | ${row.fee_name} | €${row.amount} | ${row.invoice_number}`)
    }
    
    if (result.rows.length === 0) {
      console.log('\n✅ 没有需要修复的费用')
      return
    }
    
    // 2. 重置这些费用的状态
    const feeIds = result.rows.map(r => r.id)
    
    await client.query(`
      UPDATE fees 
      SET invoice_status = 'not_invoiced',
          invoice_number = NULL,
          invoice_date = NULL,
          updated_at = NOW()
      WHERE id = ANY($1)
    `, [feeIds])
    
    console.log(`\n✅ 已重置 ${feeIds.length} 条费用的开票状态`)
    
  } finally {
    client.release()
    await pool.end()
  }
}

fixFeesInvoiceStatus().catch(console.error)
