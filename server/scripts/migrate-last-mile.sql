-- 最后里程模块数据库迁移脚本
-- 创建时间: 2024-12
-- 功能: 最后里程承运商管理、Zone配置、费率卡、运单管理、结算管理、报价导入

-- ==================== 1. 最后里程承运商表 ====================
CREATE TABLE IF NOT EXISTS last_mile_carriers (
    id SERIAL PRIMARY KEY,
    carrier_code TEXT UNIQUE NOT NULL,           -- 承运商编码，如: DHL, DPD, SCHENKER
    carrier_name TEXT NOT NULL,                  -- 承运商中文名
    carrier_name_en TEXT,                        -- 承运商英文名
    carrier_type TEXT DEFAULT 'express',         -- 类型: express(快递) / trucking(卡车)
    country_code TEXT DEFAULT 'DE',              -- 主要服务国家
    service_region TEXT,                         -- 服务区域描述
    contact_person TEXT,                         -- 联系人
    contact_phone TEXT,                          -- 联系电话
    contact_email TEXT,                          -- 联系邮箱
    website TEXT,                                -- 官网
    api_enabled INTEGER DEFAULT 0,               -- 是否支持API对接: 0=否, 1=是
    api_config JSONB,                            -- API配置信息
    status TEXT DEFAULT 'active',                -- 状态: active/inactive
    remark TEXT,                                 -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_code ON last_mile_carriers(carrier_code);
CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_type ON last_mile_carriers(carrier_type);
CREATE INDEX IF NOT EXISTS idx_last_mile_carriers_status ON last_mile_carriers(status);

-- ==================== 2. Zone配置表 ====================
CREATE TABLE IF NOT EXISTS last_mile_zones (
    id SERIAL PRIMARY KEY,
    carrier_id INTEGER NOT NULL,                 -- 关联承运商ID
    zone_code TEXT NOT NULL,                     -- Zone编码，如: Zone1, Zone2
    zone_name TEXT,                              -- Zone名称
    countries TEXT[],                            -- 包含的国家代码数组
    postal_prefixes TEXT[],                      -- 包含的邮编前缀
    cities TEXT[],                               -- 包含的城市
    description TEXT,                            -- 描述
    sort_order INTEGER DEFAULT 0,                -- 排序
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_last_mile_zones_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_last_mile_zones_carrier ON last_mile_zones(carrier_id);
CREATE INDEX IF NOT EXISTS idx_last_mile_zones_code ON last_mile_zones(zone_code);

-- ==================== 3. 统一费率卡表 ====================
CREATE TABLE IF NOT EXISTS unified_rate_cards (
    id SERIAL PRIMARY KEY,
    rate_card_code TEXT UNIQUE NOT NULL,         -- 费率卡编码
    rate_card_name TEXT NOT NULL,                -- 费率卡名称
    carrier_id INTEGER,                          -- 关联最后里程承运商
    supplier_id TEXT,                            -- 也可关联传统供应商
    rate_type TEXT NOT NULL DEFAULT 'last_mile', -- 类型: last_mile/freight/clearance/other
    service_type TEXT DEFAULT 'standard',        -- 服务类型: standard/express/economy
    valid_from DATE NOT NULL,                    -- 生效日期
    valid_until DATE,                            -- 失效日期
    currency TEXT DEFAULT 'EUR',                 -- 币种
    status TEXT DEFAULT 'active',                -- 状态: active/inactive/expired
    is_default INTEGER DEFAULT 0,                -- 是否默认: 0=否, 1=是
    import_log_id INTEGER,                       -- 关联导入记录
    version INTEGER DEFAULT 1,                   -- 版本号
    remark TEXT,                                 -- 备注
    created_by TEXT,                             -- 创建人
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_unified_rate_cards_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_carrier ON unified_rate_cards(carrier_id);
CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_type ON unified_rate_cards(rate_type);
CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_status ON unified_rate_cards(status);
CREATE INDEX IF NOT EXISTS idx_unified_rate_cards_valid ON unified_rate_cards(valid_from, valid_until);

-- ==================== 4. 费率明细表（重量段+Zone价格） ====================
CREATE TABLE IF NOT EXISTS rate_card_tiers (
    id SERIAL PRIMARY KEY,
    rate_card_id INTEGER NOT NULL,               -- 关联费率卡
    zone_id INTEGER,                             -- 关联Zone（可为空表示通用）
    zone_code TEXT,                              -- Zone编码（冗余字段方便查询）
    weight_from NUMERIC(10,2) NOT NULL,          -- 起始重量(kg)
    weight_to NUMERIC(10,2) NOT NULL,            -- 截止重量(kg)
    purchase_price NUMERIC(10,2),                -- 采购价（成本）
    purchase_min_charge NUMERIC(10,2),           -- 采购最低收费
    sales_price NUMERIC(10,2),                   -- 销售价（对客户报价）
    sales_min_charge NUMERIC(10,2),              -- 销售最低收费
    price_unit TEXT DEFAULT 'per_kg',            -- 计价单位: per_kg/per_shipment/per_pallet
    margin_rate NUMERIC(5,2),                    -- 利润率%
    margin_amount NUMERIC(10,2),                 -- 利润金额
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_card_tiers_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_rate_card_tiers_zone FOREIGN KEY (zone_id) REFERENCES last_mile_zones(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_card_tiers_card ON rate_card_tiers(rate_card_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_tiers_zone ON rate_card_tiers(zone_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_tiers_weight ON rate_card_tiers(weight_from, weight_to);

-- ==================== 5. 附加费表 ====================
CREATE TABLE IF NOT EXISTS rate_card_surcharges (
    id SERIAL PRIMARY KEY,
    rate_card_id INTEGER NOT NULL,               -- 关联费率卡
    surcharge_code TEXT NOT NULL,                -- 附加费编码
    surcharge_name TEXT NOT NULL,                -- 附加费中文名
    surcharge_name_en TEXT,                      -- 附加费英文名
    charge_type TEXT DEFAULT 'fixed',            -- 计费类型: fixed(固定)/percentage(百分比)
    purchase_amount NUMERIC(10,2),               -- 采购成本
    sales_amount NUMERIC(10,2),                  -- 销售价格
    percentage NUMERIC(5,2),                     -- 百分比（如燃油附加费15%）
    is_mandatory INTEGER DEFAULT 0,              -- 是否必收: 0=否, 1=是
    conditions JSONB,                            -- 收费条件
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_card_surcharges_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_card_surcharges_card ON rate_card_surcharges(rate_card_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_surcharges_code ON rate_card_surcharges(surcharge_code);

-- ==================== 6. 运单表（API打单） ====================
CREATE TABLE IF NOT EXISTS last_mile_shipments (
    id SERIAL PRIMARY KEY,
    shipment_no TEXT UNIQUE NOT NULL,            -- 系统运单号
    carrier_id INTEGER,                          -- 关联承运商
    carrier_code TEXT,                           -- 承运商编码
    carrier_tracking_no TEXT,                    -- 承运商运单号
    
    -- 关联业务单据
    bill_id TEXT,                                -- 关联提单ID
    bill_number TEXT,                            -- 关联提单号
    
    -- 发件人信息
    sender_name TEXT,
    sender_company TEXT,
    sender_phone TEXT,
    sender_address TEXT,
    sender_city TEXT,
    sender_postal_code TEXT,
    sender_country TEXT DEFAULT 'DE',
    
    -- 收件人信息
    receiver_name TEXT,
    receiver_company TEXT,
    receiver_phone TEXT,
    receiver_address TEXT,
    receiver_city TEXT,
    receiver_postal_code TEXT,
    receiver_country TEXT,
    
    -- 货物信息
    pieces INTEGER DEFAULT 1,                    -- 件数
    weight NUMERIC(10,2),                        -- 实际重量kg
    volume_weight NUMERIC(10,2),                 -- 体积重kg
    chargeable_weight NUMERIC(10,2),             -- 计费重kg
    dimensions TEXT,                             -- 尺寸 L*W*H
    goods_description TEXT,                      -- 货物描述
    
    -- 服务与费用
    service_type TEXT DEFAULT 'standard',        -- 服务类型
    zone_code TEXT,                              -- 匹配的Zone
    rate_card_id INTEGER,                        -- 使用的费率卡
    purchase_cost NUMERIC(10,2),                 -- 采购成本
    sales_amount NUMERIC(10,2),                  -- 销售金额
    profit_amount NUMERIC(10,2),                 -- 利润
    currency TEXT DEFAULT 'EUR',
    
    -- 状态
    status TEXT DEFAULT 'pending',               -- 状态: pending/created/in_transit/delivered/exception
    label_url TEXT,                              -- 面单URL
    label_data TEXT,                             -- 面单数据(Base64)
    
    -- API记录
    api_request JSONB,                           -- API请求记录
    api_response JSONB,                          -- API响应记录
    
    -- 时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP,                        -- 发货时间
    delivered_at TIMESTAMP,                      -- 送达时间
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_last_mile_shipments_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL,
    CONSTRAINT fk_last_mile_shipments_rate_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_no ON last_mile_shipments(shipment_no);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_carrier ON last_mile_shipments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_tracking ON last_mile_shipments(carrier_tracking_no);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_bill ON last_mile_shipments(bill_id);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_status ON last_mile_shipments(status);
CREATE INDEX IF NOT EXISTS idx_last_mile_shipments_created ON last_mile_shipments(created_at);

-- ==================== 7. 运单轨迹表 ====================
CREATE TABLE IF NOT EXISTS last_mile_tracking (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL,                -- 关联运单
    tracking_no TEXT,                            -- 运单号
    event_time TIMESTAMP,                        -- 事件时间
    event_code TEXT,                             -- 事件代码
    event_description TEXT,                      -- 事件描述
    event_location TEXT,                         -- 事件地点
    raw_data JSONB,                              -- 原始数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_last_mile_tracking_shipment FOREIGN KEY (shipment_id) REFERENCES last_mile_shipments(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_last_mile_tracking_shipment ON last_mile_tracking(shipment_id);
CREATE INDEX IF NOT EXISTS idx_last_mile_tracking_no ON last_mile_tracking(tracking_no);
CREATE INDEX IF NOT EXISTS idx_last_mile_tracking_time ON last_mile_tracking(event_time);

-- ==================== 8. 承运商结算表（财务模块） ====================
CREATE TABLE IF NOT EXISTS carrier_settlements (
    id SERIAL PRIMARY KEY,
    settlement_no TEXT UNIQUE NOT NULL,          -- 结算单号
    carrier_id INTEGER NOT NULL,                 -- 关联承运商
    carrier_name TEXT,                           -- 承运商名称
    
    -- 结算周期
    period_start DATE NOT NULL,                  -- 结算开始日期
    period_end DATE NOT NULL,                    -- 结算结束日期
    
    -- 金额汇总
    total_shipments INTEGER DEFAULT 0,           -- 运单数量
    total_weight NUMERIC(12,2),                  -- 总重量
    carrier_bill_amount NUMERIC(12,2),           -- 承运商账单金额（应付）
    system_calc_amount NUMERIC(12,2),            -- 系统计算金额
    difference_amount NUMERIC(12,2),             -- 差异金额
    currency TEXT DEFAULT 'EUR',
    
    -- 核对状态
    reconcile_status TEXT DEFAULT 'pending',     -- 核对状态: pending/reconciling/confirmed/disputed
    reconciled_at TIMESTAMP,                     -- 核对时间
    reconciled_by TEXT,                          -- 核对人
    
    -- 付款状态
    payment_status TEXT DEFAULT 'unpaid',        -- 付款状态: unpaid/partial/paid
    paid_amount NUMERIC(12,2),                   -- 已付金额
    paid_at TIMESTAMP,                           -- 付款时间
    
    -- 附件
    carrier_invoice_url TEXT,                    -- 承运商发票
    attachments JSONB,                           -- 其他附件
    
    remark TEXT,                                 -- 备注
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_carrier_settlements_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE RESTRICT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_carrier_settlements_no ON carrier_settlements(settlement_no);
CREATE INDEX IF NOT EXISTS idx_carrier_settlements_carrier ON carrier_settlements(carrier_id);
CREATE INDEX IF NOT EXISTS idx_carrier_settlements_period ON carrier_settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_carrier_settlements_reconcile ON carrier_settlements(reconcile_status);
CREATE INDEX IF NOT EXISTS idx_carrier_settlements_payment ON carrier_settlements(payment_status);

-- ==================== 9. 结算明细表 ====================
CREATE TABLE IF NOT EXISTS carrier_settlement_items (
    id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL,              -- 关联结算单
    shipment_id INTEGER,                         -- 关联运单
    tracking_no TEXT,                            -- 运单号
    ship_date DATE,                              -- 发货日期
    
    -- 承运商数据
    carrier_weight NUMERIC(10,2),                -- 承运商重量
    carrier_amount NUMERIC(10,2),                -- 承运商金额
    
    -- 系统数据
    system_weight NUMERIC(10,2),                 -- 系统重量
    system_amount NUMERIC(10,2),                 -- 系统金额
    
    -- 差异
    weight_diff NUMERIC(10,2),                   -- 重量差异
    amount_diff NUMERIC(10,2),                   -- 金额差异
    
    -- 状态
    status TEXT DEFAULT 'pending',               -- 状态: pending/matched/disputed/adjusted
    adjust_amount NUMERIC(10,2),                 -- 调整金额
    adjust_reason TEXT,                          -- 调整原因
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_carrier_settlement_items_settlement FOREIGN KEY (settlement_id) REFERENCES carrier_settlements(id) ON DELETE CASCADE,
    CONSTRAINT fk_carrier_settlement_items_shipment FOREIGN KEY (shipment_id) REFERENCES last_mile_shipments(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_carrier_settlement_items_settlement ON carrier_settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_carrier_settlement_items_shipment ON carrier_settlement_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_carrier_settlement_items_tracking ON carrier_settlement_items(tracking_no);

-- ==================== 10. 导入模板表 ====================
CREATE TABLE IF NOT EXISTS rate_import_templates (
    id SERIAL PRIMARY KEY,
    carrier_id INTEGER,                          -- 关联承运商
    template_name TEXT NOT NULL,                 -- 模板名称
    template_code TEXT UNIQUE,                   -- 模板编码
    
    -- 文件格式配置
    file_type TEXT DEFAULT 'excel',              -- 文件类型: excel/pdf/csv
    sheet_name TEXT,                             -- Excel工作表名
    header_row INTEGER DEFAULT 1,                -- 表头行号
    data_start_row INTEGER DEFAULT 2,            -- 数据起始行
    
    -- 列映射配置
    column_mapping JSONB,                        -- 列映射配置
    -- 示例: {"zone_column": "A", "weight_from_column": "B", ...}
    
    -- 数据解析配置
    parse_config JSONB,                          -- 解析配置
    -- 示例: {"layout": "matrix", "weight_unit": "kg", "currency": "EUR"}
    
    -- 预处理规则
    preprocess_rules JSONB,                      -- 预处理规则
    -- 示例: [{"type": "skip_empty_rows"}, {"type": "trim_whitespace"}]
    
    is_active INTEGER DEFAULT 1,                 -- 是否启用
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_rate_import_templates_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_import_templates_carrier ON rate_import_templates(carrier_id);
CREATE INDEX IF NOT EXISTS idx_rate_import_templates_code ON rate_import_templates(template_code);

-- ==================== 11. 导入记录表 ====================
CREATE TABLE IF NOT EXISTS rate_import_logs (
    id SERIAL PRIMARY KEY,
    carrier_id INTEGER,                          -- 关联承运商
    template_id INTEGER,                         -- 关联模板
    rate_card_id INTEGER,                        -- 关联生成的费率卡
    
    -- 文件信息
    file_name TEXT,                              -- 文件名
    file_url TEXT,                               -- 文件URL
    file_type TEXT,                              -- 文件类型
    
    -- 导入结果
    status TEXT DEFAULT 'pending',               -- 状态: pending/parsing/preview/confirmed/failed
    total_rows INTEGER,                          -- 总行数
    success_rows INTEGER,                        -- 成功行数
    failed_rows INTEGER,                         -- 失败行数
    
    -- 解析数据
    parsed_data JSONB,                           -- 解析后的数据（预览用）
    error_details JSONB,                         -- 错误详情
    
    -- 操作人
    imported_by TEXT,                            -- 导入人
    confirmed_by TEXT,                           -- 确认人
    confirmed_at TIMESTAMP,                      -- 确认时间
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_rate_import_logs_carrier FOREIGN KEY (carrier_id) REFERENCES last_mile_carriers(id) ON DELETE SET NULL,
    CONSTRAINT fk_rate_import_logs_template FOREIGN KEY (template_id) REFERENCES rate_import_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_rate_import_logs_rate_card FOREIGN KEY (rate_card_id) REFERENCES unified_rate_cards(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_import_logs_carrier ON rate_import_logs(carrier_id);
CREATE INDEX IF NOT EXISTS idx_rate_import_logs_status ON rate_import_logs(status);
CREATE INDEX IF NOT EXISTS idx_rate_import_logs_created ON rate_import_logs(created_at);

-- ==================== 初始化常用承运商数据 ====================

-- DHL
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES ('DHL', 'DHL快递', 'DHL Express', 'express', 'DE', 'https://www.dhl.de', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

-- DPD
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES ('DPD', 'DPD快递', 'DPD', 'express', 'DE', 'https://www.dpd.com', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

-- UPS
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES ('UPS', 'UPS快递', 'UPS', 'express', 'US', 'https://www.ups.com', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

-- GLS
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES ('GLS', 'GLS快递', 'GLS', 'express', 'DE', 'https://www.gls-group.eu', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

-- DB Schenker
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES ('SCHENKER', '申克物流', 'DB Schenker', 'trucking', 'DE', 'https://www.dbschenker.com', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

-- Hermes
INSERT INTO last_mile_carriers (carrier_code, carrier_name, carrier_name_en, carrier_type, country_code, website, status)
VALUES ('HERMES', 'Hermes快递', 'Hermes', 'express', 'DE', 'https://www.myhermes.de', 'active')
ON CONFLICT (carrier_code) DO NOTHING;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '最后里程模块数据库迁移完成！';
    RAISE NOTICE '已创建表: last_mile_carriers, last_mile_zones, unified_rate_cards, rate_card_tiers, rate_card_surcharges';
    RAISE NOTICE '已创建表: last_mile_shipments, last_mile_tracking, carrier_settlements, carrier_settlement_items';
    RAISE NOTICE '已创建表: rate_import_templates, rate_import_logs';
    RAISE NOTICE '已初始化常用承运商: DHL, DPD, UPS, GLS, Schenker, Hermes';
END $$;
