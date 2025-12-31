-- 为 customers 表添加 customer_region 列
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_region VARCHAR(50) DEFAULT 'china';

-- 添加注释
COMMENT ON COLUMN customers.customer_region IS '客户区域：china-中国, overseas-海外';
