/**
 * HS 编码规范化迁移脚本
 * 将所有 HS 编码更新为 10 位（欧盟 TARIC 标准）
 * 
 * 使用方法: 
 *   cd server && node scripts/migrate-hs-code-10-digits.js
 * 
 * 或者在项目根目录:
 *   node server/scripts/migrate-hs-code-10-digits.js
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接
const isProduction = process.env.NODE_ENV === 'production'
const DATABASE_URL = process.env.DATABASE_URL || 
  (isProduction ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL_TEST)

if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置数据库连接字符串')
  process.exit(1)
}

// 规范化 HS 编码的 SQL 函数
const NORMALIZE_HS_SQL = `RPAD(REGEXP_REPLACE(col, '[^0-9]', '', 'g'), 10, '0')`

async function migrate() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🚀 开始 HS 编码规范化迁移...\n')
    
    // 开启事务
    await client.query('BEGIN')

    // 1. 更新 cargo_items.matched_hs_code
    console.log('📦 1/5 更新 cargo_items.matched_hs_code...')
    const r1 = await client.query(`
      UPDATE cargo_items 
      SET matched_hs_code = RPAD(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g'), 10, '0')
      WHERE matched_hs_code IS NOT NULL 
        AND LENGTH(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g')) < 10
    `)
    console.log(`   ✅ 更新了 ${r1.rowCount} 条记录`)

    // 2. 更新 cargo_items.customer_hs_code
    console.log('📦 2/5 更新 cargo_items.customer_hs_code...')
    const r2 = await client.query(`
      UPDATE cargo_items 
      SET customer_hs_code = RPAD(REGEXP_REPLACE(customer_hs_code, '[^0-9]', '', 'g'), 10, '0')
      WHERE customer_hs_code IS NOT NULL 
        AND LENGTH(REGEXP_REPLACE(customer_hs_code, '[^0-9]', '', 'g')) < 10
    `)
    console.log(`   ✅ 更新了 ${r2.rowCount} 条记录`)

    // 3. 更新 hs_match_history.matched_hs_code
    console.log('📦 3/5 更新 hs_match_history.matched_hs_code...')
    const r3 = await client.query(`
      UPDATE hs_match_history 
      SET matched_hs_code = RPAD(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g'), 10, '0')
      WHERE matched_hs_code IS NOT NULL 
        AND LENGTH(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g')) < 10
    `)
    console.log(`   ✅ 更新了 ${r3.rowCount} 条记录`)

    // 4. 更新 hs_match_records.hs_code
    console.log('📦 4/5 更新 hs_match_records.hs_code...')
    const r4 = await client.query(`
      UPDATE hs_match_records 
      SET hs_code = RPAD(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g'), 10, '0')
      WHERE hs_code IS NOT NULL 
        AND LENGTH(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g')) < 10
    `)
    console.log(`   ✅ 更新了 ${r4.rowCount} 条记录`)

    // 5. 更新 tariff_rates.hs_code
    console.log('📦 5/5 更新 tariff_rates.hs_code...')
    const r5 = await client.query(`
      UPDATE tariff_rates 
      SET hs_code = RPAD(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g'), 10, '0')
      WHERE hs_code IS NOT NULL 
        AND LENGTH(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g')) < 10
    `)
    console.log(`   ✅ 更新了 ${r5.rowCount} 条记录`)

    // 提交事务
    await client.query('COMMIT')
    
    // 验证结果
    console.log('\n📊 验证迁移结果...\n')
    
    const verification = await client.query(`
      SELECT 'cargo_items.matched_hs_code' AS table_field, 
             COUNT(*) AS total,
             COUNT(CASE WHEN LENGTH(matched_hs_code) = 10 THEN 1 END) AS correct
      FROM cargo_items WHERE matched_hs_code IS NOT NULL
      UNION ALL
      SELECT 'cargo_items.customer_hs_code', 
             COUNT(*),
             COUNT(CASE WHEN LENGTH(customer_hs_code) = 10 THEN 1 END)
      FROM cargo_items WHERE customer_hs_code IS NOT NULL
      UNION ALL
      SELECT 'hs_match_history.matched_hs_code', 
             COUNT(*),
             COUNT(CASE WHEN LENGTH(matched_hs_code) = 10 THEN 1 END)
      FROM hs_match_history WHERE matched_hs_code IS NOT NULL
      UNION ALL
      SELECT 'hs_match_records.hs_code', 
             COUNT(*),
             COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END)
      FROM hs_match_records WHERE hs_code IS NOT NULL
      UNION ALL
      SELECT 'tariff_rates.hs_code', 
             COUNT(*),
             COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END)
      FROM tariff_rates WHERE hs_code IS NOT NULL
    `)

    console.log('┌─────────────────────────────────────┬─────────┬──────────────┐')
    console.log('│ 表.字段                              │ 总记录  │ 10位编码数   │')
    console.log('├─────────────────────────────────────┼─────────┼──────────────┤')
    for (const row of verification.rows) {
      const field = row.table_field.padEnd(35)
      const total = String(row.total).padStart(7)
      const correct = String(row.correct).padStart(12)
      console.log(`│ ${field} │ ${total} │ ${correct} │`)
    }
    console.log('└─────────────────────────────────────┴─────────┴──────────────┘')

    const totalUpdated = r1.rowCount + r2.rowCount + r3.rowCount + r4.rowCount + r5.rowCount
    console.log(`\n✅ HS 编码规范化迁移完成！共更新 ${totalUpdated} 条记录`)

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ 迁移失败，已回滚:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

// 运行迁移
migrate().catch(console.error)

