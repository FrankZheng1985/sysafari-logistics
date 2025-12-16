-- ============================================================
-- PostgreSQL 数据库货币默认值更新脚本
-- 将系统本位币从 CNY/USD 统一改为 EUR（欧元）
-- 
-- 执行方式：
-- 1. 本地数据库：psql -d sysafari_dev -f server/scripts/update-currency-to-eur.sql
-- 2. 云端数据库：通过 Render 控制台或 psql 连接执行
-- ============================================================

-- 开始事务
BEGIN;

-- ==================== 第一部分：修改表的默认值 ====================
-- 这只影响新创建的记录，不影响现有数据

-- 费用表
ALTER TABLE fees ALTER COLUMN currency SET DEFAULT 'EUR';

-- 发票表
ALTER TABLE invoices ALTER COLUMN currency SET DEFAULT 'EUR';

-- 付款表
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'EUR';

-- 报价单表
ALTER TABLE quotations ALTER COLUMN currency SET DEFAULT 'EUR';

-- 合同表
ALTER TABLE contracts ALTER COLUMN currency SET DEFAULT 'EUR';

-- 客户表
ALTER TABLE customers ALTER COLUMN currency SET DEFAULT 'EUR';

-- 供应商表
ALTER TABLE suppliers ALTER COLUMN currency SET DEFAULT 'EUR';

-- 运输定价表
ALTER TABLE transport_pricing ALTER COLUMN currency SET DEFAULT 'EUR';

-- 清关单证表
ALTER TABLE clearance_documents ALTER COLUMN currency SET DEFAULT 'EUR';

-- ==================== 第二部分：验证修改结果 ====================

SELECT 
    table_name, 
    column_default as "新默认值"
FROM information_schema.columns 
WHERE column_name = 'currency' 
  AND table_schema = 'public'
ORDER BY table_name;

-- 提交事务
COMMIT;

-- ============================================================
-- 输出成功消息
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ 数据库货币默认值已更新为 EUR（欧元）';
    RAISE NOTICE '';
    RAISE NOTICE '注意：此脚本只修改了表的默认值，不会修改现有数据。';
    RAISE NOTICE '如需更新现有数据的货币值，请执行下面的可选脚本。';
END $$;
