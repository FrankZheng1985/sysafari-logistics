import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 连接数据库
const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 全球主要机场信息（包含IATA代码）
const airports = [
  // 亚洲
  { portCode: 'PEK', portNameCn: '北京首都国际机场', portNameEn: 'Beijing Capital International Airport', country: '中国', countryCode: 'CN', city: '北京', description: '中国最大机场' },
  { portCode: 'PVG', portNameCn: '上海浦东国际机场', portNameEn: 'Shanghai Pudong International Airport', country: '中国', countryCode: 'CN', city: '上海', description: '中国主要国际机场' },
  { portCode: 'CAN', portNameCn: '广州白云国际机场', portNameEn: 'Guangzhou Baiyun International Airport', country: '中国', countryCode: 'CN', city: '广州', description: '中国主要国际机场' },
  { portCode: 'SZX', portNameCn: '深圳宝安国际机场', portNameEn: 'Shenzhen Bao\'an International Airport', country: '中国', countryCode: 'CN', city: '深圳', description: '中国主要国际机场' },
  { portCode: 'CTU', portNameCn: '成都双流国际机场', portNameEn: 'Chengdu Shuangliu International Airport', country: '中国', countryCode: 'CN', city: '成都', description: '中国主要国际机场' },
  { portCode: 'KMG', portNameCn: '昆明长水国际机场', portNameEn: 'Kunming Changshui International Airport', country: '中国', countryCode: 'CN', city: '昆明', description: '中国主要国际机场' },
  { portCode: 'XIY', portNameCn: '西安咸阳国际机场', portNameEn: 'Xi\'an Xianyang International Airport', country: '中国', countryCode: 'CN', city: '西安', description: '中国主要国际机场' },
  { portCode: 'NRT', portNameCn: '东京成田国际机场', portNameEn: 'Tokyo Narita International Airport', country: '日本', countryCode: 'JP', city: '东京', description: '日本主要国际机场' },
  { portCode: 'HND', portNameCn: '东京羽田国际机场', portNameEn: 'Tokyo Haneda International Airport', country: '日本', countryCode: 'JP', city: '东京', description: '日本主要国际机场' },
  { portCode: 'KIX', portNameCn: '大阪关西国际机场', portNameEn: 'Osaka Kansai International Airport', country: '日本', countryCode: 'JP', city: '大阪', description: '日本主要国际机场' },
  { portCode: 'ICN', portNameCn: '首尔仁川国际机场', portNameEn: 'Seoul Incheon International Airport', country: '韩国', countryCode: 'KR', city: '首尔', description: '韩国主要国际机场' },
  { portCode: 'SIN', portNameCn: '新加坡樟宜机场', portNameEn: 'Singapore Changi Airport', country: '新加坡', countryCode: 'SG', city: '新加坡', description: '世界主要枢纽机场' },
  { portCode: 'BKK', portNameCn: '曼谷素万那普国际机场', portNameEn: 'Bangkok Suvarnabhumi Airport', country: '泰国', countryCode: 'TH', city: '曼谷', description: '泰国主要国际机场' },
  { portCode: 'KUL', portNameCn: '吉隆坡国际机场', portNameEn: 'Kuala Lumpur International Airport', country: '马来西亚', countryCode: 'MY', city: '吉隆坡', description: '马来西亚主要国际机场' },
  { portCode: 'DXB', portNameCn: '迪拜国际机场', portNameEn: 'Dubai International Airport', country: '阿联酋', countryCode: 'AE', city: '迪拜', description: '世界主要枢纽机场' },
  { portCode: 'DOH', portNameCn: '多哈哈马德国际机场', portNameEn: 'Doha Hamad International Airport', country: '卡塔尔', countryCode: 'QA', city: '多哈', description: '卡塔尔主要国际机场' },
  { portCode: 'IST', portNameCn: '伊斯坦布尔机场', portNameEn: 'Istanbul Airport', country: '土耳其', countryCode: 'TR', city: '伊斯坦布尔', description: '土耳其主要国际机场' },
  { portCode: 'DEL', portNameCn: '德里英迪拉·甘地国际机场', portNameEn: 'Delhi Indira Gandhi International Airport', country: '印度', countryCode: 'IN', city: '德里', description: '印度主要国际机场' },
  { portCode: 'BOM', portNameCn: '孟买贾特拉帕蒂·希瓦吉国际机场', portNameEn: 'Mumbai Chhatrapati Shivaji International Airport', country: '印度', countryCode: 'IN', city: '孟买', description: '印度主要国际机场' },
  
  // 欧洲
  { portCode: 'LHR', portNameCn: '伦敦希思罗机场', portNameEn: 'London Heathrow Airport', country: '英国', countryCode: 'GB', city: '伦敦', description: '英国主要国际机场' },
  { portCode: 'LGW', portNameCn: '伦敦盖特威克机场', portNameEn: 'London Gatwick Airport', country: '英国', countryCode: 'GB', city: '伦敦', description: '英国主要国际机场' },
  { portCode: 'CDG', portNameCn: '巴黎戴高乐机场', portNameEn: 'Paris Charles de Gaulle Airport', country: '法国', countryCode: 'FR', city: '巴黎', description: '法国主要国际机场' },
  { portCode: 'FRA', portNameCn: '法兰克福机场', portNameEn: 'Frankfurt Airport', country: '德国', countryCode: 'DE', city: '法兰克福', description: '德国主要国际机场' },
  { portCode: 'MUC', portNameCn: '慕尼黑机场', portNameEn: 'Munich Airport', country: '德国', countryCode: 'DE', city: '慕尼黑', description: '德国主要国际机场' },
  { portCode: 'AMS', portNameCn: '阿姆斯特丹史基浦机场', portNameEn: 'Amsterdam Schiphol Airport', country: '荷兰', countryCode: 'NL', city: '阿姆斯特丹', description: '荷兰主要国际机场' },
  { portCode: 'MAD', portNameCn: '马德里巴拉哈斯机场', portNameEn: 'Madrid Barajas Airport', country: '西班牙', countryCode: 'ES', city: '马德里', description: '西班牙主要国际机场' },
  { portCode: 'FCO', portNameCn: '罗马菲乌米奇诺机场', portNameEn: 'Rome Fiumicino Airport', country: '意大利', countryCode: 'IT', city: '罗马', description: '意大利主要国际机场' },
  { portCode: 'ZUR', portNameCn: '苏黎世机场', portNameEn: 'Zurich Airport', country: '瑞士', countryCode: 'CH', city: '苏黎世', description: '瑞士主要国际机场' },
  { portCode: 'VIE', portNameCn: '维也纳机场', portNameEn: 'Vienna Airport', country: '奥地利', countryCode: 'AT', city: '维也纳', description: '奥地利主要国际机场' },
  { portCode: 'BRU', portNameCn: '布鲁塞尔机场', portNameEn: 'Brussels Airport', country: '比利时', countryCode: 'BE', city: '布鲁塞尔', description: '比利时主要国际机场' },
  { portCode: 'CPH', portNameCn: '哥本哈根机场', portNameEn: 'Copenhagen Airport', country: '丹麦', countryCode: 'DK', city: '哥本哈根', description: '丹麦主要国际机场' },
  { portCode: 'ARN', portNameCn: '斯德哥尔摩阿兰达机场', portNameEn: 'Stockholm Arlanda Airport', country: '瑞典', countryCode: 'SE', city: '斯德哥尔摩', description: '瑞典主要国际机场' },
  { portCode: 'HEL', portNameCn: '赫尔辛基万塔机场', portNameEn: 'Helsinki Vantaa Airport', country: '芬兰', countryCode: 'FI', city: '赫尔辛基', description: '芬兰主要国际机场' },
  { portCode: 'DME', portNameCn: '莫斯科多莫杰多沃机场', portNameEn: 'Moscow Domodedovo Airport', country: '俄罗斯', countryCode: 'RU', city: '莫斯科', description: '俄罗斯主要国际机场' },
  { portCode: 'SVO', portNameCn: '莫斯科谢列梅捷沃机场', portNameEn: 'Moscow Sheremetyevo Airport', country: '俄罗斯', countryCode: 'RU', city: '莫斯科', description: '俄罗斯主要国际机场' },
  
  // 美洲
  { portCode: 'JFK', portNameCn: '纽约肯尼迪国际机场', portNameEn: 'New York John F. Kennedy International Airport', country: '美国', countryCode: 'US', city: '纽约', description: '美国主要国际机场' },
  { portCode: 'LAX', portNameCn: '洛杉矶国际机场', portNameEn: 'Los Angeles International Airport', country: '美国', countryCode: 'US', city: '洛杉矶', description: '美国主要国际机场' },
  { portCode: 'ORD', portNameCn: '芝加哥奥黑尔国际机场', portNameEn: 'Chicago O\'Hare International Airport', country: '美国', countryCode: 'US', city: '芝加哥', description: '美国主要国际机场' },
  { portCode: 'MIA', portNameCn: '迈阿密国际机场', portNameEn: 'Miami International Airport', country: '美国', countryCode: 'US', city: '迈阿密', description: '美国主要国际机场' },
  { portCode: 'SFO', portNameCn: '旧金山国际机场', portNameEn: 'San Francisco International Airport', country: '美国', countryCode: 'US', city: '旧金山', description: '美国主要国际机场' },
  { portCode: 'DFW', portNameCn: '达拉斯/沃斯堡国际机场', portNameEn: 'Dallas/Fort Worth International Airport', country: '美国', countryCode: 'US', city: '达拉斯', description: '美国主要国际机场' },
  { portCode: 'ATL', portNameCn: '亚特兰大哈茨菲尔德-杰克逊国际机场', portNameEn: 'Atlanta Hartsfield-Jackson International Airport', country: '美国', countryCode: 'US', city: '亚特兰大', description: '世界最繁忙机场' },
  { portCode: 'SEA', portNameCn: '西雅图-塔科马国际机场', portNameEn: 'Seattle-Tacoma International Airport', country: '美国', countryCode: 'US', city: '西雅图', description: '美国主要国际机场' },
  { portCode: 'BOS', portNameCn: '波士顿洛根国际机场', portNameEn: 'Boston Logan International Airport', country: '美国', countryCode: 'US', city: '波士顿', description: '美国主要国际机场' },
  { portCode: 'YYZ', portNameCn: '多伦多皮尔逊国际机场', portNameEn: 'Toronto Pearson International Airport', country: '加拿大', countryCode: 'CA', city: '多伦多', description: '加拿大主要国际机场' },
  { portCode: 'YVR', portNameCn: '温哥华国际机场', portNameEn: 'Vancouver International Airport', country: '加拿大', countryCode: 'CA', city: '温哥华', description: '加拿大主要国际机场' },
  { portCode: 'MEX', portNameCn: '墨西哥城国际机场', portNameEn: 'Mexico City International Airport', country: '墨西哥', countryCode: 'MX', city: '墨西哥城', description: '墨西哥主要国际机场' },
  { portCode: 'GRU', portNameCn: '圣保罗瓜鲁柳斯国际机场', portNameEn: 'São Paulo Guarulhos International Airport', country: '巴西', countryCode: 'BR', city: '圣保罗', description: '巴西主要国际机场' },
  { portCode: 'GIG', portNameCn: '里约热内卢/加利昂国际机场', portNameEn: 'Rio de Janeiro/Galeão International Airport', country: '巴西', countryCode: 'BR', city: '里约热内卢', description: '巴西主要国际机场' },
  { portCode: 'EZE', portNameCn: '布宜诺斯艾利斯埃塞萨国际机场', portNameEn: 'Buenos Aires Ezeiza International Airport', country: '阿根廷', countryCode: 'AR', city: '布宜诺斯艾利斯', description: '阿根廷主要国际机场' },
  { portCode: 'SCL', portNameCn: '圣地亚哥阿图罗·梅里诺·贝尼特斯国际机场', portNameEn: 'Santiago Arturo Merino Benítez International Airport', country: '智利', countryCode: 'CL', city: '圣地亚哥', description: '智利主要国际机场' },
  
  // 非洲
  { portCode: 'JNB', portNameCn: '约翰内斯堡奥利弗·坦博国际机场', portNameEn: 'Johannesburg O.R. Tambo International Airport', country: '南非', countryCode: 'ZA', city: '约翰内斯堡', description: '南非主要国际机场' },
  { portCode: 'CPT', portNameCn: '开普敦国际机场', portNameEn: 'Cape Town International Airport', country: '南非', countryCode: 'ZA', city: '开普敦', description: '南非主要国际机场' },
  { portCode: 'CAI', portNameCn: '开罗国际机场', portNameEn: 'Cairo International Airport', country: '埃及', countryCode: 'EG', city: '开罗', description: '埃及主要国际机场' },
  { portCode: 'NBO', portNameCn: '内罗毕乔莫·肯雅塔国际机场', portNameEn: 'Nairobi Jomo Kenyatta International Airport', country: '肯尼亚', countryCode: 'KE', city: '内罗毕', description: '肯尼亚主要国际机场' },
  { portCode: 'ADD', portNameCn: '亚的斯亚贝巴博莱国际机场', portNameEn: 'Addis Ababa Bole International Airport', country: '埃塞俄比亚', countryCode: 'ET', city: '亚的斯亚贝巴', description: '埃塞俄比亚主要国际机场' },
  { portCode: 'CMN', portNameCn: '卡萨布兰卡穆罕默德五世国际机场', portNameEn: 'Casablanca Mohammed V International Airport', country: '摩洛哥', countryCode: 'MA', city: '卡萨布兰卡', description: '摩洛哥主要国际机场' },
  
  // 大洋洲
  { portCode: 'SYD', portNameCn: '悉尼金斯福德·史密斯机场', portNameEn: 'Sydney Kingsford Smith Airport', country: '澳大利亚', countryCode: 'AU', city: '悉尼', description: '澳大利亚主要国际机场' },
  { portCode: 'MEL', portNameCn: '墨尔本机场', portNameEn: 'Melbourne Airport', country: '澳大利亚', countryCode: 'AU', city: '墨尔本', description: '澳大利亚主要国际机场' },
  { portCode: 'BNE', portNameCn: '布里斯班机场', portNameEn: 'Brisbane Airport', country: '澳大利亚', countryCode: 'AU', city: '布里斯班', description: '澳大利亚主要国际机场' },
  { portCode: 'PER', portNameCn: '珀斯机场', portNameEn: 'Perth Airport', country: '澳大利亚', countryCode: 'AU', city: '珀斯', description: '澳大利亚主要国际机场' },
  { portCode: 'AKL', portNameCn: '奥克兰机场', portNameEn: 'Auckland Airport', country: '新西兰', countryCode: 'NZ', city: '奥克兰', description: '新西兰主要国际机场' },
  { portCode: 'WLG', portNameCn: '惠灵顿机场', portNameEn: 'Wellington Airport', country: '新西兰', countryCode: 'NZ', city: '惠灵顿', description: '新西兰主要国际机场' },
]

