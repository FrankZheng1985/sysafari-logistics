-- ==================== 数据库结构同步脚本 ====================
-- 日期：2024-12-19
-- 说明：同步开发环境到生产/演示环境的数据库结构变更
-- 注意：此脚本不涉及订单数据（bills_of_lading, packages等）

-- ==================== 1. ports_of_loading 表添加 continent 字段 ====================
ALTER TABLE ports_of_loading ADD COLUMN IF NOT EXISTS continent TEXT;

-- ==================== 2. 修复机场数据的 transport_type ====================
-- 将所有名称包含"机场"或 port_code 以"-A"结尾的数据的 transport_type 改为 'air'
UPDATE ports_of_loading
SET transport_type = 'air',
    updated_at = NOW()
WHERE transport_type != 'air'
  AND (
    port_name_cn LIKE '%机场%' 
    OR port_name_en LIKE '%Airport%'
    OR port_name_en LIKE '%Air%'
    OR port_code LIKE '%-A'
    OR port_code LIKE '%-A-%'
  );

-- ==================== 3. API对接管理表（如果不存在则创建） ====================
CREATE TABLE IF NOT EXISTS api_integrations (
    id SERIAL PRIMARY KEY,
    api_code TEXT UNIQUE NOT NULL,
    api_name TEXT NOT NULL,
    provider TEXT,
    category TEXT DEFAULT 'other',
    api_url TEXT,
    health_check_url TEXT,
    pricing_model TEXT DEFAULT 'free',
    unit_price NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    balance NUMERIC DEFAULT 0,
    total_recharged NUMERIC DEFAULT 0,
    total_consumed NUMERIC DEFAULT 0,
    alert_threshold NUMERIC DEFAULT 100,
    recharge_url TEXT,
    status TEXT DEFAULT 'active',
    health_status TEXT DEFAULT 'unknown',
    last_health_check TIMESTAMP,
    health_check_message TEXT,
    response_time_ms INTEGER,
    last_sync_time TIMESTAMP,
    config_json TEXT,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_integrations_code ON api_integrations(api_code);
CREATE INDEX IF NOT EXISTS idx_api_integrations_category ON api_integrations(category);
CREATE INDEX IF NOT EXISTS idx_api_integrations_status ON api_integrations(status);
CREATE INDEX IF NOT EXISTS idx_api_integrations_health ON api_integrations(health_status);

-- ==================== 4. API用量记录表（如果不存在则创建） ====================
CREATE TABLE IF NOT EXISTS api_usage_records (
    id SERIAL PRIMARY KEY,
    api_id INTEGER REFERENCES api_integrations(id) ON DELETE CASCADE,
    api_code TEXT NOT NULL,
    usage_date DATE NOT NULL,
    call_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    data_volume NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_code, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_code ON api_usage_records(api_code);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_records(usage_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_id ON api_usage_records(api_id);

-- ==================== 5. API充值记录表（如果不存在则创建） ====================
CREATE TABLE IF NOT EXISTS api_recharge_records (
    id SERIAL PRIMARY KEY,
    api_id INTEGER REFERENCES api_integrations(id) ON DELETE CASCADE,
    api_code TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    recharge_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method TEXT,
    reference_no TEXT,
    operator TEXT,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_recharge_code ON api_recharge_records(api_code);
CREATE INDEX IF NOT EXISTS idx_api_recharge_time ON api_recharge_records(recharge_time);
CREATE INDEX IF NOT EXISTS idx_api_recharge_api_id ON api_recharge_records(api_id);

-- ==================== 6. 船公司跟踪API配置表（如果不存在则创建） ====================
CREATE TABLE IF NOT EXISTS tracking_api_configs (
    id SERIAL PRIMARY KEY,
    provider_code VARCHAR(50) NOT NULL UNIQUE,
    provider_name VARCHAR(100) NOT NULL,
    transport_type VARCHAR(20) NOT NULL DEFAULT 'sea',
    api_type VARCHAR(20) DEFAULT 'rest',
    api_url VARCHAR(500),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    client_id VARCHAR(200),
    client_secret VARCHAR(500),
    extra_config JSONB,
    status VARCHAR(20) DEFAULT 'inactive',
    description TEXT,
    priority INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_api_configs_provider ON tracking_api_configs(provider_code);
CREATE INDEX IF NOT EXISTS idx_tracking_api_configs_transport ON tracking_api_configs(transport_type);
CREATE INDEX IF NOT EXISTS idx_tracking_api_configs_status ON tracking_api_configs(status);

-- ==================== 完成 ====================
DO $$
BEGIN
    RAISE NOTICE '✅ 数据库结构同步完成！';
    RAISE NOTICE '📝 变更内容：';
    RAISE NOTICE '   1. ports_of_loading 表添加 continent 字段';
    RAISE NOTICE '   2. 修复机场数据的 transport_type 为 air';
    RAISE NOTICE '   3. 确保 api_integrations 表存在';
    RAISE NOTICE '   4. 确保 api_usage_records 表存在';
    RAISE NOTICE '   5. 确保 api_recharge_records 表存在';
    RAISE NOTICE '   6. 确保 tracking_api_configs 表存在';
END $$;
