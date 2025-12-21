/**
 * 同步 tariff_rates 到生产环境
 * 使用批量插入提高效率
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../.env') })

// 本地数据库
const LOCAL_DB = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

// 生产数据库（从命令行参数获取）
const PROD_DB = process.argv[2]

if (!PROD_DB) {
  console.error('请提供生产数据库连接URL作为参数')
  console.log('用法: node scripts/sync-tariff-to-prod.js "postgresql://..."')
  process.exit(1)
}

const localPool = new pg.Pool({ connectionString: LOCAL_DB })
const prodPool = new pg.Pool({ 
  connectionString: PROD_DB,
  ssl: { rejectUnauthorized: false }
})

async function syncTariffRates() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('        同步 tariff_rates 到生产环境')
  console.log('═══════════════════════════════════════════════════════')
  
  try {
    // 测试连接
    console.log('\n🔗 测试数据库连接...')
    await localPool.query('SELECT 1')
    console.log('   ✅ 本地数据库连接成功')
    await prodPool.query('SELECT 1')
    console.log('   ✅ 生产数据库连接成功')
    
    // 检查生产环境是否有唯一约束
    console.log('\n🔧 检查唯一约束...')
    const constraintCheck = await prodPool.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'tariff_rates' AND constraint_type = 'UNIQUE'
    `)
    
    if (constraintCheck.rows.length === 0) {
      console.log('   添加 hs_code 唯一约束...')
      try {
        await prodPool.query('ALTER TABLE tariff_rates ADD CONSTRAINT tariff_rates_hs_code_key UNIQUE (hs_code)')
        console.log('   ✅ 约束添加成功')
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log('   ✅ 约束已存在')
        } else {
          throw e
        }
      }
    } else {
      console.log('   ✅ 唯一约束已存在')
    }
    
    // 获取本地数据总数
    const localCount = await localPool.query('SELECT COUNT(*) as count FROM tariff_rates')
    const total = parseInt(localCount.rows[0].count)
    console.log(`\n📊 本地数据: ${total} 条`)
    
    // 获取生产数据总数
    const prodCount = await prodPool.query('SELECT COUNT(*) as count FROM tariff_rates')
    console.log(`   生产数据: ${prodCount.rows[0].count} 条`)
    
    // 批量获取并插入
    const batchSize = 500
    let offset = 0
    let inserted = 0
    let updated = 0
    let errors = 0
    
    console.log('\n📦 开始同步...')
    const startTime = Date.now()
    
    while (offset < total) {
      // 获取一批数据
      const batch = await localPool.query(`
        SELECT * FROM tariff_rates 
        ORDER BY id 
        LIMIT ${batchSize} OFFSET ${offset}
      `)
      
      // 批量插入到生产
      for (const row of batch.rows) {
        try {
          const columns = Object.keys(row).filter(k => k !== 'id')
          const values = columns.map(c => row[c])
          const placeholders = columns.map((_, i) => `$${i + 1}`)
          
          const updateSet = columns.map((c, i) => `${c} = $${i + 1}`).join(', ')
          
          await prodPool.query(`
            INSERT INTO tariff_rates (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (hs_code) DO UPDATE SET ${updateSet}
          `, values)
          
          inserted++
        } catch (e) {
          errors++
          if (errors <= 5) {
            console.error(`   错误: ${e.message.slice(0, 100)}`)
          }
        }
      }
      
      offset += batchSize
      const progress = Math.min(100, (offset / total * 100)).toFixed(1)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      process.stdout.write(`\r   进度: ${progress}% (${offset}/${total}) - ${elapsed}s`)
    }
    
    console.log('')
    
    // 验证结果
    const finalCount = await prodPool.query('SELECT COUNT(*) as count FROM tariff_rates')
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('                    同步完成')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`   处理记录: ${inserted} 条`)
    console.log(`   错误: ${errors} 条`)
    console.log(`   生产数据库现有: ${finalCount.rows[0].count} 条`)
    console.log(`   耗时: ${duration}s`)
    
  } catch (err) {
    console.error('同步失败:', err)
  } finally {
    await localPool.end()
    await prodPool.end()
  }
}

syncTariffRates()
