import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 全球主要国家信息
const countries = [
  // 亚洲
  { countryCode: 'CN', countryNameCn: '中国', countryNameEn: 'China', continent: '亚洲', region: '东亚', capital: '北京', currencyCode: 'CNY', currencyName: '人民币', phoneCode: '+86', timezone: 'UTC+8', description: '中华人民共和国' },
  { countryCode: 'JP', countryNameCn: '日本', countryNameEn: 'Japan', continent: '亚洲', region: '东亚', capital: '东京', currencyCode: 'JPY', currencyName: '日元', phoneCode: '+81', timezone: 'UTC+9', description: '日本国' },
  { countryCode: 'KR', countryNameCn: '韩国', countryNameEn: 'South Korea', continent: '亚洲', region: '东亚', capital: '首尔', currencyCode: 'KRW', currencyName: '韩元', phoneCode: '+82', timezone: 'UTC+9', description: '大韩民国' },
  { countryCode: 'TW', countryNameCn: '中国台湾', countryNameEn: 'Taiwan', continent: '亚洲', region: '东亚', capital: '台北', currencyCode: 'TWD', currencyName: '新台币', phoneCode: '+886', timezone: 'UTC+8', description: '台湾地区' },
  { countryCode: 'HK', countryNameCn: '中国香港', countryNameEn: 'Hong Kong', continent: '亚洲', region: '东亚', capital: '香港', currencyCode: 'HKD', currencyName: '港币', phoneCode: '+852', timezone: 'UTC+8', description: '香港特别行政区' },
  { countryCode: 'MO', countryNameCn: '中国澳门', countryNameEn: 'Macau', continent: '亚洲', region: '东亚', capital: '澳门', currencyCode: 'MOP', currencyName: '澳门元', phoneCode: '+853', timezone: 'UTC+8', description: '澳门特别行政区' },
  { countryCode: 'SG', countryNameCn: '新加坡', countryNameEn: 'Singapore', continent: '亚洲', region: '东南亚', capital: '新加坡', currencyCode: 'SGD', currencyName: '新加坡元', phoneCode: '+65', timezone: 'UTC+8', description: '新加坡共和国' },
  { countryCode: 'MY', countryNameCn: '马来西亚', countryNameEn: 'Malaysia', continent: '亚洲', region: '东南亚', capital: '吉隆坡', currencyCode: 'MYR', currencyName: '马来西亚林吉特', phoneCode: '+60', timezone: 'UTC+8', description: '马来西亚' },
  { countryCode: 'TH', countryNameCn: '泰国', countryNameEn: 'Thailand', continent: '亚洲', region: '东南亚', capital: '曼谷', currencyCode: 'THB', currencyName: '泰铢', phoneCode: '+66', timezone: 'UTC+7', description: '泰王国' },
  { countryCode: 'VN', countryNameCn: '越南', countryNameEn: 'Vietnam', continent: '亚洲', region: '东南亚', capital: '河内', currencyCode: 'VND', currencyName: '越南盾', phoneCode: '+84', timezone: 'UTC+7', description: '越南社会主义共和国' },
  { countryCode: 'ID', countryNameCn: '印度尼西亚', countryNameEn: 'Indonesia', continent: '亚洲', region: '东南亚', capital: '雅加达', currencyCode: 'IDR', currencyName: '印尼盾', phoneCode: '+62', timezone: 'UTC+7', description: '印度尼西亚共和国' },
  { countryCode: 'PH', countryNameCn: '菲律宾', countryNameEn: 'Philippines', continent: '亚洲', region: '东南亚', capital: '马尼拉', currencyCode: 'PHP', currencyName: '菲律宾比索', phoneCode: '+63', timezone: 'UTC+8', description: '菲律宾共和国' },
  { countryCode: 'IN', countryNameCn: '印度', countryNameEn: 'India', continent: '亚洲', region: '南亚', capital: '新德里', currencyCode: 'INR', currencyName: '印度卢比', phoneCode: '+91', timezone: 'UTC+5:30', description: '印度共和国' },
  { countryCode: 'PK', countryNameCn: '巴基斯坦', countryNameEn: 'Pakistan', continent: '亚洲', region: '南亚', capital: '伊斯兰堡', currencyCode: 'PKR', currencyName: '巴基斯坦卢比', phoneCode: '+92', timezone: 'UTC+5', description: '巴基斯坦伊斯兰共和国' },
  { countryCode: 'BD', countryNameCn: '孟加拉国', countryNameEn: 'Bangladesh', continent: '亚洲', region: '南亚', capital: '达卡', currencyCode: 'BDT', currencyName: '孟加拉塔卡', phoneCode: '+880', timezone: 'UTC+6', description: '孟加拉人民共和国' },
  { countryCode: 'SA', countryNameCn: '沙特阿拉伯', countryNameEn: 'Saudi Arabia', continent: '亚洲', region: '西亚', capital: '利雅得', currencyCode: 'SAR', currencyName: '沙特里亚尔', phoneCode: '+966', timezone: 'UTC+3', description: '沙特阿拉伯王国' },
  { countryCode: 'AE', countryNameCn: '阿联酋', countryNameEn: 'United Arab Emirates', continent: '亚洲', region: '西亚', capital: '阿布扎比', currencyCode: 'AED', currencyName: '阿联酋迪拉姆', phoneCode: '+971', timezone: 'UTC+4', description: '阿拉伯联合酋长国' },
  { countryCode: 'IL', countryNameCn: '以色列', countryNameEn: 'Israel', continent: '亚洲', region: '西亚', capital: '耶路撒冷', currencyCode: 'ILS', currencyName: '以色列新谢克尔', phoneCode: '+972', timezone: 'UTC+2', description: '以色列国' },
  { countryCode: 'TR', countryNameCn: '土耳其', countryNameEn: 'Turkey', continent: '亚洲', region: '西亚', capital: '安卡拉', currencyCode: 'TRY', currencyName: '土耳其里拉', phoneCode: '+90', timezone: 'UTC+3', description: '土耳其共和国' },
  { countryCode: 'RU', countryNameCn: '俄罗斯', countryNameEn: 'Russia', continent: '亚洲', region: '东欧/北亚', capital: '莫斯科', currencyCode: 'RUB', currencyName: '俄罗斯卢布', phoneCode: '+7', timezone: 'UTC+3', description: '俄罗斯联邦' },
  
  // 欧洲
  { countryCode: 'GB', countryNameCn: '英国', countryNameEn: 'United Kingdom', continent: '欧洲', region: '西欧', capital: '伦敦', currencyCode: 'GBP', currencyName: '英镑', phoneCode: '+44', timezone: 'UTC+0', description: '大不列颠及北爱尔兰联合王国' },
  { countryCode: 'DE', countryNameCn: '德国', countryNameEn: 'Germany', continent: '欧洲', region: '中欧', capital: '柏林', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+49', timezone: 'UTC+1', description: '德意志联邦共和国' },
  { countryCode: 'FR', countryNameCn: '法国', countryNameEn: 'France', continent: '欧洲', region: '西欧', capital: '巴黎', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+33', timezone: 'UTC+1', description: '法兰西共和国' },
  { countryCode: 'IT', countryNameCn: '意大利', countryNameEn: 'Italy', continent: '欧洲', region: '南欧', capital: '罗马', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+39', timezone: 'UTC+1', description: '意大利共和国' },
  { countryCode: 'ES', countryNameCn: '西班牙', countryNameEn: 'Spain', continent: '欧洲', region: '南欧', capital: '马德里', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+34', timezone: 'UTC+1', description: '西班牙王国' },
  { countryCode: 'NL', countryNameCn: '荷兰', countryNameEn: 'Netherlands', continent: '欧洲', region: '西欧', capital: '阿姆斯特丹', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+31', timezone: 'UTC+1', description: '荷兰王国' },
  { countryCode: 'BE', countryNameCn: '比利时', countryNameEn: 'Belgium', continent: '欧洲', region: '西欧', capital: '布鲁塞尔', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+32', timezone: 'UTC+1', description: '比利时王国' },
  { countryCode: 'CH', countryNameCn: '瑞士', countryNameEn: 'Switzerland', continent: '欧洲', region: '中欧', capital: '伯尔尼', currencyCode: 'CHF', currencyName: '瑞士法郎', phoneCode: '+41', timezone: 'UTC+1', description: '瑞士联邦' },
  { countryCode: 'AT', countryNameCn: '奥地利', countryNameEn: 'Austria', continent: '欧洲', region: '中欧', capital: '维也纳', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+43', timezone: 'UTC+1', description: '奥地利共和国' },
  { countryCode: 'SE', countryNameCn: '瑞典', countryNameEn: 'Sweden', continent: '欧洲', region: '北欧', capital: '斯德哥尔摩', currencyCode: 'SEK', currencyName: '瑞典克朗', phoneCode: '+46', timezone: 'UTC+1', description: '瑞典王国' },
  { countryCode: 'NO', countryNameCn: '挪威', countryNameEn: 'Norway', continent: '欧洲', region: '北欧', capital: '奥斯陆', currencyCode: 'NOK', currencyName: '挪威克朗', phoneCode: '+47', timezone: 'UTC+1', description: '挪威王国' },
  { countryCode: 'DK', countryNameCn: '丹麦', countryNameEn: 'Denmark', continent: '欧洲', region: '北欧', capital: '哥本哈根', currencyCode: 'DKK', currencyName: '丹麦克朗', phoneCode: '+45', timezone: 'UTC+1', description: '丹麦王国' },
  { countryCode: 'FI', countryNameCn: '芬兰', countryNameEn: 'Finland', continent: '欧洲', region: '北欧', capital: '赫尔辛基', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+358', timezone: 'UTC+2', description: '芬兰共和国' },
  { countryCode: 'PL', countryNameCn: '波兰', countryNameEn: 'Poland', continent: '欧洲', region: '东欧', capital: '华沙', currencyCode: 'PLN', currencyName: '波兰兹罗提', phoneCode: '+48', timezone: 'UTC+1', description: '波兰共和国' },
  { countryCode: 'GR', countryNameCn: '希腊', countryNameEn: 'Greece', continent: '欧洲', region: '南欧', capital: '雅典', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+30', timezone: 'UTC+2', description: '希腊共和国' },
  { countryCode: 'PT', countryNameCn: '葡萄牙', countryNameEn: 'Portugal', continent: '欧洲', region: '南欧', capital: '里斯本', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+351', timezone: 'UTC+0', description: '葡萄牙共和国' },
  { countryCode: 'IE', countryNameCn: '爱尔兰', countryNameEn: 'Ireland', continent: '欧洲', region: '西欧', capital: '都柏林', currencyCode: 'EUR', currencyName: '欧元', phoneCode: '+353', timezone: 'UTC+0', description: '爱尔兰共和国' },
  
  // 北美洲
  { countryCode: 'US', countryNameCn: '美国', countryNameEn: 'United States', continent: '北美洲', region: '北美', capital: '华盛顿', currencyCode: 'USD', currencyName: '美元', phoneCode: '+1', timezone: 'UTC-5', description: '美利坚合众国' },
  { countryCode: 'CA', countryNameCn: '加拿大', countryNameEn: 'Canada', continent: '北美洲', region: '北美', capital: '渥太华', currencyCode: 'CAD', currencyName: '加拿大元', phoneCode: '+1', timezone: 'UTC-5', description: '加拿大' },
  { countryCode: 'MX', countryNameCn: '墨西哥', countryNameEn: 'Mexico', continent: '北美洲', region: '中美洲', capital: '墨西哥城', currencyCode: 'MXN', currencyName: '墨西哥比索', phoneCode: '+52', timezone: 'UTC-6', description: '墨西哥合众国' },
  
  // 南美洲
  { countryCode: 'BR', countryNameCn: '巴西', countryNameEn: 'Brazil', continent: '南美洲', region: '南美', capital: '巴西利亚', currencyCode: 'BRL', currencyName: '巴西雷亚尔', phoneCode: '+55', timezone: 'UTC-3', description: '巴西联邦共和国' },
  { countryCode: 'AR', countryNameCn: '阿根廷', countryNameEn: 'Argentina', continent: '南美洲', region: '南美', capital: '布宜诺斯艾利斯', currencyCode: 'ARS', currencyName: '阿根廷比索', phoneCode: '+54', timezone: 'UTC-3', description: '阿根廷共和国' },
  { countryCode: 'CL', countryNameCn: '智利', countryNameEn: 'Chile', continent: '南美洲', region: '南美', capital: '圣地亚哥', currencyCode: 'CLP', currencyName: '智利比索', phoneCode: '+56', timezone: 'UTC-3', description: '智利共和国' },
  
  // 非洲
  { countryCode: 'ZA', countryNameCn: '南非', countryNameEn: 'South Africa', continent: '非洲', region: '南部非洲', capital: '开普敦', currencyCode: 'ZAR', currencyName: '南非兰特', phoneCode: '+27', timezone: 'UTC+2', description: '南非共和国' },
  { countryCode: 'EG', countryNameCn: '埃及', countryNameEn: 'Egypt', continent: '非洲', region: '北非', capital: '开罗', currencyCode: 'EGP', currencyName: '埃及镑', phoneCode: '+20', timezone: 'UTC+2', description: '阿拉伯埃及共和国' },
  { countryCode: 'NG', countryNameCn: '尼日利亚', countryNameEn: 'Nigeria', continent: '非洲', region: '西非', capital: '阿布贾', currencyCode: 'NGN', currencyName: '尼日利亚奈拉', phoneCode: '+234', timezone: 'UTC+1', description: '尼日利亚联邦共和国' },
  { countryCode: 'KE', countryNameCn: '肯尼亚', countryNameEn: 'Kenya', continent: '非洲', region: '东非', capital: '内罗毕', currencyCode: 'KES', currencyName: '肯尼亚先令', phoneCode: '+254', timezone: 'UTC+3', description: '肯尼亚共和国' },
  
  // 大洋洲
  { countryCode: 'AU', countryNameCn: '澳大利亚', countryNameEn: 'Australia', continent: '大洋洲', region: '大洋洲', capital: '堪培拉', currencyCode: 'AUD', currencyName: '澳大利亚元', phoneCode: '+61', timezone: 'UTC+10', description: '澳大利亚联邦' },
  { countryCode: 'NZ', countryNameCn: '新西兰', countryNameEn: 'New Zealand', continent: '大洋洲', region: '大洋洲', capital: '惠灵顿', currencyCode: 'NZD', currencyName: '新西兰元', phoneCode: '+64', timezone: 'UTC+12', description: '新西兰' },
]

// 检查表是否存在，如果不存在则创建
db.exec(`
  CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code TEXT NOT NULL UNIQUE,
    country_name_cn TEXT NOT NULL,
    country_name_en TEXT NOT NULL,
    continent TEXT,
    region TEXT,
    capital TEXT,
    currency_code TEXT,
    currency_name TEXT,
    phone_code TEXT,
    timezone TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(country_code);
  CREATE INDEX IF NOT EXISTS idx_countries_name_cn ON countries(country_name_cn);
  CREATE INDEX IF NOT EXISTS idx_countries_name_en ON countries(country_name_en);
  CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);
  CREATE INDEX IF NOT EXISTS idx_countries_status ON countries(status);
`)

// 插入数据
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO countries 
  (country_code, country_name_cn, country_name_en, continent, region, capital, currency_code, currency_name, phone_code, timezone, description, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
`)

const insertMany = db.transaction((countries) => {
  for (const country of countries) {
    insertStmt.run(
      country.countryCode,
      country.countryNameCn,
      country.countryNameEn,
      country.continent,
      country.region,
      country.capital,
      country.currencyCode,
      country.currencyName,
      country.phoneCode,
      country.timezone,
      country.description
    )
  }
})

try {
  insertMany(countries)
  console.log(`✅ 成功插入 ${countries.length} 条国家数据`)
  
  // 统计插入的数据
  const count = db.prepare('SELECT COUNT(*) as count FROM countries').get()
  console.log(`📊 数据库中现有 ${count.count} 条国家记录`)
  
  // 按大洲统计
  const byContinent = db.prepare(`
    SELECT continent, COUNT(*) as count 
    FROM countries 
    GROUP BY continent 
    ORDER BY count DESC
  `).all()
  
  console.log('\n📈 按大洲统计:')
  byContinent.forEach(item => {
    console.log(`   ${item.continent}: ${item.count} 个国家`)
  })
} catch (error) {
  console.error('❌ 插入数据失败:', error)
  process.exit(1)
}

db.close()
console.log('\n✅ 数据库操作完成')

