-- ==================== 工商信息表 ====================
-- 存储从企查查等API查询的中国企业工商信息，支持缓存复用

CREATE TABLE IF NOT EXISTS business_info (
    id VARCHAR(32) PRIMARY KEY,
    credit_code VARCHAR(50) UNIQUE,           -- 统一社会信用代码
    company_name TEXT NOT NULL,               -- 公司名称
    company_name_en TEXT,                     -- 公司英文名称
    legal_person TEXT,                        -- 法定代表人
    registered_capital TEXT,                  -- 注册资本
    paid_capital TEXT,                        -- 实缴资本
    establishment_date DATE,                  -- 成立日期
    business_scope TEXT,                      -- 经营范围
    address TEXT,                             -- 注册地址
    province VARCHAR(50),                     -- 省份
    city VARCHAR(50),                         -- 城市
    district VARCHAR(50),                     -- 区县
    company_type TEXT,                        -- 公司类型（有限责任公司等）
    operating_status TEXT,                    -- 经营状态（存续、注销等）
    industry TEXT,                            -- 所属行业
    registration_authority TEXT,              -- 登记机关
    approval_date DATE,                       -- 核准日期
    business_term_start DATE,                 -- 营业期限起始
    business_term_end DATE,                   -- 营业期限终止
    former_names TEXT,                        -- 曾用名（JSON数组）
    phone TEXT,                               -- 联系电话
    email TEXT,                               -- 企业邮箱
    website TEXT,                             -- 企业网址
    source VARCHAR(20) DEFAULT 'qichacha',    -- 数据来源：qichacha/manual/ocr
    source_id VARCHAR(100),                   -- 外部API返回的企业ID
    raw_data JSONB,                           -- 原始API返回数据（完整保存）
    usage_count INTEGER DEFAULT 0,            -- 使用次数（用于统计）
    last_used_at TIMESTAMP,                   -- 最后使用时间
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_business_info_credit_code ON business_info(credit_code);
CREATE INDEX IF NOT EXISTS idx_business_info_company_name ON business_info(company_name);
CREATE INDEX IF NOT EXISTS idx_business_info_source ON business_info(source);
CREATE INDEX IF NOT EXISTS idx_business_info_operating_status ON business_info(operating_status);

-- 为 customers 表添加关联字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_info_id VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_customers_business_info ON customers(business_info_id);

-- 添加注释
COMMENT ON TABLE business_info IS '工商信息表 - 存储中国企业工商登记信息';
COMMENT ON COLUMN business_info.credit_code IS '统一社会信用代码（18位）';
COMMENT ON COLUMN business_info.source IS '数据来源：qichacha-企查查API, manual-手动录入, ocr-OCR识别';
COMMENT ON COLUMN business_info.usage_count IS '被引用次数，用于分析常用企业';
COMMENT ON COLUMN customers.business_info_id IS '关联的工商信息ID';

