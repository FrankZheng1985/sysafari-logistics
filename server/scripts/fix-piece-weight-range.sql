-- 修正单件重量区间数据
-- 根据申报历史重新计算每个匹配记录的 min_piece_weight 和 max_piece_weight
-- 运行日期: 2026-01-16

BEGIN;

-- 更新 min_piece_weight 和 max_piece_weight（根据实际申报历史）
UPDATE hs_match_records r
SET 
  min_piece_weight = COALESCE(stats.min_pw, r.avg_piece_weight),
  max_piece_weight = COALESCE(stats.max_pw, r.avg_piece_weight)
FROM (
  SELECT 
    match_record_id,
    MIN(CASE WHEN declared_qty > 0 THEN declared_weight / declared_qty ELSE NULL END) as min_pw,
    MAX(CASE WHEN declared_qty > 0 THEN declared_weight / declared_qty ELSE NULL END) as max_pw
  FROM hs_declaration_history
  WHERE declared_qty > 0 AND declared_weight > 0
  GROUP BY match_record_id
) stats
WHERE r.id = stats.match_record_id;

COMMIT;

-- 验证台灯的数据
SELECT 
  product_name,
  material,
  total_declared_qty,
  total_declared_weight,
  ROUND(avg_piece_weight::numeric, 2) as avg_piece_weight,
  ROUND(min_piece_weight::numeric, 2) as min_piece_weight,
  ROUND(max_piece_weight::numeric, 2) as max_piece_weight
FROM hs_match_records
WHERE product_name = '台灯';

-- 验证所有有差异的记录
SELECT 
  product_name,
  material,
  ROUND(avg_piece_weight::numeric, 2) as avg_pw,
  ROUND(min_piece_weight::numeric, 2) as min_pw,
  ROUND(max_piece_weight::numeric, 2) as max_pw
FROM hs_match_records
WHERE min_piece_weight != max_piece_weight
ORDER BY product_name
LIMIT 10;
