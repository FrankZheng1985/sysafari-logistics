-- ==================== 生产环境：添加缺失权限脚本 ====================
-- 创建时间: 2024-12-24
-- 说明: 为生产环境数据库补充所有缺失的权限
-- 执行方式: 通过 Render Dashboard PSQL 或 psql 命令行执行

-- ==================== 1. 添加唯一约束（如果不存在） ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'permissions_permission_code_key'
    ) THEN
        ALTER TABLE permissions ADD CONSTRAINT permissions_permission_code_key UNIQUE (permission_code);
        RAISE NOTICE '已添加 permission_code 唯一约束';
    ELSE
        RAISE NOTICE 'permission_code 唯一约束已存在';
    END IF;
END $$;

-- ==================== 2. 添加系统管理相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('dashboard:view', '查看系统概览', 'system', 'system', '访问系统概览仪表盘', 10, 0),
    ('bp:view', '查看BP View', 'system', 'system', '访问BP View页面', 11, 0),
    ('system:message', '信息中心', 'system', 'system', '访问信息中心，查看系统消息', 950, 0),
    ('system:data_import', '数据导入', 'system', 'system', '执行系统数据导入操作', 951, 0),
    ('system:security', '安全设置', 'system', 'system', '管理系统安全设置、审计日志', 952, 1),
    ('system:api_integrations', 'API对接管理', 'system', 'system', '管理第三方API对接配置', 953, 1),
    ('system:activity_log', '活动日志', 'system', 'system', '查看系统活动日志', 954, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 3. 添加CRM相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('crm:view', '查看CRM', 'crm', 'crm', '查看客户和商机信息', 150, 0),
    ('crm:customer_manage', '客户管理', 'crm', 'crm', '创建和编辑客户', 151, 0),
    ('crm:opportunity_manage', '商机管理', 'crm', 'crm', '管理销售机会', 152, 0),
    ('crm:quotation_manage', '报价管理', 'crm', 'crm', '创建和编辑报价单', 153, 0),
    ('crm:contract_manage', '合同管理', 'crm', 'crm', '管理客户合同', 154, 0),
    ('crm:feedback_manage', '客户反馈管理', 'crm', 'crm', '查看和处理客户反馈', 155, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 4. 添加供应商相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('supplier:view', '查看供应商', 'supplier', 'supplier', '查看供应商信息', 180, 0),
    ('supplier:manage', '管理供应商', 'supplier', 'supplier', '创建和编辑供应商', 181, 0),
    ('supplier:price_import', '价格导入', 'supplier', 'supplier', '导入供应商报价', 182, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 5. 添加财务相关权限 ====================
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
    ('finance:statements', '财务报表', 'finance', 'finance', '查看和导出财务报表', 622, 0),
    ('finance:bank_manage', '银行账户管理', 'finance', 'finance', '管理公司银行账户', 630, 1),
    ('finance:fee_manage', '费用管理', 'finance', 'finance', '管理费用类型和费率', 631, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 6. 添加单证相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('document:view', '查看单证', 'document', 'document', '查看单证信息', 700, 0),
    ('document:create', '创建单证', 'document', 'document', '创建新单证', 701, 0),
    ('document:edit', '编辑单证', 'document', 'document', '修改单证信息', 702, 0),
    ('document:delete', '删除单证', 'document', 'document', '删除单证记录', 703, 1),
    ('document:import', '导入单证', 'document', 'document', '批量导入单证', 704, 0),
    ('document:export', '导出单证', 'document', 'document', '导出单证数据', 705, 0),
    ('document:match', '单证匹配', 'document', 'document', '执行单证匹配操作', 706, 0),
    ('document:tax_calc', '税费计算', 'document', 'document', '计算关税税费', 707, 0),
    ('document:supplement', '数据补充', 'document', 'document', '补充单证数据信息', 708, 0),
    ('document:match_records', '匹配记录库', 'document', 'document', '访问和管理匹配记录库', 709, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 7. 添加TMS运输相关权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('tms:view', '查看TMS', 'tms', 'cmr', '查看运输管理', 800, 0),
    ('tms:track', '跟踪运输', 'tms', 'cmr', '跟踪运输状态更新', 801, 0),
    ('tms:operate', 'TMS操作', 'tms', 'cmr', '执行TMS调度操作', 802, 0),
    ('tms:dispatch', '派车调度', 'tms', 'cmr', '安排运输车辆', 803, 0),
    ('tms:exception', '异常处理', 'tms', 'cmr', '处理运输异常', 804, 0),
    ('tms:pricing', 'TMS运费管理', 'tms', 'cmr', '管理运费价格和费率', 805, 0),
    ('tms:conditions', 'TMS条件管理', 'tms', 'cmr', '管理运输条件和规则', 806, 0),
    ('tms:last_mile', '最后里程', 'tms', 'cmr', '管理最后里程配送', 807, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 8. 添加产品定价相关权限 ====================
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

-- ==================== 9. 添加查验管理补充权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('inspection:release', '查验放行', 'inspection', 'inspection', '执行查验放行操作', 302, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 10. 添加审批相关权限 ====================
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

-- ==================== 11. 添加工具箱补充权限 ====================
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('tool:shared_tax', '共享税号库', 'tool', 'tool', '访问和管理共享税号库', 560, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- ==================== 12. 为管理员配置所有新权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', permission_code FROM permissions
WHERE permission_code NOT IN (SELECT permission_code FROM role_permissions WHERE role_code = 'admin')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 13. 为老板配置查看类权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'boss', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'bp:view', 'system:message',
    'crm:view', 'crm:feedback_manage',
    'supplier:view',
    'finance:view', 'finance:invoice_view', 'finance:payment_view', 'finance:report_view', 'finance:report_export', 'finance:statements',
    'document:view',
    'tms:view',
    'product:view',
    'approval:view', 'approval:approve'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 14. 为经理配置业务权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'manager', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'bp:view', 'system:message',
    'crm:view', 'crm:customer_manage', 'crm:opportunity_manage', 'crm:quotation_manage', 'crm:contract_manage', 'crm:feedback_manage',
    'supplier:view', 'supplier:manage',
    'finance:view', 'finance:invoice_view', 'finance:payment_view', 'finance:report_view',
    'document:view', 'document:create', 'document:edit', 'document:supplement', 'document:match_records',
    'tms:view', 'tms:track', 'tms:pricing', 'tms:conditions', 'tms:last_mile',
    'product:view',
    'inspection:release',
    'approval:view', 'approval:submit', 'approval:approve'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 15. 为财务主管配置财务权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_director', permission_code FROM permissions
WHERE permission_code LIKE 'finance:%'
   OR permission_code IN (
    'dashboard:view', 'system:message',
    'crm:view',
    'supplier:view',
    'document:view',
    'approval:view', 'approval:submit', 'approval:approve'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 16. 为跟单员配置TMS权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_clerk', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message',
    'tms:view', 'tms:track', 'tms:operate', 'tms:dispatch', 'tms:exception', 'tms:pricing', 'tms:conditions', 'tms:last_mile',
    'inspection:release',
    'crm:view'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 17. 为单证员配置单证权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'doc_officer', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message',
    'document:view', 'document:create', 'document:edit', 'document:import', 'document:export', 'document:match', 'document:tax_calc', 'document:supplement', 'document:match_records',
    'tool:shared_tax',
    'crm:view'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 18. 为财务助理配置基础财务权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'finance_assistant', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message',
    'finance:view', 'finance:invoice_view', 'finance:invoice_create', 'finance:invoice_edit',
    'finance:payment_view', 'finance:payment_register',
    'finance:report_view', 'finance:statements',
    'crm:view'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 19. 为操作员配置基础权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'operator', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view', 'system:message'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 20. 为查看者配置只读权限 ====================
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'viewer', permission_code FROM permissions
WHERE permission_code IN (
    'dashboard:view'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 完成 ====================
SELECT '✅ 生产环境权限添加完成！' AS status;

-- 显示权限统计
SELECT 
    category,
    COUNT(*) AS permission_count
FROM permissions
GROUP BY category
ORDER BY category;

-- 显示总权限数
SELECT COUNT(*) AS total_permissions FROM permissions;

