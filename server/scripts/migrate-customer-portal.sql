-- ============================================================
-- 客户门户系统数据库迁移脚本
-- 创建客户账户表和 API 密钥表
-- ============================================================

-- 1. 创建客户账户表 customer_accounts
-- 用于存储客户门户的登录账户信息
CREATE TABLE IF NOT EXISTS customer_accounts (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(50),
  avatar_url TEXT,
  status VARCHAR(20) DEFAULT 'active',           -- active, inactive, locked
  login_attempts INT DEFAULT 0,                  -- 登录失败次数
  locked_until TIMESTAMP,                        -- 锁定截止时间
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(50),
  password_changed_at TIMESTAMP,
  created_by VARCHAR(50),                        -- 创建人（主系统用户ID）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_customer_accounts_customer ON customer_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_username ON customer_accounts(username);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON customer_accounts(email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_status ON customer_accounts(status);

-- 添加注释
COMMENT ON TABLE customer_accounts IS '客户门户账户表';
COMMENT ON COLUMN customer_accounts.customer_id IS '关联的CRM客户ID';
COMMENT ON COLUMN customer_accounts.username IS '登录用户名（唯一）';
COMMENT ON COLUMN customer_accounts.password_hash IS '密码哈希值（bcrypt）';
COMMENT ON COLUMN customer_accounts.status IS '账户状态：active-正常, inactive-禁用, locked-锁定';
COMMENT ON COLUMN customer_accounts.login_attempts IS '连续登录失败次数，成功后清零';
COMMENT ON COLUMN customer_accounts.locked_until IS '账户锁定截止时间';

-- ============================================================

-- 2. 创建 API 密钥表 customer_api_keys
-- 用于存储客户的开放 API 访问密钥
CREATE TABLE IF NOT EXISTS customer_api_keys (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
  key_name VARCHAR(100) NOT NULL,                -- 密钥名称（如：ERP对接、WMS对接）
  api_key VARCHAR(64) UNIQUE NOT NULL,           -- API Key (公开标识，格式：ak_live_xxx)
  api_secret_hash VARCHAR(255) NOT NULL,         -- API Secret (加密存储)
  permissions JSONB DEFAULT '["order:read"]',    -- 权限范围数组
  ip_whitelist TEXT[],                           -- IP 白名单（可选）
  rate_limit INT DEFAULT 100,                    -- 每分钟请求限制
  is_active BOOLEAN DEFAULT true,                -- 是否启用
  last_used_at TIMESTAMP,                        -- 最后使用时间
  last_used_ip VARCHAR(50),                      -- 最后使用IP
  usage_count BIGINT DEFAULT 0,                  -- 总调用次数
  expires_at TIMESTAMP,                          -- 过期时间（可选，NULL表示永不过期）
  webhook_url TEXT,                              -- Webhook 回调地址
  webhook_secret VARCHAR(64),                    -- Webhook 签名密钥
  created_by VARCHAR(50),                        -- 创建人
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON customer_api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON customer_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON customer_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON customer_api_keys(expires_at);

-- 添加注释
COMMENT ON TABLE customer_api_keys IS '客户API密钥表';
COMMENT ON COLUMN customer_api_keys.key_name IS '密钥名称，用于区分不同用途';
COMMENT ON COLUMN customer_api_keys.api_key IS 'API Key，公开标识，格式：ak_live_xxx 或 ak_test_xxx';
COMMENT ON COLUMN customer_api_keys.api_secret_hash IS 'API Secret 哈希值，只在创建时显示一次';
COMMENT ON COLUMN customer_api_keys.permissions IS '权限范围JSON数组，如["order:create","order:read","invoice:read"]';
COMMENT ON COLUMN customer_api_keys.ip_whitelist IS 'IP白名单数组，为空则不限制';
COMMENT ON COLUMN customer_api_keys.rate_limit IS '每分钟请求限制数';
COMMENT ON COLUMN customer_api_keys.webhook_url IS 'Webhook回调地址，用于订单状态变更通知';
COMMENT ON COLUMN customer_api_keys.webhook_secret IS 'Webhook签名密钥，用于验证回调请求';

-- ============================================================

-- 3. 创建 API 调用日志表 api_call_logs
-- 用于记录 API 调用历史，便于审计和问题排查
CREATE TABLE IF NOT EXISTS api_call_logs (
  id BIGSERIAL PRIMARY KEY,
  api_key_id INT REFERENCES customer_api_keys(id) ON DELETE SET NULL,
  customer_id VARCHAR(50),
  api_key VARCHAR(64),
  endpoint VARCHAR(200) NOT NULL,                -- 请求端点
  method VARCHAR(10) NOT NULL,                   -- HTTP 方法
  request_ip VARCHAR(50),                        -- 请求IP
  request_headers JSONB,                         -- 请求头（脱敏）
  request_body JSONB,                            -- 请求体（脱敏）
  response_status INT,                           -- 响应状态码
  response_body JSONB,                           -- 响应体摘要
  error_message TEXT,                            -- 错误信息
  duration_ms INT,                               -- 请求耗时（毫秒）
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引（针对查询优化）
CREATE INDEX IF NOT EXISTS idx_api_logs_key_id ON api_call_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_customer ON api_call_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_call_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_call_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_call_logs(created_at DESC);

-- 添加注释
COMMENT ON TABLE api_call_logs IS 'API调用日志表';
COMMENT ON COLUMN api_call_logs.duration_ms IS '请求处理耗时（毫秒）';

-- ============================================================

-- 4. 创建 Webhook 发送记录表 webhook_logs
-- 用于记录 Webhook 推送历史
CREATE TABLE IF NOT EXISTS webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  api_key_id INT REFERENCES customer_api_keys(id) ON DELETE SET NULL,
  customer_id VARCHAR(50),
  webhook_url TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,               -- 事件类型：order.created, order.shipped 等
  payload JSONB NOT NULL,                        -- 发送的数据
  response_status INT,                           -- 响应状态码
  response_body TEXT,                            -- 响应内容
  retry_count INT DEFAULT 0,                     -- 重试次数
  status VARCHAR(20) DEFAULT 'pending',          -- pending, success, failed
  error_message TEXT,                            -- 错误信息
  sent_at TIMESTAMP,                             -- 发送时间
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_webhook_logs_key_id ON webhook_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_customer ON webhook_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- 添加注释
COMMENT ON TABLE webhook_logs IS 'Webhook推送日志表';
COMMENT ON COLUMN webhook_logs.event_type IS '事件类型：order.created, order.shipped, order.arrived 等';
COMMENT ON COLUMN webhook_logs.status IS '推送状态：pending-待发送, success-成功, failed-失败';
COMMENT ON COLUMN webhook_logs.retry_count IS '重试次数，最多重试3次';

-- ============================================================

-- 5. 为 bills_of_lading 表添加外部订单号字段（用于关联客户系统订单）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bills_of_lading' AND column_name = 'external_order_no'
  ) THEN
    ALTER TABLE bills_of_lading ADD COLUMN external_order_no VARCHAR(100);
    CREATE INDEX IF NOT EXISTS idx_bills_external_order ON bills_of_lading(external_order_no);
    COMMENT ON COLUMN bills_of_lading.external_order_no IS '客户系统订单号（用于API对接）';
  END IF;
END $$;

-- 6. 为 bills_of_lading 表添加来源渠道字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bills_of_lading' AND column_name = 'source_channel'
  ) THEN
    ALTER TABLE bills_of_lading ADD COLUMN source_channel VARCHAR(50) DEFAULT 'manual';
    COMMENT ON COLUMN bills_of_lading.source_channel IS '订单来源：manual-手动创建, portal-客户门户, api-API导入';
  END IF;
END $$;

-- ============================================================
-- 迁移完成
-- ============================================================

