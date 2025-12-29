-- ============================================
-- Sysafari Logistics 演示环境数据脚本
-- 包含：5个用户、10个客户、15个订单
-- 执行方式：psql -h RDS地址 -U 用户名 -d sysafari_demo -f demo-data.sql
-- ============================================

-- 开始事务
BEGIN;

-- ==================== 1. 用户数据 (5个) ====================
-- 密码都是 demo123 (bcrypt hash)
INSERT INTO users (username, password_hash, name, email, phone, role, status) VALUES
('demo_admin', '$2b$10$rQZ7.HKlUVLXZJ7L8tQKOeqJYZ7vXHZJ7L8tQKOeqJYZ7vXHZJ7L8', '演示管理员', 'admin@demo.com', '13800000001', 'admin', 'active'),
('sales_wang', '$2b$10$rQZ7.HKlUVLXZJ7L8tQKOeqJYZ7vXHZJ7L8tQKOeqJYZ7vXHZJ7L8', '王小明', 'wang@demo.com', '13800000002', 'sales', 'active'),
('ops_li', '$2b$10$rQZ7.HKlUVLXZJ7L8tQKOeqJYZ7vXHZJ7L8tQKOeqJYZ7vXHZJ7L8', '李运营', 'li@demo.com', '13800000003', 'operator', 'active'),
('finance_zhang', '$2b$10$rQZ7.HKlUVLXZJ7L8tQKOeqJYZ7vXHZJ7L8tQKOeqJYZ7vXHZJ7L8', '张财务', 'zhang@demo.com', '13800000004', 'finance', 'active'),
('viewer_chen', '$2b$10$rQZ7.HKlUVLXZJ7L8tQKOeqJYZ7vXHZJ7L8tQKOeqJYZ7vXHZJ7L8', '陈查看', 'chen@demo.com', '13800000005', 'viewer', 'active')
ON CONFLICT (username) DO NOTHING;

-- ==================== 2. 客户数据 (10个) ====================
INSERT INTO customers (id, customer_code, customer_name, company_name, company_name_en, customer_type, customer_level, contact_person, contact_phone, contact_email, country_code, city, address, status) VALUES
('CUST001', 'C20250001', '深圳华为技术有限公司', '深圳华为技术有限公司', 'Huawei Technologies Co., Ltd.', 'shipper', 'vip', '张经理', '13911111111', 'zhang@huawei.com', 'CN', '深圳', '深圳市龙岗区坂田华为基地', 'active'),
('CUST002', 'C20250002', '广州小米科技', '广州小米科技有限公司', 'Xiaomi Technology Co., Ltd.', 'shipper', 'important', '李总', '13922222222', 'li@xiaomi.com', 'CN', '广州', '广州市天河区珠江新城', 'active'),
('CUST003', 'C20250003', '上海比亚迪', '上海比亚迪汽车有限公司', 'BYD Auto Co., Ltd.', 'shipper', 'normal', '王工', '13933333333', 'wang@byd.com', 'CN', '上海', '上海市浦东新区张江高科', 'active'),
('CUST004', 'C20250004', 'Hamburg Import GmbH', 'Hamburg Import GmbH', 'Hamburg Import GmbH', 'consignee', 'vip', 'Hans Mueller', '+49170111222', 'hans@hamburg-import.de', 'DE', 'Hamburg', 'Hafenstraße 123, 20459 Hamburg', 'active'),
('CUST005', 'C20250005', 'Rotterdam Trading B.V.', 'Rotterdam Trading B.V.', 'Rotterdam Trading B.V.', 'consignee', 'important', 'Jan de Vries', '+31612345678', 'jan@rotterdam-trading.nl', 'NL', 'Rotterdam', 'Europaweg 100, 3199 Rotterdam', 'active'),
('CUST006', 'C20250006', 'Paris Logistics SARL', 'Paris Logistics SARL', 'Paris Logistics SARL', 'consignee', 'normal', 'Pierre Dubois', '+33612345678', 'pierre@paris-logistics.fr', 'FR', 'Paris', '15 Rue de Commerce, 75015 Paris', 'active'),
('CUST007', 'C20250007', '宁波海天塑机', '宁波海天塑机集团', 'Haitian Plastics Machinery', 'shipper', 'important', '陈总监', '13744444444', 'chen@haitian.com', 'CN', '宁波', '宁波市北仑区海天路1号', 'active'),
('CUST008', 'C20250008', 'Milan Fashion SRL', 'Milan Fashion SRL', 'Milan Fashion SRL', 'consignee', 'normal', 'Marco Rossi', '+39321234567', 'marco@milan-fashion.it', 'IT', 'Milan', 'Via Roma 50, 20121 Milano', 'active'),
('CUST009', 'C20250009', '东莞三星电子', '东莞三星电子有限公司', 'Samsung Electronics Dongguan', 'shipper', 'vip', '朴经理', '13855555555', 'park@samsung.com', 'CN', '东莞', '东莞市松山湖高新区', 'active'),
('CUST010', 'C20250010', 'Barcelona Imports S.L.', 'Barcelona Imports S.L.', 'Barcelona Imports S.L.', 'consignee', 'normal', 'Carlos Garcia', '+34612345678', 'carlos@barcelona-imports.es', 'ES', 'Barcelona', 'Carrer de Marina 200, 08013 Barcelona', 'active')
ON CONFLICT (id) DO NOTHING;

