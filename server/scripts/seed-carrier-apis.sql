-- =====================================================
-- 船公司 API 配置初始化脚本
-- 用于配置各主流船公司的官方跟踪 API
-- 
-- 使用方法：
-- 1. 获取各船公司的 API Key（参考 docs/CARRIER-API-GUIDE.md）
-- 2. 替换下方的 'YOUR_xxx_API_KEY' 为实际的 API Key
-- 3. 执行此脚本
-- =====================================================

-- 确保 tracking_api_configs 表存在
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tracking_api_configs_provider ON tracking_api_configs(provider_code);
CREATE INDEX IF NOT EXISTS idx_tracking_api_configs_transport ON tracking_api_configs(transport_type);
CREATE INDEX IF NOT EXISTS idx_tracking_api_configs_status ON tracking_api_configs(status);

-- =====================================================
-- 船公司官方 API 配置
-- 优先级越小越优先使用
-- =====================================================

-- 1. COSCO 中远海运（优先级最高）
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'cosco', 'COSCO 中远海运', 'sea',
  'rest', 'https://api.coscoshipping.com', 'YOUR_COSCO_API_KEY',
  'inactive', 'COSCO 官方 Cargo Tracking API。申请地址: https://synconhub.coscoshipping.com/developer',
  1
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 2. Maersk 马士基
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'maersk', 'Maersk 马士基', 'sea',
  'rest', 'https://api.maersk.com', 'YOUR_MAERSK_CONSUMER_KEY',
  'inactive', 'Maersk 官方 Track & Trace API。申请地址: https://developer.maersk.com/',
  2
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 3. MSC 地中海航运
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'msc', 'MSC 地中海航运', 'sea',
  'rest', 'https://api.msc.com', 'YOUR_MSC_API_KEY',
  'inactive', 'MSC 官方 Track & Trace API。申请地址: https://www.msc.com/en/digital-solutions/apis',
  3
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 4. CMA CGM 达飞轮船（使用 OAuth 2.0）
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key,
  client_id, client_secret,
  status, description, priority
) VALUES (
  'cmacgm', 'CMA CGM 达飞轮船', 'sea',
  'oauth2', 'https://api.cma-cgm.com', NULL,
  'YOUR_CMACGM_CLIENT_ID', 'YOUR_CMACGM_CLIENT_SECRET',
  'inactive', 'CMA CGM 官方 Tracking API (OAuth 2.0)。申请地址: https://developer.cma-cgm.com/',
  4
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 5. OOCL 东方海外
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'oocl', 'OOCL 东方海外', 'sea',
  'rest', 'https://api.oocl.com', 'YOUR_OOCL_API_KEY',
  'inactive', 'OOCL 官方 Cargo Tracking API。联系 OOCL 客服申请: ecommerce@oocl.com',
  5
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 6. Hapag-Lloyd 赫伯罗特
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'hapag', 'Hapag-Lloyd 赫伯罗特', 'sea',
  'rest', 'https://api.hlag.com', 'YOUR_HAPAG_API_KEY',
  'inactive', 'Hapag-Lloyd 官方 Tracking API。申请地址: https://developer.hlag.com/',
  6
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 7. Evergreen 长荣海运
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'evergreen', 'Evergreen 长荣海运', 'sea',
  'rest', 'https://api.evergreen-line.com', 'YOUR_EVERGREEN_API_KEY',
  'inactive', 'Evergreen 官方 Cargo Tracking API。联系当地长荣代理申请',
  7
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 第三方聚合 API（备选方案）
-- =====================================================

-- 8. Ship24 聚合跟踪服务（备选）
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'ship24', 'Ship24 聚合跟踪服务', 'sea',
  'rest', 'https://api.ship24.com/public/v1', 'YOUR_SHIP24_API_KEY',
  'inactive', 'Ship24 第三方聚合跟踪服务，支持 1200+ 船公司。申请地址: https://www.ship24.com/',
  100
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 其他船公司（可选）
-- =====================================================

-- Yang Ming 阳明海运
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'yangming', 'Yang Ming 阳明海运', 'sea',
  'rest', 'https://api.yangming.com', 'YOUR_YANGMING_API_KEY',
  'inactive', 'Yang Ming 官方 API。联系客服申请',
  8
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- ZIM 以星航运
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'zim', 'ZIM 以星航运', 'sea',
  'rest', 'https://api.zim.com', 'YOUR_ZIM_API_KEY',
  'inactive', 'ZIM 官方 Tracking API。申请地址: https://developers.zim.com/',
  9
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- ONE (Ocean Network Express)
INSERT INTO tracking_api_configs (
  provider_code, provider_name, transport_type, 
  api_type, api_url, api_key, 
  status, description, priority
) VALUES (
  'one', 'ONE 海洋网络', 'sea',
  'rest', 'https://api.one-line.com', 'YOUR_ONE_API_KEY',
  'inactive', 'ONE 官方 API。联系当地代表申请',
  10
) ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 查看配置结果
-- =====================================================
SELECT 
  provider_code,
  provider_name,
  status,
  priority,
  CASE 
    WHEN api_key IS NOT NULL AND api_key != '' AND api_key NOT LIKE 'YOUR_%' THEN '已配置'
    ELSE '待配置'
  END as api_key_status
FROM tracking_api_configs 
WHERE transport_type = 'sea'
ORDER BY priority;

-- =====================================================
-- 激活 API 配置（配置好 API Key 后执行）
-- =====================================================
-- 示例：激活 COSCO API
-- UPDATE tracking_api_configs SET status = 'active' WHERE provider_code = 'cosco';

-- 示例：一次性激活所有已配置的 API
-- UPDATE tracking_api_configs 
-- SET status = 'active' 
-- WHERE api_key IS NOT NULL 
--   AND api_key != '' 
--   AND api_key NOT LIKE 'YOUR_%';
