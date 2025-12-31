-- ==================== 用户角色权限系统升级迁移脚本 ====================
-- 创建时间: 2024-12
-- 说明: 升级用户管理和权限系统，新增角色体系、团队归属、权限细化
-- 执行方式: psql -h host -U user -d database -f migrate-user-roles.sql

-- ==================== 0. 重置序列（确保序列值正确）====================
DO $$
BEGIN
    -- 重置 roles 表的序列
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'roles_id_seq') THEN
        PERFORM setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 0) + 1, false);
    END IF;
    
    -- 重置 permissions 表的序列（如果存在）
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'permissions_id_seq') THEN
        PERFORM setval('permissions_id_seq', COALESCE((SELECT MAX(id) FROM permissions), 0) + 1, false);
    END IF;
END $$;

-- ==================== 1. 修改 roles 表，添加层级字段 ====================
DO $$
BEGIN
    -- 添加角色层级字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'roles' AND column_name = 'role_level'
    ) THEN
        ALTER TABLE roles ADD COLUMN role_level INTEGER DEFAULT 4;
        COMMENT ON COLUMN roles.role_level IS '角色层级：1-最高(admin), 2-高级(boss), 3-中级(manager/主管), 4-基础(员工)';
    END IF;
    
    -- 添加是否可以管理下属字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'roles' AND column_name = 'can_manage_team'
    ) THEN
        ALTER TABLE roles ADD COLUMN can_manage_team INTEGER DEFAULT 0;
        COMMENT ON COLUMN roles.can_manage_team IS '是否可以管理团队成员: 1=是, 0=否';
    END IF;
    
    -- 添加是否可以审批字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'roles' AND column_name = 'can_approve'
    ) THEN
        ALTER TABLE roles ADD COLUMN can_approve INTEGER DEFAULT 0;
        COMMENT ON COLUMN roles.can_approve IS '是否具有审批权限: 1=是, 0=否';
    END IF;
END $$;

-- ==================== 2. 修改 users 表，添加团队归属字段 ====================
DO $$
BEGIN
    -- 添加直属上级字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'supervisor_id'
    ) THEN
        ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        COMMENT ON COLUMN users.supervisor_id IS '直属上级用户ID';
    END IF;
    
    -- 添加部门字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'department'
    ) THEN
        ALTER TABLE users ADD COLUMN department TEXT DEFAULT '';
        COMMENT ON COLUMN users.department IS '部门名称';
    END IF;
    
    -- 添加职位字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'position'
    ) THEN
        ALTER TABLE users ADD COLUMN position TEXT DEFAULT '';
        COMMENT ON COLUMN users.position IS '职位名称';
    END IF;
    
    -- 添加入职日期字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'hire_date'
    ) THEN
        ALTER TABLE users ADD COLUMN hire_date DATE;
        COMMENT ON COLUMN users.hire_date IS '入职日期';
    END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- ==================== 3. 更新现有角色的层级和权限 ====================
UPDATE roles SET role_level = 1, can_manage_team = 1, can_approve = 1 WHERE role_code = 'admin';
UPDATE roles SET role_level = 3, can_manage_team = 1, can_approve = 0 WHERE role_code = 'manager';
UPDATE roles SET role_level = 4, can_manage_team = 0, can_approve = 0 WHERE role_code = 'operator';
UPDATE roles SET role_level = 5, can_manage_team = 0, can_approve = 0 WHERE role_code = 'viewer';

-- ==================== 4. 新增角色 ====================
-- 使用 INSERT ... ON CONFLICT 处理角色冲突（基于 role_code 唯一约束）
INSERT INTO roles (role_code, role_name, description, color_code, is_system, status, role_level, can_manage_team, can_approve, created_at)
SELECT * FROM (VALUES 
    ('boss', '老板', '高级审批权限，战略决策，可审批所有敏感操作', 'purple', 1, 'active', 2, 1, 1, NOW()),
    ('finance_director', '财务主管', '所有财务权限，管理财务团队', 'orange', 1, 'active', 3, 1, 1, NOW()),
    ('doc_clerk', '跟单员', 'TMS运输跟踪、单据跟踪、查验管理', 'cyan', 1, 'active', 4, 0, 0, NOW()),
    ('doc_officer', '单证员', '单证管理、报关单据处理', 'teal', 1, 'active', 4, 0, 0, NOW()),
    ('finance_assistant', '财务助理', '发票管理、应收应付跟踪', 'yellow', 1, 'active', 4, 0, 0, NOW())
) AS v(role_code, role_name, description, color_code, is_system, status, role_level, can_manage_team, can_approve, created_at)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE roles.role_code = v.role_code);

-- 如果角色已存在则更新
UPDATE roles SET 
    role_name = '老板', description = '高级审批权限，战略决策，可审批所有敏感操作', 
    color_code = 'purple', role_level = 2, can_manage_team = 1, can_approve = 1 
WHERE role_code = 'boss';

UPDATE roles SET 
    role_name = '财务主管', description = '所有财务权限，管理财务团队', 
    color_code = 'orange', role_level = 3, can_manage_team = 1, can_approve = 1 
