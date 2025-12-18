-- ============================================================
-- 数据库 Schema 更新脚本
-- 适用于：生产环境 + 演示环境
-- 执行方式：psql -h host -U user -d database -f 01-schema-update.sql
-- ============================================================

-- ==================== 1. 产品表（应收费用基础） ====================
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
);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ==================== 2. 产品费用项表 ====================
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
);

CREATE INDEX IF NOT EXISTS idx_product_fee_items_product ON product_fee_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_fee_items_category ON product_fee_items(fee_category);

-- ==================== 3. 供应商报价表 ====================
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
);

CREATE INDEX IF NOT EXISTS idx_supplier_price_supplier ON supplier_price_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_category ON supplier_price_items(fee_category);
CREATE INDEX IF NOT EXISTS idx_supplier_price_batch ON supplier_price_items(import_batch_id);

-- ==================== 4. 报价导入记录表 ====================
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
);

CREATE INDEX IF NOT EXISTS idx_import_records_supplier ON import_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_records_status ON import_records(status);

-- ==================== 5. fees 表新增字段 ====================
DO $$ 
BEGIN
    -- 添加 fee_type 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fees' AND column_name = 'fee_type') THEN
        ALTER TABLE fees ADD COLUMN fee_type TEXT DEFAULT 'receivable';
        RAISE NOTICE '✅ fees 表添加 fee_type 字段';
    END IF;
    
    -- 添加 supplier_id 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fees' AND column_name = 'supplier_id') THEN
        ALTER TABLE fees ADD COLUMN supplier_id TEXT;
        RAISE NOTICE '✅ fees 表添加 supplier_id 字段';
    END IF;
    
    -- 添加 supplier_name 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'fees' AND column_name = 'supplier_name') THEN
        ALTER TABLE fees ADD COLUMN supplier_name TEXT;
        RAISE NOTICE '✅ fees 表添加 supplier_name 字段';
    END IF;
END $$;

-- ==================== 6. payments 表新增字段 ====================
DO $$ 
BEGIN
    -- 添加 receipt_url 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' AND column_name = 'receipt_url') THEN
        ALTER TABLE payments ADD COLUMN receipt_url TEXT;
        RAISE NOTICE '✅ payments 表添加 receipt_url 字段';
    END IF;
END $$;

-- ==================== 7. 创建费用类型索引 ====================
CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(fee_type);
CREATE INDEX IF NOT EXISTS idx_fees_supplier ON fees(supplier_id);

-- ==================== 完成提示 ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ Schema 更新完成！';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '新建表：';
    RAISE NOTICE '  - products (产品表)';
    RAISE NOTICE '  - product_fee_items (产品费用项表)';
    RAISE NOTICE '  - supplier_price_items (供应商报价表)';
    RAISE NOTICE '  - import_records (导入记录表)';
    RAISE NOTICE '';
    RAISE NOTICE '更新表：';
    RAISE NOTICE '  - fees: 新增 fee_type, supplier_id, supplier_name';
    RAISE NOTICE '  - payments: 新增 receipt_url';
    RAISE NOTICE '============================================================';
END $$;
