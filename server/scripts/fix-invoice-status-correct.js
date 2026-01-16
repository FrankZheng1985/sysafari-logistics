/**
 * 正确修复费用的开票状态
 * 核心逻辑：只要费用ID出现在发票的 fee_ids 中，就标记为完全开票
 * 已开票金额 = 费用的系统金额（不是发票明细中的金额）
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const isProduction = process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL || 
  (isProduction ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_TEST)

if (!DATABASE_URL) {
  console.error('❌ 未配置 DATABASE_URL')
  process.exit(1)
}

const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')

const pool = new pg.Pool({ 
  connectionString: DATABASE_URL,
  ssl: isLocalhost ? false : { rejectUnauthorized: false }
})

async function fixInvoiceStatusCorrect() {
  const client = await pool.connect()
  
  try {
    console.log('=' .repeat(70))
    console.log('🔧 正确修复费用的开票状态')
    console.log('=' .repeat(70))
    console.log('\n核心逻辑：只要费用ID出现在发票的 fee_ids 中，就标记为完全开票')
    console.log('已开票金额 = 费用的系统金额\n')
    
    // 1. 先重置所有费用的开票状态
    console.log('📌 步骤 1: 重置所有费用的开票状态...')
    const resetResult = await client.query(`
      UPDATE fees 
      SET invoiced_amount = 0,
          invoice_status = 'not_invoiced',
          invoice_number = NULL,
          invoice_date = NULL
      WHERE 1=1
    `)
    console.log(`   重置了 ${resetResult.rowCount} 条费用记录`)
    
    // 2. 查询所有未删除的发票
    console.log('\n📌 步骤 2: 查询所有有效发票...')
    const invoicesResult = await client.query(`
      SELECT 
        id,
        invoice_number,
        invoice_type,
        invoice_date,
        fee_ids,
        items
      FROM invoices 
      WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      ORDER BY invoice_date ASC, created_at ASC
    `)
    console.log(`   找到 ${invoicesResult.rows.length} 张有效发票`)
    
    // 3. 收集所有出现在发票中的费用ID
    const invoicedFeeIds = new Map() // feeId -> { invoiceNumber, invoiceDate }
    
    for (const invoice of invoicesResult.rows) {
      const invoiceNumber = invoice.invoice_number
      const invoiceDate = invoice.invoice_date
      
      // 从 fee_ids 字段获取费用ID
      let feeIds = []
      try {
        feeIds = JSON.parse(invoice.fee_ids || '[]')
      } catch (e) {
        // ignore
      }
      
      // 从 items 字段获取费用ID（作为补充）
      let items = []
      try {
        items = JSON.parse(invoice.items || '[]')
      } catch (e) {
        // ignore
      }
      
      // 收集 fee_ids 中的费用
      for (const feeId of feeIds) {
        if (feeId && !invoicedFeeIds.has(feeId)) {
          invoicedFeeIds.set(feeId, { invoiceNumber, invoiceDate })
        }
      }
      
      // 收集 items 中的费用ID
      for (const item of items) {
        if (item.feeId) {
          const ids = item.feeId.split(',').map(id => id.trim()).filter(id => id)
          for (const feeId of ids) {
            if (!invoicedFeeIds.has(feeId)) {
              invoicedFeeIds.set(feeId, { invoiceNumber, invoiceDate })
            }
          }
        }
      }
    }
    
    console.log(`\n📌 步骤 3: 更新 ${invoicedFeeIds.size} 条已开票费用的状态...`)
    
    // 4. 更新费用记录 - 使用系统金额作为已开票金额
    let updatedCount = 0
    let notFoundCount = 0
    
    for (const [feeId, info] of invoicedFeeIds) {
      // 获取费用的系统金额
      const feeResult = await client.query(
        'SELECT amount FROM fees WHERE id = $1',
        [feeId]
      )
      
      if (feeResult.rows.length === 0) {
        notFoundCount++
        continue
      }
      
      const feeAmount = parseFloat(feeResult.rows[0].amount) || 0
      
      // 更新费用状态 - 已开票金额 = 系统金额（完全开票）
      await client.query(`
        UPDATE fees 
        SET invoiced_amount = $1,
            invoice_status = 'invoiced',
            invoice_number = $2,
            invoice_date = $3,
            updated_at = NOW()
        WHERE id = $4
      `, [feeAmount, info.invoiceNumber, info.invoiceDate, feeId])
      
      updatedCount++
    }
    
    console.log(`   ✅ 更新了 ${updatedCount} 条费用记录（标记为完全开票）`)
    if (notFoundCount > 0) {
      console.log(`   ⚠️ ${notFoundCount} 条费用ID未找到对应记录`)
    }
    
    // 5. 验证结果
    console.log('\n📊 费用开票状态统计:')
    console.log('-'.repeat(70))
    const stats = await client.query(`
      SELECT 
        invoice_status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(invoiced_amount) as total_invoiced_amount
      FROM fees 
      GROUP BY invoice_status
      ORDER BY invoice_status
    `)
    console.log('状态\t\t\t数量\t费用总额\t\t已开票金额')
    console.log('-'.repeat(70))
    stats.rows.forEach(row => {
      const status = (row.invoice_status || 'null').padEnd(16)
      console.log(`${status}\t${row.count}\t${parseFloat(row.total_amount || 0).toFixed(2)}\t\t${parseFloat(row.total_invoiced_amount || 0).toFixed(2)}`)
    })
    
    // 6. 验证 FBIU7912148 的费用状态
    console.log('\n📋 验证 FBIU7912148 的应收费用状态:')
    console.log('-'.repeat(70))
    const fbiu = await client.query(`
      SELECT 
        f.fee_name,
        f.amount,
        f.invoiced_amount,
        f.invoice_status,
        f.invoice_number
      FROM fees f
      JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE b.container_number = 'FBIU7912148'
        AND f.fee_type = 'receivable'
      ORDER BY f.fee_name
    `)
    console.log('费用名称\t\t系统金额\t已开票金额\t状态\t\t发票号')
    console.log('-'.repeat(70))
    fbiu.rows.forEach(row => {
      const name = (row.fee_name || '').substring(0, 12).padEnd(12)
      const amount = parseFloat(row.amount || 0).toFixed(2).padStart(10)
      const invoiced = parseFloat(row.invoiced_amount || 0).toFixed(2).padStart(10)
      const status = (row.invoice_status || '-').padEnd(16)
      const invNum = row.invoice_number || '-'
      console.log(`${name}\t${amount}\t${invoiced}\t${status}\t${invNum}`)
    })
    
    console.log('\n✅ 修复完成！')
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixInvoiceStatusCorrect().catch(err => {
  console.error(err)
  process.exit(1)
})
