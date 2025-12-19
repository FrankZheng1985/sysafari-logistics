/**
 * 检查起运地数据分类是否正确
 */

import { getDatabase } from '../config/database.js'

async function checkPortData() {
  const db = getDatabase()
  
  console.log('检查起运地数据分类...\n')
  
  try {
    // 检查海运中是否有机场数据（名称包含"机场"）
    const seaPortsWithAirport = await db.prepare(`
      SELECT port_code, port_name_cn, transport_type, continent
      FROM ports_of_loading
      WHERE transport_type = 'sea' 
        AND (port_name_cn LIKE '%机场%' OR port_name_en LIKE '%Airport%' OR port_name_en LIKE '%Air%')
      ORDER BY port_code
    `).all()
    
    if (seaPortsWithAirport.length > 0) {
      console.log(`❌ 发现 ${seaPortsWithAirport.length} 条海运数据包含机场：`)
      seaPortsWithAirport.forEach(port => {
        console.log(`  - ${port.port_code}: ${port.port_name_cn} (${port.transport_type})`)
      })
      console.log('')
    } else {
      console.log('✅ 海运数据中没有发现机场数据\n')
    }
    
    // 检查空运中是否有港口数据（名称包含"港"但不包含"机场"）
    const airPortsWithSeaport = await db.prepare(`
      SELECT port_code, port_name_cn, transport_type, continent
      FROM ports_of_loading
      WHERE transport_type = 'air' 
        AND port_name_cn LIKE '%港%'
        AND port_name_cn NOT LIKE '%机场%'
      ORDER BY port_code
    `).all()
    
    if (airPortsWithSeaport.length > 0) {
      console.log(`❌ 发现 ${airPortsWithSeaport.length} 条空运数据包含港口：`)
      airPortsWithSeaport.forEach(port => {
        console.log(`  - ${port.port_code}: ${port.port_name_cn} (${port.transport_type})`)
      })
      console.log('')
    } else {
      console.log('✅ 空运数据中没有发现港口数据\n')
    }
    
    // 统计各运输方式的数据量
    const stats = await db.prepare(`
      SELECT transport_type, COUNT(*) as count
      FROM ports_of_loading
      GROUP BY transport_type
      ORDER BY transport_type
    `).all()
    
    console.log('数据统计：')
    stats.forEach(stat => {
      console.log(`  ${stat.transport_type || '(NULL)'}: ${stat.count} 条`)
    })
    console.log('')
    
    // 统计各洲的数据量
    const continentStats = await db.prepare(`
      SELECT continent, transport_type, COUNT(*) as count
      FROM ports_of_loading
      GROUP BY continent, transport_type
      ORDER BY continent, transport_type
    `).all()
    
    console.log('按洲和运输方式统计：')
    let currentContinent = null
    continentStats.forEach(stat => {
      if (stat.continent !== currentContinent) {
        currentContinent = stat.continent
        console.log(`\n${stat.continent || '(NULL)'}:`)
      }
      console.log(`  ${stat.transport_type || '(NULL)'}: ${stat.count} 条`)
    })
    
    // 检查是否有NULL的transport_type
    const nullTransportType = await db.prepare(`
      SELECT COUNT(*) as count
      FROM ports_of_loading
      WHERE transport_type IS NULL
    `).get()
    
    if (nullTransportType.count > 0) {
      console.log(`\n⚠️  警告：发现 ${nullTransportType.count} 条记录的 transport_type 为 NULL`)
    }
    
  } catch (error) {
    console.error('检查失败:', error)
    throw error
  }
}

// 如果直接运行此脚本
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                      import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')

if (isMainModule || process.argv[1]?.includes('check-port-data')) {
  checkPortData()
    .then(() => {
      console.log('\n检查完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('检查失败:', error)
      process.exit(1)
    })
}

export { checkPortData }
