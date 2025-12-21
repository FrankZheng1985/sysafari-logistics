-- ==================== 审批系统数据库迁移脚本 ====================
-- 创建时间: 2024-12
-- 说明: 创建敏感操作审批流程所需的数据库表
-- 执行方式: psql -h host -U user -d database -f migrate-approval-system.sql

-- ==================== 1. 敏感操作审批请求表 ====================
CREATE TABLE IF NOT EXISTS approval_requests (
    id SERIAL PRIMARY KEY,
    -- 请求标识
    request_no TEXT UNIQUE,                    -- 审批单号，如 APR-2024-0001
    request_type TEXT NOT NULL,                -- 请求类型
    request_title TEXT NOT NULL,               -- 请求标题
    
    -- 请求详情
    request_data JSONB,                        -- 请求的详细数据（JSON格式存储）
    target_user_id INTEGER,                    -- 目标用户ID（如涉及用户操作）
    target_user_name TEXT,                     -- 目标用户名称
    
    -- 发起人信息
    requester_id INTEGER NOT NULL,             -- 申请人ID
    requester_name TEXT,                       -- 申请人姓名
    requester_role TEXT,                       -- 申请人角色
    requester_department TEXT,                 -- 申请人部门
    
    -- 审批人信息
    approver_id INTEGER,                       -- 审批人ID（通常是老板或管理员）
    approver_name TEXT,                        -- 审批人姓名
    approver_role TEXT,                        -- 审批人角色
    
    -- 审批状态
    status TEXT DEFAULT 'pending',             -- pending/approved/rejected/cancelled/expired
    priority TEXT DEFAULT 'normal',            -- low/normal/high/urgent
    
    -- 审批意见
    approval_comment TEXT,                     -- 审批意见/备注
    rejection_reason TEXT,                     -- 拒绝原因
    
    -- 执行状态
    is_executed BOOLEAN DEFAULT FALSE,         -- 是否已执行（审批通过后的操作是否完成）
    executed_at TIMESTAMP,                     -- 执行时间
    execution_result TEXT,                     -- 执行结果
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,                     -- 审批通过时间
    expires_at TIMESTAMP,                      -- 过期时间（超时自动取消）
    
    -- 关联
    related_request_id INTEGER,                -- 关联的其他审批请求ID
    
    -- 约束
    CONSTRAINT chk_request_type CHECK (request_type IN (
        'user_create',           -- 创建用户
        'user_update',           -- 修改用户
        'user_delete',           -- 删除用户
        'role_change',           -- 变更角色
        'permission_grant',      -- 授予权限
        'permission_revoke',     -- 撤销权限
        'finance_operation',     -- 财务操作
        'data_export',           -- 数据导出
        'system_config',         -- 系统配置
        'other'                  -- 其他
    )),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    CONSTRAINT chk_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_approver ON approval_requests(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created ON approval_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_request_no ON approval_requests(request_no);

-- 添加注释
COMMENT ON TABLE approval_requests IS '敏感操作审批请求表';
COMMENT ON COLUMN approval_requests.request_type IS '请求类型：user_create/user_update/user_delete/role_change/permission_grant/permission_revoke/finance_operation/data_export/system_config/other';
COMMENT ON COLUMN approval_requests.request_data IS 'JSON格式存储的请求详细数据，根据request_type不同结构不同';
COMMENT ON COLUMN approval_requests.status IS '审批状态：pending-待审批/approved-已通过/rejected-已拒绝/cancelled-已取消/expired-已过期';

-- ==================== 2. 审批历史记录表 ====================
CREATE TABLE IF NOT EXISTS approval_history (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    
    -- 操作信息
    action TEXT NOT NULL,                      -- submit/approve/reject/cancel/expire/execute
    action_name TEXT,                          -- 操作名称（中文）
    
    -- 操作人
    operator_id INTEGER,
    operator_name TEXT,
    operator_role TEXT,
    
    -- 操作详情
    comment TEXT,                              -- 操作备注
    old_status TEXT,                           -- 变更前状态
    new_status TEXT,                           -- 变更后状态
    
    -- 附加数据
    extra_data JSONB,                          -- 额外数据
    
    -- 时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT chk_action CHECK (action IN ('submit', 'approve', 'reject', 'cancel', 'expire', 'execute', 'remind', 'reassign'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_approval_history_request ON approval_history(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_operator ON approval_history(operator_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_action ON approval_history(action);
CREATE INDEX IF NOT EXISTS idx_approval_history_created ON approval_history(created_at);

-- 添加注释
COMMENT ON TABLE approval_history IS '审批操作历史记录表';
COMMENT ON COLUMN approval_history.action IS '操作类型：submit-提交/approve-通过/reject-拒绝/cancel-取消/expire-过期/execute-执行/remind-催办/reassign-转交';

-- ==================== 3. 审批配置表 ====================
CREATE TABLE IF NOT EXISTS approval_configs (
    id SERIAL PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    config_type TEXT DEFAULT 'string',         -- string/number/boolean/json
    description TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT INTO approval_configs (config_key, config_value, config_type, description, category)
VALUES 
    -- 审批流程配置
    ('approval_enabled', 'true', 'boolean', '是否启用审批流程', 'general'),
    ('approval_expire_hours', '72', 'number', '审批请求过期时间（小时）', 'general'),
    ('approval_auto_remind_hours', '24', 'number', '自动提醒间隔（小时）', 'general'),
    
    -- 需要审批的操作类型
    ('require_approval_user_create', 'true', 'boolean', '创建用户需要审批', 'operations'),
    ('require_approval_user_delete', 'true', 'boolean', '删除用户需要审批', 'operations'),
    ('require_approval_role_change', 'true', 'boolean', '变更角色需要审批', 'operations'),
    ('require_approval_permission_grant', 'true', 'boolean', '授予高级权限需要审批', 'operations'),
    ('require_approval_finance_operation', 'true', 'boolean', '大额财务操作需要审批', 'operations'),
    ('require_approval_data_export', 'true', 'boolean', '敏感数据导出需要审批', 'operations'),
    
    -- 财务审批阈值
    ('finance_approval_threshold', '10000', 'number', '财务操作审批阈值（金额）', 'threshold'),
    
    -- 审批人配置
    ('default_approver_roles', '["admin", "boss"]', 'json', '默认审批人角色列表', 'approvers'),
    ('finance_approver_roles', '["admin", "boss", "finance_director"]', 'json', '财务审批人角色列表', 'approvers')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 添加注释
COMMENT ON TABLE approval_configs IS '审批系统配置表';

-- ==================== 4. 敏感操作定义表 ====================
CREATE TABLE IF NOT EXISTS sensitive_operations (
    id SERIAL PRIMARY KEY,
    operation_code TEXT UNIQUE NOT NULL,       -- 操作代码
    operation_name TEXT NOT NULL,              -- 操作名称
    operation_type TEXT NOT NULL,              -- 操作类型分类
    description TEXT,                          -- 描述
    requires_approval BOOLEAN DEFAULT TRUE,    -- 是否需要审批
    approval_level INTEGER DEFAULT 1,          -- 审批级别（1-普通，2-重要，3-关键）
    approver_roles TEXT[],                     -- 可审批的角色列表
    is_active BOOLEAN DEFAULT TRUE,            -- 是否启用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入敏感操作定义
INSERT INTO sensitive_operations (operation_code, operation_name, operation_type, description, requires_approval, approval_level, approver_roles)
VALUES 
    -- 用户管理类
    ('USER_CREATE', '创建用户', 'user_management', '创建新的系统用户', TRUE, 2, ARRAY['admin', 'boss']),
    ('USER_DELETE', '删除用户', 'user_management', '删除系统用户', TRUE, 3, ARRAY['admin', 'boss']),
    ('USER_ROLE_CHANGE', '变更用户角色', 'user_management', '修改用户的系统角色', TRUE, 2, ARRAY['admin', 'boss']),
    ('USER_STATUS_CHANGE', '变更用户状态', 'user_management', '启用或禁用用户', TRUE, 1, ARRAY['admin', 'boss', 'manager']),
    
    -- 权限管理类
    ('PERMISSION_GRANT_SENSITIVE', '授予敏感权限', 'permission_management', '授予标记为敏感的权限', TRUE, 3, ARRAY['admin', 'boss']),
    ('PERMISSION_REVOKE', '撤销权限', 'permission_management', '撤销用户权限', TRUE, 1, ARRAY['admin', 'boss', 'manager']),
    ('ROLE_PERMISSION_CHANGE', '修改角色权限', 'permission_management', '修改角色的权限配置', TRUE, 3, ARRAY['admin', 'boss']),
    
    -- 财务类
    ('FINANCE_LARGE_PAYMENT', '大额付款', 'finance', '超过阈值的付款操作', TRUE, 2, ARRAY['admin', 'boss', 'finance_director']),
    ('FINANCE_REFUND', '退款操作', 'finance', '执行退款', TRUE, 2, ARRAY['admin', 'boss', 'finance_director']),
    ('FINANCE_WRITE_OFF', '坏账核销', 'finance', '核销应收款', TRUE, 3, ARRAY['admin', 'boss']),
    ('FINANCE_INVOICE_VOID', '发票作废', 'finance', '作废已开发票', TRUE, 2, ARRAY['admin', 'boss', 'finance_director']),
    
    -- 数据类
    ('DATA_EXPORT_SENSITIVE', '导出敏感数据', 'data', '导出包含敏感信息的数据', TRUE, 2, ARRAY['admin', 'boss']),
    ('DATA_BATCH_DELETE', '批量删除数据', 'data', '批量删除业务数据', TRUE, 3, ARRAY['admin', 'boss']),
    
    -- 系统类
    ('SYSTEM_CONFIG_CHANGE', '修改系统配置', 'system', '修改系统级配置', TRUE, 3, ARRAY['admin']),
    ('SECURITY_SETTING_CHANGE', '修改安全设置', 'system', '修改安全相关设置', TRUE, 3, ARRAY['admin'])
ON CONFLICT (operation_code) DO UPDATE SET
    operation_name = EXCLUDED.operation_name,
    description = EXCLUDED.description,
    requires_approval = EXCLUDED.requires_approval,
    approval_level = EXCLUDED.approval_level,
    approver_roles = EXCLUDED.approver_roles,
    updated_at = NOW();

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sensitive_ops_type ON sensitive_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_sensitive_ops_active ON sensitive_operations(is_active);

-- 添加注释
COMMENT ON TABLE sensitive_operations IS '敏感操作定义表，定义哪些操作需要审批';

-- ==================== 5. 审批通知表 ====================
CREATE TABLE IF NOT EXISTS approval_notifications (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    
    -- 通知对象
    user_id INTEGER NOT NULL,                  -- 接收通知的用户ID
    user_name TEXT,
    
    -- 通知内容
    notification_type TEXT NOT NULL,           -- new_request/approved/rejected/reminder/expired
    title TEXT NOT NULL,
    content TEXT,
    
    -- 状态
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    -- 时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 约束
    CONSTRAINT chk_notification_type CHECK (notification_type IN ('new_request', 'approved', 'rejected', 'reminder', 'expired', 'cancelled'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_approval_notifications_user ON approval_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_request ON approval_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_read ON approval_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_created ON approval_notifications(created_at);

-- 添加注释
COMMENT ON TABLE approval_notifications IS '审批通知表';

-- ==================== 6. 创建序列生成审批单号的函数 ====================
CREATE OR REPLACE FUNCTION generate_approval_request_no()
RETURNS TRIGGER AS $$
DECLARE
    year_str TEXT;
    seq_num INTEGER;
    new_request_no TEXT;
BEGIN
    year_str := to_char(CURRENT_DATE, 'YYYY');
    
    -- 获取当年的序号
    SELECT COALESCE(MAX(
        CASE 
            WHEN request_no LIKE 'APR-' || year_str || '-%' 
            THEN CAST(SUBSTRING(request_no FROM 10) AS INTEGER)
            ELSE 0 
        END
    ), 0) + 1
    INTO seq_num
    FROM approval_requests
    WHERE request_no LIKE 'APR-' || year_str || '-%';
    
    new_request_no := 'APR-' || year_str || '-' || LPAD(seq_num::TEXT, 4, '0');
    NEW.request_no := new_request_no;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（如果不存在）
DROP TRIGGER IF EXISTS trg_generate_approval_request_no ON approval_requests;
CREATE TRIGGER trg_generate_approval_request_no
    BEFORE INSERT ON approval_requests
    FOR EACH ROW
    WHEN (NEW.request_no IS NULL)
    EXECUTE FUNCTION generate_approval_request_no();

-- ==================== 7. 创建更新时间戳的触发器函数 ====================
CREATE OR REPLACE FUNCTION update_approval_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为审批请求表创建更新触发器
DROP TRIGGER IF EXISTS trg_approval_requests_updated ON approval_requests;
CREATE TRIGGER trg_approval_requests_updated
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_approval_timestamp();

-- ==================== 8. 创建过期审批自动处理函数 ====================
CREATE OR REPLACE FUNCTION expire_pending_approvals()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE approval_requests
    SET status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ==================== 完成 ====================
SELECT '✅ 审批系统数据库迁移完成！' AS status;

-- 显示创建的表
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('approval_requests', 'approval_history', 'approval_configs', 'sensitive_operations', 'approval_notifications')
ORDER BY table_name;
