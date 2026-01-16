-- 申报历史表添加客户名称字段
-- 运行日期: 2026-01-16

-- 添加客户名称字段
ALTER TABLE hs_declaration_history ADD COLUMN IF NOT EXISTS customer_name TEXT;
COMMENT ON COLUMN hs_declaration_history.customer_name IS '客户名称';

-- 回填已有数据的客户名称（从 cargo_imports 获取）
UPDATE hs_declaration_history h
SET customer_name = ci.customer_name
FROM cargo_imports ci
WHERE h.import_id = ci.id
  AND h.customer_name IS NULL
  AND ci.customer_name IS NOT NULL;

-- 验证
SELECT 
  COUNT(*) as total,
  COUNT(customer_name) as with_customer
FROM hs_declaration_history;
