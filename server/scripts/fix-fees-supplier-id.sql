-- 修复 fees 表中旧格式的 supplierId（数字）为新格式（UUID）
-- 执行前请先备份数据！

-- 根据 supplierName 匹配来更新 supplierId
-- 注意：这个脚本需要在确认供应商名称匹配正确后执行

-- 傲翼 (11) -> b6df2455-3281-4404-8b1b-c8e72d18af68 (傲翼-清关)
UPDATE fees 
SET supplier_id = 'b6df2455-3281-4404-8b1b-c8e72d18af68'
WHERE supplier_id = '11' AND supplier_name LIKE '%傲翼%';

-- ASL (12) -> cf58ee15-fb0e-4409-8923-0fb5ad820a00
UPDATE fees 
SET supplier_id = 'cf58ee15-fb0e-4409-8923-0fb5ad820a00'
WHERE supplier_id = '12' AND supplier_name = 'ASL';

-- 安百 (14) -> 205b8444-c9fa-4069-99cd-13b11462228b
UPDATE fees 
SET supplier_id = '205b8444-c9fa-4069-99cd-13b11462228b'
WHERE supplier_id = '14' AND supplier_name = '安百';

-- Feldsberg-澳门 (15) -> 3f4bac51-66b0-4979-90f3-2a363f43a1d6
UPDATE fees 
SET supplier_id = '3f4bac51-66b0-4979-90f3-2a363f43a1d6'
WHERE supplier_id = '15' AND supplier_name = 'Feldsberg-澳门';

-- VIT Logistics (16) -> c6361b4f-9097-43eb-86c2-ccafc087e2ea
UPDATE fees 
SET supplier_id = 'c6361b4f-9097-43eb-86c2-ccafc087e2ea'
WHERE supplier_id = '16' AND supplier_name = 'VIT Logistics';

-- DWGK-澳门 (17) -> 2b56b985-c2fc-492b-a10f-098c2f9182c3
UPDATE fees 
SET supplier_id = '2b56b985-c2fc-492b-a10f-098c2f9182c3'
WHERE supplier_id = '17' AND supplier_name = 'DWGK-澳门';

-- Kiwistav-澳门 (18) -> c6f0351c-1210-4ebc-a562-3b10efed9606
UPDATE fees 
SET supplier_id = 'c6f0351c-1210-4ebc-a562-3b10efed9606'
WHERE supplier_id = '18' AND supplier_name = 'Kiwistav-澳门';

-- 客户自主VAT (19) - 需要先创建对应的供应商或找到正确的 UUID
-- 暂时跳过，后续手动处理
-- UPDATE fees SET supplier_id = '???' WHERE supplier_id = '19' AND supplier_name = '客户自主VAT';

-- DBWIH-澳门 (20) -> 4925262d-bc0b-4c93-95cd-a18c876b3cb6
UPDATE fees 
SET supplier_id = '4925262d-bc0b-4c93-95cd-a18c876b3cb6'
WHERE supplier_id = '20' AND supplier_name = 'DBWIH-澳门';

-- 验证更新结果
SELECT supplier_id, supplier_name, COUNT(*) as count 
FROM fees 
WHERE supplier_id IS NOT NULL AND supplier_id != ''
GROUP BY supplier_id, supplier_name
ORDER BY supplier_id;

