-- ============================================================
-- 数据库问题修复脚本 - 第二部分
-- 创建时间: 2025-12-25
-- 说明: 修复以下数据库问题
--   1. suppliers 表缺少 supplier_code 唯一约束
--   2. bills_of_lading 表缺少 cmr_status 和 cmr_updated_at 列
-- ============================================================

-- ==================== 1. 修复 suppliers 表唯一约束 ====================
-- 先检查并添加 supplier_code 唯一约束
DO $$
BEGIN
    -- 检查是否已有唯一约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'suppliers' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%supplier_code%'
    ) THEN
        -- 尝试添加唯一约束
        BEGIN
            ALTER TABLE suppliers ADD CONSTRAINT suppliers_supplier_code_unique UNIQUE (supplier_code);
            RAISE NOTICE '✅ suppliers 表已添加 supplier_code 唯一约束';
        EXCEPTION WHEN OTHERS THEN
            -- 如果有重复数据，先清理
            RAISE NOTICE '⚠️ 添加唯一约束失败，尝试清理重复数据: %', SQLERRM;
            
            -- 删除重复记录（保留最新的）
            DELETE FROM suppliers a USING suppliers b 
            WHERE a.supplier_code = b.supplier_code 
            AND a.created_at < b.created_at;
            
            -- 重新尝试添加约束
            BEGIN
                ALTER TABLE suppliers ADD CONSTRAINT suppliers_supplier_code_unique UNIQUE (supplier_code);
                RAISE NOTICE '✅ suppliers 表已添加 supplier_code 唯一约束（清理重复后）';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '⚠️ 仍然无法添加唯一约束: %', SQLERRM;
            END;
        END;
    ELSE
        RAISE NOTICE '✅ suppliers.supplier_code 唯一约束已存在';
    END IF;
END $$;

-- ==================== 2. 添加 bills_of_lading 缺失的 CMR 列 ====================
-- 添加 cmr_status 列（用于记录 CMR 派送状态）
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

-- 添加 cmr_updated_at 列（用于记录 CMR 更新时间）
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

-- 同步 cmr_status 数据（从 delivery_status 复制）
UPDATE bills_of_lading 
SET cmr_status = CASE delivery_status
    WHEN '待派送' THEN 'pending'
    WHEN '派送中' THEN 'delivering'
    WHEN '已送达' THEN 'delivered'
    WHEN '订单异常' THEN 'exception'
    WHEN '异常关闭' THEN 'exception'
    ELSE NULL
END
WHERE cmr_status IS NULL AND delivery_status IS NOT NULL;

-- 同步 cmr_updated_at 数据
UPDATE bills_of_lading 
SET cmr_updated_at = updated_at
WHERE cmr_updated_at IS NULL AND updated_at IS NOT NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bills_cmr_status ON bills_of_lading(cmr_status);
CREATE INDEX IF NOT EXISTS idx_bills_cmr_updated ON bills_of_lading(cmr_updated_at DESC);

-- ==================== 完成提示 ====================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ 数据库补充修复完成！';
    RAISE NOTICE '修复项目:';
    RAISE NOTICE '  1. suppliers.supplier_code 唯一约束';
    RAISE NOTICE '  2. bills_of_lading.cmr_status 列';
    RAISE NOTICE '  3. bills_of_lading.cmr_updated_at 列';
    RAISE NOTICE '============================================================';
END $$;

