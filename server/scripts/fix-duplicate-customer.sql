-- 修复重复客户问题
-- 正确客户：傲翼-自主VAT（编码：CUSMJFKVCBZTRH）
-- 重复客户：傲以-自主VAT（编码：CUSMJJPLO66WE4）
-- 需要更新的订单：BP2500535, BP2500536, BP2500537, BP2500538

-- 步骤1：查询两个客户的信息
SELECT '=== 步骤1：查询客户信息 ===' AS step;

SELECT id, customer_code, customer_name, company_name, customer_type, status, created_at
FROM customers 
WHERE customer_code IN ('CUSMJFKVCBZTRH', 'CUSMJJPLO66WE4');

-- 步骤2：查询需要更新的订单当前状态
SELECT '=== 步骤2：查询订单当前状态 ===' AS step;

SELECT id, bill_number, container_number, customer_id, customer_name, shipper
FROM bills_of_lading
WHERE bill_number IN ('010501331342', '010501321495', '010501318460', '149509272452');

-- 步骤3：更新订单的客户信息（将重复客户改为正确客户）
SELECT '=== 步骤3：更新订单客户信息 ===' AS step;

UPDATE bills_of_lading
SET customer_id = 'CUSMJFKVCBZTRH',
    customer_name = '傲翼-自主VAT',
    shipper = '傲翼-自主VAT',
    updated_at = NOW()
WHERE bill_number IN ('010501331342', '010501321495', '010501318460', '149509272452')
  AND customer_id = 'CUSMJJPLO66WE4';

-- 步骤4：验证更新结果
SELECT '=== 步骤4：验证更新结果 ===' AS step;

SELECT id, bill_number, container_number, customer_id, customer_name, shipper
FROM bills_of_lading
WHERE bill_number IN ('010501331342', '010501321495', '010501318460', '149509272452');

-- 步骤5：检查是否还有其他订单关联到重复客户
SELECT '=== 步骤5：检查重复客户的其他关联订单 ===' AS step;

SELECT id, bill_number, container_number, customer_id, customer_name
FROM bills_of_lading
WHERE customer_id = 'CUSMJJPLO66WE4';

-- 步骤6：检查客户相关的其他表（联系人、跟进记录等）
SELECT '=== 步骤6：检查关联数据 ===' AS step;

SELECT 'customer_contacts' as table_name, COUNT(*) as count FROM customer_contacts WHERE customer_id = 'CUSMJJPLO66WE4'
UNION ALL
SELECT 'customer_follow_ups' as table_name, COUNT(*) as count FROM customer_follow_ups WHERE customer_id = 'CUSMJJPLO66WE4'
UNION ALL
SELECT 'customer_addresses' as table_name, COUNT(*) as count FROM customer_addresses WHERE customer_id = 'CUSMJJPLO66WE4'
UNION ALL
SELECT 'customer_tax_numbers' as table_name, COUNT(*) as count FROM customer_tax_numbers WHERE customer_id = 'CUSMJJPLO66WE4';

-- 步骤7：删除重复客户（仅当没有其他关联数据时）
-- 注意：如果还有关联数据，需要先处理或迁移

SELECT '=== 步骤7：删除重复客户 ===' AS step;

DELETE FROM customers
WHERE customer_code = 'CUSMJJPLO66WE4';

-- 步骤8：最终确认
SELECT '=== 步骤8：最终确认 ===' AS step;

SELECT id, customer_code, customer_name, status
FROM customers 
WHERE customer_name LIKE '%傲%' AND customer_name LIKE '%VAT%';

SELECT '=== 修复完成 ===' AS step;

