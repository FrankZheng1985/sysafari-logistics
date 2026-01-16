-- 同步匹配记录库到匹配引擎学习库
-- 把 hs_match_records 的数据同步到 hs_match_history，让匹配引擎学习已有的品名+材质+HS编码组合
-- 运行日期: 2026-01-16

-- 开始事务
BEGIN;

-- 插入新记录（只插入 hs_match_history 中不存在的组合）
INSERT INTO hs_match_history (product_name, product_name_en, material, matched_hs_code, match_count, last_matched_at, created_at)
SELECT 
  r.product_name,
  r.product_name_en,
  r.material,
  r.hs_code,
  r.match_count,
  r.last_match_time,
  r.created_at
FROM hs_match_records r
WHERE NOT EXISTS (
  SELECT 1 FROM hs_match_history h 
  WHERE h.product_name = r.product_name 
    AND h.material IS NOT DISTINCT FROM r.material
)
AND r.status = 'active'
AND r.hs_code IS NOT NULL;

-- 更新已存在的记录（如果 hs_match_records 的数据更新）
UPDATE hs_match_history h
SET 
  matched_hs_code = r.hs_code,
  product_name_en = COALESCE(r.product_name_en, h.product_name_en),
  match_count = GREATEST(h.match_count, r.match_count),
  last_matched_at = GREATEST(h.last_matched_at, r.last_match_time)
FROM hs_match_records r
WHERE h.product_name = r.product_name 
  AND h.material IS NOT DISTINCT FROM r.material
  AND r.status = 'active'
  AND r.hs_code IS NOT NULL;

COMMIT;

-- 验证结果
SELECT 
  'hs_match_records' as 表名, COUNT(*) as 记录数 FROM hs_match_records WHERE status = 'active'
UNION ALL
SELECT 
  'hs_match_history', COUNT(*) FROM hs_match_history;
