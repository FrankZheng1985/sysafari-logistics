/**
 * 修复费用的 invoiced_amount 字段
 * 从现有发票记录中反算每个费用的已开票金额
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

async function fixInvoicedAmounts() {
  const client = await pool.connect()
  
  try {
    console.log('=' .repeat(70))
    console.log('🔧 修复费用的 invoiced_amount 字段（从发票记录反算）')
    console.log('=' .repeat(70))
    
    // 1. 先重置所有费用的 invoiced_amount 和 invoice_status
    console.log('\n📌 步骤 1: 重置所有费用的开票状态...')
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
        items,
        total_amount
      FROM invoices 
      WHERE (is_deleted IS NULL OR is_deleted = FALSE)
      ORDER BY invoice_date ASC, created_at ASC
    `)
    console.log(`   找到 ${invoicesResult.rows.length} 张有效发票`)
    
    // 3. 构建费用ID到开票金额的映射
    const feeInvoiceMap = new Map() // feeId -> { totalAmount, invoiceNumbers, invoiceDate }
    
    for (const invoice of invoicesResult.rows) {
      const invoiceNumber = invoice.invoice_number
      const invoiceDate = invoice.invoice_date
      
      // 解析 items 获取每个费用的金额
      let items = []
      try {
        items = JSON.parse(invoice.items || '[]')
      } catch (e) {
        console.warn(`   ⚠️ 发票 ${invoiceNumber} 的 items 解析失败`)
        continue
      }
      
      // 解析 fee_ids 作为备选
      let feeIds = []
      try {
        feeIds = JSON.parse(invoice.fee_ids || '[]')
      } catch (e) {
        // ignore
      }
      
      // 遍历 items，提取费用ID和金额
      for (const item of items) {
        if (item.feeId) {
          // feeId 可能是逗号分隔的多个ID
          const ids = item.feeId.split(',').map(id => id.trim()).filter(id => id)
          const itemAmount = parseFloat(item.finalAmount) || 
                            (parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 1))
          
          if (ids.length === 1) {
            // 单个费用
            const feeId = ids[0]
            if (!feeInvoiceMap.has(feeId)) {
              feeInvoiceMap.set(feeId, { totalAmount: 0, invoiceNumbers: [], invoiceDate: null })
            }
            const entry = feeInvoiceMap.get(feeId)
            entry.totalAmount += itemAmount
            if (!entry.invoiceNumbers.includes(invoiceNumber)) {
              entry.invoiceNumbers.push(invoiceNumber)
            }
            if (!entry.invoiceDate || invoiceDate > entry.invoiceDate) {
              entry.invoiceDate = invoiceDate
            }
          } else {
            // 合并费用：平均分配
            const perFeeAmount = itemAmount / ids.length
            for (const feeId of ids) {
              if (!feeInvoiceMap.has(feeId)) {
                feeInvoiceMap.set(feeId, { totalAmount: 0, invoiceNumbers: [], invoiceDate: null })
              }
              const entry = feeInvoiceMap.get(feeId)
              entry.totalAmount += perFeeAmount
              if (!entry.invoiceNumbers.includes(invoiceNumber)) {
                entry.invoiceNumbers.push(invoiceNumber)
              }
              if (!entry.invoiceDate || invoiceDate > entry.invoiceDate) {
                entry.invoiceDate = invoiceDate
              }
            }
          }
        }
      }
      
      // 如果 items 中没有 feeId，使用 fee_ids 字段
      if (items.every(item => !item.feeId) && feeIds.length > 0) {
        // 无法确定每个费用的金额，使用发票总额平均分配
        const perFeeAmount = parseFloat(invoice.total_amount) / feeIds.length
        for (const feeId of feeIds) {
          if (!feeInvoiceMap.has(feeId)) {
            feeInvoiceMap.set(feeId, { totalAmount: 0, invoiceNumbers: [], invoiceDate: null })
          }
          const entry = feeInvoiceMap.get(feeId)
          entry.totalAmount += perFeeAmount
          if (!entry.invoiceNumbers.includes(invoiceNumber)) {
            entry.invoiceNumbers.push(invoiceNumber)
          }
          if (!entry.invoiceDate || invoiceDate > entry.invoiceDate) {
            entry.invoiceDate = invoiceDate
          }
        }
      }
    }
    
    console.log(`\n📌 步骤 3: 更新 ${feeInvoiceMap.size} 条费用的开票状态...`)
    
    // 4. 更新费用记录
    let updatedCount = 0
    let fullyInvoicedCount = 0
    let partialInvoicedCount = 0
    
    for (const [feeId, info] of feeInvoiceMap) {
      // 获取费用的系统金额
      const feeResult = await client.query(
        'SELECT amount FROM fees WHERE id = $1',
        [feeId]
      )
      
      if (feeResult.rows.length === 0) {
        console.warn(`   ⚠️ 费用 ${feeId} 不存在`)
        continue
      }
      
      const feeAmount = parseFloat(feeResult.rows[0].amount) || 0
      const invoicedAmount = info.totalAmount
      const invoiceNumbers = info.invoiceNumbers.join(',')
      const invoiceDate = info.invoiceDate
      
      // 确定开票状态
      let invoiceStatus = 'not_invoiced'
      if (invoicedAmount >= feeAmount) {
        invoiceStatus = 'invoiced'
        fullyInvoicedCount++
      } else if (invoicedAmount > 0) {
        invoiceStatus = 'partial_invoiced'
        partialInvoicedCount++
      }
      
      // 更新费用
      await client.query(`
        UPDATE fees 
        SET invoiced_amount = $1,
            invoice_status = $2,
            invoice_number = $3,
            invoice_date = $4,
            updated_at = NOW()
        WHERE id = $5
      `, [invoicedAmount, invoiceStatus, invoiceNumbers, invoiceDate, feeId])
      
      updatedCount++
    }
    
    console.log(`   ✅ 更新了 ${updatedCount} 条费用记录`)
    console.log(`   - 完全开票: ${fullyInvoicedCount} 条`)
    console.log(`   - 部分开票: ${partialInvoicedCount} 条`)
    
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
    
    // 6. 显示部分开票的费用详情
    const partialInvoiced = await client.query(`
      SELECT 
        f.id,
        f.fee_name,
        f.amount,
        f.invoiced_amount,
        f.amount - f.invoiced_amount as available_amount,
        f.invoice_number,
        b.container_number
      FROM fees f
      LEFT JOIN bills_of_lading b ON f.bill_id = b.id
      WHERE f.invoice_status = 'partial_invoiced'
      ORDER BY f.updated_at DESC
      LIMIT 20
    `)
    
    if (partialInvoiced.rows.length > 0) {
      console.log('\n📋 部分开票费用详情（最多显示20条）:')
      console.log('-'.repeat(100))
      console.log('费用名称\t\t系统金额\t已开票\t\t可开金额\t柜号\t\t\t发票号')
      console.log('-'.repeat(100))
      partialInvoiced.rows.forEach(row => {
        const name = (row.fee_name || '').substring(0, 12).padEnd(12)
        const amount = parseFloat(row.amount || 0).toFixed(2).padStart(10)
        const invoiced = parseFloat(row.invoiced_amount || 0).toFixed(2).padStart(10)
        const available = parseFloat(row.available_amount || 0).toFixed(2).padStart(10)
        const container = (row.container_number || '-').padEnd(14)
        const invNum = (row.invoice_number || '-').substring(0, 20)
        console.log(`${name}\t${amount}\t${invoiced}\t${available}\t${container}\t${invNum}`)
      })
    }
    
    console.log('\n✅ 修复完成！')
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixInvoicedAmounts().catch(err => {
  console.error(err)
  process.exit(1)
})
