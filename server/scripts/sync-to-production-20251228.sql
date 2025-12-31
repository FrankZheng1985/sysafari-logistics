-- ============================================================
-- 生产环境数据库同步脚本
-- 创建时间: 2025-12-28
-- 说明: 同步本地开发环境的数据库变更到生产环境
-- 执行方式: psql -h host -U user -d database -f sync-to-production-20251228.sql
-- ============================================================

-- ==================== 1. supplier_price_items 表添加缺失字段 ====================
-- 说明：生产环境缺少6个字段

ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS return_point TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS transport_mode TEXT;
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'fixed';
ALTER TABLE supplier_price_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 添加注释
COMMENT ON COLUMN supplier_price_items.country IS '国家';
COMMENT ON COLUMN supplier_price_items.city IS '城市';
COMMENT ON COLUMN supplier_price_items.return_point IS '还柜点';
COMMENT ON COLUMN supplier_price_items.transport_mode IS '运输方式';
COMMENT ON COLUMN supplier_price_items.billing_type IS '计费方式: fixed=固定价格, actual=按实际收费';
COMMENT ON COLUMN supplier_price_items.status IS '状态: active=启用, inactive=停用';

-- ==================== 2. product_fee_items 表添加供应商关联字段 ====================
-- 说明：支持从供应商报价获取成本并设置利润

ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_id TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_price_id INTEGER;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS profit_type TEXT DEFAULT 'amount';
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS profit_value NUMERIC DEFAULT 0;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'fixed';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_product_fee_items_supplier ON product_fee_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_fee_items_supplier_price ON product_fee_items(supplier_price_id);

-- 添加注释
COMMENT ON COLUMN product_fee_items.supplier_id IS '关联的供应商ID';
COMMENT ON COLUMN product_fee_items.supplier_price_id IS '关联的供应商采购价ID';
COMMENT ON COLUMN product_fee_items.cost_price IS '成本价（从供应商报价获取）';
COMMENT ON COLUMN product_fee_items.profit_type IS '利润类型: amount=固定金额, rate=利润率';
COMMENT ON COLUMN product_fee_items.profit_value IS '利润值（金额或百分比）';
COMMENT ON COLUMN product_fee_items.supplier_name IS '供应商名称（冗余字段）';
COMMENT ON COLUMN product_fee_items.billing_type IS '计费类型: fixed=固定价格, actual=按实际收费';

-- ==================== 3. service_fee_categories 表添加层级支持 ====================

ALTER TABLE service_fee_categories ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL;
ALTER TABLE service_fee_categories ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_service_fee_categories_parent ON service_fee_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_service_fee_categories_level ON service_fee_categories(level);

-- 更新现有数据的层级
UPDATE service_fee_categories 
SET level = 1, parent_id = NULL 
WHERE level IS NULL;

-- ==================== 4. 创建费用项审批表 ====================

