-- ==================== 添加缺失权限脚本 V2 ====================
-- 创建时间: 2026-01-06
-- 说明: 补充系统中新增功能模块对应的缺失权限
-- 执行方式: psql -h host -U user -d database -f add-missing-permissions-v2.sql

-- ==================== 1. 单证管理 - 敏感产品库 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('document:sensitive_products', '敏感产品库', 'document', 'document', '访问和管理敏感产品库', 710, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 2. CRM - 工商信息库 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('crm:business_info', '工商信息库', 'crm', 'crm', '访问和管理工商信息库', 156, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 3. 财务 - 提成管理 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('finance:commission_manage', '提成管理', 'finance', 'finance', '管理业务提成规则和记录', 640, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 4. 系统 - 审批权限设置 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('system:approval_settings', '审批权限设置', 'system', 'system', '配置系统审批流程和权限', 955, 1)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 5. 财务 - 承运商结算 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('finance:carrier_settlement', '承运商结算', 'finance', 'finance', '管理承运商结算和对账', 641, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 6. 系统 - HS Code数据库（税率管理） ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES ('system:tariff_rate', 'HS Code数据库', 'system', 'system', '管理HS Code和税率数据', 504, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 7. 为管理员添加所有新权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', permission_code FROM permissions
WHERE permission_code IN (
    'document:sensitive_products',
    'crm:business_info',
    'finance:commission_manage',
    'system:approval_settings',
    'finance:carrier_settlement',
    'system:tariff_rate'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 8. 为老板角色添加查看类权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'boss', permission_code FROM permissions
WHERE permission_code IN (
    'crm:business_info',
    'finance:commission_manage',
    'finance:carrier_settlement',
    'system:tariff_rate'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 9. 为业务经理添加相关权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'manager', permission_code FROM permissions
WHERE permission_code IN (
    'document:sensitive_products',
    'crm:business_info',
    'finance:commission_manage',
    'system:tariff_rate'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 10. 为财务主管添加相关权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_director', permission_code FROM permissions
WHERE permission_code IN (
    'finance:commission_manage',
    'finance:carrier_settlement',
    'system:tariff_rate'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 11. 为单证员添加相关权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_officer', permission_code FROM permissions
WHERE permission_code IN (
    'document:sensitive_products',
    'system:tariff_rate'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 完成 ====================
SELECT '✅ 缺失权限 V2 添加完成！' AS status;

-- 显示新增的权限
SELECT permission_code, permission_name, category, description 
FROM permissions 
WHERE permission_code IN (
    'document:sensitive_products',
    'crm:business_info',
    'finance:commission_manage',
    'system:approval_settings',
    'finance:carrier_settlement',
    'system:tariff_rate'
)
ORDER BY category, sort_order;

-- 显示当前所有权限统计
SELECT 
    category,
    COUNT(*) AS permission_count
FROM permissions
GROUP BY category
ORDER BY category;

