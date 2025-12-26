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

-- 为 欧洲自税清关服务 插入费用项
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, currency, is_required, description, billing_type, cost_price, profit_type, profit_value, supplier_id, supplier_name, supplier_price_id, created_at, updated_at) VALUES
('ed0d483d-7693-480d-be6c-ed668e2fa620', '税号管理费', 'Tax ID management fee', 'IMPORTER''S AGENCY FEE', '票', 200, 'EUR', 1, '', 'fixed', 0, 'amount', 0, NULL, NULL, NULL, NOW(), NOW()),
('ed0d483d-7693-480d-be6c-ed668e2fa620', 'HS Code 品名费', 'HS Code product name fee', '文件费', '个', 8, 'EUR', 0, '', 'fixed', 6, 'amount', 2, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 127, NOW(), NOW()),
('ed0d483d-7693-480d-be6c-ed668e2fa620', '本土税号清关费', 'Local tax number customs clearance fee', '清关服务', '票', 150, 'EUR', 0, '含10个HS', 'fixed', 100, 'amount', 50, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 126, NOW(), NOW()),
('ed0d483d-7693-480d-be6c-ed668e2fa620', '离岸税号清关费', 'Offshore tax number customs clearance fee', '清关服务', '票', 175, 'EUR', 0, '含10个HS', 'fixed', 150, 'amount', 25, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 125, NOW(), NOW()),
('ed0d483d-7693-480d-be6c-ed668e2fa620', '进口关税', 'import duties', '税务费', '次', 0, 'EUR', 0, '', 'actual', 0, 'amount', 0, 'cf58ee15-fb0e-4409-8923-0fb5ad820a00', '', 128, NOW(), NOW());

-- 欧洲运输的费用项太多，这里只插入关键的几个示例
-- 实际费用项应从Virginia数据库完整导出

