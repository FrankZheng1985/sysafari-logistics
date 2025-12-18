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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_import ON cargo_items(import_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_hs ON cargo_items(customer_hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_matched_hs ON cargo_items(matched_hs_code)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_status ON cargo_items(match_status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cargo_items_product ON cargo_items(product_name)`)
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
        last_matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nodes_bill_id ON tracking_nodes(bill_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nodes_transport ON tracking_nodes(transport_type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nodes_completed ON tracking_nodes(is_completed)`)
    console.log('  ✅ tracking_nodes 表就绪')

    // ==================== 23. 插入换单代理测试数据 ====================
    // 检查是否已有换单代理供应商
    const docSwapAgentCheck = await client.query(`
      SELECT COUNT(*) as count FROM suppliers WHERE supplier_type = 'doc_swap_agent'
    `)
    
    if (parseInt(docSwapAgentCheck.rows[0].count) === 0) {
      console.log('  📝 插入换单代理测试数据...')
      await client.query(`
        INSERT INTO suppliers (
          id, supplier_code, supplier_name, short_name, supplier_type,
          contact_person, contact_phone, contact_email,
          country, city, address,
          status, level, currency, remark,
          created_at, updated_at
        ) VALUES 
          ('dsa001', 'DSA001', 'Rotterdam Port Services B.V.', 'Rotterdam PS', 'doc_swap_agent',
           'Jan van der Berg', '+31-10-123-4567', 'jan@rotterdam-ps.nl',
           '荷兰', 'Rotterdam', 'Europaweg 100, 3199 LD Rotterdam',
           'active', 'a', 'EUR', '鹿特丹港口换单代理，服务快速',
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
           
          ('dsa002', 'DSA002', 'Amsterdam Shipping Agency', 'ASA', 'doc_swap_agent',
           'Peter de Vries', '+31-20-456-7890', 'peter@asa-agency.nl',
           '荷兰', 'Amsterdam', 'Havenstraat 50, 1019 BA Amsterdam',
           'active', 'b', 'EUR', '阿姆斯特丹港口换单代理',
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
           
          ('dsa003', 'DSA003', 'Hamburg Dokumenten Service GmbH', 'HDS', 'doc_swap_agent',
           'Hans Mueller', '+49-40-789-0123', 'hans@hds-hamburg.de',
           '德国', 'Hamburg', 'Hafenstraße 88, 20457 Hamburg',
           'active', 'a', 'EUR', '汉堡港口换单代理，德国最大换单服务商',
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
           
          ('dsa004', 'DSA004', 'Bremen Shipping Docs', 'BSD', 'doc_swap_agent',
           'Klaus Schmidt', '+49-421-234-5678', 'klaus@bremen-docs.de',
           '德国', 'Bremen', 'Überseestraße 12, 28217 Bremen',
           'active', 'b', 'EUR', '不来梅港口换单代理',
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
           
          ('dsa005', 'DSA005', 'Antwerp Document Exchange NV', 'ADE', 'doc_swap_agent',
           'Marc Janssen', '+32-3-456-7890', 'marc@ade-antwerp.be',
           '比利时', 'Antwerp', 'Noorderlaan 147, 2030 Antwerpen',
           'active', 'a', 'EUR', '安特卫普港口换单代理，欧洲主要换单点',
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (supplier_code) DO NOTHING
      `)
      console.log('  ✅ 换单代理测试数据已插入')
    } else {
      console.log('  ✅ 换单代理数据已存在，跳过插入')
    }

    // ==================== 24. 创建起运港表 ====================
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
