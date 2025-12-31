-- ========================================
-- 迁移脚本：为 fees 表添加 fee_number 列
-- 执行时间：2024-12
-- 说明：修复 fees 表缺少 fee_number 列的问题
-- ========================================

-- 1. 添加 fee_number 列（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fees' AND column_name = 'fee_number'
    ) THEN
        ALTER TABLE fees ADD COLUMN fee_number TEXT;
        RAISE NOTICE 'fee_number 列已添加';
    ELSE
        RAISE NOTICE 'fee_number 列已存在，跳过添加';
    END IF;
END $$;

-- 2. 为现有记录生成 fee_number（如果为空）
UPDATE fees
SET fee_number = 'FEE-' || TO_CHAR(COALESCE(created_at, CURRENT_TIMESTAMP), 'YYYYMMDD') || '-' || LPAD(
    (ROW_NUMBER() OVER (ORDER BY created_at, id))::TEXT, 
    4, 
    '0'
)
WHERE fee_number IS NULL OR fee_number = '';

-- 3. 设置 NOT NULL 约束（先确保所有记录都有值）
-- 注意：如果有大量数据，这一步可能会失败，需要先检查是否有空值
DO $$ 
BEGIN
    -- 检查是否有空值
    IF EXISTS (SELECT 1 FROM fees WHERE fee_number IS NULL OR fee_number = '') THEN
        RAISE EXCEPTION '仍有记录的 fee_number 为空，请先处理';
    END IF;
    
    -- 添加 NOT NULL 约束
    ALTER TABLE fees ALTER COLUMN fee_number SET NOT NULL;
    RAISE NOTICE 'NOT NULL 约束已添加';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE '添加 NOT NULL 约束失败: %', SQLERRM;
END $$;

-- 4. 添加唯一索引（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'fees' AND indexname = 'fees_fee_number_key'
    ) THEN
        -- 先检查是否有重复值
        IF EXISTS (
            SELECT fee_number FROM fees GROUP BY fee_number HAVING COUNT(*) > 1
        ) THEN
            RAISE NOTICE '存在重复的 fee_number，跳过唯一约束';
        ELSE
            ALTER TABLE fees ADD CONSTRAINT fees_fee_number_key UNIQUE (fee_number);
            RAISE NOTICE '唯一约束已添加';
        END IF;
    ELSE
        RAISE NOTICE '唯一约束已存在，跳过';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE '添加唯一约束失败: %', SQLERRM;
END $$;

-- 5. 验证
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'fees' AND column_name = 'fee_number';
