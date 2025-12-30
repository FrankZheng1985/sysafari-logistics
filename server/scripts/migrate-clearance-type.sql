-- 为 cargo_imports 表添加清关类型字段
-- 执行时间: 2024-12-30
-- 说明: 支持 40号普通清关 和 42号递延清关 切换

-- 添加 clearance_type 字段（默认值为 '40' 普通清关）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS clearance_type TEXT DEFAULT '40';

-- 添加注释
COMMENT ON COLUMN cargo_imports.clearance_type IS '清关类型：40-普通清关（关税+增值税在进口国缴纳），42-递延清关（增值税递延到目的地国家缴纳）';

-- 验证字段是否添加成功
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'cargo_imports' AND column_name = 'clearance_type';

