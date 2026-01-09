-- 发票模板图片字段迁移
-- 添加 Logo 和公章 URL 字段
-- 创建日期: 2026-01-09

-- 添加 logo_url 字段
ALTER TABLE invoice_templates 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- 添加 stamp_url 字段
ALTER TABLE invoice_templates 
ADD COLUMN IF NOT EXISTS stamp_url VARCHAR(500);

-- 添加注释
COMMENT ON COLUMN invoice_templates.logo_url IS '公司Logo图片URL';
COMMENT ON COLUMN invoice_templates.stamp_url IS '公司公章图片URL';

-- 验证添加结果
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoice_templates' 
AND column_name IN ('logo_url', 'stamp_url');
