-- HS 编码规范化迁移脚本
-- 将所有 HS 编码更新为 10 位（欧盟 TARIC 标准）
-- 执行时间: 2024-12-30
-- 说明: 不足 10 位的编码在末尾补 0

-- =====================================================
-- 1. 更新 cargo_items 表的 matched_hs_code 字段
-- =====================================================
UPDATE cargo_items 
SET matched_hs_code = RPAD(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g'), 10, '0')
WHERE matched_hs_code IS NOT NULL 
  AND LENGTH(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g')) < 10;

-- 验证更新结果
SELECT 'cargo_items.matched_hs_code 更新完成' AS status,
       COUNT(*) AS total_records,
       COUNT(CASE WHEN LENGTH(matched_hs_code) = 10 THEN 1 END) AS correct_10_digit,
       COUNT(CASE WHEN LENGTH(matched_hs_code) < 10 THEN 1 END) AS less_than_10
FROM cargo_items 
WHERE matched_hs_code IS NOT NULL;

-- =====================================================
-- 2. 更新 cargo_items 表的 customer_hs_code 字段
-- =====================================================
UPDATE cargo_items 
SET customer_hs_code = RPAD(REGEXP_REPLACE(customer_hs_code, '[^0-9]', '', 'g'), 10, '0')
WHERE customer_hs_code IS NOT NULL 
  AND LENGTH(REGEXP_REPLACE(customer_hs_code, '[^0-9]', '', 'g')) < 10;

-- 验证更新结果
SELECT 'cargo_items.customer_hs_code 更新完成' AS status,
       COUNT(*) AS total_records,
       COUNT(CASE WHEN LENGTH(customer_hs_code) = 10 THEN 1 END) AS correct_10_digit,
       COUNT(CASE WHEN LENGTH(customer_hs_code) < 10 THEN 1 END) AS less_than_10
FROM cargo_items 
WHERE customer_hs_code IS NOT NULL;

-- =====================================================
-- 3. 更新 hs_match_history 表的 matched_hs_code 字段
-- =====================================================
UPDATE hs_match_history 
SET matched_hs_code = RPAD(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g'), 10, '0')
WHERE matched_hs_code IS NOT NULL 
  AND LENGTH(REGEXP_REPLACE(matched_hs_code, '[^0-9]', '', 'g')) < 10;

-- 验证更新结果
SELECT 'hs_match_history.matched_hs_code 更新完成' AS status,
       COUNT(*) AS total_records,
       COUNT(CASE WHEN LENGTH(matched_hs_code) = 10 THEN 1 END) AS correct_10_digit,
       COUNT(CASE WHEN LENGTH(matched_hs_code) < 10 THEN 1 END) AS less_than_10
FROM hs_match_history 
WHERE matched_hs_code IS NOT NULL;

-- =====================================================
-- 4. 更新 hs_match_records 表的 hs_code 字段
-- =====================================================
UPDATE hs_match_records 
SET hs_code = RPAD(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g'), 10, '0')
WHERE hs_code IS NOT NULL 
  AND LENGTH(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g')) < 10;

-- 验证更新结果
SELECT 'hs_match_records.hs_code 更新完成' AS status,
       COUNT(*) AS total_records,
       COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END) AS correct_10_digit,
       COUNT(CASE WHEN LENGTH(hs_code) < 10 THEN 1 END) AS less_than_10
FROM hs_match_records 
WHERE hs_code IS NOT NULL;

-- =====================================================
-- 5. 更新 tariff_rates 表的 hs_code 字段
-- =====================================================
UPDATE tariff_rates 
SET hs_code = RPAD(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g'), 10, '0')
WHERE hs_code IS NOT NULL 
  AND LENGTH(REGEXP_REPLACE(hs_code, '[^0-9]', '', 'g')) < 10;

-- 验证更新结果
SELECT 'tariff_rates.hs_code 更新完成' AS status,
       COUNT(*) AS total_records,
       COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END) AS correct_10_digit,
       COUNT(CASE WHEN LENGTH(hs_code) < 10 THEN 1 END) AS less_than_10
FROM tariff_rates 
WHERE hs_code IS NOT NULL;

-- =====================================================
-- 最终验证：汇总所有表的 HS 编码状态
-- =====================================================
SELECT '=== HS 编码规范化迁移完成 ===' AS message;

SELECT 'cargo_items.matched_hs_code' AS table_field, 
       COUNT(*) AS total,
       COUNT(CASE WHEN LENGTH(matched_hs_code) = 10 THEN 1 END) AS "10位编码"
FROM cargo_items WHERE matched_hs_code IS NOT NULL
UNION ALL
SELECT 'cargo_items.customer_hs_code', 
       COUNT(*),
       COUNT(CASE WHEN LENGTH(customer_hs_code) = 10 THEN 1 END)
FROM cargo_items WHERE customer_hs_code IS NOT NULL
UNION ALL
SELECT 'hs_match_history.matched_hs_code', 
       COUNT(*),
       COUNT(CASE WHEN LENGTH(matched_hs_code) = 10 THEN 1 END)
FROM hs_match_history WHERE matched_hs_code IS NOT NULL
UNION ALL
SELECT 'hs_match_records.hs_code', 
       COUNT(*),
       COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END)
FROM hs_match_records WHERE hs_code IS NOT NULL
UNION ALL
SELECT 'tariff_rates.hs_code', 
       COUNT(*),
       COUNT(CASE WHEN LENGTH(hs_code) = 10 THEN 1 END)
FROM tariff_rates WHERE hs_code IS NOT NULL;

