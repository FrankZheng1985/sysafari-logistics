-- ==================== 权限表添加 category 字段迁移脚本 ====================
-- 执行时间: 2024-12-22
-- 说明: 为 permissions 表添加 category 字段，用于前端分组显示

-- 1. 添加 category 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = 'category'
    ) THEN
        ALTER TABLE permissions ADD COLUMN category TEXT DEFAULT 'general';
        RAISE NOTICE '已添加 category 字段';
    ELSE
        RAISE NOTICE 'category 字段已存在';
    END IF;
    
    -- 添加 is_sensitive 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'permissions' AND column_name = 'is_sensitive'
    ) THEN
        ALTER TABLE permissions ADD COLUMN is_sensitive INTEGER DEFAULT 0;
        RAISE NOTICE '已添加 is_sensitive 字段';
    ELSE
        RAISE NOTICE 'is_sensitive 字段已存在';
    END IF;
END $$;

-- 2. 更新现有权限的 category（基于 module 或 permission_code）
UPDATE permissions SET category = 'order' WHERE module = 'order' OR permission_code LIKE 'bill:%';
UPDATE permissions SET category = 'inspection' WHERE module = 'inspection' OR permission_code LIKE 'inspection:%';
UPDATE permissions SET category = 'cmr' WHERE module = 'cmr' OR permission_code LIKE 'cmr:%';
UPDATE permissions SET category = 'tool' WHERE module = 'tool' OR permission_code LIKE 'tool:%';
UPDATE permissions SET category = 'system' WHERE module = 'system' OR permission_code LIKE 'system:%';

-- 3. 标记敏感权限
UPDATE permissions SET is_sensitive = 1 WHERE permission_code IN (
    'system:user', 'system:menu', 'bill:delete', 'bill:view_all'
);

-- 4. 添加新的权限（CRM、供应商、财务、单证等）
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

INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive)
VALUES 
    ('supplier:view', '查看供应商', 'supplier', 'supplier', '查看供应商信息', 180, 0),
    ('supplier:manage', '管理供应商', 'supplier', 'supplier', '创建和编辑供应商', 181, 0),
    ('supplier:price_import', '价格导入', 'supplier', 'supplier', '导入供应商报价', 182, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

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
    ('finance:fee_manage', '费用管理', 'finance', 'finance', '管理费用类型和费率', 631, 0)
ON CONFLICT (permission_code) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive;

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

-- 5. 验证结果
SELECT permission_code, permission_name, module, category FROM permissions ORDER BY module, sort_order;
