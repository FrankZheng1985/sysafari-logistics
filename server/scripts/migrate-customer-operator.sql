-- 迁移脚本：为客户表添加跟单员字段
-- 日期：2026-01-03
-- 描述：添加 assigned_operator 和 assigned_operator_name 字段，支持客户分配给跟单员

-- 添加跟单员ID字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_operator INTEGER;

-- 添加跟单员名称字段
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_operator_name TEXT;

-- 添加索引以提高查询效率
CREATE INDEX IF NOT EXISTS idx_customers_assigned_operator ON customers(assigned_operator);

-- 添加注释
COMMENT ON COLUMN customers.assigned_operator IS '分配的跟单员ID';
COMMENT ON COLUMN customers.assigned_operator_name IS '分配的跟单员名称';

