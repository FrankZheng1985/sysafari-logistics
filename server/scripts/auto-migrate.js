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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_fee_items_product ON product_fee_items(product_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_fee_items_category ON product_fee_items(fee_category)`)
    
    // 添加供应商关联字段（如果不存在）
    const feeItemColumns = ['supplier_id', 'supplier_price_id', 'cost_price', 'profit_type', 'profit_value', 'supplier_name', 'billing_type']
    for (const col of feeItemColumns) {
      const colExists = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'product_fee_items' AND column_name = $1
      `, [col])
      if (colExists.rows.length === 0) {
        if (col === 'supplier_id') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN supplier_id TEXT`)
        } else if (col === 'supplier_price_id') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN supplier_price_id INTEGER`)
        } else if (col === 'cost_price') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN cost_price NUMERIC DEFAULT 0`)
        } else if (col === 'profit_type') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN profit_type TEXT DEFAULT 'amount'`)
        } else if (col === 'profit_value') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN profit_value NUMERIC DEFAULT 0`)
        } else if (col === 'supplier_name') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN supplier_name TEXT`)
        } else if (col === 'billing_type') {
          await client.query(`ALTER TABLE product_fee_items ADD COLUMN billing_type TEXT DEFAULT 'fixed'`)
        }
        console.log(`    + product_fee_items.${col} 字段已添加`)
      }
    }
    await client.query(`CREATE INDEX IF NOT EXISTS idx_product_fee_items_supplier ON product_fee_items(supplier_id)`)
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_price_supplier ON supplier_price_items(supplier_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_price_category ON supplier_price_items(fee_category)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_supplier_price_batch ON supplier_price_items(import_batch_id)`)
    
    // 检查并添加 supplier_price_items 缺失的字段（2025-12-26新增）
    const supplierPriceCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'supplier_price_items' 
      AND column_name IN ('country', 'city', 'return_point', 'transport_mode', 'billing_type', 'status')
    `)
    const existingSupplierPriceCols = supplierPriceCols.rows.map(r => r.column_name)
    
    if (!existingSupplierPriceCols.includes('country')) {
      await client.query(`ALTER TABLE supplier_price_items ADD COLUMN country TEXT`)
      console.log('  ✅ supplier_price_items.country 字段已添加')
    }
    if (!existingSupplierPriceCols.includes('city')) {
      await client.query(`ALTER TABLE supplier_price_items ADD COLUMN city TEXT`)
      console.log('  ✅ supplier_price_items.city 字段已添加')
    }
    if (!existingSupplierPriceCols.includes('return_point')) {
      await client.query(`ALTER TABLE supplier_price_items ADD COLUMN return_point TEXT`)
      console.log('  ✅ supplier_price_items.return_point 字段已添加')
    }
    if (!existingSupplierPriceCols.includes('transport_mode')) {
      await client.query(`ALTER TABLE supplier_price_items ADD COLUMN transport_mode TEXT`)
      console.log('  ✅ supplier_price_items.transport_mode 字段已添加')
    }
    if (!existingSupplierPriceCols.includes('billing_type')) {
      await client.query(`ALTER TABLE supplier_price_items ADD COLUMN billing_type TEXT DEFAULT 'fixed'`)
      console.log('  ✅ supplier_price_items.billing_type 字段已添加')
    }
    if (!existingSupplierPriceCols.includes('status')) {
      await client.query(`ALTER TABLE supplier_price_items ADD COLUMN status TEXT DEFAULT 'active'`)
      console.log('  ✅ supplier_price_items.status 字段已添加')
    }
    
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
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_import_records_supplier ON import_records(supplier_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_import_records_status ON import_records(status)`)
    
    // 检查并添加数据导入需要的字段
    const importRecordsCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'import_records' AND column_name IN ('import_type', 'total_rows', 'success_rows', 'error_rows', 'created_by_name')
    `)
    const existingImportCols = importRecordsCols.rows.map(r => r.column_name)
    
    if (!existingImportCols.includes('import_type')) {
      await client.query(`ALTER TABLE import_records ADD COLUMN import_type TEXT`)
      console.log('  ✅ import_records.import_type 字段已添加')
    }
    if (!existingImportCols.includes('total_rows')) {
      await client.query(`ALTER TABLE import_records ADD COLUMN total_rows INTEGER DEFAULT 0`)
      console.log('  ✅ import_records.total_rows 字段已添加')
    }
    if (!existingImportCols.includes('success_rows')) {
      await client.query(`ALTER TABLE import_records ADD COLUMN success_rows INTEGER DEFAULT 0`)
      console.log('  ✅ import_records.success_rows 字段已添加')
    }
    if (!existingImportCols.includes('error_rows')) {
      await client.query(`ALTER TABLE import_records ADD COLUMN error_rows INTEGER DEFAULT 0`)
      console.log('  ✅ import_records.error_rows 字段已添加')
    }
    // 导入者追踪字段（2025-12-24新增）
    if (!existingImportCols.includes('created_by_name')) {
      await client.query(`ALTER TABLE import_records ADD COLUMN created_by_name TEXT`)
      console.log('  ✅ import_records.created_by_name 字段已添加')
    }
    // 确保 created_by 字段存在（原有字段可能是 TEXT，兼容旧数据）
    const createdByCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'import_records' AND column_name = 'created_by'
    `)
    if (createdByCheck.rows.length === 0) {
      await client.query(`ALTER TABLE import_records ADD COLUMN created_by INTEGER`)
      console.log('  ✅ import_records.created_by 字段已添加')
    }
    
    // 创建导入者索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_import_records_created_by ON import_records(created_by)`)
    
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
    
    // 检查并添加 description 字段
    const descCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'fees' AND column_name = 'description'
    `)
    if (descCheck.rows.length === 0) {
      await client.query(`ALTER TABLE fees ADD COLUMN description TEXT`)
      console.log('  ✅ fees.description 字段已添加')
    }

    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(fee_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_supplier ON fees(supplier_id)`)
    
    // 费用表性能优化索引（2024-12-26新增）
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_bill_id ON fees(bill_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_fee_date ON fees(fee_date DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_created_at ON fees(created_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_customer_id ON fees(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_bill_number ON fees(bill_number)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_bill_type ON fees(bill_id, fee_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_date_created ON fees(fee_date DESC, created_at DESC)`)
    
    console.log('  ✅ fees 表字段和索引就绪')

    // ==================== 6. payments 表新增字段 ====================
    const paymentsColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name = 'receipt_url'
    `)
    
    if (paymentsColumns.rows.length === 0) {
      await client.query(`ALTER TABLE payments ADD COLUMN receipt_url TEXT`)
      console.log('  ✅ payments.receipt_url 字段已添加')
    }
    
    // 添加 invoice_ids 字段支持多发票关联（已弃用，保留兼容）
    const paymentInvoiceIdsColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name = 'invoice_ids'
    `)
    if (paymentInvoiceIdsColumn.rows.length === 0) {
      await client.query(`ALTER TABLE payments ADD COLUMN invoice_ids TEXT`)
      console.log('  ✅ payments.invoice_ids 字段已添加')
    }
    
    // 添加 payment_batch_id 字段支持批量核销分组
    const paymentBatchIdColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'payments' AND column_name = 'payment_batch_id'
    `)
    if (paymentBatchIdColumn.rows.length === 0) {
      await client.query(`ALTER TABLE payments ADD COLUMN payment_batch_id TEXT`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_batch_id ON payments(payment_batch_id)`)
      console.log('  ✅ payments.payment_batch_id 字段已添加（支持批量核销分组）')
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
        created_at TIMESTAMP DEFAULT NOW()
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
        created_at TIMESTAMP DEFAULT NOW(),
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active)`)
    console.log('  ✅ alert_rules 表就绪')

    // ==================== 10. 创建 alert_logs 预警日志表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id TEXT PRIMARY KEY,
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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_rule ON alert_logs(rule_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_type ON alert_logs(alert_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON alert_logs(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_level ON alert_logs(alert_level)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_logs_created ON alert_logs(created_at DESC)`)
    
    // 修复已存在的 alert_logs 表：如果 id 列是 INTEGER 类型，需要转换为 TEXT
    try {
      const colType = await client.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'alert_logs' AND column_name = 'id'
      `)
      if (colType.rows[0] && colType.rows[0].data_type === 'integer') {
        // 删除现有数据（如果有的话）并重建表
        await client.query(`ALTER TABLE alert_logs ALTER COLUMN id TYPE TEXT USING id::TEXT`)
        console.log('  ✅ alert_logs.id 列已转换为 TEXT 类型')
      }
    } catch (err) {
      // 忽略错误，表可能是新创建的
    }
    
    console.log('  ✅ alert_logs 表就绪')

    // ==================== 11. 插入默认预警规则 ====================
    const existingRules = await client.query(`SELECT COUNT(*) as count FROM alert_rules`)
    if (parseInt(existingRules.rows[0].count) === 0) {
      const defaultRules = [
        {
          id: 'rule-order-overdue',
          rule_name: '订单送达未完结预警',
          rule_type: 'order_overdue',
          conditions: JSON.stringify({ days: 10 }),
          alert_level: 'warning',
          description: '货物送达客户仓库后超过10天未完结单据时发出预警，便于财务及时出账'
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
          id: 'rule-payment-term-due',
          rule_name: '账期即将到期预警',
          rule_type: 'payment_term_due',
          conditions: JSON.stringify({ days: 7 }),
          alert_level: 'warning',
          description: '发票账期即将在7天内到期时发出预警'
        },
        {
          id: 'rule-customer-overdue',
          rule_name: '客户多笔逾期预警',
          rule_type: 'customer_overdue',
          conditions: JSON.stringify({ minCount: 2 }),
          alert_level: 'danger',
          description: '客户有2笔及以上发票逾期未付时发出预警'
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
    } else {
      // 补充插入新增的预警规则（账期预警）
      const newRules = [
        {
          id: 'rule-payment-term-due',
          rule_name: '账期即将到期预警',
          rule_type: 'payment_term_due',
          conditions: JSON.stringify({ days: 7 }),
          alert_level: 'warning',
          description: '发票账期即将在7天内到期时发出预警'
        },
        {
          id: 'rule-customer-overdue',
          rule_name: '客户多笔逾期预警',
          rule_type: 'customer_overdue',
          conditions: JSON.stringify({ minCount: 2 }),
          alert_level: 'danger',
          description: '客户有2笔及以上发票逾期未付时发出预警'
        }
      ]
      
      for (const rule of newRules) {
        await client.query(`
          INSERT INTO alert_rules (id, rule_name, rule_type, conditions, alert_level, description, is_active, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, 1, 'system')
          ON CONFLICT (id) DO NOTHING
        `, [rule.id, rule.rule_name, rule.rule_type, rule.conditions, rule.alert_level, rule.description])
      }
      console.log('  ✅ 新增预警规则已补充')
    }

    // ==================== 12. 创建 financial_reports 财务报表历史表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS financial_reports (
        id TEXT PRIMARY KEY,
        report_type TEXT NOT NULL,
        report_name TEXT NOT NULL,
        period_start DATE,
        period_end DATE,
        as_of_date DATE,
        pdf_url TEXT,
        pdf_key TEXT,
        report_data JSONB,
        currency TEXT DEFAULT 'EUR',
        created_by TEXT,
        created_by_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_financial_reports_type ON financial_reports(report_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_financial_reports_created ON financial_reports(created_at DESC)`)
    console.log('  ✅ financial_reports 表就绪')

    // ==================== 13. TARIC 相关表 - tariff_rates 扩展字段 ====================
    const tariffColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'tariff_rates' AND column_name IN (
        'taric_code', 'third_country_duty', 'geographical_area', 
        'taric_version', 'regulation_id', 'regulation_url',
        'countervailing_rate', 'measures', 'origin_rules', 
        'additional_codes', 'api_source', 'last_api_sync',
        'has_quota', 'requires_license', 'requires_sps'
      )
    `)
    const existingTariffCols = tariffColumns.rows.map(r => r.column_name)
    
    if (!existingTariffCols.includes('taric_code')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN taric_code TEXT`)
    }
    if (!existingTariffCols.includes('third_country_duty')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN third_country_duty NUMERIC`)
    }
    if (!existingTariffCols.includes('geographical_area')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN geographical_area TEXT`)
    }
    if (!existingTariffCols.includes('taric_version')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN taric_version TEXT`)
    }
    if (!existingTariffCols.includes('regulation_id')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN regulation_id TEXT`)
    }
    if (!existingTariffCols.includes('regulation_url')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN regulation_url TEXT`)
    }
    // 新增：反补贴税率
    if (!existingTariffCols.includes('countervailing_rate')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN countervailing_rate NUMERIC DEFAULT 0`)
      console.log('  ✅ tariff_rates.countervailing_rate 字段已添加')
    }
    // 新增：贸易措施 (JSONB)
    if (!existingTariffCols.includes('measures')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN measures JSONB DEFAULT '[]'`)
      console.log('  ✅ tariff_rates.measures 字段已添加')
    }
    // 新增：原产地规则 (JSONB)
    if (!existingTariffCols.includes('origin_rules')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN origin_rules JSONB DEFAULT '{}'`)
      console.log('  ✅ tariff_rates.origin_rules 字段已添加')
    }
    // 新增：附加代码
    if (!existingTariffCols.includes('additional_codes')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN additional_codes TEXT[]`)
      console.log('  ✅ tariff_rates.additional_codes 字段已添加')
    }
    // 新增：API 数据来源
    if (!existingTariffCols.includes('api_source')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN api_source TEXT DEFAULT 'manual'`)
      console.log('  ✅ tariff_rates.api_source 字段已添加')
    }
    // 新增：最后 API 同步时间
    if (!existingTariffCols.includes('last_api_sync')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN last_api_sync TIMESTAMP`)
      console.log('  ✅ tariff_rates.last_api_sync 字段已添加')
    }
    // 新增：是否有配额限制
    if (!existingTariffCols.includes('has_quota')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN has_quota INTEGER DEFAULT 0`)
      console.log('  ✅ tariff_rates.has_quota 字段已添加')
    }
    // 新增：是否需要许可证
    if (!existingTariffCols.includes('requires_license')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN requires_license INTEGER DEFAULT 0`)
      console.log('  ✅ tariff_rates.requires_license 字段已添加')
    }
    // 新增：是否需要 SPS 检验
    if (!existingTariffCols.includes('requires_sps')) {
      await client.query(`ALTER TABLE tariff_rates ADD COLUMN requires_sps INTEGER DEFAULT 0`)
      console.log('  ✅ tariff_rates.requires_sps 字段已添加')
    }
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tariff_rates_taric_code ON tariff_rates(taric_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tariff_rates_geo_area ON tariff_rates(geographical_area)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tariff_rates_version ON tariff_rates(taric_version)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tariff_rates_api_source ON tariff_rates(api_source)`)
    console.log('  ✅ tariff_rates TARIC 扩展字段就绪')

    // ==================== 14. 创建 trade_agreements 贸易协定表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_agreements (
        id TEXT PRIMARY KEY,
        agreement_code TEXT NOT NULL,
        agreement_name TEXT NOT NULL,
        agreement_name_cn TEXT,
        agreement_type TEXT,
        country_code TEXT,
        country_name TEXT,
        country_name_cn TEXT,
        geographical_area TEXT,
        preferential_rate NUMERIC,
        conditions TEXT,
        document_code TEXT,
        valid_from DATE,
        valid_to DATE,
        is_active INTEGER DEFAULT 1,
        taric_version TEXT,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_agreements_code ON trade_agreements(agreement_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_agreements_country ON trade_agreements(country_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_agreements_geo ON trade_agreements(geographical_area)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trade_agreements_active ON trade_agreements(is_active)`)
    console.log('  ✅ trade_agreements 表就绪')

    // ==================== 15. 创建 taric_sync_logs 同步日志表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS taric_sync_logs (
        id TEXT PRIMARY KEY,
        sync_type TEXT NOT NULL,
        data_source TEXT NOT NULL,
        source_url TEXT,
        file_name TEXT,
        taric_version TEXT,
        total_records INTEGER DEFAULT 0,
        inserted_count INTEGER DEFAULT 0,
        updated_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_sync_status ON taric_sync_logs(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_sync_type ON taric_sync_logs(sync_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_sync_created ON taric_sync_logs(created_at DESC)`)
    console.log('  ✅ taric_sync_logs 表就绪')

    // ==================== 16. 创建 taric_measures 贸易措施表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS taric_measures (
        id TEXT PRIMARY KEY,
        measure_sid TEXT,
        measure_type TEXT NOT NULL,
        measure_type_description TEXT,
        goods_nomenclature_code TEXT NOT NULL,
        geographical_area TEXT,
        geographical_area_description TEXT,
        duty_expression TEXT,
        duty_amount NUMERIC,
        duty_type TEXT,
        additional_code TEXT,
        additional_code_description TEXT,
        order_number TEXT,
        reduction_indicator INTEGER,
        validity_start_date DATE,
        validity_end_date DATE,
        regulation_id TEXT,
        regulation_url TEXT,
        footnotes JSONB,
        conditions JSONB,
        excluded_areas JSONB,
        taric_version TEXT,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_measures_type ON taric_measures(measure_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_measures_code ON taric_measures(goods_nomenclature_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_measures_geo ON taric_measures(geographical_area)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_taric_measures_validity ON taric_measures(validity_start_date, validity_end_date)`)
    console.log('  ✅ taric_measures 表就绪')

    // ==================== 17. 创建 cargo_imports 货物导入批次表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS cargo_imports (
        id SERIAL PRIMARY KEY,
        import_no TEXT NOT NULL UNIQUE,
        order_id TEXT,
        order_no TEXT,
        customer_id TEXT,
        customer_name TEXT,
        container_no TEXT,
        bill_number TEXT,
        origin_country_code TEXT,
        total_items INTEGER DEFAULT 0,
        matched_items INTEGER DEFAULT 0,
        pending_items INTEGER DEFAULT 0,
        total_value NUMERIC DEFAULT 0,
        total_duty NUMERIC DEFAULT 0,
        total_vat NUMERIC DEFAULT 0,
        total_other_tax NUMERIC DEFAULT 0,
        customer_confirmed INTEGER DEFAULT 0,
        customer_confirmed_at TIMESTAMP,
        customer_confirmed_by TEXT,
        confirm_pdf_path TEXT,
        status TEXT DEFAULT 'pending',
        import_file_name TEXT,
        import_file_path TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_no ON cargo_imports(import_no)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_order ON cargo_imports(order_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_customer ON cargo_imports(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_container ON cargo_imports(container_no)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_status ON cargo_imports(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_created ON cargo_imports(created_at DESC)`)
    
    // 检查并添加 order_id 字段（兼容旧表）
    const orderIdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cargo_imports' AND column_name = 'order_id'
    `)
    if (orderIdCheck.rows.length === 0) {
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN order_id TEXT`)
      console.log('  ✅ cargo_imports.order_id 字段已添加')
    }
    
    // 检查并添加 order_no 字段（订单号，兼容旧表）
    const orderNoCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cargo_imports' AND column_name = 'order_no'
    `)
    if (orderNoCheck.rows.length === 0) {
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN order_no TEXT`)
      console.log('  ✅ cargo_imports.order_no 字段已添加')
    }
    
    // 检查并添加发货方和进口商字段
    const shipperNameCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cargo_imports' AND column_name = 'shipper_name'
    `)
    if (shipperNameCheck.rows.length === 0) {
      // 发货方信息
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN shipper_name TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN shipper_address TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN shipper_contact TEXT`)
      // 进口商信息
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_customer_id TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_name TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_tax_id TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_tax_number TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_tax_type TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_country TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_company_name TEXT`)
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN importer_address TEXT`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_importer ON cargo_imports(importer_customer_id)`)
      console.log('  ✅ cargo_imports 发货方和进口商字段已添加')
    }
    
    // 检查并添加 clearance_type 字段（清关类型：40-普通清关，42-递延清关）
    const clearanceTypeCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cargo_imports' AND column_name = 'clearance_type'
    `)
    if (clearanceTypeCheck.rows.length === 0) {
      await client.query(`ALTER TABLE cargo_imports ADD COLUMN clearance_type TEXT DEFAULT '40'`)
      console.log('  ✅ cargo_imports.clearance_type 字段已添加')
    }
    console.log('  ✅ cargo_imports 表就绪')

    // ==================== 18. 创建 cargo_items 货物明细表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS cargo_items (
        id SERIAL PRIMARY KEY,
        import_id INTEGER REFERENCES cargo_imports(id) ON DELETE CASCADE,
        item_no INTEGER,
        product_name TEXT,
        product_name_en TEXT,
        customer_hs_code TEXT,
        matched_hs_code TEXT,
        match_confidence NUMERIC DEFAULT 0,
        match_source TEXT,
        quantity NUMERIC DEFAULT 0,
        unit_code TEXT,
        unit_name TEXT,
        unit_price NUMERIC DEFAULT 0,
        total_value NUMERIC DEFAULT 0,
        gross_weight NUMERIC DEFAULT 0,
        net_weight NUMERIC DEFAULT 0,
        origin_country TEXT,
        material TEXT,
        duty_rate NUMERIC DEFAULT 0,
        vat_rate NUMERIC DEFAULT 19,
        anti_dumping_rate NUMERIC DEFAULT 0,
        countervailing_rate NUMERIC DEFAULT 0,
        duty_amount NUMERIC DEFAULT 0,
        vat_amount NUMERIC DEFAULT 0,
        other_tax_amount NUMERIC DEFAULT 0,
        total_tax NUMERIC DEFAULT 0,
        match_status TEXT DEFAULT 'pending',
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_import ON cargo_items(import_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_hs ON cargo_items(customer_hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_matched_hs ON cargo_items(matched_hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_status ON cargo_items(match_status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_product ON cargo_items(product_name)`)
    // 添加产品图片字段
    try {
      await client.query(`ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS product_image TEXT`)
      await client.query(`ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`)
    } catch (e) {
      // 字段可能已存在
    }
    console.log('  ✅ cargo_items 表就绪')

    // ==================== 19. 创建 hs_match_history HS匹配历史表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS hs_match_history (
        id SERIAL PRIMARY KEY,
        product_name TEXT NOT NULL,
        product_name_en TEXT,
        material TEXT,
        matched_hs_code TEXT NOT NULL,
        match_count INTEGER DEFAULT 1,
        last_matched_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_history_name ON hs_match_history(product_name)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_history_hs ON hs_match_history(matched_hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_history_material ON hs_match_history(material)`)
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_match_history_unique ON hs_match_history(product_name, COALESCE(material, ''))`)
    console.log('  ✅ hs_match_history 表就绪')

    // ==================== 20. 创建 tracking_records 跟踪记录表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_records (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        transport_type TEXT DEFAULT 'sea',
        tracking_number TEXT,
        node_type TEXT NOT NULL,
        node_name TEXT,
        status TEXT DEFAULT 'in_transit',
        location TEXT,
        event_time TEXT,
        remark TEXT,
        source TEXT DEFAULT 'manual',
        operator TEXT DEFAULT '系统',
        latitude NUMERIC,
        longitude NUMERIC,
        raw_data TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tracking_bill_id ON tracking_records(bill_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tracking_transport_type ON tracking_records(transport_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tracking_status ON tracking_records(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tracking_event_time ON tracking_records(event_time)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tracking_source ON tracking_records(source)`)
    console.log('  ✅ tracking_records 表就绪')

    // ==================== 21. 创建 tracking_api_configs API配置表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_api_configs (
        id SERIAL PRIMARY KEY,
        provider_code TEXT NOT NULL UNIQUE,
        provider_name TEXT NOT NULL,
        transport_type TEXT DEFAULT 'sea',
        api_type TEXT DEFAULT 'rest',
        api_url TEXT,
        api_key TEXT,
        api_secret TEXT,
        extra_config TEXT,
        status TEXT DEFAULT 'active',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_config_provider ON tracking_api_configs(provider_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_config_transport ON tracking_api_configs(transport_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_config_status ON tracking_api_configs(status)`)
    console.log('  ✅ tracking_api_configs 表就绪')

    // ==================== 22. 创建 tracking_nodes 手动节点表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_nodes (
        id SERIAL PRIMARY KEY,
        bill_id TEXT NOT NULL,
        transport_type TEXT DEFAULT 'truck',
        node_order INTEGER DEFAULT 0,
        node_type TEXT NOT NULL,
        node_name TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        completed_time TEXT,
        location TEXT,
        latitude NUMERIC,
        longitude NUMERIC,
        photo_url TEXT,
        remark TEXT,
        operator TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nodes_bill_id ON tracking_nodes(bill_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nodes_transport ON tracking_nodes(transport_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nodes_completed ON tracking_nodes(is_completed)`)
    console.log('  ✅ tracking_nodes 表就绪')

    // ==================== 23. 创建起运港表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS ports_of_loading (
        id SERIAL PRIMARY KEY,
        port_code TEXT NOT NULL UNIQUE,
        port_name_cn TEXT NOT NULL,
        port_name_en TEXT,
        country TEXT,
        country_code TEXT,
        city TEXT,
        description TEXT,
        transport_type TEXT DEFAULT 'sea',
        port_type TEXT DEFAULT 'main',
        parent_port_code TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        sort_order INTEGER DEFAULT 0,
        continent TEXT
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ports_code ON ports_of_loading(port_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ports_name_cn ON ports_of_loading(port_name_cn)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ports_country ON ports_of_loading(country)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ports_status ON ports_of_loading(status)`)
    console.log('  ✅ ports_of_loading 表就绪')

    // ==================== 25. 插入起运港初始数据 ====================
    const portsCheck = await client.query(`SELECT COUNT(*) as count FROM ports_of_loading`)
    
    if (parseInt(portsCheck.rows[0].count) === 0) {
      console.log('  📝 插入起运港初始数据...')
      await client.query(`
        INSERT INTO ports_of_loading (
          port_code, port_name_cn, port_name_en, country, country_code, city, 
          transport_type, port_type, parent_port_code, sort_order
        ) VALUES 
          -- 中国主要海港
          ('CNSHA', '上海港', 'Shanghai', '中国', 'CN', '上海', 'sea', 'main', NULL, 1),
          ('CNNGB', '宁波港', 'Ningbo', '中国', 'CN', '宁波', 'sea', 'main', NULL, 2),
          ('CNSZX', '深圳港', 'Shenzhen', '中国', 'CN', '深圳', 'sea', 'main', NULL, 3),
          ('CNYTN', '盐田港', 'Yantian', '中国', 'CN', '深圳', 'sea', 'sub', 'CNSZX', 4),
          ('CNSHE', '蛇口港', 'Shekou', '中国', 'CN', '深圳', 'sea', 'sub', 'CNSZX', 5),
          ('CNQIN', '青岛港', 'Qingdao', '中国', 'CN', '青岛', 'sea', 'main', NULL, 6),
          ('CNTXG', '天津港', 'Tianjin', '中国', 'CN', '天津', 'sea', 'main', NULL, 7),
          ('CNXMN', '厦门港', 'Xiamen', '中国', 'CN', '厦门', 'sea', 'main', NULL, 8),
          ('CNGZN', '广州港', 'Guangzhou', '中国', 'CN', '广州', 'sea', 'main', NULL, 9),
          ('CNNSA', '南沙港', 'Nansha', '中国', 'CN', '广州', 'sea', 'sub', 'CNGZN', 10),
          ('CNDLC', '大连港', 'Dalian', '中国', 'CN', '大连', 'sea', 'main', NULL, 11),
          ('CNLYG', '连云港', 'Lianyungang', '中国', 'CN', '连云港', 'sea', 'main', NULL, 12),
          ('CNFOC', '福州港', 'Fuzhou', '中国', 'CN', '福州', 'sea', 'main', NULL, 13),
          ('CNHAK', '海口港', 'Haikou', '中国', 'CN', '海口', 'sea', 'main', NULL, 14),
          ('CNZUH', '珠海港', 'Zhuhai', '中国', 'CN', '珠海', 'sea', 'main', NULL, 15),
          -- 中国主要空港
          ('CNPVG', '上海浦东机场', 'Shanghai Pudong', '中国', 'CN', '上海', 'air', 'main', NULL, 100),
          ('CNPEK', '北京首都机场', 'Beijing Capital', '中国', 'CN', '北京', 'air', 'main', NULL, 101),
          ('CNCAN', '广州白云机场', 'Guangzhou Baiyun', '中国', 'CN', '广州', 'air', 'main', NULL, 102),
          ('CNSHE', '沈阳桃仙机场', 'Shenyang Taoxian', '中国', 'CN', '沈阳', 'air', 'main', NULL, 103),
          ('CNSZX', '深圳宝安机场', 'Shenzhen Baoan', '中国', 'CN', '深圳', 'air', 'main', NULL, 104),
          -- 中欧班列站点
          ('CNXIA', '西安国际港', 'Xian International Port', '中国', 'CN', '西安', 'rail', 'main', NULL, 200),
          ('CNCGO', '郑州圃田站', 'Zhengzhou Putian', '中国', 'CN', '郑州', 'rail', 'main', NULL, 201),
          ('CNCHG', '重庆团结村站', 'Chongqing Tuanjiecun', '中国', 'CN', '重庆', 'rail', 'main', NULL, 202),
          ('CNCDG', '成都城厢站', 'Chengdu Chengxiang', '中国', 'CN', '成都', 'rail', 'main', NULL, 203),
          ('CNURS', '乌鲁木齐站', 'Urumqi', '中国', 'CN', '乌鲁木齐', 'rail', 'main', NULL, 204),
          ('CNYIW', '义乌西站', 'Yiwu West', '中国', 'CN', '义乌', 'rail', 'main', NULL, 205)
        ON CONFLICT (port_code) DO NOTHING
      `)
      console.log('  ✅ 起运港初始数据已插入')
    } else {
      // 检查盐田港是否存在，如果不存在则插入
      const yantianCheck = await client.query(`SELECT COUNT(*) as count FROM ports_of_loading WHERE port_code = 'CNYTN'`)
      if (parseInt(yantianCheck.rows[0].count) === 0) {
        await client.query(`
          INSERT INTO ports_of_loading (
            port_code, port_name_cn, port_name_en, country, country_code, city, 
            transport_type, port_type, parent_port_code, sort_order
          ) VALUES 
            ('CNYTN', '盐田港', 'Yantian', '中国', 'CN', '深圳', 'sea', 'sub', 'CNSZX', 4),
            ('CNSHE', '蛇口港', 'Shekou', '中国', 'CN', '深圳', 'sea', 'sub', 'CNSZX', 5),
            ('CNNSA', '南沙港', 'Nansha', '中国', 'CN', '广州', 'sea', 'sub', 'CNGZN', 10)
          ON CONFLICT (port_code) DO NOTHING
        `)
        console.log('  ✅ 补充插入盐田港等港口数据')
      } else {
        console.log('  ✅ 起运港数据已存在，跳过插入')
      }
    }

    // ==================== 聊天相关表 ====================
    // chat_conversations 会话表
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(20) NOT NULL DEFAULT 'private',
        name VARCHAR(100),
        avatar VARCHAR(500),
        description TEXT,
        creator_id VARCHAR(50),
        creator_name VARCHAR(100),
        last_message_id VARCHAR(50),
        last_message_content TEXT,
        last_message_time TIMESTAMP,
        member_count INTEGER DEFAULT 2,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_type ON chat_conversations(type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_creator ON chat_conversations(creator_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_last_message_time ON chat_conversations(last_message_time DESC)`)
    console.log('  ✅ chat_conversations 表就绪')

    // chat_participants 会话参与者表
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(50) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(100),
        user_avatar VARCHAR(500),
        nickname VARCHAR(100),
        role VARCHAR(20) DEFAULT 'member',
        is_muted INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        last_read_at TIMESTAMP,
        last_read_message_id VARCHAR(50),
        joined_at TIMESTAMP DEFAULT NOW(),
        left_at TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_participants_conversation ON chat_participants(conversation_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_participants_user ON chat_participants(user_id)`)
    console.log('  ✅ chat_participants 表就绪')

    // chat_messages 聊天消息表
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(50) PRIMARY KEY,
        conversation_id VARCHAR(50) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_id VARCHAR(50) NOT NULL,
        sender_name VARCHAR(100),
        sender_avatar VARCHAR(500),
        content TEXT,
        msg_type VARCHAR(20) DEFAULT 'text',
        file_url VARCHAR(500),
        file_name VARCHAR(200),
        file_size INTEGER,
        reply_to_id VARCHAR(50),
        reply_to_content TEXT,
        mentioned_users TEXT,
        related_type VARCHAR(50),
        related_id VARCHAR(50),
        related_title VARCHAR(200),
        is_recalled INTEGER DEFAULT 0,
        recalled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON chat_messages(sender_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat_messages(conversation_id, created_at DESC)`)
    console.log('  ✅ chat_messages 表就绪')

    // business_discussions 业务讨论表
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_discussions (
        id SERIAL PRIMARY KEY,
        business_type VARCHAR(50) NOT NULL,
        business_id VARCHAR(50) NOT NULL,
        business_title VARCHAR(200),
        user_id VARCHAR(50) NOT NULL,
        user_name VARCHAR(100),
        user_avatar VARCHAR(500),
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES business_discussions(id) ON DELETE CASCADE,
        mentioned_users TEXT,
        attachment_url VARCHAR(500),
        attachment_name VARCHAR(200),
        is_deleted INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_discussions_business ON business_discussions(business_type, business_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_discussions_user ON business_discussions(user_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_discussions_parent ON business_discussions(parent_id)`)
    console.log('  ✅ business_discussions 表就绪')

    // user_online_status 用户在线状态表
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_online_status (
        user_id VARCHAR(50) PRIMARY KEY,
        user_name VARCHAR(100),
        is_online INTEGER DEFAULT 0,
        last_active_at TIMESTAMP DEFAULT NOW(),
        socket_id VARCHAR(100),
        device_type VARCHAR(20) DEFAULT 'web',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_online_status_active ON user_online_status(is_online, last_active_at DESC)`)
    console.log('  ✅ user_online_status 表就绪')

    // ==================== 客户表字段补充 ====================
    // 添加所有可能缺失的客户表字段
    const customerColumns = [
      { name: 'customer_region', type: 'TEXT', default: "'china'" },
      { name: 'company_name_en', type: 'TEXT', default: null },  // 公司英文名称
      { name: 'legal_person', type: 'TEXT', default: null },
      { name: 'registered_capital', type: 'TEXT', default: null },
      { name: 'establishment_date', type: 'TEXT', default: null },
      { name: 'business_scope', type: 'TEXT', default: null },
      { name: 'assigned_to', type: 'TEXT', default: null },
      { name: 'assigned_name', type: 'TEXT', default: null },
      { name: 'postal_code', type: 'TEXT', default: null },
      { name: 'province', type: 'TEXT', default: null },
      { name: 'bank_name', type: 'TEXT', default: null },
      { name: 'bank_account', type: 'TEXT', default: null },
      { name: 'credit_limit', type: 'NUMERIC', default: '0' },
      { name: 'payment_terms', type: 'TEXT', default: null },
      { name: 'tags', type: 'TEXT', default: null }
    ]
    
    for (const col of customerColumns) {
      const defaultClause = col.default ? ` DEFAULT ${col.default}` : ''
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customers' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE customers ADD COLUMN ${col.name} ${col.type}${defaultClause};
          END IF;
        END $$;
      `)
    }
    console.log('  ✅ customers 表字段就绪')
    
    // ==================== 客户表索引优化 ====================
    // 添加常用查询字段索引以提升查询性能
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_level ON customers(customer_level)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_assigned ON customers(assigned_to)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_status_updated ON customers(status, updated_at DESC)`)
    console.log('  ✅ customers 表索引优化就绪')

    // ==================== 客户联系人表字段补充 ====================
    const contactColumns = [
      { name: 'contact_type', type: 'TEXT', default: "'other'" },
      { name: 'position', type: 'TEXT', default: null },
      { name: 'department', type: 'TEXT', default: null },
      { name: 'wechat', type: 'TEXT', default: null },
      { name: 'qq', type: 'TEXT', default: null },
      { name: 'is_decision_maker', type: 'INTEGER', default: '0' }
    ]
    
    for (const col of contactColumns) {
      const defaultClause = col.default ? ` DEFAULT ${col.default}` : ''
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customer_contacts' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE customer_contacts ADD COLUMN ${col.name} ${col.type}${defaultClause};
          END IF;
        END $$;
      `)
    }
    console.log('  ✅ customer_contacts 表字段就绪')

    // ==================== 提单表字段补充 ====================
    const billColumns = [
      { name: 'voyage', type: 'TEXT', default: null },
      { name: 'etd', type: 'TEXT', default: null },
      { name: 'description', type: 'TEXT', default: null },
      { name: 'void_by', type: 'TEXT', default: null },
      { name: 'remark', type: 'TEXT', default: null },
      { name: 'operator', type: 'TEXT', default: null },
      // 导入者追踪字段（2025-12-24新增）
      { name: 'imported_by', type: 'INTEGER', default: null },
      { name: 'imported_by_name', type: 'TEXT', default: null },
      { name: 'import_time', type: 'TIMESTAMP', default: null }
    ]
    
    for (const col of billColumns) {
      const defaultClause = col.default ? ` DEFAULT ${col.default}` : ''
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bills_of_lading' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE bills_of_lading ADD COLUMN ${col.name} ${col.type}${defaultClause};
          END IF;
        END $$;
      `)
    }
    console.log('  ✅ bills_of_lading 表字段就绪')

    // ==================== HS匹配记录表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS hs_match_records (
        id SERIAL PRIMARY KEY,
        product_name TEXT NOT NULL,
        product_name_en TEXT,
        hs_code TEXT NOT NULL,
        material TEXT,
        material_en TEXT,
        origin_country TEXT DEFAULT 'CN',
        origin_country_code TEXT DEFAULT 'CN',
        avg_unit_price NUMERIC DEFAULT 0,
        avg_kg_price NUMERIC DEFAULT 0,
        min_unit_price NUMERIC DEFAULT 0,
        max_unit_price NUMERIC DEFAULT 0,
        total_declared_value NUMERIC DEFAULT 0,
        total_declared_qty INTEGER DEFAULT 0,
        total_declared_weight NUMERIC DEFAULT 0,
        duty_rate NUMERIC DEFAULT 0,
        vat_rate NUMERIC DEFAULT 19,
        anti_dumping_rate NUMERIC DEFAULT 0,
        countervailing_rate NUMERIC DEFAULT 0,
        match_count INTEGER DEFAULT 1,
        last_match_time TIMESTAMP,
        first_match_time TIMESTAMP,
        customer_id INTEGER,
        customer_name TEXT,
        remarks TEXT,
        status TEXT DEFAULT 'active',
        is_verified INTEGER DEFAULT 0,
        verified_by TEXT,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS hs_declaration_history (
        id SERIAL PRIMARY KEY,
        match_record_id INTEGER NOT NULL REFERENCES hs_match_records(id) ON DELETE CASCADE,
        import_id INTEGER,
        import_no TEXT,
        cargo_item_id INTEGER,
        declared_qty INTEGER DEFAULT 0,
        declared_weight NUMERIC DEFAULT 0,
        declared_value NUMERIC DEFAULT 0,
        unit_price NUMERIC DEFAULT 0,
        kg_price NUMERIC DEFAULT 0,
        duty_amount NUMERIC DEFAULT 0,
        vat_amount NUMERIC DEFAULT 0,
        other_tax_amount NUMERIC DEFAULT 0,
        total_tax NUMERIC DEFAULT 0,
        declared_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_records_product_name ON hs_match_records(product_name)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_records_hs_code ON hs_match_records(hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_records_material ON hs_match_records(material)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_match_records_status ON hs_match_records(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_declaration_history_record_id ON hs_declaration_history(match_record_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hs_declaration_history_import_id ON hs_declaration_history(import_id)`)
    console.log('  ✅ hs_match_records 表就绪')

    // ==================== 最后里程模块 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS last_mile_carriers (
        id SERIAL PRIMARY KEY,
        carrier_code TEXT UNIQUE NOT NULL,
        carrier_name TEXT NOT NULL,
        carrier_name_en TEXT,
        carrier_type TEXT DEFAULT 'express',
        country_code TEXT DEFAULT 'DE',
        service_region TEXT,
        contact_person TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        website TEXT,
        api_enabled INTEGER DEFAULT 0,
        api_config JSONB,
        status TEXT DEFAULT 'active',
        remark TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_code ON last_mile_carriers(carrier_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_status ON last_mile_carriers(status)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS last_mile_zones (
        id SERIAL PRIMARY KEY,
        carrier_id INTEGER NOT NULL,
        zone_code TEXT NOT NULL,
        zone_name TEXT,
        countries TEXT[],
        postal_prefixes TEXT[],
        cities TEXT[],
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_zones_carrier ON last_mile_zones(carrier_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS unified_rate_cards (
        id SERIAL PRIMARY KEY,
        rate_card_code TEXT UNIQUE NOT NULL,
        rate_card_name TEXT NOT NULL,
        carrier_id INTEGER,
        supplier_id TEXT,
        rate_type TEXT NOT NULL DEFAULT 'last_mile',
        service_type TEXT DEFAULT 'standard',
        valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
        valid_until DATE,
        currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'active',
        is_default INTEGER DEFAULT 0,
        import_log_id INTEGER,
        version INTEGER DEFAULT 1,
        remark TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_carrier ON unified_rate_cards(carrier_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_status ON unified_rate_cards(status)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_card_tiers (
        id SERIAL PRIMARY KEY,
        rate_card_id INTEGER NOT NULL,
        zone_id INTEGER,
        zone_code TEXT,
        weight_from NUMERIC(10,2) NOT NULL DEFAULT 0,
        weight_to NUMERIC(10,2) NOT NULL DEFAULT 0,
        purchase_price NUMERIC(10,2),
        purchase_min_charge NUMERIC(10,2),
        sales_price NUMERIC(10,2),
        sales_min_charge NUMERIC(10,2),
        price_unit TEXT DEFAULT 'per_kg',
        margin_rate NUMERIC(5,2),
        margin_amount NUMERIC(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_card_tiers_card ON rate_card_tiers(rate_card_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_card_surcharges (
        id SERIAL PRIMARY KEY,
        rate_card_id INTEGER NOT NULL,
        surcharge_code TEXT NOT NULL,
        surcharge_name TEXT NOT NULL,
        surcharge_name_en TEXT,
        charge_type TEXT DEFAULT 'fixed',
        purchase_amount NUMERIC(10,2),
        sales_amount NUMERIC(10,2),
        percentage NUMERIC(5,2),
        is_mandatory INTEGER DEFAULT 0,
        conditions JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_card_surcharges_card ON rate_card_surcharges(rate_card_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS last_mile_shipments (
        id SERIAL PRIMARY KEY,
        shipment_no TEXT UNIQUE NOT NULL,
        carrier_id INTEGER,
        carrier_code TEXT,
        carrier_tracking_no TEXT,
        bill_id TEXT,
        bill_number TEXT,
        sender_name TEXT,
        sender_company TEXT,
        sender_phone TEXT,
        sender_address TEXT,
        sender_city TEXT,
        sender_postal_code TEXT,
        sender_country TEXT DEFAULT 'DE',
        receiver_name TEXT,
        receiver_company TEXT,
        receiver_phone TEXT,
        receiver_address TEXT,
        receiver_city TEXT,
        receiver_postal_code TEXT,
        receiver_country TEXT,
        pieces INTEGER DEFAULT 1,
        weight NUMERIC(10,2),
        volume_weight NUMERIC(10,2),
        chargeable_weight NUMERIC(10,2),
        dimensions TEXT,
        goods_description TEXT,
        service_type TEXT DEFAULT 'standard',
        zone_code TEXT,
        rate_card_id INTEGER,
        purchase_cost NUMERIC(10,2),
        sales_amount NUMERIC(10,2),
        profit_amount NUMERIC(10,2),
        currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'pending',
        label_url TEXT,
        label_data TEXT,
        api_request JSONB,
        api_response JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        shipped_at TIMESTAMP,
        delivered_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_no ON last_mile_shipments(shipment_no)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_carrier ON last_mile_shipments(carrier_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_status ON last_mile_shipments(status)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS last_mile_tracking (
        id SERIAL PRIMARY KEY,
        shipment_id INTEGER NOT NULL,
        tracking_no TEXT,
        event_time TIMESTAMP,
        event_code TEXT,
        event_description TEXT,
        event_location TEXT,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_last_mile_tracking_shipment ON last_mile_tracking(shipment_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS carrier_settlements (
        id SERIAL PRIMARY KEY,
        settlement_no TEXT UNIQUE NOT NULL,
        carrier_id INTEGER NOT NULL,
        carrier_name TEXT,
        carrier_code TEXT,
        period_start DATE NOT NULL DEFAULT CURRENT_DATE,
        period_end DATE NOT NULL DEFAULT CURRENT_DATE,
        total_shipments INTEGER DEFAULT 0,
        total_weight NUMERIC(12,2),
        carrier_bill_amount NUMERIC(12,2),
        system_calc_amount NUMERIC(12,2),
        difference_amount NUMERIC(12,2),
        currency TEXT DEFAULT 'EUR',
        reconcile_status TEXT DEFAULT 'pending',
        reconciled_at TIMESTAMP,
        reconciled_by TEXT,
        payment_status TEXT DEFAULT 'unpaid',
        paid_amount NUMERIC(12,2),
        paid_at TIMESTAMP,
        carrier_invoice_url TEXT,
        attachments JSONB,
        remark TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_carrier_settlements_no ON carrier_settlements(settlement_no)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_carrier_settlements_carrier ON carrier_settlements(carrier_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS carrier_settlement_items (
        id SERIAL PRIMARY KEY,
        settlement_id INTEGER NOT NULL,
        shipment_id INTEGER,
        tracking_no TEXT,
        ship_date DATE,
        carrier_weight NUMERIC(10,2),
        carrier_amount NUMERIC(10,2),
        system_weight NUMERIC(10,2),
        system_amount NUMERIC(10,2),
        weight_diff NUMERIC(10,2),
        amount_diff NUMERIC(10,2),
        status TEXT DEFAULT 'pending',
        adjust_amount NUMERIC(10,2),
        adjust_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_carrier_settlement_items_settlement ON carrier_settlement_items(settlement_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_import_templates (
        id SERIAL PRIMARY KEY,
        carrier_id INTEGER,
        template_name TEXT NOT NULL,
        template_code TEXT UNIQUE,
        file_type TEXT DEFAULT 'excel',
        sheet_name TEXT,
        header_row INTEGER DEFAULT 1,
        data_start_row INTEGER DEFAULT 2,
        column_mapping JSONB,
        parse_config JSONB,
        preprocess_rules JSONB,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_import_logs (
        id SERIAL PRIMARY KEY,
        carrier_id INTEGER,
        template_id INTEGER,
        rate_card_id INTEGER,
        file_name TEXT,
        file_url TEXT,
        file_type TEXT,
        status TEXT DEFAULT 'pending',
        total_rows INTEGER,
        success_rows INTEGER,
        failed_rows INTEGER,
        parsed_data JSONB,
        error_details JSONB,
        imported_by TEXT,
        confirmed_by TEXT,
        confirmed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // 初始化常用承运商
    await client.query(`
      INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
      VALUES 
        ('DHL', 'DHL快递', 'DHL Express', 'express', 'DE', 'https://www.dhl.de', 'active'),
        ('DPD', 'DPD快递', 'DPD', 'express', 'DE', 'https://www.dpd.com', 'active'),
        ('UPS', 'UPS快递', 'UPS', 'express', 'US', 'https://www.ups.com', 'active'),
        ('GLS', 'GLS快递', 'GLS', 'express', 'DE', 'https://www.gls-group.eu', 'active'),
        ('SCHENKER', '申克物流', 'DB Schenker', 'trucking', 'DE', 'https://www.dbschenker.com', 'active'),
        ('HERMES', 'Hermes快递', 'Hermes', 'express', 'DE', 'https://www.myhermes.de', 'active')
      ON CONFLICT (carrier_code) DO NOTHING
    `)
    console.log('  ✅ 最后里程模块表就绪')

    // ==================== 业务员提成模块 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_rules (
        id SERIAL PRIMARY KEY,
        rule_name TEXT NOT NULL,
        customer_level TEXT,
        rule_type TEXT NOT NULL,
        commission_base TEXT,
        commission_rate NUMERIC DEFAULT 0,
        fixed_amount NUMERIC DEFAULT 0,
        min_base_amount NUMERIC DEFAULT 0,
        max_commission NUMERIC,
        is_stackable INTEGER DEFAULT 1,
        apply_to TEXT DEFAULT 'all',
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_rules_customer_level ON commission_rules(customer_level)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_rules_is_active ON commission_rules(is_active)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_tiers (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER NOT NULL,
        tier_level INTEGER NOT NULL,
        min_count INTEGER NOT NULL,
        max_count INTEGER,
        bonus_amount NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_tiers_rule_id ON commission_tiers(rule_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_records (
        id TEXT PRIMARY KEY,
        record_no TEXT UNIQUE NOT NULL,
        salesperson_id INTEGER NOT NULL,
        salesperson_name TEXT,
        customer_id TEXT,
        customer_name TEXT,
        customer_level TEXT,
        rule_id INTEGER,
        rule_name TEXT,
        rule_type TEXT,
        commission_base TEXT,
        base_amount NUMERIC DEFAULT 0,
        commission_rate NUMERIC DEFAULT 0,
        fixed_bonus NUMERIC DEFAULT 0,
        tier_bonus NUMERIC DEFAULT 0,
        commission_amount NUMERIC NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        source_no TEXT,
        settlement_month TEXT,
        settlement_id TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_records_salesperson ON commission_records(salesperson_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_records_settlement_month ON commission_records(settlement_month)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_settlements (
        id TEXT PRIMARY KEY,
        settlement_no TEXT UNIQUE NOT NULL,
        settlement_month TEXT NOT NULL,
        salesperson_id INTEGER NOT NULL,
        salesperson_name TEXT,
        record_count INTEGER DEFAULT 0,
        total_base_amount NUMERIC DEFAULT 0,
        total_commission NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'draft',
        submit_time TIMESTAMP,
        reviewer_id INTEGER,
        reviewer_name TEXT,
        review_time TIMESTAMP,
        review_comment TEXT,
        paid_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_settlements_salesperson ON commission_settlements(salesperson_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_settlements_month ON commission_settlements(settlement_month)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_settlements_status ON commission_settlements(status)`)
    console.log('  ✅ 业务员提成模块表就绪')

    // ==================== 安全管理模块 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        attempt_time TIMESTAMP DEFAULT NOW(),
        success BOOLEAN DEFAULT FALSE,
        failure_reason TEXT,
        country TEXT,
        city TEXT,
        device_fingerprint TEXT
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        user_role TEXT,
        action_type TEXT NOT NULL,
        action_name TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        resource_name TEXT,
        old_value TEXT,
        new_value TEXT,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        request_url TEXT,
        request_method TEXT,
        result TEXT DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_logs(user_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON security_audit_logs(action_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_time ON security_audit_logs(created_at)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS ip_blacklist (
        id SERIAL PRIMARY KEY,
        ip_address TEXT NOT NULL UNIQUE,
        reason TEXT,
        blocked_at TIMESTAMP DEFAULT NOW(),
        blocked_by TEXT,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blacklist_ip ON ip_blacklist(ip_address)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blacklist_active ON ip_blacklist(is_active)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_rate_limits (
        id SERIAL PRIMARY KEY,
        identifier TEXT NOT NULL,
        identifier_type TEXT NOT NULL,
        endpoint TEXT,
        request_count INTEGER DEFAULT 1,
        window_start TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON api_rate_limits(identifier, identifier_type)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        device_info TEXT,
        login_time TIMESTAMP DEFAULT NOW(),
        last_activity TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_active ON active_sessions(is_active)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_records (
        id SERIAL PRIMARY KEY,
        backup_name TEXT NOT NULL,
        backup_type TEXT DEFAULT 'full',
        backup_size BIGINT,
        backup_path TEXT,
        backup_status TEXT DEFAULT 'completed',
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        created_by TEXT DEFAULT 'system',
        created_at TIMESTAMP DEFAULT NOW(),
        cos_key TEXT,
        cos_url TEXT,
        is_cloud_synced INTEGER DEFAULT 0,
        file_name TEXT,
        description TEXT,
        restored_at TIMESTAMP,
        restore_count INTEGER DEFAULT 0
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_records(backup_status)`)
    
    // 为现有表添加 COS 相关字段（兼容已有数据库）
    const backupCosColumns = [
      { name: 'cos_key', type: 'TEXT' },
      { name: 'cos_url', type: 'TEXT' },
      { name: 'is_cloud_synced', type: 'INTEGER DEFAULT 0' },
      { name: 'file_name', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'restored_at', type: 'TIMESTAMP' },
      { name: 'restore_count', type: 'INTEGER DEFAULT 0' }
    ]
    for (const col of backupCosColumns) {
      try {
        await client.query(`ALTER TABLE backup_records ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`)
      } catch (e) {
        // 忽略已存在的列
      }
    }
    
    // 在添加字段后再创建索引
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_backup_cloud_synced ON backup_records(is_cloud_synced)`)
    } catch (e) {
      // 忽略索引创建失败
    }
    
    // 创建恢复记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS restore_records (
        id SERIAL PRIMARY KEY,
        backup_id INTEGER NOT NULL,
        backup_name TEXT,
        restore_type TEXT DEFAULT 'full',
        restore_status TEXT DEFAULT 'running',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        error_message TEXT,
        tables_restored TEXT,
        rows_affected INTEGER DEFAULT 0,
        restored_by TEXT,
        restored_by_name TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_restore_backup_id ON restore_records(backup_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_restore_status ON restore_records(restore_status)`)
    console.log('  ✅ 安全管理模块表就绪')

    // ==================== 罚款规则模块 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS penalty_rules (
        id SERIAL PRIMARY KEY,
        rule_code TEXT UNIQUE NOT NULL,
        rule_name TEXT NOT NULL,
        penalty_type TEXT NOT NULL,
        rule_category TEXT DEFAULT 'other',
        description TEXT,
        trigger_condition JSONB,
        calculation_method TEXT DEFAULT 'fixed',
        fixed_amount NUMERIC DEFAULT 0,
        percentage_rate NUMERIC DEFAULT 0,
        max_amount NUMERIC,
        min_amount NUMERIC DEFAULT 0,
        is_stackable INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_penalty_rules_code ON penalty_rules(rule_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_penalty_rules_type ON penalty_rules(penalty_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_penalty_rules_active ON penalty_rules(is_active)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS penalty_records (
        id TEXT PRIMARY KEY,
        record_no TEXT UNIQUE NOT NULL,
        rule_id INTEGER,
        rule_code TEXT,
        rule_name TEXT,
        customer_id TEXT,
        customer_name TEXT,
        salesperson_id INTEGER,
        salesperson_name TEXT,
        source_type TEXT NOT NULL,
        source_id TEXT,
        source_no TEXT,
        trigger_reason TEXT,
        penalty_amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'EUR',
        settlement_month TEXT,
        settlement_id TEXT,
        status TEXT DEFAULT 'pending',
        appeal_status TEXT,
        appeal_reason TEXT,
        appeal_time TIMESTAMP,
        appeal_result TEXT,
        appeal_reviewed_by TEXT,
        appeal_reviewed_at TIMESTAMP,
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_penalty_records_customer ON penalty_records(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_penalty_records_salesperson ON penalty_records(salesperson_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_penalty_records_status ON penalty_records(status)`)
    console.log('  ✅ 罚款规则模块表就绪')

    // ==================== 审批系统模块 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        request_no TEXT UNIQUE NOT NULL,
        request_type TEXT NOT NULL,
        business_type TEXT,
        business_id TEXT,
        business_no TEXT,
        title TEXT NOT NULL,
        content TEXT,
        amount NUMERIC,
        currency TEXT DEFAULT 'EUR',
        applicant_id INTEGER,
        applicant_name TEXT,
        department TEXT,
        current_step INTEGER DEFAULT 1,
        total_steps INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'normal',
        due_date TIMESTAMP,
        attachments JSONB,
        form_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_requests_applicant ON approval_requests(applicant_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_workflows (
        id SERIAL PRIMARY KEY,
        workflow_code TEXT UNIQUE NOT NULL,
        workflow_name TEXT NOT NULL,
        request_type TEXT NOT NULL,
        description TEXT,
        steps JSONB NOT NULL DEFAULT '[]',
        conditions JSONB,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(request_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_records (
        id SERIAL PRIMARY KEY,
        request_id TEXT NOT NULL,
        step_number INTEGER NOT NULL,
        step_name TEXT,
        approver_id INTEGER NOT NULL,
        approver_name TEXT,
        action TEXT NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_records_request ON approval_records(request_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_approval_records_approver ON approval_records(approver_id)`)
    console.log('  ✅ 审批系统模块表就绪')

    // ==================== 合同模板模块 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_templates (
        id SERIAL PRIMARY KEY,
        template_code TEXT UNIQUE NOT NULL,
        template_name TEXT NOT NULL,
        template_type TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        variables JSONB,
        status TEXT DEFAULT 'active',
        version INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        description TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(template_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contract_templates_status ON contract_templates(status)`)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS contract_signatures (
        id SERIAL PRIMARY KEY,
        contract_id TEXT NOT NULL,
        signer_type TEXT NOT NULL,
        signer_id TEXT,
        signer_name TEXT NOT NULL,
        signer_title TEXT,
        signer_email TEXT,
        signature_data TEXT,
        signed_at TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        verification_code TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contract_signatures_status ON contract_signatures(status)`)
    console.log('  ✅ 合同模板模块表就绪')

    // ==================== Users 表字段补充 ====================
    const userColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('supervisor_id', 'department', 'position')
    `)
    const existingUserCols = userColumns.rows.map(r => r.column_name)
    
    if (!existingUserCols.includes('supervisor_id')) {
      await client.query(`ALTER TABLE users ADD COLUMN supervisor_id INTEGER`)
      console.log('  ✅ users.supervisor_id 字段已添加')
    }
    if (!existingUserCols.includes('department')) {
      await client.query(`ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT ''`)
      console.log('  ✅ users.department 字段已添加')
    }
    if (!existingUserCols.includes('position')) {
      await client.query(`ALTER TABLE users ADD COLUMN position VARCHAR(100) DEFAULT ''`)
      console.log('  ✅ users.position 字段已添加')
    }
    
    // 为 supervisor_id 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id)`)
    console.log('  ✅ users 表字段就绪')

    // ==================== Roles 表字段补充 ====================
    const roleColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'roles' AND column_name IN ('role_level', 'can_manage_team', 'can_approve')
    `)
    const existingRoleCols = roleColumns.rows.map(r => r.column_name)
    
    if (!existingRoleCols.includes('role_level')) {
      await client.query(`ALTER TABLE roles ADD COLUMN role_level INTEGER DEFAULT 99`)
      console.log('  ✅ roles.role_level 字段已添加')
    }
    if (!existingRoleCols.includes('can_manage_team')) {
      await client.query(`ALTER TABLE roles ADD COLUMN can_manage_team INTEGER DEFAULT 0`)
      console.log('  ✅ roles.can_manage_team 字段已添加')
    }
    if (!existingRoleCols.includes('can_approve')) {
      await client.query(`ALTER TABLE roles ADD COLUMN can_approve INTEGER DEFAULT 0`)
      console.log('  ✅ roles.can_approve 字段已添加')
    }
    
    // 更新各角色的权限设置
    await client.query(`UPDATE roles SET role_level = 1, can_manage_team = 1, can_approve = 1 WHERE role_code = 'admin'`)
    await client.query(`UPDATE roles SET role_level = 2, can_manage_team = 1, can_approve = 1 WHERE role_code = 'boss'`)
    await client.query(`UPDATE roles SET role_level = 3, can_manage_team = 1, can_approve = 1 WHERE role_code = 'manager'`)
    await client.query(`UPDATE roles SET role_level = 3, can_manage_team = 1, can_approve = 1 WHERE role_code = 'finance_director'`)
    // 操作经理和财务经理也可以作为直属上级
    await client.query(`UPDATE roles SET role_level = 3, can_manage_team = 1, can_approve = 1 WHERE role_code = 'czjl'`)
    await client.query(`UPDATE roles SET role_level = 3, can_manage_team = 1, can_approve = 1 WHERE role_code = 'finance_manager'`)
    await client.query(`UPDATE roles SET role_level = 4, can_manage_team = 0, can_approve = 0 WHERE role_code IN ('doc_clerk', 'doc_officer', 'finance_assistant', 'operator')`)
    await client.query(`UPDATE roles SET role_level = 5, can_manage_team = 0, can_approve = 0 WHERE role_code = 'viewer'`)
    console.log('  ✅ roles 表字段就绪')

    // ==================== 客户门户系统表 ====================
    // 1. 客户账户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(50),
        avatar_url TEXT,
        status VARCHAR(20) DEFAULT 'active',
        login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP,
        last_login_at TIMESTAMP,
        last_login_ip VARCHAR(50),
        password_changed_at TIMESTAMP,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer ON customer_accounts(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customer_accounts_username ON customer_accounts(username)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_customer_accounts_status ON customer_accounts(status)`)
    console.log('  ✅ customer_accounts 表就绪')

    // 2. API 密钥表
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_api_keys (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
        key_name VARCHAR(100) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        api_secret_hash VARCHAR(255) NOT NULL,
        permissions JSONB DEFAULT '["order:read"]',
        ip_whitelist TEXT[],
        rate_limit INT DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        last_used_ip VARCHAR(50),
        usage_count BIGINT DEFAULT 0,
        expires_at TIMESTAMP,
        webhook_url TEXT,
        webhook_secret VARCHAR(64),
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON customer_api_keys(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON customer_api_keys(api_key)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_active ON customer_api_keys(is_active)`)
    console.log('  ✅ customer_api_keys 表就绪')

    // 3. API 调用日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_call_logs (
        id BIGSERIAL PRIMARY KEY,
        api_key_id INT REFERENCES customer_api_keys(id) ON DELETE SET NULL,
        customer_id VARCHAR(50),
        api_key VARCHAR(64),
        endpoint VARCHAR(200) NOT NULL,
        method VARCHAR(10) NOT NULL,
        request_ip VARCHAR(50),
        request_headers JSONB,
        request_body JSONB,
        response_status INT,
        response_body JSONB,
        error_message TEXT,
        duration_ms INT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_logs_key_id ON api_call_logs(api_key_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_logs_customer ON api_call_logs(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_call_logs(created_at DESC)`)
    console.log('  ✅ api_call_logs 表就绪')

    // 4. Webhook 发送记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id BIGSERIAL PRIMARY KEY,
        api_key_id INT REFERENCES customer_api_keys(id) ON DELETE SET NULL,
        customer_id VARCHAR(50),
        webhook_url TEXT NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        response_status INT,
        response_body TEXT,
        retry_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_customer ON webhook_logs(customer_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status)`)
    console.log('  ✅ webhook_logs 表就绪')

    // 5. 为 bills_of_lading 添加外部订单号和来源渠道字段
    const billExtraColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'bills_of_lading' AND column_name IN ('external_order_no', 'source_channel')
    `)
    const existingBillExtraCols = billExtraColumns.rows.map(r => r.column_name)
    
    if (!existingBillExtraCols.includes('external_order_no')) {
      await client.query(`ALTER TABLE bills_of_lading ADD COLUMN external_order_no VARCHAR(100)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_bills_external_order ON bills_of_lading(external_order_no)`)
      console.log('  ✅ bills_of_lading.external_order_no 字段已添加')
    }
    if (!existingBillExtraCols.includes('source_channel')) {
      await client.query(`ALTER TABLE bills_of_lading ADD COLUMN source_channel VARCHAR(50) DEFAULT 'manual'`)
      console.log('  ✅ bills_of_lading.source_channel 字段已添加')
    }
    console.log('  ✅ 客户门户系统表就绪')

    // ==================== 重置 SERIAL 序列 ====================
    // 修复 customer_tax_numbers 表的序列值（避免主键冲突）
    try {
      const seqResult = await client.query(`
        SELECT setval('customer_tax_numbers_id_seq', 
          COALESCE((SELECT MAX(id) FROM customer_tax_numbers), 0) + 1, 
          false
        )
      `)
      console.log('  ✅ customer_tax_numbers 序列已重置')
    } catch (seqErr) {
      // 序列可能不存在（表还未创建），忽略错误
      console.log('  ⏭️ customer_tax_numbers 序列重置跳过:', seqErr.message)
    }

    // ==================== 为 service_fee_categories 添加 name_en 字段 ====================
    const feeCategoryColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_fee_categories' AND column_name = 'name_en'
    `)
    if (feeCategoryColumns.rows.length === 0) {
      await client.query(`ALTER TABLE service_fee_categories ADD COLUMN name_en TEXT`)
      console.log('  ✅ service_fee_categories.name_en 字段已添加')
    }

    // ==================== 重置 service_fee_categories 序列 ====================
    try {
      await client.query(`
        SELECT setval('service_fee_categories_id_seq', 
          COALESCE((SELECT MAX(id) FROM service_fee_categories), 0) + 1, 
          false
        )
      `)
      console.log('  ✅ service_fee_categories 序列已重置')
    } catch (seqErr) {
      console.log('  ⏭️ service_fee_categories 序列重置跳过:', seqErr.message)
    }

    // ==================== 同步缺失的产品数据 ====================
    // 检查并插入缺失的产品: 欧洲运输
    const prod1 = await client.query(`SELECT id FROM products WHERE id = $1`, ['70f1aa1f-3ec8-45cb-b652-e176998b6796'])
    if (prod1.rows.length === 0) {
      await client.query(`
        INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_at, updated_at)
        VALUES ('70f1aa1f-3ec8-45cb-b652-e176998b6796', 'PRD0003', '欧洲运输', 'EU Transport', 'trucking', '', 1, 0, NOW(), NOW())
      `)
      console.log('  ✅ 产品"欧洲运输"已同步')
    }
    
    // 为欧洲运输插入费用项 (单独检查，确保费用项存在)
    const prod1FeeCount = await client.query(`SELECT COUNT(*) as count FROM product_fee_items WHERE product_id = $1`, ['70f1aa1f-3ec8-45cb-b652-e176998b6796'])
    if (parseInt(prod1FeeCount.rows[0].count) === 0) {
      // 先重置序列到正确值，避免 ID 冲突
      await client.query(`SELECT setval('product_fee_items_id_seq', COALESCE((SELECT MAX(id) FROM product_fee_items), 0) + 1, false)`)
      await client.query(`
        INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, currency, is_required, description, billing_type, cost_price, profit_type, profit_value, supplier_id, supplier_name, supplier_price_id, created_at, updated_at) VALUES
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 56, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 57, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 58, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 950, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 59, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1047, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 60, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1047, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 61, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1047, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 62, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1065, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 63, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1065, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 64, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1065, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 65, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1040, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 66, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 67, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 68, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 69, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 70, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 71, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1350, 'EUR', 0, '', 'fixed', 1130, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 72, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1350, 'EUR', 0, '', 'fixed', 1137, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 73, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1090, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 74, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1450, 'EUR', 0, '', 'fixed', 1205, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 75, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1450, 'EUR', 0, '', 'fixed', 1205, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 76, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1450, 'EUR', 0, '', 'fixed', 1225, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 77, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1405, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 78, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1405, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 79, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1405, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 80, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1440, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 81, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1700, 'EUR', 0, '', 'fixed', 1467, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 82, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1700, 'EUR', 0, '', 'fixed', 1467, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 83, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1700, 'EUR', 0, '', 'fixed', 1500, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 84, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1900, 'EUR', 0, '', 'fixed', 1665, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 85, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 3300, 'EUR', 0, '', 'fixed', 3100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 86, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1705, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 87, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1705, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 88, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1705, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 89, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1740, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 90, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 91, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 92, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 93, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 94, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2250, 'EUR', 0, '', 'fixed', 2005, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 95, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2250, 'EUR', 0, '', 'fixed', 2025, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 96, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2205, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 97, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2750, 'EUR', 0, '', 'fixed', 2525, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 98, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 3750, 'EUR', 0, '', 'fixed', 3550, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 99, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2800, 'EUR', 0, '', 'fixed', 2580, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 100, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2230, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 101, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2250, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 102, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2250, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 103, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1080, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 104, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 950, 'EUR', 0, '', 'fixed', 737, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 105, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1550, 'EUR', 0, '', 'fixed', 1350, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 106, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', 'TRANSPORT', '票', 1900, 'EUR', 0, '', 'fixed', 1855, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 107, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 3750, 'EUR', 0, '', 'fixed', 3550, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 108, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', 'THC费', 'THC fee', '换单费', '柜', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '', 129, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提单管理费', 'B/L Management Fee', '文件费', '次', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '', 130, NOW(), NOW()),
        ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '卡车等待费', 'Truck Waiting Fee', '运输服务', '半小时', 50, 'EUR', 0, '', 'fixed', 35, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '', 131, NOW(), NOW())
      `)
      console.log('  ✅ 产品"欧洲运输"费用项已同步 (57个)')
    }
    
    // 检查并插入缺失的产品: 欧洲自税清关服务
    const prod2 = await client.query(`SELECT id FROM products WHERE id = $1`, ['ed0d483d-7693-480d-be6c-ed668e2fa620'])
    if (prod2.rows.length === 0) {
      await client.query(`
        INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_at, updated_at)
        VALUES ('ed0d483d-7693-480d-be6c-ed668e2fa620', 'PRD0004', '欧洲自税清关服务', 'European self-tax customs clearance services', '清关服务', '', 1, 0, NOW(), NOW())
      `)
      console.log('  ✅ 产品"欧洲自税清关服务"已同步')
    }
    
    // 为欧洲自税清关服务插入费用项 (单独检查)
    const prod2FeeCount = await client.query(`SELECT COUNT(*) as count FROM product_fee_items WHERE product_id = $1`, ['ed0d483d-7693-480d-be6c-ed668e2fa620'])
    if (parseInt(prod2FeeCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, currency, is_required, description, billing_type, cost_price, profit_type, profit_value, created_at, updated_at)
        VALUES 
          ('ed0d483d-7693-480d-be6c-ed668e2fa620', '税号管理费', 'Tax ID management fee', 'IMPORTER''S AGENCY FEE', '票', 200, 'EUR', 1, '', 'fixed', 0, 'amount', 0, NOW(), NOW()),
          ('ed0d483d-7693-480d-be6c-ed668e2fa620', 'HS Code 品名费', 'HS Code product name fee', '文件费', '个', 8, 'EUR', 0, '', 'fixed', 6, 'amount', 2, NOW(), NOW()),
          ('ed0d483d-7693-480d-be6c-ed668e2fa620', '本土税号清关费', 'Local tax number customs clearance fee', '清关服务', '票', 150, 'EUR', 0, '含10个HS', 'fixed', 100, 'amount', 50, NOW(), NOW()),
          ('ed0d483d-7693-480d-be6c-ed668e2fa620', '离岸税号清关费', 'Offshore tax number customs clearance fee', '清关服务', '票', 175, 'EUR', 0, '含10个HS', 'fixed', 150, 'amount', 25, NOW(), NOW()),
          ('ed0d483d-7693-480d-be6c-ed668e2fa620', '进口关税', 'import duties', '税务费', '次', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, NOW(), NOW())
      `)
      console.log('  ✅ 产品"欧洲自税清关服务"费用项已同步')
    }

    // 修复空的 supplier_name - 根据 supplier_id 从 suppliers 表获取名称
    const fixedSupplierNames = await client.query(`
      UPDATE product_fee_items pfi
      SET supplier_name = s.supplier_name
      FROM suppliers s
      WHERE pfi.supplier_id = s.id
        AND (pfi.supplier_name IS NULL OR pfi.supplier_name = '')
        AND pfi.supplier_id IS NOT NULL
    `)
    if (fixedSupplierNames.rowCount > 0) {
      console.log('  ✅ 已修复 ' + fixedSupplierNames.rowCount + ' 个费用项的供应商名称')
    }

    // ==================== 发票表添加 language 字段 ====================
    const invoiceLanguageCol = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'invoices' AND column_name = 'language'
    `)
    if (invoiceLanguageCol.rows.length === 0) {
      await client.query(`ALTER TABLE invoices ADD COLUMN language TEXT DEFAULT 'en'`)
      console.log('  ✅ invoices.language 字段已添加')
    }

    // ==================== 风险管理系统表 ====================
    // 1. 申报价值记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS declaration_value_records (
        id SERIAL PRIMARY KEY,
        hs_code VARCHAR(10) NOT NULL,
        product_name TEXT,
        product_name_en TEXT,
        origin_country VARCHAR(50),
        origin_country_code VARCHAR(10),
        declared_unit_price NUMERIC(12,4),
        price_unit VARCHAR(20) DEFAULT 'PCS',
        declared_quantity NUMERIC(12,2),
        declared_total_value NUMERIC(14,2),
        currency VARCHAR(10) DEFAULT 'EUR',
        declaration_result VARCHAR(20) DEFAULT 'pending',
        customs_adjusted_price NUMERIC(12,4),
        adjustment_reason TEXT,
        declaration_date DATE,
        customs_office VARCHAR(50),
        bill_no VARCHAR(50),
        import_id INTEGER,
        item_id INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dvr_hs_code ON declaration_value_records(hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dvr_origin_country ON declaration_value_records(origin_country)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dvr_result ON declaration_value_records(declaration_result)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dvr_import_id ON declaration_value_records(import_id)`)
    console.log('  ✅ declaration_value_records 表就绪')

    // 2. 查验记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_records (
        id SERIAL PRIMARY KEY,
        hs_code VARCHAR(10),
        product_name TEXT,
        product_name_en TEXT,
        origin_country VARCHAR(50),
        origin_country_code VARCHAR(10),
        container_no VARCHAR(30),
        bill_no VARCHAR(50),
        inspection_type VARCHAR(50),
        inspection_result VARCHAR(20),
        inspection_date DATE,
        inspection_notes TEXT,
        customs_office VARCHAR(50),
        inspector_name VARCHAR(100),
        penalty_amount NUMERIC(12,2),
        delay_days INTEGER DEFAULT 0,
        import_id INTEGER,
        item_id INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ir_hs_code ON inspection_records(hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ir_origin_country ON inspection_records(origin_country)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ir_inspection_type ON inspection_records(inspection_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ir_import_id ON inspection_records(import_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ir_container ON inspection_records(container_no)`)
    console.log('  ✅ inspection_records 表就绪')

    // 3. 添加 cargo_imports 风险评估字段
    const riskFields = ['risk_score', 'risk_level', 'risk_analyzed_at', 'risk_notes']
    for (const field of riskFields) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cargo_imports' AND column_name = $1
      `, [field])
      if (colCheck.rows.length === 0) {
        if (field === 'risk_score') {
          await client.query(`ALTER TABLE cargo_imports ADD COLUMN risk_score NUMERIC(5,2) DEFAULT 0`)
        } else if (field === 'risk_level') {
          await client.query(`ALTER TABLE cargo_imports ADD COLUMN risk_level VARCHAR(20) DEFAULT 'low'`)
        } else if (field === 'risk_analyzed_at') {
          await client.query(`ALTER TABLE cargo_imports ADD COLUMN risk_analyzed_at TIMESTAMP`)
        } else if (field === 'risk_notes') {
          await client.query(`ALTER TABLE cargo_imports ADD COLUMN risk_notes TEXT`)
        }
        console.log(`    + cargo_imports.${field} 字段已添加`)
      }
    }

    // 4. 添加 cargo_items 风险字段
    const itemRiskFields = ['declaration_risk', 'inspection_risk', 'min_safe_price', 'price_warning']
    for (const field of itemRiskFields) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'cargo_items' AND column_name = $1
      `, [field])
      if (colCheck.rows.length === 0) {
        if (field === 'declaration_risk') {
          await client.query(`ALTER TABLE cargo_items ADD COLUMN declaration_risk VARCHAR(20) DEFAULT 'low'`)
        } else if (field === 'inspection_risk') {
          await client.query(`ALTER TABLE cargo_items ADD COLUMN inspection_risk VARCHAR(20) DEFAULT 'low'`)
        } else if (field === 'min_safe_price') {
          await client.query(`ALTER TABLE cargo_items ADD COLUMN min_safe_price NUMERIC(12,4)`)
        } else if (field === 'price_warning') {
          await client.query(`ALTER TABLE cargo_items ADD COLUMN price_warning TEXT`)
        }
        console.log(`    + cargo_items.${field} 字段已添加`)
      }
    }
    console.log('  ✅ 风险管理系统表就绪')

    // ==================== 询价工作流模块 ====================
    // 扩展 customer_inquiries 表（如果表存在）
    const inquiryTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'customer_inquiries'
      )
    `)
    
    if (inquiryTableCheck.rows[0]?.exists) {
      const inquiryFields = [
        { name: 'assigned_to', type: 'INTEGER REFERENCES users(id)' },
        { name: 'assigned_to_name', type: 'TEXT' },
        { name: 'assigned_at', type: 'TIMESTAMP' },
        { name: 'due_at', type: 'TIMESTAMP' },
        { name: 'processed_at', type: 'TIMESTAMP' },
        { name: 'is_overdue', type: 'BOOLEAN DEFAULT FALSE' },
        { name: 'crm_quote_id', type: 'TEXT' },
        { name: 'transport_price_id', type: 'INTEGER' },
        { name: 'priority', type: 'TEXT DEFAULT \'normal\'' },
        { name: 'source', type: 'TEXT DEFAULT \'portal\'' }
      ]
      
      for (const field of inquiryFields) {
        const colCheck = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'customer_inquiries' AND column_name = $1
        `, [field.name])
        if (colCheck.rows.length === 0) {
          await client.query(`ALTER TABLE customer_inquiries ADD COLUMN ${field.name} ${field.type}`)
          console.log(`    + customer_inquiries.${field.name} 字段已添加`)
        }
      }
      
      await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_to ON customer_inquiries(assigned_to)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiries_due_at ON customer_inquiries(due_at)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiries_is_overdue ON customer_inquiries(is_overdue)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON customer_inquiries(priority)`)
    }
    
    // 创建询价待办任务表
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiry_tasks (
        id SERIAL PRIMARY KEY,
        inquiry_id TEXT NOT NULL,
        inquiry_number TEXT NOT NULL,
        assignee_id INTEGER NOT NULL,
        assignee_name TEXT,
        assignee_role TEXT,
        supervisor_id INTEGER,
        supervisor_name TEXT,
        super_supervisor_id INTEGER,
        super_supervisor_name TEXT,
        task_type TEXT NOT NULL DEFAULT 'process',
        status TEXT DEFAULT 'pending',
        due_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        reminder_sent BOOLEAN DEFAULT FALSE,
        overdue_notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_inquiry_id ON inquiry_tasks(inquiry_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_assignee ON inquiry_tasks(assignee_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_supervisor ON inquiry_tasks(supervisor_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_status ON inquiry_tasks(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_due_at ON inquiry_tasks(due_at)`)
    
    // 创建卡车类型配置表（运输报价计算依赖）
    await client.query(`
      CREATE TABLE IF NOT EXISTS truck_types (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        name_en TEXT,
        category TEXT NOT NULL,
        description TEXT,
        max_weight NUMERIC NOT NULL,
        max_volume NUMERIC,
        length NUMERIC NOT NULL,
        width NUMERIC NOT NULL,
        height NUMERIC NOT NULL,
        axle_count INTEGER DEFAULT 2,
        emission_class TEXT DEFAULT 'EURO6',
        base_rate_per_km NUMERIC NOT NULL,
        min_charge NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_types_category ON truck_types(category)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_truck_types_active ON truck_types(is_active)`)
    
    // 插入默认卡车类型数据
    const truckTypesExist = await client.query(`SELECT COUNT(*) as count FROM truck_types`)
    if (parseInt(truckTypesExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, axle_count, emission_class, base_rate_per_km, min_charge, sort_order)
        VALUES 
          ('VAN_35', '小型厢式车', 'Small Van (3.5t)', 'van', '适合小批量城市配送', 1500, 12, 3.5, 1.8, 1.8, 2, 'EURO6', 1.20, 80, 1),
          ('VAN_75', '中型厢式车', 'Medium Van (7.5t)', 'van', '适合中等货量配送', 3500, 25, 5.5, 2.2, 2.2, 2, 'EURO6', 1.50, 120, 2),
          ('BOX_12', '大型箱式车', 'Box Truck (12t)', 'box', '适合大批量配送', 6000, 45, 7.5, 2.4, 2.5, 2, 'EURO6', 1.80, 180, 3),
          ('BOX_18', '重型箱式车', 'Heavy Box Truck (18t)', 'box', '适合重货运输', 10000, 55, 9.0, 2.45, 2.6, 3, 'EURO6', 2.00, 220, 4),
          ('SEMI_40', '标准半挂车', 'Standard Semi-trailer (40t)', 'semi', '欧洲标准长途运输', 24000, 80, 13.6, 2.45, 2.7, 5, 'EURO6', 2.20, 350, 5),
          ('SEMI_MEGA', '超大容量挂车', 'Mega Trailer', 'semi', '超大容积，适合轻泡货', 24000, 100, 13.6, 2.45, 3.0, 5, 'EURO6', 2.40, 400, 6),
          ('REEFER_75', '小型冷藏车', 'Small Reefer (7.5t)', 'reefer', '适合小批量冷链配送', 3000, 20, 5.5, 2.2, 2.2, 2, 'EURO6', 2.00, 150, 7),
          ('REEFER_40', '大型冷藏车', 'Large Reefer (40t)', 'reefer', '长途冷链运输', 22000, 70, 13.6, 2.45, 2.6, 5, 'EURO6', 3.00, 500, 8),
          ('FLATBED_40', '标准平板车', 'Flatbed Trailer', 'flatbed', '适合机械设备、钢材等', 26000, NULL, 13.6, 2.45, 0, 5, 'EURO6', 2.00, 350, 9),
          ('FLATBED_LOW', '低平板车', 'Low-loader Trailer', 'flatbed', '适合超高设备运输', 30000, NULL, 13.6, 2.55, 0, 6, 'EURO6', 2.50, 450, 10),
          ('HAZMAT_40', '危险品运输车', 'Hazmat Truck (40t)', 'hazmat', 'ADR认证，适合化学品等', 22000, 75, 13.6, 2.45, 2.7, 5, 'EURO6', 3.50, 600, 11),
          ('HAZMAT_TANK', '危险品罐车', 'Hazmat Tank Truck', 'hazmat', '液体危险品运输', 25000, 30000, 13.6, 2.5, 3.0, 5, 'EURO6', 4.00, 700, 12)
      `)
      console.log('    + 默认卡车类型数据已初始化')
    }
    
    // 初始化询价序列（确保 order_sequences 表中有 inquiry 类型）
    await client.query(`
      INSERT INTO order_sequences (business_type, current_seq, prefix, description)
      VALUES ('inquiry', 0, 'INQ', '客户询价编号')
      ON CONFLICT (business_type) DO NOTHING
    `)
    
    console.log('  ✅ 询价工作流模块表就绪')

    // ==================== 税费计算精准改进 - 贸易条件字段 ====================
    // cargo_imports 批次表添加贸易条件字段
    const tradeTermsFields = [
      { name: 'incoterm', type: 'TEXT', default: "'FOB'", comment: '贸易条件：EXW/FCA/FAS/FOB/CFR/CIF/CPT/CIP/DAP/DPU/DDP/DDU' },
      { name: 'international_freight', type: 'NUMERIC', default: '0', comment: '国际运费（EUR）' },
      { name: 'domestic_freight_export', type: 'NUMERIC', default: '0', comment: '出口国内陆运费（EUR），EXW条款使用' },
      { name: 'domestic_freight_import', type: 'NUMERIC', default: '0', comment: '进口国内陆运费（EUR），D组条款使用' },
      { name: 'unloading_cost', type: 'NUMERIC', default: '0', comment: '卸货费（EUR），DPU条款专用' },
      { name: 'insurance_cost', type: 'NUMERIC', default: '0', comment: '保险费（EUR）' },
      { name: 'prepaid_duties', type: 'NUMERIC', default: '0', comment: '预付关税（EUR），DDP条款使用' },
      { name: 'freight_allocation_method', type: 'TEXT', default: "'by_value'", comment: '运费分摊方式：by_value按货值/by_weight按重量' },
      { name: 'total_customs_value', type: 'NUMERIC', default: '0', comment: '总完税价格（EUR）' }
    ]
    
    for (const field of tradeTermsFields) {
      try {
        await client.query(`ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS ${field.name} ${field.type} DEFAULT ${field.default}`)
      } catch (e) { /* 字段可能已存在 */ }
    }
    
    // cargo_items 明细表添加完税价格相关字段
    const itemCustomsFields = [
      { name: 'origin_country_code', type: 'TEXT', default: "'CN'", comment: '原产国代码（ISO 2位）' },
      { name: 'customs_value', type: 'NUMERIC', default: '0', comment: '完税价格（EUR）' },
      { name: 'freight_allocation', type: 'NUMERIC', default: '0', comment: '分摊的运费（EUR）' },
      { name: 'insurance_allocation', type: 'NUMERIC', default: '0', comment: '分摊的保险费（EUR）' }
    ]
    
    for (const field of itemCustomsFields) {
      try {
        await client.query(`ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS ${field.name} ${field.type} DEFAULT ${field.default}`)
      } catch (e) { /* 字段可能已存在 */ }
    }
    
    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_imports_incoterm ON cargo_imports(incoterm)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_origin_code ON cargo_items(origin_country_code)`)
    
    // 初始化现有数据
    try {
      // 将现有记录的 origin_country_code 从 origin_country 字段提取
      await client.query(`
        UPDATE cargo_items 
        SET origin_country_code = COALESCE(
          CASE 
            WHEN origin_country = '中国' OR origin_country = 'China' THEN 'CN'
            WHEN origin_country = '越南' OR origin_country = 'Vietnam' THEN 'VN'
            WHEN origin_country = '印度' OR origin_country = 'India' THEN 'IN'
            WHEN origin_country = '韩国' OR origin_country = 'South Korea' THEN 'KR'
            WHEN origin_country = '日本' OR origin_country = 'Japan' THEN 'JP'
            WHEN origin_country = '泰国' OR origin_country = 'Thailand' THEN 'TH'
            WHEN origin_country = '马来西亚' OR origin_country = 'Malaysia' THEN 'MY'
            WHEN origin_country = '印度尼西亚' OR origin_country = 'Indonesia' THEN 'ID'
            WHEN origin_country = '台湾' OR origin_country = 'Taiwan' THEN 'TW'
            ELSE 'CN'
          END,
          'CN'
        )
        WHERE origin_country_code IS NULL OR origin_country_code = ''
      `)
      
      // 初始化 customs_value 为 total_value
      await client.query(`
        UPDATE cargo_items 
        SET customs_value = COALESCE(total_value, 0)
        WHERE customs_value IS NULL OR customs_value = 0
      `)
      
      // 初始化批次的 total_customs_value
      await client.query(`
        UPDATE cargo_imports ci
        SET total_customs_value = COALESCE(
          (SELECT SUM(COALESCE(customs_value, total_value, 0)) FROM cargo_items WHERE import_id = ci.id),
          0
        )
        WHERE total_customs_value IS NULL OR total_customs_value = 0
      `)
    } catch (e) { /* 初始化数据失败不影响迁移 */ }
    
    console.log('  ✅ 税费计算贸易条件字段就绪')

    // ==================== 创建工商信息表 ====================
    await client.query(`
      CREATE TABLE IF NOT EXISTS business_info (
        id VARCHAR(32) PRIMARY KEY,
        credit_code VARCHAR(50) UNIQUE,
        company_name TEXT NOT NULL,
        company_name_en TEXT,
        legal_person TEXT,
        registered_capital TEXT,
        paid_capital TEXT,
        establishment_date DATE,
        business_scope TEXT,
        address TEXT,
        province VARCHAR(50),
        city VARCHAR(50),
        district VARCHAR(50),
        company_type TEXT,
        operating_status TEXT,
        industry TEXT,
        registration_authority TEXT,
        approval_date DATE,
        business_term_start DATE,
        business_term_end DATE,
        former_names TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        source VARCHAR(20) DEFAULT 'qichacha',
        source_id VARCHAR(100),
        raw_data JSONB,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_business_info_credit_code ON business_info(credit_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_business_info_company_name ON business_info(company_name)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_business_info_source ON business_info(source)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_business_info_operating_status ON business_info(operating_status)`)
    
    // 为 customers 表添加 business_info_id 关联字段
    const biColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'business_info_id'
    `)
    if (biColCheck.rows.length === 0) {
      await client.query(`ALTER TABLE customers ADD COLUMN business_info_id VARCHAR(32)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_business_info ON customers(business_info_id)`)
      console.log('  ✅ customers.business_info_id 字段已添加')
    }
    
    console.log('  ✅ 工商信息管理表就绪')

    // ==================== 客户跟单员字段迁移 ====================
    // 添加 assigned_operator 和 assigned_operator_name 字段
    const operatorColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'assigned_operator'
    `)
    if (operatorColCheck.rows.length === 0) {
      await client.query(`ALTER TABLE customers ADD COLUMN assigned_operator INTEGER`)
      await client.query(`ALTER TABLE customers ADD COLUMN assigned_operator_name TEXT`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_customers_assigned_operator ON customers(assigned_operator)`)
      console.log('  ✅ customers.assigned_operator 字段已添加 (跟单员分配)')
    }

    // ==================== 提单收款确认相关字段迁移 ====================
    // bills_of_lading 表添加收款确认字段
    const paymentConfirmedFields = [
      { name: 'payment_confirmed', type: 'INTEGER DEFAULT 0', comment: '收款确认状态' },
      { name: 'payment_confirmed_at', type: 'TIMESTAMP', comment: '确认时间' },
      { name: 'payment_confirmed_by', type: 'TEXT', comment: '确认人ID' },
      { name: 'payment_confirmed_by_name', type: 'TEXT', comment: '确认人姓名' },
      { name: 'primary_invoice_number', type: 'TEXT', comment: '主发票号' }
    ]
    
    for (const field of paymentConfirmedFields) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'bills_of_lading' AND column_name = $1
      `, [field.name])
      if (colCheck.rows.length === 0) {
        await client.query(`ALTER TABLE bills_of_lading ADD COLUMN ${field.name} ${field.type}`)
        console.log(`    + bills_of_lading.${field.name} 字段已添加 (${field.comment})`)
      }
    }
    console.log('  ✅ 提单收款确认字段就绪')

    // ==================== 费用审批与锁定字段迁移 ====================
    // fees 表添加锁定和审批相关字段
    const feeApprovalFields = [
      { name: 'is_locked', type: 'INTEGER DEFAULT 0', comment: '锁定状态' },
      { name: 'locked_at', type: 'TIMESTAMP', comment: '锁定时间' },
      { name: 'locked_by', type: 'TEXT', comment: '锁定人' },
      { name: 'is_supplementary', type: 'INTEGER DEFAULT 0', comment: '是否追加费用' },
      { name: 'approval_status', type: "TEXT DEFAULT 'approved'", comment: '审批状态' },
      { name: 'approval_submitted_at', type: 'TIMESTAMP', comment: '提交审批时间' },
      { name: 'approval_submitted_by', type: 'TEXT', comment: '提交人ID' },
      { name: 'approval_submitted_by_name', type: 'TEXT', comment: '提交人姓名' },
      { name: 'approved_at', type: 'TIMESTAMP', comment: '审批时间' },
      { name: 'approved_by', type: 'TEXT', comment: '审批人ID' },
      { name: 'approved_by_name', type: 'TEXT', comment: '审批人姓名' },
      { name: 'rejection_reason', type: 'TEXT', comment: '拒绝原因' }
    ]
    
    for (const field of feeApprovalFields) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'fees' AND column_name = $1
      `, [field.name])
      if (colCheck.rows.length === 0) {
        await client.query(`ALTER TABLE fees ADD COLUMN ${field.name} ${field.type}`)
        console.log(`    + fees.${field.name} 字段已添加 (${field.comment})`)
      }
    }
    // 创建审批状态索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_approval_status ON fees(approval_status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_is_locked ON fees(is_locked)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fees_is_supplementary ON fees(is_supplementary)`)
    console.log('  ✅ 费用审批与锁定字段就绪')

    // ==================== 发票追加关联字段迁移 ====================
    // invoices 表添加追加发票关联字段
    const invoiceSupplementFields = [
      { name: 'parent_invoice_number', type: 'TEXT', comment: '父发票号' },
      { name: 'supplement_seq', type: 'INTEGER DEFAULT 0', comment: '追加序号' }
    ]
    
    for (const field of invoiceSupplementFields) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = $1
      `, [field.name])
      if (colCheck.rows.length === 0) {
        await client.query(`ALTER TABLE invoices ADD COLUMN ${field.name} ${field.type}`)
        console.log(`    + invoices.${field.name} 字段已添加 (${field.comment})`)
      }
    }
    // 创建父发票号索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_parent_invoice ON invoices(parent_invoice_number)`)
    console.log('  ✅ 发票追加关联字段就绪')

    // invoices 表添加软删除字段（删除发票后回流到待开票）
    const invoiceSoftDeleteFields = [
      { name: 'is_deleted', type: 'BOOLEAN DEFAULT FALSE', comment: '是否已删除' },
      { name: 'deleted_at', type: 'TIMESTAMP', comment: '删除时间' }
    ]
    
    for (const field of invoiceSoftDeleteFields) {
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = $1
      `, [field.name])
      if (colCheck.rows.length === 0) {
        await client.query(`ALTER TABLE invoices ADD COLUMN ${field.name} ${field.type}`)
        console.log(`    + invoices.${field.name} 字段已添加 (${field.comment})`)
      }
    }
    // 创建软删除索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invoices_is_deleted ON invoices(is_deleted)`)
    // 更新现有数据
    await client.query(`UPDATE invoices SET is_deleted = FALSE WHERE is_deleted IS NULL`)
    console.log('  ✅ 发票软删除字段就绪')

    // ==================== 通用序列修复 ====================
    // 自动检测并修复所有表的序列值（防止主键冲突）
    try {
      const sequences = await client.query(`
        SELECT 
          s.relname as seq_name,
          t.relname as table_name,
          a.attname as column_name
        FROM pg_class s
        JOIN pg_depend d ON d.objid = s.oid
        JOIN pg_class t ON d.refobjid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
        WHERE s.relkind = 'S'
        AND t.relkind = 'r'
        ORDER BY t.relname
      `)
      
      let fixedCount = 0
      for (const seq of sequences.rows) {
        try {
          const seqVal = await client.query(`SELECT last_value FROM ${seq.seq_name}`)
          const maxId = await client.query(`SELECT MAX(${seq.column_name}) as max_id FROM ${seq.table_name}`)
          
          const lastValue = parseInt(seqVal.rows[0]?.last_value) || 0
          const maxIdValue = parseInt(maxId.rows[0]?.max_id) || 0
          
          if (lastValue <= maxIdValue) {
            await client.query(`SELECT setval('${seq.seq_name}', COALESCE((SELECT MAX(${seq.column_name}) FROM ${seq.table_name}), 0) + 1, false)`)
            fixedCount++
          }
        } catch (seqErr) {
          // 忽略单个序列的错误
        }
      }
      
      if (fixedCount > 0) {
        console.log(`  ✅ 已修复 ${fixedCount} 个序列`)
      }
    } catch (seqErr) {
      console.log('  ⏭️ 序列检查跳过:', seqErr.message)
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
