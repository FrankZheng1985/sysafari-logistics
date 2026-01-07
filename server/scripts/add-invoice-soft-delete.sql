-- 发票软删除功能迁移脚本
-- 添加 is_deleted 字段用于软删除，确保发票号不会被重复使用

-- 添加 is_deleted 字段
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 添加 deleted_at 字段记录删除时间
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_invoices_is_deleted ON invoices(is_deleted);

-- 更新现有记录（确保所有现有记录都标记为未删除）
UPDATE invoices SET is_deleted = FALSE WHERE is_deleted IS NULL;

