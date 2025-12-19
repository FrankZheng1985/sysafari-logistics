/**
 * 中国原产国HS code数据补充脚本
 * 从 chinaAntiDumpingRates.js 导入数据到数据库，并补充详细信息
 * 
 * 重要说明：
 * - VAT税率不在此脚本中设置，设为NULL
 * - VAT税率需根据实际货物进口国从vat_rates表动态查询
 * - 不同欧盟成员国的VAT税率不同（如德国19%，法国20%，意大利22%等）
 * 
 * 使用方法: node server/scripts/seed-china-hs-codes.js
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { CHINA_ANTI_DUMPING_RATES } from '../modules/taric/chinaAntiDumpingRates.js'
import { COMMON_DUTY_RATES } from '../modules/taric/commonDutyRates.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '../.env') })

const { Pool } = pg

// HS编码到单位的映射（根据HS编码前2位或4位判断）
const HS_UNIT_MAPPING = {
  // 第61-63章：纺织服装
  '61': { unitCode: 'PCS', unitName: '件' },
  '62': { unitCode: 'PCS', unitName: '件' },
  '63': { unitCode: 'PCS', unitName: '件' },
  // 第64章：鞋类
  '64': { unitCode: 'PR', unitName: '双' },
  // 第69章：陶瓷制品
  '6911': { unitCode: 'SET', unitName: '套' },
  '6912': { unitCode: 'SET', unitName: '套' },
  '6913': { unitCode: 'SET', unitName: '套' },
  '6914': { unitCode: 'SET', unitName: '套' },
  // 第70章：玻璃制品
  '70': { unitCode: 'PCS', unitName: '件' },
  // 第73章：钢铁制品
  '73': { unitCode: 'KGM', unitName: '千克' },
  // 第76章：铝制品
  '76': { unitCode: 'KGM', unitName: '千克' },
  // 第84章：机械设备
  '84': { unitCode: 'PCE', unitName: '件' },
  // 第85章：电气设备
  '85': { unitCode: 'PCE', unitName: '件' },
  // 第94章：家具
  '9401': { unitCode: 'PCS', unitName: '件' },
  '9403': { unitCode: 'PCS', unitName: '件' },
  '9405': { unitCode: 'PCS', unitName: '件' },
  // 第95章：玩具
  '95': { unitCode: 'PCS', unitName: '件' },
  // 第96章：杂项制品
  '96': { unitCode: 'PCS', unitName: '件' },
  // 默认
  'default': { unitCode: 'PCS', unitName: '件' }
}

// HS编码到材料的映射
const HS_MATERIAL_MAPPING = {
  '61': '纺织材料',
  '62': '纺织材料',
  '63': '纺织材料',
  '64': '皮革/橡胶/塑料/纺织',
  '69': '陶瓷',
  '70': '玻璃',
  '73': '钢铁',
  '76': '铝',
  '84': '金属/塑料',
  '85': '电子元件/塑料/金属',
  '94': '木材/金属/塑料',
  '95': '塑料/纺织',
  '96': '塑料/金属/纺织'
}

// HS编码到用途的映射
const HS_USAGE_MAPPING = {
  '61': '服装',
  '62': '服装',
  '63': '家用纺织品',
  '64': '鞋类',
  '69': '餐具/厨房用具',
  '70': '玻璃器皿',
  '73': '金属制品',
  '76': '铝制品',
  '84': '机械设备',
  '85': '电子设备',
  '94': '家具',
  '95': '玩具/游戏',
  '96': '日用品'
}

/**
 * 根据HS编码获取单位信息
 */
function getUnitInfo(hsCode) {
  const code2 = hsCode.substring(0, 2)
  const code4 = hsCode.substring(0, 4)
  
  // 优先匹配4位编码
  if (HS_UNIT_MAPPING[code4]) {
    return HS_UNIT_MAPPING[code4]
  }
  // 再匹配2位编码
  if (HS_UNIT_MAPPING[code2]) {
    return HS_UNIT_MAPPING[code2]
  }
  // 默认
  return HS_UNIT_MAPPING['default']
}

