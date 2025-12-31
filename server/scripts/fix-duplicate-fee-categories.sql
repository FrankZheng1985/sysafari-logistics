-- ============================================================
-- 修复服务费类别重复数据
-- 创建时间: 2025-12-31
-- 问题描述: 由于多次数据同步导致相同的费用分类有多条记录
-- ============================================================

-- 1. 先查看所有重复的记录（按名称分组，显示数量大于1的）
SELECT name, code, COUNT(*) as count, 
       ARRAY_AGG(id ORDER BY id) as ids,
       ARRAY_AGG(parent_id ORDER BY id) as parent_ids
FROM service_fee_categories 
GROUP BY name, code 
HAVING COUNT(*) > 1
ORDER BY name;

-- 2. 查看详细的重复记录
SELECT id, name, code, parent_id, level, sort_order, status, created_at
FROM service_fee_categories
WHERE name IN (
  SELECT name FROM service_fee_categories GROUP BY name HAVING COUNT(*) > 1
)
ORDER BY name, id;

-- 3. 删除重复记录，保留ID最小的那个（通常是最早创建的）
-- ⚠️ 注意：执行前请确认备份数据库

-- 删除重复的 UPS费用 (保留较小ID的)
DELETE FROM service_fee_categories 
WHERE name = 'UPS费用' 
AND id NOT IN (SELECT MIN(id) FROM service_fee_categories WHERE name = 'UPS费用');

-- 删除重复的 多个进口VAT申报费 (保留较小ID的)
DELETE FROM service_fee_categories 
WHERE name = '多个进口VAT申报费' 
AND id NOT IN (SELECT MIN(id) FROM service_fee_categories WHERE name = '多个进口VAT申报费');

-- 通用删除语句：删除所有重复的记录，保留ID最小的
DELETE FROM service_fee_categories a
USING service_fee_categories b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.code = b.code;

-- 4. 验证结果 - 应该没有重复
SELECT name, code, COUNT(*) as count
FROM service_fee_categories 
GROUP BY name, code 
HAVING COUNT(*) > 1;

-- 5. 显示清理后的总记录数
SELECT COUNT(*) as total_categories FROM service_fee_categories;

-- 6. 显示清理后的完整列表
SELECT id, name, code, parent_id, level, sort_order, status
FROM service_fee_categories
ORDER BY COALESCE(parent_id, 0), sort_order, id;