WHERE role_code = 'finance_director';

UPDATE roles SET 
    role_name = '跟单员', description = 'TMS运输跟踪、单据跟踪、查验管理', 
    color_code = 'cyan', role_level = 4, can_manage_team = 0, can_approve = 0 
WHERE role_code = 'doc_clerk';

UPDATE roles SET 
    role_name = '单证员', description = '单证管理、报关单据处理', 
    color_code = 'teal', role_level = 4, can_manage_team = 0, can_approve = 0 
WHERE role_code = 'doc_officer';

UPDATE roles SET 
    role_name = '财务助理', description = '发票管理、应收应付跟踪', 
    color_code = 'yellow', role_level = 4, can_manage_team = 0, can_approve = 0 
WHERE role_code = 'finance_assistant';

-- ==================== 5. 添加 permissions 表的 category 字段（如果不存在） ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = 'category'
    ) THEN
        ALTER TABLE permissions ADD COLUMN category TEXT DEFAULT 'general';
        COMMENT ON COLUMN permissions.category IS '权限分类，用于前端分组显示';
    END IF;
    
    -- 添加是否为敏感权限字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = 'is_sensitive'
    ) THEN
        ALTER TABLE permissions ADD COLUMN is_sensitive INTEGER DEFAULT 0;
        COMMENT ON COLUMN permissions.is_sensitive IS '是否为敏感权限: 1=是, 0=否';
    END IF;
END $$;

-- 更新现有权限的分类
UPDATE permissions SET category = 'order' WHERE permission_code LIKE 'bill:%';
UPDATE permissions SET category = 'inspection' WHERE permission_code LIKE 'inspection:%';
UPDATE permissions SET category = 'cmr' WHERE permission_code LIKE 'cmr:%';
UPDATE permissions SET category = 'tool' WHERE permission_code LIKE 'tool:%';
UPDATE permissions SET category = 'system' WHERE permission_code LIKE 'system:%';

-- 标记敏感权限
UPDATE permissions SET is_sensitive = 1 WHERE permission_code IN (
    'system:user', 'system:menu', 'bill:delete', 'bill:view_all'
);

