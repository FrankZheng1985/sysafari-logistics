-- ==================== 添加缺失权限脚本 ====================
-- 创建时间: 2024-12-24
-- 说明: 补充系统中缺失的权限定义，确保所有菜单功能都有对应的权限控制
-- 执行方式: psql -h host -U user -d database -f add-missing-permissions.sql

-- ==================== 1. 添加系统管理相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('dashboard:view', '查看系统概览', 'system', 'system', '访问系统概览仪表盘', 10, 0),
    ('bp:view', '查看BP View', 'system', 'system', '访问BP View页面', 11, 0),
    ('system:message', '信息中心', 'system', 'system', '访问信息中心，查看系统消息', 950, 0),
    ('system:data_import', '数据导入', 'system', 'system', '执行系统数据导入操作', 951, 0),
    ('system:security', '安全设置', 'system', 'system', '管理系统安全设置、审计日志', 952, 1),
    ('system:api_integrations', 'API对接管理', 'system', 'system', '管理第三方API对接配置', 953, 1)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 2. 添加工具箱相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('tool:shared_tax', '共享税号库', 'tool', 'tool', '访问和管理共享税号库', 560, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 3. 添加CRM相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('crm:feedback_manage', '客户反馈管理', 'crm', 'crm', '查看和处理客户反馈', 155, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 4. 添加TMS运输相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('tms:pricing', 'TMS运费管理', 'tms', 'cmr', '管理运费价格和费率', 805, 0),
    ('tms:conditions', 'TMS条件管理', 'tms', 'cmr', '管理运输条件和规则', 806, 0),
    ('tms:last_mile', '最后里程', 'tms', 'cmr', '管理最后里程配送', 807, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 5. 添加单证管理相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('document:supplement', '数据补充', 'document', 'document', '补充单证数据信息', 708, 0),
    ('document:match_records', '匹配记录库', 'document', 'document', '访问和管理匹配记录库', 709, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 6. 添加查验管理相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('inspection:release', '查验放行', 'inspection', 'inspection', '执行查验放行操作', 302, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 7. 添加财务管理相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('finance:statements', '财务报表', 'finance', 'finance', '查看和导出财务报表', 622, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 8. 为各角色配置新权限 ====================

-- 管理员 (admin) - 拥有所有新权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'bp:view', 'system:message', 'system:data_import', 
    'system:security', 'system:api_integrations', 'tool:shared_tax',
    'crm:feedback_manage', 'tms:pricing', 'tms:conditions', 'tms:last_mile',
    'document:supplement', 'document:match_records', 'inspection:release',
    'finance:statements'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 老板 (boss) - 查看类权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'boss', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'bp:view', 'system:message',
    'crm:feedback_manage', 'finance:statements'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 业务经理 (manager) - 业务相关权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'manager', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'bp:view', 'system:message',
    'crm:feedback_manage', 'tms:pricing', 'tms:conditions', 'tms:last_mile',
    'document:supplement', 'document:match_records', 'inspection:release'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 财务主管 (finance_director) - 财务相关权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_director', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message', 'finance:statements'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 跟单员 (doc_clerk) - TMS和运输相关权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_clerk', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message',
    'tms:pricing', 'tms:conditions', 'tms:last_mile',
    'inspection:release'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 单证员 (doc_officer) - 单证相关权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_officer', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message',
    'document:supplement', 'document:match_records',
    'tool:shared_tax'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 财务助理 (finance_assistant) - 基础财务权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_assistant', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message', 'finance:statements'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 操作员 (operator) - 基础权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'operator', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 查看者 (viewer) - 只有查看概览权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'viewer', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 完成 ====================
SELECT '✅ 缺失权限添加完成！' AS status;

-- 显示新增的权限
SELECT permission_code, permission_name, category, description 
FROM permissions 
WHERE permission_code IN (
    'dashboard:view', 'bp:view', 'system:message', 'system:data_import', 
    'system:security', 'system:api_integrations', 'tool:shared_tax',
    'crm:feedback_manage', 'tms:pricing', 'tms:conditions', 'tms:last_mile',
    'document:supplement', 'document:match_records', 'inspection:release',
    'finance:statements'
)
ORDER BY category, sort_order;

-- 显示权限分类统计
SELECT 
    category,
    COUNT(*) AS permission_count
FROM permissions
GROUP BY category
ORDER BY category;

