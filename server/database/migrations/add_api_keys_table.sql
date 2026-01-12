-- ============================================
-- 迁移: 添加API Keys管理表
-- 描述: 用于外部系统（如集团ERP）调用先锋物流API
-- 日期: 2026-01-11
-- ============================================

-- API Keys 表
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                 -- API Key 名称（如：集团ERP同步）
    key_value VARCHAR(200),                     -- API Key 原始值（首次创建时显示）
    key_hash VARCHAR(64) NOT NULL UNIQUE,       -- API Key 哈希值（用于验证）
    client_id VARCHAR(100),                     -- 客户端标识（如：group_erp）
    user_id INTEGER,                            -- 关联的用户ID
    permissions JSONB DEFAULT '["read"]',       -- 权限列表: read, write, sync, admin
    rate_limit INTEGER DEFAULT 1000,            -- 速率限制（每分钟请求数）
    expires_at TIMESTAMP,                       -- 过期时间（NULL表示永不过期）
    is_active BOOLEAN DEFAULT TRUE,             -- 是否启用
    revoked_at TIMESTAMP,                       -- 撤销时间
    last_used_at TIMESTAMP,                     -- 最后使用时间
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- API 调用日志表
CREATE TABLE IF NOT EXISTS api_call_logs (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id),
    endpoint VARCHAR(200),                      -- 调用的接口
    method VARCHAR(10),                         -- HTTP 方法
    ip_address VARCHAR(50),                     -- 调用IP
    user_agent TEXT,                            -- User-Agent
    request_body JSONB,                         -- 请求体（可选，敏感数据不记录）
    response_code INTEGER,                      -- 响应码
    response_time_ms INTEGER,                   -- 响应时间（毫秒）
    called_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_key_id ON api_call_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_called_at ON api_call_logs(called_at);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_endpoint ON api_call_logs(endpoint);

-- 添加注释
COMMENT ON TABLE api_keys IS '外部系统API密钥管理表';
COMMENT ON COLUMN api_keys.key_value IS 'API Key原始值，仅在创建时显示一次';
COMMENT ON COLUMN api_keys.key_hash IS 'API Key SHA256哈希值，用于安全验证';
COMMENT ON COLUMN api_keys.permissions IS '权限列表: read(读取), write(写入), sync(同步), admin(管理)';
COMMENT ON COLUMN api_keys.rate_limit IS '每分钟允许的最大请求数';

COMMENT ON TABLE api_call_logs IS 'API调用日志表，用于审计和速率限制';

-- 插入默认的集团ERP API Key
INSERT INTO api_keys (name, key_value, key_hash, client_id, permissions, rate_limit)
VALUES (
    '集团ERP系统',
    'sk_group_erp_' || encode(gen_random_bytes(16), 'hex'),
    encode(sha256(('sk_group_erp_' || encode(gen_random_bytes(16), 'hex'))::bytea), 'hex'),
    'group_erp',
    '["read", "sync"]',
    2000
) ON CONFLICT DO NOTHING;
