-- 敏感产品和查验产品库迁移脚本
-- 创建时间: 2026-01-05
-- 用于存储高敏感/反倾销产品和海关查验产品

-- 1. 创建敏感产品库表（高敏感/反倾销产品）
CREATE TABLE IF NOT EXISTS sensitive_products (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100),               -- 大类（如：纺织品、玩具/运动类、机械电气类等）
    product_name VARCHAR(255) NOT NULL,  -- 品名
    hs_code VARCHAR(255),                -- HS归类参考（可能是多个编码或章节）
    duty_rate VARCHAR(100),              -- 税率（可能是范围）
    duty_rate_min DECIMAL(10, 4),        -- 最低税率（解析后）
    duty_rate_max DECIMAL(10, 4),        -- 最高税率（解析后）
    product_type VARCHAR(50) DEFAULT 'sensitive',  -- 产品类型: sensitive(敏感产品), anti_dumping(反倾销)
    risk_level VARCHAR(20) DEFAULT 'high',         -- 风险等级: high, medium, low
    risk_notes TEXT,                     -- 风险说明
    is_active BOOLEAN DEFAULT true,      -- 是否启用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建查验产品库表（海关查验产品）
CREATE TABLE IF NOT EXISTS inspection_products (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,  -- 品名
    hs_code VARCHAR(20),                 -- HS编码（10位精确编码）
    duty_rate DECIMAL(10, 4) DEFAULT 0,  -- 税率
    inspection_rate DECIMAL(5, 2),       -- 查验率（如果有历史数据）
    risk_level VARCHAR(20) DEFAULT 'medium', -- 风险等级
    risk_notes TEXT,                     -- 风险说明
    is_active BOOLEAN DEFAULT true,      -- 是否启用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_sensitive_products_hs_code ON sensitive_products(hs_code);
CREATE INDEX IF NOT EXISTS idx_sensitive_products_category ON sensitive_products(category);
CREATE INDEX IF NOT EXISTS idx_sensitive_products_name ON sensitive_products(product_name);
CREATE INDEX IF NOT EXISTS idx_sensitive_products_type ON sensitive_products(product_type);

CREATE INDEX IF NOT EXISTS idx_inspection_products_hs_code ON inspection_products(hs_code);
CREATE INDEX IF NOT EXISTS idx_inspection_products_name ON inspection_products(product_name);

-- 4. 插入高敏感/反倾销产品数据
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level) VALUES
-- 纺织品类
('纺织品', '帐篷', '6306', '12%', 0.12, 0.12, 'sensitive', 'high'),
('纺织品', '披肩/围巾/面纱', '6117100000', '12%', 0.12, 0.12, 'sensitive', 'high'),
('纺织品', '窗帘', '6303', '12%', 0.12, 0.12, 'sensitive', 'high'),
('纺织品', '鞋', '6402、6403', '17%', 0.17, 0.17, 'sensitive', 'high'),
('纺织品', '地毯', '57章、6301', '3%-12%', 0.03, 0.12, 'sensitive', 'high'),
('纺织品', '汽车罩', '6306、6307', '12%', 0.12, 0.12, 'sensitive', 'high'),
('纺织品', '蚊帐', '6304', '12%', 0.12, 0.12, 'sensitive', 'high'),
('纺织品', '行李箱', '4202', '3%-9.7%', 0.03, 0.097, 'sensitive', 'high'),
('纺织品', '背包', '4202', '3%-9.7%', 0.03, 0.097, 'sensitive', 'high'),
('纺织品', '服装', '6114、6211', '12%', 0.12, 0.12, 'sensitive', 'high'),
('纺织品', '雨伞', '66011、66019', '4.7%', 0.047, 0.047, 'sensitive', 'high'),
('纺织品', '毛巾', '6302', '12%', 0.12, 0.12, 'sensitive', 'high'),

