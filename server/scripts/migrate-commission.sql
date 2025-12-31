-- 业务员提成功能数据库迁移脚本
-- 创建时间: 2024-12
-- 功能: 提成规则、阶梯奖金、提成记录、月度结算

-- ==================== 1. 提成规则表 ====================
CREATE TABLE IF NOT EXISTS commission_rules (
    id SERIAL PRIMARY KEY,
    rule_name TEXT NOT NULL,
    customer_level TEXT,                  -- 客户级别: vip/important/normal/potential/all
    rule_type TEXT NOT NULL,              -- 规则类型: percentage(百分比)/fixed(固定金额)/tiered(阶梯)
    commission_base TEXT,                 -- 提成基数: contract_amount/order_amount/profit/receivable
    commission_rate NUMERIC DEFAULT 0,    -- 提成比例(百分比,如5表示5%)
    fixed_amount NUMERIC DEFAULT 0,       -- 固定金额(按单奖金)
    min_base_amount NUMERIC DEFAULT 0,    -- 最低起算基数
    max_commission NUMERIC,               -- 提成封顶金额(NULL表示无上限)
    is_stackable INTEGER DEFAULT 1,       -- 是否可与其他规则叠加: 1=是, 0=否
    apply_to TEXT DEFAULT 'all',          -- 适用范围: contract/order/payment/all
    is_active INTEGER DEFAULT 1,          -- 是否启用: 1=启用, 0=禁用
    priority INTEGER DEFAULT 0,           -- 优先级，数字越大越优先
    notes TEXT,                           -- 备注
    created_by INTEGER,                   -- 创建人ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_commission_rules_customer_level ON commission_rules(customer_level);
CREATE INDEX IF NOT EXISTS idx_commission_rules_rule_type ON commission_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_commission_rules_is_active ON commission_rules(is_active);

-- ==================== 2. 阶梯奖金表 ====================
CREATE TABLE IF NOT EXISTS commission_tiers (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL,             -- 关联规则ID
    tier_level INTEGER NOT NULL,          -- 阶梯级别(1,2,3...)
    min_count INTEGER NOT NULL,           -- 最小单量
    max_count INTEGER,                    -- 最大单量(NULL表示无上限)
    bonus_amount NUMERIC NOT NULL,        -- 该阶梯每单奖金
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_commission_tiers_rule FOREIGN KEY (rule_id) REFERENCES commission_rules(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_commission_tiers_rule_id ON commission_tiers(rule_id);

-- ==================== 3. 提成记录表 ====================
CREATE TABLE IF NOT EXISTS commission_records (
    id TEXT PRIMARY KEY,
    record_no TEXT UNIQUE NOT NULL,       -- 提成记录编号 (CR + 日期 + 序号)
    salesperson_id INTEGER NOT NULL,      -- 业务员ID
    salesperson_name TEXT,                -- 业务员姓名
    customer_id TEXT,                     -- 客户ID
    customer_name TEXT,                   -- 客户名称
    customer_level TEXT,                  -- 快照客户级别
    rule_id INTEGER,                      -- 关联规则ID
    rule_name TEXT,                       -- 规则名称快照
    rule_type TEXT,                       -- 规则类型: percentage/fixed/tiered
    commission_base TEXT,                 -- 提成基数类型
    base_amount NUMERIC DEFAULT 0,        -- 基数金额
    commission_rate NUMERIC DEFAULT 0,    -- 提成比例(百分比时)
    fixed_bonus NUMERIC DEFAULT 0,        -- 固定奖金金额
    tier_bonus NUMERIC DEFAULT 0,         -- 阶梯奖金金额
    commission_amount NUMERIC NOT NULL,   -- 总提成金额
    source_type TEXT NOT NULL,            -- 来源类型: contract/order/payment
    source_id TEXT,                       -- 来源ID
    source_no TEXT,                       -- 来源单号
    settlement_month TEXT,                -- 结算月份(如2024-12)
    settlement_id TEXT,                   -- 关联结算单ID
    status TEXT DEFAULT 'pending',        -- 状态: pending/settled/cancelled
    notes TEXT,                           -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_commission_records_salesperson ON commission_records(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_customer ON commission_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_settlement_month ON commission_records(settlement_month);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_commission_records_source ON commission_records(source_type, source_id);

-- ==================== 4. 提成结算表 ====================
CREATE TABLE IF NOT EXISTS commission_settlements (
    id TEXT PRIMARY KEY,
    settlement_no TEXT UNIQUE NOT NULL,   -- 结算单号 (CS + 年月 + 序号)
    settlement_month TEXT NOT NULL,       -- 结算月份 (如 2024-12)
    salesperson_id INTEGER NOT NULL,      -- 业务员ID
    salesperson_name TEXT,                -- 业务员姓名
    record_count INTEGER DEFAULT 0,       -- 记录数
    total_base_amount NUMERIC DEFAULT 0,  -- 总基数金额
    total_commission NUMERIC DEFAULT 0,   -- 总提成金额
    status TEXT DEFAULT 'draft',          -- 状态: draft/pending/approved/rejected/paid
    submit_time TIMESTAMP,                -- 提交时间
    reviewer_id INTEGER,                  -- 审批人ID
    reviewer_name TEXT,                   -- 审批人姓名
    review_time TIMESTAMP,                -- 审批时间
    review_comment TEXT,                  -- 审批意见
    paid_time TIMESTAMP,                  -- 发放时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_commission_settlements_salesperson ON commission_settlements(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_commission_settlements_month ON commission_settlements(settlement_month);
CREATE INDEX IF NOT EXISTS idx_commission_settlements_status ON commission_settlements(status);

-- ==================== 初始化默认提成规则 ====================

-- 注意: 以下是示例规则，可根据实际业务需求修改

-- VIP客户百分比提成
INSERT INTO commission_rules (rule_name, customer_level, rule_type, commission_base, commission_rate, is_stackable, apply_to, is_active, priority, notes)
VALUES ('VIP客户提成', 'vip', 'percentage', 'contract_amount', 8, 1, 'all', 1, 10, 'VIP客户合同金额8%提成')
ON CONFLICT DO NOTHING;

-- 重要客户百分比提成
INSERT INTO commission_rules (rule_name, customer_level, rule_type, commission_base, commission_rate, is_stackable, apply_to, is_active, priority, notes)
VALUES ('重要客户提成', 'important', 'percentage', 'contract_amount', 5, 1, 'all', 1, 9, '重要客户合同金额5%提成')
ON CONFLICT DO NOTHING;

-- 普通客户百分比提成
INSERT INTO commission_rules (rule_name, customer_level, rule_type, commission_base, commission_rate, is_stackable, apply_to, is_active, priority, notes)
VALUES ('普通客户提成', 'normal', 'percentage', 'contract_amount', 3, 1, 'all', 1, 8, '普通客户合同金额3%提成')
ON CONFLICT DO NOTHING;

-- 潜在客户百分比提成
INSERT INTO commission_rules (rule_name, customer_level, rule_type, commission_base, commission_rate, is_stackable, apply_to, is_active, priority, notes)
VALUES ('潜在客户提成', 'potential', 'percentage', 'contract_amount', 2, 1, 'all', 1, 7, '潜在客户合同金额2%提成')
ON CONFLICT DO NOTHING;

-- 每单固定奖金
INSERT INTO commission_rules (rule_name, customer_level, rule_type, fixed_amount, is_stackable, apply_to, is_active, priority, notes)
VALUES ('每单基础奖', 'all', 'fixed', 50, 1, 'all', 1, 5, '每完成一单奖励50元')
ON CONFLICT DO NOTHING;

-- 月度阶梯奖金规则
INSERT INTO commission_rules (rule_name, customer_level, rule_type, is_stackable, apply_to, is_active, priority, notes)
VALUES ('月度阶梯奖', 'all', 'tiered', 1, 'all', 1, 6, '按月度单量阶梯计算奖金')
ON CONFLICT DO NOTHING;

-- 为阶梯奖金规则添加阶梯配置
-- 获取阶梯规则的ID并插入阶梯配置
DO $$
DECLARE
    tiered_rule_id INTEGER;
BEGIN
    SELECT id INTO tiered_rule_id FROM commission_rules WHERE rule_name = '月度阶梯奖' LIMIT 1;
    
    IF tiered_rule_id IS NOT NULL THEN
        -- 1-10单: 每单30元
        INSERT INTO commission_tiers (rule_id, tier_level, min_count, max_count, bonus_amount)
        VALUES (tiered_rule_id, 1, 1, 10, 30)
        ON CONFLICT DO NOTHING;
        
        -- 11-30单: 每单50元
        INSERT INTO commission_tiers (rule_id, tier_level, min_count, max_count, bonus_amount)
        VALUES (tiered_rule_id, 2, 11, 30, 50)
        ON CONFLICT DO NOTHING;
        
        -- 31单以上: 每单80元
        INSERT INTO commission_tiers (rule_id, tier_level, min_count, max_count, bonus_amount)
        VALUES (tiered_rule_id, 3, 31, NULL, 80)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '提成功能数据库迁移完成！';
    RAISE NOTICE '已创建表: commission_rules, commission_tiers, commission_records, commission_settlements';
    RAISE NOTICE '已初始化默认提成规则';
END $$;
