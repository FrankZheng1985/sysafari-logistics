-- Ship24 跟踪API配置
-- 注意：需要替换 YOUR_SHIP24_API_KEY 为实际的API密钥
-- 获取API Key: https://www.ship24.com/ 注册后获取

-- 删除旧的 Ship24 配置（如果存在）
DELETE FROM tracking_api_configs WHERE provider_code = 'ship24';

-- 插入 Ship24 配置（海运）
INSERT INTO tracking_api_configs (
  provider_code,
  provider_name,
  transport_type,
  api_type,
  api_url,
  api_key,
  api_secret,
  extra_config,
  status,
  description,
  created_at,
  updated_at
) VALUES (
  'ship24',
  'Ship24 聚合跟踪服务',
  'sea',
  'rest',
  'https://api.ship24.com/public/v1',
  'YOUR_SHIP24_API_KEY',  -- 请替换为实际的API Key
  '',
  '{"supportedCarriers": "1200+", "features": ["realtime", "webhook", "bulk"]}',
  'active',
  'Ship24 聚合跟踪服务，支持1200+船公司和快递公司的实时跟踪',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 验证插入
SELECT * FROM tracking_api_configs WHERE provider_code = 'ship24';
