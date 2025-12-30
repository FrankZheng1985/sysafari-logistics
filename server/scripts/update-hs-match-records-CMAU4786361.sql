-- ============================================================
-- HS匹配记录更新脚本 - 柜号: CMAU4786361
-- 创建日期: 2024-12-30
-- 说明: 根据Excel人工匹配和系统匹配结果，更新正确的HS码和税率
-- ============================================================

BEGIN;

-- 1. 置物架 (Sideboard) - 密度板;金属材质
-- Excel: 9403609000 (木制家具), 税率 0% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '置物架', 'Sideboard', '9403609000', '密度板;金属', 'density board; metal',
    'CN', 'CN', 0, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '9403609000',
    product_name_en = 'Sideboard',
    material_en = 'density board; metal',
    duty_rate = 0,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 2. 木制玩具 (Puzzle entertainment tools)
-- Excel: 9503006110 (玩具), 税率 0% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '木制玩具', 'Puzzle entertainment tools', '9503006110', '木', 'Wood',
    'CN', 'CN', 0, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '9503006110',
    product_name_en = 'Puzzle entertainment tools',
    material_en = 'Wood',
    duty_rate = 0,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 3. 电钻 (Power Tools - Electric Drill)
-- 系统: 8467219900 (各种材料用电钻), 税率 0% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '电钻', 'Power Tools', '8467219900', '塑料', 'Plastic',
    'CN', 'CN', 0, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8467219900',
    product_name_en = 'Power Tools',
    material_en = 'Plastic',
    duty_rate = 0,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 4. 抛光机 (Power Tools - Polisher)
-- Excel: 8467295100 (角磨机/抛光机), 税率 2.7% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '抛光机', 'Power Tools', '8467295100', '塑料', 'Plastic',
    'CN', 'CN', 2.7, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8467295100',
    product_name_en = 'Power Tools',
    material_en = 'Plastic',
    duty_rate = 2.7,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 5. 摄影柔光箱 (Professional studio lighting equipment)
-- 两者一致: 9006990000, 税率 3.2% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '摄影柔光箱', 'Professional studio lighting equipment', '9006990000', 'ABS', 'ABS',
    'CN', 'CN', 3.2, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '9006990000',
    product_name_en = 'Professional studio lighting equipment',
    material_en = 'ABS',
    duty_rate = 3.2,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 6. 耗材干燥盒 (3D printing filament drying equipment) - ABS材质
-- 系统: 8419390000 (干燥设备), 税率 1.7% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '耗材干燥盒', '3D printing filament drying equipment', '8419390000', '丙烯腈-丁二烯-苯乙烯', 'ABS',
    'CN', 'CN', 1.7, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8419390000',
    product_name_en = '3D printing filament drying equipment',
    material_en = 'ABS',
    duty_rate = 1.7,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 6b. 耗材干燥盒 - 加热丝材质（另一种规格）
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '耗材干燥盒', '3D printing filament drying equipment', '8419390000', '加热丝', 'Heating wire',
    'CN', 'CN', 1.7, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8419390000',
    product_name_en = '3D printing filament drying equipment',
    material_en = 'Heating wire',
    duty_rate = 1.7,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 7. 3D打印机 (3D model creation and printing equipment)
-- 系统: 8485200000 (增材制造机), 税率 1.7% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '3D打印机', '3D model creation and printing equipment', '8485200000', '金属', 'Metal',
    'CN', 'CN', 1.7, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8485200000',
    product_name_en = '3D model creation and printing equipment',
    material_en = 'Metal',
    duty_rate = 1.7,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 8. 蒸汽清洗机 (High pressure steam cleaning kitchen equipment)
-- Excel: 8424300800 (蒸汽/砂喷射机), 税率 1.7% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '蒸汽清洗机', 'High pressure steam cleaning kitchen equipment', '8424300800', 'ABS', 'ABS',
    'CN', 'CN', 1.7, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8424300800',
    product_name_en = 'High pressure steam cleaning kitchen equipment',
    material_en = 'ABS',
    duty_rate = 1.7,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 9. 电焊机 (Multifunctional welding tool)
-- Excel: 8515310000 (电弧焊机全自动/半自动), 税率 2.7% ✓
INSERT INTO hs_match_records (
    product_name, product_name_en, hs_code, material, material_en,
    origin_country, origin_country_code, duty_rate, vat_rate,
    is_verified, verified_at, match_count, first_match_time, last_match_time,
    status, created_at, updated_at
) VALUES (
    '电焊机', 'Multifunctional welding tool', '8515310000', '金属', 'Metal',
    'CN', 'CN', 2.7, 19,
    1, NOW(), 1, NOW(), NOW(),
    'active', NOW(), NOW()
)
ON CONFLICT (product_name, COALESCE(material, '')) 
DO UPDATE SET 
    hs_code = '8515310000',
    product_name_en = 'Multifunctional welding tool',
    material_en = 'Metal',
    duty_rate = 2.7,
    vat_rate = 19,
    is_verified = 1,
    verified_at = NOW(),
    match_count = hs_match_records.match_count + 1,
    last_match_time = NOW(),
    updated_at = NOW();

-- 同时更新 hs_match_history 表（如果有的话）
-- 更新置物架
UPDATE hs_match_history SET matched_hs_code = '9403609000', last_matched_at = NOW() 
WHERE product_name = '置物架';

-- 更新木制玩具
UPDATE hs_match_history SET matched_hs_code = '9503006110', last_matched_at = NOW() 
WHERE product_name = '木制玩具';

-- 更新电钻
UPDATE hs_match_history SET matched_hs_code = '8467219900', last_matched_at = NOW() 
WHERE product_name = '电钻';

-- 更新抛光机
UPDATE hs_match_history SET matched_hs_code = '8467295100', last_matched_at = NOW() 
WHERE product_name = '抛光机';

-- 更新摄影柔光箱
UPDATE hs_match_history SET matched_hs_code = '9006990000', last_matched_at = NOW() 
WHERE product_name = '摄影柔光箱';

-- 更新耗材干燥盒
UPDATE hs_match_history SET matched_hs_code = '8419390000', last_matched_at = NOW() 
WHERE product_name = '耗材干燥盒';

-- 更新3D打印机
UPDATE hs_match_history SET matched_hs_code = '8485200000', last_matched_at = NOW() 
WHERE product_name = '3D打印机';

-- 更新蒸汽清洗机
UPDATE hs_match_history SET matched_hs_code = '8424300800', last_matched_at = NOW() 
WHERE product_name = '蒸汽清洗机';

-- 更新电焊机
UPDATE hs_match_history SET matched_hs_code = '8515310000', last_matched_at = NOW() 
WHERE product_name = '电焊机';

COMMIT;

-- 验证查询
SELECT 
    product_name as "商品名称",
    hs_code as "HS编码",
    material as "材质",
    duty_rate as "关税率(%)",
    vat_rate as "增值税率(%)",
    is_verified as "已核实",
    match_count as "匹配次数",
    updated_at as "更新时间"
FROM hs_match_records 
WHERE product_name IN ('置物架', '木制玩具', '电钻', '抛光机', '摄影柔光箱', '耗材干燥盒', '3D打印机', '蒸汽清洗机', '电焊机')
ORDER BY product_name;

