import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 中国主要港口信息
const chinesePorts = [
  // 沿海主要港口
  { portCode: 'CNSHA', portNameCn: '上海港', portNameEn: 'Shanghai', country: '中国', countryCode: 'CN', city: '上海', description: '中国最大的港口，世界第一大集装箱港口' },
  { portCode: 'CNSZN', portNameCn: '深圳港', portNameEn: 'Shenzhen', country: '中国', countryCode: 'CN', city: '深圳', description: '中国第二大集装箱港口' },
  { portCode: 'CNNGB', portNameCn: '宁波舟山港', portNameEn: 'Ningbo-Zhoushan', country: '中国', countryCode: 'CN', city: '宁波', description: '世界第三大集装箱港口' },
  { portCode: 'CNTAO', portNameCn: '青岛港', portNameEn: 'Qingdao', country: '中国', countryCode: 'CN', city: '青岛', description: '中国北方重要港口' },
  { portCode: 'CNTXG', portNameCn: '天津港', portNameEn: 'Tianjin', country: '中国', countryCode: 'CN', city: '天津', description: '中国北方最大港口' },
  { portCode: 'CNCAN', portNameCn: '广州港', portNameEn: 'Guangzhou', country: '中国', countryCode: 'CN', city: '广州', description: '华南地区重要港口' },
  { portCode: 'CNDLC', portNameCn: '大连港', portNameEn: 'Dalian', country: '中国', countryCode: 'CN', city: '大连', description: '中国东北地区重要港口' },
  { portCode: 'CNXMN', portNameCn: '厦门港', portNameEn: 'Xiamen', country: '中国', countryCode: 'CN', city: '厦门', description: '中国东南沿海重要港口' },
  { portCode: 'CNLYG', portNameCn: '连云港', portNameEn: 'Lianyungang', country: '中国', countryCode: 'CN', city: '连云港', description: '新亚欧大陆桥东桥头堡' },
  { portCode: 'CNYTN', portNameCn: '烟台港', portNameEn: 'Yantai', country: '中国', countryCode: 'CN', city: '烟台', description: '山东半岛重要港口' },
  { portCode: 'CNRZH', portNameCn: '日照港', portNameEn: 'Rizhao', country: '中国', countryCode: 'CN', city: '日照', description: '中国重要能源港口' },
  { portCode: 'CNWEI', portNameCn: '威海港', portNameEn: 'Weihai', country: '中国', countryCode: 'CN', city: '威海', description: '山东半岛重要港口' },
  { portCode: 'CNQIN', portNameCn: '秦皇岛港', portNameEn: 'Qinhuangdao', country: '中国', countryCode: 'CN', city: '秦皇岛', description: '中国重要能源港口' },
  { portCode: 'CNTAN', portNameCn: '唐山港', portNameEn: 'Tangshan', country: '中国', countryCode: 'CN', city: '唐山', description: '中国重要港口' },
  { portCode: 'CNYAN', portNameCn: '营口港', portNameEn: 'Yingkou', country: '中国', countryCode: 'CN', city: '营口', description: '中国东北重要港口' },
  { portCode: 'CNJIN', portNameCn: '锦州港', portNameEn: 'Jinzhou', country: '中国', countryCode: 'CN', city: '锦州', description: '中国东北重要港口' },
  { portCode: 'CNFOC', portNameCn: '福州港', portNameEn: 'Fuzhou', country: '中国', countryCode: 'CN', city: '福州', description: '中国东南沿海重要港口' },
  { portCode: 'CNWEN', portNameCn: '温州港', portNameEn: 'Wenzhou', country: '中国', countryCode: 'CN', city: '温州', description: '中国东南沿海重要港口' },
  { portCode: 'CNTAI', portNameCn: '台州港', portNameEn: 'Taizhou', country: '中国', countryCode: 'CN', city: '台州', description: '中国东南沿海重要港口' },
  { portCode: 'CNZOS', portNameCn: '舟山港', portNameEn: 'Zhoushan', country: '中国', countryCode: 'CN', city: '舟山', description: '中国重要港口' },
  { portCode: 'CNJAX', portNameCn: '嘉兴港', portNameEn: 'Jiaxing', country: '中国', countryCode: 'CN', city: '嘉兴', description: '中国重要港口' },
  { portCode: 'CNBEI', portNameCn: '北海港', portNameEn: 'Beihai', country: '中国', countryCode: 'CN', city: '北海', description: '中国西南重要港口' },
  { portCode: 'CNFAN', portNameCn: '防城港', portNameEn: 'Fangchenggang', country: '中国', countryCode: 'CN', city: '防城港', description: '中国西南重要港口' },
  { portCode: 'CNQIZ', portNameCn: '钦州港', portNameEn: 'Qinzhou', country: '中国', countryCode: 'CN', city: '钦州', description: '中国西南重要港口' },
  { portCode: 'CNZHA', portNameCn: '湛江港', portNameEn: 'Zhanjiang', country: '中国', countryCode: 'CN', city: '湛江', description: '中国西南重要港口' },
  { portCode: 'CNYAJ', portNameCn: '阳江港', portNameEn: 'Yangjiang', country: '中国', countryCode: 'CN', city: '阳江', description: '中国重要港口' },
  { portCode: 'CNZHU', portNameCn: '珠海港', portNameEn: 'Zhuhai', country: '中国', countryCode: 'CN', city: '珠海', description: '中国重要港口' },
  { portCode: 'CNZHS', portNameCn: '中山港', portNameEn: 'Zhongshan', country: '中国', countryCode: 'CN', city: '中山', description: '中国重要港口' },
  { portCode: 'CNJIM', portNameCn: '江门港', portNameEn: 'Jiangmen', country: '中国', countryCode: 'CN', city: '江门', description: '中国重要港口' },
  { portCode: 'CNFOS', portNameCn: '佛山港', portNameEn: 'Foshan', country: '中国', countryCode: 'CN', city: '佛山', description: '中国重要港口' },
  { portCode: 'CNDON', portNameCn: '东莞港', portNameEn: 'Dongguan', country: '中国', countryCode: 'CN', city: '东莞', description: '中国重要港口' },
  { portCode: 'CNHUI', portNameCn: '惠州港', portNameEn: 'Huizhou', country: '中国', countryCode: 'CN', city: '惠州', description: '中国重要港口' },
  { portCode: 'CNSWE', portNameCn: '汕尾港', portNameEn: 'Shanwei', country: '中国', countryCode: 'CN', city: '汕尾', description: '中国重要港口' },
  { portCode: 'CNJEY', portNameCn: '揭阳港', portNameEn: 'Jieyang', country: '中国', countryCode: 'CN', city: '揭阳', description: '中国重要港口' },
  { portCode: 'CNSWT', portNameCn: '汕头港', portNameEn: 'Shantou', country: '中国', countryCode: 'CN', city: '汕头', description: '中国重要港口' },
  { portCode: 'CNCHZ', portNameCn: '潮州港', portNameEn: 'Chaozhou', country: '中国', countryCode: 'CN', city: '潮州', description: '中国重要港口' },
  
  // 内河主要港口
  { portCode: 'CNWHI', portNameCn: '武汉港', portNameEn: 'Wuhan', country: '中国', countryCode: 'CN', city: '武汉', description: '长江中游重要港口' },
  { portCode: 'CNNAN', portNameCn: '南京港', portNameEn: 'Nanjing', country: '中国', countryCode: 'CN', city: '南京', description: '长江下游重要港口' },
  { portCode: 'CNZHE', portNameCn: '镇江港', portNameEn: 'Zhenjiang', country: '中国', countryCode: 'CN', city: '镇江', description: '长江下游重要港口' },
  { portCode: 'CNCZH', portNameCn: '常州港', portNameEn: 'Changzhou', country: '中国', countryCode: 'CN', city: '常州', description: '长江下游重要港口' },
  { portCode: 'CNWUX', portNameCn: '无锡港', portNameEn: 'Wuxi', country: '中国', countryCode: 'CN', city: '无锡', description: '长江下游重要港口' },
  { portCode: 'CNSUZ', portNameCn: '苏州港', portNameEn: 'Suzhou', country: '中国', countryCode: 'CN', city: '苏州', description: '长江下游重要港口' },
  { portCode: 'CNTAC', portNameCn: '太仓港', portNameEn: 'Taicang', country: '中国', countryCode: 'CN', city: '太仓', description: '长江下游重要港口' },
  { portCode: 'CNCSH', portNameCn: '常熟港', portNameEn: 'Changshu', country: '中国', countryCode: 'CN', city: '常熟', description: '长江下游重要港口' },
  { portCode: 'CNJAY', portNameCn: '江阴港', portNameEn: 'Jiangyin', country: '中国', countryCode: 'CN', city: '江阴', description: '长江下游重要港口' },
  { portCode: 'CNYZH', portNameCn: '扬州港', portNameEn: 'Yangzhou', country: '中国', countryCode: 'CN', city: '扬州', description: '长江下游重要港口' },
  { portCode: 'CNTAZ', portNameCn: '泰州港', portNameEn: 'Taizhou', country: '中国', countryCode: 'CN', city: '泰州', description: '长江下游重要港口' },
  { portCode: 'CNYAC', portNameCn: '盐城港', portNameEn: 'Yancheng', country: '中国', countryCode: 'CN', city: '盐城', description: '中国重要港口' },
  { portCode: 'CNNAT', portNameCn: '南通港', portNameEn: 'Nantong', country: '中国', countryCode: 'CN', city: '南通', description: '长江下游重要港口' },
  { portCode: 'CNCHQ', portNameCn: '重庆港', portNameEn: 'Chongqing', country: '中国', countryCode: 'CN', city: '重庆', description: '长江上游重要港口' },
  { portCode: 'CNYIC', portNameCn: '宜昌港', portNameEn: 'Yichang', country: '中国', countryCode: 'CN', city: '宜昌', description: '长江中游重要港口' },
  { portCode: 'CNYUE', portNameCn: '岳阳港', portNameEn: 'Yueyang', country: '中国', countryCode: 'CN', city: '岳阳', description: '长江中游重要港口' },
  { portCode: 'CNJIU', portNameCn: '九江港', portNameEn: 'Jiujiang', country: '中国', countryCode: 'CN', city: '九江', description: '长江中游重要港口' },
  { portCode: 'CNWUH', portNameCn: '芜湖港', portNameEn: 'Wuhu', country: '中国', countryCode: 'CN', city: '芜湖', description: '长江中游重要港口' },
  { portCode: 'CNMA', portNameCn: '马鞍山港', portNameEn: 'Maanshan', country: '中国', countryCode: 'CN', city: '马鞍山', description: '长江中游重要港口' },
  { portCode: 'CNTON', portNameCn: '铜陵港', portNameEn: 'Tongling', country: '中国', countryCode: 'CN', city: '铜陵', description: '长江中游重要港口' },
  { portCode: 'CNANQ', portNameCn: '安庆港', portNameEn: 'Anqing', country: '中国', countryCode: 'CN', city: '安庆', description: '长江中游重要港口' },
  { portCode: 'CNPOY', portNameCn: '池州港', portNameEn: 'Chizhou', country: '中国', countryCode: 'CN', city: '池州', description: '长江中游重要港口' },
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
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ports_code ON ports_of_loading(port_code);
  CREATE INDEX IF NOT EXISTS idx_ports_name_cn ON ports_of_loading(port_name_cn);
  CREATE INDEX IF NOT EXISTS idx_ports_country ON ports_of_loading(country);
  CREATE INDEX IF NOT EXISTS idx_ports_status ON ports_of_loading(status);
`)

// 插入数据
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO ports_of_loading 
  (port_code, port_name_cn, port_name_en, country, country_code, city, description, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
`)

const insertMany = db.transaction((ports) => {
  for (const port of ports) {
    insertStmt.run(
      port.portCode,
      port.portNameCn,
      port.portNameEn,
      port.country,
      port.countryCode,
      port.city,
      port.description
    )
  }
})

try {
  insertMany(chinesePorts)
  console.log(`✅ 成功插入 ${chinesePorts.length} 条中国港口数据`)
  
  // 统计插入的数据
  const count = db.prepare('SELECT COUNT(*) as count FROM ports_of_loading WHERE country = ?').get('中国')
  console.log(`📊 数据库中现有 ${count.count} 条中国港口记录`)
} catch (error) {
  console.error('❌ 插入数据失败:', error)
  process.exit(1)
}

db.close()
console.log('✅ 数据库操作完成')

