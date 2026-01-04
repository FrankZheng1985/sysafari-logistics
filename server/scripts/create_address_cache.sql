-- ============================================
-- 地址缓存表 - 存储 HERE API 返回的地址数据
-- 用于减少 API 调用，加速地址匹配
-- 创建时间: 2026-01-04
-- ============================================

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS address_cache;

-- 创建地址缓存表
CREATE TABLE address_cache (
  id SERIAL PRIMARY KEY,
  
  -- 搜索关键词（用于匹配）
  query_text VARCHAR(500) NOT NULL,
  -- 标准化的查询关键词（小写、去空格，用于精确匹配）
  query_normalized VARCHAR(500) NOT NULL,
  
  -- 地址信息
  title VARCHAR(500),           -- HERE 返回的标题（如 "41751, Viersen, Nordrhein-Westfalen, Deutschland"）
  address VARCHAR(1000),        -- 完整地址
  city VARCHAR(200),            -- 城市
  country VARCHAR(200),         -- 国家名称
  country_code VARCHAR(10),     -- 国家代码（如 DE, FR）
  postal_code VARCHAR(50),      -- 邮编
  
  -- 坐标
  lat DECIMAL(10, 7),           -- 纬度
  lng DECIMAL(10, 7),           -- 经度
  
  -- 缓存类型
  cache_type VARCHAR(20) NOT NULL DEFAULT 'autosuggest', -- autosuggest / geocode
  
  -- 数据来源
  source VARCHAR(20) NOT NULL DEFAULT 'here',  -- here / manual
  
  -- 使用统计
  hit_count INTEGER DEFAULT 0,          -- 命中次数
  last_hit_at TIMESTAMP,                -- 最后命中时间
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 是否有效
  is_active BOOLEAN DEFAULT true
);

-- 创建索引
CREATE INDEX idx_address_cache_query_normalized ON address_cache(query_normalized);
CREATE INDEX idx_address_cache_postal_code ON address_cache(postal_code);
CREATE INDEX idx_address_cache_country_code ON address_cache(country_code);
CREATE INDEX idx_address_cache_city ON address_cache(city);
CREATE INDEX idx_address_cache_type ON address_cache(cache_type);
CREATE INDEX idx_address_cache_query_type ON address_cache(query_normalized, cache_type);

-- 创建唯一约束（同一查询词+缓存类型+地址不重复）
CREATE UNIQUE INDEX idx_address_cache_unique ON address_cache(query_normalized, cache_type, COALESCE(address, ''));

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_address_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_address_cache_updated
  BEFORE UPDATE ON address_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_address_cache_timestamp();

-- 添加注释
COMMENT ON TABLE address_cache IS '地址缓存表 - 存储 HERE API 返回的地址数据，减少重复 API 调用';
COMMENT ON COLUMN address_cache.query_text IS '原始搜索关键词';
COMMENT ON COLUMN address_cache.query_normalized IS '标准化的查询关键词（小写、去多余空格）';
COMMENT ON COLUMN address_cache.cache_type IS '缓存类型：autosuggest-自动补全，geocode-地理编码';
COMMENT ON COLUMN address_cache.source IS '数据来源：here-HERE API，manual-手动添加';
COMMENT ON COLUMN address_cache.hit_count IS '命中次数，用于统计热门地址';

-- 插入一些常用的欧洲城市作为初始数据（可选）
-- INSERT INTO address_cache (query_text, query_normalized, title, address, city, country, country_code, postal_code, lat, lng, cache_type, source)
-- VALUES 
-- ('Frankfurt', 'frankfurt', 'Frankfurt am Main, Hessen, Deutschland', 'Frankfurt am Main, Hessen, Deutschland', 'Frankfurt am Main', 'Germany', 'DEU', '60311', 50.1109, 8.6821, 'geocode', 'manual');

SELECT 'Address cache table created successfully!' AS result;

