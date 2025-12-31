-- 惩罚规则数据库迁移脚本
-- 创建时间: 2025-12
-- 功能: 提成惩罚规则、惩罚记录

-- ==================== 1. 惩罚规则表 ====================
CREATE TABLE IF NOT EXISTS commission_penalty_rules (
    id SERIAL PRIMARY KEY,
    penalty_name TEXT NOT NULL,                    -- 惩罚名称
    penalty_type TEXT NOT NULL,                    -- 惩罚类型: inspection(查验)/mistake(工作失误)/loss(经济损失)
    total_amount NUMERIC DEFAULT 0,                -- 总惩罚金额
    supervisor_penalty NUMERIC DEFAULT 0,          -- 主管惩罚金额
    sales_penalty NUMERIC DEFAULT 0,               -- 跟单惩罚金额
    document_penalty NUMERIC DEFAULT 0,            -- 单证惩罚金额
    loss_percentage NUMERIC DEFAULT 30,            -- 经济损失承担比例(%)
    max_penalty_rate NUMERIC DEFAULT 100,          -- 最高惩罚比例(不超过当月奖金的%)
    is_active INTEGER DEFAULT 1,                   -- 是否启用: 1=启用, 0=禁用
    notes TEXT,                                    -- 备注说明
    created_by INTEGER,                            -- 创建人ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_penalty_rules_type ON commission_penalty_rules(penalty_type);
CREATE INDEX IF NOT EXISTS idx_penalty_rules_active ON commission_penalty_rules(is_active);

-- ==================== 2. 惩罚记录表 ====================
CREATE TABLE IF NOT EXISTS commission_penalty_records (
    id TEXT PRIMARY KEY,
    record_no TEXT UNIQUE NOT NULL,                -- 惩罚记录编号 (PR + 日期 + 序号)
    penalty_rule_id INTEGER,                       -- 关联惩罚规则ID
    penalty_name TEXT,                             -- 惩罚名称快照
    penalty_type TEXT NOT NULL,                    -- 惩罚类型
    
    -- 客户关联信息
    customer_id TEXT,                              -- 关联客户ID
    customer_name TEXT,                            -- 客户名称
    
    -- 责任人信息
    supervisor_id INTEGER,                         -- 主管ID
    supervisor_name TEXT,                          -- 主管姓名
    supervisor_penalty NUMERIC DEFAULT 0,          -- 主管惩罚金额
    
    sales_id INTEGER,                              -- 跟单ID
    sales_name TEXT,                               -- 跟单姓名
    sales_penalty NUMERIC DEFAULT 0,               -- 跟单惩罚金额
    
    document_id INTEGER,                           -- 单证ID
    document_name TEXT,                            -- 单证姓名
    document_penalty NUMERIC DEFAULT 0,            -- 单证惩罚金额
    
    total_penalty NUMERIC NOT NULL,                -- 总惩罚金额
    
    -- 订单关联信息
    related_order_id TEXT,                         -- 关联订单ID
    related_order_no TEXT,                         -- 关联订单号
    related_contract_id TEXT,                      -- 关联合同ID
    related_contract_no TEXT,                      -- 关联合同号
    loss_amount NUMERIC DEFAULT 0,                 -- 经济损失金额(用于计算损失类惩罚)
    
    -- 状态信息
    settlement_month TEXT,                         -- 结算月份(如2025-01)
    settlement_id TEXT,                            -- 关联结算单ID
    status TEXT DEFAULT 'pending',                 -- 状态: pending(待处理)/communicated(已沟通)/confirmed(已确认)/settled(已结算)/cancelled(已取消)
    is_trial_period INTEGER DEFAULT 0,             -- 是否试用期: 1=试用期(只沟通不惩罚), 0=正式
    
    -- 其他信息
    incident_date DATE,                            -- 事件发生日期
    incident_description TEXT,                     -- 事件描述
    notes TEXT,                                    -- 备注
    created_by INTEGER,                            -- 创建人ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_penalty_records_rule FOREIGN KEY (penalty_rule_id) REFERENCES commission_penalty_rules(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_penalty_records_supervisor ON commission_penalty_records(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_penalty_records_sales ON commission_penalty_records(sales_id);
CREATE INDEX IF NOT EXISTS idx_penalty_records_document ON commission_penalty_records(document_id);
CREATE INDEX IF NOT EXISTS idx_penalty_records_month ON commission_penalty_records(settlement_month);
CREATE INDEX IF NOT EXISTS idx_penalty_records_status ON commission_penalty_records(status);
CREATE INDEX IF NOT EXISTS idx_penalty_records_type ON commission_penalty_records(penalty_type);

-- ==================== 3. 方案配置表 ====================
CREATE TABLE IF NOT EXISTS commission_scheme_config (
    id SERIAL PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,               -- 配置键
    config_value TEXT NOT NULL,                    -- 配置值
    description TEXT,                              -- 描述
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 初始化默认惩罚规则 ====================

-- 查验惩罚规则
INSERT INTO commission_penalty_rules (
    penalty_name, penalty_type, total_amount, 
    supervisor_penalty, sales_penalty, document_penalty,
    loss_percentage, max_penalty_rate, is_active, notes
) VALUES (
    '查验惩罚', 'inspection', 500,
    100, 100, 300,
    0, 100, 1, '查验一条柜的惩罚金额，主管100元，跟单100元，单证300元'
) ON CONFLICT DO NOTHING;

-- 工作失误惩罚规则
INSERT INTO commission_penalty_rules (
    penalty_name, penalty_type, total_amount, 
    supervisor_penalty, sales_penalty, document_penalty,
    loss_percentage, max_penalty_rate, is_active, notes
) VALUES (
    '工作失误', 'mistake', 50,
    15, 15, 20,
    0, 100, 1, '一般工作失误每次惩罚50元'
) ON CONFLICT DO NOTHING;

-- 直接经济损失惩罚规则
INSERT INTO commission_penalty_rules (
    penalty_name, penalty_type, total_amount, 
    supervisor_penalty, sales_penalty, document_penalty,
    loss_percentage, max_penalty_rate, is_active, notes
) VALUES (
    '直接经济损失', 'loss', 0,
    0, 0, 0,
    30, 100, 1, '直接经济损失工作失误，承担经济损失金额的30%，从当月奖金或工资中扣除。惩罚金额不能大于当月奖金金额。'
) ON CONFLICT DO NOTHING;

-- ==================== 初始化方案配置 ====================

-- 方案开始日期
INSERT INTO commission_scheme_config (config_key, config_value, description)
VALUES ('scheme_start_date', '2025-12-01', '奖惩方案开始日期')
ON CONFLICT (config_key) DO NOTHING;

-- 惩罚试用期(月)
INSERT INTO commission_scheme_config (config_key, config_value, description)
VALUES ('penalty_trial_months', '3', '惩罚规则试用期，期间只沟通不直接惩罚')
ON CONFLICT (config_key) DO NOTHING;

-- 方案最短试运行期(月)
INSERT INTO commission_scheme_config (config_key, config_value, description)
VALUES ('scheme_min_duration', '6', '方案最短试运行期')
ON CONFLICT (config_key) DO NOTHING;

-- 方案最长试运行期(月)
INSERT INTO commission_scheme_config (config_key, config_value, description)
VALUES ('scheme_max_duration', '12', '方案最长试运行期，到期后需评估是否调整或延续')
ON CONFLICT (config_key) DO NOTHING;

-- ==================== 提成规则表增加角色分配字段 ====================

-- 为固定金额规则添加角色分配字段
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS fixed_supervisor_amount NUMERIC DEFAULT 0;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS fixed_sales_amount NUMERIC DEFAULT 0;
ALTER TABLE commission_rules ADD COLUMN IF NOT EXISTS fixed_document_amount NUMERIC DEFAULT 0;

-- 为阶梯奖金表添加角色分配字段
ALTER TABLE commission_tiers ADD COLUMN IF NOT EXISTS supervisor_bonus NUMERIC DEFAULT 0;
ALTER TABLE commission_tiers ADD COLUMN IF NOT EXISTS sales_bonus NUMERIC DEFAULT 0;
ALTER TABLE commission_tiers ADD COLUMN IF NOT EXISTS document_bonus NUMERIC DEFAULT 0;

-- ==================== 结算单表增加字段 ====================

-- 奖励记录数
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS reward_record_count INTEGER DEFAULT 0;

-- 惩罚记录数
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS penalty_record_count INTEGER DEFAULT 0;

-- 总奖励金额
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS total_reward NUMERIC DEFAULT 0;

-- 总惩罚金额
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS total_penalty NUMERIC DEFAULT 0;

-- 净结算金额
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- 财务凭证ID
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS financial_voucher_id TEXT;

-- 财务凭证号
ALTER TABLE commission_settlements ADD COLUMN IF NOT EXISTS financial_voucher_no TEXT;

-- 更新现有数据
UPDATE commission_settlements 
SET reward_record_count = record_count,
    total_reward = total_commission,
    net_amount = total_commission
WHERE reward_record_count IS NULL OR reward_record_count = 0;

-- ==================== 财务凭证关联表 ====================

CREATE TABLE IF NOT EXISTS commission_financial_vouchers (
    id TEXT PRIMARY KEY,
    voucher_no TEXT UNIQUE NOT NULL,           -- 凭证号
    settlement_id TEXT NOT NULL,               -- 关联结算单ID
    settlement_no TEXT,                        -- 结算单号
    voucher_date DATE NOT NULL,                -- 凭证日期
    voucher_type TEXT DEFAULT 'payment',       -- 凭证类型: payment(付款)/accrual(计提)
    
    -- 金额信息
    total_amount NUMERIC NOT NULL,             -- 总金额
    reward_amount NUMERIC DEFAULT 0,           -- 奖励金额
    penalty_amount NUMERIC DEFAULT 0,          -- 惩罚金额
    
    -- 科目信息
    debit_account TEXT,                        -- 借方科目
    credit_account TEXT,                       -- 贷方科目
    
    -- 状态
    status TEXT DEFAULT 'pending',             -- 状态: pending(待付款)/paid(已付款)/cancelled(已取消)
    
    -- 关联人员
    salesperson_id INTEGER,
    salesperson_name TEXT,
    
    -- 备注
    notes TEXT,
    
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_financial_vouchers_settlement ON commission_financial_vouchers(settlement_id);
CREATE INDEX IF NOT EXISTS idx_financial_vouchers_date ON commission_financial_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_financial_vouchers_status ON commission_financial_vouchers(status);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '惩罚规则数据库迁移完成！';
    RAISE NOTICE '已创建表: commission_penalty_rules, commission_penalty_records, commission_scheme_config, commission_financial_vouchers';
    RAISE NOTICE '已初始化默认惩罚规则和方案配置';
    RAISE NOTICE '已为commission_rules和commission_tiers表添加角色分配字段';
    RAISE NOTICE '已为commission_settlements表添加奖惩和财务字段';
END $$;
