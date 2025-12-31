-- 询价模块数据库表
-- 创建时间: 2025-12-25
-- 用途: 客户门户询价功能，对接CRM、单证、TMS

-- ==================== 客户询价表 ====================
CREATE TABLE IF NOT EXISTS customer_inquiries (
    id TEXT PRIMARY KEY,
    inquiry_number TEXT UNIQUE NOT NULL,      -- 询价编号 INQ20250001
    customer_id TEXT NOT NULL,                -- 客户ID
    customer_name TEXT,
    inquiry_type TEXT NOT NULL,               -- clearance/transport/combined
    status TEXT DEFAULT 'pending',            -- pending/quoted/accepted/rejected/expired
    
    -- 清关询价字段
    clearance_data JSONB,                     -- 货物信息、HS CODE等
    estimated_duty NUMERIC DEFAULT 0,         -- 预估关税
    estimated_vat NUMERIC DEFAULT 0,          -- 预估增值税
    estimated_other_tax NUMERIC DEFAULT 0,    -- 预估其他税费（反倾销等）
    clearance_fee NUMERIC DEFAULT 0,          -- 清关费用报价
    
    -- 运输询价字段
    transport_data JSONB,                     -- 起点、终点、多点卸货等
    transport_quote JSONB,                    -- HERE API返回的路线和费用
    transport_fee NUMERIC DEFAULT 0,          -- 运输费用报价
    
    -- 报价信息
    total_quote NUMERIC DEFAULT 0,            -- 总报价
    currency TEXT DEFAULT 'EUR',              -- 货币
    valid_until DATE,                         -- 有效期
    quoted_at TIMESTAMP,                      -- 报价时间
    quoted_by INTEGER,                        -- 报价人ID
    quoted_by_name TEXT,                      -- 报价人姓名
    
    -- 关联字段
    crm_opportunity_id TEXT,                  -- 关联CRM商机
    bill_id TEXT,                             -- 下单后关联的提单
    
    -- 附件
    attachments JSONB DEFAULT '[]',           -- 上传的文件列表
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inquiries_customer ON customer_inquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON customer_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON customer_inquiries(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON customer_inquiries(created_at DESC);

-- ==================== 卡车类型配置表 ====================
CREATE TABLE IF NOT EXISTS truck_types (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,                -- 类型代码 VAN_35
    name TEXT NOT NULL,                       -- 中文名称
    name_en TEXT,                             -- 英文名称
    category TEXT NOT NULL,                   -- 类别: van/box/semi/reefer/flatbed/hazmat
    description TEXT,                         -- 描述
    
    -- 载重和容积
    max_weight NUMERIC NOT NULL,              -- 最大载重(kg)
    max_volume NUMERIC,                       -- 最大容积(m³)
    
    -- 车辆尺寸(米)
    length NUMERIC NOT NULL,                  -- 长
    width NUMERIC NOT NULL,                   -- 宽  
    height NUMERIC NOT NULL,                  -- 高
    
    -- 车辆属性
    axle_count INTEGER DEFAULT 2,             -- 车轴数
    emission_class TEXT DEFAULT 'EURO6',      -- 排放等级
    
    -- 费率
    base_rate_per_km NUMERIC NOT NULL,        -- 基础运费/公里(EUR)
    min_charge NUMERIC DEFAULT 0,             -- 最低收费
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_truck_types_category ON truck_types(category);
CREATE INDEX IF NOT EXISTS idx_truck_types_active ON truck_types(is_active);

-- ==================== 插入默认卡车类型数据 ====================
INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, axle_count, emission_class, base_rate_per_km, min_charge, sort_order)
VALUES 
    -- 厢式车
    ('VAN_35', '小型厢式车', 'Small Van (3.5t)', 'van', '适合小批量城市配送', 1500, 12, 3.5, 1.8, 1.8, 2, 'EURO6', 1.20, 80, 1),
    ('VAN_75', '中型厢式车', 'Medium Van (7.5t)', 'van', '适合中等货量配送', 3500, 25, 5.5, 2.2, 2.2, 2, 'EURO6', 1.50, 120, 2),
    
    -- 箱式货车
    ('BOX_12', '大型箱式车', 'Box Truck (12t)', 'box', '适合大批量配送', 6000, 45, 7.5, 2.4, 2.5, 2, 'EURO6', 1.80, 180, 3),
    ('BOX_18', '重型箱式车', 'Heavy Box Truck (18t)', 'box', '适合重货运输', 10000, 55, 9.0, 2.45, 2.6, 3, 'EURO6', 2.00, 220, 4),
    
    -- 半挂车
    ('SEMI_40', '标准半挂车', 'Standard Semi-trailer (40t)', 'semi', '欧洲标准长途运输', 24000, 80, 13.6, 2.45, 2.7, 5, 'EURO6', 2.20, 350, 5),
    ('SEMI_MEGA', '超大容量挂车', 'Mega Trailer', 'semi', '超大容积，适合轻泡货', 24000, 100, 13.6, 2.45, 3.0, 5, 'EURO6', 2.40, 400, 6),
    
    -- 冷藏车
    ('REEFER_75', '小型冷藏车', 'Small Reefer (7.5t)', 'reefer', '适合小批量冷链配送', 3000, 20, 5.5, 2.2, 2.2, 2, 'EURO6', 2.00, 150, 7),
    ('REEFER_40', '大型冷藏车', 'Large Reefer (40t)', 'reefer', '长途冷链运输', 22000, 70, 13.6, 2.45, 2.6, 5, 'EURO6', 3.00, 500, 8),
    
    -- 平板车
    ('FLATBED_40', '标准平板车', 'Flatbed Trailer', 'flatbed', '适合机械设备、钢材等', 26000, NULL, 13.6, 2.45, 0, 5, 'EURO6', 2.00, 350, 9),
    ('FLATBED_LOW', '低平板车', 'Low-loader Trailer', 'flatbed', '适合超高设备运输', 30000, NULL, 13.6, 2.55, 0, 6, 'EURO6', 2.50, 450, 10),
    
    -- 危险品车
    ('HAZMAT_40', '危险品运输车', 'Hazmat Truck (40t)', 'hazmat', 'ADR认证，适合化学品等', 22000, 75, 13.6, 2.45, 2.7, 5, 'EURO6', 3.50, 600, 11),
    ('HAZMAT_TANK', '危险品罐车', 'Hazmat Tank Truck', 'hazmat', '液体危险品运输', 25000, 30000, 13.6, 2.5, 3.0, 5, 'EURO6', 4.00, 700, 12)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    max_weight = EXCLUDED.max_weight,
    max_volume = EXCLUDED.max_volume,
    length = EXCLUDED.length,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    axle_count = EXCLUDED.axle_count,
    emission_class = EXCLUDED.emission_class,
    base_rate_per_km = EXCLUDED.base_rate_per_km,
    min_charge = EXCLUDED.min_charge,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

-- ==================== 添加序号到序列管理表 ====================
INSERT INTO order_sequences (business_type, current_seq, prefix, description)
VALUES ('inquiry', 0, 'INQ', '客户询价编号')
ON CONFLICT (business_type) DO NOTHING;

