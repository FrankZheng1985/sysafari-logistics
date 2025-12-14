import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, '..', 'data', 'orders.db')
const db = new Database(dbPath)

// 创建海运公司表
db.exec(`
  CREATE TABLE IF NOT EXISTS shipping_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    company_code TEXT NOT NULL UNIQUE,
    country TEXT,
    website TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 创建集装箱代码表
db.exec(`
  CREATE TABLE IF NOT EXISTS container_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipping_company_id INTEGER NOT NULL,
    container_code TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id),
    UNIQUE(shipping_company_id, container_code)
  )
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_company_code ON shipping_companies(company_code);
  CREATE INDEX IF NOT EXISTS idx_container_code ON container_codes(container_code);
  CREATE INDEX IF NOT EXISTS idx_container_company ON container_codes(shipping_company_id);
`)

// 插入海运公司数据
const shippingCompanies = [
  { name: '中远海运集装箱运输有限公司', code: 'COSCO', country: '中国', website: 'https://www.coscoshipping.com' },
  { name: '地中海航运公司', code: 'MSC', country: '瑞士', website: 'https://www.msc.com' },
  { name: '马士基航运', code: 'MAERSK', country: '丹麦', website: 'https://www.maersk.com' },
  { name: '达飞轮船', code: 'CMA CGM', country: '法国', website: 'https://www.cma-cgm.com' },
  { name: '赫伯罗特', code: 'HAPAG-LLOYD', country: '德国', website: 'https://www.hapag-lloyd.com' },
  { name: '长荣海运', code: 'EVERGREEN', country: '中国台湾', website: 'https://www.evergreen-line.com' },
  { name: 'ONE海洋网联', code: 'ONE', country: '日本', website: 'https://www.one-line.com' },
  { name: '阳明海运', code: 'YANG MING', country: '中国台湾', website: 'https://www.yangming.com' },
  { name: '现代商船', code: 'HMM', country: '韩国', website: 'https://www.hmm21.com' },
  { name: '以星航运', code: 'ZIM', country: '以色列', website: 'https://www.zim.com' },
  { name: '万海航运', code: 'WAN HAI', country: '中国台湾', website: 'https://www.wanhai.com' },
  { name: '太平船务', code: 'PIL', country: '新加坡', website: 'https://www.pilship.com' },
  { name: '中远海运特运', code: 'COSCO SHIPPING', country: '中国', website: 'https://www.coscoshipping.com' },
  { name: '东方海外', code: 'OOCL', country: '中国香港', website: 'https://www.oocl.com' },
  { name: '汉堡南美', code: 'HAMBURG SUD', country: '德国', website: 'https://www.hamburgsud.com' },
  { name: '美国总统轮船', code: 'APL', country: '新加坡', website: 'https://www.apl.com' },
  { name: '商船三井', code: 'MOL', country: '日本', website: 'https://www.mol.co.jp' },
  { name: '日本邮船', code: 'NYK', country: '日本', website: 'https://www.nyk.com' },
  { name: '川崎汽船', code: 'K LINE', country: '日本', website: 'https://www.kline.co.jp' },
  { name: '长锦商船', code: 'SINOKOR', country: '韩国', website: 'https://www.sinokor.co.kr' },
]

// 插入集装箱代码数据
const containerCodes = [
  // COSCO 集装箱代码
  { companyCode: 'COSCO', codes: ['COSU', 'CBHU', 'CCLU', 'CCOS', 'CCSU', 'CGMU', 'CINU', 'CITU', 'CLHU', 'CMAU', 'CMBU', 'CMDU', 'CMEU', 'CMFU', 'CMGU', 'CMHU', 'CMIU', 'CMJU', 'CMKU', 'CMLU', 'CMMU', 'CMNU', 'CMOU', 'CMPU', 'CMQU', 'CMRU', 'CMSU', 'CMTU', 'CMUU', 'CMVU', 'CMWU', 'CMXU', 'CMYU', 'CMZU'] },
  // MSC 集装箱代码
  { companyCode: 'MSC', codes: ['MSKU', 'MSMU', 'MSNU', 'MSOU', 'MSPU', 'MSQU', 'MSRU', 'MSSU', 'MSTU', 'MSUU', 'MSVU', 'MSWU', 'MSXU', 'MSYU', 'MSZU'] },
  // MAERSK 集装箱代码
  { companyCode: 'MAERSK', codes: ['MAEU', 'MAFU', 'MAGU', 'MAHU', 'MAIU', 'MAJU', 'MAKU', 'MALU', 'MAMU', 'MANU', 'MAOU', 'MAPU', 'MAQU', 'MARU', 'MASU', 'MATU', 'MAUU', 'MAVU', 'MAWU', 'MAXU', 'MAYU', 'MAZU'] },
  // CMA CGM 集装箱代码
  { companyCode: 'CMA CGM', codes: ['CMAU', 'CMBU', 'CMCU', 'CMDU', 'CMEU', 'CMFU', 'CMGU', 'CMHU', 'CMIU', 'CMJU', 'CMKU', 'CMLU', 'CMMU', 'CMNU', 'CMOU', 'CMPU', 'CMQU', 'CMRU', 'CMSU', 'CMTU', 'CMUU', 'CMVU', 'CMWU', 'CMXU', 'CMYU', 'CMZU'] },
  // HAPAG-LLOYD 集装箱代码
  { companyCode: 'HAPAG-LLOYD', codes: ['HLBU', 'HLDU', 'HLEU', 'HLFU', 'HLGU', 'HLHU', 'HLIU', 'HLJU', 'HLKU', 'HLLU', 'HLMU', 'HLNU', 'HLOU', 'HLPU', 'HLQU', 'HLRU', 'HLSU', 'HLTU', 'HLUU', 'HLVU', 'HLWU', 'HLXU', 'HLYU', 'HLZU'] },
  // EVERGREEN 集装箱代码
  { companyCode: 'EVERGREEN', codes: ['EGLV', 'EGLU', 'EGMU', 'EGNU', 'EGOU', 'EGPU', 'EGQU', 'EGRU', 'EGSU', 'EGTU', 'EGUU', 'EGVU', 'EGWU', 'EGXU', 'EGYU', 'EGZU'] },
  // ONE 集装箱代码
  { companyCode: 'ONE', codes: ['ONEU', 'ONFU', 'ONGU', 'ONHU', 'ONIU', 'ONJU', 'ONKU', 'ONLU', 'ONMU', 'ONNU', 'ONOU', 'ONPU', 'ONQU', 'ONRU', 'ONSU', 'ONTU', 'ONUU', 'ONVU', 'ONWU', 'ONXU', 'ONYU', 'ONZU'] },
  // YANG MING 集装箱代码
  { companyCode: 'YANG MING', codes: ['YMLU', 'YMMU', 'YMNU', 'YMOU', 'YMPU', 'YMQU', 'YMRU', 'YMSU', 'YMTU', 'YMUU', 'YMVU', 'YMWU', 'YMXU', 'YMYU', 'YMZU'] },
  // HMM 集装箱代码
  { companyCode: 'HMM', codes: ['HMMU', 'HMNU', 'HMOU', 'HMPU', 'HMQU', 'HMRU', 'HMSU', 'HMTU', 'HMUU', 'HMVU', 'HMWU', 'HMXU', 'HMYU', 'HMZU'] },
  // ZIM 集装箱代码
  { companyCode: 'ZIM', codes: ['ZIMU', 'ZINU', 'ZIOU', 'ZIPU', 'ZIQU', 'ZIRU', 'ZISU', 'ZITU', 'ZIUU', 'ZIVU', 'ZIWU', 'ZIXU', 'ZIYU', 'ZIZU'] },
  // WAN HAI 集装箱代码
  { companyCode: 'WAN HAI', codes: ['WHLU', 'WHMU', 'WHNU', 'WHOU', 'WHPU', 'WHQU', 'WHRU', 'WHSU', 'WHTU', 'WHUU', 'WHVU', 'WHWU', 'WHXU', 'WHYU', 'WHZU'] },
  // PIL 集装箱代码
  { companyCode: 'PIL', codes: ['PILU', 'PINU', 'PIOU', 'PIPU', 'PIQU', 'PIRU', 'PISU', 'PITU', 'PIUU', 'PIVU', 'PIWU', 'PIXU', 'PIYU', 'PIZU'] },
  // OOCL 集装箱代码
  { companyCode: 'OOCL', codes: ['OOLU', 'OOMU', 'OONU', 'OOOU', 'OOPU', 'OOQU', 'OORU', 'OOSU', 'OOTU', 'OOUU', 'OOVU', 'OOWU', 'OOXU', 'OOYU', 'OOZU'] },
  // HAMBURG SUD 集装箱代码
  { companyCode: 'HAMBURG SUD', codes: ['HASU', 'HATU', 'HAUU', 'HAVU', 'HAWU', 'HAXU', 'HAYU', 'HAZU'] },
  // APL 集装箱代码
  { companyCode: 'APL', codes: ['APLU', 'APMU', 'APNU', 'APOU', 'APPU', 'APQU', 'APRU', 'APSU', 'APTU', 'APUU', 'APVU', 'APWU', 'APXU', 'APYU', 'APZU'] },
  // MOL 集装箱代码
  { companyCode: 'MOL', codes: ['MOLU', 'MONU', 'MOOU', 'MOPU', 'MOQU', 'MORU', 'MOSU', 'MOTU', 'MOUU', 'MOVU', 'MOWU', 'MOXU', 'MOYU', 'MOZU'] },
  // NYK 集装箱代码
  { companyCode: 'NYK', codes: ['NYKU', 'NYNU', 'NYOU', 'NYPU', 'NYQU', 'NYRU', 'NYSU', 'NYTU', 'NYUU', 'NYVU', 'NYWU', 'NYXU', 'NYYU', 'NYZU'] },
  // K LINE 集装箱代码
  { companyCode: 'K LINE', codes: ['KLNU', 'KLOU', 'KLPU', 'KLQU', 'KLRU', 'KLSU', 'KLTU', 'KLUU', 'KLVU', 'KLWU', 'KLXU', 'KLYU', 'KLZU'] },
  // SINOKOR 集装箱代码
  { companyCode: 'SINOKOR', codes: ['SKLU', 'SKMU', 'SKNU', 'SKOU', 'SKPU', 'SKQU', 'SKRU', 'SKSU', 'SKTU', 'SKUU', 'SKVU', 'SKWU', 'SKXU', 'SKYU', 'SKZU'] },
]

// 插入海运公司
const insertCompany = db.prepare(`
  INSERT OR REPLACE INTO shipping_companies (company_name, company_code, country, website)
  VALUES (?, ?, ?, ?)
`)

// 插入集装箱代码
const insertContainerCode = db.prepare(`
  INSERT OR REPLACE INTO container_codes (shipping_company_id, container_code, description)
  VALUES (?, ?, ?)
`)

// 获取公司ID
const getCompanyId = db.prepare(`
  SELECT id FROM shipping_companies WHERE company_code = ?
`)

// 开始事务
const insertTransaction = db.transaction((companies, codes) => {
  // 插入公司
  for (const company of companies) {
    insertCompany.run(company.name, company.code, company.country, company.website)
  }

  // 插入集装箱代码
  for (const codeGroup of codes) {
    const companyId = getCompanyId.get(codeGroup.companyCode)?.id
    if (companyId) {
      for (const code of codeGroup.codes) {
        insertContainerCode.run(companyId, code, `${codeGroup.companyCode} 集装箱代码`)
      }
    }
  }
})

insertTransaction(shippingCompanies, containerCodes)

console.log('✅ 海运公司和集装箱代码数据初始化完成')
console.log(`   已插入 ${shippingCompanies.length} 家海运公司`)
console.log(`   已插入 ${containerCodes.reduce((sum, group) => sum + group.codes.length, 0)} 个集装箱代码`)

db.close()

