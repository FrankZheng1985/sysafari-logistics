-- ============================================================
-- 导入者追踪功能 - 数据库迁移脚本
-- 功能：记录每次数据导入的操作者信息
-- 创建时间：2025-12-24
-- ============================================================

-- 1. import_records 表添加导入者字段
DO $$ 
BEGIN 
    -- 添加 created_by 字段（用户ID）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'import_records' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE import_records ADD COLUMN created_by INTEGER;
        RAISE NOTICE '✅ import_records.created_by 字段已添加';
    ELSE
        RAISE NOTICE '⏭️ import_records.created_by 字段已存在';
    END IF;

    -- 添加 created_by_name 字段（用户名）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'import_records' AND column_name = 'created_by_name'
    ) THEN
        ALTER TABLE import_records ADD COLUMN created_by_name TEXT;
        RAISE NOTICE '✅ import_records.created_by_name 字段已添加';
    ELSE
        RAISE NOTICE '⏭️ import_records.created_by_name 字段已存在';
    END IF;
END $$;

-- 2. bills_of_lading 表添加导入者字段
DO $$ 
BEGIN 
    -- 添加 imported_by 字段（导入者用户ID）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills_of_lading' AND column_name = 'imported_by'
    ) THEN
        ALTER TABLE bills_of_lading ADD COLUMN imported_by INTEGER;
        RAISE NOTICE '✅ bills_of_lading.imported_by 字段已添加';
    ELSE
        RAISE NOTICE '⏭️ bills_of_lading.imported_by 字段已存在';
    END IF;

    -- 添加 imported_by_name 字段（导入者用户名）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills_of_lading' AND column_name = 'imported_by_name'
    ) THEN
        ALTER TABLE bills_of_lading ADD COLUMN imported_by_name TEXT;
        RAISE NOTICE '✅ bills_of_lading.imported_by_name 字段已添加';
    ELSE
        RAISE NOTICE '⏭️ bills_of_lading.imported_by_name 字段已存在';
    END IF;

    -- 添加 import_time 字段（导入时间）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bills_of_lading' AND column_name = 'import_time'
    ) THEN
        ALTER TABLE bills_of_lading ADD COLUMN import_time TIMESTAMP;
        RAISE NOTICE '✅ bills_of_lading.import_time 字段已添加';
    ELSE
        RAISE NOTICE '⏭️ bills_of_lading.import_time 字段已存在';
    END IF;
END $$;

-- 3. 创建索引以便查询
CREATE INDEX IF NOT EXISTS idx_import_records_created_by ON import_records(created_by);
CREATE INDEX IF NOT EXISTS idx_bills_imported_by ON bills_of_lading(imported_by);

-- 4. 添加注释
COMMENT ON COLUMN import_records.created_by IS '导入操作者用户ID';
COMMENT ON COLUMN import_records.created_by_name IS '导入操作者用户名';
COMMENT ON COLUMN bills_of_lading.imported_by IS '导入操作者用户ID（通过Excel导入时记录）';
COMMENT ON COLUMN bills_of_lading.imported_by_name IS '导入操作者用户名';
COMMENT ON COLUMN bills_of_lading.import_time IS '导入时间';

-- ============================================================
-- 执行完成提示
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '导入者追踪功能 - 数据库迁移完成';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '新增字段：';
    RAISE NOTICE '  - import_records.created_by (导入者ID)';
    RAISE NOTICE '  - import_records.created_by_name (导入者名称)';
    RAISE NOTICE '  - bills_of_lading.imported_by (订单导入者ID)';
    RAISE NOTICE '  - bills_of_lading.imported_by_name (订单导入者名称)';
    RAISE NOTICE '  - bills_of_lading.import_time (导入时间)';
    RAISE NOTICE '============================================================';
END $$;

