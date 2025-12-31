-- 为 bills_of_lading 表添加提柜时间字段
-- 执行时间: 2025-12-24
-- 说明: 添加 cmr_pickup_time 字段用于记录提柜时间
-- 使用 IF NOT EXISTS 确保安全，不会重复添加

DO $$
BEGIN
    -- cmr_pickup_time 提柜时间
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills_of_lading' AND column_name = 'cmr_pickup_time') THEN
        ALTER TABLE bills_of_lading ADD COLUMN cmr_pickup_time TEXT;
        RAISE NOTICE '已添加字段: cmr_pickup_time (提柜时间)';
    ELSE
        RAISE NOTICE '字段 cmr_pickup_time 已存在，跳过';
    END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN bills_of_lading.cmr_pickup_time IS '提柜时间';

