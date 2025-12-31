-- ==================== 综合数据库迁移脚本 ====================
-- 创建时间: 2024-12
-- 说明: 将所有新功能模块的表结构同步到生产/演示环境
-- 执行方式: psql -h host -U user -d database -f sync-all-migrations.sql
-- 注意: 此脚本不会修改订单相关数据！

-- ==================== 开始迁移 ====================
DO $$ BEGIN RAISE NOTICE '开始执行综合数据库迁移...'; END $$;

-- ============================================================
-- 第一部分：最后里程模块 (Last Mile)
-- ============================================================

-- 1.1 最后里程承运商表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_code ON last_mile_carriers(carrier_code);
CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_status ON last_mile_carriers(status);

-- 1.2 Zone配置表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_last_mile_zones_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_last_mile_zones_carrier ON last_mile_zones(carrier_id);

-- 1.3 统一费率卡表
CREATE TABLE IF NOT EXISTS unified_rate_cards (
    id SERIAL PRIMARY KEY,
    rate_card_code TEXT UNIQUE NOT NULL,
    rate_card_name TEXT NOT NULL,
    carrier_id INTEGER,
    supplier_id TEXT,
    rate_type TEXT NOT NULL DEFAULT 'last_mile',
    service_type TEXT DEFAULT 'standard',
    valid_from DATE NOT NULL,
    valid_until DATE,
    currency TEXT DEFAULT 'EUR',
    status TEXT DEFAULT 'active',
    is_default INTEGER DEFAULT 0,
    import_log_id INTEGER,
    version INTEGER DEFAULT 1,
    remark TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_unified_rate_cards_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_carrier ON unified_rate_cards(carrier_id);
CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_status ON unified_rate_cards(status);

-- 1.4 费率明细表
CREATE TABLE IF NOT EXISTS rate_card_tiers (
    id SERIAL PRIMARY KEY,
    rate_card_id INTEGER NOT NULL,
    zone_id INTEGER,
    zone_code TEXT,
    weight_from NUMERIC(10,2) NOT NULL,
    weight_to NUMERIC(10,2) NOT NULL,
    purchase_price NUMERIC(10,2),
    purchase_min_charge NUMERIC(10,2),
    sales_price NUMERIC(10,2),
    sales_min_charge NUMERIC(10,2),
    price_unit TEXT DEFAULT 'per_kg',
    margin_rate NUMERIC(5,2),
    margin_amount NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_card_tiers_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_rate_card_tiers_zone FOREIGN KEY (zone_id) REFERENCES last_mile_zones(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_card_tiers_card ON rate_card_tiers(rate_card_id);

-- 1.5 附加费表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_card_surcharges_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_card_surcharges_card ON rate_card_surcharges(rate_card_id);

-- 1.6 运单表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_last_mile_shipments_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL,
    CONSTRAINT fk_last_mile_shipments_rate_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_no ON last_mile_shipments(shipment_no);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_carrier ON last_mile_shipments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_status ON last_mile_shipments(status);

-- 1.7 运单轨迹表
CREATE TABLE IF NOT EXISTS last_mile_tracking (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL,
    tracking_no TEXT,
    event_time TIMESTAMP,
    event_code TEXT,
    event_description TEXT,
    event_location TEXT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_last_mile_tracking_shipment FOREIGN KEY (shipment_id) REFERENCES last_mile_shipments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_last_mile_tracking_shipment ON last_mile_tracking(shipment_id);

-- 1.8 承运商结算表
CREATE TABLE IF NOT EXISTS carrier_settlements (
    id SERIAL PRIMARY KEY,
    settlement_no TEXT UNIQUE NOT NULL,
    carrier_id INTEGER NOT NULL,
    carrier_name TEXT,
    carrier_code TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carrier_settlements_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_carrier_settlements_no ON carrier_settlements(settlement_no);
CREATE INDEX IF NOT EXISTS idx_carrier_settlements_carrier ON carrier_settlements(carrier_id);

-- 1.9 结算明细表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carrier_settlement_items_settlement FOREIGN KEY (settlement_id) REFERENCES carrier_settlements(id) ON DELETE CASCADE,
    CONSTRAINT fk_carrier_settlement_items_shipment FOREIGN KEY (shipment_id) REFERENCES last_mile_shipments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_carrier_settlement_items_settlement ON carrier_settlement_items(settlement_id);

-- 1.10 导入模板表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_import_templates_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL
);

-- 1.11 导入记录表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_import_logs_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL
);

DO $$ BEGIN RAISE NOTICE '✅ 最后里程模块表创建完成'; END $$;

-- ============================================================
-- 第二部分：业务员提成模块 (Commission)
-- ============================================================

-- 2.1 提成规则表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_customer_level ON commission_rules(customer_level);
CREATE INDEX IF NOT EXISTS idx_commission_rules_is_active ON commission_rules(is_active);

-- 2.2 阶梯奖金表
CREATE TABLE IF NOT EXISTS commission_tiers (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL,
    tier_level INTEGER NOT NULL,
    min_count INTEGER NOT NULL,
    max_count INTEGER,
    bonus_amount NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_commission_tiers_rule FOREIGN KEY (rule_id) REFERENCES commission_rules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commission_tiers_rule_id ON commission_tiers(rule_id);

-- 2.3 提成记录表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_records_salesperson ON commission_records(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_settlement_month ON commission_records(settlement_month);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);

-- 2.4 提成结算表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_settlements_salesperson ON commission_settlements(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_commission_settlements_month ON commission_settlements(settlement_month);
CREATE INDEX IF NOT EXISTS idx_commission_settlements_status ON commission_settlements(status);

DO $$ BEGIN RAISE NOTICE '✅ 业务员提成模块表创建完成'; END $$;

-- ============================================================
-- 第三部分：安全管理模块 (Security)
-- ============================================================

-- 3.1 登录尝试记录表
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT,
    country TEXT,
    city TEXT,
    device_fingerprint TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time);

-- 3.2 安全审计日志表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON security_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_time ON security_audit_logs(created_at);

-- 3.3 IP黑名单表
CREATE TABLE IF NOT EXISTS ip_blacklist (
    id SERIAL PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_by TEXT,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blacklist_ip ON ip_blacklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON ip_blacklist(is_active);

-- 3.4 API速率限制表
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL,
    endpoint TEXT,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON api_rate_limits(identifier, identifier_type);

-- 3.5 密码历史表
CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);

-- 3.6 活动会话表
CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON active_sessions(is_active);

-- 3.7 数据备份记录表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_records(backup_status);

-- 3.8 安全设置表增强字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_settings' AND column_name = 'setting_type'
    ) THEN
        ALTER TABLE security_settings ADD COLUMN setting_type TEXT DEFAULT 'string';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_settings' AND column_name = 'category'
    ) THEN
        ALTER TABLE security_settings ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
END $$;

-- 3.9 用户表安全字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_expires_at'
    ) THEN
        ALTER TABLE users ADD COLUMN password_expires_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_changed_at'
    ) THEN
        ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_enabled'
    ) THEN
        ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_secret'
    ) THEN
        ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
    END IF;