-- ==================== 3. 订单/提单数据 (15个) ====================
INSERT INTO bills_of_lading (id, bill_number, container_number, vessel, voyage, shipping_company, etd, eta, pieces, weight, volume, description, port_of_loading, port_of_discharge, shipper, consignee, status, ship_status, customs_status, creator, create_time, created_at) VALUES
('BL20250001', 'COSU1234567890', 'CSLU1234567', 'COSCO SHIPPING ARIES', '025E', 'COSCO', '2025-12-01', '2025-12-20', 500, 12500.00, 45.5, 'Electronics', 'CNSHA', 'DEHAM', 'Huawei Tech', 'Hamburg Import', 'completed', 'arrived', 'cleared', 'admin', '2025-12-01 10:00:00', '2025-12-01 10:00:00'),
('BL20250002', 'MAEU2345678901', 'MSKU2345678', 'MAERSK SELETAR', '051W', 'MAERSK', '2025-12-03', '2025-12-22', 320, 8000.00, 32.0, 'Machinery Parts', 'CNNBO', 'NLRTM', 'Haitian Plastics', 'Rotterdam Trading', 'completed', 'arrived', 'cleared', 'admin', '2025-12-03 09:30:00', '2025-12-03 09:30:00'),
('BL20250003', 'EGLV3456789012', 'EGLU3456789', 'EVER GIVEN', '088E', 'EVERGREEN', '2025-12-05', '2025-12-24', 1200, 30000.00, 120.0, 'Auto Parts', 'CNSHA', 'FRLEH', 'BYD Auto', 'Paris Logistics', 'completed', 'arrived', 'cleared', 'admin', '2025-12-05 14:00:00', '2025-12-05 14:00:00'),
('BL20250004', 'ONEY4567890123', 'ONEU4567890', 'ONE COMMITMENT', '032E', 'ONE', '2025-12-15', '2026-01-05', 800, 20000.00, 80.0, 'Textiles', 'CNGZU', 'ITMIL', 'Xiaomi Tech', 'Milan Fashion', 'in_progress', 'in_transit', 'pending', 'admin', '2025-12-15 11:00:00', '2025-12-15 11:00:00'),
('BL20250005', 'HLCU5678901234', 'HLXU5678901', 'HAPAG TOKYO', '066W', 'HAPAG-LLOYD', '2025-12-18', '2026-01-08', 450, 11250.00, 40.5, 'Home Appliances', 'CNSZX', 'DEHAM', 'Samsung Dongguan', 'Hamburg Import', 'in_progress', 'in_transit', 'pending', 'admin', '2025-12-18 16:00:00', '2025-12-18 16:00:00'),
('BL20250006', 'YMLU6789012345', 'YMLU6789012', 'YM UNANIMITY', '045E', 'YANG MING', '2025-12-20', '2026-01-10', 600, 15000.00, 55.0, 'Plastic Products', 'CNNBO', 'ESBCN', 'Haitian Plastics', 'Barcelona Imports', 'in_progress', 'in_transit', 'pending', 'admin', '2025-12-20 08:30:00', '2025-12-20 08:30:00'),
('BL20250007', 'MSCU7890123456', 'MSCU7890123', 'MSC GULSUN', '089W', 'MSC', '2025-12-22', '2026-01-12', 280, 7000.00, 25.0, 'Hardware Tools', 'CNSHA', 'NLRTM', 'Huawei Tech', 'Rotterdam Trading', 'in_progress', 'in_transit', 'pending', 'admin', '2025-12-22 10:00:00', '2025-12-22 10:00:00'),
('BL20250008', 'COSU8901234567', 'CCLU8901234', 'COSCO PRIDE', '033E', 'COSCO', '2025-12-28', '2026-01-18', 950, 23750.00, 90.0, 'Electronic Components', 'CNSZX', 'DEHAM', 'Samsung Dongguan', 'Hamburg Import', 'pending', 'not_shipped', 'not_declared', 'admin', '2025-12-26 09:00:00', '2025-12-26 09:00:00'),
('BL20250009', 'MAEU9012345678', 'MSKU9012345', 'MAERSK EMERALD', '067E', 'MAERSK', '2025-12-29', '2026-01-19', 400, 10000.00, 36.0, 'Medical Equipment', 'CNSHA', 'FRLEH', 'BYD Auto', 'Paris Logistics', 'pending', 'not_shipped', 'not_declared', 'admin', '2025-12-27 14:30:00', '2025-12-27 14:30:00'),
('BL20250010', 'EGLV0123456789', 'EGLU0123456', 'EVER GLORY', '100W', 'EVERGREEN', '2025-12-30', '2026-01-20', 720, 18000.00, 65.0, 'Furniture', 'CNGZU', 'ITMIL', 'Xiaomi Tech', 'Milan Fashion', 'pending', 'not_shipped', 'not_declared', 'admin', '2025-12-28 11:00:00', '2025-12-28 11:00:00'),
('BL20250011', 'ONEY1234509876', 'ONEU1234509', 'ONE INNOVATION', '055E', 'ONE', '2025-12-25', '2026-01-15', 550, 13750.00, 50.0, 'Toys', 'CNSHA', 'ESBCN', 'Huawei Tech', 'Barcelona Imports', 'in_progress', 'in_transit', 'pending', 'admin', '2025-12-23 15:00:00', '2025-12-23 15:00:00'),
('BL20250012', 'HLCU2345609876', 'HLXU2345609', 'HAPAG BERLIN', '078W', 'HAPAG-LLOYD', '2025-12-26', '2026-01-16', 380, 9500.00, 34.0, 'Chemical Products', 'CNNBO', 'NLRTM', 'Haitian Plastics', 'Rotterdam Trading', 'in_progress', 'in_transit', 'pending', 'admin', '2025-12-24 10:30:00', '2025-12-24 10:30:00'),
('BL20250013', 'YMLU3456709876', 'YMLU3456709', 'YM ULTIMATE', '056E', 'YANG MING', '2025-12-27', '2026-01-17', 680, 17000.00, 62.0, 'Ceramics', 'CNGZU', 'DEHAM', 'Xiaomi Tech', 'Hamburg Import', 'pending', 'not_shipped', 'not_declared', 'admin', '2025-12-25 09:00:00', '2025-12-25 09:00:00'),
('BL20250014', 'MSCU4567809876', 'MSCU4567809', 'MSC MAGNIFICA', '099E', 'MSC', '2025-12-28', '2026-01-18', 420, 10500.00, 38.0, 'LED Lighting', 'CNSZX', 'FRLEH', 'Samsung Dongguan', 'Paris Logistics', 'pending', 'not_shipped', 'not_declared', 'admin', '2025-12-26 13:00:00', '2025-12-26 13:00:00'),
('BL20250015', 'COSU5678909876', 'CCLU5678909', 'COSCO GALAXY', '042W', 'COSCO', '2025-12-29', '2026-01-19', 850, 21250.00, 78.0, 'Textile Machinery', 'CNSHA', 'ITMIL', 'BYD Auto', 'Milan Fashion', 'pending', 'not_shipped', 'not_declared', 'admin', '2025-12-27 16:30:00', '2025-12-27 16:30:00')
ON CONFLICT (id) DO NOTHING;

-- 提交事务
COMMIT;

-- 验证数据
SELECT '=== Demo Data Import Complete ===' as message;
SELECT 'Users: ' || COUNT(*) as count FROM users;
SELECT 'Customers: ' || COUNT(*) as count FROM customers;
SELECT 'Bills: ' || COUNT(*) as count FROM bills_of_lading;

