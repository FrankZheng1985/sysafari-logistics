-- 迁移脚本：发票表添加文件URL字段
-- 执行日期：2024-12-16

-- 1. invoices表添加新字段
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS container_numbers TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fee_ids TEXT DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS excel_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS excel_generated_at TIMESTAMP;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 发票文件字段迁移完成！';
    RAISE NOTICE '📊 新增字段：customer_address, container_numbers, fee_ids, pdf_url, excel_url, pdf_generated_at, excel_generated_at';
END $$;