/**
 * 根据HS编码获取材料信息
 */
function getMaterialInfo(hsCode) {
  const code2 = hsCode.substring(0, 2)
  return HS_MATERIAL_MAPPING[code2] || '其他'
}

/**
 * 根据HS编码获取用途信息
 */
function getUsageInfo(hsCode) {
  const code2 = hsCode.substring(0, 2)
  return HS_USAGE_MAPPING[code2] || '其他'
}

/**
 * 从反倾销数据中提取所有HS编码并转换为数据库格式
 */
function extractHsCodesFromAntiDumping() {
  const rates = []
  
  for (const [code4, chapter] of Object.entries(CHINA_ANTI_DUMPING_RATES)) {
    if (chapter.measures && Array.isArray(chapter.measures)) {
      for (const measure of chapter.measures) {
        const hsCode8 = measure.hsCode8
        const hsCode10 = hsCode8.padEnd(10, '0')
        
        const unitInfo = getUnitInfo(hsCode8)
        const material = getMaterialInfo(hsCode8)
        const usage = getUsageInfo(hsCode8)
        
        rates.push({
          hsCode: hsCode8,
          hsCode10: hsCode10,
          goodsDescription: measure.description || chapter.description || '',
          goodsDescriptionCn: measure.descriptionCn || chapter.descriptionCn || '',
          originCountry: '中国',
          originCountryCode: 'CN',
          dutyRate: measure.dutyRate || 0,
          dutyRateType: 'percentage',
          vatRate: null, // VAT税率根据进口国动态查询，不在此处设置
          antiDumpingRate: measure.antiDumpingRate || 0,
          countervailingRate: measure.countervailingRate || 0,
          unitCode: unitInfo.unitCode,
          unitName: unitInfo.unitName,
          material: material,
          usageScenario: usage,
          measureType: measure.antiDumpingRate > 0 ? 'anti_dumping' : null,
          legalBase: measure.regulationId || null,
          startDate: measure.validFrom || null,
          footnotes: measure.note || null,
          dataSource: 'china_anti_dumping_database',
          isActive: 1
        })
      }
    }
  }
  
  return rates
}

/**
 * 从常用税率数据中提取中国常见出口商品HS编码
 * 这些是中国主要出口到欧盟的商品类别
 */
