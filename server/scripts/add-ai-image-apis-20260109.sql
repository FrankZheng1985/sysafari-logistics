-- AI图片处理相关API和表结构更新
-- 执行时间: 2026-01-09
-- 功能: 添加AI图片增强和材质分析功能支持

-- 1. 添加阿里通义千问视觉API（如果不存在）
INSERT INTO api_integrations (
  api_code, api_name, category, provider, description,
  status, pricing_model, unit_price, currency, balance
) VALUES (
  'aliyun_qwen_vl',
  '阿里通义千问视觉',
  'ai',
  '阿里云',
  '阿里通义千问视觉模型(Qwen-VL)，用于产品图片材质分析，辅助海关HS编码归类',
  'active',
  'per_token',
  0.008,
  'CNY',
  999999
) ON CONFLICT (api_code) DO NOTHING;

-- 2. 添加阿里云图像超分辨率API（如果不存在）
INSERT INTO api_integrations (
  api_code, api_name, category, provider, description,
  status, pricing_model, unit_price, currency, balance
) VALUES (
  'aliyun_wanx_sr',
  '阿里云图像超分辨率',
  'ai',
  '阿里云',
  '阿里云万象图像超分辨率服务，用于提升模糊图片清晰度',
  'active',
  'per_call',
  0.04,
  'CNY',
  999999
) ON CONFLICT (api_code) DO NOTHING;

-- 3. 创建AI调用日志表（如果不存在）
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id SERIAL PRIMARY KEY,
  api_code TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  request_type TEXT DEFAULT 'image_analysis',
  request_params TEXT,
  image_path TEXT,
  product_name TEXT,
  success BOOLEAN DEFAULT false,
  response_summary TEXT,
  error_message TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  currency TEXT DEFAULT 'CNY',
  response_time_ms INTEGER DEFAULT 0,
  import_id TEXT,
  cargo_item_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_api_code ON ai_usage_logs(api_code);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_success ON ai_usage_logs(success);

-- 完成
SELECT 'AI图片处理API配置完成' as message;
