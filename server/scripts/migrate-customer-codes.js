/**
 * 客户编码迁移脚本
 * 将现有客户编码更新为新格式：简称拼音首字母 + 年月(YYMM) + 4位序号
 * 
 * 使用方法：
 * 1. 预览模式（不修改数据）：node scripts/migrate-customer-codes.js --preview
 * 2. 执行迁移：node scripts/migrate-customer-codes.js --execute
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { pinyin } from 'pinyin-pro'

dotenv.config()

const { Pool } = pg

// 数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

/**
 * 获取名称的拼音首字母（大写）
 */
function getNameInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'XX'
  }
  
  const cleanName = name.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '')
  
  if (!cleanName) {
    return 'XX'
  }
  
  let initials = ''
  
  for (const char of cleanName) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const py = pinyin(char, { pattern: 'first', toneType: 'none' })
      initials += py.toUpperCase()
    } else if (/[a-zA-Z]/.test(char)) {
      initials += char.toUpperCase()
    }
  }
  
  return initials.slice(0, 4) || 'XX'
}

/**
 * 生成新的客户编码
 * @param {string} customerName - 客户名称
 * @param {Date} createdAt - 创建时间
 * @param {Map} prefixCounters - 前缀计数器（用于生成序号）
 */
function generateNewCode(customerName, createdAt, prefixCounters) {
  const date = new Date(createdAt)
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const yearMonth = `${year}${month}`
  
  const initials = getNameInitials(customerName)
  const prefix = `${initials}${yearMonth}`
  
  // 获取该前缀的下一个序号
  const currentCount = prefixCounters.get(prefix) || 0
  const nextSeq = currentCount + 1
  prefixCounters.set(prefix, nextSeq)
  
  return `${prefix}${nextSeq.toString().padStart(4, '0')}`
}

async function migrateCustomerCodes(executeMode = false) {
  const client = await pool.connect()
  
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║           客户编码迁移工具                                   ║')
    console.log('║  新格式：简称首字母 + 年月(YYMM) + 4位序号                   ║')
    console.log('╚════════════════════════════════════════════════════════════╝\n')
    
    // 查询所有客户，按创建时间排序
    const result = await client.query(`
      SELECT id, customer_code, customer_name, created_at 
      FROM customers 
      ORDER BY created_at ASC
    `)
    
    const customers = result.rows
    console.log(`📊 共找到 ${customers.length} 个客户\n`)
    
    if (customers.length === 0) {
      console.log('没有需要迁移的客户')
      return
    }
    
    // 用于跟踪每个前缀的序号
    const prefixCounters = new Map()
    
    // 生成迁移计划
    const migrationPlan = []
    
    for (const customer of customers) {
      const newCode = generateNewCode(
        customer.customer_name, 
        customer.created_at,
        prefixCounters
      )
      
      migrationPlan.push({
        id: customer.id,
        oldCode: customer.customer_code,
        newCode: newCode,
        customerName: customer.customer_name,
        createdAt: customer.created_at
      })
    }
    
    // 显示迁移计划
    console.log('┌────────────────────┬────────────────────┬──────────────────────┬─────────────┐')
    console.log('│ 旧编码             │ 新编码             │ 客户名称             │ 创建时间    │')
    console.log('├────────────────────┼────────────────────┼──────────────────────┼─────────────┤')
    
    for (const plan of migrationPlan) {
      const oldCode = plan.oldCode.padEnd(18)
      const newCode = plan.newCode.padEnd(18)
      const name = (plan.customerName || '').slice(0, 10).padEnd(20)
      const date = new Date(plan.createdAt).toISOString().slice(0, 10)
      console.log(`│ ${oldCode} │ ${newCode} │ ${name} │ ${date}  │`)
    }
    
    console.log('└────────────────────┴────────────────────┴──────────────────────┴─────────────┘')
    console.log('')
    
    if (!executeMode) {
      console.log('⚠️  预览模式 - 未执行任何修改')
      console.log('💡 如需执行迁移，请运行: node scripts/migrate-customer-codes.js --execute')
      return
    }
    
    // 执行迁移
    console.log('\n🚀 开始执行迁移...\n')
    
    await client.query('BEGIN')
    
    let successCount = 0
    let errorCount = 0
    
    for (const plan of migrationPlan) {
      try {
        await client.query(
          'UPDATE customers SET customer_code = $1, updated_at = NOW() WHERE id = $2',
          [plan.newCode, plan.id]
        )
        successCount++
        console.log(`✅ ${plan.oldCode} → ${plan.newCode} (${plan.customerName})`)
      } catch (error) {
        errorCount++
        console.error(`❌ 更新失败 ${plan.oldCode}: ${error.message}`)
      }
    }
    
    await client.query('COMMIT')
    
    console.log('\n════════════════════════════════════════════════════════════')
    console.log(`✅ 迁移完成！成功: ${successCount}, 失败: ${errorCount}`)
    console.log('════════════════════════════════════════════════════════════\n')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 解析命令行参数
const args = process.argv.slice(2)
const executeMode = args.includes('--execute')

migrateCustomerCodes(executeMode)

