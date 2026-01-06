-- ============================================
-- 服务订阅管理表
-- 用于管理所有有有效期的认证、SSL证书、API服务等
-- ============================================

-- 服务订阅主表
CREATE TABLE IF NOT EXISTS service_subscriptions (
    id SERIAL PRIMARY KEY,
    
    -- 基本信息
    name VARCHAR(100) NOT NULL,                    -- 服务名称
    category VARCHAR(50) NOT NULL,                 -- 分类: ssl, auth, api, cloud, domain
    provider VARCHAR(100),                         -- 提供商
    description TEXT,                              -- 描述
    
    -- 关联信息
    domain VARCHAR(255),                           -- 关联域名（SSL证书用）
    environment VARCHAR(20) DEFAULT 'production',  -- 环境: production, demo, development
    
    -- 有效期信息
    start_date DATE,                               -- 生效日期
    expire_date DATE,                              -- 到期日期
    auto_renew BOOLEAN DEFAULT FALSE,              -- 是否自动续期
    renew_cycle_days INTEGER,                      -- 续期周期（天）
    
    -- 费用信息
    is_paid BOOLEAN DEFAULT FALSE,                 -- 是否付费
    cost_amount DECIMAL(10, 2),                    -- 费用金额
    cost_currency VARCHAR(10) DEFAULT 'CNY',       -- 货币: CNY, USD, EUR
    billing_cycle VARCHAR(20),                     -- 计费周期: monthly, yearly, one-time, usage-based
    
    -- 提醒设置
    remind_days INTEGER DEFAULT 30,                -- 提前多少天提醒
    remind_email VARCHAR(255),                     -- 提醒邮箱
    last_reminded_at TIMESTAMP,                    -- 上次提醒时间
    
    -- 状态信息
    status VARCHAR(20) DEFAULT 'active',           -- 状态: active, expiring, expired, disabled
    last_checked_at TIMESTAMP,                     -- 上次检查时间
    check_result TEXT,                             -- 检查结果
    
    -- 配置信息（JSON格式存储额外配置）
    config JSONB,
    
    -- 备注
    notes TEXT,
    
    -- 审计字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_service_subs_category ON service_subscriptions(category);
CREATE INDEX IF NOT EXISTS idx_service_subs_status ON service_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_service_subs_expire_date ON service_subscriptions(expire_date);
CREATE INDEX IF NOT EXISTS idx_service_subs_environment ON service_subscriptions(environment);

-- 服务订阅操作日志表
CREATE TABLE IF NOT EXISTS service_subscription_logs (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES service_subscriptions(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,                   -- 操作: created, updated, renewed, expired, checked, reminded
    old_value JSONB,                               -- 旧值
    new_value JSONB,                               -- 新值
    message TEXT,                                  -- 日志消息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER
);

CREATE INDEX IF NOT EXISTS idx_service_sub_logs_subscription ON service_subscription_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_service_sub_logs_action ON service_subscription_logs(action);

-- 添加注释
COMMENT ON TABLE service_subscriptions IS '服务订阅管理表 - 管理SSL证书、认证、API服务等';
COMMENT ON COLUMN service_subscriptions.category IS '分类: ssl-SSL证书, auth-认证服务, api-API服务, cloud-云服务, domain-域名';
COMMENT ON COLUMN service_subscriptions.status IS '状态: active-正常, expiring-即将到期, expired-已过期, disabled-已禁用';

-- ============================================
-- 初始化数据 - 根据当前系统配置添加
-- ============================================

-- SSL 证书
INSERT INTO service_subscriptions (name, category, provider, domain, environment, start_date, expire_date, auto_renew, renew_cycle_days, is_paid, cost_amount, cost_currency, billing_cycle, remind_days, status, notes)
VALUES 
-- 生产环境 ERP 前端 SSL
('ERP 前端 SSL 证书', 'ssl', 'DigiCert (RapidSSL)', 'erp.xianfeng-eu.com', 'production', '2025-12-29', '2027-01-27', FALSE, 365, TRUE, 0, 'CNY', 'yearly', 30, 'active', '阿里云购买的付费SSL证书'),

-- 演示环境前端 SSL
('演示环境前端 SSL 证书', 'ssl', 'Let''s Encrypt', 'demo.xianfeng-eu.com', 'demo', '2025-12-31', '2026-03-31', TRUE, 90, FALSE, 0, 'CNY', 'free', 14, 'active', 'Let''s Encrypt 免费证书，certbot 自动续期'),

-- 生产环境 API SSL
('生产 API SSL 证书', 'ssl', 'Let''s Encrypt', 'api.xianfeng-eu.com', 'production', '2025-12-29', '2026-03-29', TRUE, 90, FALSE, 0, 'CNY', 'free', 14, 'active', 'Let''s Encrypt 免费证书，certbot 自动续期'),

-- 演示环境 API SSL
('演示 API SSL 证书', 'ssl', 'Let''s Encrypt', 'demo-api.xianfeng-eu.com', 'demo', '2025-12-31', '2026-03-31', TRUE, 90, FALSE, 0, 'CNY', 'free', 14, 'active', 'Let''s Encrypt 免费证书，certbot 自动续期')

ON CONFLICT DO NOTHING;

-- 认证服务
INSERT INTO service_subscriptions (name, category, provider, environment, auto_renew, is_paid, billing_cycle, remind_days, status, notes, config)
VALUES 
-- Auth0
('Auth0 认证服务', 'auth', 'Auth0', 'all', TRUE, TRUE, 'monthly', 30, 'active', 'ERP 系统主认证服务，有免费配额', '{"domain": "dev-w345wcc1mgybuopm.us.auth0.com", "free_tier": "7000 MAU", "plan": "Free"}'),

-- JWT 客户门户
('JWT 客户门户认证', 'auth', '自建', 'all', TRUE, FALSE, 'free', 0, 'active', '客户门户认证，Token 有效期 24 小时', '{"token_expires": "24h", "algorithm": "HS256"}')

ON CONFLICT DO NOTHING;

-- API 服务
INSERT INTO service_subscriptions (name, category, provider, environment, auto_renew, is_paid, billing_cycle, remind_days, status, notes, config)
VALUES 
-- 腾讯云 OCR
('腾讯云 OCR', 'api', '腾讯云', 'production', TRUE, TRUE, 'usage-based', 30, 'active', '文档识别服务，按调用次数计费', '{"service": "OCR", "pricing": "约0.001元/次", "free_tier": "1000次/月"}'),

-- HERE Maps API
('HERE Maps API', 'api', 'HERE Technologies', 'production', TRUE, TRUE, 'usage-based', 30, 'active', '地图路线计算、地址补全服务', '{"free_tier": "250,000次/月", "services": ["Geocoding", "Routing", "Autosuggest"]}'),

-- 企查查 API
('企查查 API', 'api', '企查查', 'production', TRUE, TRUE, 'usage-based', 30, 'active', '企业工商信息查询', '{"pricing": "按调用次数计费"}'),

-- EU VAT 验证
('EU VAT 验证', 'api', 'EU VIES', 'production', TRUE, FALSE, 'free', 0, 'active', '欧盟增值税号验证，免费服务', '{"endpoint": "https://ec.europa.eu/taxation_customs/vies/"}'),

-- 汇率 API
('汇率查询 API', 'api', 'Exchange Rate API', 'production', TRUE, FALSE, 'free', 0, 'active', '汇率查询服务', '{"free_tier": true}')

ON CONFLICT DO NOTHING;

-- 云服务
INSERT INTO service_subscriptions (name, category, provider, environment, auto_renew, is_paid, cost_currency, billing_cycle, remind_days, status, notes, config)
VALUES 
-- 阿里云 ECS
('阿里云 ECS 服务器', 'cloud', '阿里云', 'production', TRUE, TRUE, 'CNY', 'monthly', 30, 'active', '香港区域 ECS 服务器，运行后端 API', '{"region": "cn-hongkong", "ip": "47.242.24.255", "instance_type": "待确认"}'),

-- 阿里云 RDS
('阿里云 RDS PostgreSQL', 'cloud', '阿里云', 'production', TRUE, TRUE, 'CNY', 'monthly', 30, 'active', 'PostgreSQL 数据库服务', '{"region": "cn-hongkong", "version": "PostgreSQL"}'),

-- 阿里云 OSS
('阿里云 OSS 存储', 'cloud', '阿里云', 'production', TRUE, TRUE, 'CNY', 'usage-based', 30, 'active', '对象存储服务，存储报价单、发票等', '{"region": "oss-cn-shenzhen", "bucket": "sysafari-logistics"}'),

-- 阿里云 CDN
('阿里云 CDN', 'cloud', '阿里云', 'production', TRUE, TRUE, 'CNY', 'usage-based', 30, 'active', '前端静态资源加速', '{"domains": ["erp.xianfeng-eu.com", "demo.xianfeng-eu.com"]}')

ON CONFLICT DO NOTHING;

-- 域名
INSERT INTO service_subscriptions (name, category, provider, domain, environment, auto_renew, is_paid, cost_currency, billing_cycle, remind_days, status, notes)
VALUES 
('xianfeng-eu.com 域名', 'domain', '域名注册商', 'xianfeng-eu.com', 'all', TRUE, TRUE, 'CNY', 'yearly', 60, 'active', '主域名，需要确认具体到期日期')

ON CONFLICT DO NOTHING;

-- 更新状态函数（根据到期日期自动更新状态）
CREATE OR REPLACE FUNCTION update_subscription_status()
RETURNS void AS $$
BEGIN
    -- 更新已过期的服务
    UPDATE service_subscriptions 
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE expire_date IS NOT NULL 
      AND expire_date < CURRENT_DATE 
      AND status != 'expired'
      AND status != 'disabled';
    
    -- 更新即将到期的服务（在提醒天数内）
    UPDATE service_subscriptions 
    SET status = 'expiring', updated_at = CURRENT_TIMESTAMP
    WHERE expire_date IS NOT NULL 
      AND expire_date >= CURRENT_DATE 
      AND expire_date <= CURRENT_DATE + remind_days
      AND status = 'active';
    
    -- 更新恢复正常的服务（续期后）
    UPDATE service_subscriptions 
    SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE expire_date IS NOT NULL 
      AND expire_date > CURRENT_DATE + remind_days
      AND status = 'expiring';
END;
$$ LANGUAGE plpgsql;

-- 创建定时更新状态的触发器（可选，也可以通过后端定时任务实现）
-- SELECT update_subscription_status();

COMMIT;

