-- PostgreSQL 数据库初始化脚本
-- 从 SQLite 迁移到 PostgreSQL
-- 使用方法: psql -h host -U user -d database -f pg-init-schema.sql

-- ==================== 序号序列管理表 ====================
CREATE TABLE IF NOT EXISTS order_sequences (
    business_type TEXT PRIMARY KEY,
    current_seq INTEGER DEFAULT 0,
    prefix TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 提单表 ====================
CREATE TABLE IF NOT EXISTS bills_of_lading (
    id TEXT PRIMARY KEY,
    bill_id TEXT,
    bill_number TEXT NOT NULL,
    container_number TEXT,
    vessel TEXT,
    eta TEXT,
    ata TEXT,
    pieces INTEGER,
    weight NUMERIC,
    volume NUMERIC,
    inspection TEXT,
    customs_stats TEXT,
    creator TEXT,
    create_time TEXT,
    status TEXT,
    shipper TEXT,
    consignee TEXT,
    notify_party TEXT,
    port_of_loading TEXT,
    port_of_discharge TEXT,
    place_of_delivery TEXT,
    complete_time TEXT,
    delivery_status TEXT,
    transport_method TEXT,
    company_name TEXT,
    order_seq INTEGER,
    is_void INTEGER DEFAULT 0,
    void_reason TEXT,
    void_time TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ship_status TEXT DEFAULT '未到港',
    skip_port TEXT,
    skip_port_time TEXT,
    customs_status TEXT DEFAULT '未放行',
    customs_release_time TEXT,
    actual_arrival_date TEXT,
    inspection_detail TEXT,
    inspection_estimated_time TEXT,
    inspection_start_time TEXT,
    inspection_end_time TEXT,
    inspection_result TEXT,
    inspection_result_note TEXT,
    inspection_release_time TEXT,
    inspection_confirmed_time TEXT,
    cmr_detail TEXT,
    cmr_estimated_pickup_time TEXT,
    cmr_service_provider TEXT,
    cmr_delivery_address TEXT,
    cmr_estimated_arrival_time TEXT,
    cmr_actual_arrival_time TEXT,
    cmr_unloading_complete_time TEXT,
    cmr_confirmed_time TEXT,
    cmr_has_exception INTEGER DEFAULT 0,
    cmr_exception_note TEXT,
    cmr_exception_time TEXT,
    cmr_exception_status TEXT,
    cmr_exception_records TEXT,
    cmr_notes TEXT,
    assigned_operator_id INTEGER,
    assigned_operator_name TEXT,
    cmr_current_step INTEGER DEFAULT 0,
    cmr_remark TEXT,
    customer_id TEXT,
    customer_name TEXT,
    customer_code TEXT,
    actual_container_no TEXT,
    cmr_exception_resolution TEXT,
    cmr_exception_resolved_time TEXT,
    doc_swap_status TEXT DEFAULT '未换单',
    doc_swap_time TEXT
);

-- ==================== 操作日志表 ====================
CREATE TABLE IF NOT EXISTS operation_logs (
    id SERIAL PRIMARY KEY,
    bill_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    operation_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT DEFAULT 'system',
    remark TEXT,
    operation_time TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    operator_id TEXT,
    module TEXT DEFAULT 'order'
);

-- ==================== 提单文件表 ====================
CREATE TABLE IF NOT EXISTS bill_files (
    id SERIAL PRIMARY KEY,
    bill_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    upload_by TEXT DEFAULT 'admin',
    upload_time TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 包裹表 ====================
CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    package_id TEXT,
    package_number TEXT NOT NULL,
    bill_id TEXT,
    quantity INTEGER DEFAULT 1,
    weight NUMERIC,
    volume NUMERIC,
    dimensions TEXT,
    package_type TEXT,
    contents TEXT,
    creator TEXT,
    create_time TEXT,
    status TEXT DEFAULT '待处理',
    order_seq INTEGER,
    is_void INTEGER DEFAULT 0,
    void_reason TEXT,
    void_time TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 报关表 ====================
CREATE TABLE IF NOT EXISTS declarations (
    id TEXT PRIMARY KEY,
    declaration_id TEXT,
    declaration_number TEXT,
    bill_id TEXT,
    country TEXT,
    declaration_type TEXT,
    goods_description TEXT,
    hs_code TEXT,
    quantity INTEGER,
    value NUMERIC,
    currency TEXT DEFAULT 'EUR',
    success_count INTEGER DEFAULT 0,
    producing_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    priority TEXT,
    creator TEXT,
    create_time TEXT,
    status TEXT DEFAULT '待报关',
    order_seq INTEGER,
    is_void INTEGER DEFAULT 0,
    void_reason TEXT,
    void_time TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 标签表 ====================
CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    label_id TEXT,
    order_number TEXT NOT NULL,
    bill_id TEXT,
    transfer_method TEXT,
    label_type TEXT,
    recipient_name TEXT,
    recipient_address TEXT,
    recipient_phone TEXT,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    generating_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    creation_method TEXT,
    creator TEXT,
    create_time TEXT,
    status TEXT DEFAULT '待生成',
    order_seq INTEGER,
    is_void INTEGER DEFAULT 0,
    void_reason TEXT,
    void_time TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 最后一公里订单表 ====================
CREATE TABLE IF NOT EXISTS last_mile_orders (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    order_number TEXT NOT NULL,
    bill_id TEXT,
    bill_number TEXT,
    recipient_name TEXT,
    recipient_address TEXT,
    recipient_phone TEXT,
    delivery_company TEXT,
    tracking_number TEXT,
    estimated_delivery TEXT,
    actual_delivery TEXT,
    delivery_note TEXT,
    creator TEXT,
    create_time TEXT,
    status TEXT DEFAULT '待派送',
    order_seq INTEGER,
    is_void INTEGER DEFAULT 0,
    void_reason TEXT,
    void_time TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 基础数据表 ====================
CREATE TABLE IF NOT EXISTS basic_data (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 装货港表 ====================
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
);

-- ==================== 目的港表 ====================
CREATE TABLE IF NOT EXISTS destination_ports (
    id SERIAL PRIMARY KEY,
    port_code TEXT NOT NULL UNIQUE,
    port_name_cn TEXT NOT NULL,
    port_name_en TEXT,
    country TEXT,
    country_code TEXT,
    city TEXT,
    transport_type TEXT DEFAULT 'sea',
    continent TEXT DEFAULT '亚洲',
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 机场表 ====================
CREATE TABLE IF NOT EXISTS air_ports (
    id SERIAL PRIMARY KEY,
    port_code TEXT NOT NULL UNIQUE,
    port_name_cn TEXT NOT NULL,
    port_name_en TEXT,
    country TEXT,
    country_code TEXT,
    city TEXT,
    continent TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 国家表 ====================
CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    country_code TEXT NOT NULL UNIQUE,
    country_name_cn TEXT NOT NULL,
    country_name_en TEXT NOT NULL,
    continent TEXT,
    region TEXT,
    capital TEXT,
    currency_code TEXT,
    currency_name TEXT,
    phone_code TEXT,
    timezone TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 服务费类别表 ====================
CREATE TABLE IF NOT EXISTS service_fee_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 运输方式表 ====================
CREATE TABLE IF NOT EXISTS transport_methods (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 服务费表 ====================
CREATE TABLE IF NOT EXISTS service_fees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'EUR',
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 运输价格表 ====================
CREATE TABLE IF NOT EXISTS transport_prices (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    transport_type TEXT NOT NULL,
    distance NUMERIC NOT NULL,
    price_per_km NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    valid_from TEXT,
    valid_to TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 系统设置表 ====================
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 关税税率表 ====================
CREATE TABLE IF NOT EXISTS tariff_rates (
    id SERIAL PRIMARY KEY,
    hs_code TEXT NOT NULL,
    hs_code_10 TEXT,
    goods_description TEXT NOT NULL,
    goods_description_cn TEXT,
    origin_country TEXT,
    origin_country_code TEXT,
    duty_rate NUMERIC DEFAULT 0,
    duty_rate_type TEXT DEFAULT 'percentage',
    vat_rate NUMERIC DEFAULT 19,
    anti_dumping_rate NUMERIC DEFAULT 0,
    countervailing_rate NUMERIC DEFAULT 0,
    preferential_rate NUMERIC,
    preferential_origin TEXT,
    unit_code TEXT,
    unit_name TEXT,
    supplementary_unit TEXT,
    measure_type TEXT,
    measure_code TEXT,
    legal_base TEXT,
    start_date TEXT,
    end_date TEXT,
    quota_order_number TEXT,
    additional_code TEXT,
    footnotes TEXT,
    is_active INTEGER DEFAULT 1,
    data_source TEXT DEFAULT 'manual',
    last_sync_time TIMESTAMP,
    declaration_type TEXT DEFAULT 'per_unit',
    min_declaration_value NUMERIC DEFAULT 0,
    material TEXT,
    usage_scenario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 关税税率历史表 ====================
CREATE TABLE IF NOT EXISTS tariff_rate_history (
    id SERIAL PRIMARY KEY,
    tariff_rate_id INTEGER NOT NULL,
    hs_code TEXT NOT NULL,
    old_duty_rate NUMERIC,
    new_duty_rate NUMERIC,
    old_vat_rate NUMERIC,
    new_vat_rate NUMERIC,
    change_type TEXT,
    change_reason TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 用户表 ====================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'operator',
    status TEXT DEFAULT 'active',
    last_login_time TEXT,
    last_login_ip TEXT,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 角色表 ====================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_code TEXT UNIQUE NOT NULL,
    role_name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    color_code TEXT DEFAULT 'blue'
);

-- ==================== 权限表 ====================
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    permission_code TEXT UNIQUE NOT NULL,
    permission_name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 角色权限关联表 ====================
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_code TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_code, permission_code)
);

-- ==================== 用户提单分配表 ====================
CREATE TABLE IF NOT EXISTS user_bill_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bill_id TEXT NOT NULL,
    assigned_by INTEGER,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bill_id)
);

-- ==================== 船公司表 ====================
CREATE TABLE IF NOT EXISTS shipping_companies (
    id SERIAL PRIMARY KEY,
    company_code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    country TEXT,
    website TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 箱号表 ====================
CREATE TABLE IF NOT EXISTS container_codes (
    id SERIAL PRIMARY KEY,
    shipping_company_id INTEGER NOT NULL,
    container_code TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 登录尝试表 ====================
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    ip_address TEXT,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0,
    failure_reason TEXT
);

-- ==================== 验证码表 ====================
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT DEFAULT 'login',
    expires_at TIMESTAMP NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 登录日志表 ====================
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username TEXT NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    location TEXT,
    status TEXT DEFAULT 'success',
    failure_reason TEXT
);

-- ==================== 安全设置表 ====================
CREATE TABLE IF NOT EXISTS security_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 增值税税率表 ====================
CREATE TABLE IF NOT EXISTS vat_rates (
    id SERIAL PRIMARY KEY,
    country_code TEXT NOT NULL,
    country_name TEXT NOT NULL,
    standard_rate NUMERIC NOT NULL DEFAULT 19,
    reduced_rate NUMERIC DEFAULT 0,
    super_reduced_rate NUMERIC DEFAULT 0,
    parking_rate NUMERIC DEFAULT 0,
    description TEXT,
    effective_date TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 服务商表 ====================
CREATE TABLE IF NOT EXISTS service_providers (
    id SERIAL PRIMARY KEY,
    provider_code TEXT UNIQUE NOT NULL,
    provider_name TEXT NOT NULL,
    service_type TEXT DEFAULT 'delivery',
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 客户表 ====================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    customer_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    company_name TEXT,
    customer_type TEXT DEFAULT 'shipper',
    customer_level TEXT DEFAULT 'normal',
    country_code TEXT,
    province TEXT,
    city TEXT,
    address TEXT,
    postal_code TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    tax_number TEXT,
    payment_terms TEXT,
    credit_limit NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    bank_name TEXT,
    bank_account TEXT,
    website TEXT,
    industry TEXT,
    source TEXT,
    assigned_sales INTEGER,
    assigned_sales_name TEXT,
    tags TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 客户联系人表 ====================
CREATE TABLE IF NOT EXISTS customer_contacts (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    position TEXT,
    department TEXT,
    phone TEXT,
    mobile TEXT,
    email TEXT,
    wechat TEXT,
    is_primary INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 客户跟进记录表 ====================
CREATE TABLE IF NOT EXISTS customer_follow_ups (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    contact_id TEXT,
    contact_name TEXT,
    follow_up_type TEXT DEFAULT 'call',
    subject TEXT NOT NULL,
    content TEXT,
    follow_up_time TIMESTAMP,
    next_follow_up_time TIMESTAMP,
    next_follow_up_note TEXT,
    result TEXT,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 费用表 ====================
CREATE TABLE IF NOT EXISTS fees (
    id TEXT PRIMARY KEY,
    fee_number TEXT UNIQUE NOT NULL,
    bill_id TEXT,
    bill_number TEXT,
    customer_id TEXT,
    customer_name TEXT,
    fee_type TEXT DEFAULT 'receivable',
    fee_category TEXT,
    fee_name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    exchange_rate NUMERIC DEFAULT 1,
    amount_cny NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    unpaid_amount NUMERIC DEFAULT 0,
    due_date DATE,
    payment_status TEXT DEFAULT 'unpaid',
    invoice_status TEXT DEFAULT 'not_invoiced',
    invoice_number TEXT,
    invoice_date DATE,
    notes TEXT,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 发票表 ====================
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_type TEXT DEFAULT 'sales',
    customer_id TEXT,
    customer_name TEXT,
    invoice_date DATE,
    due_date DATE,
    subtotal NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    items TEXT DEFAULT '[]',
    notes TEXT,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 付款记录表 ====================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT UNIQUE NOT NULL,
    payment_type TEXT DEFAULT 'receipt',
    customer_id TEXT,
    customer_name TEXT,
    invoice_id TEXT,
    invoice_number TEXT,
    fee_ids TEXT,
    payment_date DATE,
    amount NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    payment_method TEXT,
    bank_account TEXT,
    reference_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    approved_by_name TEXT,
    approved_at TIMESTAMP,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 销售机会表 ====================
CREATE TABLE IF NOT EXISTS sales_opportunities (
    id TEXT PRIMARY KEY,
    opportunity_number TEXT UNIQUE NOT NULL,
    opportunity_name TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    contact_id TEXT,
    contact_name TEXT,
    stage TEXT DEFAULT 'lead',
    expected_amount NUMERIC DEFAULT 0,
    probability INTEGER DEFAULT 0,
    expected_close_date DATE,
    source TEXT,
    description TEXT,
    assigned_to INTEGER,
    assigned_name TEXT,
    lost_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 报价单表 ====================
CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    quote_number TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    opportunity_id TEXT,
    contact_id TEXT,
    contact_name TEXT,
    subject TEXT,
    quote_date DATE,
    valid_until DATE,
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    terms TEXT,
    notes TEXT,
    items TEXT DEFAULT '[]',
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 合同表 ====================
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    contract_number TEXT UNIQUE NOT NULL,
    contract_name TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    quotation_id TEXT,
    opportunity_id TEXT,
    contract_type TEXT DEFAULT 'service',
    contract_amount NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    start_date DATE,
    end_date DATE,
    sign_date DATE,
    terms TEXT,
    notes TEXT,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 客户反馈表 ====================
CREATE TABLE IF NOT EXISTS customer_feedbacks (
    id TEXT PRIMARY KEY,
    feedback_number TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    contact_id TEXT,
    contact_name TEXT,
    feedback_type TEXT DEFAULT 'inquiry',
    subject TEXT NOT NULL,
    content TEXT,
    priority TEXT DEFAULT 'medium',
    source TEXT,
    bill_id TEXT,
    bill_number TEXT,
    assigned_to INTEGER,
    assigned_name TEXT,
    status TEXT DEFAULT 'open',
    resolution TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 运输定价表 ====================
CREATE TABLE IF NOT EXISTS transport_pricing (
    id SERIAL PRIMARY KEY,
    route_code TEXT NOT NULL UNIQUE,
    route_name TEXT NOT NULL,
    origin TEXT,
    destination TEXT,
    service_type TEXT DEFAULT 'delivery',
    price_type TEXT DEFAULT 'per_kg',
    unit_price NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'CNY',
    min_weight NUMERIC DEFAULT 0,
    max_weight NUMERIC DEFAULT 0,
    effective_date DATE,
    expiry_date DATE,
    provider_id INTEGER,
    provider_name TEXT,
    status TEXT DEFAULT 'active',
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 清关单据类型表 ====================
CREATE TABLE IF NOT EXISTS clearance_document_types (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_cn TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    required_fields TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 清关单据表 ====================
CREATE TABLE IF NOT EXISTS clearance_documents (
    id TEXT PRIMARY KEY,
    document_no TEXT NOT NULL UNIQUE,
    bill_id TEXT,
    bill_number TEXT,
    document_type TEXT NOT NULL,
    document_type_name TEXT,
    shipper_name TEXT,
    shipper_address TEXT,
    shipper_contact TEXT,
    consignee_name TEXT,
    consignee_address TEXT,
    consignee_contact TEXT,
    notify_party TEXT,
    goods_description TEXT,
    hs_code TEXT,
    quantity INTEGER,
    quantity_unit TEXT,
    gross_weight NUMERIC,
    net_weight NUMERIC,
    weight_unit TEXT DEFAULT 'KGS',
    volume NUMERIC,
    volume_unit TEXT DEFAULT 'CBM',
    packages INTEGER,
    package_type TEXT,
    currency TEXT DEFAULT 'USD',
    total_value NUMERIC,
    unit_price NUMERIC,
    freight_amount NUMERIC,
    insurance_amount NUMERIC,
    transport_method TEXT,
    vessel_name TEXT,
    voyage_no TEXT,
    port_of_loading TEXT,
    port_of_discharge TEXT,
    country_of_origin TEXT,
    country_of_destination TEXT,
    etd TEXT,
    eta TEXT,
    customs_broker TEXT,
    customs_entry_no TEXT,
    customs_release_date TEXT,
    duty_amount NUMERIC,
    tax_amount NUMERIC,
    status TEXT DEFAULT 'draft',
    review_status TEXT DEFAULT 'pending',
    review_note TEXT,
    reviewer TEXT,
    review_time TEXT,
    remark TEXT,
    attachments TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 清关单据明细表 ====================
CREATE TABLE IF NOT EXISTS clearance_document_items (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    item_no INTEGER,
    description TEXT,
    hs_code TEXT,
    quantity INTEGER,
    quantity_unit TEXT,
    unit_price NUMERIC,
    total_price NUMERIC,
    gross_weight NUMERIC,
    net_weight NUMERIC,
    volume NUMERIC,
    country_of_origin TEXT,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 作废申请表 ====================
CREATE TABLE IF NOT EXISTS void_applications (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending_supervisor',
    applicant_id TEXT,
    applicant_name TEXT,
    supervisor_id TEXT,
    supervisor_name TEXT,
    supervisor_approved_at TEXT,
    supervisor_comment TEXT,
    finance_id TEXT,
    finance_name TEXT,
    finance_approved_at TEXT,
    finance_comment TEXT,
    fees_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 系统配置表 ====================
CREATE TABLE IF NOT EXISTS system_configs (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 文档模板表 ====================
CREATE TABLE IF NOT EXISTS document_templates (
    id SERIAL PRIMARY KEY,
    template_code TEXT UNIQUE NOT NULL,
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    content TEXT,
    variables TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 文档版本表 ====================
CREATE TABLE IF NOT EXISTS document_versions (
    id SERIAL PRIMARY KEY,
    document_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT,
    changes TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 文档表 ====================
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    document_number TEXT UNIQUE NOT NULL,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    bill_id TEXT,
    customer_id TEXT,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_by_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 创建索引 ====================
CREATE INDEX IF NOT EXISTS idx_operation_logs_bill_id ON operation_logs(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_files_bill_id ON bill_files(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_number ON bills_of_lading(bill_number);
CREATE INDEX IF NOT EXISTS idx_container_number ON bills_of_lading(container_number);
CREATE INDEX IF NOT EXISTS idx_status ON bills_of_lading(status);
CREATE INDEX IF NOT EXISTS idx_create_time ON bills_of_lading(create_time);
CREATE INDEX IF NOT EXISTS idx_bill_order_seq ON bills_of_lading(order_seq);
CREATE INDEX IF NOT EXISTS idx_bill_is_void ON bills_of_lading(is_void);
CREATE INDEX IF NOT EXISTS idx_package_order_seq ON packages(order_seq);
CREATE INDEX IF NOT EXISTS idx_package_is_void ON packages(is_void);
CREATE INDEX IF NOT EXISTS idx_declaration_order_seq ON declarations(order_seq);
CREATE INDEX IF NOT EXISTS idx_declaration_is_void ON declarations(is_void);
CREATE INDEX IF NOT EXISTS idx_label_order_seq ON labels(order_seq);
CREATE INDEX IF NOT EXISTS idx_label_is_void ON labels(is_void);
CREATE INDEX IF NOT EXISTS idx_last_mile_order_seq ON last_mile_orders(order_seq);
CREATE INDEX IF NOT EXISTS idx_last_mile_is_void ON last_mile_orders(is_void);
CREATE INDEX IF NOT EXISTS idx_basic_data_code ON basic_data(code);
CREATE INDEX IF NOT EXISTS idx_basic_data_category ON basic_data(category);
CREATE INDEX IF NOT EXISTS idx_basic_data_status ON basic_data(status);
CREATE INDEX IF NOT EXISTS idx_ports_code ON ports_of_loading(port_code);
CREATE INDEX IF NOT EXISTS idx_ports_name_cn ON ports_of_loading(port_name_cn);
CREATE INDEX IF NOT EXISTS idx_ports_country ON ports_of_loading(country);
CREATE INDEX IF NOT EXISTS idx_ports_status ON ports_of_loading(status);
CREATE INDEX IF NOT EXISTS idx_dest_ports_code ON destination_ports(port_code);
CREATE INDEX IF NOT EXISTS idx_dest_ports_name_cn ON destination_ports(port_name_cn);
CREATE INDEX IF NOT EXISTS idx_dest_ports_country ON destination_ports(country);
CREATE INDEX IF NOT EXISTS idx_dest_ports_status ON destination_ports(status);
CREATE INDEX IF NOT EXISTS idx_dest_ports_transport_type ON destination_ports(transport_type);
CREATE INDEX IF NOT EXISTS idx_dest_ports_continent ON destination_ports(continent);
CREATE INDEX IF NOT EXISTS idx_air_ports_code ON air_ports(port_code);
CREATE INDEX IF NOT EXISTS idx_air_ports_name_cn ON air_ports(port_name_cn);
CREATE INDEX IF NOT EXISTS idx_air_ports_country ON air_ports(country);
CREATE INDEX IF NOT EXISTS idx_air_ports_status ON air_ports(status);
CREATE INDEX IF NOT EXISTS idx_countries_code ON countries(country_code);
CREATE INDEX IF NOT EXISTS idx_countries_name_cn ON countries(country_name_cn);
CREATE INDEX IF NOT EXISTS idx_countries_name_en ON countries(country_name_en);
CREATE INDEX IF NOT EXISTS idx_countries_continent ON countries(continent);
CREATE INDEX IF NOT EXISTS idx_countries_status ON countries(status);
CREATE INDEX IF NOT EXISTS idx_fee_categories_code ON service_fee_categories(code);
CREATE INDEX IF NOT EXISTS idx_fee_categories_status ON service_fee_categories(status);
CREATE INDEX IF NOT EXISTS idx_transport_methods_code ON transport_methods(code);
CREATE INDEX IF NOT EXISTS idx_transport_methods_status ON transport_methods(status);
CREATE INDEX IF NOT EXISTS idx_service_fees_category ON service_fees(category);
CREATE INDEX IF NOT EXISTS idx_service_fees_active ON service_fees(is_active);
CREATE INDEX IF NOT EXISTS idx_transport_prices_origin ON transport_prices(origin);
CREATE INDEX IF NOT EXISTS idx_transport_prices_destination ON transport_prices(destination);
CREATE INDEX IF NOT EXISTS idx_transport_prices_active ON transport_prices(is_active);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_hs_code ON tariff_rates(hs_code);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_hs_code_10 ON tariff_rates(hs_code_10);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_origin ON tariff_rates(origin_country_code);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_active ON tariff_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_tariff_history_rate_id ON tariff_rate_history(tariff_rate_id);
CREATE INDEX IF NOT EXISTS idx_tariff_history_hs_code ON tariff_rate_history(hs_code);
CREATE INDEX IF NOT EXISTS idx_shipping_companies_code ON shipping_companies(company_code);
CREATE INDEX IF NOT EXISTS idx_shipping_companies_name ON shipping_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_shipping_companies_status ON shipping_companies(status);
CREATE INDEX IF NOT EXISTS idx_container_codes_code ON container_codes(container_code);
CREATE INDEX IF NOT EXISTS idx_container_codes_company ON container_codes(shipping_company_id);
CREATE INDEX IF NOT EXISTS idx_container_codes_status ON container_codes(status);
CREATE INDEX IF NOT EXISTS idx_vat_rates_country_code ON vat_rates(country_code);
CREATE INDEX IF NOT EXISTS idx_vat_rates_status ON vat_rates(status);
CREATE INDEX IF NOT EXISTS idx_service_providers_code ON service_providers(provider_code);
CREATE INDEX IF NOT EXISTS idx_service_providers_name ON service_providers(provider_name);
CREATE INDEX IF NOT EXISTS idx_service_providers_type ON service_providers(service_type);
CREATE INDEX IF NOT EXISTS idx_service_providers_status ON service_providers(status);
CREATE INDEX IF NOT EXISTS idx_transport_pricing_code ON transport_pricing(route_code);
CREATE INDEX IF NOT EXISTS idx_transport_pricing_type ON transport_pricing(service_type);
CREATE INDEX IF NOT EXISTS idx_transport_pricing_status ON transport_pricing(status);
CREATE INDEX IF NOT EXISTS idx_clearance_docs_bill_id ON clearance_documents(bill_id);
CREATE INDEX IF NOT EXISTS idx_clearance_docs_bill_number ON clearance_documents(bill_number);
CREATE INDEX IF NOT EXISTS idx_clearance_docs_type ON clearance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_clearance_docs_status ON clearance_documents(status);
CREATE INDEX IF NOT EXISTS idx_clearance_doc_items_doc_id ON clearance_document_items(document_id);
CREATE INDEX IF NOT EXISTS idx_void_applications_bill_id ON void_applications(bill_id);
CREATE INDEX IF NOT EXISTS idx_void_applications_status ON void_applications(status);

-- ==================== Auth0 集成相关 ====================

-- 给 users 表添加 auth0_id 字段（用于绑定 Auth0 账号）
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth0_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);

-- Auth0 待绑定用户表（通过 Auth0 登录但未绑定系统用户的账号）
CREATE TABLE IF NOT EXISTS auth0_pending_users (
    id SERIAL PRIMARY KEY,
    auth0_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    picture TEXT,
    first_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_bound BOOLEAN DEFAULT FALSE,
    bound_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth0_pending_auth0_id ON auth0_pending_users(auth0_id);
CREATE INDEX IF NOT EXISTS idx_auth0_pending_is_bound ON auth0_pending_users(is_bound);

-- ==================== TMS考核条件表 ====================
CREATE TABLE IF NOT EXISTS tms_assessment_conditions (
    id SERIAL PRIMARY KEY,
    condition_code TEXT UNIQUE NOT NULL,
    condition_name TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    metric_name TEXT,
    operator TEXT DEFAULT '<=',
    threshold_value NUMERIC,
    threshold_value2 NUMERIC,
    unit TEXT,
    weight INTEGER DEFAULT 100,
    scope_type TEXT DEFAULT 'global',
    scope_values TEXT,
    alert_enabled INTEGER DEFAULT 0,
    alert_level TEXT DEFAULT 'warning',
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_conditions_code ON tms_assessment_conditions(condition_code);
CREATE INDEX IF NOT EXISTS idx_tms_conditions_type ON tms_assessment_conditions(condition_type);
CREATE INDEX IF NOT EXISTS idx_tms_conditions_status ON tms_assessment_conditions(status);
CREATE INDEX IF NOT EXISTS idx_tms_conditions_scope ON tms_assessment_conditions(scope_type);

-- ==================== TMS考核结果表 ====================
CREATE TABLE IF NOT EXISTS tms_assessment_results (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER,
    provider_name TEXT,
    bill_id TEXT,
    bill_number TEXT,
    condition_id INTEGER,
    condition_code TEXT,
    condition_type TEXT,
    actual_value NUMERIC,
    threshold_value NUMERIC,
    is_passed INTEGER DEFAULT 0,
    score NUMERIC DEFAULT 0,
    assessment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    period TEXT,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tms_results_provider ON tms_assessment_results(provider_id);
CREATE INDEX IF NOT EXISTS idx_tms_results_bill ON tms_assessment_results(bill_id);
CREATE INDEX IF NOT EXISTS idx_tms_results_condition ON tms_assessment_results(condition_id);
CREATE INDEX IF NOT EXISTS idx_tms_results_type ON tms_assessment_results(condition_type);
CREATE INDEX IF NOT EXISTS idx_tms_results_period ON tms_assessment_results(period);
CREATE INDEX IF NOT EXISTS idx_tms_results_passed ON tms_assessment_results(is_passed);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL 数据库表结构初始化完成！';
    RAISE NOTICE '📊 共创建 53 个数据表';
END $$;