function extractCommonChinaExportHsCodes() {
  const rates = []
  
  // 中国主要出口商品类别（根据HS编码前4位）
  const chinaExportCategories = [
    '8471', // 自动数据处理设备（电脑）
    '8517', // 电话机及通信设备
    '8507', // 蓄电池
    '8473', // 电脑零配件
    '8528', // 监视器、电视
    '8544', // 电线电缆
    '8504', // 变压器、电源适配器
    '6109', // 针织T恤衫
    '6204', // 女式服装
    '6404', // 纺织面鞋类
    '9403', // 家具
    '9405', // 灯具
    '9503', // 玩具
    '3926', // 塑料制品
    '4202', // 箱包
    '7323', // 不锈钢厨具
    '7013', // 玻璃器皿
  ]
  
  for (const code4 of chinaExportCategories) {
    const chapter = COMMON_DUTY_RATES[code4]
    if (chapter) {
      // 如果有子编码，使用子编码
      if (chapter.subCodes) {
        for (const [hsCode8, subCode] of Object.entries(chapter.subCodes)) {
          const hsCode10 = hsCode8.padEnd(10, '0')
          const unitInfo = getUnitInfo(hsCode8)
          const material = getMaterialInfo(hsCode8)
          const usage = getUsageInfo(hsCode8)
          
          rates.push({
            hsCode: hsCode8,
            hsCode10: hsCode10,
            goodsDescription: subCode.description || chapter.description || '',
            goodsDescriptionCn: subCode.descriptionCn || chapter.descriptionCn || '',
            originCountry: '中国',
            originCountryCode: 'CN',
            dutyRate: subCode.rate || chapter.rate || 0,
            dutyRateType: 'percentage',
            vatRate: null, // VAT税率根据进口国动态查询，不在此处设置
            antiDumpingRate: 0,
            countervailingRate: 0,
            unitCode: unitInfo.unitCode,
            unitName: unitInfo.unitName,
            material: material,
            usageScenario: usage,
            measureType: null,
            legalBase: null,
            startDate: null,
            footnotes: '中国常见出口商品',
            dataSource: 'china_common_exports',
            isActive: 1
          })
        }
      } else {
        // 如果没有子编码，使用章节级别的数据（使用8位编码，前4位匹配）
        const hsCode8 = code4 + '0000'
        const hsCode10 = hsCode8.padEnd(10, '0')
        const unitInfo = getUnitInfo(hsCode8)
        const material = getMaterialInfo(hsCode8)
        const usage = getUsageInfo(hsCode8)
        
        rates.push({
          hsCode: hsCode8,
          hsCode10: hsCode10,
          goodsDescription: chapter.description || '',
          goodsDescriptionCn: chapter.descriptionCn || '',
          originCountry: '中国',
          originCountryCode: 'CN',
          dutyRate: chapter.rate || 0,
          dutyRateType: 'percentage',
          vatRate: null, // VAT税率根据进口国动态查询，不在此处设置
          antiDumpingRate: 0,
          countervailingRate: 0,
          unitCode: unitInfo.unitCode,
          unitName: unitInfo.unitName,
          material: material,
          usageScenario: usage,
          measureType: null,
          legalBase: null,
          startDate: null,
          footnotes: '中国常见出口商品（章节级别）',
          dataSource: 'china_common_exports',
          isActive: 1
        })
      }
    }
  }
  
  return rates
}

/**
 * 主函数：导入中国HS编码数据
 */