// 检查表是否存在，如果不存在则创建
db.exec(`
  CREATE TABLE IF NOT EXISTS air_ports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    port_code TEXT NOT NULL UNIQUE,
    port_name_cn TEXT NOT NULL,
    port_name_en TEXT,
    country TEXT,
    country_code TEXT,
    city TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_air_ports_code ON air_ports(port_code);
  CREATE INDEX IF NOT EXISTS idx_air_ports_name_cn ON air_ports(port_name_cn);
  CREATE INDEX IF NOT EXISTS idx_air_ports_country ON air_ports(country);
  CREATE INDEX IF NOT EXISTS idx_air_ports_status ON air_ports(status);
`)

// 插入数据
const stmt = db.prepare(`
  INSERT OR REPLACE INTO air_ports (port_code, port_name_cn, port_name_en, country, country_code, city, description, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
`)

const insertMany = db.transaction((airports) => {
  for (const airport of airports) {
    stmt.run(
      airport.portCode.toUpperCase(),
      airport.portNameCn,
      airport.portNameEn || '',
      airport.country || '',
      airport.countryCode || '',
      airport.city || '',
      airport.description || ''
    )
  }
})

try {
  insertMany(airports)
  console.log(`成功导入 ${airports.length} 条机场数据到 air_ports 表`)
} catch (error) {
  console.error('导入机场数据失败:', error)
  process.exit(1)
}

db.close()
console.log('数据库连接已关闭')