END $$;

DO $$ BEGIN RAISE NOTICE '✅ 安全管理模块表创建完成'; END $$;

-- ============================================================
-- 第四部分：罚款规则模块 (Penalty)
-- ============================================================

-- 4.1 罚款规则表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penalty_rules_code ON penalty_rules(rule_code);
CREATE INDEX IF NOT EXISTS idx_penalty_rules_type ON penalty_rules(penalty_type);
CREATE INDEX IF NOT EXISTS idx_penalty_rules_active ON penalty_rules(is_active);

-- 4.2 罚款记录表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penalty_records_customer ON penalty_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_penalty_records_salesperson ON penalty_records(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_penalty_records_settlement ON penalty_records(settlement_month);
CREATE INDEX IF NOT EXISTS idx_penalty_records_status ON penalty_records(status);

DO $$ BEGIN RAISE NOTICE '✅ 罚款规则模块表创建完成'; END $$;

-- ============================================================
-- 第五部分：HS匹配记录模块
-- ============================================================

-- 5.1 HS匹配记录表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hs_match_records_product_name ON hs_match_records(product_name);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_hs_code ON hs_match_records(hs_code);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_material ON hs_match_records(material);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_status ON hs_match_records(status);

-- 5.2 HS申报历史表
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
    declared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hs_declaration_history_record_id ON hs_declaration_history(match_record_id);
CREATE INDEX IF NOT EXISTS idx_hs_declaration_history_import_id ON hs_declaration_history(import_id);

DO $$ BEGIN RAISE NOTICE '✅ HS匹配记录模块表创建完成'; END $$;

-- ============================================================
-- 第六部分：审批系统模块
-- ============================================================

-- 6.1 审批请求表
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
    applicant_id INTEGER NOT NULL,
    applicant_name TEXT,
    department TEXT,
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    due_date TIMESTAMP,
    attachments JSONB,
    form_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_applicant ON approval_requests(applicant_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

-- 6.2 审批流程定义表
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    workflow_code TEXT UNIQUE NOT NULL,
    workflow_name TEXT NOT NULL,
    request_type TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    conditions JSONB,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active);

-- 6.3 审批记录表
CREATE TABLE IF NOT EXISTS approval_records (
    id SERIAL PRIMARY KEY,
    request_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    step_name TEXT,
    approver_id INTEGER NOT NULL,
    approver_name TEXT,
    action TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_records_request ON approval_records(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_approver ON approval_records(approver_id);

DO $$ BEGIN RAISE NOTICE '✅ 审批系统模块表创建完成'; END $$;

-- ============================================================
-- 第七部分：合同模板模块
-- ============================================================

-- 7.1 合同模板表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_status ON contract_templates(status);

-- 7.2 合同签署记录表
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_status ON contract_signatures(status);

DO $$ BEGIN RAISE NOTICE '✅ 合同模板模块表创建完成'; END $$;

-- ============================================================
-- 第八部分：初始化默认数据
-- ============================================================

-- 8.1 初始化常用承运商
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES 
    ('DHL', 'DHL快递', 'DHL Express', 'express', 'DE', 'https://www.dhl.de', 'active'),
    ('DPD', 'DPD快递', 'DPD', 'express', 'DE', 'https://www.dpd.com', 'active'),
    ('UPS', 'UPS快递', 'UPS', 'express', 'US', 'https://www.ups.com', 'active'),
    ('GLS', 'GLS快递', 'GLS', 'express', 'DE', 'https://www.gls-group.eu', 'active'),
    ('SCHENKER', '申克物流', 'DB Schenker', 'trucking', 'DE', 'https://www.dbschenker.com', 'active'),
    ('HERMES', 'Hermes快递', 'Hermes', 'express', 'DE', 'https://www.myhermes.de', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

DO $$ BEGIN RAISE NOTICE '✅ 默认承运商数据已初始化'; END $$;

-- ============================================================
-- 完成
-- ============================================================

DO $$ BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ 综合数据库迁移全部完成！';
    RAISE NOTICE '';
    RAISE NOTICE '已创建/更新的模块:';
    RAISE NOTICE '  • 最后里程模块 (11张表)';
    RAISE NOTICE '  • 业务员提成模块 (4张表)';
    RAISE NOTICE '  • 安全管理模块 (7张表 + 字段扩展)';
    RAISE NOTICE '  • 罚款规则模块 (2张表)';
    RAISE NOTICE '  • HS匹配记录模块 (2张表)';
    RAISE NOTICE '  • 审批系统模块 (3张表)';
    RAISE NOTICE '  • 合同模板模块 (2张表)';
    RAISE NOTICE '';
    RAISE NOTICE '注意: 此脚本不会修改订单相关数据！';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
