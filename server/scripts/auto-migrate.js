/**
 * 数据库自动迁移脚本
 * 在服务启动时自动检查并创建/更新数据库表结构
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

export async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  const client = await pool.connect()
  
  try {
    console.log('🔄 开始数据库迁移检查...')
    
    // ==================== 1. 创建 products 表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        product_code TEXT UNIQUE,
        product_name TEXT NOT NULL,
        product_name_en TEXT,
        category TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`)
    console.log('  ✅ products 表就绪')

    // ==================== 2. 创建 product_fee_items 表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_fee_items (
        id SERIAL PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        fee_name TEXT NOT NULL,
        fee_name_en TEXT,
        fee_category TEXT DEFAULT 'other',
        unit TEXT,
        standard_price NUMERIC DEFAULT 0,
        min_price NUMERIC,
        max_price NUMERIC,
        currency TEXT DEFAULT 'EUR',
        is_required INTEGER DEFAULT 0,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_fee_items_product ON product_fee_items(product_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_fee_items_category ON product_fee_items(fee_category)`)
    console.log('  ✅ product_fee_items 表就绪')

    // ==================== 3. 创建 supplier_price_items 表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_price_items (
        id SERIAL PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        supplier_name TEXT,
        fee_name TEXT NOT NULL,
        fee_name_en TEXT,
        fee_category TEXT DEFAULT 'other',
        unit TEXT,
        price NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'EUR',
        effective_date DATE,
        expiry_date DATE,
        route_from TEXT,
        route_to TEXT,
        remark TEXT,
        import_batch_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_price_supplier ON supplier_price_items(supplier_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_price_category ON supplier_price_items(fee_category)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_price_batch ON supplier_price_items(import_batch_id)`)
    console.log('  ✅ supplier_price_items 表就绪')

    // ==================== 4. 创建 import_records 表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_records (
        id SERIAL PRIMARY KEY,
        supplier_id TEXT,
        supplier_name TEXT,
        file_name TEXT,
        file_type TEXT,
        sheet_count INTEGER DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_import_records_supplier ON import_records(supplier_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_import_records_status ON import_records(status)`)
    console.log('  ✅ import_records 表就绪')

    // ==================== 5. fees 表新增字段 ====================
    const feesColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'fees' AND column_name IN ('fee_type', 'supplier_id', 'supplier_name')
    `)
    const existingFeesCols = feesColumns.rows.map(r => r.column_name)
    
    if (!existingFeesCols.includes('fee_type')) {
      await client.query(`ALTER TABLE fees ADD COLUMN fee_type TEXT DEFAULT 'receivable'`)
      console.log('  ✅ fees.fee_type 字段已添加')
    }
    if (!existingFeesCols.includes('supplier_id')) {
      await client.query(`ALTER TABLE fees ADD COLUMN supplier_id TEXT`)
      console.log('  ✅ fees.supplier_id 字段已添加')
    }
    if (!existingFeesCols.includes('supplier_name')) {
      await client.query(`ALTER TABLE fees ADD COLUMN supplier_name TEXT`)
      console.log('  ✅ fees.supplier_name 字段已添加')
    }
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(fee_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_supplier ON fees(supplier_id)`)
    console.log('  ✅ fees 表字段就绪')

    // ==================== 6. payments 表新增字段 ====================
    const paymentsColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name = 'receipt_url'
    `)
    
    if (paymentsColumns.rows.length === 0) {
      await client.query(`ALTER TABLE payments ADD COLUMN receipt_url TEXT`)
      console.log('  ✅ payments.receipt_url 字段已添加')
    }
    console.log('  ✅ payments 表字段就绪')

    console.log('✅ 数据库迁移完成！')
    return true
    
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// 如果直接运行此脚本
if (process.argv[1]?.includes('auto-migrate')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
