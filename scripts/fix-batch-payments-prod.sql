-- =====================================================
-- 生产环境：多发票核销记录合并脚本
-- 问题：旧逻辑为每张发票创建了单独的付款记录
-- 修复：
--   1. 将 REC202601040001, 002, 003 (欧鲸国际) 合并为1条
--   2. 将 REC202601040004 (振韵) 改为 REC202601040002 保持编号连续
-- =====================================================
-- 执行前请备份数据库！
-- 执行命令: psql "$DATABASE_URL" -f fix-batch-payments-prod.sql
-- =====================================================

-- 1. 查看当前所有记录
\echo '=== 步骤1: 查看当前付款记录 ==='
SELECT id, payment_number, invoice_number, customer_name, amount, description
FROM payments 
WHERE payment_number IN ('REC202601040001', 'REC202601040002', 'REC202601040003', 'REC202601040004')
ORDER BY payment_number;

-- 2. 查看关联的发票信息
\echo '=== 步骤2: 查看关联发票 ==='
SELECT id, invoice_number, customer_name, total_amount, paid_amount, status
FROM invoices 
WHERE invoice_number IN ('INV20260000001', 'INV20260000002', 'INV20260000003', 'INV202500000031');

-- =====================================================
-- 开始修复
-- =====================================================

\echo '=== 步骤3: 开始事务 ==='
BEGIN;

-- 4. 合并欧鲸国际的3条记录为1条 (保留 REC202601040001)
\echo '=== 步骤4: 合并欧鲸国际3张发票到 REC202601040001 ==='

WITH invoice_data AS (
  SELECT 
    array_agg(id) AS ids,
    SUM(total_amount) AS total_sum,
    string_agg(invoice_number, ', ' ORDER BY invoice_number) AS invoice_numbers
  FROM invoices 
  WHERE invoice_number IN ('INV20260000001', 'INV20260000002', 'INV20260000003')
)
UPDATE payments 
SET 
  amount = (SELECT total_sum FROM invoice_data),
  invoice_ids = (SELECT array_to_json(ids)::text FROM invoice_data),
  invoice_number = (SELECT invoice_numbers FROM invoice_data),
  description = '批量收款 - 3 张发票',
  updated_at = NOW()
WHERE payment_number = 'REC202601040001';

-- 5. 删除多余的付款记录 (002, 003)
\echo '=== 步骤5: 删除 REC202601040002 和 REC202601040003 ==='
DELETE FROM payments 
WHERE payment_number IN ('REC202601040002', 'REC202601040003');

-- 6. 将 REC202601040004 (振韵) 改为 REC202601040002
\echo '=== 步骤6: 将 REC202601040004 改为 REC202601040002 ==='
UPDATE payments 
SET 
  payment_number = 'REC202601040002',
  updated_at = NOW()
WHERE payment_number = 'REC202601040004';

-- 7. 确保所有发票状态正确
\echo '=== 步骤7: 更新发票状态 ==='
UPDATE invoices 
SET paid_amount = total_amount, status = 'paid', updated_at = NOW()
WHERE invoice_number IN ('INV20260000001', 'INV20260000002', 'INV20260000003');

-- =====================================================
-- 验证结果
-- =====================================================

\echo '=== 步骤8: 验证付款记录 ==='
SELECT id, payment_number, invoice_ids, invoice_number, customer_name, amount, description
FROM payments 
WHERE payment_number IN ('REC202601040001', 'REC202601040002')
ORDER BY payment_number;

\echo '=== 步骤9: 验证发票状态 ==='
SELECT invoice_number, customer_name, total_amount, paid_amount, status
FROM invoices 
WHERE invoice_number IN ('INV20260000001', 'INV20260000002', 'INV20260000003', 'INV202500000031');

-- =====================================================
-- 确认无误后提交
-- =====================================================
\echo '=== 步骤10: 提交事务 ==='
COMMIT;

\echo ''
\echo '=== 修复完成！==='
\echo '修复后的记录:'
\echo '  REC202601040001 - 欧鲸国际 - 11,853.54€ (3张发票合并)'
\echo '  REC202601040002 - 振韵 - 3,770.00€ (原004改为002)'

