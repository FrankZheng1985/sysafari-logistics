/**
 * 修复服务费类别重复数据
 * 创建时间: 2025-12-31
 * 
 * 使用方法:
 * 1. 本地环境: node server/scripts/fix-duplicate-fee-categories.js
 * 2. 生产环境: DATABASE_URL=xxx node server/scripts/fix-duplicate-fee-categories.js
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// 获取数据库连接
function getPool() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/logistics'
  return new Pool({ connectionString })
}

async function fixDuplicateFeeCategories() {
  const pool = getPool()
  
  try {
    console.log('🔍 正在检查重复的费用分类...\n')
    
    // 1. 查找重复记录
    const duplicatesResult = await pool.query(`
      SELECT name, code, COUNT(*) as count, 
             ARRAY_AGG(id ORDER BY id) as ids
      FROM service_fee_categories 
      GROUP BY name, code 
      HAVING COUNT(*) > 1
      ORDER BY name
    `)
    
    if (duplicatesResult.rows.length === 0) {
      console.log('✅ 没有发现重复的费用分类，数据正常！')
      return
    }
    
    console.log(`⚠️ 发现 ${duplicatesResult.rows.length} 组重复的费用分类:\n`)
    console.log('=' .repeat(80))
    
    for (const row of duplicatesResult.rows) {
      console.log(`📋 名称: ${row.name}`)
      console.log(`   代码: ${row.code}`)
      console.log(`   重复数量: ${row.count}`)
      console.log(`   ID列表: ${row.ids.join(', ')} (将保留最小ID: ${Math.min(...row.ids)})`)
      console.log('')
    }
    
    console.log('=' .repeat(80))
    
    // 2. 显示详细的重复记录
    const detailResult = await pool.query(`
      SELECT id, name, code, parent_id, level, sort_order, status, created_at
      FROM service_fee_categories
      WHERE name IN (
        SELECT name FROM service_fee_categories GROUP BY name HAVING COUNT(*) > 1
      )
      ORDER BY name, id
    `)
    
    console.log('\n📝 详细重复记录:')
    console.log('-'.repeat(80))
    console.log('ID\t| 名称\t\t\t| 代码\t\t\t| 父ID\t| 级别')
    console.log('-'.repeat(80))
    
    for (const row of detailResult.rows) {
      const name = row.name.padEnd(16).slice(0, 16)
      const code = (row.code || '').slice(0, 20).padEnd(20)
      console.log(`${row.id}\t| ${name}\t| ${code}\t| ${row.parent_id || '-'}\t| ${row.level}`)
    }
    
    // 3. 执行删除
    console.log('\n🗑️ 正在删除重复记录（保留ID最小的）...')
    
    const deleteResult = await pool.query(`
      DELETE FROM service_fee_categories a
      USING service_fee_categories b
      WHERE a.id > b.id
        AND a.name = b.name
        AND a.code = b.code
      RETURNING a.id, a.name, a.code
    `)
    
    console.log(`\n✅ 已删除 ${deleteResult.rowCount} 条重复记录:`)
    for (const row of deleteResult.rows) {
      console.log(`   - ID ${row.id}: ${row.name} (${row.code})`)
    }
    
    // 4. 验证
    const verifyResult = await pool.query(`
      SELECT name, code, COUNT(*) as count
      FROM service_fee_categories 
      GROUP BY name, code 
      HAVING COUNT(*) > 1
    `)
    
    if (verifyResult.rows.length === 0) {
      console.log('\n✅ 验证通过：没有重复记录了！')
    } else {
      console.log('\n⚠️ 验证失败：仍有重复记录，请检查')
    }
    
    // 5. 显示最终统计
    const countResult = await pool.query('SELECT COUNT(*) as total FROM service_fee_categories')
    console.log(`\n📊 清理后总记录数: ${countResult.rows[0].total}`)
    
  } catch (error) {
    console.error('❌ 执行失败:', error)
    throw error
  } finally {
    await pool.end()
  }
}

// 主函数
async function main() {
  console.log('=' .repeat(80))
  console.log('🔧 修复服务费类别重复数据')
  console.log('=' .repeat(80))
  console.log('')
  
  await fixDuplicateFeeCategories()
  
  console.log('\n' + '=' .repeat(80))
  console.log('✨ 完成！')
  console.log('=' .repeat(80))
}

main().catch(console.error)

