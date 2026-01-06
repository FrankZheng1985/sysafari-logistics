-- HERE API 调用统计表
-- 用于记录和监控 HERE Maps API 的使用量，避免超出免费配额产生费用

-- 创建 API 使用量统计表
CREATE TABLE IF NOT EXISTS here_api_usage (
  id SERIAL PRIMARY KEY,
  
  -- 统计维度
  api_type VARCHAR(50) NOT NULL,         -- API 类型: autosuggest, geocoding, routing, matrix_routing
  year_month VARCHAR(7) NOT NULL,        -- 年月: 2026-01 格式
  
  -- 调用统计
  call_count INTEGER NOT NULL DEFAULT 0, -- 调用次数
  cache_hit_count INTEGER DEFAULT 0,     -- 缓存命中次数（未消耗配额）
  error_count INTEGER DEFAULT 0,         -- 错误次数
  
  -- 配额信息
  monthly_limit INTEGER NOT NULL,        -- 每月免费配额
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_call_at TIMESTAMP,                -- 最后调用时间
  
  -- 唯一约束：每个 API 类型每月只有一条记录
  UNIQUE(api_type, year_month)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_here_api_usage_year_month ON here_api_usage(year_month);
CREATE INDEX IF NOT EXISTS idx_here_api_usage_api_type ON here_api_usage(api_type);

-- 创建 API 调用明细日志表（可选，用于详细分析）
CREATE TABLE IF NOT EXISTS here_api_call_log (
  id SERIAL PRIMARY KEY,
  
  -- 调用信息
  api_type VARCHAR(50) NOT NULL,         -- API 类型
  endpoint VARCHAR(255),                 -- 具体端点
  request_params TEXT,                   -- 请求参数（脱敏后）
  
  -- 结果信息
  success BOOLEAN DEFAULT true,          -- 是否成功
  from_cache BOOLEAN DEFAULT false,      -- 是否来自缓存
  response_time_ms INTEGER,              -- 响应时间（毫秒）
  error_message TEXT,                    -- 错误信息
  
  -- 来源追踪
  user_id INTEGER,                       -- 操作用户
  ip_address VARCHAR(50),                -- 请求 IP
  request_source VARCHAR(100),           -- 请求来源（功能模块）
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 为日志表创建索引（基于时间查询）
CREATE INDEX IF NOT EXISTS idx_here_api_call_log_created_at ON here_api_call_log(created_at);
CREATE INDEX IF NOT EXISTS idx_here_api_call_log_api_type ON here_api_call_log(api_type);

-- 创建视图：当前月度使用情况
CREATE OR REPLACE VIEW here_api_usage_current AS
SELECT 
  api_type,
  call_count,
  monthly_limit,
  cache_hit_count,
  error_count,
  ROUND((call_count::numeric / monthly_limit::numeric) * 100, 2) as usage_percentage,
  monthly_limit - call_count as remaining,
  last_call_at,
  updated_at
FROM here_api_usage
WHERE year_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- 插入初始配额数据（当前月）
INSERT INTO here_api_usage (api_type, year_month, monthly_limit, call_count)
VALUES 
  ('autosuggest', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 250000, 0),
  ('geocoding', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 250000, 0),
  ('routing', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 250000, 0),
  ('matrix_routing', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 5000, 0)
ON CONFLICT (api_type, year_month) DO NOTHING;

-- 添加注释
COMMENT ON TABLE here_api_usage IS 'HERE Maps API 月度调用统计表';
COMMENT ON COLUMN here_api_usage.api_type IS 'API类型: autosuggest-地址补全, geocoding-地理编码, routing-路线计算, matrix_routing-批量距离矩阵';
COMMENT ON COLUMN here_api_usage.monthly_limit IS '每月免费配额限制';
COMMENT ON COLUMN here_api_usage.call_count IS '实际 API 调用次数（消耗配额）';
COMMENT ON COLUMN here_api_usage.cache_hit_count IS '缓存命中次数（未消耗配额）';

COMMENT ON TABLE here_api_call_log IS 'HERE Maps API 调用明细日志';

