-- ============================================================
-- 客户门户提单审核功能 - 数据库迁移脚本
-- 创建时间: 2026-01-07
-- 功能: 支持客户通过门户提交提单，需要人工审核后才能进入正式提单列表
-- ============================================================

-- 1. bills_of_lading 表添加审核相关字段
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal';           -- 来源：internal(内部) / portal(门户)

ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'approved';    -- 审核状态：pending/approved/rejected

ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS reject_reason TEXT;                       -- 退回原因

ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;                    -- 审核时间

ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS reviewer_id INTEGER;                      -- 审核人ID

ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS reviewer_name TEXT;                       -- 审核人姓名

-- 2. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_bills_source ON bills_of_lading(source);
CREATE INDEX IF NOT EXISTS idx_bills_review_status ON bills_of_lading(review_status);

-- 3. 添加审批类型配置（操作员和运营经理可审批，老板收通知）
INSERT INTO sensitive_operations (
  operation_code, 
  operation_name, 
  description, 
  category,
  approver_roles, 
  notify_roles, 
  requires_approval, 
  is_active
) VALUES (
  'PORTAL_BILL_SUBMIT',
  '客户提单提交',
  '客户通过门户提交的提单需要审核',
  'business',
  ARRAY['operator', 'operations_manager'],
  ARRAY['boss'],
  true,
  true
) ON CONFLICT (operation_code) DO UPDATE SET
  operation_name = '客户提单提交',
  description = '客户通过门户提交的提单需要审核',
  approver_roles = ARRAY['operator', 'operations_manager'],
  notify_roles = ARRAY['boss'],
  requires_approval = true,
  is_active = true;

-- 4. 更新现有提单数据（将所有现有提单标记为内部创建且已审核）
UPDATE bills_of_lading 
SET source = 'internal', review_status = 'approved' 
WHERE source IS NULL OR source = '';

-- 完成提示
SELECT '✅ 客户门户提单审核功能数据库迁移完成' AS result;

