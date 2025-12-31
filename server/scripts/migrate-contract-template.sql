-- =====================================================
-- 清关合同模板系统 - 数据库迁移脚本
-- 创建时间: 2025-12-20
-- 说明: 创建合同模板配置、赔偿标准、保险配置、高峰期、合同记录等表
-- =====================================================

-- 1. 合同模板配置表
CREATE TABLE IF NOT EXISTS contract_template_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value TEXT,
  config_type VARCHAR(20) DEFAULT 'text',  -- number/text/json
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配置表索引
CREATE INDEX IF NOT EXISTS idx_contract_template_config_key ON contract_template_config(config_key);

-- 2. 赔偿标准配置表
CREATE TABLE IF NOT EXISTS contract_compensation_rules (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,  -- oversized/general/clothing/shoes
  category_name VARCHAR(50),
  max_compensation DECIMAL(12,2) DEFAULT 0,
  container_types TEXT,  -- 适用柜型: 40GP,40HQ,45HC,45HQ
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 赔偿标准索引
CREATE INDEX IF NOT EXISTS idx_contract_compensation_category ON contract_compensation_rules(category);
CREATE INDEX IF NOT EXISTS idx_contract_compensation_active ON contract_compensation_rules(is_active);

-- 3. 保险费率配置表
CREATE TABLE IF NOT EXISTS contract_insurance_config (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  category_name VARCHAR(50),
  normal_cap DECIMAL(12,2) DEFAULT 0,      -- 正常保额封顶
  insured_cap DECIMAL(12,2) DEFAULT 0,     -- 投保后封顶
  premium_per_10k DECIMAL(10,2) DEFAULT 500, -- 每万欧保费
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 保险配置索引
CREATE INDEX IF NOT EXISTS idx_contract_insurance_category ON contract_insurance_config(category);
CREATE INDEX IF NOT EXISTS idx_contract_insurance_active ON contract_insurance_config(is_active);

-- 4. 海运高峰期配置表
CREATE TABLE IF NOT EXISTS contract_peak_seasons (
  id SERIAL PRIMARY KEY,
  season_name VARCHAR(100),
  start_month INTEGER NOT NULL,
  start_day INTEGER NOT NULL,
  end_month INTEGER NOT NULL,
  end_day INTEGER NOT NULL,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 高峰期索引
CREATE INDEX IF NOT EXISTS idx_contract_peak_seasons_active ON contract_peak_seasons(is_active);

-- 5. 清关合同记录表
CREATE TABLE IF NOT EXISTS customs_contracts (
  id SERIAL PRIMARY KEY,
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER,
  customer_name VARCHAR(200),
  customer_company VARCHAR(200),
  
  -- 合同配置快照（签订时的配置值）
  payment_days INTEGER DEFAULT 7,
  late_fee_rate DECIMAL(5,2) DEFAULT 0.2,
  max_overdue_days INTEGER DEFAULT 15,
  clearance_days INTEGER DEFAULT 15,
  compensation_snapshot JSONB,
  insurance_snapshot JSONB,
  peak_seasons_snapshot JSONB,
  disclaimer_clauses JSONB,
  
  -- 状态与审批
  status VARCHAR(20) DEFAULT 'draft',  -- draft/pending/approved/rejected
  created_by INTEGER,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  reject_reason TEXT,
  
  -- PDF路径
  pdf_path TEXT,
  
  -- 时间戳
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 合同记录索引
CREATE INDEX IF NOT EXISTS idx_customs_contracts_no ON customs_contracts(contract_no);
CREATE INDEX IF NOT EXISTS idx_customs_contracts_customer ON customs_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customs_contracts_status ON customs_contracts(status);
CREATE INDEX IF NOT EXISTS idx_customs_contracts_created ON customs_contracts(created_at DESC);

-- =====================================================
-- 初始化默认配置数据
-- =====================================================

-- 基础配置项
INSERT INTO contract_template_config (config_key, config_value, config_type, description)
VALUES 
  ('payment_days', '7', 'number', '货到后付款天数'),
  ('late_fee_rate', '0.2', 'number', '超期违约金比例（%/天）'),
  ('max_overdue_days', '15', 'number', '最大超期天数，超过后可扣押货物'),
  ('clearance_days', '15', 'number', '正常清关工作日'),
  ('insurance_premium_per_10k', '500', 'number', '保险费用（每10000欧元收取的费用，单位：欧元）'),
  ('delay_notice_days', '30', 'number', '合同修改提前通知天数'),
  ('company_name_cn', '先锋国际物流有限公司', 'text', '乙方公司名称（中文）'),
  ('company_name_en', 'Xianfeng International Logistics Limited', 'text', '乙方公司名称（英文）'),
  ('bank_account_name', 'Xianfeng International Logistics', 'text', '收款账户名'),
  ('bank_account_number', '015-150-68-100225', 'text', '收款账号'),
  ('bank_name', 'The Bank of East Asia, Limited', 'text', '开户银行'),
  ('bank_address', '10 Des Voeux Road, Central, Hong Kong', 'text', '银行地址'),
  ('swift_code', 'BEASHKHH', 'text', 'SWIFT代码'),
  ('clearing_no', '015', 'text', '清算号')
ON CONFLICT (config_key) DO NOTHING;

-- 免责条款配置
INSERT INTO contract_template_config (config_key, config_value, config_type, description)
VALUES (
  'disclaimer_clauses',
  '[
    "若出现自然灾害、战争、工人罢工（包括港口、机场、铁路货站等）等不可抗力因素导致货物灭失或者运输延误的，乙方不承担货物灭失的赔偿责任及延误的赔偿责任。",
    "如货物在国际段运输中发生灭失的，乙方不承担货物灭失的赔偿责任。乙方有义务代甲方为向承运人申请索赔，但不对申请结果负责。",
    "若因货物的知识产权原因被欧盟政府的执法部门查扣，由此引起的一切责任、费用与风险由甲方承担。即使出货前甲方已将产品图片、商标发给货代审核，货代也不能保证该货物是否侵犯知识产权，最终鉴定由当地欧盟政府的执法部门的文件为准。",
    "若因货物不符合欧盟要求（包括并不限于知识产权，价格标签、货物产地标签、货物成份标签、货物质量等）等因素导致货物被扣留或者灭失的，货代不承担货物灭失的赔偿责任，一切责任、费用与风险由甲方承担。",
    "如因甲方提供的货物单据和实际货物情况不符而引起欧盟政府的执法部门查扣，由此引起的一切责任、费用与风险由甲方承担。货代不承担货物灭失的赔偿责任及延误的赔偿责任。",
    "若因甲方提供的收货人公司不能接受销售发票、不能办理律师委托函或被政府列入黑名单，货代不承担货物灭失和运输延误的赔偿责任。",
    "如果甲方当期运费没有按照双方约定时间支付，则该时间段货代发生到货延误也将免于赔偿。即月（周）结甲方不按双方约定时间支付运费的话，该月（周）业务如发生到货延误的话，也免于赔偿。"
  ]',
  'json',
  '免责条款列表'
)
ON CONFLICT (config_key) DO NOTHING;

-- 赔偿标准配置（根据合同内容）
INSERT INTO contract_compensation_rules (category, category_name, max_compensation, container_types, notes)
VALUES 
  ('oversized', '超大件', 30000, '40GP,40HQ,45HC,45HQ', '超大件货物最高赔偿30000欧元'),
  ('general', '百货', 30000, '40GP,40HQ,45HC,45HQ', '百货类货物最高赔偿30000欧元'),
  ('clothing', '服装', 80000, '40GP,40HQ,45HC,45HQ', '服装类货物最高赔偿80000欧元'),
  ('shoes', '鞋子', 60000, '40GP,40HQ,45HC,45HQ', '鞋子类货物最高赔偿60000欧元')
ON CONFLICT DO NOTHING;

-- 保险费率配置
INSERT INTO contract_insurance_config (category, category_name, normal_cap, insured_cap, premium_per_10k)
VALUES 
  ('oversized', '超大件', 30000, 50000, 500),
  ('general', '百货', 30000, 50000, 500),
  ('clothing', '服装', 80000, 100000, 500),
  ('shoes', '鞋子', 60000, 80000, 500)
ON CONFLICT DO NOTHING;

-- 海运高峰期配置
INSERT INTO contract_peak_seasons (season_name, start_month, start_day, end_month, end_day, notes)
VALUES 
  ('暑期高峰', 8, 15, 9, 15, '海运每年8月15号到9月15号期间，因国外司机放假等原因造成柜子无法正常送货'),
  ('圣诞新年高峰', 12, 15, 1, 15, '海运每年12月15号到1月15号期间，因国外司机放假等原因造成柜子无法正常送货')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 完成提示
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '清关合同模板系统数据库迁移完成！';
  RAISE NOTICE '已创建表: contract_template_config, contract_compensation_rules, contract_insurance_config, contract_peak_seasons, customs_contracts';
  RAISE NOTICE '已初始化默认配置数据';
END $$;
