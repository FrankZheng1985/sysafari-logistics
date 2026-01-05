-- ==================== 阿里云数据库迁移脚本 ====================
-- 敏感产品库和海关查验产品库
-- 执行方式: psql -h <host> -U <user> -d <database> -f aliyun-migrate-sensitive-products.sql

-- 1. 创建敏感产品表
CREATE TABLE IF NOT EXISTS sensitive_products (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    product_name TEXT NOT NULL,
    hs_code TEXT NOT NULL,
    duty_rate TEXT,
    duty_rate_min NUMERIC(10,4),
    duty_rate_max NUMERIC(10,4),
    product_type TEXT NOT NULL DEFAULT 'sensitive',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    risk_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensitive_products_hs_code ON sensitive_products (hs_code);
CREATE INDEX IF NOT EXISTS idx_sensitive_products_product_name ON sensitive_products (product_name);
CREATE INDEX IF NOT EXISTS idx_sensitive_products_type_level ON sensitive_products (product_type, risk_level);

-- 2. 创建海关查验产品表
CREATE TABLE IF NOT EXISTS inspection_products (
    id SERIAL PRIMARY KEY,
    product_name TEXT NOT NULL,
    hs_code TEXT NOT NULL,
    duty_rate NUMERIC(10,4),
    inspection_rate NUMERIC(10,4),
    risk_level TEXT NOT NULL DEFAULT 'medium',
    risk_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspection_products_hs_code ON inspection_products (hs_code);
CREATE INDEX IF NOT EXISTS idx_inspection_products_product_name ON inspection_products (product_name);
CREATE INDEX IF NOT EXISTS idx_inspection_products_risk_level ON inspection_products (risk_level);

-- 3. 插入敏感产品数据
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '帐篷', '6306', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '披肩/围巾/面纱', '6117100000', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '窗帘', '6303', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '蚊帐', '6304', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '行李箱', '4202', '3%-9.7%', 0.0300, 0.0970, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '背包', '4202', '3%-9.7%', 0.0300, 0.0970, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '毛巾', '6302', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('玩具/运动类', '遥控车', '9503001000', '0%', 0.0000, 0.0000, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('玩具/运动类', '圣诞饰品/圣诞树', '9505109000', '2.7%', 0.0270, 0.0270, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('机械电气类', '电池', '8507', '0%-3.7%', 0.0000, 0.0370, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('机械电气类', '便携式电源站', '8507600090', '2.7%', 0.0270, 0.0270, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('机械电气类', '充气泵', '8414208090', '2.2%', 0.0220, 0.0220, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('机械电气类', '链锯', '8467221000', '2.7%', 0.0270, 0.0270, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '晶体硅光伏组件', '8541430000', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '烫衣板', '7323990010', '3.2%', 0.0320, 0.0320, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '螺丝钉/螺母', '7318', '3.7%', 0.0370, 0.0370, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '冷轧钢板', '7209', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '活页夹金属配件', '830510', '2.7%', 0.0270, 0.0270, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '热轧钢板桩', '7301100000', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '钼丝', '810296', '6.1%', 0.0610, 0.0610, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '钨电极', '8101991000', '0%-6%', 0.0000, 0.0600, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铸铁制品', '73251000', '1.7%', 0.0170, 0.0170, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '成卷铝箔', '7607', '7.5%', 0.0750, 0.0750, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '无缝钢铁管', '7304', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '钢丝绳/钢缆', '731210', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('塑料/橡胶类', '一次性塑料袋', '3923291000', '6.5%', 0.0650, 0.0650, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('塑料/橡胶类', '保鲜膜', '3920', '0%-6.5%', 0.0000, 0.0650, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '摩托车', '8711', '6%-8%', 0.0600, 0.0800, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '自行车', '8712', '14%-15%', 0.1400, 0.1500, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '残疾人专用车', '8713900000', '0%', 0.0000, 0.0000, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '轮胎', '4011', '0%-4.5%', 0.0000, 0.0450, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '汽车包围', '8708', '3%-4.5%', 0.0300, 0.0450, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '车身零件', '8708', '3%-4.5%', 0.0300, 0.0450, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '手动叉车及其主要配件', '84279000', '4%', 0.0400, 0.0400, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '轮毂', '8708', '3%-4.5%', 0.0300, 0.0450, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纸制品', '铜版纸', '481013', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纸制品', '标签纸（自粘剂）', '4821901000', '0%', 0.0000, 0.0000, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('陶瓷类', '普通陶瓷餐具', '6912002199', '5%', 0.0500, 0.0500, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('陶瓷类', '瓷砖', '6907', '5%', 0.0500, 0.0500, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('陶瓷类', '瓦片', '6905', '0%', 0.0000, 0.0000, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('陶瓷类', '浴缸', '6910100000', '7%', 0.0700, 0.0700, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('陶瓷类', '马桶', '6910100000', '7%', 0.0700, 0.0700, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('木制品', '组装地板', '4418790000', '0%', 0.0000, 0.0000, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('木制品', '胶合板', '44123110', '6%-10%', 0.0600, 0.1000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '蜡烛', '3406000000', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '胶水', '3506', '0%-6.5%', 0.0000, 0.0650, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '稀有气体', '2804', '0%-5.5%', 0.0000, 0.0550, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '草酸', '29171100', '6.5%', 0.0650, 0.0650, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '沐浴露', '3401300000', '4%', 0.0400, 0.0400, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '肥皂', '3401190000', '0%', 0.0000, 0.0000, 'sensitive', 'low', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '酒石酸', '2918120000', '6.5%', 0.0650, 0.0650, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '护肤品/彩妆', '3304', '0%', 0.0000, 0.0000, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('玻璃制品', '玻璃纤维网格织布', '7019', '7%', 0.0700, 0.0700, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('毛皮类', '油鞣革', '411410', '2.5%', 0.0250, 0.0250, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('运输/运输配件类', '保险杠', '870810', '3%-4.5%', 0.0300, 0.0450, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '喷雾', '961610', '2.7%', 0.0270, 0.0270, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '鞋', '6402', '17%', 0.1700, 0.1700, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '鞋', '6403', '17%', 0.1700, 0.1700, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '地毯', '6301', '3%-12%', 0.0300, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '汽车罩', '6306', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '汽车罩', '6307', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '服装', '6114', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '服装', '6211', '12%', 0.1200, 0.1200, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '雨伞', '66011', '4.7%', 0.0470, 0.0470, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '雨伞', '66019', '4.7%', 0.0470, 0.0470, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '热轧板材', '7208', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '热轧板材', '7211', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '热轧板材', '7225', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48101300', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48101400', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48101900', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48102200', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48102930', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48102980', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48109910', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铜版纸', '48109980', '0%', 0.0000, 0.0000, 'anti_dumping', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铝散热器', '7615', '6%', 0.0600, 0.0600, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('贱金属类', '铝散热器', '7616', '6%', 0.0600, 0.0600, 'sensitive', 'high', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '洗衣液', '340250', '4%', 0.0400, 0.0400, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '洗衣液', '340290', '4%', 0.0400, 0.0400, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '过硫酸盐', '28334000', '5.5%', 0.0550, 0.0550, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('化工产品类', '过硫酸盐', '28429080', '5.5%', 0.0550, 0.0550, 'sensitive', 'medium', true);
INSERT INTO sensitive_products (category, product_name, hs_code, duty_rate, duty_rate_min, duty_rate_max, product_type, risk_level, is_active) VALUES ('纺织品', '地毯', '57', '3%-12%', 0.0300, 0.1200, 'sensitive', 'high', true);

-- 4. 插入海关查验产品数据
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('喷墨打印机', '8443328000', 0.0000, NULL, 'high', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('展示架', '9403208000', 0.0000, NULL, 'high', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('金属工具柜', '9403208000', 0.0000, NULL, 'high', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('动物监护仓', '9031808000', 0.0000, NULL, 'medium', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('空气源热泵', '8418610099', 0.0000, NULL, 'high', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('解压玩具', '9503009990', 0.0000, NULL, 'medium', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('对讲立柱', '8517140000', 0.0000, NULL, 'medium', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('新风换气机', '8414510090', 0.0320, NULL, 'medium', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('冷媒机', '9031808000', 0.0000, NULL, 'medium', true);
INSERT INTO inspection_products (product_name, hs_code, duty_rate, inspection_rate, risk_level, is_active) VALUES ('降压线', '8544421000', 0.0000, NULL, 'medium', true);

-- 完成
