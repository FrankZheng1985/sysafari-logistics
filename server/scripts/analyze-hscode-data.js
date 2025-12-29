/**
 * HS Code 数据分析脚本
 * 分析当前数据库中的 HS Code 数据状况
 * 
 * 用法: node scripts/analyze-hscode-data.js
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 阿里云 RDS 生产数据库连接信息
const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4ao.pg.rds.aliyuncs.com:5432/sysafari_logistics'

console.log('🔗 连接到阿里云 RDS PostgreSQL (香港)...')

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false  // 阿里云 RDS 不需要 SSL
})

async function analyzeHsCodeData() {
  console.log('=' .repeat(60))
  console.log('📊 HS Code 数据分析报告')
  console.log('=' .repeat(60))
  console.log('')
  
  try {
    // 1. 总体统计
    console.log('📌 1. 总体统计')
    console.log('-'.repeat(40))
    
    const totalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT hs_code) as unique_hs_codes,
        COUNT(CASE WHEN hs_code_10 IS NOT NULL AND hs_code_10 != '' THEN 1 END) as with_10digit,
        COUNT(CASE WHEN hs_code_10 IS NULL OR hs_code_10 = '' THEN 1 END) as without_10digit,
        COUNT(CASE WHEN LENGTH(hs_code) = 8 THEN 1 END) as hs_8digit,
        COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END) as hs_10digit,
        COUNT(CASE WHEN LENGTH(hs_code) < 8 THEN 1 END) as hs_less_8digit
      FROM tariff_rates
      WHERE is_active = 1
    `)
    
    const stats = totalStats.rows[0]
    console.log(`  总记录数: ${stats.total_records}`)
    console.log(`  唯一 HS Code 数: ${stats.unique_hs_codes}`)
    console.log(`  已有 10 位 HS Code: ${stats.with_10digit} (${(stats.with_10digit / stats.total_records * 100).toFixed(1)}%)`)
    console.log(`  缺少 10 位 HS Code: ${stats.without_10digit} (${(stats.without_10digit / stats.total_records * 100).toFixed(1)}%)`)
    console.log(`  主编码是 8 位: ${stats.hs_8digit}`)
    console.log(`  主编码是 10 位: ${stats.hs_10digit}`)
    console.log(`  主编码少于 8 位: ${stats.hs_less_8digit}`)
    console.log('')
    
    // 2. 按原产国统计
    console.log('📌 2. 按原产国统计')
    console.log('-'.repeat(40))
    
    const countryStats = await pool.query(`
      SELECT 
        COALESCE(origin_country, origin_country_code, '未知') as country,
        origin_country_code as code,
        COUNT(*) as total,
        COUNT(CASE WHEN hs_code_10 IS NOT NULL AND hs_code_10 != '' THEN 1 END) as with_10digit,
        COUNT(CASE WHEN hs_code_10 IS NULL OR hs_code_10 = '' THEN 1 END) as without_10digit
      FROM tariff_rates
      WHERE is_active = 1
      GROUP BY origin_country, origin_country_code
      ORDER BY total DESC
      LIMIT 20
    `)
    
    console.log('  国家/地区                  代码   总数    已有10位  缺少10位')
    console.log('  ' + '-'.repeat(56))
    for (const row of countryStats.rows) {
      const country = (row.country || '').substring(0, 20).padEnd(20)
      const code = (row.code || 'N/A').padEnd(4)
      const total = String(row.total).padStart(6)
      const with10 = String(row.with_10digit).padStart(8)
      const without10 = String(row.without_10digit).padStart(8)
      console.log(`  ${country}  ${code}  ${total}  ${with10}  ${without10}`)
    }
    console.log('')
    
    // 3. 专门分析中国原产地数据
    console.log('📌 3. 中国原产地数据详细分析')
    console.log('-'.repeat(40))
    
    const chinaStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN hs_code_10 IS NOT NULL AND hs_code_10 != '' THEN 1 END) as with_10digit,
        COUNT(CASE WHEN hs_code_10 IS NULL OR hs_code_10 = '' THEN 1 END) as without_10digit,
        COUNT(CASE WHEN LENGTH(hs_code) = 8 THEN 1 END) as hs_8digit,
        COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END) as hs_10digit,
        COUNT(CASE WHEN goods_description_cn IS NOT NULL AND goods_description_cn != '' THEN 1 END) as has_cn_desc
      FROM tariff_rates
      WHERE is_active = 1
        AND (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
    `)
    
    const china = chinaStats.rows[0]
    console.log(`  中国原产地总记录数: ${china.total}`)
    console.log(`  已有 10 位 HS Code: ${china.with_10digit} (${china.total > 0 ? (china.with_10digit / china.total * 100).toFixed(1) : 0}%)`)
    console.log(`  缺少 10 位 HS Code: ${china.without_10digit} (${china.total > 0 ? (china.without_10digit / china.total * 100).toFixed(1) : 0}%)`)
    console.log(`  主编码是 8 位: ${china.hs_8digit}`)
    console.log(`  主编码是 10 位: ${china.hs_10digit}`)
    console.log(`  有中文描述: ${china.has_cn_desc}`)
    console.log('')
    
    // 4. 查看部分中国原产地的样本数据
    console.log('📌 4. 中国原产地样本数据 (前20条)')
    console.log('-'.repeat(40))
    
    const chinaSamples = await pool.query(`
      SELECT 
        id, hs_code, hs_code_10, 
        SUBSTRING(goods_description, 1, 40) as description,
        SUBSTRING(goods_description_cn, 1, 30) as description_cn,
        duty_rate, anti_dumping_rate
      FROM tariff_rates
      WHERE is_active = 1
        AND (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
      ORDER BY id
      LIMIT 20
    `)
    
    console.log('  ID     HS编码      10位编码       关税%  反倾销%  描述')
    console.log('  ' + '-'.repeat(70))
    for (const row of chinaSamples.rows) {
      const id = String(row.id).padStart(5)
      const hs = (row.hs_code || '').padEnd(10)
      const hs10 = (row.hs_code_10 || 'NULL').padEnd(12)
      const duty = String(row.duty_rate || 0).padStart(5)
      const ad = String(row.anti_dumping_rate || 0).padStart(6)
      const desc = (row.description_cn || row.description || '').substring(0, 25)
      console.log(`  ${id}  ${hs}  ${hs10}  ${duty}  ${ad}  ${desc}`)
    }
    console.log('')
    
    // 5. 分析需要更新的数据
    console.log('📌 5. 需要更新的中国原产地数据统计')
    console.log('-'.repeat(40))
    
    const needUpdateStats = await pool.query(`
      SELECT 
        SUBSTRING(hs_code, 1, 2) as chapter,
        COUNT(*) as total,
        COUNT(CASE WHEN hs_code_10 IS NULL OR hs_code_10 = '' THEN 1 END) as need_update
      FROM tariff_rates
      WHERE is_active = 1
        AND (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND LENGTH(hs_code) = 8
        AND (hs_code_10 IS NULL OR hs_code_10 = '')
      GROUP BY SUBSTRING(hs_code, 1, 2)
      ORDER BY need_update DESC
      LIMIT 15
    `)
    
    console.log('  章节  总数    需要更新')
    console.log('  ' + '-'.repeat(25))
    for (const row of needUpdateStats.rows) {
      console.log(`  第${row.chapter}章  ${String(row.total).padStart(5)}  ${String(row.need_update).padStart(8)}`)
    }
    console.log('')
    
    // 6. 输出建议
    console.log('=' .repeat(60))
    console.log('💡 更新建议')
    console.log('=' .repeat(60))
    
    const needUpdate = parseInt(china.without_10digit) || 0
    
    if (needUpdate > 0) {
      console.log(`
📋 发现 ${needUpdate} 条中国原产地记录需要更新 10 位 HS Code

更新方案:
1. 基本扩展: 将 8 位 HS Code 后补 00，形成 10 位编码
   例如: 61091000 → 6109100000

2. 智能细分: 根据商品描述和材质信息，匹配更精确的 10 位细分编码
   例如: 61091000 (棉制T恤) → 6109100010 (男式棉制T恤)

推荐方案: 方案2 (智能细分)，可以提供更准确的税率查询

⚠️ 注意事项:
- 此操作将修改生产数据库
- 建议先在测试环境验证
- 执行前会备份相关数据
`)
    } else {
      console.log('\n✅ 所有中国原产地记录都已有 10 位 HS Code，无需更新')
    }
    
  } catch (error) {
    console.error('❌ 分析失败:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// 执行分析
analyzeHsCodeData()
  .then(() => {
    console.log('\n✅ 分析完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })

