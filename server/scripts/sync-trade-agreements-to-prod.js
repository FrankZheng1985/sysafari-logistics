/**
 * 同步贸易协定数据到生产环境
 * 
 * 使用方法：
 * node scripts/sync-trade-agreements-to-prod.js
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接配置
const DEV_DATABASE_URL = process.env.DATABASE_URL_LOCAL || 'postgresql://fengzheng@localhost:5432/logistics_dev'
const PROD_DATABASE_URL = process.env.DATABASE_URL_PROD

/**
 * 用户确认
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * 主函数
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('       贸易协定数据同步：开发环境 → 生产环境')
  console.log('═══════════════════════════════════════════════════════')

  if (!PROD_DATABASE_URL) {
    console.error('❌ 请设置生产环境数据库 URL (DATABASE_URL_PROD)')
    process.exit(1)
  }

  const devPool = new pg.Pool({
    connectionString: DEV_DATABASE_URL,
    ssl: false
  })

  const prodPool = new pg.Pool({
    connectionString: PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    // 测试连接
    console.log('\n🔗 测试数据库连接...')
    await devPool.query('SELECT 1')
    console.log('  ✅ 开发环境连接成功')
    await prodPool.query('SELECT 1')
    console.log('  ✅ 生产环境连接成功')

    // 获取开发环境数据
    console.log('\n📊 获取开发环境贸易协定数据...')
    const devResult = await devPool.query('SELECT * FROM trade_agreements ORDER BY agreement_code')
    const devData = devResult.rows

    console.log(`  找到 ${devData.length} 条贸易协定记录`)

    if (devData.length === 0) {
      console.log('\n⚠️ 开发环境没有贸易协定数据需要同步')
      return
    }

    // 显示数据预览
    console.log('\n📋 数据预览 (前10条):')
    console.log('  ┌────────────────┬─────────────────────────────┬────────────┐')
    console.log('  │ 协议代码       │ 国家/地区                   │ 状态       │')
    console.log('  ├────────────────┼─────────────────────────────┼────────────┤')
    
    for (const item of devData.slice(0, 10)) {
      const code = (item.agreement_code || '').padEnd(14).slice(0, 14)
      const country = (item.country_name || '').padEnd(27).slice(0, 27)
      const status = item.is_active ? '启用' : '禁用'
      console.log(`  │ ${code} │ ${country} │ ${status.padEnd(10)} │`)
    }
    
    if (devData.length > 10) {
      console.log(`  │ ... 还有 ${devData.length - 10} 条记录 ...                              │`)
    }
    console.log('  └────────────────┴─────────────────────────────┴────────────┘')

    // 获取生产环境现有数据
    const prodResult = await prodPool.query('SELECT id FROM trade_agreements')
    const prodIds = new Set(prodResult.rows.map(r => r.id))
    
    console.log(`\n📊 生产环境现有 ${prodIds.size} 条贸易协定记录`)

    // 分析差异
    const newItems = devData.filter(item => !prodIds.has(item.id))
    const updateItems = devData.filter(item => prodIds.has(item.id))

    console.log(`  - 新增: ${newItems.length} 条`)
    console.log(`  - 更新: ${updateItems.length} 条`)

    // 用户确认
    console.log('\n⚠️  警告: 此操作将修改生产数据库！')
    const confirmed = await confirm('确认同步贸易协定数据到生产环境?')

    if (!confirmed) {
      console.log('\n❌ 操作已取消')
      return
    }

    // 执行同步
    console.log('\n🔄 开始同步...')
    const startTime = Date.now()

    let insertCount = 0
    let updateCount = 0
    let errorCount = 0

    // 使用 UPSERT 语句
    const upsertSql = `
      INSERT INTO trade_agreements (
        id, agreement_code, agreement_name, agreement_name_cn, agreement_type,
        country_code, country_name, country_name_cn, geographical_area,
        preferential_rate, conditions, document_code,
        valid_from, valid_to, is_active, taric_version,
        last_sync_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19
      )
      ON CONFLICT (id) DO UPDATE SET
        agreement_code = EXCLUDED.agreement_code,
        agreement_name = EXCLUDED.agreement_name,
        agreement_name_cn = EXCLUDED.agreement_name_cn,
        agreement_type = EXCLUDED.agreement_type,
        country_code = EXCLUDED.country_code,
        country_name = EXCLUDED.country_name,
        country_name_cn = EXCLUDED.country_name_cn,
        geographical_area = EXCLUDED.geographical_area,
        preferential_rate = EXCLUDED.preferential_rate,
        conditions = EXCLUDED.conditions,
        document_code = EXCLUDED.document_code,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        is_active = EXCLUDED.is_active,
        taric_version = EXCLUDED.taric_version,
        last_sync_at = EXCLUDED.last_sync_at,
        updated_at = NOW()
    `

    for (const item of devData) {
      try {
        await prodPool.query(upsertSql, [
          item.id,
          item.agreement_code,
          item.agreement_name,
          item.agreement_name_cn,
          item.agreement_type,
          item.country_code,
          item.country_name,
          item.country_name_cn,
          item.geographical_area,
          item.preferential_rate,
          item.conditions,
          item.document_code,
          item.valid_from,
          item.valid_to,
          item.is_active,
          item.taric_version,
          item.last_sync_at,
          item.created_at || new Date(),
          new Date()
        ])

        if (prodIds.has(item.id)) {
          updateCount++
        } else {
          insertCount++
        }
        
        process.stdout.write(`\r  处理中: ${insertCount + updateCount}/${devData.length}`)
      } catch (err) {
        errorCount++
        console.error(`\n  ❌ 同步失败 [${item.agreement_code}]: ${err.message}`)
      }
    }

    console.log('\n')

    // 验证结果
    const verifyResult = await prodPool.query('SELECT COUNT(*) as count FROM trade_agreements')
    const prodCount = verifyResult.rows[0].count

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('═══════════════════════════════════════════════════════')
    console.log('                    同步完成')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`  ✅ 新增: ${insertCount} 条`)
    console.log(`  ✅ 更新: ${updateCount} 条`)
    if (errorCount > 0) {
      console.log(`  ❌ 失败: ${errorCount} 条`)
    }
    console.log(`  📊 生产环境总计: ${prodCount} 条贸易协定记录`)
    console.log(`  ⏱️  耗时: ${duration}s`)
    console.log('═══════════════════════════════════════════════════════')

  } catch (err) {
    console.error('\n❌ 同步过程出错:', err.message)
    process.exit(1)
  } finally {
    await devPool.end()
    await prodPool.end()
  }
}

main().catch(err => {
  console.error('同步失败:', err)
  process.exit(1)
})

