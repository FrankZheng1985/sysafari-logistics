-- ==================== API对接管理初始数据 ====================
-- 日期：2024-12-19
-- 说明：初始化9个已对接的API服务配置
-- 注意：使用 ON CONFLICT 确保不会重复插入

-- 1. 腾讯云OCR
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('tencent_ocr', '腾讯云OCR', '腾讯云', 'ocr', 'https://ocr.tencentcloudapi.com', 'per_call', 'https://console.cloud.tencent.com/ocr', '文档识别服务，支持运输单据OCR识别', 'FileText', 2)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    updated_at = CURRENT_TIMESTAMP;

-- 3. 腾讯云COS
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('tencent_cos', '腾讯云COS', '腾讯云', 'storage', 'https://cos.tencentcloudapi.com', 'per_volume', 'https://console.cloud.tencent.com/cos', '云存储服务，用于存储发票和文档文件', 'HardDrive', 3)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    updated_at = CURRENT_TIMESTAMP;

-- 4. Exchange Rate API
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, description, icon, sort_order)
VALUES ('exchange_rate', '汇率API', 'ExchangeRate-API', 'finance', 'https://api.exchangerate-api.com/v4/latest', 'https://api.exchangerate-api.com/v4/latest/EUR', 'free', '免费汇率查询服务，获取实时汇率', 'DollarSign', 4)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 5. Google Translate
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, description, icon, sort_order)
VALUES ('google_translate', 'Google翻译', 'Google', 'translation', 'https://translate.googleapis.com/translate_a/single', 'https://translate.googleapis.com', 'free', '免费翻译服务，用于费用名称翻译', 'Languages', 5)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 6. TARIC 关税查询
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, description, icon, sort_order)
VALUES ('taric', 'TARIC关税查询', 'EU Commission', 'tariff', 'https://ec.europa.eu/taxation_customs/dds2/taric', 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp', 'free', '欧盟TARIC关税税率查询系统', 'Calculator', 6)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 7. EU VIES VAT验证
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, description, icon, sort_order)
VALUES ('eu_vies', 'EU VAT验证', 'EU Commission', 'validation', 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService', 'https://ec.europa.eu/taxation_customs/vies', 'free', '欧盟VIES系统，验证VAT税号有效性', 'BadgeCheck', 7)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 8. EU EORI验证
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, description, icon, sort_order)
VALUES ('eu_eori', 'EU EORI验证', 'EU Commission', 'validation', 'https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation', 'https://ec.europa.eu/taxation_customs/dds2/eos', 'free', '欧盟EORI号码验证服务', 'ShieldCheck', 8)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 9. 阿里云 ECS 后端服务器
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('aliyun_ecs', '阿里云ECS服务器', '阿里云', 'infrastructure', 'https://api.xianfeng-eu.com', 'https://api.xianfeng-eu.com/api/health', 'subscription', 'https://ecs.console.aliyun.com', '后端API服务器，托管于阿里云ECS', 'Server', 9)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 10. 阿里云 OSS 前端静态托管
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('aliyun_oss', '阿里云OSS静态托管', '阿里云', 'infrastructure', 'https://erp.xianfeng-eu.com', 'https://erp.xianfeng-eu.com', 'subscription', 'https://oss.console.aliyun.com', '前端静态资源，托管于阿里云OSS+CDN', 'Globe', 10)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 11. 阿里云 RDS PostgreSQL 数据库
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('aliyun_rds', '阿里云RDS数据库', '阿里云', 'infrastructure', 'https://api.xianfeng-eu.com', 'https://api.xianfeng-eu.com/api/health', 'subscription', 'https://rdsnext.console.aliyun.com', 'PostgreSQL数据库，托管于阿里云RDS', 'Database', 11)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 删除旧的 Render 和 Vercel 配置（如果存在）
DELETE FROM api_integrations WHERE api_code IN ('render_backend', 'vercel_frontend');

-- ==================== 完成 ====================
DO $$
BEGIN
    RAISE NOTICE '✅ API服务初始数据插入完成！';
    RAISE NOTICE '📊 已初始化9个API服务配置';
END $$;
