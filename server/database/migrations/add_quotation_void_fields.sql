-- 添加报价作废相关字段
-- 执行时间：2026-01-19

-- 为quotations表添加作废标记字段
ALTER TABLE quotations 
  ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS void_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS void_by TEXT,
  ADD COLUMN IF NOT EXISTS void_by_name TEXT;

-- 添加索引以提高查询效率
CREATE INDEX IF NOT EXISTS idx_quotations_is_void ON quotations(is_void);

-- 添加注释
COMMENT ON COLUMN quotations.is_void IS '是否已作废';
COMMENT ON COLUMN quotations.void_reason IS '作废原因';
COMMENT ON COLUMN quotations.void_time IS '作废时间';
COMMENT ON COLUMN quotations.void_by IS '作废人ID';
COMMENT ON COLUMN quotations.void_by_name IS '作废人姓名';
