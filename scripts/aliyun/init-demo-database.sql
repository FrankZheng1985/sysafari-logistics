-- ============================================
-- 演示环境数据库初始化脚本
-- 创建独立的演示数据库和测试数据
-- ============================================

-- 1. 创建演示数据库（在 PostgreSQL 中以超级用户执行）
-- CREATE DATABASE sysafari_demo;

-- 2. 创建演示用户
-- CREATE USER demo_user WITH PASSWORD 'demo_password_change_me';
-- GRANT ALL PRIVILEGES ON DATABASE sysafari_demo TO demo_user;

-- ============================================
-- 以下在 sysafari_demo 数据库中执行
-- ============================================

-- 清空并重置序列（如果需要重置数据）
-- TRUNCATE TABLE bills, customers, cmr_records, fees, ... RESTART IDENTITY CASCADE;

-- ============================================
-- 插入演示测试数据
-- ============================================

-- 演示用户
INSERT INTO users (id, email, name, role, user_type, is_active, created_at) VALUES
(1, 'admin@demo.com', '演示管理员', 'admin', 'normal', true, NOW()),
(2, 'operator@demo.com', '演示操作员', 'operator', 'normal', true, NOW()),
(3, 'viewer@demo.com', '演示查看员', 'viewer', 'normal', true, NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 演示客户
INSERT INTO customers (id, company_name, contact_name, email, phone, country, created_at) VALUES
(1, '演示贸易公司A', '张先生', 'zhang@demo-trade-a.com', '13800138001', 'CN', NOW()),
(2, '演示贸易公司B', '李女士', 'li@demo-trade-b.com', '13800138002', 'CN', NOW()),
(3, '演示物流公司C', '王经理', 'wang@demo-logistics.com', '13800138003', 'CN', NOW()),
(4, 'Demo Trading Co.', 'John Smith', 'john@demo-trading.eu', '+49123456789', 'DE', NOW()),
(5, 'Test Import Ltd.', 'Jane Doe', 'jane@test-import.eu', '+31987654321', 'NL', NOW())
ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name;

-- 演示订单（提单）
INSERT INTO bills (id, bill_number, customer_id, status, created_by, transport_type, container_no, created_at) VALUES
(1, 'DEMO-2025-001', 1, 'pending', 1, 'sea', 'DEMO1234567', NOW() - INTERVAL '10 days'),
(2, 'DEMO-2025-002', 2, 'in_progress', 1, 'sea', 'DEMO2345678', NOW() - INTERVAL '8 days'),
(3, 'DEMO-2025-003', 3, 'completed', 1, 'air', NULL, NOW() - INTERVAL '15 days'),
(4, 'DEMO-2025-004', 4, 'pending', 2, 'sea', 'DEMO3456789', NOW() - INTERVAL '5 days'),
(5, 'DEMO-2025-005', 5, 'in_progress', 2, 'rail', NULL, NOW() - INTERVAL '3 days'),
(6, 'DEMO-2025-006', 1, 'completed', 1, 'sea', 'DEMO4567890', NOW() - INTERVAL '20 days'),
(7, 'DEMO-2025-007', 2, 'pending', 1, 'air', NULL, NOW() - INTERVAL '2 days'),
(8, 'DEMO-2025-008', 3, 'in_progress', 2, 'sea', 'DEMO5678901', NOW() - INTERVAL '7 days'),
(9, 'DEMO-2025-009', 4, 'completed', 1, 'sea', 'DEMO6789012', NOW() - INTERVAL '25 days'),
(10, 'DEMO-2025-010', 5, 'pending', 2, 'air', NULL, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO UPDATE SET bill_number = EXCLUDED.bill_number;

-- 演示 CMR 运输记录
INSERT INTO cmr_records (id, bill_id, cmr_number, status, driver_name, truck_plate, created_at) VALUES
(1, 1, 'CMR-DEMO-001', 'pending', '演示司机A', '粤B12345', NOW() - INTERVAL '5 days'),
(2, 2, 'CMR-DEMO-002', 'delivering', '演示司机B', '粤A67890', NOW() - INTERVAL '3 days'),
(3, 3, 'CMR-DEMO-003', 'delivered', '演示司机C', '沪C11111', NOW() - INTERVAL '12 days'),
(4, 6, 'CMR-DEMO-004', 'delivered', '演示司机D', '苏D22222', NOW() - INTERVAL '18 days'),
(5, 9, 'CMR-DEMO-005', 'delivered', '演示司机E', '浙E33333', NOW() - INTERVAL '22 days')
ON CONFLICT (id) DO UPDATE SET cmr_number = EXCLUDED.cmr_number;

-- 演示费用记录
INSERT INTO fees (id, bill_id, fee_type, amount, currency, status, created_at) VALUES
(1, 1, 'import_duty', 1500.00, 'EUR', 'pending', NOW() - INTERVAL '5 days'),
(2, 1, 'vat', 285.00, 'EUR', 'pending', NOW() - INTERVAL '5 days'),
(3, 2, 'import_duty', 2300.00, 'EUR', 'paid', NOW() - INTERVAL '6 days'),
(4, 2, 'handling', 150.00, 'EUR', 'paid', NOW() - INTERVAL '6 days'),
(5, 3, 'import_duty', 800.00, 'EUR', 'paid', NOW() - INTERVAL '14 days'),
(6, 4, 'import_duty', 3200.00, 'EUR', 'pending', NOW() - INTERVAL '4 days'),
(7, 5, 'import_duty', 1800.00, 'EUR', 'pending', NOW() - INTERVAL '2 days'),
(8, 6, 'import_duty', 2500.00, 'EUR', 'paid', NOW() - INTERVAL '19 days'),
(9, 9, 'import_duty', 4100.00, 'EUR', 'paid', NOW() - INTERVAL '24 days'),
(10, 10, 'import_duty', 950.00, 'EUR', 'pending', NOW())
ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;

-- 重置序列
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
SELECT setval('bills_id_seq', (SELECT MAX(id) FROM bills));
SELECT setval('cmr_records_id_seq', (SELECT MAX(id) FROM cmr_records));
SELECT setval('fees_id_seq', (SELECT MAX(id) FROM fees));

-- ============================================
-- 完成
-- ============================================
-- 演示数据库初始化完成
-- 演示账号:
--   admin@demo.com (管理员)
--   operator@demo.com (操作员)
--   viewer@demo.com (查看员)
-- 
-- 测试数据:
--   - 5 个演示客户
--   - 10 个演示订单
--   - 5 个 CMR 运输记录
--   - 10 条费用记录
-- ============================================

