import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 中国发往欧洲的主要铁路火车站数据（中欧班列）
const railwayStations = [
  // 陕西省 - 西安
  { 
    portCode: 'CNXIAN', 
    portNameCn: '西安国际港站', 
    portNameEn: 'Xi\'an International Port Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '西安', 
    description: '中欧班列（西安）始发站，中国内陆最大的铁路口岸', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNXIAN1', 
    portNameCn: '新筑站', 
    portNameEn: 'Xinzhu Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '西安', 
    description: '西安国际港站主要作业区', 
    portType: 'terminal', 
    parentPortCode: 'CNXIAN' 
  },

  // 重庆市
  { 
    portCode: 'CNCKG', 
    portNameCn: '重庆团结村站', 
    portNameEn: 'Chongqing Tuanjie Village Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '重庆', 
    description: '中欧班列（重庆）始发站，中欧班列最早开行的城市', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNCKG1', 
    portNameCn: '重庆果园港站', 
    portNameEn: 'Chongqing Guoyuan Port Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '重庆', 
    description: '重庆铁路枢纽重要站点', 
    portType: 'terminal', 
    parentPortCode: 'CNCKG' 
  },

  // 四川省 - 成都
  { 
    portCode: 'CNCTU', 
    portNameCn: '成都国际铁路港', 
    portNameEn: 'Chengdu International Railway Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '成都', 
    description: '中欧班列（成都）始发站，西南地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNCTU1', 
    portNameCn: '青白江站', 
    portNameEn: 'Qingbaijiang Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '成都', 
    description: '成都国际铁路港核心作业区', 
    portType: 'terminal', 
    parentPortCode: 'CNCTU' 
  },

  // 河南省 - 郑州
  { 
    portCode: 'CNCGO', 
    portNameCn: '郑州圃田站', 
    portNameEn: 'Zhengzhou Putian Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '郑州', 
    description: '中欧班列（郑州）始发站，中原地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNCGO1', 
    portNameCn: '郑州国际陆港', 
    portNameEn: 'Zhengzhou International Land Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '郑州', 
    description: '郑州铁路口岸核心作业区', 
    portType: 'terminal', 
    parentPortCode: 'CNCGO' 
  },

  // 浙江省 - 义乌
  { 
    portCode: 'CNYIW', 
    portNameCn: '义乌西站', 
    portNameEn: 'Yiwu West Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '义乌', 
    description: '中欧班列（义乌）始发站，世界小商品之都的铁路口岸', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 湖北省 - 武汉
  { 
    portCode: 'CNWUH', 
    portNameCn: '武汉吴家山站', 
    portNameEn: 'Wuhan Wujiashan Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '武汉', 
    description: '中欧班列（武汉）始发站，华中地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNWUH1', 
    portNameCn: '武汉汉西站', 
    portNameEn: 'Wuhan Hanxi Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '武汉', 
    description: '武汉铁路枢纽重要站点', 
    portType: 'terminal', 
    parentPortCode: 'CNWUH' 
  },

  // 江苏省 - 苏州
  { 
    portCode: 'CNSZV', 
    portNameCn: '苏州西站', 
    portNameEn: 'Suzhou West Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '苏州', 
    description: '中欧班列（苏州）始发站，长三角地区重要铁路口岸', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 山东省 - 济南
  { 
    portCode: 'CNTNA', 
    portNameCn: '济南南站', 
    portNameEn: 'Jinan South Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '济南', 
    description: '中欧班列（济南）始发站，山东省重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 广东省 - 广州
  { 
    portCode: 'CNCANR', 
    portNameCn: '广州大朗站', 
    portNameEn: 'Guangzhou Dalang Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '广州', 
    description: '中欧班列（广州）始发站，华南地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 湖南省 - 长沙
  { 
    portCode: 'CNCSX', 
    portNameCn: '长沙北站', 
    portNameEn: 'Changsha North Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '长沙', 
    description: '中欧班列（长沙）始发站，中部地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 辽宁省 - 沈阳
  { 
    portCode: 'CNSHEY', 
    portNameCn: '沈阳东站', 
    portNameEn: 'Shenyang East Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '沈阳', 
    description: '中欧班列（沈阳）始发站，东北地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 新疆维吾尔自治区 - 乌鲁木齐
  { 
    portCode: 'CNURC', 
    portNameCn: '乌鲁木齐西站', 
    portNameEn: 'Urumqi West Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '乌鲁木齐', 
    description: '中欧班列重要节点站，新疆地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
  { 
    portCode: 'CNURC1', 
    portNameCn: '乌鲁木齐国际陆港', 
    portNameEn: 'Urumqi International Land Port', 
    country: '中国', 
    countryCode: 'CN', 
    city: '乌鲁木齐', 
    description: '乌鲁木齐铁路口岸核心作业区', 
    portType: 'terminal', 
    parentPortCode: 'CNURC' 
  },

  // 内蒙古自治区 - 二连浩特
  { 
    portCode: 'CNERL', 
    portNameCn: '二连浩特站', 
    portNameEn: 'Erenhot Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '二连浩特', 
    description: '中欧班列重要边境口岸站，连接蒙古和俄罗斯', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 内蒙古自治区 - 满洲里
  { 
    portCode: 'CNMZL', 
    portNameCn: '满洲里站', 
    portNameEn: 'Manzhouli Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '满洲里', 
    description: '中欧班列重要边境口岸站，连接俄罗斯的重要通道', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 黑龙江省 - 哈尔滨
  { 
    portCode: 'CNHRB', 
    portNameCn: '哈尔滨国际集装箱中心站', 
    portNameEn: 'Harbin International Container Center Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '哈尔滨', 
    description: '中欧班列（哈尔滨）始发站，东北地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 河北省 - 石家庄
  { 
    portCode: 'CNSJW', 
    portNameCn: '石家庄南站', 
    portNameEn: 'Shijiazhuang South Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '石家庄', 
    description: '中欧班列（石家庄）始发站，华北地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 安徽省 - 合肥
  { 
    portCode: 'CNHFE', 
    portNameCn: '合肥北站', 
    portNameEn: 'Hefei North Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '合肥', 
    description: '中欧班列（合肥）始发站，中部地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 江西省 - 南昌
  { 
    portCode: 'CNKHN', 
    portNameCn: '南昌向塘站', 
    portNameEn: 'Nanchang Xiangtang Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '南昌', 
    description: '中欧班列（南昌）始发站，中部地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 福建省 - 厦门
  { 
    portCode: 'CNXMN1', 
    portNameCn: '厦门前场站', 
    portNameEn: 'Xiamen Qianchang Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '厦门', 
    description: '中欧班列（厦门）始发站，东南沿海重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },

  // 云南省 - 昆明
  { 
    portCode: 'CNKMG', 
    portNameCn: '昆明王家营西站', 
    portNameEn: 'Kunming Wangjiaying West Station', 
    country: '中国', 
    countryCode: 'CN', 
    city: '昆明', 
    description: '中欧班列（昆明）始发站，西南地区重要铁路枢纽', 
    portType: 'main', 
    parentPortCode: null 
  },
]

console.log('🚂 开始初始化中国到欧洲的铁路火车站数据...')

try {
  // 清空现有铁运港数据
  console.log('🗑️  清空现有铁运港数据...')
  const deleteStmt = db.prepare("DELETE FROM ports_of_loading WHERE transport_type = 'rail'")
  const deleteResult = deleteStmt.run()
  console.log(`   已删除 ${deleteResult.changes} 条旧数据`)

  // 插入新数据
  console.log('📝 开始插入铁路火车站数据...')
  const insertStmt = db.prepare(`
    INSERT INTO ports_of_loading (
      port_code, 
      port_name_cn, 
      port_name_en, 
      country, 
      country_code, 
      city, 
      description, 
      transport_type, 
      port_type, 
      parent_port_code, 
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'rail', ?, ?, 'active')
  `)

  let insertedCount = 0
  for (const station of railwayStations) {
    try {
      insertStmt.run(
        station.portCode,
        station.portNameCn,
        station.portNameEn,
        station.country,
        station.countryCode,
        station.city,
        station.description,
        station.portType,
        station.parentPortCode || null
      )
      insertedCount++
    } catch (err) {
      console.error(`   插入失败: ${station.portNameCn} (${station.portCode})`, err.message)
    }
  }

  console.log(`✅ 成功导入 ${insertedCount} 条铁路火车站数据`)

  // 统计信息
  const mainStations = railwayStations.filter(s => s.portType === 'main').length
  const terminals = railwayStations.filter(s => s.portType === 'terminal').length
  console.log(`📊 主火车站: ${mainStations} 个，站点: ${terminals} 个`)

  // 按城市统计
  const cityStats = {}
  railwayStations.forEach(station => {
    if (!cityStats[station.city]) {
      cityStats[station.city] = 0
    }
    cityStats[station.city]++
  })

  console.log('\n📈 按城市统计:')
  Object.entries(cityStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => {
      console.log(`   ${city}: ${count} 个火车站/站点`)
    })

  console.log('\n✅ 数据库操作完成')
} catch (error) {
  console.error('❌ 初始化失败:', error)
  process.exit(1)
} finally {
  db.close()
}

