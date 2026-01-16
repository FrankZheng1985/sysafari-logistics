-- ==================== 添加集装箱号到申报历史表 ====================
-- 用于显示匹配记录详情中的申报历史集装箱号
-- 创建时间: 2026-01-16

-- 添加集装箱号字段
ALTER TABLE hs_declaration_history ADD COLUMN IF NOT EXISTS container_no TEXT;
COMMENT ON COLUMN hs_declaration_history.container_no IS '集装箱号';

-- 回填已有数据的集装箱号（从 cargo_imports 表获取）
UPDATE hs_declaration_history h
SET container_no = ci.container_no
FROM cargo_imports ci
WHERE h.import_id = ci.id
  AND h.container_no IS NULL
  AND ci.container_no IS NOT NULL;
