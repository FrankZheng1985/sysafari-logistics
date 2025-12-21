-- 为 cargo_imports 表添加发货方和进口商信息字段
-- 执行时间: 2025-12-21

-- 发货方信息（关联提单发货人）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS shipper_name TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS shipper_address TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS shipper_contact TEXT;

-- 进口商信息（关联客户税号）
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_customer_id TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_name TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_tax_id TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_tax_number TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_tax_type TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_country TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_company_name TEXT;
ALTER TABLE cargo_imports ADD COLUMN IF NOT EXISTS importer_address TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cargo_imports_importer ON cargo_imports(importer_customer_id);

COMMENT ON COLUMN cargo_imports.shipper_name IS '发货方名称（来自提单）';
COMMENT ON COLUMN cargo_imports.shipper_address IS '发货方地址';
COMMENT ON COLUMN cargo_imports.shipper_contact IS '发货方联系方式';
COMMENT ON COLUMN cargo_imports.importer_customer_id IS '进口商客户ID';
COMMENT ON COLUMN cargo_imports.importer_name IS '进口商名称';
COMMENT ON COLUMN cargo_imports.importer_tax_id IS '进口商税号记录ID（关联customer_tax_numbers）';
COMMENT ON COLUMN cargo_imports.importer_tax_number IS '进口商税号';
COMMENT ON COLUMN cargo_imports.importer_tax_type IS '进口商税号类型（vat/eori/other）';
COMMENT ON COLUMN cargo_imports.importer_country IS '进口商国家';
COMMENT ON COLUMN cargo_imports.importer_company_name IS '进口商公司全称';
COMMENT ON COLUMN cargo_imports.importer_address IS '进口商地址';
