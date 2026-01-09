-- 阿里云AI服务合并脚本
-- 执行时间: 2026-01-09
-- 功能: 将"阿里云图像超分辨率"合并到"阿里通义千问视觉"，统一为"阿里云AI智能"
-- 注意: 执行前请确保已备份数据

-- ==================== 开始事务 ====================
BEGIN;

-- 0. 确保 ai_usage_logs 表存在
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

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_api_code ON ai_usage_logs(api_code);

-- 1. 检查是否存在 aliyun_qwen_vl，如果不存在则创建
INSERT INTO api_integrations (
  api_code, api_name, category, provider, description,
  status, pricing_model, unit_price, currency, balance
) VALUES (
  'aliyun_qwen_vl',
  '阿里云AI智能',
  'ai',
  '阿里云',
  '阿里云DashScope AI服务，包含通义千问视觉(材质分析)和万象图像超分辨率(图片增强)功能',
  'active',
  'per_token',
  0.008,
  'CNY',
  999999
) ON CONFLICT (api_code) DO UPDATE SET
  api_name = '阿里云AI智能',
  description = '阿里云DashScope AI服务，包含通义千问视觉(材质分析)和万象图像超分辨率(图片增强)功能',
  updated_at = NOW();

-- 2. 迁移 aliyun_wanx_sr 的调用日志到 aliyun_qwen_vl（如果有的话）
UPDATE ai_usage_logs 
SET api_code = 'aliyun_qwen_vl'
WHERE api_code = 'aliyun_wanx_sr';

-- 3. 迁移 aliyun_wanx_sr 的使用统计记录（如果有的话）
-- 先尝试更新已存在的日期记录
UPDATE api_usage_records AS r
SET 
  call_count = r.call_count + s.call_count,
  success_count = r.success_count + s.success_count,
  fail_count = r.fail_count + s.fail_count,
  cost = r.cost + s.cost,
  updated_at = NOW()
FROM api_usage_records AS s
WHERE r.api_code = 'aliyun_qwen_vl' 
  AND s.api_code = 'aliyun_wanx_sr'
  AND r.usage_date = s.usage_date;

-- 插入 aliyun_qwen_vl 中不存在的日期记录
INSERT INTO api_usage_records (api_code, api_id, usage_date, call_count, success_count, fail_count, cost)
SELECT 
  'aliyun_qwen_vl',
  (SELECT id FROM api_integrations WHERE api_code = 'aliyun_qwen_vl'),
  s.usage_date,
  s.call_count,
  s.success_count,
  s.fail_count,
  s.cost
FROM api_usage_records s
WHERE s.api_code = 'aliyun_wanx_sr'
  AND NOT EXISTS (
    SELECT 1 FROM api_usage_records r 
    WHERE r.api_code = 'aliyun_qwen_vl' 
    AND r.usage_date = s.usage_date
  );

-- 4. 删除 aliyun_wanx_sr 的使用统计记录（已合并）
DELETE FROM api_usage_records WHERE api_code = 'aliyun_wanx_sr';

-- 5. 删除 aliyun_wanx_sr 的API记录
DELETE FROM api_integrations WHERE api_code = 'aliyun_wanx_sr';

-- 6. 更新 api_usage_records 中的 api_id（确保外键关联正确）
UPDATE api_usage_records 
SET api_id = (SELECT id FROM api_integrations WHERE api_code = 'aliyun_qwen_vl')
WHERE api_code = 'aliyun_qwen_vl';

-- ==================== 提交事务 ====================
COMMIT;

-- 验证合并结果
SELECT 
  api_code, 
  api_name, 
  provider, 
  category,
  description,
  balance,
  status
FROM api_integrations 
WHERE api_code = 'aliyun_qwen_vl';

-- 查看合并后的调用统计
SELECT 
  api_code,
  SUM(call_count) as total_calls,
  SUM(success_count) as total_success,
  SUM(cost) as total_cost
FROM api_usage_records 
WHERE api_code = 'aliyun_qwen_vl'
GROUP BY api_code;

SELECT '阿里云AI服务合并完成' as message;