async function seedChinaHsCodes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🚀 开始导入中国原产国HS code数据...')
    
    // 提取反倾销数据
    const antiDumpingRates = extractHsCodesFromAntiDumping()
    console.log(`📊 反倾销数据: ${antiDumpingRates.length} 条`)
    
    // 提取常见出口商品数据
    const commonExportRates = extractCommonChinaExportHsCodes()
    console.log(`📊 常见出口商品数据: ${commonExportRates.length} 条`)
    
    // 合并数据（去重：如果反倾销数据中已有，则优先使用反倾销数据）
    const rateMap = new Map()
    
    // 先添加反倾销数据
    for (const rate of antiDumpingRates) {
      const key = `${rate.hsCode}_${rate.originCountryCode}`
      rateMap.set(key, rate)
    }
    
    // 再添加常见出口商品数据（如果不存在）
    for (const rate of commonExportRates) {
      const key = `${rate.hsCode}_${rate.originCountryCode}`
      if (!rateMap.has(key)) {
        rateMap.set(key, rate)
      }
    }
    
    const rates = Array.from(rateMap.values())
    console.log(`📊 合并后总计: ${rates.length} 条HS编码数据`)
    
    // 统计信息
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    // 开始事务
    await client.query('BEGIN')
    
    for (const rate of rates) {
      try {
        // 检查是否已存在（按 hs_code + origin_country_code 唯一）
        const existing = await client.query(
          `SELECT id FROM tariff_rates 
           WHERE hs_code = $1 AND origin_country_code = $2`,
          [rate.hsCode, rate.originCountryCode]
        )
        
        if (existing.rows.length > 0) {
          // 更新现有记录（补充详细信息）
          await client.query(`
            UPDATE tariff_rates SET
              hs_code_10 = COALESCE($1, hs_code_10),
              goods_description = COALESCE(NULLIF($2, ''), goods_description),
              goods_description_cn = COALESCE(NULLIF($3, ''), goods_description_cn),
              duty_rate = COALESCE($4, duty_rate),
              duty_rate_type = COALESCE($5, duty_rate_type),
              -- VAT税率不更新，保持原值或NULL（需根据进口国从vat_rates表动态查询）
              anti_dumping_rate = COALESCE($6, anti_dumping_rate),
              countervailing_rate = COALESCE($7, countervailing_rate),
              unit_code = COALESCE(NULLIF($8, ''), unit_code),
              unit_name = COALESCE(NULLIF($9, ''), unit_name),
              material = COALESCE(NULLIF($10, ''), material),
              usage_scenario = COALESCE(NULLIF($11, ''), usage_scenario),
              measure_type = COALESCE(NULLIF($12, ''), measure_type),
              legal_base = COALESCE(NULLIF($13, ''), legal_base),
              start_date = COALESCE(NULLIF($14, ''), start_date),
              footnotes = COALESCE(NULLIF($15, ''), footnotes),
              data_source = COALESCE($16, data_source),
              updated_at = NOW()
            WHERE hs_code = $17 AND origin_country_code = $18
          `, [
            rate.hsCode10,
            rate.goodsDescription,
            rate.goodsDescriptionCn,
            rate.dutyRate,
            rate.dutyRateType,
            rate.antiDumpingRate,
            rate.countervailingRate,
            rate.unitCode,
            rate.unitName,
            rate.material,
            rate.usageScenario,
            rate.measureType,
            rate.legalBase,
            rate.startDate,
            rate.footnotes,
            rate.dataSource,
            rate.hsCode,
            rate.originCountryCode
          ])
          updatedCount++
        } else {
          // 插入新记录
          await client.query(`
            INSERT INTO tariff_rates (
              hs_code, hs_code_10, goods_description, goods_description_cn,
              origin_country, origin_country_code, duty_rate, duty_rate_type,
              vat_rate, anti_dumping_rate, countervailing_rate,
              unit_code, unit_name, material, usage_scenario,
              measure_type, legal_base, start_date, footnotes,
              data_source, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
          `, [
            rate.hsCode,
            rate.hsCode10,
            rate.goodsDescription,
            rate.goodsDescriptionCn,
            rate.originCountry,
            rate.originCountryCode,
            rate.dutyRate,
            rate.dutyRateType,
            null, // VAT税率设为NULL，需根据进口国从vat_rates表动态查询
            rate.antiDumpingRate,
            rate.countervailingRate,
            rate.unitCode,
            rate.unitName,
            rate.material,
            rate.usageScenario,
            rate.measureType,
            rate.legalBase,
            rate.startDate,
            rate.footnotes,
            rate.dataSource,
            rate.isActive
          ])
          insertedCount++
        }
      } catch (error) {
        errorCount++
        console.error(`❌ 处理HS编码失败 [${rate.hsCode}]:`, error.message)
      }
    }
    
    // 提交事务
    await client.query('COMMIT')
    
    console.log('\n✅ 数据导入完成！')
    console.log(`   📥 新增: ${insertedCount} 条`)
    console.log(`   🔄 更新: ${updatedCount} 条`)
    console.log(`   ⏭️  跳过: ${skippedCount} 条`)
    console.log(`   ❌ 错误: ${errorCount} 条`)
    console.log(`   📊 总计: ${rates.length} 条`)
    
    // 查询统计信息
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN origin_country_code = 'CN' THEN 1 END) as china_count,
        COUNT(CASE WHEN anti_dumping_rate > 0 THEN 1 END) as anti_dumping_count
      FROM tariff_rates
      WHERE is_active = 1
    `)
    
    console.log('\n📈 数据库统计:')
    console.log(`   总记录数: ${stats.rows[0].total}`)
    console.log(`   中国原产国记录数: ${stats.rows[0].china_count}`)
    console.log(`   有反倾销税记录数: ${stats.rows[0].anti_dumping_count}`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ 导入失败:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行导入
if (import.meta.url === `file://${process.argv[1]}`) {
  seedChinaHsCodes()
    .then(() => {
      console.log('\n🎉 脚本执行完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 脚本执行失败:', error)
      process.exit(1)
    })
}

export { seedChinaHsCodes }
