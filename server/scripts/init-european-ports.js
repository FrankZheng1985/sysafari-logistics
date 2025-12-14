import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 欧洲和英国主要集装箱港口信息
const europeanPorts = [
  // 英国港口
  { portCode: 'GBLON', portNameCn: '伦敦港', portNameEn: 'London', country: '英国', countryCode: 'GB', city: '伦敦', description: '英国最大港口，世界重要集装箱港口' },
  { portCode: 'GBFEL', portNameCn: '费利克斯托港', portNameEn: 'Felixstowe', country: '英国', countryCode: 'GB', city: '费利克斯托', description: '英国最大集装箱港口' },
  { portCode: 'GBSOU', portNameCn: '南安普顿港', portNameEn: 'Southampton', country: '英国', countryCode: 'GB', city: '南安普顿', description: '英国重要集装箱港口' },
  { portCode: 'GBLIV', portNameCn: '利物浦港', portNameEn: 'Liverpool', country: '英国', countryCode: 'GB', city: '利物浦', description: '英国重要港口' },
  { portCode: 'GBTIL', portNameCn: '蒂尔伯里港', portNameEn: 'Tilbury', country: '英国', countryCode: 'GB', city: '蒂尔伯里', description: '英国重要港口' },
  { portCode: 'GBTHA', portNameCn: '泰晤士港', portNameEn: 'Thamesport', country: '英国', countryCode: 'GB', city: '泰晤士', description: '英国重要港口' },
  { portCode: 'GBHUL', portNameCn: '赫尔港', portNameEn: 'Hull', country: '英国', countryCode: 'GB', city: '赫尔', description: '英国重要港口' },
  { portCode: 'GBGRI', portNameCn: '格里姆斯比港', portNameEn: 'Grimsby', country: '英国', countryCode: 'GB', city: '格里姆斯比', description: '英国重要港口' },
  { portCode: 'GBTEE', portNameCn: '蒂斯港', portNameEn: 'Teesport', country: '英国', countryCode: 'GB', city: '蒂斯', description: '英国重要港口' },
  { portCode: 'GBBEL', portNameCn: '贝尔法斯特港', portNameEn: 'Belfast', country: '英国', countryCode: 'GB', city: '贝尔法斯特', description: '北爱尔兰重要港口' },
  
  // 荷兰港口
  { portCode: 'NLRTM', portNameCn: '鹿特丹港', portNameEn: 'Rotterdam', country: '荷兰', countryCode: 'NL', city: '鹿特丹', description: '欧洲最大港口，世界重要集装箱港口' },
  { portCode: 'NLAMS', portNameCn: '阿姆斯特丹港', portNameEn: 'Amsterdam', country: '荷兰', countryCode: 'NL', city: '阿姆斯特丹', description: '荷兰重要港口' },
  
  // 德国港口
  { portCode: 'DEHAM', portNameCn: '汉堡港', portNameEn: 'Hamburg', country: '德国', countryCode: 'DE', city: '汉堡', description: '德国最大港口，欧洲重要集装箱港口' },
  { portCode: 'DEBRE', portNameCn: '不来梅港', portNameEn: 'Bremerhaven', country: '德国', countryCode: 'DE', city: '不来梅', description: '德国重要集装箱港口' },
  { portCode: 'DEBRV', portNameCn: '不来梅港', portNameEn: 'Bremen', country: '德国', countryCode: 'DE', city: '不来梅', description: '德国重要港口' },
  { portCode: 'DEWIL', portNameCn: '威廉港', portNameEn: 'Wilhelmshaven', country: '德国', countryCode: 'DE', city: '威廉港', description: '德国重要港口' },
  
  // 比利时港口
  { portCode: 'BEANR', portNameCn: '安特卫普港', portNameEn: 'Antwerp', country: '比利时', countryCode: 'BE', city: '安特卫普', description: '比利时最大港口，欧洲重要集装箱港口' },
  { portCode: 'BEZEE', portNameCn: '泽布吕赫港', portNameEn: 'Zeebrugge', country: '比利时', countryCode: 'BE', city: '泽布吕赫', description: '比利时重要港口' },
  { portCode: 'BEGHE', portNameCn: '根特港', portNameEn: 'Ghent', country: '比利时', countryCode: 'BE', city: '根特', description: '比利时重要港口' },
  
  // 法国港口
  { portCode: 'FRLEH', portNameCn: '勒阿弗尔港', portNameEn: 'Le Havre', country: '法国', countryCode: 'FR', city: '勒阿弗尔', description: '法国最大集装箱港口' },
  { portCode: 'FRFOS', portNameCn: '福斯港', portNameEn: 'Fos-sur-Mer', country: '法国', countryCode: 'FR', city: '福斯', description: '法国重要集装箱港口' },
  { portCode: 'FRMAR', portNameCn: '马赛港', portNameEn: 'Marseille', country: '法国', countryCode: 'FR', city: '马赛', description: '法国重要港口' },
  { portCode: 'FRDUN', portNameCn: '敦刻尔克港', portNameEn: 'Dunkirk', country: '法国', countryCode: 'FR', city: '敦刻尔克', description: '法国重要港口' },
  { portCode: 'FRNAN', portNameCn: '南特港', portNameEn: 'Nantes', country: '法国', countryCode: 'FR', city: '南特', description: '法国重要港口' },
  
  // 西班牙港口
  { portCode: 'ESALG', portNameCn: '阿尔赫西拉斯港', portNameEn: 'Algeciras', country: '西班牙', countryCode: 'ES', city: '阿尔赫西拉斯', description: '西班牙最大集装箱港口，地中海重要港口' },
  { portCode: 'ESBCN', portNameCn: '巴塞罗那港', portNameEn: 'Barcelona', country: '西班牙', countryCode: 'ES', city: '巴塞罗那', description: '西班牙重要集装箱港口' },
  { portCode: 'ESVLC', portNameCn: '瓦伦西亚港', portNameEn: 'Valencia', country: '西班牙', countryCode: 'ES', city: '瓦伦西亚', description: '西班牙重要集装箱港口' },
  { portCode: 'ESBIL', portNameCn: '毕尔巴鄂港', portNameEn: 'Bilbao', country: '西班牙', countryCode: 'ES', city: '毕尔巴鄂', description: '西班牙重要港口' },
  { portCode: 'ESCAD', portNameCn: '加的斯港', portNameEn: 'Cadiz', country: '西班牙', countryCode: 'ES', city: '加的斯', description: '西班牙重要港口' },
  { portCode: 'ESMAD', portNameCn: '马德里港', portNameEn: 'Madrid', country: '西班牙', countryCode: 'ES', city: '马德里', description: '西班牙内陆港口' },
  
  // 意大利港口
  { portCode: 'ITGOA', portNameCn: '热那亚港', portNameEn: 'Genoa', country: '意大利', countryCode: 'IT', city: '热那亚', description: '意大利最大港口，地中海重要港口' },
  { portCode: 'ITGIT', portNameCn: '焦亚陶罗港', portNameEn: 'Gioia Tauro', country: '意大利', countryCode: 'IT', city: '焦亚陶罗', description: '意大利重要集装箱港口' },
  { portCode: 'ITLIV', portNameCn: '里窝那港', portNameEn: 'Livorno', country: '意大利', countryCode: 'IT', city: '里窝那', description: '意大利重要港口' },
  { portCode: 'ITNAP', portNameCn: '那不勒斯港', portNameEn: 'Naples', country: '意大利', countryCode: 'IT', city: '那不勒斯', description: '意大利重要港口' },
  { portCode: 'ITTAR', portNameCn: '塔兰托港', portNameEn: 'Taranto', country: '意大利', countryCode: 'IT', city: '塔兰托', description: '意大利重要港口' },
  { portCode: 'ITLAU', portNameCn: '拉文纳港', portNameEn: 'Ravenna', country: '意大利', countryCode: 'IT', city: '拉文纳', description: '意大利重要港口' },
  { portCode: 'ITVEN', portNameCn: '威尼斯港', portNameEn: 'Venice', country: '意大利', countryCode: 'IT', city: '威尼斯', description: '意大利重要港口' },
  { portCode: 'ITTRI', portNameCn: '的里雅斯特港', portNameEn: 'Trieste', country: '意大利', countryCode: 'IT', city: '的里雅斯特', description: '意大利重要港口' },
  
  // 希腊港口
  { portCode: 'GRPIR', portNameCn: '比雷埃夫斯港', portNameEn: 'Piraeus', country: '希腊', countryCode: 'GR', city: '比雷埃夫斯', description: '希腊最大港口，地中海重要港口' },
  { portCode: 'GRTHE', portNameCn: '塞萨洛尼基港', portNameEn: 'Thessaloniki', country: '希腊', countryCode: 'GR', city: '塞萨洛尼基', description: '希腊重要港口' },
  
  // 葡萄牙港口
  { portCode: 'PTLIS', portNameCn: '里斯本港', portNameEn: 'Lisbon', country: '葡萄牙', countryCode: 'PT', city: '里斯本', description: '葡萄牙最大港口' },
  { portCode: 'PTSIN', portNameCn: '锡尼什港', portNameEn: 'Sines', country: '葡萄牙', countryCode: 'PT', city: '锡尼什', description: '葡萄牙重要港口' },
  { portCode: 'PTPOR', portNameCn: '波尔图港', portNameEn: 'Porto', country: '葡萄牙', countryCode: 'PT', city: '波尔图', description: '葡萄牙重要港口' },
  
  // 丹麦港口
  { portCode: 'DKCPH', portNameCn: '哥本哈根港', portNameEn: 'Copenhagen', country: '丹麦', countryCode: 'DK', city: '哥本哈根', description: '丹麦最大港口' },
  { portCode: 'DKAAR', portNameCn: '奥胡斯港', portNameEn: 'Aarhus', country: '丹麦', countryCode: 'DK', city: '奥胡斯', description: '丹麦重要港口' },
  
  // 瑞典港口
  { portCode: 'SEGOT', portNameCn: '哥德堡港', portNameEn: 'Gothenburg', country: '瑞典', countryCode: 'SE', city: '哥德堡', description: '瑞典最大港口' },
  { portCode: 'SESTO', portNameCn: '斯德哥尔摩港', portNameEn: 'Stockholm', country: '瑞典', countryCode: 'SE', city: '斯德哥尔摩', description: '瑞典重要港口' },
  { portCode: 'SEMAL', portNameCn: '马尔默港', portNameEn: 'Malmo', country: '瑞典', countryCode: 'SE', city: '马尔默', description: '瑞典重要港口' },
  
  // 芬兰港口
  { portCode: 'FIHEL', portNameCn: '赫尔辛基港', portNameEn: 'Helsinki', country: '芬兰', countryCode: 'FI', city: '赫尔辛基', description: '芬兰最大港口' },
  { portCode: 'FIKOT', portNameCn: '科特卡港', portNameEn: 'Kotka', country: '芬兰', countryCode: 'FI', city: '科特卡', description: '芬兰重要港口' },
  
  // 挪威港口
  { portCode: 'NOOSL', portNameCn: '奥斯陆港', portNameEn: 'Oslo', country: '挪威', countryCode: 'NO', city: '奥斯陆', description: '挪威最大港口' },
  { portCode: 'NOBER', portNameCn: '卑尔根港', portNameEn: 'Bergen', country: '挪威', countryCode: 'NO', city: '卑尔根', description: '挪威重要港口' },
  
  // 波兰港口
  { portCode: 'PLGDN', portNameCn: '格但斯克港', portNameEn: 'Gdansk', country: '波兰', countryCode: 'PL', city: '格但斯克', description: '波兰最大港口' },
  { portCode: 'PLGDY', portNameCn: '格丁尼亚港', portNameEn: 'Gdynia', country: '波兰', countryCode: 'PL', city: '格丁尼亚', description: '波兰重要港口' },
  { portCode: 'PLSZZ', portNameCn: '什切青港', portNameEn: 'Szczecin', country: '波兰', countryCode: 'PL', city: '什切青', description: '波兰重要港口' },
  
  // 俄罗斯港口（欧洲部分）
  { portCode: 'RUSTP', portNameCn: '圣彼得堡港', portNameEn: 'Saint Petersburg', country: '俄罗斯', countryCode: 'RU', city: '圣彼得堡', description: '俄罗斯重要港口' },
  { portCode: 'RUKAL', portNameCn: '加里宁格勒港', portNameEn: 'Kaliningrad', country: '俄罗斯', countryCode: 'RU', city: '加里宁格勒', description: '俄罗斯重要港口' },
  
  // 土耳其港口（欧洲部分）
  { portCode: 'TRIST', portNameCn: '伊斯坦布尔港', portNameEn: 'Istanbul', country: '土耳其', countryCode: 'TR', city: '伊斯坦布尔', description: '土耳其最大港口，连接欧亚的重要港口' },
  { portCode: 'TRMRS', portNameCn: '梅尔辛港', portNameEn: 'Mersin', country: '土耳其', countryCode: 'TR', city: '梅尔辛', description: '土耳其重要港口' },
  
  // 其他欧洲国家港口
  { portCode: 'IEBEL', portNameCn: '贝尔法斯特港', portNameEn: 'Belfast', country: '爱尔兰', countryCode: 'IE', city: '贝尔法斯特', description: '爱尔兰重要港口' },
  { portCode: 'IEDUB', portNameCn: '都柏林港', portNameEn: 'Dublin', country: '爱尔兰', countryCode: 'IE', city: '都柏林', description: '爱尔兰最大港口' },
  { portCode: 'ATVIE', portNameCn: '维也纳港', portNameEn: 'Vienna', country: '奥地利', countryCode: 'AT', city: '维也纳', description: '奥地利重要内陆港口' },
  { portCode: 'CHBAS', portNameCn: '巴塞尔港', portNameEn: 'Basel', country: '瑞士', countryCode: 'CH', city: '巴塞尔', description: '瑞士重要内陆港口' },
  { portCode: 'CZPRA', portNameCn: '布拉格港', portNameEn: 'Prague', country: '捷克', countryCode: 'CZ', city: '布拉格', description: '捷克重要内陆港口' },
  { portCode: 'HUBUD', portNameCn: '布达佩斯港', portNameEn: 'Budapest', country: '匈牙利', countryCode: 'HU', city: '布达佩斯', description: '匈牙利重要内陆港口' },
  { portCode: 'ROCON', portNameCn: '康斯坦察港', portNameEn: 'Constanta', country: '罗马尼亚', countryCode: 'RO', city: '康斯坦察', description: '罗马尼亚最大港口' },
  { portCode: 'BGVRN', portNameCn: '瓦尔纳港', portNameEn: 'Varna', country: '保加利亚', countryCode: 'BG', city: '瓦尔纳', description: '保加利亚最大港口' },
]

