import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 中国主要集装箱港口及其核心码头信息（优化版 - 仅保留核心集装箱港口）
const portsWithTerminals = [
  // 上海港及其核心码头（世界第一大集装箱港口）
  { portCode: 'CNSHA', portNameCn: '上海港', portNameEn: 'Shanghai Port', country: '中国', countryCode: 'CN', city: '上海', description: '中国最大的港口，世界第一大集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNYGS', portNameCn: '洋山港', portNameEn: 'Yangshan Port', country: '中国', countryCode: 'CN', city: '上海', description: '上海港主要深水港区，世界级集装箱码头', portType: 'terminal', parentPortCode: 'CNSHA' },
  { portCode: 'CNWKG', portNameCn: '外高桥港', portNameEn: 'Waigaoqiao Port', country: '中国', countryCode: 'CN', city: '上海', description: '上海港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNSHA' },
  
  // 深圳港及其核心码头（中国第二大集装箱港口）
  { portCode: 'CNSZN', portNameCn: '深圳港', portNameEn: 'Shenzhen Port', country: '中国', countryCode: 'CN', city: '深圳', description: '中国第二大集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNYTN', portNameCn: '盐田港', portNameEn: 'Yantian Port', country: '中国', countryCode: 'CN', city: '深圳', description: '深圳港主要集装箱码头，世界级深水良港', portType: 'terminal', parentPortCode: 'CNSZN' },
  { portCode: 'CNSHE', portNameCn: '蛇口港', portNameEn: 'Shekou Port', country: '中国', countryCode: 'CN', city: '深圳', description: '深圳港主要集装箱码头', portType: 'terminal', parentPortCode: 'CNSZN' },
  { portCode: 'CNCHI', portNameCn: '赤湾港', portNameEn: 'Chiwan Port', country: '中国', countryCode: 'CN', city: '深圳', description: '深圳港主要集装箱码头', portType: 'terminal', parentPortCode: 'CNSZN' },
  { portCode: 'CNDAP', portNameCn: '大铲湾港', portNameEn: 'Dachan Bay Port', country: '中国', countryCode: 'CN', city: '深圳', description: '深圳港主要集装箱码头', portType: 'terminal', parentPortCode: 'CNSZN' },
  
  // 宁波舟山港及其核心码头（世界第三大集装箱港口）
  { portCode: 'CNNGB', portNameCn: '宁波舟山港', portNameEn: 'Ningbo-Zhoushan Port', country: '中国', countryCode: 'CN', city: '宁波', description: '世界第三大集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNNGB1', portNameCn: '北仑港', portNameEn: 'Beilun Port', country: '中国', countryCode: 'CN', city: '宁波', description: '宁波舟山港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNNGB' },
  { portCode: 'CNNGB4', portNameCn: '穿山港', portNameEn: 'Chuanshan Port', country: '中国', countryCode: 'CN', city: '宁波', description: '宁波舟山港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNNGB' },
  { portCode: 'CNNGB3', portNameCn: '大榭港', portNameEn: 'Daxie Port', country: '中国', countryCode: 'CN', city: '宁波', description: '宁波舟山港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNNGB' },
  
  // 青岛港及其核心码头（中国北方重要集装箱港口）
  { portCode: 'CNTAO', portNameCn: '青岛港', portNameEn: 'Qingdao Port', country: '中国', countryCode: 'CN', city: '青岛', description: '中国北方重要集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNQDG', portNameCn: '前湾港', portNameEn: 'Qianwan Port', country: '中国', countryCode: 'CN', city: '青岛', description: '青岛港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNTAO' },
  { portCode: 'CNQDD', portNameCn: '董家口港', portNameEn: 'Dongjiakou Port', country: '中国', countryCode: 'CN', city: '青岛', description: '青岛港主要深水港区', portType: 'terminal', parentPortCode: 'CNTAO' },
  
  // 天津港及其核心码头（中国北方最大港口）
  { portCode: 'CNTXG', portNameCn: '天津港', portNameEn: 'Tianjin Port', country: '中国', countryCode: 'CN', city: '天津', description: '中国北方最大集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNTJT', portNameCn: '天津港集装箱码头', portNameEn: 'Tianjin Container Terminal', country: '中国', countryCode: 'CN', city: '天津', description: '天津港主要集装箱码头', portType: 'terminal', parentPortCode: 'CNTXG' },
  { portCode: 'CNTJD', portNameCn: '东疆港', portNameEn: 'Dongjiang Port', country: '中国', countryCode: 'CN', city: '天津', description: '天津港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNTXG' },
  
  // 广州港及其核心码头（华南地区重要集装箱港口）
  { portCode: 'CNCAN', portNameCn: '广州港', portNameEn: 'Guangzhou Port', country: '中国', countryCode: 'CN', city: '广州', description: '华南地区重要集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNGZN', portNameCn: '南沙港', portNameEn: 'Nansha Port', country: '中国', countryCode: 'CN', city: '广州', description: '广州港主要深水集装箱港区', portType: 'terminal', parentPortCode: 'CNCAN' },
  { portCode: 'CNGZH', portNameCn: '黄埔港', portNameEn: 'Huangpu Port', country: '中国', countryCode: 'CN', city: '广州', description: '广州港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNCAN' },
  
  // 大连港及其核心码头（中国东北地区重要集装箱港口）
  { portCode: 'CNDLC', portNameCn: '大连港', portNameEn: 'Dalian Port', country: '中国', countryCode: 'CN', city: '大连', description: '中国东北地区重要集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNDDX', portNameCn: '大窑湾港', portNameEn: 'Dayao Bay Port', country: '中国', countryCode: 'CN', city: '大连', description: '大连港主要深水集装箱港区', portType: 'terminal', parentPortCode: 'CNDLC' },
  
  // 厦门港及其核心码头（中国东南沿海重要集装箱港口）
  { portCode: 'CNXMN', portNameCn: '厦门港', portNameEn: 'Xiamen Port', country: '中国', countryCode: 'CN', city: '厦门', description: '中国东南沿海重要集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNXMH', portNameCn: '海沧港', portNameEn: 'Haicang Port', country: '中国', countryCode: 'CN', city: '厦门', description: '厦门港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNXMN' },
  { portCode: 'CNXMD', portNameCn: '东渡港', portNameEn: 'Dongdu Port', country: '中国', countryCode: 'CN', city: '厦门', description: '厦门港主要集装箱港区', portType: 'terminal', parentPortCode: 'CNXMN' },
  
  // 其他重要集装箱港口
  { portCode: 'CNLYG', portNameCn: '连云港', portNameEn: 'Lianyungang', country: '中国', countryCode: 'CN', city: '连云港', description: '新亚欧大陆桥东桥头堡，重要集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNYTG', portNameCn: '烟台港', portNameEn: 'Yantai', country: '中国', countryCode: 'CN', city: '烟台', description: '山东半岛重要集装箱港口', portType: 'main', parentPortCode: null },
  { portCode: 'CNRZH', portNameCn: '日照港', portNameEn: 'Rizhao', country: '中国', countryCode: 'CN', city: '日照', description: '中国重要集装箱港口', portType: 'main', parentPortCode: null },
]

