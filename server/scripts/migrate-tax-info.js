/**
 * 迁移税号数据：将 customer_tax_numbers 表的数据迁移到新的 customer_tax_info 表
 * 新表结构：每个公司一条记录，包含 EORI 和 VAT
 */

import pg from 'pg'
const { Client } = pg

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://sysafari_user:fengzheng1985@localhost:5432/sysafari_logistics'
  })

  try {
    await client.connect()
    console.log('✅ 数据库连接成功')

    // 1. 创建新表 customer_tax_info
    console.log('\n📦 步骤1: 创建 customer_tax_info 表...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_tax_info (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
        company_name VARCHAR(255) NOT NULL,
        company_short_name VARCHAR(100),
        company_address TEXT,
        country VARCHAR(10),
        eori_number VARCHAR(50),
        eori_verified INTEGER DEFAULT 0,
        eori_verified_at TIMESTAMP,
        vat_number VARCHAR(50),
        vat_verified INTEGER DEFAULT 0,
        vat_verified_at TIMESTAMP,
        is_default INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(customer_id, company_name)
      )
    `)
    console.log('  ✅ customer_tax_info 表创建成功')

    // 2. 创建索引
    console.log('\n📦 步骤2: 创建索引...')
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_tax_info_customer ON customer_tax_info(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_tax_info_company ON customer_tax_info(company_name);
    `)
    console.log('  ✅ 索引创建成功')

    // 3. 迁移数据 - 按客户和公司名分组
    console.log('\n📦 步骤3: 迁移数据...')
    
    // 获取所有唯一的 (customer_id, company_name) 组合
    const groupsResult = await client.query(`
      SELECT DISTINCT customer_id, company_name, company_short_name, company_address, country
      FROM customer_tax_numbers
      WHERE company_name IS NOT NULL AND company_name != ''
      ORDER BY customer_id, company_name
    `)
    
    console.log(`  找到 ${groupsResult.rows.length} 个公司税号组合`)
    
    let migratedCount = 0
    let skippedCount = 0
    for (const group of groupsResult.rows) {
      // 检查客户是否存在
      const customerResult = await client.query(
        'SELECT id FROM customers WHERE id = $1',
        [group.customer_id]
      )
      
      if (customerResult.rows.length === 0) {
        console.log(`  ⏭️ 跳过无效客户: ${group.company_name} (客户ID: ${group.customer_id})`)
        skippedCount++
        continue
      }
      
      // 检查是否已存在
      const existingResult = await client.query(
        'SELECT id FROM customer_tax_info WHERE customer_id = $1 AND company_name = $2',
        [group.customer_id, group.company_name]
      )
      
      if (existingResult.rows.length > 0) {
        console.log(`  ⏭️ 跳过已存在: ${group.company_name}`)
        continue
      }
      
      // 获取该公司的 EORI
      const eoriResult = await client.query(`
        SELECT tax_number, is_verified, verified_at 
        FROM customer_tax_numbers 
        WHERE customer_id = $1 AND company_name = $2 AND tax_type = 'eori'
        LIMIT 1
      `, [group.customer_id, group.company_name])
      
      // 获取该公司的 VAT
      const vatResult = await client.query(`
        SELECT tax_number, is_verified, verified_at 
        FROM customer_tax_numbers 
        WHERE customer_id = $1 AND company_name = $2 AND tax_type = 'vat'
        LIMIT 1
      `, [group.customer_id, group.company_name])
      
      const eori = eoriResult.rows[0]
      const vat = vatResult.rows[0]
      
      // 检查是否有默认标记
      const defaultResult = await client.query(`
        SELECT is_default FROM customer_tax_numbers 
        WHERE customer_id = $1 AND company_name = $2 AND is_default = 1
        LIMIT 1
      `, [group.customer_id, group.company_name])
      
      // 插入新记录
      await client.query(`
        INSERT INTO customer_tax_info (
          customer_id, company_name, company_short_name, company_address, country,
          eori_number, eori_verified, eori_verified_at,
          vat_number, vat_verified, vat_verified_at,
          is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        group.customer_id,
        group.company_name,
        group.company_short_name,
        group.company_address,
        group.country,
        eori?.tax_number || null,
        eori?.is_verified || 0,
        eori?.verified_at || null,
        vat?.tax_number || null,
        vat?.is_verified || 0,
        vat?.verified_at || null,
        defaultResult.rows.length > 0 ? 1 : 0
      ])
      
      migratedCount++
      console.log(`  ✅ 迁移: ${group.company_name} (EORI: ${eori?.tax_number || '无'}, VAT: ${vat?.tax_number || '无'})`)
    }
    
    console.log(`\n✅ 迁移完成！共迁移 ${migratedCount} 条记录`)
    
    // 4. 验证迁移结果
    console.log('\n📦 步骤4: 验证迁移结果...')
    const countResult = await client.query('SELECT COUNT(*) as count FROM customer_tax_info')
    console.log(`  customer_tax_info 表现有 ${countResult.rows[0].count} 条记录`)

  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    await client.end()
  }
}

migrate().catch(console.error)
