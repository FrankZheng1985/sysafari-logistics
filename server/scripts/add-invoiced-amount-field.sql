-- ================================================================
-- 添加已开票金额字段，支持部分开票功能
-- 执行时间: 2026-01-16
-- 问题描述: 费用开了部分金额后，无法继续开剩余金额
-- ================================================================

-- 1. 添加已开票金额字段
ALTER TABLE fees ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC DEFAULT 0;

-- 2. 更新现有已开票费用的 invoiced_amount
-- 对于已经标记为 invoiced 的费用，将 invoiced_amount 设为费用金额
UPDATE fees 
SET invoiced_amount = amount 
WHERE invoice_status = 'invoiced' 
  AND (invoiced_amount IS NULL OR invoiced_amount = 0);

-- 3. 确保 invoiced_amount 不为 NULL
UPDATE fees 
SET invoiced_amount = 0 
WHERE invoiced_amount IS NULL;

-- 4. 添加注释
COMMENT ON COLUMN fees.invoiced_amount IS '已开票金额，支持部分开票。当 invoiced_amount >= amount 时，invoice_status 才设为 invoiced';

-- 验证：查看修改结果
SELECT 
    invoice_status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    SUM(invoiced_amount) as total_invoiced_amount
FROM fees 
GROUP BY invoice_status;
