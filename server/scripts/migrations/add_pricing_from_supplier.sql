-- 产品定价：支持从供应商报价获取成本并设置利润
-- 执行时间: 2025-12-26
-- 功能: 在产品费用项表中添加供应商关联和利润设置字段

-- 添加供应商关联字段
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_id TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_price_id INTEGER;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- 添加利润设置字段
-- profit_type: 'amount' = 固定金额, 'rate' = 利润率(百分比)
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS profit_type TEXT DEFAULT 'amount';
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS profit_value NUMERIC DEFAULT 0;

-- 添加供应商名称冗余字段（便于显示）
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_product_fee_items_supplier ON product_fee_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_fee_items_supplier_price ON product_fee_items(supplier_price_id);

-- 添加注释
COMMENT ON COLUMN product_fee_items.supplier_id IS '关联的供应商ID';
COMMENT ON COLUMN product_fee_items.supplier_price_id IS '关联的供应商采购价ID';
COMMENT ON COLUMN product_fee_items.cost_price IS '成本价（从供应商报价获取）';
COMMENT ON COLUMN product_fee_items.profit_type IS '利润类型: amount=固定金额, rate=利润率';
COMMENT ON COLUMN product_fee_items.profit_value IS '利润值（金额或百分比）';
COMMENT ON COLUMN product_fee_items.supplier_name IS '供应商名称（冗余字段）';

-- 验证
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'product_fee_items' 
  AND column_name IN ('supplier_id', 'supplier_price_id', 'cost_price', 'profit_type', 'profit_value', 'supplier_name')
ORDER BY column_name;

