-- 费用项审批表
-- 用于存储手动录入的费用项审批申请
-- 审批通过后自动添加到供应商报价库

CREATE TABLE IF NOT EXISTS fee_item_approvals (
  id SERIAL PRIMARY KEY,
  
  -- 关联费用信息
  fee_id TEXT,                          -- 关联的费用记录ID
  fee_name TEXT NOT NULL,               -- 费用名称
  fee_name_en TEXT,                     -- 费用英文名称
  category TEXT DEFAULT 'other',        -- 费用类别
  amount DECIMAL(12,2),                 -- 金额
  currency TEXT DEFAULT 'EUR',          -- 币种
  unit TEXT DEFAULT '次',               -- 单位
  
  -- 供应商信息（应付费用时必填）
  supplier_id TEXT,                     -- 供应商ID
  supplier_name TEXT,                   -- 供应商名称
  
  -- 申请信息
  description TEXT,                     -- 申请说明
  requested_by TEXT,                    -- 申请人ID
  requested_by_name TEXT,               -- 申请人姓名
  requested_at TIMESTAMP DEFAULT NOW(), -- 申请时间
  
  -- 审批信息
  status TEXT DEFAULT 'pending',        -- 状态: pending/approved/rejected
  approved_by TEXT,                     -- 审批人ID
  approved_by_name TEXT,                -- 审批人姓名
  approved_at TIMESTAMP,                -- 审批时间
  rejection_reason TEXT,                -- 拒绝原因
  
  -- 转为常规费用后的信息
  converted_to_price_id INTEGER,        -- 转换后的供应商报价ID
  converted_at TIMESTAMP,               -- 转换时间
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_status ON fee_item_approvals(status);
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_supplier ON fee_item_approvals(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_fee ON fee_item_approvals(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_item_approvals_requested_by ON fee_item_approvals(requested_by);

-- 添加注释
COMMENT ON TABLE fee_item_approvals IS '费用项审批表 - 存储手动录入的费用项审批申请';
COMMENT ON COLUMN fee_item_approvals.status IS '审批状态: pending=待审批, approved=已通过, rejected=已拒绝';
COMMENT ON COLUMN fee_item_approvals.converted_to_price_id IS '审批通过后转换为供应商报价的ID';

