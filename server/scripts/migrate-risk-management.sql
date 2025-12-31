-- =====================================================
-- HS编码智能优化与风险管理系统 - 数据库迁移脚本
-- 创建时间: 2024-12-30
-- 功能: 申报价值记录、查验记录、风险分析相关表
-- =====================================================

-- 1. 申报价值记录表
-- 用于记录每次申报的价值和结果，分析最低通过价值
CREATE TABLE IF NOT EXISTS declaration_value_records (
  id SERIAL PRIMARY KEY,
  hs_code VARCHAR(10) NOT NULL,              -- HS编码（10位）
  product_name TEXT,                          -- 商品名称
  product_name_en TEXT,                       -- 商品英文名称
  origin_country VARCHAR(50),                 -- 原产国
  origin_country_code VARCHAR(10),            -- 原产国代码
  declared_unit_price NUMERIC(12,4),          -- 申报单价
  price_unit VARCHAR(20) DEFAULT 'PCS',       -- 价格单位 (PCS/KG/SET/PAIR等)
  declared_quantity NUMERIC(12,2),            -- 申报数量
  declared_total_value NUMERIC(14,2),         -- 申报总价值
  currency VARCHAR(10) DEFAULT 'EUR',         -- 货币
  declaration_result VARCHAR(20) DEFAULT 'pending', -- 申报结果: pending/passed/questioned/rejected
  customs_adjusted_price NUMERIC(12,4),       -- 海关调整价格（如有）
  adjustment_reason TEXT,                     -- 调整原因
  declaration_date DATE,                      -- 申报日期
  customs_office VARCHAR(50),                 -- 海关口岸
  bill_no VARCHAR(50),                        -- 关联提单号
  import_id INTEGER,                          -- 关联导入批次
  item_id INTEGER,                            -- 关联货物明细ID
  created_by INTEGER,                         -- 创建人
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 申报价值记录索引
CREATE INDEX IF NOT EXISTS idx_dvr_hs_code ON declaration_value_records(hs_code);
CREATE INDEX IF NOT EXISTS idx_dvr_origin_country ON declaration_value_records(origin_country);
CREATE INDEX IF NOT EXISTS idx_dvr_result ON declaration_value_records(declaration_result);
CREATE INDEX IF NOT EXISTS idx_dvr_date ON declaration_value_records(declaration_date);
CREATE INDEX IF NOT EXISTS idx_dvr_import_id ON declaration_value_records(import_id);

-- 添加注释
COMMENT ON TABLE declaration_value_records IS '申报价值记录表，用于统计分析历史申报通过率';
COMMENT ON COLUMN declaration_value_records.declaration_result IS '申报结果：pending-待处理, passed-通过, questioned-被质疑, rejected-被拒绝';

-- 2. 查验记录表
-- 用于记录海关查验情况，统计查验率
CREATE TABLE IF NOT EXISTS inspection_records (
  id SERIAL PRIMARY KEY,
  hs_code VARCHAR(10),                        -- HS编码
  product_name TEXT,                          -- 商品名称
  product_name_en TEXT,                       -- 商品英文名称
  origin_country VARCHAR(50),                 -- 原产国
  origin_country_code VARCHAR(10),            -- 原产国代码
  container_no VARCHAR(30),                   -- 集装箱号
  bill_no VARCHAR(50),                        -- 提单号
  inspection_type VARCHAR(50),                -- 查验类型: none/document/physical/scan/full
  inspection_result VARCHAR(20),              -- 查验结果: passed/failed/pending/released
  inspection_date DATE,                       -- 查验日期
  inspection_notes TEXT,                      -- 查验备注/问题描述
  customs_office VARCHAR(50),                 -- 海关口岸
  inspector_name VARCHAR(100),                -- 查验人员
  penalty_amount NUMERIC(12,2),               -- 罚款金额（如有）
  delay_days INTEGER DEFAULT 0,               -- 延误天数
  import_id INTEGER,                          -- 关联导入批次
  item_id INTEGER,                            -- 关联货物明细ID
  created_by INTEGER,                         -- 创建人
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 查验记录索引
CREATE INDEX IF NOT EXISTS idx_ir_hs_code ON inspection_records(hs_code);
CREATE INDEX IF NOT EXISTS idx_ir_origin_country ON inspection_records(origin_country);
CREATE INDEX IF NOT EXISTS idx_ir_inspection_type ON inspection_records(inspection_type);
CREATE INDEX IF NOT EXISTS idx_ir_result ON inspection_records(inspection_result);
CREATE INDEX IF NOT EXISTS idx_ir_date ON inspection_records(inspection_date);
CREATE INDEX IF NOT EXISTS idx_ir_import_id ON inspection_records(import_id);
CREATE INDEX IF NOT EXISTS idx_ir_container ON inspection_records(container_no);

-- 添加注释
COMMENT ON TABLE inspection_records IS '海关查验记录表，用于统计查验率和风险预警';
COMMENT ON COLUMN inspection_records.inspection_type IS '查验类型：none-未查验, document-单证查验, physical-实物查验, scan-扫描查验, full-全面查验';
COMMENT ON COLUMN inspection_records.inspection_result IS '查验结果：passed-通过, failed-未通过, pending-处理中, released-放行';

-- 3. HS编码申报价值统计视图
-- 用于快速查询每个HS编码的最低通过价值
CREATE OR REPLACE VIEW hs_min_pass_price AS
SELECT 
  hs_code,
  origin_country,
  price_unit,
  COUNT(*) as total_count,
  COUNT(CASE WHEN declaration_result = 'passed' THEN 1 END) as pass_count,
  COUNT(CASE WHEN declaration_result = 'questioned' THEN 1 END) as questioned_count,
  COUNT(CASE WHEN declaration_result = 'rejected' THEN 1 END) as rejected_count,
  MIN(CASE WHEN declaration_result = 'passed' THEN declared_unit_price END) as min_pass_price,
  MAX(CASE WHEN declaration_result = 'passed' THEN declared_unit_price END) as max_pass_price,
  AVG(CASE WHEN declaration_result = 'passed' THEN declared_unit_price END) as avg_pass_price,
  PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY declared_unit_price) 
    FILTER (WHERE declaration_result = 'passed') as p10_pass_price,
  ROUND(COUNT(CASE WHEN declaration_result = 'passed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as pass_rate
FROM declaration_value_records
WHERE declared_unit_price > 0
GROUP BY hs_code, origin_country, price_unit;

COMMENT ON VIEW hs_min_pass_price IS 'HS编码申报价值统计视图，包含最低/平均通过价值和通过率';

-- 4. HS编码查验率统计视图
CREATE OR REPLACE VIEW hs_inspection_rate AS
SELECT 
  hs_code,
  origin_country,
  COUNT(*) as total_shipments,
  COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) as inspected_count,
  COUNT(CASE WHEN inspection_type = 'physical' OR inspection_type = 'full' THEN 1 END) as physical_inspection_count,
  COUNT(CASE WHEN inspection_result = 'failed' THEN 1 END) as failed_count,
  ROUND(
    COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 
    2
  ) as inspection_rate,
  ROUND(
    COUNT(CASE WHEN inspection_type = 'physical' OR inspection_type = 'full' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 
    2
  ) as physical_rate,
  AVG(delay_days) FILTER (WHERE inspection_type IS NOT NULL AND inspection_type != 'none') as avg_delay_days,
  CASE 
    WHEN COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) > 30 THEN 'high'
    WHEN COUNT(CASE WHEN inspection_type IS NOT NULL AND inspection_type != 'none' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) > 10 THEN 'medium'
    ELSE 'low'
  END as risk_level
FROM inspection_records
GROUP BY hs_code, origin_country
HAVING COUNT(*) >= 3;  -- 至少3次记录才有统计意义

COMMENT ON VIEW hs_inspection_rate IS 'HS编码查验率统计视图，包含查验率和风险等级';

-- 5. 综合风险评估视图
CREATE OR REPLACE VIEW hs_risk_summary AS
SELECT 
  COALESCE(d.hs_code, i.hs_code) as hs_code,
  COALESCE(d.origin_country, i.origin_country) as origin_country,
  d.total_count as declaration_count,
  d.pass_rate as declaration_pass_rate,
  d.min_pass_price,
  d.avg_pass_price,
  i.total_shipments,
  i.inspection_rate,
  i.risk_level as inspection_risk_level,
  -- 综合风险评分 (0-100)
  ROUND(
    COALESCE(100 - d.pass_rate, 50) * 0.4 +  -- 申报风险权重40%
    COALESCE(i.inspection_rate, 10) * 0.6,    -- 查验风险权重60%
    1
  ) as composite_risk_score
FROM hs_min_pass_price d
FULL OUTER JOIN hs_inspection_rate i 
  ON d.hs_code = i.hs_code AND d.origin_country = i.origin_country;

COMMENT ON VIEW hs_risk_summary IS 'HS编码综合风险评估视图';

-- 6. 添加 cargo_imports 表的风险评估相关字段
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5,2) DEFAULT 0;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'low';
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS risk_analyzed_at TIMESTAMP;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS risk_notes TEXT;

COMMENT ON COLUMN cargo_imports.risk_score IS '综合风险评分 (0-100)';
COMMENT ON COLUMN cargo_imports.risk_level IS '风险等级: low/medium/high';

-- 7. 添加 cargo_items 表的风险相关字段
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS declaration_risk VARCHAR(20) DEFAULT 'low';
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS inspection_risk VARCHAR(20) DEFAULT 'low';
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS min_safe_price NUMERIC(12,4);
ALTER TABLE cargo_items ADD COLUMN IF NOT EXISTS price_warning TEXT;

COMMENT ON COLUMN cargo_items.declaration_risk IS '申报价值风险: low/medium/high';
COMMENT ON COLUMN cargo_items.inspection_risk IS '查验风险: low/medium/high';
COMMENT ON COLUMN cargo_items.min_safe_price IS '建议最低安全申报价格';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 风险管理系统数据库迁移完成';
  RAISE NOTICE '   - declaration_value_records 表已创建';
  RAISE NOTICE '   - inspection_records 表已创建';
  RAISE NOTICE '   - hs_min_pass_price 视图已创建';
  RAISE NOTICE '   - hs_inspection_rate 视图已创建';
  RAISE NOTICE '   - hs_risk_summary 视图已创建';
  RAISE NOTICE '   - cargo_imports/cargo_items 风险字段已添加';
END $$;

