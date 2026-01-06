-- ============================================
-- 初始化服务订阅数据
-- 包含系统当前使用的所有服务、SSL证书、认证等
-- ============================================

-- 先清理已有数据（如果需要重新初始化）
-- TRUNCATE TABLE service_subscriptions RESTART IDENTITY CASCADE;

-- ==================== SSL 证书 ====================

-- 生产环境前端 SSL
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '生产前端SSL证书', 'ssl', 'DigiCert (RapidSSL)', '生产环境前端网站SSL证书',
    'erp.xianfeng-eu.com', 'production',
    '2025-12-29', '2027-01-27', false, 'https://www.digicert.com/',
    'active', 1500, 'CNY', 'yearly', 60,
    '付费证书，需要手动续期。证书有效期约1年。'
) ON CONFLICT DO NOTHING;

-- 演示环境前端 SSL
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '演示前端SSL证书', 'ssl', 'Let''s Encrypt', '演示环境前端网站SSL证书',
    'demo.xianfeng-eu.com', 'demo',
    '2025-12-31', '2026-03-31', true, NULL,
    'active', 0, 'CNY', 'quarterly', 30,
    '免费证书，由certbot自动续期，90天有效期。'
) ON CONFLICT DO NOTHING;

-- 生产API SSL
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '生产API SSL证书', 'ssl', 'Let''s Encrypt', '生产环境API服务器SSL证书',
    'api.xianfeng-eu.com', 'production',
    '2025-12-29', '2026-03-29', true, NULL,
    'active', 0, 'CNY', 'quarterly', 30,
    '免费证书，由certbot自动续期，90天有效期。'
) ON CONFLICT DO NOTHING;

-- 演示API SSL
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '演示API SSL证书', 'ssl', 'Let''s Encrypt', '演示环境API服务器SSL证书',
    'demo-api.xianfeng-eu.com', 'demo',
    '2025-12-31', '2026-03-31', true, NULL,
    'active', 0, 'CNY', 'quarterly', 30,
    '免费证书，由certbot自动续期，90天有效期。'
) ON CONFLICT DO NOTHING;

-- ==================== 认证服务 ====================

-- Auth0 认证
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'Auth0 用户认证', 'auth', 'Auth0 (Okta)', 'ERP系统主要用户认证服务',
    'dev-w345wcc1mgybuopm.us.auth0.com', 'all',
    '2024-01-01', NULL, true, 'https://manage.auth0.com/',
    'active', 0, 'USD', 'usage', 30,
    '免费配额：7500活跃用户/月。生产和演示环境共用同一租户。密钥由Auth0自动管理轮换。'
) ON CONFLICT DO NOTHING;

-- 客户门户JWT
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '客户门户JWT认证', 'auth', '自建', '客户门户登录认证Token',
    NULL, 'all',
    NULL, NULL, true, NULL,
    'active', 0, 'CNY', 'usage', 0,
    'JWT密钥无有效期，Token有效期24小时。密钥存储在环境变量JWT_SECRET中。'
) ON CONFLICT DO NOTHING;

-- ==================== API 服务 ====================

-- 腾讯云OCR
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '腾讯云OCR服务', 'api', '腾讯云', '文档识别（运输单据识别）',
    NULL, 'all',
    NULL, NULL, true, 'https://console.cloud.tencent.com/ocr',
    'active', 100, 'CNY', 'monthly', 30,
    '按调用次数计费，约0.001元/次。环境变量：TENCENT_SECRET_ID, TENCENT_SECRET_KEY'
) ON CONFLICT DO NOTHING;

-- 企查查
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '企查查API', 'api', '企查查', '企业工商信息查询',
    NULL, 'all',
    NULL, NULL, false, 'https://www.qcc.com/',
    'active', 200, 'CNY', 'monthly', 30,
    '按调用次数计费。环境变量：QICHACHA_KEY, QICHACHA_SECRET'
) ON CONFLICT DO NOTHING;

-- HERE Maps
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'HERE Maps API', 'api', 'HERE Technologies', '路线计算、地址补全、地理编码',
    NULL, 'all',
    NULL, NULL, true, 'https://developer.here.com/',
    'active', 0, 'USD', 'usage', 30,
    '免费配额：约25万次/月。超量后按调用计费。环境变量：HERE_API_KEY'
) ON CONFLICT DO NOTHING;

-- VIES VAT验证
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'VIES VAT验证', 'api', '欧盟委员会', '欧盟VAT税号验证',
    'ec.europa.eu', 'all',
    NULL, NULL, true, 'https://ec.europa.eu/taxation_customs/vies/',
    'active', 0, 'EUR', 'usage', 0,
    '欧盟免费公共服务，无需API密钥，偶有不稳定情况。'
) ON CONFLICT DO NOTHING;

