-- 修复供应商报价表中缺失的供应商名称
-- 问题：部分 supplier_price_items 记录的 supplier_name 字段为空
-- 解决：从 suppliers 表中获取供应商名称并更新

-- 1. 更新 supplier_price_items 表中缺失的 supplier_name
UPDATE supplier_price_items spi
SET supplier_name = s.supplier_name, updated_at = NOW()
FROM suppliers s
WHERE spi.supplier_id = s.id
  AND (spi.supplier_name IS NULL OR spi.supplier_name = '');

-- 2. 更新 product_fee_items 表中缺失的 supplier_name（如果有供应商关联）
UPDATE product_fee_items pfi
SET supplier_name = s.supplier_name, updated_at = NOW()
FROM suppliers s
WHERE pfi.supplier_id = s.id
  AND (pfi.supplier_name IS NULL OR pfi.supplier_name = '')
  AND pfi.supplier_id IS NOT NULL;

-- 查看修复结果
SELECT 
  'supplier_price_items' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 1 END) as with_name,
  COUNT(CASE WHEN supplier_name IS NULL OR supplier_name = '' THEN 1 END) as without_name
FROM supplier_price_items
UNION ALL
SELECT 
  'product_fee_items' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 1 END) as with_name,
  COUNT(CASE WHEN supplier_name IS NULL OR supplier_name = '' THEN 1 END) as without_name
FROM product_fee_items
WHERE supplier_id IS NOT NULL;

