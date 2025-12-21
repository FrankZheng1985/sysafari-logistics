-- 物流跟踪模块数据库迁移脚本
-- 创建跟踪记录表和API配置表

-- ==================== 跟踪记录表 ====================
CREATE TABLE IF NOT EXISTS tracking_records (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL,
    transport_type TEXT DEFAULT 'sea',
    tracking_number TEXT,
    node_type TEXT NOT NULL,
    node_name TEXT,
    status TEXT DEFAULT 'in_transit',
    location TEXT,
    event_time TEXT,
    remark TEXT,
    source TEXT DEFAULT 'manual',
    operator TEXT DEFAULT '系统',
    latitude REAL,
    longitude REAL,
    raw_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 跟踪记录索引
CREATE INDEX IF NOT EXISTS idx_tracking_bill_id ON tracking_records(bill_id);
CREATE INDEX IF NOT EXISTS idx_tracking_transport_type ON tracking_records(transport_type);
CREATE INDEX IF NOT EXISTS idx_tracking_status ON tracking_records(status);
CREATE INDEX IF NOT EXISTS idx_tracking_event_time ON tracking_records(event_time);
CREATE INDEX IF NOT EXISTS idx_tracking_source ON tracking_records(source);

-- ==================== 跟踪API配置表 ====================
CREATE TABLE IF NOT EXISTS tracking_api_configs (
    id SERIAL PRIMARY KEY,
    provider_code TEXT NOT NULL UNIQUE,
    provider_name TEXT NOT NULL,
    transport_type TEXT DEFAULT 'sea',
    api_type TEXT DEFAULT 'rest',
    api_url TEXT,
    api_key TEXT,
    api_secret TEXT,
    extra_config TEXT,
    status TEXT DEFAULT 'active',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API配置索引
CREATE INDEX IF NOT EXISTS idx_api_config_provider ON tracking_api_configs(provider_code);
CREATE INDEX IF NOT EXISTS idx_api_config_transport ON tracking_api_configs(transport_type);
CREATE INDEX IF NOT EXISTS idx_api_config_status ON tracking_api_configs(status);

-- ==================== 手动跟踪节点表（卡航专用） ====================
CREATE TABLE IF NOT EXISTS tracking_nodes (
    id SERIAL PRIMARY KEY,
    bill_id TEXT NOT NULL,
    transport_type TEXT DEFAULT 'truck',
    node_order INTEGER DEFAULT 0,
    node_type TEXT NOT NULL,
    node_name TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    completed_time TEXT,
    location TEXT,
    latitude REAL,
    longitude REAL,
    photo_url TEXT,
    remark TEXT,
    operator TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 手动节点索引
CREATE INDEX IF NOT EXISTS idx_nodes_bill_id ON tracking_nodes(bill_id);
CREATE INDEX IF NOT EXISTS idx_nodes_transport ON tracking_nodes(transport_type);
CREATE INDEX IF NOT EXISTS idx_nodes_completed ON tracking_nodes(is_completed);

-- ==================== 插入示例API配置 ====================

-- 船公司API配置示例 (PostgreSQL ON CONFLICT 语法)
INSERT INTO tracking_api_configs (provider_code, provider_name, transport_type, api_type, status, description)
VALUES 
    ('MAERSK', '马士基', 'sea', 'rest', 'inactive', '马士基船公司跟踪API'),
    ('COSCO', '中远海运', 'sea', 'rest', 'inactive', '中远海运跟踪API'),
    ('MSC', '地中海航运', 'sea', 'rest', 'inactive', 'MSC跟踪API')
ON CONFLICT (provider_code) DO NOTHING;

-- 航空货运API配置示例
INSERT INTO tracking_api_configs (provider_code, provider_name, transport_type, api_type, status, description)
VALUES 
    ('CARGOIQ', 'Cargo iQ', 'air', 'rest', 'inactive', 'IATA Cargo iQ 标准跟踪API'),
    ('FLIGHTAWARE', 'FlightAware', 'air', 'rest', 'inactive', 'FlightAware货运跟踪')
ON CONFLICT (provider_code) DO NOTHING;

-- 铁路跟踪API配置示例
INSERT INTO tracking_api_configs (provider_code, provider_name, transport_type, api_type, status, description)
VALUES 
    ('CREXPRESS', '中欧班列', 'rail', 'rest', 'inactive', '中欧班列综合服务平台API')
ON CONFLICT (provider_code) DO NOTHING;

-- 卡航跟踪API配置示例
INSERT INTO tracking_api_configs (provider_code, provider_name, transport_type, api_type, status, description)
VALUES 
    ('HUOCHEBANG', '货车帮', 'truck', 'rest', 'inactive', '货车帮物流跟踪API'),
    ('MANBANG', '满帮', 'truck', 'rest', 'inactive', '满帮物流跟踪API'),
    ('MANUAL', '手动录入', 'truck', 'manual', 'active', '手动节点录入')
ON CONFLICT (provider_code) DO NOTHING;

-- 完成提示
SELECT '✅ 跟踪模块数据库表创建完成' as message;