// 检查表是否存在，如果不存在则创建
db.exec(`
  CREATE TABLE IF NOT EXISTS ports_of_loading (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    port_code TEXT NOT NULL UNIQUE,
    port_name_cn TEXT NOT NULL,
    port_name_en TEXT,
    country TEXT,
    country_code TEXT,
    city TEXT,
    description TEXT,
    transport_type TEXT DEFAULT 'sea',
    port_type TEXT DEFAULT 'main',
    parent_port_code TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 为现有表添加 port_type 字段（如果不存在）
try {
  db.exec(`ALTER TABLE ports_of_loading ADD COLUMN port_type TEXT DEFAULT 'main'`)
} catch (err) {
  // 字段已存在，忽略错误
}

// 为现有表添加 parent_port_code 字段（如果不存在）
try {
  db.exec(`ALTER TABLE ports_of_loading ADD COLUMN parent_port_code TEXT`)
} catch (err) {
  // 字段已存在，忽略错误
}

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ports_code ON ports_of_loading(port_code);
  CREATE INDEX IF NOT EXISTS idx_ports_name_cn ON ports_of_loading(port_name_cn);
  CREATE INDEX IF NOT EXISTS idx_ports_country ON ports_of_loading(country);
  CREATE INDEX IF NOT EXISTS idx_ports_status ON ports_of_loading(status);
  CREATE INDEX IF NOT EXISTS idx_ports_type ON ports_of_loading(port_type);
  CREATE INDEX IF NOT EXISTS idx_ports_parent ON ports_of_loading(parent_port_code);
`)

// 清空中国的港口数据（仅保留核心集装箱港口）
console.log('🗑️  清空中国现有港口数据...')
const deleteResult = db.prepare('DELETE FROM ports_of_loading WHERE country = ? AND transport_type = ?').run('中国', 'sea')
console.log(`   已删除 ${deleteResult.changes} 条旧数据`)

// 插入数据
const stmt = db.prepare(`
  INSERT OR REPLACE INTO ports_of_loading 
  (port_code, port_name_cn, port_name_en, country, country_code, city, description, transport_type, port_type, parent_port_code, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'sea', ?, ?, 'active')
`)

const insertMany = db.transaction((ports) => {
  for (const port of ports) {
    stmt.run(
      port.portCode.toUpperCase(),
      port.portNameCn,
      port.portNameEn || '',
      port.country || '',
      port.countryCode || '',
      port.city || '',
      port.description || '',
      port.portType || 'main',
      port.parentPortCode || null
    )
  }
})

try {
  insertMany(portsWithTerminals)
  console.log(`✅ 成功导入 ${portsWithTerminals.length} 条港口数据（包含主港口和码头）`)
  
  // 统计插入的数据（仅统计中国的港口）
  const mainPorts = db.prepare('SELECT COUNT(*) as count FROM ports_of_loading WHERE port_type = ? AND country = ? AND transport_type = ?').get('main', '中国', 'sea')
  const terminals = db.prepare('SELECT COUNT(*) as count FROM ports_of_loading WHERE port_type = ? AND country = ? AND transport_type = ?').get('terminal', '中国', 'sea')
  console.log(`📊 中国主港口: ${mainPorts.count} 个，码头: ${terminals.count} 个`)
  
  // 按城市统计（仅统计中国的港口）
  const byCity = db.prepare(`
    SELECT city, COUNT(*) as count 
    FROM ports_of_loading 
    WHERE country = '中国' AND transport_type = 'sea'
    GROUP BY city 
    ORDER BY count DESC
  `).all()
  
  console.log('\n📈 按城市统计:')
  byCity.forEach(item => {
    console.log(`   ${item.city}: ${item.count} 个港口/码头`)
  })
} catch (error) {
  console.error('❌ 插入数据失败:', error)
  process.exit(1)
}

db.close()
console.log('\n✅ 数据库操作完成')

