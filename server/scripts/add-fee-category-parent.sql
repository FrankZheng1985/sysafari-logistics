-- ============================================================
-- 服务费类别添加父子层级支持
-- 执行方式：psql -h host -U user -d database -f add-fee-category-parent.sql
-- ============================================================

-- 1. 添加父级ID字段，用于建立父子层级关系
ALTER TABLE service_fee_categories 
ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL;

-- 2. 添加层级字段，便于快速判断层级（1=一级分类，2=二级分类）
ALTER TABLE service_fee_categories 
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 3. 创建索引提高查询效率
CREATE INDEX IF NOT EXISTS idx_service_fee_categories_parent 
ON service_fee_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_service_fee_categories_level 
ON service_fee_categories(level);

-- 4. 更新现有数据的层级为1（顶级分类）
UPDATE service_fee_categories 
SET level = 1, parent_id = NULL 
WHERE level IS NULL OR parent_id IS NULL;

-- 5. 查看结果
SELECT id, name, code, parent_id, level, sort_order, status 
FROM service_fee_categories 
ORDER BY COALESCE(parent_id, 0), sort_order, id;

