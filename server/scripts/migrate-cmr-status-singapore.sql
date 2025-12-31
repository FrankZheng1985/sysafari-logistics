-- ============================================================
-- 新加坡生产数据库迁移脚本
-- 添加 bills_of_lading 表的 cmr_status 相关列
-- 执行日期: 2025-12-26
-- ============================================================

-- 开始事务
BEGIN;

-- 1. 添加 cmr_status 列（用于记录 CMR 派送状态）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills_of_lading' AND column_name = 'cmr_status'
    ) THEN
        ALTER TABLE bills_of_lading ADD COLUMN cmr_status TEXT;
        RAISE NOTICE '✅ bills_of_lading 表已添加 cmr_status 列';
    ELSE
        RAISE NOTICE '✅ bills_of_lading.cmr_status 列已存在';
    END IF;
END $$;

-- 2. 添加 cmr_updated_at 列（用于记录 CMR 状态更新时间）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills_of_lading' AND column_name = 'cmr_updated_at'
    ) THEN
        ALTER TABLE bills_of_lading ADD COLUMN cmr_updated_at TIMESTAMP;
        RAISE NOTICE '✅ bills_of_lading 表已添加 cmr_updated_at 列';
    ELSE
        RAISE NOTICE '✅ bills_of_lading.cmr_updated_at 列已存在';
    END IF;
END $$;

-- 3. 同步 cmr_status 数据（从 delivery_status 复制）
UPDATE bills_of_lading 
SET cmr_status = CASE delivery_status
    WHEN 'pending' THEN 'pending'
    WHEN 'dispatched' THEN 'dispatched'
    WHEN 'in_transit' THEN 'in_transit'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'returned' THEN 'returned'
    ELSE 'pending'
END,
cmr_updated_at = updated_at
WHERE cmr_status IS NULL AND delivery_status IS NOT NULL;

-- 4. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_bills_cmr_status ON bills_of_lading(cmr_status);
CREATE INDEX IF NOT EXISTS idx_bills_cmr_updated_at ON bills_of_lading(cmr_updated_at);

-- 提交事务
COMMIT;

-- 验证结果
SELECT 
    'cmr_status' as column_name,
    COUNT(*) as total_rows,
    COUNT(cmr_status) as non_null_count,
    COUNT(DISTINCT cmr_status) as distinct_values
FROM bills_of_lading;

-- 显示完成信息
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '迁移完成！新加坡生产数据库已更新以下内容：';
    RAISE NOTICE '  1. bills_of_lading.cmr_status 列';
    RAISE NOTICE '  2. bills_of_lading.cmr_updated_at 列';
    RAISE NOTICE '  3. 相关索引';
    RAISE NOTICE '============================================================';
END $$;

