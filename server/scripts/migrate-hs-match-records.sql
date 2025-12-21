-- ==================== HS匹配记录表 ====================
-- 用于记录已匹配的商品信息，方便后续快速匹配和申报参考
-- 创建时间: 2024-12-20

-- 匹配记录主表
CREATE TABLE IF NOT EXISTS hs_match_records (
    id SERIAL PRIMARY KEY,
    
    -- 商品基本信息
    product_name TEXT NOT NULL,                    -- 中文品名
    product_name_en TEXT,                          -- 英文品名
    hs_code TEXT NOT NULL,                         -- 匹配的HS编码
    material TEXT,                                 -- 材质（中文）
    material_en TEXT,                              -- 材质（英文）
    
    -- 申报信息
    origin_country TEXT DEFAULT 'CN',              -- 原产国
    origin_country_code TEXT DEFAULT 'CN',         -- 原产国代码
    
    -- 价格统计
    avg_unit_price NUMERIC DEFAULT 0,              -- 平均单价（€/件）
    avg_kg_price NUMERIC DEFAULT 0,                -- 平均公斤价（€/kg）
    min_unit_price NUMERIC DEFAULT 0,              -- 最低单价
    max_unit_price NUMERIC DEFAULT 0,              -- 最高单价
    total_declared_value NUMERIC DEFAULT 0,        -- 累计申报货值
    total_declared_qty INTEGER DEFAULT 0,          -- 累计申报数量
    total_declared_weight NUMERIC DEFAULT 0,       -- 累计申报重量（kg）
    
    -- 税率信息（匹配时的税率快照）
    duty_rate NUMERIC DEFAULT 0,                   -- 关税率
    vat_rate NUMERIC DEFAULT 19,                   -- 增值税率
    anti_dumping_rate NUMERIC DEFAULT 0,           -- 反倾销税率
    countervailing_rate NUMERIC DEFAULT 0,         -- 反补贴税率
    
    -- 使用统计
    match_count INTEGER DEFAULT 1,                 -- 匹配次数
    last_match_time TIMESTAMP,                     -- 最近匹配时间
    first_match_time TIMESTAMP,                    -- 首次匹配时间
    
    -- 关联信息
    customer_id INTEGER,                           -- 关联客户ID（可选）
    customer_name TEXT,                            -- 客户名称
    
    -- 备注
    remarks TEXT,                                  -- 备注
    
    -- 状态
    status TEXT DEFAULT 'active',                  -- 状态: active, archived
    is_verified INTEGER DEFAULT 0,                 -- 是否已人工核实
    verified_by TEXT,                              -- 核实人
    verified_at TIMESTAMP,                         -- 核实时间
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 匹配记录申报历史表（记录每次申报的详细信息）
CREATE TABLE IF NOT EXISTS hs_declaration_history (
    id SERIAL PRIMARY KEY,
    match_record_id INTEGER NOT NULL REFERENCES hs_match_records(id) ON DELETE CASCADE,
    
    -- 申报详情
    import_id INTEGER,                             -- 关联导入批次ID
    import_no TEXT,                                -- 导入批次号
    cargo_item_id INTEGER,                         -- 关联货物明细ID
    
    -- 本次申报信息
    declared_qty INTEGER DEFAULT 0,                -- 申报数量
    declared_weight NUMERIC DEFAULT 0,             -- 申报重量（kg）
    declared_value NUMERIC DEFAULT 0,              -- 申报货值
    unit_price NUMERIC DEFAULT 0,                  -- 单价
    kg_price NUMERIC DEFAULT 0,                    -- 公斤价
    
    -- 税费信息
    duty_amount NUMERIC DEFAULT 0,                 -- 关税金额
    vat_amount NUMERIC DEFAULT 0,                  -- 增值税金额
    other_tax_amount NUMERIC DEFAULT 0,            -- 其他税金额
    total_tax NUMERIC DEFAULT 0,                   -- 总税费
    
    -- 时间
    declared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_hs_match_records_product_name ON hs_match_records(product_name);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_hs_code ON hs_match_records(hs_code);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_material ON hs_match_records(material);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_customer ON hs_match_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_hs_match_records_status ON hs_match_records(status);
CREATE INDEX IF NOT EXISTS idx_hs_declaration_history_record_id ON hs_declaration_history(match_record_id);
CREATE INDEX IF NOT EXISTS idx_hs_declaration_history_import_id ON hs_declaration_history(import_id);

-- 创建全文搜索索引（用于快速匹配）
CREATE INDEX IF NOT EXISTS idx_hs_match_records_fulltext ON hs_match_records 
    USING gin(to_tsvector('simple', COALESCE(product_name, '') || ' ' || COALESCE(product_name_en, '') || ' ' || COALESCE(material, '')));

COMMENT ON TABLE hs_match_records IS 'HS编码匹配记录表 - 记录已匹配的商品信息';
COMMENT ON TABLE hs_declaration_history IS 'HS匹配申报历史表 - 记录每次申报的详细信息';

COMMENT ON COLUMN hs_match_records.product_name IS '中文品名';
COMMENT ON COLUMN hs_match_records.hs_code IS '匹配的HS编码';
COMMENT ON COLUMN hs_match_records.avg_unit_price IS '平均单价（€/件）';
COMMENT ON COLUMN hs_match_records.avg_kg_price IS '平均公斤价（€/kg）';
COMMENT ON COLUMN hs_match_records.match_count IS '匹配次数，用于统计热门商品';
