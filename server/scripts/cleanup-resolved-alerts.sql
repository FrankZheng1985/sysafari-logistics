-- ============================================
-- 清理已解决的预警记录
-- 说明：将已收款发票、已完成订单等对应的活跃预警标记为已处理
-- 执行时间：2026-01-12
-- ============================================

BEGIN;

-- 1. 清理已收款（paid）发票的 "应收逾期" 预警（payment_due）
UPDATE alert_logs 
SET 
  status = 'handled', 
  handled_by = '系统自动清理', 
  handled_at = NOW(), 
  handle_remark = '发票已收款，系统自动清理历史预警'
WHERE 
  status = 'active' 
  AND alert_type = 'payment_due' 
  AND related_type = 'invoice'
  AND related_id IN (
    SELECT id::text FROM invoices WHERE status = 'paid'
  );

-- 记录清理的数量
DO $$
DECLARE
  cleaned_payment_due INT;
BEGIN
  GET DIAGNOSTICS cleaned_payment_due = ROW_COUNT;
  RAISE NOTICE '已清理 "应收逾期" 预警数量: %', cleaned_payment_due;
END $$;

-- 2. 清理已收款发票的 "账期即将到期" 预警（payment_term_due）
UPDATE alert_logs 
SET 
  status = 'handled', 
  handled_by = '系统自动清理', 
  handled_at = NOW(), 
  handle_remark = '发票已收款，系统自动清理历史预警'
WHERE 
  status = 'active' 
  AND alert_type = 'payment_term_due' 
  AND related_type = 'invoice'
  AND related_id IN (
    SELECT id::text FROM invoices WHERE status = 'paid'
  );

-- 3. 清理已完成订单的 "订单超期" 预警（order_overdue）
UPDATE alert_logs 
SET 
  status = 'handled', 
  handled_by = '系统自动清理', 
  handled_at = NOW(), 
  handle_remark = '订单已完成，系统自动清理历史预警'
WHERE 
  status = 'active' 
  AND alert_type = 'order_overdue' 
  AND related_type = 'order'
  AND related_id IN (
    SELECT id::text FROM bills_of_lading WHERE status = 'completed'
  );

-- 4. 清理客户已无逾期的 "客户多笔逾期" 预警（customer_overdue）
-- 查找没有逾期发票或逾期少于2笔的客户，消除其预警
UPDATE alert_logs 
SET 
  status = 'handled', 
  handled_by = '系统自动清理', 
  handled_at = NOW(), 
  handle_remark = '客户逾期发票已减少，系统自动清理历史预警'
WHERE 
  status = 'active' 
  AND alert_type = 'customer_overdue' 
  AND related_type = 'customer'
  AND related_id IN (
    SELECT c.id::text
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id 
      AND i.status = 'pending' 
      AND i.invoice_type = 'sales'
      AND i.due_date < CURRENT_DATE
    GROUP BY c.id
    HAVING COUNT(i.id) < 2
  );

-- 5. 清理已过期合同的 "合同到期" 预警（如果已经处理或续签）
-- 对于已过期超过30天但仍活跃的合同到期预警，标记为已忽略
UPDATE alert_logs 
SET 
  status = 'ignored', 
  handled_by = '系统自动清理', 
  handled_at = NOW(), 
  handle_remark = '合同已过期超过30天，系统自动清理'
WHERE 
  status = 'active' 
  AND alert_type = 'contract_expire' 
  AND related_type = 'contract'
  AND related_id IN (
    SELECT id::text FROM contracts 
    WHERE end_date < CURRENT_DATE - INTERVAL '30 days'
  );

-- 输出清理汇总
SELECT 
  alert_type,
  COUNT(*) FILTER (WHERE status = 'active') as still_active,
  COUNT(*) FILTER (WHERE status = 'handled') as handled,
  COUNT(*) FILTER (WHERE status = 'ignored') as ignored,
  COUNT(*) as total
FROM alert_logs
GROUP BY alert_type
ORDER BY alert_type;

COMMIT;

-- ============================================
-- 执行说明：
-- 1. 先在测试环境验证
-- 2. 生产环境执行前先备份 alert_logs 表
-- 3. 使用以下命令连接数据库执行：
--    psql -h <host> -U <user> -d <database> -f cleanup-resolved-alerts.sql
-- ============================================
