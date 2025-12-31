-- ============================================
-- 演示环境数据库结构同步脚本
-- 目标：使演示环境与生产环境表结构保持一致
-- 执行方式：使用 psql 连接阿里云 RDS 执行，或在阿里云 DMS 控制台执行
-- ============================================

-- 1. 添加缺失的字段到 bills_of_lading 表
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS container_type TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS bill_type TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS transport_arrangement TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS consignee_type TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS container_return TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS full_container_transport TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS last_mile_transport TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS devanning TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS t1_declaration TEXT;
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS order_number TEXT;

-- 2. 删除废弃的字段
ALTER TABLE bills_of_lading DROP COLUMN IF EXISTS actual_container_no;

-- 3. 为现有订单生成订单号（如果 order_seq 和 order_number 为空）
UPDATE bills_of_lading 
SET order_seq = subquery.row_num,
    order_number = 'BP25' || LPAD(subquery.row_num::TEXT, 5, '0')
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
    FROM bills_of_lading 
    WHERE order_number IS NULL OR order_number = ''
) AS subquery
WHERE bills_of_lading.id = subquery.id;

-- 4. 验证结果
SELECT 
    COUNT(*) as total_bills,
    COUNT(order_number) as bills_with_order_number,
    COUNT(container_type) as bills_with_container_type
FROM bills_of_lading;

-- 完成提示
SELECT '演示环境数据库结构同步完成！' as message;