-- 玩具/运动类
('玩具/运动类', '遥控车', '9503001000', '0%', 0, 0, 'sensitive', 'medium'),
('玩具/运动类', '圣诞饰品/圣诞树', '9505109000', '2.7%', 0.027, 0.027, 'sensitive', 'medium'),

-- 机械电气类
('机械电气类', '电池', '8507', '0%-3.7%', 0, 0.037, 'sensitive', 'high'),
('机械电气类', '便携式电源站', '8507600090', '2.7%', 0.027, 0.027, 'sensitive', 'high'),
('机械电气类', '充气泵', '8414208090', '2.2%', 0.022, 0.022, 'sensitive', 'medium'),
('机械电气类', '链锯', '8467221000', '2.7%', 0.027, 0.027, 'sensitive', 'medium'),

-- 贱金属类
('贱金属类', '晶体硅光伏组件', '8541430000', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '烫衣板', '7323990010', '3.2%', 0.032, 0.032, 'sensitive', 'medium'),
('贱金属类', '螺丝钉/螺母', '7318', '3.7%', 0.037, 0.037, 'anti_dumping', 'high'),
('贱金属类', '冷轧钢板', '7209', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '热轧板材', '7208、7211、7225', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '活页夹金属配件', '830510', '2.7%', 0.027, 0.027, 'sensitive', 'medium'),
('贱金属类', '热轧钢板桩', '7301100000', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '钼丝', '810296', '6.1%', 0.061, 0.061, 'anti_dumping', 'high'),
('贱金属类', '钨电极', '8101991000', '0%-6%', 0, 0.06, 'anti_dumping', 'high'),
('贱金属类', '铸铁制品', '73251000', '1.7%', 0.017, 0.017, 'sensitive', 'medium'),
('贱金属类', '铜版纸', '48101300、48101400、48101900、48102200、48102930、48102980、48109910和48109980', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '成卷铝箔', '7607', '7.5%', 0.075, 0.075, 'anti_dumping', 'high'),
('贱金属类', '无缝钢铁管', '7304', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '钢丝绳/钢缆', '731210', '0%', 0, 0, 'anti_dumping', 'high'),
('贱金属类', '铝散热器', '7615、7616', '6%', 0.06, 0.06, 'sensitive', 'high'),

-- 塑料/橡胶类
('塑料/橡胶类', '一次性塑料袋', '3923291000', '6.5%', 0.065, 0.065, 'sensitive', 'medium'),
('塑料/橡胶类', '保鲜膜', '3920', '0%-6.5%', 0, 0.065, 'sensitive', 'medium'),

-- 运输/运输配件类
('运输/运输配件类', '摩托车', '8711', '6%-8%', 0.06, 0.08, 'sensitive', 'high'),
('运输/运输配件类', '自行车', '8712', '14%-15%', 0.14, 0.15, 'anti_dumping', 'high'),
('运输/运输配件类', '残疾人专用车', '8713900000', '0%', 0, 0, 'sensitive', 'medium'),
('运输/运输配件类', '轮胎', '4011', '0%-4.5%', 0, 0.045, 'sensitive', 'high'),
('运输/运输配件类', '汽车包围', '8708', '3%-4.5%', 0.03, 0.045, 'sensitive', 'high'),
('运输/运输配件类', '保险杠', '870810条', '3%-4.5%', 0.03, 0.045, 'sensitive', 'high'),
('运输/运输配件类', '车身零件', '8708', '3%-4.5%', 0.03, 0.045, 'sensitive', 'high'),
('运输/运输配件类', '手动叉车及其主要配件', '84279000', '4%', 0.04, 0.04, 'sensitive', 'medium'),
('运输/运输配件类', '轮毂', '8708', '3%-4.5%', 0.03, 0.045, 'sensitive', 'high'),

-- 纸制品
('纸制品', '铜版纸', '481013', '0%', 0, 0, 'anti_dumping', 'high'),
('纸制品', '标签纸（自粘剂）', '4821901000', '0%', 0, 0, 'sensitive', 'medium'),

