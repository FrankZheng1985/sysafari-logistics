-- ============================================================
-- 添加缺失的费用类别到 service_fee_categories 表
-- 目的：让所有现有费用数据能正确关联到费用类别
-- 执行时间：2026-01-16
-- 影响：只新增数据，不修改任何现有数据
-- ============================================================

-- 开始事务
BEGIN;

-- 查看添加前的数量
SELECT '添加前费用类别总数: ' || COUNT(*)::text as info FROM service_fee_categories;

-- ==================== 添加缺失的小写英文类别 ====================
-- 这些类别在 fees 表中被使用，但使用的是小写形式

-- 1. duty (关税 - 小写版本)
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '关税(duty)', 'Duty', 'duty', '关税费用（小写代码，兼容历史数据）', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = 'duty');

-- 2. transport (运输 - 小写版本)
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '运输(transport)', 'Transport', 'transport', '运输费用（小写代码，兼容历史数据）', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = 'transport');

-- 3. other (其他 - 小写版本)
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '其他(other)', 'Other', 'other', '其他费用（小写代码，兼容历史数据）', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = 'other');

-- 4. handling (操作/换单 - 小写版本)
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '操作费(handling)', 'Handling', 'handling', '操作/换单费用（小写代码，兼容历史数据）', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = 'handling');

-- ==================== 添加缺失的中文类别 ====================
-- 这些类别在 service_fees 和 product_fee_items 表中被使用

-- 5. 报关服务
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '报关服务', 'Customs Declaration Service', '报关服务', '报关相关服务费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '报关服务' OR name = '报关服务');

-- 6. 查验费用
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '查验费用', 'Inspection Fee', '查验费用', '海关查验相关费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '查验费用' OR name = '查验费用');

-- 7. 港口费用
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '港口费用', 'Port Fee', '港口费用', '港口相关费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '港口费用' OR name = '港口费用');

-- 8. 罚款
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '罚款', 'Penalty', '罚款', '各类罚款费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '罚款' OR name = '罚款');

-- 9. 进口商代理费
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '进口商代理费', 'Importer Agency Fee', '进口商代理费', '进口商代理服务费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '进口商代理费' OR name = '进口商代理费');

-- 10. 管理费
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '管理费', 'Management Fee', '管理费', '管理相关费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '管理费' OR name = '管理费');

-- 11. 税务费
INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, created_at, updated_at)
SELECT '税务费', 'Tax Fee', '税务费', '税务相关费用', 99, 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM service_fee_categories WHERE code = '税务费' OR name = '税务费');

-- 查看添加后的数量
SELECT '添加后费用类别总数: ' || COUNT(*)::text as info FROM service_fee_categories;

-- 查看新添加的类别
SELECT '=== 新添加的类别 ===' as info;
SELECT id, name, name_en, code, status 
FROM service_fee_categories 
WHERE code IN ('duty', 'transport', 'other', 'handling', '报关服务', '查验费用', '港口费用', '罚款', '进口商代理费', '管理费', '税务费')
ORDER BY id;

-- 验证：检查是否还有未关联的类别
SELECT '=== 验证：检查是否还有未关联的费用 ===' as info;
WITH all_used AS (
    SELECT DISTINCT category as cat FROM fees WHERE category IS NOT NULL AND category != ''
    UNION
    SELECT DISTINCT fee_category FROM product_fee_items WHERE fee_category IS NOT NULL AND fee_category != ''
    UNION
    SELECT DISTINCT fee_category FROM supplier_price_items WHERE fee_category IS NOT NULL AND fee_category != ''
    UNION
    SELECT DISTINCT category FROM service_fees WHERE category IS NOT NULL AND category != ''
)
SELECT cat as 未关联类别
FROM all_used
WHERE NOT EXISTS (
    SELECT 1 FROM service_fee_categories sfc 
    WHERE sfc.code = cat OR sfc.name = cat
);

-- 提交事务
COMMIT;

-- 完成提示
SELECT '✅ 费用类别添加完成！所有现有费用数据已能正确关联。' as result;
