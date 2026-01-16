-- ==================== 添加单件重量相关字段 ====================
-- 用于匹配记录库显示单件重量区间和平均单件重量
-- 创建时间: 2026-01-16

-- 添加平均单件重量字段
ALTER TABLE hs_match_records 
ADD COLUMN IF NOT EXISTS avg_piece_weight NUMERIC DEFAULT 0;

-- 添加最小单件重量字段
ALTER TABLE hs_match_records 
ADD COLUMN IF NOT EXISTS min_piece_weight NUMERIC DEFAULT 0;

-- 添加最大单件重量字段
ALTER TABLE hs_match_records 
ADD COLUMN IF NOT EXISTS max_piece_weight NUMERIC DEFAULT 0;

-- 添加字段注释
COMMENT ON COLUMN hs_match_records.avg_piece_weight IS '平均单件重量（kg/件）';
COMMENT ON COLUMN hs_match_records.min_piece_weight IS '最小单件重量（kg/件）';
COMMENT ON COLUMN hs_match_records.max_piece_weight IS '最大单件重量（kg/件）';

-- 基于现有数据计算单件重量（针对已有记录）
UPDATE hs_match_records 
SET 
    avg_piece_weight = CASE 
        WHEN total_declared_qty > 0 THEN ROUND(total_declared_weight::numeric / total_declared_qty, 4)
        ELSE 0 
    END
WHERE total_declared_qty > 0 AND total_declared_weight > 0;

-- 将平均单件重量设为最小和最大（初始化）
UPDATE hs_match_records 
SET 
    min_piece_weight = avg_piece_weight,
    max_piece_weight = avg_piece_weight
WHERE avg_piece_weight > 0 AND min_piece_weight = 0;
