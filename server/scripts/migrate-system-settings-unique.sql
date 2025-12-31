-- ============================================================
-- 迁移脚本: 修复 system_settings 表的唯一约束
-- 日期: 2025-12-21
-- 问题: 板块开关保存失败
-- 原因: setting_key 列缺少唯一约束，导致 ON CONFLICT 语句失败
-- ============================================================

-- 检查当前约束情况
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'system_settings';

-- 步骤 1: 检查是否有重复的 setting_key（如果有需要先处理）
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT setting_key, COUNT(*) as cnt
        FROM system_settings
        WHERE setting_key IS NOT NULL
        GROUP BY setting_key
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE '⚠️ 发现 % 个重复的 setting_key，请先手动处理重复数据', duplicate_count;
        -- 显示重复的数据
        RAISE NOTICE '重复的 setting_key 列表:';
    ELSE
        RAISE NOTICE '✅ 没有发现重复的 setting_key，可以安全添加唯一约束';
    END IF;
END $$;

-- 查看重复数据（如果有的话）
SELECT setting_key, COUNT(*) as count
FROM system_settings
WHERE setting_key IS NOT NULL
GROUP BY setting_key
HAVING COUNT(*) > 1;

-- 步骤 2: 添加唯一约束
-- 如果约束已存在会报错，使用 IF NOT EXISTS 处理
DO $$
BEGIN
    -- 检查约束是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'system_settings' 
        AND constraint_name = 'system_settings_setting_key_unique'
    ) THEN
        ALTER TABLE system_settings 
        ADD CONSTRAINT system_settings_setting_key_unique UNIQUE (setting_key);
        RAISE NOTICE '✅ 唯一约束 system_settings_setting_key_unique 添加成功';
    ELSE
        RAISE NOTICE '⚠️ 唯一约束 system_settings_setting_key_unique 已存在，跳过';
    END IF;
END $$;

-- 步骤 3: 验证约束已添加
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'system_settings';

-- ============================================================
-- 执行完成后，板块开关保存功能应该恢复正常
-- ============================================================
