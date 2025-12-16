-- 修复 customer_tax_numbers 表的 customer_id 字段类型
-- 将 INTEGER 改为 TEXT 以匹配 customers 表的 id 字段类型
-- 执行方法: psql -h host -U user -d database -f migrate-fix-customer-id-type.sql

-- 修改 customer_id 字段类型为 TEXT
ALTER TABLE customer_tax_numbers 
ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;

-- 同样修复 customer_addresses 表（如果存在）
ALTER TABLE customer_addresses 
ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ customer_id 字段类型已修改为 TEXT';
END $$;
