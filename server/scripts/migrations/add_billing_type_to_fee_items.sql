-- 添加 billing_type 字段到产品费用项表
-- billing_type: 计费类型 (fixed=固定价格, actual=按实际收费)

ALTER TABLE product_fee_items 
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'fixed';

-- 添加注释
COMMENT ON COLUMN product_fee_items.billing_type IS '计费类型: fixed=固定价格, actual=按实际收费';

