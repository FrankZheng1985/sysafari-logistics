/**
 * 修复机场数据的transport_type
 * 将所有名称包含"机场"或port_code以"-A"结尾的数据的transport_type改为'air'
 */

import { getDatabase } from '../config/database.js'

async function fixAirportTransportType() {
  const db = getDatabase()
  
  console.log('开始修复机场数据的transport_type...\n')
  
  try {
    // 查找所有需要修复的数据
    const airportsToFix = await db.prepare(`
      SELECT id, port_code, port_name_cn, port_name_en, transport_type
      FROM ports_of_loading
      WHERE transport_type != 'air'
        AND (
          port_name_cn LIKE '%机场%' 
          OR port_name_en LIKE '%Airport%'
          OR port_name_en LIKE '%Air%'
          OR port_code LIKE '%-A'
          OR port_code LIKE '%-A-%'
        )
      ORDER BY port_code
    `).all()
    
    if (airportsToFix.length === 0) {
      console.log('✅ 没有发现需要修复的机场数据')
      return
    }
    
    console.log(`发现 ${airportsToFix.length} 条需要修复的数据：\n`)
    
    const updateStmt = db.prepare(`
      UPDATE ports_of_loading
      SET transport_type = 'air',
          updated_at = NOW()
      WHERE id = ?
    `)
    
    let fixedCount = 0
    for (const airport of airportsToFix) {
      console.log(`修复: ${airport.port_code} - ${airport.port_name_cn} (${airport.transport_type} -> air)`)
      await updateStmt.run(airport.id)
      fixedCount++
    }
    
    console.log(`\n✅ 成功修复 ${fixedCount} 条机场数据的transport_type`)
    
    // 再次检查
    const remaining = await db.prepare(`
      SELECT COUNT(*) as count
      FROM ports_of_loading
      WHERE transport_type = 'sea'
        AND (
          port_name_cn LIKE '%机场%' 
          OR port_name_en LIKE '%Airport%'
          OR port_name_en LIKE '%Air%'
          OR port_code LIKE '%-A'
        )
    `).get()
    
    if (remaining.count > 0) {
      console.log(`\n⚠️  仍有 ${remaining.count} 条海运数据包含机场关键词，请手动检查`)
    } else {
      console.log('\n✅ 所有机场数据已正确分类')
    }
    
  } catch (error) {
    console.error('修复失败:', error)
    throw error
  }
}

// 如果直接运行此脚本
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                      import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')

if (isMainModule || process.argv[1]?.includes('fix-airport-transport-type')) {
  fixAirportTransportType()
    .then(() => {
      console.log('\n修复完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('修复失败:', error)
      process.exit(1)
    })
}

export { fixAirportTransportType }