// 检查表是否存在，如果不存在则创建
db.exec(`
  CREATE TABLE IF NOT EXISTS destination_ports (
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
  CREATE INDEX IF NOT EXISTS idx_dest_ports_code ON destination_ports(port_code);
  CREATE INDEX IF NOT EXISTS idx_dest_ports_name_cn ON destination_ports(port_name_cn);
  CREATE INDEX IF NOT EXISTS idx_dest_ports_country ON destination_ports(country);
  CREATE INDEX IF NOT EXISTS idx_dest_ports_status ON destination_ports(status);
`)

// 插入数据
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO destination_ports 
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
  insertMany(europeanPorts)
  console.log(`✅ 成功插入 ${europeanPorts.length} 条欧洲和英国港口数据`)
  
  // 统计插入的数据
  const count = db.prepare('SELECT COUNT(*) as count FROM destination_ports').get()
  console.log(`📊 数据库中现有 ${count.count} 条目的港记录`)
  
  // 按国家统计
  const byCountry = db.prepare(`
    SELECT country, COUNT(*) as count 
    FROM destination_ports 
    GROUP BY country 
    ORDER BY count DESC
  `).all()
  
  console.log('\n📈 按国家统计:')
  byCountry.forEach(item => {
    console.log(`   ${item.country}: ${item.count} 个港口`)
  })
} catch (error) {
  console.error('❌ 插入数据失败:', error)
  process.exit(1)
}

db.close()
console.log('\n✅ 数据库操作完成')

