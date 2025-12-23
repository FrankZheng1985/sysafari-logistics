-- API对接管理模块数据库迁移脚本
-- 用于管理已对接的第三方API服务和基础设施监控

-- ==================== API服务配置表 ====================
CREATE TABLE IF NOT EXISTS api_integrations (
    id SERIAL PRIMARY KEY,
    api_code TEXT UNIQUE NOT NULL,           -- 唯一标识：tencent_ocr, tencent_cos, exchange_rate 等
    api_name TEXT NOT NULL,                  -- 显示名称
    provider TEXT,                           -- 服务商
    category TEXT DEFAULT 'other',           -- 分类：tracking/ocr/storage/translation/tariff/validation/infrastructure
    api_url TEXT,                            -- API地址
    health_check_url TEXT,                   -- 健康检查端点
    pricing_model TEXT DEFAULT 'free',       -- 计费模式：per_call/per_volume/subscription/free
    unit_price NUMERIC DEFAULT 0,            -- 单价
    currency TEXT DEFAULT 'USD',             -- 计费货币
    balance NUMERIC DEFAULT 0,               -- 当前余额
    total_recharged NUMERIC DEFAULT 0,       -- 累计充值
    total_consumed NUMERIC DEFAULT 0,        -- 累计消费
    alert_threshold NUMERIC DEFAULT 100,     -- 预警阈值
    recharge_url TEXT,                       -- 充值入口链接
    status TEXT DEFAULT 'active',            -- 状态：active/inactive/suspended
    health_status TEXT DEFAULT 'unknown',    -- 健康状态：online/offline/degraded/unknown
    last_health_check TIMESTAMP,             -- 上次健康检查时间
    health_check_message TEXT,               -- 健康检查返回信息
    response_time_ms INTEGER,                -- 响应时间（毫秒）
    last_sync_time TIMESTAMP,                -- 上次同步时间
    config_json TEXT,                        -- 扩展配置JSON
    description TEXT,                        -- 描述说明
    icon TEXT,                               -- 图标名称
    sort_order INTEGER DEFAULT 0,            -- 排序
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_integrations_code ON api_integrations(api_code);
CREATE INDEX IF NOT EXISTS idx_api_integrations_category ON api_integrations(category);
CREATE INDEX IF NOT EXISTS idx_api_integrations_status ON api_integrations(status);
CREATE INDEX IF NOT EXISTS idx_api_integrations_health ON api_integrations(health_status);

-- ==================== API用量记录表 ====================
CREATE TABLE IF NOT EXISTS api_usage_records (
    id SERIAL PRIMARY KEY,
    api_id INTEGER REFERENCES api_integrations(id) ON DELETE CASCADE,
    api_code TEXT NOT NULL,
    usage_date DATE NOT NULL,
    call_count INTEGER DEFAULT 0,            -- 调用次数
    success_count INTEGER DEFAULT 0,         -- 成功次数
    fail_count INTEGER DEFAULT 0,            -- 失败次数
    data_volume NUMERIC DEFAULT 0,           -- 数据量（MB/KB等）
    cost NUMERIC DEFAULT 0,                  -- 费用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_code, usage_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_usage_code ON api_usage_records(api_code);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_records(usage_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_id ON api_usage_records(api_id);

-- ==================== API充值记录表 ====================
CREATE TABLE IF NOT EXISTS api_recharge_records (
    id SERIAL PRIMARY KEY,
    api_id INTEGER REFERENCES api_integrations(id) ON DELETE CASCADE,
    api_code TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    recharge_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method TEXT,                     -- 支付方式
    reference_no TEXT,                       -- 参考号/订单号
    operator TEXT,                           -- 操作人
    remark TEXT,                             -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_recharge_code ON api_recharge_records(api_code);
CREATE INDEX IF NOT EXISTS idx_api_recharge_time ON api_recharge_records(recharge_time);
CREATE INDEX IF NOT EXISTS idx_api_recharge_api_id ON api_recharge_records(api_id);

-- ==================== 初始化数据：9个已对接的API服务 ====================

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

-- 9. Render 后端服务器
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('render_backend', 'Render后端服务器', 'Render', 'infrastructure', 'https://sysafari-logistics-api.onrender.com', 'https://sysafari-logistics-api.onrender.com/api/health', 'subscription', 'https://dashboard.render.com', '后端API服务器，托管于Render平台', 'Server', 9)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 10. Vercel 前端
INSERT INTO api_integrations (api_code, api_name, provider, category, api_url, health_check_url, pricing_model, recharge_url, description, icon, sort_order)
VALUES ('vercel_frontend', 'Vercel前端', 'Vercel', 'infrastructure', 'https://sysafari-logistics.vercel.app', 'https://sysafari-logistics.vercel.app', 'subscription', 'https://vercel.com/dashboard', '前端应用，托管于Vercel平台', 'Globe', 10)
ON CONFLICT (api_code) DO UPDATE SET
    api_name = EXCLUDED.api_name,
    provider = EXCLUDED.provider,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = CURRENT_TIMESTAMP;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ API对接管理模块数据库表创建完成！';
    RAISE NOTICE '📊 已初始化9个API服务配置';
END $$;
