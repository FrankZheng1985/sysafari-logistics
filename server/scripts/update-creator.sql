-- 更新创建者字段：将所有空的创建者设置为 "系统管理员"
-- 执行方式: 在 Render Dashboard -> 数据库 -> PSQL -> 执行此 SQL

-- 更新所有没有创建者的记录
UPDATE bills_of_lading 
SET creator = '系统管理员',
    updated_at = NOW()
WHERE creator IS NULL OR creator = '';

-- 验证更新结果
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN creator = '系统管理员' THEN 1 END) as system_admin,
  COUNT(CASE WHEN creator IS NULL OR creator = '' THEN 1 END) as no_creator
FROM bills_of_lading;

