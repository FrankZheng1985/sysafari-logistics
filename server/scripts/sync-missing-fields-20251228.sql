-- ============================================================
-- 生产环境缺失字段同步脚本
-- 创建时间: 2025-12-28
-- 说明: 同步 bills_of_lading 和 product_fee_items 缺失的字段
-- ============================================================

-- ==================== 1. bills_of_lading 表添加缺失字段 ====================
-- 说明：生产环境缺少 cmr_status 和 cmr_updated_at 字段

ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS cmr_status TEXT DEFAULT 'pending';
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS cmr_updated_at TIMESTAMP;

COMMENT ON COLUMN bills_of_lading.cmr_status IS 'CMR状态: pending=待处理, sent=已发送, received=已收到';
COMMENT ON COLUMN bills_of_lading.cmr_updated_at IS 'CMR状态更新时间';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bills_cmr_status ON bills_of_lading(cmr_status);

-- ==================== 2. product_fee_items 表添加缺失字段 ====================
-- 说明：生产环境缺少 route_from, route_to, postal_code, return_point 字段

ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS route_from TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS route_to TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS return_point TEXT;

COMMENT ON COLUMN product_fee_items.route_from IS '起始地';
COMMENT ON COLUMN product_fee_items.route_to IS '目的地';
COMMENT ON COLUMN product_fee_items.postal_code IS '邮编';
COMMENT ON COLUMN product_fee_items.return_point IS '还柜点';

-- ==================== 验证 ====================
SELECT 'bills_of_lading 字段数: ' || COUNT(*) as result
FROM information_schema.columns WHERE table_name = 'bills_of_lading';

SELECT 'product_fee_items 字段数: ' || COUNT(*) as result
FROM information_schema.columns WHERE table_name = 'product_fee_items';

