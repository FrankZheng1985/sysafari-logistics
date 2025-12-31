-- 询价工作流迁移脚本
-- 创建时间: 2025-12-30
-- 用途: 扩展customer_inquiries表，支持询价分配、处理跟踪、及时性监控

-- ==================== 扩展 customer_inquiries 表 ====================

-- 分配相关字段
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id);
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;

-- 处理时限和及时性跟踪
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE;

-- 关联报价单
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS crm_quote_id TEXT;
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS transport_price_id INTEGER;

-- 处理优先级
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- 来源标识
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'portal';

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_to ON customer_inquiries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inquiries_due_at ON customer_inquiries(due_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_is_overdue ON customer_inquiries(is_overdue);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority ON customer_inquiries(priority);
CREATE INDEX IF NOT EXISTS idx_inquiries_source ON customer_inquiries(source);

-- 添加字段注释
COMMENT ON COLUMN customer_inquiries.assigned_to IS '分配给的跟单员ID';
COMMENT ON COLUMN customer_inquiries.assigned_to_name IS '跟单员姓名';
COMMENT ON COLUMN customer_inquiries.assigned_at IS '分配时间';
COMMENT ON COLUMN customer_inquiries.due_at IS '处理截止时间';
COMMENT ON COLUMN customer_inquiries.processed_at IS '实际处理完成时间';
COMMENT ON COLUMN customer_inquiries.is_overdue IS '是否超时处理';
COMMENT ON COLUMN customer_inquiries.crm_quote_id IS '关联的CRM报价单ID';
COMMENT ON COLUMN customer_inquiries.transport_price_id IS '关联的固定线路报价ID';
COMMENT ON COLUMN customer_inquiries.priority IS '处理优先级: urgent/high/normal/low';
COMMENT ON COLUMN customer_inquiries.source IS '询价来源: portal/crm/manual';

-- ==================== 询价待办任务关联表 ====================
CREATE TABLE IF NOT EXISTS inquiry_tasks (
    id SERIAL PRIMARY KEY,
    inquiry_id TEXT NOT NULL,
    inquiry_number TEXT NOT NULL,
    
    -- 任务分配
    assignee_id INTEGER NOT NULL REFERENCES users(id),
    assignee_name TEXT,
    assignee_role TEXT,
    
    -- 上级链（用于监督）
    supervisor_id INTEGER REFERENCES users(id),
    supervisor_name TEXT,
    super_supervisor_id INTEGER REFERENCES users(id),
    super_supervisor_name TEXT,
    
    -- 任务状态
    task_type TEXT NOT NULL DEFAULT 'process', -- process/supervise
    status TEXT DEFAULT 'pending', -- pending/processing/completed/overdue
    
    -- 时间跟踪
    due_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- 提醒
    reminder_sent BOOLEAN DEFAULT FALSE,
    overdue_notified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_inquiry_id ON inquiry_tasks(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_assignee ON inquiry_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_supervisor ON inquiry_tasks(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_status ON inquiry_tasks(status);
CREATE INDEX IF NOT EXISTS idx_inquiry_tasks_due_at ON inquiry_tasks(due_at);

COMMENT ON TABLE inquiry_tasks IS '询价待办任务表，用于跟踪询价处理任务分配和及时性';


