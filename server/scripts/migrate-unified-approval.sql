-- ==================== 统一审批系统数据库迁移脚本 ====================
-- 创建时间: 2026-01-06
-- 说明: 创建统一审批系统所需的数据库表
-- 执行方式: psql -h host -U user -d database -f migrate-unified-approval.sql

-- ==================== 1. 审批触发点申请表 ====================
-- 用于管理员申请新的审批触发点，开发人员查看和处理
CREATE TABLE IF NOT EXISTS approval_trigger_requests (
    id SERIAL PRIMARY KEY,
    business_module VARCHAR(50) NOT NULL,      -- 业务模块：supplier/customer/user/fee/order/contract
    trigger_action VARCHAR(50) NOT NULL,       -- 触发操作：create/delete/update/approve
    module_name VARCHAR(100),                  -- 模块中文名
    action_name VARCHAR(100),                  -- 操作中文名
    description TEXT,                          -- 需求说明
    expected_roles TEXT[],                     -- 期望审批角色
    status VARCHAR(20) DEFAULT 'requested',    -- requested(已申请)/developing(开发中)/completed(已完成)/rejected(已拒绝)
    requested_by VARCHAR(50),                  -- 申请人ID
    requested_by_name VARCHAR(100),            -- 申请人姓名
    developer_notes TEXT,                      -- 开发备注/指南
    completed_by VARCHAR(50),                  -- 完成人ID
    completed_by_name VARCHAR(100),            -- 完成人姓名
    completed_at TIMESTAMP,                    -- 完成时间
    rejected_reason TEXT,                      -- 拒绝原因
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_trigger_requests_status ON approval_trigger_requests(status);
CREATE INDEX IF NOT EXISTS idx_trigger_requests_module ON approval_trigger_requests(business_module);
CREATE INDEX IF NOT EXISTS idx_trigger_requests_created ON approval_trigger_requests(created_at);

-- 添加注释
COMMENT ON TABLE approval_trigger_requests IS '审批触发点申请表 - 用于管理员申请新的审批触发点';

-- ==================== 2. 扩展 sensitive_operations 表 ====================
-- 为现有的敏感操作表添加新字段，支持触发点管理

-- 添加业务模块字段
ALTER TABLE sensitive_operations ADD COLUMN IF NOT EXISTS business_module VARCHAR(50);
-- 添加触发操作字段
ALTER TABLE sensitive_operations ADD COLUMN IF NOT EXISTS trigger_action VARCHAR(50);
-- 添加触发条件字段（JSON格式，如 {"amount_threshold": 10000}）
ALTER TABLE sensitive_operations ADD COLUMN IF NOT EXISTS trigger_condition JSONB;
-- 添加状态字段（available-可用/developing-开发中/requested-已申请）
ALTER TABLE sensitive_operations ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available';
-- 添加分类字段
ALTER TABLE sensitive_operations ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'business';

-- 更新现有数据的业务模块和触发操作
UPDATE sensitive_operations SET 
    business_module = 'user',
    trigger_action = 'create',
    category = 'system'
WHERE operation_code = 'USER_CREATE';

UPDATE sensitive_operations SET 
    business_module = 'user',
    trigger_action = 'delete',
    category = 'system'
WHERE operation_code = 'USER_DELETE';

UPDATE sensitive_operations SET 
    business_module = 'user',
    trigger_action = 'role_change',
    category = 'system'
WHERE operation_code = 'ROLE_CHANGE';

UPDATE sensitive_operations SET 
    business_module = 'user',
    trigger_action = 'permission_grant',
    category = 'system'
WHERE operation_code = 'PERMISSION_GRANT';

UPDATE sensitive_operations SET 
    business_module = 'finance',
    trigger_action = 'payment',
    category = 'finance'
WHERE operation_code = 'FINANCE_PAYMENT';

UPDATE sensitive_operations SET 
    business_module = 'finance',
    trigger_action = 'refund',
    category = 'finance'
WHERE operation_code = 'FINANCE_REFUND';

UPDATE sensitive_operations SET 
    business_module = 'data',
    trigger_action = 'export',
    category = 'system'
WHERE operation_code = 'DATA_EXPORT';

UPDATE sensitive_operations SET 
    business_module = 'system',
    trigger_action = 'config_change',
    category = 'system'
WHERE operation_code = 'SYSTEM_CONFIG_CHANGE';

UPDATE sensitive_operations SET 
    business_module = 'system',
    trigger_action = 'security_change',
    category = 'system'
WHERE operation_code = 'SECURITY_SETTING_CHANGE';

-- ==================== 3. 插入新的审批触发点 ====================
-- 插入供应商相关审批触发点
INSERT INTO sensitive_operations (operation_code, operation_name, operation_type, description, requires_approval, approval_level, approver_roles, business_module, trigger_action, category, is_active)
VALUES 
    ('SUPPLIER_CREATE', '创建供应商', 'supplier_management', '新建供应商需要审批', TRUE, 1, ARRAY['admin', 'boss'], 'supplier', 'create', 'business', TRUE),
    ('SUPPLIER_DELETE', '删除供应商', 'supplier_management', '删除供应商需要审批', TRUE, 2, ARRAY['admin', 'boss'], 'supplier', 'delete', 'business', TRUE),
    ('SUPPLIER_UPDATE', '修改供应商', 'supplier_management', '修改供应商信息需要审批', FALSE, 1, ARRAY['admin', 'boss'], 'supplier', 'update', 'business', FALSE)
ON CONFLICT (operation_code) DO UPDATE SET
    operation_name = EXCLUDED.operation_name,
    description = EXCLUDED.description,
    business_module = EXCLUDED.business_module,
    trigger_action = EXCLUDED.trigger_action,
    category = EXCLUDED.category,
    updated_at = NOW();

-- 插入费用相关审批触发点
INSERT INTO sensitive_operations (operation_code, operation_name, operation_type, description, requires_approval, approval_level, approver_roles, business_module, trigger_action, category, trigger_condition, is_active)
VALUES 
    ('FEE_SUPPLEMENT', '追加费用', 'fee_management', '追加费用需要审批', TRUE, 1, ARRAY['admin', 'boss', 'finance'], 'fee', 'supplement', 'business', NULL, TRUE),
    ('FEE_ITEM_CREATE', '新增费用项', 'fee_management', '新增费用项需要审批', TRUE, 1, ARRAY['admin', 'boss'], 'fee', 'item_create', 'finance', NULL, TRUE),
    ('FEE_CATEGORY_CREATE', '新增费用分类', 'fee_management', '新增费用分类需要审批', TRUE, 1, ARRAY['admin', 'boss'], 'fee', 'category_create', 'finance', NULL, TRUE)
ON CONFLICT (operation_code) DO UPDATE SET
    operation_name = EXCLUDED.operation_name,
    description = EXCLUDED.description,
    business_module = EXCLUDED.business_module,
    trigger_action = EXCLUDED.trigger_action,
    category = EXCLUDED.category,
    updated_at = NOW();

-- 插入订单相关审批触发点
INSERT INTO sensitive_operations (operation_code, operation_name, operation_type, description, requires_approval, approval_level, approver_roles, business_module, trigger_action, category, trigger_condition, is_active)
VALUES 
    ('ORDER_LARGE', '大额订单', 'order_management', '大额订单需要审批', TRUE, 2, ARRAY['admin', 'boss'], 'order', 'large_amount', 'business', '{"amount_threshold": 50000}', TRUE)
ON CONFLICT (operation_code) DO UPDATE SET
    operation_name = EXCLUDED.operation_name,
    description = EXCLUDED.description,
    business_module = EXCLUDED.business_module,
    trigger_action = EXCLUDED.trigger_action,
    category = EXCLUDED.category,
    trigger_condition = EXCLUDED.trigger_condition,
    updated_at = NOW();

-- 插入付款相关审批触发点
INSERT INTO sensitive_operations (operation_code, operation_name, operation_type, description, requires_approval, approval_level, approver_roles, business_module, trigger_action, category, is_active)
VALUES 
    ('PAYMENT_REQUEST', '付款申请', 'payment_management', '提交付款申请需要审批', TRUE, 2, ARRAY['admin', 'boss', 'finance'], 'payment', 'request', 'business', TRUE)
ON CONFLICT (operation_code) DO UPDATE SET
    operation_name = EXCLUDED.operation_name,
    description = EXCLUDED.description,
    business_module = EXCLUDED.business_module,
    trigger_action = EXCLUDED.trigger_action,
    category = EXCLUDED.category,
    updated_at = NOW();

-- ==================== 4. 统一审批记录表 ====================
-- 用于存储所有类型的审批记录
CREATE TABLE IF NOT EXISTS unified_approvals (
    id SERIAL PRIMARY KEY,
    approval_no VARCHAR(32) UNIQUE,              -- 审批单号 APR-20260106-0001
    
    -- 审批分类和类型
    category VARCHAR(20) NOT NULL,               -- business(业务)/system(系统)/finance(财务)
    approval_type VARCHAR(50) NOT NULL,          -- 具体类型代码，对应 sensitive_operations.operation_code
    
    -- 业务关联
    business_id VARCHAR(100),                    -- 关联的业务ID
    business_table VARCHAR(50),                  -- 关联的业务表
    
    -- 审批内容
    title VARCHAR(200) NOT NULL,
    content TEXT,
    amount DECIMAL(15,2),
    currency VARCHAR(10) DEFAULT 'EUR',
    request_data JSONB,                          -- 完整请求数据
    
    -- 申请人
    applicant_id VARCHAR(50) NOT NULL,
    applicant_name VARCHAR(100),
    applicant_role VARCHAR(20),
    applicant_dept VARCHAR(50),
    
    -- 审批人
    approver_id VARCHAR(50),
    approver_name VARCHAR(100),
    approver_role VARCHAR(20),
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending',        -- pending/approved/rejected/cancelled/expired
    priority VARCHAR(10) DEFAULT 'normal',       -- low/normal/high/urgent
    
    -- 审批结果
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    approval_comment TEXT,
    rejection_reason TEXT,
    
    -- 执行状态
    is_executed BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMP,
    execution_result JSONB,
    
    -- 时间
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_unified_approvals_status ON unified_approvals(status);
CREATE INDEX IF NOT EXISTS idx_unified_approvals_category ON unified_approvals(category);
CREATE INDEX IF NOT EXISTS idx_unified_approvals_type ON unified_approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_unified_approvals_applicant ON unified_approvals(applicant_id);
CREATE INDEX IF NOT EXISTS idx_unified_approvals_approver ON unified_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_unified_approvals_created ON unified_approvals(created_at);
CREATE INDEX IF NOT EXISTS idx_unified_approvals_business ON unified_approvals(business_id, business_table);

-- 添加注释
COMMENT ON TABLE unified_approvals IS '统一审批记录表 - 存储所有类型的审批记录';

-- ==================== 5. 审批单号序列 ====================
CREATE SEQUENCE IF NOT EXISTS unified_approval_seq START 1;

-- ==================== 6. 生成审批单号的函数 ====================
CREATE OR REPLACE FUNCTION generate_approval_no()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.approval_no IS NULL THEN
        NEW.approval_no := 'APR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('unified_approval_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trg_unified_approval_no ON unified_approvals;
CREATE TRIGGER trg_unified_approval_no
    BEFORE INSERT ON unified_approvals
    FOR EACH ROW
    EXECUTE FUNCTION generate_approval_no();

-- ==================== 7. 验证表结构 ====================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('approval_trigger_requests', 'unified_approvals', 'sensitive_operations')
ORDER BY table_name;

-- 完成
SELECT '统一审批系统数据库迁移完成' AS message;

