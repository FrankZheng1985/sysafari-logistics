/**
 * 修复报价单 notes 字段中的利润信息泄露问题
 * 
 * 问题: notes 字段中包含了"利润设置"信息，这是内部信息，不应该显示在给客户的报价单上
 * 
 * 运行方式: cd server && node scripts/fix-quotation-notes-profit.js
 */

import { getDatabase, closeDatabase } from '../config/database.js'

async function fixQuotationNotes() {
  console.log('🔧 开始修复报价单 notes 字段中的利润信息...\n')
  
  const db = getDatabase()
  
  try {
    // 1. 查找包含利润信息的报价单
    const affectedQuotations = await db.prepare(`
      SELECT id, quote_number, notes 
      FROM quotations 
      WHERE notes LIKE '%利润设置%' OR notes LIKE '%利润率%'
    `).all()
    
    console.log(`📋 找到 ${affectedQuotations.length} 个包含利润信息的报价单:\n`)
    
    if (affectedQuotations.length === 0) {
      console.log('✅ 没有需要修复的报价单')
      return
    }
    
    // 显示受影响的报价单
    affectedQuotations.forEach(q => {
      console.log(`   - ${q.quote_number}`)
      console.log(`     原始notes: ${q.notes}`)
    })
    
    console.log('\n')
    
    // 2. 修复每个报价单
    let fixedCount = 0
    for (const quotation of affectedQuotations) {
      let newNotes = quotation.notes
      
      // 移除 "| 利润设置：xxx" 或 "| 利润率：xxx" 部分
      newNotes = newNotes.replace(/\s*\|\s*利润设置[：:][^\n]*/g, '')
      newNotes = newNotes.replace(/\s*\|\s*利润率[：:][^\n]*/g, '')
      
      // 更新数据库
      await db.prepare(`
        UPDATE quotations 
        SET notes = $1, updated_at = NOW()
        WHERE id = $2
      `).run(newNotes, quotation.id)
      
      console.log(`✅ 已修复 ${quotation.quote_number}`)
      console.log(`   新notes: ${newNotes}`)
      fixedCount++
    }
    
    console.log(`\n🎉 修复完成！共修复了 ${fixedCount} 个报价单`)
    
    // 3. 验证修复结果
    const remaining = await db.prepare(`
      SELECT COUNT(*) as count
      FROM quotations 
      WHERE notes LIKE '%利润设置%' OR notes LIKE '%利润率%'
    `).get()
    
    if (remaining.count === 0) {
      console.log('✅ 验证通过：没有报价单包含利润信息')
    } else {
      console.log(`⚠️ 警告：仍有 ${remaining.count} 个报价单包含利润信息，请检查`)
    }
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message)
    throw error
  } finally {
    closeDatabase()
  }
}

// 运行修复
fixQuotationNotes().catch(err => {
  console.error('修复脚本执行失败:', err)
  process.exit(1)
})
