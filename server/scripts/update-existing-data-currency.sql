-- ============================================================
-- PostgreSQL 现有数据货币值更新脚本（可选）
-- ⚠️ 警告：此脚本会修改现有数据，请先备份！
-- 
-- 此脚本将现有记录中的 CNY/USD 货币改为 EUR
-- 仅在确认需要统一历史数据货币时执行
-- ============================================================

-- 开始事务
BEGIN;

-- ==================== 更新前统计 ====================
DO $$
DECLARE
    v_fees_cny INTEGER;
    v_fees_usd INTEGER;
    v_invoices_cny INTEGER;
    v_payments_cny INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_fees_cny FROM fees WHERE currency = 'CNY';
    SELECT COUNT(*) INTO v_fees_usd FROM fees WHERE currency = 'USD';
    SELECT COUNT(*) INTO v_invoices_cny FROM invoices WHERE currency = 'CNY';
    SELECT COUNT(*) INTO v_payments_cny FROM payments WHERE currency = 'CNY';
    
    RAISE NOTICE '';
    RAISE NOTICE '========== 更新前统计 ==========';
    RAISE NOTICE '费用表 CNY 记录数: %', v_fees_cny;
    RAISE NOTICE '费用表 USD 记录数: %', v_fees_usd;
    RAISE NOTICE '发票表 CNY 记录数: %', v_invoices_cny;
    RAISE NOTICE '付款表 CNY 记录数: %', v_payments_cny;
    RAISE NOTICE '================================';
    RAISE NOTICE '';
END $$;

-- ==================== 更新费用表 ====================
UPDATE fees SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新发票表 ====================
UPDATE invoices SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新付款表 ====================
UPDATE payments SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新报价单表 ====================
UPDATE quotations SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新合同表 ====================
UPDATE contracts SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新客户表 ====================
UPDATE customers SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新供应商表 ====================
UPDATE suppliers SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新运输定价表 ====================
UPDATE transport_pricing SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新清关单证表 ====================
UPDATE clearance_documents SET currency = 'EUR' WHERE currency IN ('CNY', 'USD');

-- ==================== 更新后验证 ====================
DO $$
DECLARE
    v_fees_eur INTEGER;
    v_invoices_eur INTEGER;
    v_payments_eur INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_fees_eur FROM fees WHERE currency = 'EUR';
    SELECT COUNT(*) INTO v_invoices_eur FROM invoices WHERE currency = 'EUR';
    SELECT COUNT(*) INTO v_payments_eur FROM payments WHERE currency = 'EUR';
    
    RAISE NOTICE '';
    RAISE NOTICE '========== 更新后统计 ==========';
    RAISE NOTICE '费用表 EUR 记录数: %', v_fees_eur;
    RAISE NOTICE '发票表 EUR 记录数: %', v_invoices_eur;
    RAISE NOTICE '付款表 EUR 记录数: %', v_payments_eur;
    RAISE NOTICE '================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ 现有数据货币值已更新为 EUR';
END $$;

-- 提交事务
COMMIT;
