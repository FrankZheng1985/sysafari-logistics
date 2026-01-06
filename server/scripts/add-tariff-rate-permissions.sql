-- ==================== 添加 HS Code 数据库细分权限 ====================
-- 创建时间: 2026-01-06
-- 说明: 添加 TARIC 同步和导入的细分权限，仅管理员可用
-- 执行方式: psql -h host -U user -d database -f add-tariff-rate-permissions.sql

-- ==================== 1. 添加同步权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('system:tariff_rate_sync', 'TARIC数据同步', 'system', 'system', '同步欧盟TARIC税率数据', 505, 1)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 2. 添加导入权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('system:tariff_rate_import', '税率数据导入', 'system', 'system', '导入税率数据', 506, 1)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 3. 仅为管理员分配这两个权限 ====================
-- 同步权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', 'system:tariff_rate_sync'
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions 
    WHERE role_code = 'admin' AND permission_code = 'system:tariff_rate_sync'
);

-- 导入权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', 'system:tariff_rate_import'
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions 
    WHERE role_code = 'admin' AND permission_code = 'system:tariff_rate_import'
);

-- ==================== 完成 ====================
SELECT '✅ HS Code 数据库细分权限添加完成！' AS status;

-- 显示新增的权限
SELECT permission_code, permission_name, description, is_sensitive 
FROM permissions 
WHERE permission_code IN ('system:tariff_rate_sync', 'system:tariff_rate_import')
ORDER BY sort_order;

