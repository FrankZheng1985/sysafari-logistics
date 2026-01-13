-- HS编码层级缓存表
-- 用于缓存从 XI API 查询的编码层级信息，提高查询速度

-- HS 编码层级缓存表
CREATE TABLE IF NOT EXISTS hs_code_hierarchy (
  id SERIAL PRIMARY KEY,
  hs_code VARCHAR(10) NOT NULL,
  parent_code VARCHAR(10),
  level VARCHAR(20),           -- chapter/heading/subheading/cn/taric
  description TEXT,
  description_cn TEXT,
  declarable BOOLEAN DEFAULT false,
  has_children BOOLEAN DEFAULT false,
  child_count INTEGER DEFAULT 0,
  group_title TEXT,            -- 分组标题（如"身高不超过80厘米"）
  group_title_cn TEXT,
  duty_rate DECIMAL(10,4),
  vat_rate DECIMAL(10,4) DEFAULT 19.0,
  supplementary_unit TEXT,
  data_source VARCHAR(50) DEFAULT 'xi_api',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hs_code)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_hs_hierarchy_parent ON hs_code_hierarchy(parent_code);
CREATE INDEX IF NOT EXISTS idx_hs_hierarchy_declarable ON hs_code_hierarchy(declarable);
CREATE INDEX IF NOT EXISTS idx_hs_hierarchy_level ON hs_code_hierarchy(level);
CREATE INDEX IF NOT EXISTS idx_hs_hierarchy_prefix ON hs_code_hierarchy(hs_code varchar_pattern_ops);

-- HS 编码关键词表（用于搜索）
CREATE TABLE IF NOT EXISTS hs_code_keywords (
  id SERIAL PRIMARY KEY,
  hs_code VARCHAR(10) NOT NULL,
  keyword TEXT NOT NULL,
  keyword_type VARCHAR(20),    -- product_name/material/usage/alias
  weight INTEGER DEFAULT 1,    -- 搜索权重
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_hs_keywords_code ON hs_code_keywords(hs_code);
CREATE INDEX IF NOT EXISTS idx_hs_keywords_keyword ON hs_code_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_hs_keywords_search ON hs_code_keywords USING gin(to_tsvector('simple', keyword));

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_hs_hierarchy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hs_hierarchy_update ON hs_code_hierarchy;
CREATE TRIGGER trg_hs_hierarchy_update
  BEFORE UPDATE ON hs_code_hierarchy
  FOR EACH ROW
  EXECUTE FUNCTION update_hs_hierarchy_timestamp();

-- 插入一些示例章节数据（可选）
INSERT INTO hs_code_hierarchy (hs_code, level, description, description_cn, has_children, child_count) VALUES
('01', 'chapter', 'Live animals', '活动物', true, 6),
('02', 'chapter', 'Meat and edible meat offal', '肉及食用杂碎', true, 10),
('61', 'chapter', 'Articles of apparel and clothing accessories, knitted or crocheted', '针织或钩编的服装及衣着附件', true, 17),
('84', 'chapter', 'Nuclear reactors, boilers, machinery and mechanical appliances', '核反应堆、锅炉、机器、机械器具及其零件', true, 85),
('85', 'chapter', 'Electrical machinery and equipment and parts thereof', '电机、电气设备及其零件', true, 48),
('87', 'chapter', 'Vehicles other than railway or tramway rolling stock', '车辆及其零件、附件', true, 16),
('94', 'chapter', 'Furniture; bedding, mattresses, cushions and similar stuffed furnishings', '家具；寝具等', true, 6)
ON CONFLICT (hs_code) DO UPDATE SET
  description = EXCLUDED.description,
  description_cn = EXCLUDED.description_cn,
  has_children = EXCLUDED.has_children,
  child_count = EXCLUDED.child_count,
  updated_at = CURRENT_TIMESTAMP;

-- 添加注释
COMMENT ON TABLE hs_code_hierarchy IS 'HS编码层级缓存表，用于加速编码查询';
COMMENT ON TABLE hs_code_keywords IS 'HS编码关键词表，用于商品描述搜索';
COMMENT ON COLUMN hs_code_hierarchy.level IS 'chapter(章)、heading(品目)、subheading(子目)、cn(CN编码)、taric(TARIC编码)';
COMMENT ON COLUMN hs_code_hierarchy.declarable IS '是否可申报编码（叶节点）';
COMMENT ON COLUMN hs_code_hierarchy.group_title IS '分组标题，如"身高不超过80厘米"';
COMMENT ON COLUMN hs_code_keywords.keyword_type IS 'product_name(产品名称)、material(材质)、usage(用途)、alias(别名)';
