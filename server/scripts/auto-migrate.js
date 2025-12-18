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

    // ==================== 7. 创建 messages 消息表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'system',
        title TEXT NOT NULL,
        content TEXT,
        sender_id TEXT,
        sender_name TEXT,
        receiver_id TEXT NOT NULL,
        receiver_name TEXT,
        related_type TEXT,
        related_id TEXT,
        is_read INTEGER DEFAULT 0,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(is_read)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)`)
    console.log('  ✅ messages 表就绪')

    // ==================== 8. 创建 approvals 审批表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        approval_type TEXT NOT NULL,
        business_id TEXT,
        title TEXT NOT NULL,
        content TEXT,
        amount NUMERIC,
        applicant_id TEXT NOT NULL,
        applicant_name TEXT,
        approver_id TEXT,
        approver_name TEXT,
        status TEXT DEFAULT 'pending',
        remark TEXT,
        reject_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approvals_type ON approvals(approval_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approvals_applicant ON approvals(applicant_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approvals_approver ON approvals(approver_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approvals_business ON approvals(business_id)`)
    console.log('  ✅ approvals 表就绪')

    // ==================== 9. 创建 alert_rules 预警规则表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id TEXT PRIMARY KEY,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        conditions JSONB,
        alert_level TEXT DEFAULT 'warning',
        receivers TEXT,
        is_active INTEGER DEFAULT 1,
        description TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active)`)
    console.log('  ✅ alert_rules 表就绪')

    // ==================== 10. 创建 alert_logs 预警日志表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id SERIAL PRIMARY KEY,
        rule_id TEXT REFERENCES alert_rules(id) ON DELETE SET NULL,
        rule_name TEXT,
        alert_type TEXT NOT NULL,
        alert_level TEXT DEFAULT 'warning',
        title TEXT NOT NULL,
        content TEXT,
        related_type TEXT,
        related_id TEXT,
        status TEXT DEFAULT 'active',
        handled_by TEXT,
        handled_at TIMESTAMP,
        handle_remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_rule ON alert_logs(rule_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_type ON alert_logs(alert_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON alert_logs(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_level ON alert_logs(alert_level)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_created ON alert_logs(created_at DESC)`)
    console.log('  ✅ alert_logs 表就绪')

    // ==================== 11. 插入默认预警规则 ====================
    const existingRules = await client.query(`SELECT COUNT(*) as count FROM alert_rules`)
    if (parseInt(existingRules.rows[0].count) === 0) {
      const defaultRules = [
        {
          id: 'rule-order-overdue',
          rule_name: '订单超期预警',
          rule_type: 'order_overdue',
          conditions: JSON.stringify({ days: 30 }),
          alert_level: 'warning',
          description: '订单创建超过30天未完成时发出预警'
        },
        {
          id: 'rule-payment-due',
          rule_name: '应收逾期预警',
          rule_type: 'payment_due',
          conditions: JSON.stringify({ days: 0 }),
          alert_level: 'danger',
          description: '发票到期未收款时发出预警'
        },
        {
          id: 'rule-credit-limit',
          rule_name: '信用超限预警',
          rule_type: 'credit_limit',
          conditions: JSON.stringify({ threshold: 100 }),
          alert_level: 'danger',
          description: '客户欠款超过信用额度时发出预警'
        },
        {
          id: 'rule-contract-expire',
          rule_name: '合同到期预警',
          rule_type: 'contract_expire',
          conditions: JSON.stringify({ days: 30 }),
          alert_level: 'info',
          description: '合同到期前30天发出提醒'
        },
        {
          id: 'rule-license-expire',
          rule_name: '证照到期预警',
          rule_type: 'license_expire',
          conditions: JSON.stringify({ days: 30 }),
          alert_level: 'info',
          description: '证照到期前30天发出提醒'
        }
      ]
      
      for (const rule of defaultRules) {
        await client.query(`
          INSERT INTO alert_rules (id, rule_name, rule_type, conditions, alert_level, description, is_active, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, 1, 'system')
          ON CONFLICT (id) DO NOTHING
        `, [rule.id, rule.rule_name, rule.rule_type, rule.conditions, rule.alert_level, rule.description])
      }
      console.log('  ✅ 默认预警规则已初始化')
    }

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
