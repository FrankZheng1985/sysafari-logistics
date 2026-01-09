-- 添加阿里通义千问AI服务到API对接管理
-- 执行时间: 2026-01-09

-- 1. 添加通义千问到 api_integrations 表
INSERT INTO api_integrations (
  api_code, api_name, provider, category, 
  api_url, health_check_url,
  pricing_model, unit_price, currency,
  balance, alert_threshold,
  recharge_url, status, health_status,
  description, icon, sort_order
) VALUES (
  'aliyun_qwen_vl',
  '阿里通义千问视觉',
  '阿里云',
  'ai',
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
  'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
  'per_token',
  0.0001,  -- 约每1000 token 0.1元
  'CNY',
  1000000, -- 初始赠送100万token
  100000,  -- 10万token预警
  'https://bailian.console.aliyun.com/',
  'active',
  'unknown',
  '阿里通义千问视觉模型(Qwen-VL)，用于产品图片材质分析，辅助海关HS编码归类',
  'Brain',
  10
) ON CONFLICT (api_code) DO UPDATE SET
  api_name = EXCLUDED.api_name,
  provider = EXCLUDED.provider,
  category = EXCLUDED.category,
  api_url = EXCLUDED.api_url,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 2. 创建AI调用详细日志表
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  api_code TEXT NOT NULL DEFAULT 'aliyun_qwen_vl',
  user_id INTEGER,
  user_name TEXT,
  request_type TEXT NOT NULL,  -- 'image_analysis', 'text_completion' 等
  request_params TEXT,         -- JSON格式的请求参数
  image_path TEXT,             -- 分析的图片路径
  product_name TEXT,           -- 产品名称
  
  -- 响应信息
  success BOOLEAN DEFAULT false,
  response_summary TEXT,       -- 响应摘要
  error_message TEXT,          -- 错误信息
  
  -- Token使用统计
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- 成本计算
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  currency TEXT DEFAULT 'CNY',
  
  -- 性能指标
  response_time_ms INTEGER,    -- 响应时间(毫秒)
  
  -- 关联信息
  import_id INTEGER,           -- 关联的导入批次ID
  cargo_item_id INTEGER,       -- 关联的货物明细ID
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_api_code ON ai_usage_logs(api_code);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_request_type ON ai_usage_logs(request_type);

-- 3. 添加到服务订阅管理
INSERT INTO service_subscriptions (
  name, category, provider, description,
  environment, start_date, expire_date,
  auto_renew, is_paid, cost_amount, cost_currency, billing_cycle,
  remind_days, status, config
) VALUES (
  '阿里通义千问视觉AI',
  'api',
  '阿里云',
  '产品图片材质分析服务，用于识别产品材质辅助海关归类',
  'all',
  '2026-01-09',
  '2027-01-09',
  true,
  true,
  0,
  'CNY',
  'yearly',
  30,
  'active',
  '{"api_code": "aliyun_qwen_vl", "model": "qwen-vl-plus", "free_quota": 1000000}'
) ON CONFLICT DO NOTHING;

-- 4. 确认插入成功
SELECT api_code, api_name, provider, category, status, balance 
FROM api_integrations 
WHERE api_code = 'aliyun_qwen_vl';
