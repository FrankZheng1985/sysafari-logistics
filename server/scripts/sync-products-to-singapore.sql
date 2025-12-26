-- 同步缺失的产品数据到新加坡数据库
-- 执行时间: 2025-12-26

-- 插入缺失的产品: 欧洲运输
INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_at, updated_at)
VALUES 
  ('70f1aa1f-3ec8-45cb-b652-e176998b6796', 'PRD0003', '欧洲运输', 'EU Transport', 'trucking', '', 1, 0, '2025-12-25T23:19:31.276Z', '2025-12-25T23:19:31.276Z')
ON CONFLICT (id) DO NOTHING;

-- 插入缺失的产品: 欧洲自税清关服务
INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_at, updated_at)
VALUES 
  ('ed0d483d-7693-480d-be6c-ed668e2fa620', 'PRD0004', '欧洲自税清关服务', 'European self-tax customs clearance services', '清关服务', '', 1, 0, '2025-12-26T02:34:47.255Z', '2025-12-26T02:34:47.255Z')
ON CONFLICT (id) DO NOTHING;

-- 先检查欧洲运输是否已有费用项，避免重复插入
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_fee_items WHERE product_id = '70f1aa1f-3ec8-45cb-b652-e176998b6796' LIMIT 1) THEN
    -- 为 欧洲运输 (PRD0003) 插入费用项
    INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, currency, is_required, description, billing_type, cost_price, profit_type, profit_value, supplier_id, supplier_name, supplier_price_id, created_at, updated_at) VALUES
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 56, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 58, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 950, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 59, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1047, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 60, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1047, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 61, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1047, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 62, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 55, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1150, 'EUR', 0, '', 'fixed', 932, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 57, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1065, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 63, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1065, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 64, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1065, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 65, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1250, 'EUR', 0, '', 'fixed', 1040, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 66, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 67, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 68, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 69, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 70, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 71, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1350, 'EUR', 0, '', 'fixed', 1130, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 72, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1350, 'EUR', 0, '', 'fixed', 1137, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 73, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1090, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 74, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1450, 'EUR', 0, '', 'fixed', 1205, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 75, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1450, 'EUR', 0, '', 'fixed', 1205, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 76, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1450, 'EUR', 0, '', 'fixed', 1225, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 77, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1405, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 78, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1405, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 79, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1405, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 80, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1650, 'EUR', 0, '', 'fixed', 1440, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 81, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1700, 'EUR', 0, '', 'fixed', 1467, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 82, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1700, 'EUR', 0, '', 'fixed', 1467, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 83, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1700, 'EUR', 0, '', 'fixed', 1500, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 84, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1900, 'EUR', 0, '', 'fixed', 1665, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 85, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 3300, 'EUR', 0, '', 'fixed', 3100, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 86, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1705, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 87, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1705, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 88, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1705, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 89, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1950, 'EUR', 0, '', 'fixed', 1740, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 90, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 91, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 92, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 93, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2100, 'EUR', 0, '', 'fixed', 1900, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 94, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2250, 'EUR', 0, '', 'fixed', 2005, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 95, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2250, 'EUR', 0, '', 'fixed', 2025, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 96, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2205, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 97, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2750, 'EUR', 0, '', 'fixed', 2525, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 98, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 3750, 'EUR', 0, '', 'fixed', 3550, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 99, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2800, 'EUR', 0, '', 'fixed', 2580, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 100, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2230, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 101, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2250, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 102, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 2450, 'EUR', 0, '', 'fixed', 2250, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 103, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1300, 'EUR', 0, '', 'fixed', 1080, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 104, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 950, 'EUR', 0, '', 'fixed', 737, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 105, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 1550, 'EUR', 0, '', 'fixed', 1350, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 106, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', 'TRANSPORT', '票', 1900, 'EUR', 0, '', 'fixed', 1855, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 107, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提柜送仓费', 'Container Pickup & Delivery', '运输服务', '票', 3750, 'EUR', 0, '', 'fixed', 3550, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '安百', 108, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', 'THC费', 'THC fee', '换单费', '柜', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '', 129, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '提单管理费', 'B/L Management Fee', '文件费', '次', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '', 130, NOW(), NOW()),
    ('70f1aa1f-3ec8-45cb-b652-e176998b6796', '卡车等待费', 'Truck Waiting Fee', '运输服务', '半小时', 50, 'EUR', 0, '', 'fixed', 35, 'amount', 0, '205b8444-c9fa-4069-99cd-13b11462228b', '', 131, NOW(), NOW());
  END IF;
END $$;

-- 先检查欧洲自税清关服务是否已有费用项，避免重复插入
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_fee_items WHERE product_id = 'ed0d483d-7693-480d-be6c-ed668e2fa620' LIMIT 1) THEN
    -- 为 欧洲自税清关服务 (PRD0004) 插入费用项
    INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, currency, is_required, description, billing_type, cost_price, profit_type, profit_value, supplier_id, supplier_name, supplier_price_id, created_at, updated_at) VALUES
    ('ed0d483d-7693-480d-be6c-ed668e2fa620', '税号管理费', 'Tax ID management fee', 'IMPORTER''S AGENCY FEE', '票', 200, 'EUR', 1, '', 'fixed', 0, 'amount', 0, NULL, NULL, NULL, NOW(), NOW()),
    ('ed0d483d-7693-480d-be6c-ed668e2fa620', 'HS Code 品名费', 'HS Code product name fee', '文件费', '个', 8, 'EUR', 0, '', 'fixed', 6, 'amount', 2, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 127, NOW(), NOW()),
    ('ed0d483d-7693-480d-be6c-ed668e2fa620', '本土税号清关费', 'Local tax number customs clearance fee', '清关服务', '票', 150, 'EUR', 0, '含10个HS', 'fixed', 100, 'amount', 50, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 126, NOW(), NOW()),
    ('ed0d483d-7693-480d-be6c-ed668e2fa620', '离岸税号清关费', 'Offshore tax number customs clearance fee', '清关服务', '票', 175, 'EUR', 0, '含10个HS', 'fixed', 150, 'amount', 25, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 125, NOW(), NOW()),
    ('ed0d483d-7693-480d-be6c-ed668e2fa620', '进口关税', 'import duties', '税务费', '次', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 128, NOW(), NOW());
  END IF;
END $$;

