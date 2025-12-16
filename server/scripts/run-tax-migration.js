/**
 * 税号验证字段数据库迁移脚本
 * 用于在Render数据库上执行迁移
 */

import pg from 'pg'

const migrationSQL = `
-- 添加公司名称字段
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS company_name TEXT;

-- 添加公司地址字段
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS company_address TEXT;

-- 添加验证状态字段（0=未验证, 1=已验证）
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0;

-- 添加验证时间字段
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- 添加验证数据字段（存储API返回的原始数据，JSON格式）
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS verification_data TEXT;

-- 添加验证状态索引
CREATE INDEX IF NOT EXISTS idx_customer_tax_verified ON customer_tax_numbers(is_verified);
`

async function runMigration() {
  // 优先使用命令行参数，其次使用环境变量
  const connectionString = process.argv[2] || process.env.DATABASE_URL
  
  if (!connectionString) {
    console.error('❌ 请提供数据库连接字符串')
    console.error('用法: node run-tax-migration.js <DATABASE_URL>')
    console.error('示例: node run-tax-migration.js "postgres://user:pass@host:5432/dbname"')
    process.exit(1)
  }
  
  console.log('🔄 开始执行税号验证字段迁移...')
  console.log('📍 数据库:', connectionString.split('@')[1]?.split('/')[0] || '***')
  
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    await client.connect()
    console.log('✅ 数据库连接成功')
    
    // 执行迁移
    await client.query(migrationSQL)
    console.log('✅ 迁移SQL执行成功')
    
    // 验证结果
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_tax_numbers' 
      AND column_name IN ('company_name', 'company_address', 'is_verified', 'verified_at', 'verification_data')
      ORDER BY column_name
    `)
    
    console.log('\n📊 新增字段验证:')
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name}: ${row.data_type}`)
    })
    
    if (result.rows.length === 5) {
      console.log('\n🎉 税号验证字段迁移完成！')
    } else {
      console.log(`\n⚠️ 警告: 期望5个字段，实际找到 ${result.rows.length} 个`)
    }
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
