/**
 * 检查系统中没有英文名称的费用品名
 */

import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_TEST

async function checkFeeNamesWithoutEnglish() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false }
  })

  try {
    console.log('\n========================================')
    console.log('检查系统中没有英文名称的费用品名')
    console.log('========================================\n')

    // 1. 检查产品费用项表 (product_fee_items)
    console.log('📋 1. 产品费用项表 (product_fee_items) - 没有英文名称的费用:\n')
    const feeItemsResult = await pool.query(`
      SELECT DISTINCT 
        pfi.fee_name,
        pfi.fee_name_en,
        pfi.fee_category,
        p.product_name,
        COUNT(*) as count
      FROM product_fee_items pfi
      LEFT JOIN products p ON pfi.product_id = p.id
      WHERE pfi.fee_name_en IS NULL OR pfi.fee_name_en = '' OR TRIM(pfi.fee_name_en) = ''
      GROUP BY pfi.fee_name, pfi.fee_name_en, pfi.fee_category, p.product_name
      ORDER BY pfi.fee_category, pfi.fee_name
    `)

    if (feeItemsResult.rows.length === 0) {
      console.log('   ✅ 所有产品费用项都有英文名称\n')
    } else {
      console.log(`   ⚠️  发现 ${feeItemsResult.rows.length} 种费用没有英文名称:\n`)
      console.log('   序号 | 费用品名                     | 分类                    | 所属产品         | 数量')
      console.log('   ─────┼──────────────────────────────┼─────────────────────────┼──────────────────┼─────')
      feeItemsResult.rows.forEach((row, index) => {
        const feeName = (row.fee_name || '').padEnd(26)
        const category = (row.fee_category || '-').padEnd(22)
        const product = (row.product_name || '-').substring(0, 14).padEnd(14)
        console.log(`   ${String(index + 1).padStart(4)} | ${feeName} | ${category} | ${product} | ${row.count}`)
      })
      console.log('')
    }

    // 2. 检查供应商报价表 (supplier_price_items)
    console.log('📋 2. 供应商报价表 (supplier_price_items) - 没有英文名称的费用:\n')
    const supplierPriceResult = await pool.query(`
      SELECT DISTINCT 
        fee_name,
        fee_name_en,
        fee_category,
        supplier_name,
        COUNT(*) as count
      FROM supplier_price_items
      WHERE fee_name_en IS NULL OR fee_name_en = '' OR TRIM(fee_name_en) = ''
      GROUP BY fee_name, fee_name_en, fee_category, supplier_name
      ORDER BY fee_category, fee_name
    `)

    if (supplierPriceResult.rows.length === 0) {
      console.log('   ✅ 所有供应商报价项都有英文名称\n')
    } else {
      console.log(`   ⚠️  发现 ${supplierPriceResult.rows.length} 种费用没有英文名称:\n`)
      console.log('   序号 | 费用品名                     | 分类                    | 供应商           | 数量')
      console.log('   ─────┼──────────────────────────────┼─────────────────────────┼──────────────────┼─────')
      supplierPriceResult.rows.forEach((row, index) => {
        const feeName = (row.fee_name || '').padEnd(26)
        const category = (row.fee_category || '-').padEnd(22)
        const supplier = (row.supplier_name || '-').substring(0, 14).padEnd(14)
        console.log(`   ${String(index + 1).padStart(4)} | ${feeName} | ${category} | ${supplier} | ${row.count}`)
      })
      console.log('')
    }

    // 3. 汇总所有唯一的费用品名（去重合并）
    console.log('📋 3. 汇总：所有缺少英文名称的唯一费用品名:\n')
    const summaryResult = await pool.query(`
      SELECT fee_name, fee_category, source, COUNT(*) as total_count
      FROM (
        SELECT fee_name, fee_category, 'product_fee_items' as source FROM product_fee_items 
        WHERE fee_name_en IS NULL OR fee_name_en = '' OR TRIM(fee_name_en) = ''
        UNION ALL
        SELECT fee_name, fee_category, 'supplier_price_items' as source FROM supplier_price_items 
        WHERE fee_name_en IS NULL OR fee_name_en = '' OR TRIM(fee_name_en) = ''
      ) combined
      GROUP BY fee_name, fee_category, source
      ORDER BY fee_category, fee_name
    `)

    // 进一步去重，只显示唯一的费用名称
    const uniqueFeeNames = new Map()
    summaryResult.rows.forEach(row => {
      const key = row.fee_name
      if (!uniqueFeeNames.has(key)) {
        uniqueFeeNames.set(key, {
          fee_name: row.fee_name,
          fee_category: row.fee_category,
          sources: [row.source],
          total_count: parseInt(row.total_count)
        })
      } else {
        const existing = uniqueFeeNames.get(key)
        if (!existing.sources.includes(row.source)) {
          existing.sources.push(row.source)
        }
        existing.total_count += parseInt(row.total_count)
      }
    })

    if (uniqueFeeNames.size === 0) {
      console.log('   ✅ 恭喜！系统中所有费用品名都有英文名称！\n')
    } else {
      console.log(`   ⚠️  共发现 ${uniqueFeeNames.size} 个唯一费用品名缺少英文翻译:\n`)
      console.log('   序号 | 费用品名                     | 分类                    | 来源           | 使用次数')
      console.log('   ─────┼──────────────────────────────┼─────────────────────────┼────────────────┼─────────')
      
      let index = 0
      uniqueFeeNames.forEach((item) => {
        index++
        const feeName = item.fee_name.padEnd(26)
        const category = (item.fee_category || '-').padEnd(22)
        const sources = item.sources.length > 1 ? '两个表' : (item.sources[0] === 'product_fee_items' ? '产品费用' : '供应商报价')
        console.log(`   ${String(index).padStart(4)} | ${feeName} | ${category} | ${sources.padEnd(12)} | ${item.total_count}`)
      })
      console.log('')
    }

    // 4. 检查产品表 (products)
    console.log('📋 4. 产品表 (products) - 没有英文名称的产品:\n')
    const productsResult = await pool.query(`
      SELECT id, product_code, product_name, product_name_en, category
      FROM products
      WHERE product_name_en IS NULL OR product_name_en = '' OR TRIM(product_name_en) = ''
      ORDER BY category, product_name
    `)

    if (productsResult.rows.length === 0) {
      console.log('   ✅ 所有产品都有英文名称\n')
    } else {
      console.log(`   ⚠️  发现 ${productsResult.rows.length} 个产品没有英文名称:\n`)
      console.log('   序号 | 产品编码          | 产品名称                     | 分类')
      console.log('   ─────┼───────────────────┼──────────────────────────────┼──────────────')
      productsResult.rows.forEach((row, index) => {
        const code = (row.product_code || '-').padEnd(15)
        const name = (row.product_name || '').padEnd(26)
        const category = row.category || '-'
        console.log(`   ${String(index + 1).padStart(4)} | ${code} | ${name} | ${category}`)
      })
      console.log('')
    }

    console.log('========================================')
    console.log('检查完成')
    console.log('========================================\n')

  } catch (error) {
    console.error('❌ 查询出错:', error.message)
  } finally {
    await pool.end()
  }
}

checkFeeNamesWithoutEnglish()