-- 陶瓷类
('陶瓷类', '普通陶瓷餐具', '6912002199', '5%', 0.05, 0.05, 'anti_dumping', 'high'),
('陶瓷类', '瓷砖', '6907', '5%', 0.05, 0.05, 'anti_dumping', 'high'),
('陶瓷类', '瓦片', '6905', '0%', 0, 0, 'sensitive', 'medium'),
('陶瓷类', '浴缸', '6910100000', '7%', 0.07, 0.07, 'sensitive', 'high'),
('陶瓷类', '马桶', '6910100000', '7%', 0.07, 0.07, 'sensitive', 'high'),

-- 木制品
('木制品', '组装地板', '4418790000', '0%', 0, 0, 'sensitive', 'medium'),
('木制品', '胶合板', '44123110', '6%-10%', 0.06, 0.10, 'anti_dumping', 'high'),

-- 化工产品类
('化工产品类', '蜡烛', '3406000000', '0%', 0, 0, 'anti_dumping', 'high'),
('化工产品类', '胶水', '3506', '0%-6.5%', 0, 0.065, 'sensitive', 'medium'),
('化工产品类', '稀有气体', '2804', '0%-5.5%', 0, 0.055, 'sensitive', 'medium'),
('化工产品类', '草酸', '29171100', '6.5%', 0.065, 0.065, 'anti_dumping', 'high'),
('化工产品类', '沐浴露', '3401300000', '4%', 0.04, 0.04, 'sensitive', 'medium'),
('化工产品类', '洗衣液', '340250、340290', '4%', 0.04, 0.04, 'sensitive', 'medium'),
('化工产品类', '肥皂', '3401190000', '0%', 0, 0, 'sensitive', 'low'),
('化工产品类', '喷雾', '961610条', '2.7%', 0.027, 0.027, 'sensitive', 'medium'),
('化工产品类', '酒石酸', '2918120000', '6.5%', 0.065, 0.065, 'anti_dumping', 'high'),
('化工产品类', '护肤品/彩妆', '3304', '0%', 0, 0, 'sensitive', 'high'),
('化工产品类', '过硫酸盐', '28334000、28429080', '5.5%', 0.055, 0.055, 'sensitive', 'medium'),

-- 玻璃制品
('玻璃制品', '玻璃纤维网格织布', '7019', '7%', 0.07, 0.07, 'anti_dumping', 'high'),

-- 毛皮类
('毛皮类', '油鞣革', '411410', '2.5%', 0.025, 0.025, 'sensitive', 'medium'),

-- 食品类
('食品类', '所有', '所有', '/', NULL, NULL, 'sensitive', 'high');

-- 5. 插入海关查验产品数据
INSERT INTO inspection_products (product_name, hs_code, duty_rate, risk_level) VALUES
('喷墨打印机', '8443328000', 0, 'high'),
('展示架', '9403208000', 0, 'high'),
('金属工具柜', '9403208000', 0, 'high'),
('动物监护仓', '9031808000', 0, 'medium'),
('空气源热泵', '8418610099', 0, 'high'),
('解压玩具', '9503009990', 0, 'medium'),
('对讲立柱', '8517140000', 0, 'medium'),
('新风换气机', '8414510090', 0.032, 'medium'),
('冷媒机', '9031808000', 0, 'medium'),
('降压线', '8544421000', 0, 'medium');

-- 6. 添加注释
COMMENT ON TABLE sensitive_products IS '敏感产品库 - 存储高敏感/反倾销产品信息';
COMMENT ON COLUMN sensitive_products.category IS '产品大类（如：纺织品、机械电气类等）';
COMMENT ON COLUMN sensitive_products.product_type IS '产品类型: sensitive(敏感产品), anti_dumping(反倾销)';
COMMENT ON COLUMN sensitive_products.risk_level IS '风险等级: high(高), medium(中), low(低)';

COMMENT ON TABLE inspection_products IS '查验产品库 - 存储海关高查验率产品信息';
COMMENT ON COLUMN inspection_products.inspection_rate IS '历史查验率百分比';

