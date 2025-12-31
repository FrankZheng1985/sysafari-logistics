/**
 * 修复 ETA 在未来但 ATA 被错误设置的订单数据
 * 
 * 问题：之前的导入逻辑会在有 ETA 时自动将 ATA 设为 ETA 的值，
 *       但这是错误的，因为如果 ETA 是未来日期，货物还没有到港。
 * 
 * 修复逻辑：
 * 1. 找出所有 ETA > 今天 但 ATA 已设置的订单
 * 2. 将这些订单的 ATA 设为 NULL
 * 3. 将 ship_status 设为 '未到港'（如果当前是 '已到港'）
 */

import { getDatabase } from '../config/database.js'

async function fixFutureEtaAta() {
  try {
    console.log('🔍 连接数据库...')
    const db = getDatabase()
    
    // 获取今天的日期（YYYY-MM-DD 格式）
    const today = new Date().toISOString().split('T')[0]
    console.log(`📅 今天日期: ${today}`)
    
    // 1. 先查询有多少条需要修复的记录
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM bills_of_lading 
      WHERE eta IS NOT NULL 
        AND eta::date > ?::date
        AND (ata IS NOT NULL OR ship_status = '已到港')
    `).get(today)
    
    const count = parseInt(countResult.count)
    console.log(`📊 找到 ${count} 条 ETA 在未来但 ATA/状态 已设置的记录`)
    
    if (count === 0) {
      console.log('✅ 没有需要修复的数据')
      return
    }
    
    // 2. 查看详细数据
    const detailResult = await db.prepare(`
      SELECT bill_number, eta, ata, ship_status
      FROM bills_of_lading 
      WHERE eta IS NOT NULL 
        AND eta::date > ?::date
        AND (ata IS NOT NULL OR ship_status = '已到港')
      ORDER BY eta
      LIMIT 20
    `).all(today)
    
    console.log('\n📋 部分需要修复的记录预览:')
    console.log('提单号\t\t\t\tETA\t\t\tATA\t\t\t状态')
    console.log('-'.repeat(100))
    for (const row of detailResult) {
      const eta = row.eta ? row.eta.split('T')[0] : '-'
      const ata = row.ata ? row.ata.split('T')[0] : '-'
      console.log(`${row.bill_number}\t\t${eta}\t\t${ata}\t\t${row.ship_status}`)
    }
    
    // 3. 执行修复
    console.log('\n🔧 开始修复数据...')
    
    const updateResult = await db.prepare(`
      UPDATE bills_of_lading 
      SET 
        ata = NULL,
        ship_status = CASE WHEN ship_status = '已到港' THEN '未到港' ELSE ship_status END,
        updated_at = NOW()
      WHERE eta IS NOT NULL 
        AND eta::date > ?::date
        AND (ata IS NOT NULL OR ship_status = '已到港')
    `).run(today)
    
    console.log(`✅ 成功修复 ${updateResult.changes} 条记录`)
    
    // 4. 验证修复结果
    const verifyResult = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM bills_of_lading 
      WHERE eta IS NOT NULL 
        AND eta::date > ?::date
        AND (ata IS NOT NULL OR ship_status = '已到港')
    `).get(today)
    
    const remaining = parseInt(verifyResult.count)
    if (remaining === 0) {
      console.log('✅ 验证通过：所有记录已修复')
    } else {
      console.log(`⚠️ 还有 ${remaining} 条记录未修复`)
    }
    
    console.log('\n🎉 修复完成!')
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message)
    process.exit(1)
  }
}

// 执行修复
fixFutureEtaAta()