-- 汇率API
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'Open Exchange Rates', 'api', 'Open Exchange Rates', '实时汇率查询',
    'openexchangerates.org', 'all',
    NULL, NULL, true, 'https://openexchangerates.org/account',
    'active', 0, 'USD', 'monthly', 30,
    '免费计划：每月1000次请求。已实现缓存机制减少调用。'
) ON CONFLICT DO NOTHING;

-- 17Track追踪
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '17Track物流追踪', 'api', '17Track', '国际物流追踪查询',
    NULL, 'all',
    NULL, NULL, false, 'https://www.17track.net/',
    'inactive', 0, 'CNY', 'usage', 30,
    '已集成但未启用，需要API密钥。'
) ON CONFLICT DO NOTHING;

-- Ship24追踪
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'Ship24物流追踪', 'api', 'Ship24', '国际物流追踪查询',
    NULL, 'all',
    NULL, NULL, false, 'https://www.ship24.com/',
    'inactive', 0, 'USD', 'usage', 30,
    '已集成但未启用，需要API密钥。'
) ON CONFLICT DO NOTHING;

-- ==================== 云服务 ====================

-- 阿里云ECS
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '阿里云ECS服务器', 'cloud', '阿里云', '后端API服务器（香港区域）',
    'api.xianfeng-eu.com', 'all',
    '2024-01-01', '2025-12-31', false, 'https://ecs.console.aliyun.com/',
    'active', 500, 'CNY', 'monthly', 60,
    'IP: 47.242.24.255，香港区域。运行PM2进程：sysafari-api(生产)、sysafari-demo(演示)、portal-api'
) ON CONFLICT DO NOTHING;

-- 阿里云RDS
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '阿里云RDS PostgreSQL', 'cloud', '阿里云', 'PostgreSQL数据库服务',
    NULL, 'all',
    '2024-01-01', NULL, true, 'https://rdsnext.console.aliyun.com/',
    'active', 300, 'CNY', 'monthly', 30,
    '按量付费，自动续费。包含生产和演示两个数据库实例。'
) ON CONFLICT DO NOTHING;

-- 阿里云OSS
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '阿里云OSS存储', 'cloud', '阿里云', '前端静态资源存储+CDN',
    'oss-cn-shenzhen', 'all',
    '2024-01-01', NULL, true, 'https://oss.console.aliyun.com/',
    'active', 50, 'CNY', 'monthly', 30,
    '深圳区域，按存储量+流量计费。托管erp.xianfeng-eu.com和demo.xianfeng-eu.com前端。'
) ON CONFLICT DO NOTHING;

-- 腾讯云COS
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    '腾讯云COS存储', 'cloud', '腾讯云', '云存储（备份、发票存储）',
    NULL, 'all',
    NULL, NULL, true, 'https://console.cloud.tencent.com/cos',
    'active', 30, 'CNY', 'monthly', 30,
    '按存储量+请求次数计费。环境变量：TENCENT_COS_BUCKET, TENCENT_COS_REGION'
) ON CONFLICT DO NOTHING;

-- SMTP邮件服务
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'SMTP邮件服务', 'cloud', '自定义', '发送报价单、通知邮件',
    NULL, 'all',
    NULL, NULL, true, NULL,
    'active', 0, 'CNY', 'usage', 30,
    '使用企业邮箱SMTP，按服务商收费。环境变量：SMTP_HOST, SMTP_USER, SMTP_PASS'
) ON CONFLICT DO NOTHING;

-- ==================== 域名 ====================

-- 主域名
INSERT INTO service_subscriptions (
    name, category, provider, description, domain, environment,
    start_date, expire_date, auto_renew, renew_url,
    status, cost_amount, cost_currency, cost_cycle, alert_days, notes
) VALUES (
    'xianfeng-eu.com 域名', 'domain', '域名注册商', '主域名',
    'xianfeng-eu.com', 'all',
    '2024-01-01', '2026-01-01', false, NULL,
    'active', 100, 'CNY', 'yearly', 60,
    '所有子域名的根域名，需要手动续期。'
) ON CONFLICT DO NOTHING;

-- 更新所有状态
-- 根据 expire_date 自动计算状态
UPDATE service_subscriptions 
SET status = 
    CASE 
        WHEN expire_date IS NULL THEN 'active'
        WHEN expire_date < CURRENT_DATE THEN 'expired'
        WHEN expire_date <= CURRENT_DATE + alert_days THEN 'expiring'
        ELSE 'active'
    END,
    updated_at = NOW();

-- 显示初始化结果
SELECT category, COUNT(*) as count, 
       SUM(CASE WHEN cost_currency = 'CNY' THEN cost_amount ELSE 0 END) as monthly_cost_cny
FROM service_subscriptions 
GROUP BY category
ORDER BY category;

