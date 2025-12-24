/**
 * 导入中国原产商品税率数据到数据库
 * 数据来源：chinaAntiDumpingRates.js
 * 
 * 运行方式：node scripts/import-china-tariff-rates.js
 */

import { getDatabase } from '../config/database.js'
import { CHINA_ANTI_DUMPING_RATES } from '../modules/taric/chinaAntiDumpingRates.js'

async function importChinaTariffRates() {
  const db = getDatabase()
  
  console.log('='.repeat(60))
  console.log('🇨🇳 开始导入中国原产商品税率数据')
  console.log('='.repeat(60))
  
  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let failedCount = 0
  
  // 遍历所有数据
  for (const [code4, chapter] of Object.entries(CHINA_ANTI_DUMPING_RATES)) {
    if (!chapter.measures || chapter.measures.length === 0) {
      continue
    }
    
    for (const measure of chapter.measures) {
      try {
        const hsCode = measure.hsCode8
        const hsCode10 = hsCode.padEnd(10, '0')
        
        // 检查是否已存在（按 hs_code + origin_country_code 唯一）
        const existing = await db.prepare(`
          SELECT id FROM tariff_rates 
          WHERE hs_code = $1 AND origin_country_code = 'CN'
        `).get(hsCode)
        
        if (existing) {
          // 更新现有记录
          await db.prepare(`
            UPDATE tariff_rates SET
              hs_code_10 = $1,
              goods_description = $2,
              goods_description_cn = $3,
              origin_country = 'China',
              duty_rate = $4,
              anti_dumping_rate = $5,
              countervailing_rate = $6,
              vat_rate = COALESCE(vat_rate, 19),
              measure_type = $7,
              regulation_id = $8,
              start_date = $9,
              data_source = 'china_anti_dumping',
              is_active = 1,
              updated_at = NOW()
            WHERE id = $10
          `).run(
            hsCode10,
            measure.description || '',
            measure.descriptionCn || '',
            measure.dutyRate ?? 0,
            measure.antiDumpingRate ?? 0,
            measure.countervailingRate ?? 0,
            measure.note || null,
            measure.regulationId || null,
            measure.validFrom || null,
            existing.id
          )
          updatedCount++
        } else {
          // 插入新记录
          await db.prepare(`
            INSERT INTO tariff_rates (
              hs_code, hs_code_10, goods_description, goods_description_cn,
              origin_country, origin_country_code, duty_rate, vat_rate,
              anti_dumping_rate, countervailing_rate, measure_type,
              regulation_id, start_date, data_source, is_active
            ) VALUES (
              $1, $2, $3, $4, 'China', 'CN', $5, 19, $6, $7, $8, $9, $10, 'china_anti_dumping', 1
            )
          `).run(
            hsCode,
            hsCode10,
            measure.description || '',
            measure.descriptionCn || '',
            measure.dutyRate ?? 0,
            measure.antiDumpingRate ?? 0,
            measure.countervailingRate ?? 0,
            measure.note || null,
            measure.regulationId || null,
            measure.validFrom || null
          )
          insertedCount++
        }
        
        // 进度显示
        const total = insertedCount + updatedCount + skippedCount
        if (total % 50 === 0) {
          console.log(`  进度: ${total} 条已处理...`)
        }
        
      } catch (error) {
        console.error(`  ❌ 导入失败 [${measure.hsCode8}]:`, error.message)
        failedCount++
      }
    }
  }
  
  console.log('')
  console.log('='.repeat(60))
  console.log('📊 导入完成统计')
  console.log('='.repeat(60))
  console.log(`  ✅ 新增记录: ${insertedCount} 条`)
  console.log(`  🔄 更新记录: ${updatedCount} 条`)
  console.log(`  ⏭️ 跳过记录: ${skippedCount} 条`)
  console.log(`  ❌ 失败记录: ${failedCount} 条`)
  console.log('')
  
  // 统计中国原产地数据总量
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT hs_code) as unique_codes,
      SUM(CASE WHEN anti_dumping_rate > 0 THEN 1 ELSE 0 END) as with_anti_dumping
    FROM tariff_rates 
    WHERE origin_country_code = 'CN'
  `).get()
  
  console.log('📈 中国原产地数据统计')
  console.log('='.repeat(60))
  console.log(`  总记录数: ${stats.total}`)
  console.log(`  唯一HS编码数: ${stats.unique_codes}`)
  console.log(`  含反倾销税: ${stats.with_anti_dumping}`)
  console.log('')
}

// 运行导入
importChinaTariffRates()
  .then(() => {
    console.log('✅ 导入任务完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 导入任务失败:', error)
    process.exit(1)
  })

