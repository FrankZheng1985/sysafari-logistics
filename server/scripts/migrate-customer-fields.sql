-- 迁移脚本：添加客户和联系人新字段
-- 执行日期：2024-12-16

-- 1. customers表添加新字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_region TEXT DEFAULT 'china';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_person TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_capital TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS establishment_date TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_scope TEXT;

-- 2. customer_contacts表添加contact_type字段
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'other';

-- 3. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(customer_region);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_type ON customer_contacts(contact_type);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 客户字段迁移完成！';
    RAISE NOTICE '📊 新增字段：customer_region, legal_person, registered_capital, establishment_date, business_scope, contact_type';
END $$;
