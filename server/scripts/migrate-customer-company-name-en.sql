-- ============================================================
-- 客户表添加公司英文名称字段
-- 执行日期：2024-12-25
-- ============================================================

-- 添加 company_name_en 字段（公司英文全称）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name_en TEXT;

-- 添加注释
COMMENT ON COLUMN customers.company_name_en IS '公司英文全称';

-- 创建索引（可选，如果需要按英文名称搜索）
CREATE INDEX IF NOT EXISTS idx_customers_company_name_en ON customers(company_name_en);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 客户表字段迁移完成！';
    RAISE NOTICE '📊 新增字段：company_name_en (公司英文全称)';
END $$;

