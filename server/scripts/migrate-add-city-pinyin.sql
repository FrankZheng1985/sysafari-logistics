-- 城市表添加拼音字段迁移脚本
-- 执行方法: psql -h host -U user -d database -f migrate-add-city-pinyin.sql

-- 添加城市拼音字段
ALTER TABLE cities ADD COLUMN IF NOT EXISTS city_name_pinyin TEXT;

-- 添加索引（可选，用于拼音搜索优化）
CREATE INDEX IF NOT EXISTS idx_cities_pinyin ON cities(city_name_pinyin);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 城市拼音字段迁移完成！';
END $$;
