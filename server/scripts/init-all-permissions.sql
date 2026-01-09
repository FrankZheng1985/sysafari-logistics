-- ==================== 权限完整初始化脚本 ====================
-- 创建时间: 2026-01-09
-- 说明: 初始化系统所有权限，确保所有板块齐全
-- 执行方式: psql -h host -U user -d database -f init-all-permissions.sql

-- ==================== 0. 确保唯一约束存在 ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'permissions_permission_code_key'
    ) THEN
        ALTER TABLE permissions ADD CONSTRAINT permissions_permission_code_key UNIQUE (permission_code);
    END IF;
END $$;

-- ==================== 1. 确保 category 和 is_sensitive 字段存在 ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = 'category'
    ) THEN
        ALTER TABLE permissions ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = 'is_sensitive'
    ) THEN
        ALTER TABLE permissions ADD COLUMN is_sensitive INTEGER DEFAULT 0;
    END IF;
END $$;

-- ==================== 2. 订单管理权限 (order) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('bill:view', '查看提单', 'order', 'order', '查看提单列表和详情', 100, false),
    ('bill:create', '创建提单', 'order', 'order', '创建新提单', 101, false),
    ('bill:edit', '编辑提单', 'order', 'order', '编辑提单信息', 102, false),
    ('bill:delete', '删除提单', 'order', 'order', '删除或作废提单', 103, true),
    ('bill:view_all', '查看所有提单', 'order', 'order', '查看所有人的提单（不限于分配的）', 104, true)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 3. 单证管理权限 (document) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('document:view', '查看单证', 'document', 'document', '查看单证信息', 700, false),
    ('document:create', '创建单证', 'document', 'document', '创建新单证', 701, false),
    ('document:edit', '编辑单证', 'document', 'document', '修改单证信息', 702, false),
    ('document:delete', '删除单证', 'document', 'document', '删除单证记录', 703, true),
    ('document:import', '导入单证', 'document', 'document', '批量导入单证', 704, false),
    ('document:export', '导出单证', 'document', 'document', '导出单证数据', 705, false),
    ('document:match', '单证匹配', 'document', 'document', '执行单证匹配操作', 706, false),
    ('document:tax_calc', '税费计算', 'document', 'document', '计算关税税费', 707, false),
    ('document:supplement', '数据补充', 'document', 'document', '补充单证数据信息', 708, false),
    ('document:match_records', '匹配记录库', 'document', 'document', '访问和管理匹配记录库', 709, false),
    ('document:sensitive_products', '敏感产品库', 'document', 'document', '访问和管理敏感产品库', 710, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 4. 查验管理权限 (inspection) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('inspection:view', '查看查验', 'inspection', 'inspection', '查看查验信息', 300, false),
    ('inspection:operate', '操作查验', 'inspection', 'inspection', '执行查验操作', 301, false),
    ('inspection:release', '查验放行', 'inspection', 'inspection', '执行查验放行操作', 302, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 5. TMS运输管理权限 (cmr) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('cmr:view', '查看CMR', 'cmr', 'cmr', '查看CMR派送信息', 400, false),
    ('cmr:operate', '操作CMR', 'cmr', 'cmr', '执行CMR派送操作', 401, false),
    ('tms:view', '查看TMS', 'tms', 'cmr', '查看运输管理', 800, false),
    ('tms:track', '跟踪运输', 'tms', 'cmr', '跟踪运输状态更新', 801, false),
    ('tms:operate', 'TMS操作', 'tms', 'cmr', '执行TMS调度操作', 802, false),
    ('tms:dispatch', '派车调度', 'tms', 'cmr', '安排运输车辆', 803, false),
    ('tms:exception', '异常处理', 'tms', 'cmr', '处理运输异常', 804, false),
    ('tms:pricing', '运费管理', 'tms', 'cmr', '管理运费价格和费率', 805, false),
    ('tms:conditions', '条件管理', 'tms', 'cmr', '管理运输条件和规则', 806, false),
    ('tms:last_mile', '最后里程', 'tms', 'cmr', '管理最后里程配送', 807, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 6. CRM客户管理权限 (crm) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('crm:view', '查看CRM', 'crm', 'crm', '查看客户和商机信息', 150, false),
    ('crm:customer_manage', '客户管理', 'crm', 'crm', '创建和编辑客户', 151, false),
    ('crm:opportunity_manage', '商机管理', 'crm', 'crm', '管理销售机会', 152, false),
    ('crm:quotation_manage', '报价管理', 'crm', 'crm', '创建和编辑报价单', 153, false),
    ('crm:contract_manage', '合同管理', 'crm', 'crm', '管理客户合同', 154, false),
    ('crm:feedback_manage', '客户反馈', 'crm', 'crm', '管理客户反馈', 155, false),
    ('crm:business_info', '工商信息库', 'crm', 'crm', '访问和管理工商信息库', 156, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 7. 供应商管理权限 (supplier) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('supplier:view', '查看供应商', 'supplier', 'supplier', '查看供应商信息', 180, false),
    ('supplier:manage', '管理供应商', 'supplier', 'supplier', '创建和编辑供应商', 181, false),
    ('supplier:price_import', '价格导入', 'supplier', 'supplier', '导入供应商报价', 182, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 8. 财务管理权限 (finance) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('finance:view', '查看财务', 'finance', 'finance', '查看财务报表和数据', 600, false),
    ('finance:invoice_view', '查看发票', 'finance', 'finance', '查看发票列表', 601, false),
    ('finance:invoice_create', '创建发票', 'finance', 'finance', '创建和开具发票', 602, false),
    ('finance:invoice_edit', '编辑发票', 'finance', 'finance', '修改发票信息', 603, false),
    ('finance:invoice_delete', '删除发票', 'finance', 'finance', '删除作废发票', 604, true),
    ('finance:payment_view', '查看收付款', 'finance', 'finance', '查看应收应付款项', 610, false),
    ('finance:payment_register', '登记收付款', 'finance', 'finance', '登记收款和付款', 611, false),
    ('finance:payment_approve', '审批收付款', 'finance', 'finance', '审批大额收付款', 612, true),
    ('finance:report_view', '查看财务报表', 'finance', 'finance', '查看财务统计报表', 620, false),
    ('finance:report_export', '导出财务报表', 'finance', 'finance', '导出财务数据', 621, true),
    ('finance:statements', '财务报表', 'finance', 'finance', '查看和导出财务报表', 622, false),
    ('finance:bank_manage', '银行账户管理', 'finance', 'finance', '管理公司银行账户', 630, true),
    ('finance:fee_manage', '费用管理', 'finance', 'finance', '管理费用类型和费率', 631, false),
    ('finance:commission_manage', '提成管理', 'finance', 'finance', '管理业务提成规则和记录', 640, false),
    ('finance:carrier_settlement', '承运商结算', 'finance', 'finance', '管理承运商结算和对账', 641, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 9. 产品定价权限 (product) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('product:view', '查看产品', 'product', 'product', '查看产品定价', 850, false),
    ('product:manage', '管理产品', 'product', 'product', '管理产品和定价', 851, false),
    ('product:price_adjust', '价格调整', 'product', 'product', '调整产品价格', 852, true)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 10. 工具箱权限 (tool) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('tool:inquiry', '询价工具', 'tool', 'tool', '使用询价工具', 550, false),
    ('tool:tariff', '关税计算', 'tool', 'tool', '使用关税计算工具', 551, false),
    ('tool:shared_tax', '共享税号库', 'tool', 'tool', '访问和管理共享税号库', 560, false)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 11. 系统管理权限 (system) ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('dashboard:view', '查看系统概览', 'system', 'system', '访问系统概览仪表盘', 10, false),
    ('bp:view', '查看BP View', 'system', 'system', '访问BP View页面', 11, false),
    ('system:user', '用户管理', 'system', 'system', '管理系统用户', 500, true),
    ('system:menu', '菜单设置', 'system', 'system', '管理系统菜单配置', 501, true),
    ('system:basic_data', '基础数据', 'system', 'system', '管理基础数据', 502, false),
    ('system:logo', 'Logo管理', 'system', 'system', '管理系统Logo', 503, false),
    ('system:tariff_rate', 'HS Code数据库', 'system', 'system', '管理HS Code和税率数据', 504, false),
    ('system:message', '信息中心', 'system', 'system', '访问信息中心，查看系统消息', 950, false),
    ('system:data_import', '数据导入', 'system', 'system', '执行系统数据导入操作', 951, false),
    ('system:security', '安全设置', 'system', 'system', '管理系统安全设置、审计日志', 952, true),
    ('system:api_integrations', 'API对接管理', 'system', 'system', '管理第三方API对接配置', 953, true),
    ('system:activity_log', '活动日志', 'system', 'system', '查看活动日志', 954, false),
    ('system:approval_settings', '审批权限设置', 'system', 'system', '配置系统审批流程和权限', 955, true),
    ('approval:view', '查看审批', 'approval', 'system', '查看审批列表', 900, false),
    ('approval:submit', '提交审批', 'approval', 'system', '提交审批请求', 901, false),
    ('approval:approve', '审批操作', 'approval', 'system', '执行审批通过/拒绝', 902, true)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 12. 为管理员添加所有权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', permission_code FROM permissions
WHERE permission_code NOT IN (SELECT permission_code FROM role_permissions WHERE role_code = 'admin')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 13. 显示结果统计 ====================
SELECT '✅ 权限初始化完成！' AS status;

-- 显示各分类权限数量
SELECT 
    category AS "权限分类",
    COUNT(*) AS "权限数量"
FROM permissions
GROUP BY category
ORDER BY 
    CASE category
        WHEN 'order' THEN 1
        WHEN 'document' THEN 2
        WHEN 'inspection' THEN 3
        WHEN 'cmr' THEN 4
        WHEN 'crm' THEN 5
        WHEN 'supplier' THEN 6
        WHEN 'finance' THEN 7
        WHEN 'product' THEN 8
        WHEN 'tool' THEN 9
        WHEN 'system' THEN 10
        ELSE 99
    END;

-- 显示所有权限列表
SELECT 
    permission_code AS "权限代码",
    permission_name AS "权限名称",
    category AS "分类",
    description AS "描述"
FROM permissions
ORDER BY category, sort_order;
