-- 修复已删除发票关联费用未回流到待开票状态的问题
-- 案例：CAAU6886446 开了发票后作废删除，费用未回流到待开票
-- 执行时间：2026-01-09
-- 
-- 使用方法：
-- 1. 先执行查询语句查看受影响的记录
-- 2. 确认无误后执行更新语句

-- ============================================================
-- 步骤1：查找已删除发票及其关联的费用
-- ============================================================

-- 查看已删除的发票（包含指定柜号）
SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    i.container_numbers,
    i.fee_ids,
    i.is_deleted,
    i.deleted_at,
    i.total_amount,
    i.status
FROM invoices i
WHERE i.is_deleted = TRUE
AND i.container_numbers LIKE '%CAAU6886446%';

-- ============================================================
-- 步骤2：查看这些发票关联的费用记录当前状态
-- ============================================================

-- 查找柜号 CAAU6886446 关联的所有费用记录
SELECT 
    f.id AS fee_id,
    f.fee_name,
    f.amount,
    f.fee_type,
    f.invoice_status,
    f.invoice_number,
    f.invoice_date,
    b.bill_number,
    b.container_number
FROM fees f
JOIN bills_of_lading b ON f.bill_id = b.id
WHERE b.container_number = 'CAAU6886446';

-- ============================================================
-- 步骤3：修复 - 重置费用的开票状态
-- ============================================================

-- 方法A：根据柜号直接重置（推荐）
-- 找到所有关联已删除发票的费用，重置它们的开票状态
UPDATE fees f
SET 
    invoice_status = 'not_invoiced',
    invoice_number = NULL,
    invoice_date = NULL,
    updated_at = NOW()
FROM bills_of_lading b
WHERE f.bill_id = b.id
AND b.container_number = 'CAAU6886446'
AND f.invoice_status = 'invoiced'
AND NOT EXISTS (
    -- 确保没有有效的发票关联
    SELECT 1 FROM invoices i 
    WHERE (i.is_deleted IS NULL OR i.is_deleted = FALSE)
    AND i.fee_ids LIKE '%' || f.id || '%'
);

-- ============================================================
-- 步骤4：验证修复结果
-- ============================================================

-- 再次查看费用状态，确认已重置
SELECT 
    f.id AS fee_id,
    f.fee_name,
    f.amount,
    f.fee_type,
    f.invoice_status,
    f.invoice_number,
    b.container_number
FROM fees f
JOIN bills_of_lading b ON f.bill_id = b.id
WHERE b.container_number = 'CAAU6886446';

-- ============================================================
-- 批量修复所有已删除发票关联的费用（可选，谨慎使用）
-- ============================================================

-- 查找所有需要修复的费用（与已删除发票关联但状态仍为invoiced的费用）
-- SELECT 
--     f.id AS fee_id,
--     f.fee_name,
--     f.invoice_status,
--     f.invoice_number,
--     i.invoice_number AS deleted_invoice_number,
--     i.deleted_at
-- FROM fees f
-- JOIN invoices i ON i.fee_ids LIKE '%' || f.id || '%'
-- WHERE i.is_deleted = TRUE
-- AND f.invoice_status = 'invoiced';

-- 批量更新（取消注释执行）
-- UPDATE fees f
-- SET 
--     invoice_status = 'not_invoiced',
--     invoice_number = NULL,
--     invoice_date = NULL,
--     updated_at = NOW()
-- FROM invoices i
-- WHERE i.fee_ids LIKE '%' || f.id || '%'
-- AND i.is_deleted = TRUE
-- AND f.invoice_status = 'invoiced';