-- ==================== 6. 新增权限定义 ====================
-- CRM权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('crm:view', '查看CRM', 'crm', 'crm', '查看客户和商机信息', 150, 0),
    ('crm:customer_manage', '客户管理', 'crm', 'crm', '创建和编辑客户', 151, 0),
    ('crm:opportunity_manage', '商机管理', 'crm', 'crm', '管理销售机会', 152, 0),
    ('crm:quotation_manage', '报价管理', 'crm', 'crm', '创建和编辑报价单', 153, 0),
    ('crm:contract_manage', '合同管理', 'crm', 'crm', '管理客户合同', 154, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- 供应商权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('supplier:view', '查看供应商', 'supplier', 'supplier', '查看供应商信息', 180, 0),
    ('supplier:manage', '管理供应商', 'supplier', 'supplier', '创建和编辑供应商', 181, 0),
    ('supplier:price_import', '价格导入', 'supplier', 'supplier', '导入供应商报价', 182, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- 财务权限（细化）
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('finance:view', '查看财务', 'finance', 'finance', '查看财务报表和数据', 600, 0),
    ('finance:invoice_view', '查看发票', 'finance', 'finance', '查看发票列表', 601, 0),
    ('finance:invoice_create', '创建发票', 'finance', 'finance', '创建和开具发票', 602, 0),
    ('finance:invoice_edit', '编辑发票', 'finance', 'finance', '修改发票信息', 603, 0),
    ('finance:invoice_delete', '删除发票', 'finance', 'finance', '删除作废发票', 604, 1),
    ('finance:payment_view', '查看收付款', 'finance', 'finance', '查看应收应付款项', 610, 0),
    ('finance:payment_register', '登记收付款', 'finance', 'finance', '登记收款和付款', 611, 0),
    ('finance:payment_approve', '审批收付款', 'finance', 'finance', '审批大额收付款', 612, 1),
    ('finance:report_view', '查看财务报表', 'finance', 'finance', '查看财务统计报表', 620, 0),
    ('finance:report_export', '导出财务报表', 'finance', 'finance', '导出财务数据', 621, 1),
    ('finance:bank_manage', '银行账户管理', 'finance', 'finance', '管理公司银行账户', 630, 1),
    ('finance:fee_manage', '费用管理', 'finance', 'finance', '管理费用类型和费率', 631, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- 单证权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('document:view', '查看单证', 'document', 'document', '查看单证信息', 700, 0),
    ('document:create', '创建单证', 'document', 'document', '创建新单证', 701, 0),
    ('document:edit', '编辑单证', 'document', 'document', '修改单证信息', 702, 0),
    ('document:delete', '删除单证', 'document', 'document', '删除单证记录', 703, 1),
    ('document:import', '导入单证', 'document', 'document', '批量导入单证', 704, 0),
    ('document:export', '导出单证', 'document', 'document', '导出单证数据', 705, 0),
    ('document:match', '单证匹配', 'document', 'document', '执行单证匹配操作', 706, 0),
    ('document:tax_calc', '税费计算', 'document', 'document', '计算关税税费', 707, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- TMS运输权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('tms:view', '查看TMS', 'tms', 'cmr', '查看运输管理', 800, 0),
    ('tms:track', '跟踪运输', 'tms', 'cmr', '跟踪运输状态更新', 801, 0),
    ('tms:operate', 'TMS操作', 'tms', 'cmr', '执行TMS调度操作', 802, 0),
    ('tms:dispatch', '派车调度', 'tms', 'cmr', '安排运输车辆', 803, 0),
    ('tms:exception', '异常处理', 'tms', 'cmr', '处理运输异常', 804, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- 产品定价权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('product:view', '查看产品', 'product', 'product', '查看产品定价', 850, 0),
    ('product:manage', '管理产品', 'product', 'product', '管理产品和定价', 851, 0),
    ('product:price_adjust', '价格调整', 'product', 'product', '调整产品价格', 852, 1)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- 审批权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('approval:view', '查看审批', 'approval', 'system', '查看审批列表', 900, 0),
    ('approval:submit', '提交审批', 'approval', 'system', '提交审批请求', 901, 0),
    ('approval:approve', '审批操作', 'approval', 'system', '执行审批通过/拒绝', 902, 1)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 7. 配置各角色的默认权限 ====================

-- Boss（老板）权限 - 高级查看和审批权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'boss', permission_code FROM permissions
WHERE permission_code IN (
    -- 查看类权限
    'bill:view', 'bill:view_all',
    'crm:view', 
    'supplier:view',
    'finance:view', 'finance:invoice_view', 'finance:payment_view', 'finance:report_view', 'finance:report_export',
    'document:view',
    'tms:view',
    'inspection:view',
    'cmr:view',
    'product:view',
    -- 审批权限
    'approval:view', 'approval:approve',
    'finance:payment_approve'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 财务主管权限 - 所有财务相关权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_director', permission_code FROM permissions
WHERE permission_code LIKE 'finance:%'
   OR permission_code IN (
    'bill:view', 'bill:view_all',
    'crm:view',
    'supplier:view',
    'document:view',
    'approval:view', 'approval:submit', 'approval:approve'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 跟单员权限 - TMS、单据跟踪、查验
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_clerk', permission_code FROM permissions
WHERE permission_code IN (
    'bill:view', 'bill:create', 'bill:edit',
    'tms:view', 'tms:track', 'tms:operate', 'tms:dispatch', 'tms:exception',
    'cmr:view', 'cmr:operate',
    'inspection:view', 'inspection:operate',
    'document:view',
    'crm:view',
    'tool:inquiry', 'tool:tariff', 'tool:address', 'tool:commodity', 'tool:category',
    'approval:view', 'approval:submit'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 单证员权限 - 单证板块
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_officer', permission_code FROM permissions
WHERE permission_code IN (
    'bill:view', 'bill:create', 'bill:edit',
    'document:view', 'document:create', 'document:edit', 'document:import', 'document:export', 'document:match', 'document:tax_calc',
    'crm:view',
    'tool:tariff', 'tool:commodity', 'tool:category',
    'approval:view', 'approval:submit'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 财务助理权限 - 发票、应收应付
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_assistant', permission_code FROM permissions
WHERE permission_code IN (
    'bill:view',
    'finance:view', 'finance:invoice_view', 'finance:invoice_create', 'finance:invoice_edit',
    'finance:payment_view', 'finance:payment_register',
    'finance:report_view',
    'crm:view',
    'approval:view', 'approval:submit'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 更新经理权限 - 添加新的权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'manager', permission_code FROM permissions
WHERE permission_code IN (
    'crm:view', 'crm:customer_manage', 'crm:opportunity_manage', 'crm:quotation_manage', 'crm:contract_manage',
    'supplier:view', 'supplier:manage',
    'finance:view', 'finance:invoice_view', 'finance:payment_view', 'finance:report_view',
    'document:view', 'document:create', 'document:edit',
    'tms:view', 'tms:track',
    'product:view',
    'approval:view', 'approval:submit', 'approval:approve'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 更新管理员权限 - 确保拥有所有权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', permission_code FROM permissions
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 8. 角色映射（可选执行） ====================
-- 将现有 operator 用户映射为 doc_clerk
-- 注意：此操作会更改现有用户角色，请谨慎执行
-- UPDATE users SET role = 'doc_clerk' WHERE role = 'operator';

-- ==================== 完成 ====================
SELECT '✅ 用户角色权限系统升级迁移完成！' AS status;

-- 显示角色统计
SELECT 
    r.role_code,
    r.role_name,
    r.role_level,
    r.can_manage_team,
    r.can_approve,
    COUNT(rp.permission_code) AS permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.role_code = rp.role_code
GROUP BY r.role_code, r.role_name, r.role_level, r.can_manage_team, r.can_approve
ORDER BY r.role_level, r.role_code;

-- 显示权限分类统计
SELECT 
    category,
    COUNT(*) AS permission_count
FROM permissions
GROUP BY category
ORDER BY category;
