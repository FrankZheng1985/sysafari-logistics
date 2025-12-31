/**
 * HS Code 10位编码更新脚本
 * 将中国原产地记录中已有的 10 位 hs_code 同步到 hs_code_10 字段
 * 
 * 用法: node scripts/update-hscode-10digit.js
 */

import pg from 'pg'

// 阿里云 RDS 生产数据库连接信息
const DATABASE_URL = 'postgresql://sysafari:XianFeng2025@pgm-j6c327ak46gso8t4ao.pg.rds.aliyuncs.com:5432/sysafari_logistics'

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false
})

async function updateHsCode10Digit() {
  console.log('=' .repeat(60))
  console.log('🔧 HS Code 10位编码更新脚本')
  console.log('=' .repeat(60))
  console.log('')
  console.log('🔗 连接到阿里云 RDS PostgreSQL (香港)...')
  
  const client = await pool.connect()
  
  try {
    // ==================== 步骤1: 备份数据 ====================
    console.log('')
    console.log('📦 步骤1: 备份需要更新的记录...')
    console.log('-'.repeat(40))
    
    // 查询需要更新的记录
    const backupResult = await client.query(`
      SELECT id, hs_code, hs_code_10, goods_description, goods_description_cn, 
             origin_country, origin_country_code, duty_rate, anti_dumping_rate
      FROM tariff_rates 
      WHERE (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND LENGTH(hs_code) = 10 
        AND (hs_code_10 IS NULL OR hs_code_10 = '')
        AND is_active = 1
      ORDER BY id
    `)
    
    const recordsToUpdate = backupResult.rows
    console.log(`  找到 ${recordsToUpdate.length} 条需要更新的记录`)
    
    if (recordsToUpdate.length === 0) {
      console.log('')
      console.log('✅ 没有需要更新的记录，脚本结束')
      return
    }
    
    // 显示备份数据
    console.log('')
    console.log('📋 备份数据 (更新前):')
    console.log('  ID     hs_code       hs_code_10    描述')
    console.log('  ' + '-'.repeat(56))
    for (const row of recordsToUpdate) {
      const id = String(row.id).padStart(5)
      const hsCode = (row.hs_code || '').padEnd(12)
      const hsCode10 = (row.hs_code_10 || 'NULL').padEnd(12)
      const desc = (row.goods_description_cn || row.goods_description || '').substring(0, 25)
      console.log(`  ${id}  ${hsCode}  ${hsCode10}  ${desc}`)
    }
    
    // ==================== 步骤2: 开始事务 ====================
    console.log('')
    console.log('🔄 步骤2: 开始事务并执行更新...')
    console.log('-'.repeat(40))
    
    await client.query('BEGIN')
    
    // 执行更新
    const updateResult = await client.query(`
      UPDATE tariff_rates 
      SET hs_code_10 = hs_code,
          updated_at = NOW()
      WHERE (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND LENGTH(hs_code) = 10 
        AND (hs_code_10 IS NULL OR hs_code_10 = '')
        AND is_active = 1
    `)
    
    console.log(`  ✅ 更新了 ${updateResult.rowCount} 条记录`)
    
    // ==================== 步骤3: 验证更新 ====================
    console.log('')
    console.log('🔍 步骤3: 验证更新结果...')
    console.log('-'.repeat(40))
    
    // 查询更新后的数据
    const verifyResult = await client.query(`
      SELECT id, hs_code, hs_code_10, goods_description_cn
      FROM tariff_rates 
      WHERE id = ANY($1::int[])
      ORDER BY id
    `, [recordsToUpdate.map(r => r.id)])
    
    console.log('')
    console.log('📋 更新后的数据:')
    console.log('  ID     hs_code       hs_code_10    描述')
    console.log('  ' + '-'.repeat(56))
    
    let allSuccess = true
    for (const row of verifyResult.rows) {
      const id = String(row.id).padStart(5)
      const hsCode = (row.hs_code || '').padEnd(12)
      const hsCode10 = (row.hs_code_10 || 'NULL').padEnd(12)
      const desc = (row.goods_description_cn || '').substring(0, 25)
      const status = row.hs_code === row.hs_code_10 ? '✅' : '❌'
      console.log(`  ${id}  ${hsCode}  ${hsCode10}  ${desc} ${status}`)
      
      if (row.hs_code !== row.hs_code_10) {
        allSuccess = false
      }
    }
    
    // ==================== 步骤4: 提交事务 ====================
    if (allSuccess) {
      await client.query('COMMIT')
      console.log('')
      console.log('=' .repeat(60))
      console.log('✅ 更新成功！事务已提交')
      console.log('=' .repeat(60))
    } else {
      await client.query('ROLLBACK')
      console.log('')
      console.log('=' .repeat(60))
      console.log('❌ 验证失败，事务已回滚')
      console.log('=' .repeat(60))
    }
    
    // ==================== 步骤5: 最终统计 ====================
    console.log('')
    console.log('📊 最终统计:')
    console.log('-'.repeat(40))
    
    const finalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN hs_code_10 IS NOT NULL AND hs_code_10 != '' THEN 1 END) as with_10digit,
        COUNT(CASE WHEN hs_code_10 IS NULL OR hs_code_10 = '' THEN 1 END) as without_10digit
      FROM tariff_rates
      WHERE (origin_country_code = 'CN' OR origin_country = '中国' OR origin_country = 'China')
        AND is_active = 1
    `)
    
    const stats = finalStats.rows[0]
    console.log(`  中国原产地总记录: ${stats.total}`)
    console.log(`  已有 10 位编码: ${stats.with_10digit} (${(stats.with_10digit / stats.total * 100).toFixed(1)}%)`)
    console.log(`  缺少 10 位编码: ${stats.without_10digit}`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('')
    console.error('❌ 更新失败，事务已回滚')
    console.error('错误信息:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 执行更新
updateHsCode10Digit()
  .then(() => {
    console.log('')
    console.log('🎉 脚本执行完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })

