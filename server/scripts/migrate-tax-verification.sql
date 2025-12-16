-- 税号验证功能迁移脚本
-- 为customer_tax_numbers表添加公司信息和验证状态字段
-- 执行方法: psql -h host -U user -d database -f migrate-tax-verification.sql

-- 添加公司名称字段
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS company_name TEXT;

-- 添加公司地址字段
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS company_address TEXT;

-- 添加验证状态字段（0=未验证, 1=已验证）
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0;

-- 添加验证时间字段
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- 添加验证数据字段（存储API返回的原始数据，JSON格式）
ALTER TABLE customer_tax_numbers ADD COLUMN IF NOT EXISTS verification_data TEXT;

-- 添加验证状态索引
CREATE INDEX IF NOT EXISTS idx_customer_tax_verified ON customer_tax_numbers(is_verified);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 税号验证字段迁移完成！';
    RAISE NOTICE '   - company_name: 公司名称';
    RAISE NOTICE '   - company_address: 公司地址';
    RAISE NOTICE '   - is_verified: 验证状态';
    RAISE NOTICE '   - verified_at: 验证时间';
    RAISE NOTICE '   - verification_data: 验证数据';
END $$;
