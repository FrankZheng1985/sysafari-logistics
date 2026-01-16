-- 更新 service_fee_categories 表中缺失的英文名称
-- 根据 code 字段或中文名称翻译

-- 一级分类
UPDATE service_fee_categories SET name_en = 'Warehouse Services' WHERE id = 2 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Other Services' WHERE id = 4 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Export Customs Clearance Services' WHERE id = 1 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Truck Waiting Fee' WHERE id = 12 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Document Exchange Fee' WHERE id = 7 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Document Fees' WHERE id = 6 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Inspection Fee' WHERE id = 46 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Clearance Services' WHERE id = 5 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Clearing & Dispatching' WHERE id = 59 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Terminal Handling Charge' WHERE id = 8 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Tax Fees' WHERE id = 9 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Management Fee' WHERE id = 11 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Transport Services' WHERE id = 3 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Importer Agency Fee' WHERE id = 10 AND (name_en IS NULL OR name_en = '');

-- 二级分类
UPDATE service_fee_categories SET name_en = 'HS Code' WHERE id = 29 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'THC' WHERE id = 58 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'UPS Fee' WHERE id = 55 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'X-Ray Scanning' WHERE id = 23 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Multi-Container Bill of Lading' WHERE id = 33 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Remote Area Transportation Fee' WHERE id = 43 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Duty' WHERE id = 18 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Duty Advance' WHERE id = 63 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Split Order Fee' WHERE id = 53 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Document Translation Fee' WHERE id = 62 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Truck Parking Clearance Fee' WHERE id = 73 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Truck Overnight Unloading Fee' WHERE id = 14 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Unloading Waiting Fee' WHERE id = 13 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Unloading Fee' WHERE id = 38 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Port Transshipment Fee' WHERE id = 70 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Weekend Waiting Fee' WHERE id = 49 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Commodity Inspection Fee' WHERE id = 60 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Storage' WHERE id = 107 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Storage Fee' WHERE id = 50 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'VAT' WHERE id = 19 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'VAT Advance' WHERE id = 64 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Multiple Import VAT Declaration' WHERE id = 57 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Security Check Fee' WHERE id = 67 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Off-site Container Return Fee' WHERE id = 44 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Scanning Fee' WHERE id = 41 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Cargo Search Labor Fee' WHERE id = 40 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Bill of Lading Management Fee' WHERE id = 16 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Handling Fee' WHERE id = 37 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Document Error Fee' WHERE id = 30 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Service Fee' WHERE id = 104 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Airport Document Exchange Fee' WHERE id = 26 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Airport Handling Fee' WHERE id = 68 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Inspection Assistance Fee' WHERE id = 72 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Fine' WHERE id = 32 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Re-declaration' WHERE id = 35 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Clearance' WHERE id = 103 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Consultation Fee' WHERE id = 36 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Truck Waiting Fee' WHERE id = 15 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Customs Inspection Fee' WHERE id = 45 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Clearing & Dispatching' WHERE id = 105 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Port Fee' WHERE id = 109 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Demurrage' WHERE id = 51 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Fumigation Fee' WHERE id = 61 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Fuel Surcharge' WHERE id = 66 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Concealment Fine' WHERE id = 31 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Dock Document Exchange Fee' WHERE id = 25 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Port Inspection Fee' WHERE id = 47 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Dock Fee' WHERE id = 22 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Tax Agency Service' WHERE id = 56 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Tax Agency Fee' WHERE id = 20 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Tax ID Usage Fee' WHERE id = 52 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Tax Fee' WHERE id = 106 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Air Freight' WHERE id = 65 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Shipping Line THC' WHERE id = 21 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Loading Fee' WHERE id = 39 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Order Loss Fee' WHERE id = 48 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'T1 Transit Document Fee' WHERE id = 28 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Freight' WHERE id = 108 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Transportation Fee' WHERE id = 42 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Importer Agency Import' WHERE id = 17 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Railway Document Exchange Fee' WHERE id = 27 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Railway Document Fee' WHERE id = 71 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Railway Freight' WHERE id = 69 AND (name_en IS NULL OR name_en = '');
UPDATE service_fee_categories SET name_en = 'Container Gas Detection' WHERE id = 24 AND (name_en IS NULL OR name_en = '');

-- 检查更新结果
SELECT '更新完成，检查结果:' as info;
SELECT COUNT(*) as 仍缺少英文名称的数量 
FROM service_fee_categories 
WHERE name_en IS NULL OR name_en = '';
