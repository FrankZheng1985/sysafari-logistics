-- ==================== 税费计算精准改进迁移脚本 ====================
-- 添加贸易条件（Incoterms）、运费、保险费等字段
-- 执行时间: 2026-01-01

-- ==================== 1. cargo_imports 批次表添加贸易条件字段 ====================

-- 贸易条件（Incoterms 2020）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS incoterm TEXT DEFAULT 'FOB';
COMMENT ON COLUMN cargo_imports.incoterm IS '贸易条件：EXW/FCA/FAS/FOB/CFR/CIF/CPT/CIP/DAP/DPU/DDP/DDU';

-- 国际运费
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS international_freight NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_imports.international_freight IS '国际运费（EUR）';

-- 出口国内陆运费（EXW条款使用）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS domestic_freight_export NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_imports.domestic_freight_export IS '出口国内陆运费（EUR），EXW条款使用';

-- 进口国内陆运费（DAP/DPU/DDU/DDP条款使用）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS domestic_freight_import NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_imports.domestic_freight_import IS '进口国内陆运费（EUR），D组条款使用';

-- 保险费
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS insurance_cost NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_imports.insurance_cost IS '保险费（EUR）';

-- 预付关税（DDP条款使用）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS prepaid_duties NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_imports.prepaid_duties IS '预付关税（EUR），DDP条款使用';

-- 运费分摊方式
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS freight_allocation_method TEXT DEFAULT 'by_value';
COMMENT ON COLUMN cargo_imports.freight_allocation_method IS '运费分摊方式：by_value按货值/by_weight按重量';

-- 总完税价格
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS total_customs_value NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_imports.total_customs_value IS '总完税价格（EUR）';

-- ==================== 2. cargo_items 明细表添加完税价格相关字段 ====================

-- 原产国代码（ISO 2位）- 如果字段不存在则添加
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS origin_country_code TEXT DEFAULT 'CN';
COMMENT ON COLUMN cargo_items.origin_country_code IS '原产国代码（ISO 2位）';

-- 完税价格
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS customs_value NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_items.customs_value IS '完税价格（EUR）';

-- 分摊的运费
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS freight_allocation NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_items.freight_allocation IS '分摊的运费（EUR）';

-- 分摊的保险费
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS insurance_allocation NUMERIC DEFAULT 0;
COMMENT ON COLUMN cargo_items.insurance_allocation IS '分摊的保险费（EUR）';

-- ==================== 3. 创建索引 ====================

CREATE INDEX IF NOT EXISTS idx_cargo_imports_incoterm ON cargo_imports(incoterm);
CREATE INDEX IF NOT EXISTS idx_cargo_items_origin_code ON cargo_items(origin_country_code);

-- ==================== 4. 更新现有数据的默认值 ====================

-- 将现有记录的 origin_country_code 从 origin_country 字段提取（如果为空）
UPDATE cargo_items 
SET origin_country_code = COALESCE(
    CASE 
        WHEN origin_country = '中国' OR origin_country = 'China' THEN 'CN'
        WHEN origin_country = '越南' OR origin_country = 'Vietnam' THEN 'VN'
        WHEN origin_country = '印度' OR origin_country = 'India' THEN 'IN'
        WHEN origin_country = '韩国' OR origin_country = 'South Korea' THEN 'KR'
        WHEN origin_country = '日本' OR origin_country = 'Japan' THEN 'JP'
        WHEN origin_country = '泰国' OR origin_country = 'Thailand' THEN 'TH'
        WHEN origin_country = '马来西亚' OR origin_country = 'Malaysia' THEN 'MY'
        WHEN origin_country = '印度尼西亚' OR origin_country = 'Indonesia' THEN 'ID'
        WHEN origin_country = '台湾' OR origin_country = 'Taiwan' THEN 'TW'
        ELSE 'CN'
    END,
    'CN'
)
WHERE origin_country_code IS NULL OR origin_country_code = '';

-- 初始化 customs_value 为 total_value（现有数据假设为CIF价格）
UPDATE cargo_items 
SET customs_value = COALESCE(total_value, 0)
WHERE customs_value IS NULL OR customs_value = 0;

-- 初始化批次的 total_customs_value
UPDATE cargo_imports ci
SET total_customs_value = COALESCE(
    (SELECT SUM(COALESCE(customs_value, total_value, 0)) FROM cargo_items WHERE import_id = ci.id),
    0
)
WHERE total_customs_value IS NULL OR total_customs_value = 0;

-- ==================== 完成 ====================

