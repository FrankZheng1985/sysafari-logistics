-- ============================================================
-- 风险评估数据修复脚本
-- 创建时间: 2026-01-09
-- 修复问题:
--   1. 塑料垃圾桶(3924900090)被错误标记反倾销税
--   2. 印花机、收纳架风险等级不准确
--   3. 鞋柜改为鞋子，修正HS编码
-- ============================================================

-- 开始事务
BEGIN;

-- ============================================================
-- 问题1: 修复塑料垃圾桶反倾销税率问题
-- 原因: 3924900090 这个10位编码本身不应该有反倾销税
--       反倾销税是针对特定编码(如3924900010)，不是3924900090
--       保持原产地字段不变，只修正税率
-- ============================================================

-- 查看当前数据（执行前先确认）
-- SELECT hs_code, hs_code_10, origin_country_code, anti_dumping_rate 
-- FROM tariff_rates 
-- WHERE hs_code LIKE '392490%';

-- 修正：3924900090 编码不应有反倾销税（保持原产地不变）
UPDATE tariff_rates 
SET anti_dumping_rate = 0,
    updated_at = NOW()
WHERE hs_code_10 = '3924900090'
  AND anti_dumping_rate > 0;

-- ============================================================
-- 问题2: 修复查验产品库风险等级
-- 原因: 印花机(8443328000)和收纳架(9403208000)实际查验率不高
-- ============================================================

-- 降低印花机风险等级
UPDATE inspection_products 
SET risk_level = 'low', 
    risk_notes = '实际查验率不高，2026-01-09修正',
    updated_at = NOW()
WHERE hs_code = '8443328000';

-- 降低收纳架/展示架风险等级
UPDATE inspection_products 
SET risk_level = 'low', 
    risk_notes = '实际查验率不高，2026-01-09修正',
    updated_at = NOW()
WHERE hs_code = '9403208000';

-- ============================================================
-- 问题3: 敏感产品库 - 鞋改为鞋子（更明确的名称）
-- 鞋子正确HS编码: 6402(塑料/橡胶鞋), 6403(皮鞋), 6404(纺织鞋面)
-- ============================================================

-- 将"鞋"更新为"鞋子"
UPDATE sensitive_products 
SET product_name = '鞋子',
    risk_notes = '2026-01-09更新名称',
    updated_at = NOW()
WHERE hs_code IN ('6402', '6403') 
  AND product_name = '鞋';

-- 如果有鞋柜记录，更新为鞋子（使用6402编码）
UPDATE sensitive_products 
SET product_name = '鞋子',
    hs_code = '6402',
    category = '纺织品',
    duty_rate = '17%',
    duty_rate_min = 0.17,
    duty_rate_max = 0.17,
    risk_notes = '高关税产品，2026-01-09由鞋柜修正',
    updated_at = NOW()
WHERE product_name LIKE '%鞋柜%';

-- ============================================================
-- 验证修复结果
-- ============================================================

-- 验证1: 检查3924900090反倾销税
SELECT '塑料垃圾桶修复验证' as check_type, 
       hs_code, hs_code_10, origin_country_code, anti_dumping_rate 
FROM tariff_rates 
WHERE hs_code LIKE '392490%'
ORDER BY origin_country_code;

-- 验证2: 检查查验产品风险等级
SELECT '查验产品修复验证' as check_type,
       product_name, hs_code, risk_level, risk_notes
FROM inspection_products 
WHERE hs_code IN ('8443328000', '9403208000');

-- 验证3: 检查鞋子敏感产品
SELECT '鞋子记录验证' as check_type,
       product_name, hs_code, risk_level, category
FROM sensitive_products 
WHERE product_name LIKE '%鞋%' OR hs_code LIKE '640%';

-- 提交事务
COMMIT;

-- ============================================================
-- 回滚命令（如需撤销修改）
-- ROLLBACK;
-- ============================================================
