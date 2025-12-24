/**
 * 同步供应商数据到生产环境
 * 
 * 使用方法：
 * 1. 设置环境变量
 * 2. 运行: node scripts/sync-suppliers-to-prod.js
 * 
 * 环境变量：
 * - DATABASE_URL_TEST: 开发环境数据库URL
 * - DATABASE_URL_PROD: 生产环境数据库URL
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
const DEV_DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
const PROD_DATABASE_URL = process.env.DATABASE_URL_PROD || process.env.PRODUCTION_DATABASE_URL

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
 * 创建数据库连接池
 */
function createPool(url, name) {
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1')
  
  return new pg.Pool({
    connectionString: url,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
}

/**
 * 主函数
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('       供应商数据同步：开发环境 → 生产环境')
  console.log('═══════════════════════════════════════════════════════')

  // 检查环境变量
  if (!DEV_DATABASE_URL) {
    console.error('❌ 请设置开发环境数据库 URL (DATABASE_URL_TEST 或 DATABASE_URL)')
    process.exit(1)
  }

  if (!PROD_DATABASE_URL) {
    console.error('❌ 请设置生产环境数据库 URL (DATABASE_URL_PROD 或 PRODUCTION_DATABASE_URL)')
    process.exit(1)
  }

  // 显示连接信息（隐藏敏感信息）
  const devHost = DEV_DATABASE_URL.match(/@([^:\/]+)/)?.[1] || '未知'
  const prodHost = PROD_DATABASE_URL.match(/@([^:\/]+)/)?.[1] || '未知'
  
  console.log('\n📡 数据库连接:')
  console.log(`  开发环境: ${devHost}`)
  console.log(`  生产环境: ${prodHost}`)

  // 创建连接池
  const devPool = createPool(DEV_DATABASE_URL, '开发')
  const prodPool = createPool(PROD_DATABASE_URL, '生产')

  try {
    // 测试连接
    console.log('\n🔗 测试数据库连接...')
    
    await devPool.query('SELECT 1')
    console.log('  ✅ 开发环境连接成功')
    
    await prodPool.query('SELECT 1')
    console.log('  ✅ 生产环境连接成功')

    // 获取开发环境供应商数据
    console.log('\n📊 获取开发环境供应商数据...')
    const devResult = await devPool.query('SELECT * FROM suppliers ORDER BY created_at')
    const devSuppliers = devResult.rows

    console.log(`  找到 ${devSuppliers.length} 条供应商记录`)

    if (devSuppliers.length === 0) {
      console.log('\n⚠️ 开发环境没有供应商数据需要同步')
      return
    }

    // 显示数据预览
    console.log('\n📋 数据预览:')
    console.log('  ┌──────────────────┬──────────────────────────┬────────────┐')
    console.log('  │ 供应商编码       │ 供应商名称               │ 类型       │')
    console.log('  ├──────────────────┼──────────────────────────┼────────────┤')
    
    for (const s of devSuppliers.slice(0, 10)) {
      const code = (s.supplier_code || '').padEnd(16).slice(0, 16)
      const name = (s.supplier_name || '').padEnd(24).slice(0, 24)
      const type = (s.supplier_type || '').padEnd(10).slice(0, 10)
      console.log(`  │ ${code} │ ${name} │ ${type} │`)
    }
    
    if (devSuppliers.length > 10) {
      console.log(`  │ ... 还有 ${devSuppliers.length - 10} 条记录 ...                          │`)
    }
    console.log('  └──────────────────┴──────────────────────────┴────────────┘')

    // 获取生产环境现有数据
    const prodResult = await prodPool.query('SELECT supplier_code FROM suppliers')
    const prodCodes = new Set(prodResult.rows.map(r => r.supplier_code))
    
    console.log(`\n📊 生产环境现有 ${prodCodes.size} 条供应商记录`)

    // 分析差异
    const newSuppliers = devSuppliers.filter(s => !prodCodes.has(s.supplier_code))
    const updateSuppliers = devSuppliers.filter(s => prodCodes.has(s.supplier_code))

    console.log(`  - 新增: ${newSuppliers.length} 条`)
    console.log(`  - 更新: ${updateSuppliers.length} 条`)

    // 用户确认
    console.log('\n⚠️  警告: 此操作将修改生产数据库！')
    const confirmed = await confirm('确认同步供应商数据到生产环境?')

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
      INSERT INTO suppliers (
        id, supplier_code, supplier_name, short_name, supplier_type,
        contact_person, contact_phone, contact_email, contact_mobile, fax, website,
        country, province, city, address, postal_code,
        tax_number, bank_name, bank_account, bank_branch, currency, payment_terms, credit_limit,
        status, level, rating, cooperation_date, contract_expire_date,
        remark, created_at, updated_at, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33
      )
      ON CONFLICT (supplier_code) DO UPDATE SET
        supplier_name = EXCLUDED.supplier_name,
        short_name = EXCLUDED.short_name,
        supplier_type = EXCLUDED.supplier_type,
        contact_person = EXCLUDED.contact_person,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        contact_mobile = EXCLUDED.contact_mobile,
        fax = EXCLUDED.fax,
        website = EXCLUDED.website,
        country = EXCLUDED.country,
        province = EXCLUDED.province,
        city = EXCLUDED.city,
        address = EXCLUDED.address,
        postal_code = EXCLUDED.postal_code,
        tax_number = EXCLUDED.tax_number,
        bank_name = EXCLUDED.bank_name,
        bank_account = EXCLUDED.bank_account,
        bank_branch = EXCLUDED.bank_branch,
        currency = EXCLUDED.currency,
        payment_terms = EXCLUDED.payment_terms,
        credit_limit = EXCLUDED.credit_limit,
        status = EXCLUDED.status,
        level = EXCLUDED.level,
        rating = EXCLUDED.rating,
        cooperation_date = EXCLUDED.cooperation_date,
        contract_expire_date = EXCLUDED.contract_expire_date,
        remark = EXCLUDED.remark,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `

    for (const supplier of devSuppliers) {
      try {
        const result = await prodPool.query(upsertSql, [
          supplier.id,
          supplier.supplier_code,
          supplier.supplier_name,
          supplier.short_name,
          supplier.supplier_type,
          supplier.contact_person,
          supplier.contact_phone,
          supplier.contact_email,
          supplier.contact_mobile,
          supplier.fax,
          supplier.website,
          supplier.country,
          supplier.province,
          supplier.city,
          supplier.address,
          supplier.postal_code,
          supplier.tax_number,
          supplier.bank_name,
          supplier.bank_account,
          supplier.bank_branch,
          supplier.currency,
          supplier.payment_terms,
          supplier.credit_limit,
          supplier.status,
          supplier.level,
          supplier.rating,
          supplier.cooperation_date,
          supplier.contract_expire_date,
          supplier.remark,
          supplier.created_at || new Date(),
          new Date(),
          supplier.created_by,
          supplier.updated_by
        ])

        if (prodCodes.has(supplier.supplier_code)) {
          updateCount++
        } else {
          insertCount++
        }
        
        process.stdout.write(`\r  处理中: ${insertCount + updateCount}/${devSuppliers.length}`)
      } catch (err) {
        errorCount++
        console.error(`\n  ❌ 同步失败 [${supplier.supplier_code}]: ${err.message}`)
      }
    }

    console.log('\n')

    // 验证结果
    const verifyResult = await prodPool.query('SELECT COUNT(*) as count FROM suppliers')
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
    console.log(`  📊 生产环境总计: ${prodCount} 条供应商记录`)
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