CREATE TABLE IF NOT EXISTS fee_item_approvals (
  id SERIAL PRIMARY KEY,
  fee_id TEXT,
  fee_name TEXT NOT NULL,
  fee_name_en TEXT,
  category TEXT DEFAULT 'other',
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'EUR',
  unit TEXT DEFAULT '次',
  supplier_id TEXT,
  supplier_name TEXT,
  description TEXT,
  requested_by TEXT,
  requested_by_name TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_by_name TEXT,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  converted_to_price_id INTEGER,
  converted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_status ON fee_item_approvals(status);
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_supplier ON fee_item_approvals(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_fee ON fee_item_approvals(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_requested_by ON fee_item_approvals(requested_by);

COMMENT ON TABLE fee_item_approvals IS '费用项审批表 - 存储手动录入的费用项审批申请';

-- ==================== 5. 创建银行账户表 ====================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id SERIAL PRIMARY KEY,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    bank_branch TEXT,
    swift_code TEXT,
    iban TEXT,
    currency TEXT DEFAULT 'EUR',
    account_type TEXT DEFAULT 'current',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_default ON bank_accounts(is_default);

-- ==================== 6. 创建询价模块表 ====================

-- 客户询价表
CREATE TABLE IF NOT EXISTS customer_inquiries (
    id TEXT PRIMARY KEY,
    inquiry_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    inquiry_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    clearance_data JSONB,
    estimated_duty NUMERIC DEFAULT 0,
    estimated_vat NUMERIC DEFAULT 0,
    estimated_other_tax NUMERIC DEFAULT 0,
    clearance_fee NUMERIC DEFAULT 0,
    transport_data JSONB,
    transport_quote JSONB,
    transport_fee NUMERIC DEFAULT 0,
    total_quote NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    valid_until DATE,
    quoted_at TIMESTAMP,
    quoted_by INTEGER,
    quoted_by_name TEXT,
    crm_opportunity_id TEXT,
    bill_id TEXT,
    attachments JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inquiries_customer ON customer_inquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON customer_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON customer_inquiries(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON customer_inquiries(created_at DESC);

-- 卡车类型配置表
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
);

CREATE INDEX IF NOT EXISTS idx_truck_types_category ON truck_types(category);
CREATE INDEX IF NOT EXISTS idx_truck_types_active ON truck_types(is_active);

-- ==================== 7. 修复空的供应商名称 ====================

UPDATE supplier_price_items spi
SET supplier_name = s.supplier_name, updated_at = NOW()
FROM suppliers s
WHERE spi.supplier_id::text = s.id::text
  AND (spi.supplier_name IS NULL OR spi.supplier_name = '');

UPDATE product_fee_items pfi
SET supplier_name = s.supplier_name, updated_at = NOW()
FROM suppliers s
WHERE pfi.supplier_id::text = s.id::text
  AND (pfi.supplier_name IS NULL OR pfi.supplier_name = '')
  AND pfi.supplier_id IS NOT NULL;

-- ==================== 8. 插入默认卡车类型数据 ====================

INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, axle_count, emission_class, base_rate_per_km, min_charge, sort_order)
SELECT * FROM (VALUES 
    ('VAN_35', '小型厢式车', 'Small Van (3.5t)', 'van', '适合小批量城市配送', 1500, 12, 3.5, 1.8, 1.8, 2, 'EURO6', 1.20, 80, 1),
    ('VAN_75', '中型厢式车', 'Medium Van (7.5t)', 'van', '适合中等货量配送', 3500, 25, 5.5, 2.2, 2.2, 2, 'EURO6', 1.50, 120, 2),
    ('BOX_12', '大型箱式车', 'Box Truck (12t)', 'box', '适合大批量配送', 6000, 45, 7.5, 2.4, 2.5, 2, 'EURO6', 1.80, 180, 3),
    ('BOX_18', '重型箱式车', 'Heavy Box Truck (18t)', 'box', '适合重货运输', 10000, 55, 9.0, 2.45, 2.6, 3, 'EURO6', 2.00, 220, 4),
    ('SEMI_40', '40尺半挂车', 'Semi-trailer (40ft)', 'semi', '标准集装箱运输', 25000, 76, 13.6, 2.45, 2.7, 5, 'EURO6', 2.50, 350, 5),
    ('SEMI_45', '45尺半挂车', 'Semi-trailer (45ft)', 'semi', '大容量集装箱运输', 24000, 90, 13.7, 2.48, 2.75, 5, 'EURO6', 2.70, 400, 6),
    ('REEFER_20', '20尺冷藏车', 'Reefer Truck (20ft)', 'reefer', '冷链运输', 18000, 33, 6.1, 2.44, 2.59, 3, 'EURO6', 3.00, 300, 7),
    ('REEFER_40', '40尺冷藏车', 'Reefer Truck (40ft)', 'reefer', '大型冷链运输', 26000, 67, 12.2, 2.44, 2.59, 5, 'EURO6', 3.50, 450, 8),
    ('FLATBED_40', '40尺平板车', 'Flatbed (40ft)', 'flatbed', '超大件设备运输', 30000, 0, 13.6, 2.5, 0, 5, 'EURO6', 2.80, 400, 9),
    ('HAZMAT', '危险品车', 'Hazmat Truck', 'hazmat', 'ADR危险品运输', 20000, 50, 10.0, 2.45, 2.6, 4, 'EURO6', 4.00, 500, 10)
) AS t(code, name, name_en, category, description, max_weight, max_volume, length, width, height, axle_count, emission_class, base_rate_per_km, min_charge, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM truck_types WHERE truck_types.code = t.code);

-- ==================== 验证同步结果 ====================

SELECT '✅ 同步完成！以下是验证结果：' as message;

-- 验证 supplier_price_items 字段
SELECT 'supplier_price_items 字段数: ' || COUNT(*) as result
FROM information_schema.columns 
WHERE table_name = 'supplier_price_items';

-- 验证 product_fee_items 字段
SELECT 'product_fee_items 字段数: ' || COUNT(*) as result
FROM information_schema.columns 
WHERE table_name = 'product_fee_items';

-- 验证新表
SELECT 'fee_item_approvals 表: ' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_item_approvals') THEN '已创建' ELSE '未创建' END as result;
SELECT 'bank_accounts 表: ' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN '已创建' ELSE '未创建' END as result;
SELECT 'customer_inquiries 表: ' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_inquiries') THEN '已创建' ELSE '未创建' END as result;
SELECT 'truck_types 表: ' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'truck_types') THEN '已创建' ELSE '未创建' END as result;
SELECT 'truck_types 数据量: ' || COUNT(*) as result FROM truck_types;

