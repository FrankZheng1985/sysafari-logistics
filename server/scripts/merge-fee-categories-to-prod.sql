-- ============================================================
-- 同步本地开发环境数据到生产环境
-- 添加本地开发环境独有的服务费类别（30条）
-- 生成时间: 2025-12-28
-- ⚠️ 执行前请确认并备份生产数据库
-- ============================================================

-- 一级分类
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (73, '清提派业务', 'CLEARING AND DISPATCHING BUSINESS', '', '', 0, 'active', NULL, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (74, '查验费', 'INSPECTION FEE', '', '', 13, 'active', NULL, 1)
ON CONFLICT (id) DO NOTHING;

-- 二级分类
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (75, '堆存费', 'STORAGE FEE', '', '', 6, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (76, '机场操作费', 'AIRPORT HANDLING FEES', '', '', 7, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (77, '口岸换装费', 'PORT TRANSSHIPMENT FEE', '', '', 8, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (78, '运输费', 'TRANSPORTATION FEES', '', '', 1, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (79, '偏远地区运输费', 'TRANSPORTATION FEES TO REMOTE AREAS', '', '', 2, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (80, '异地还柜费', 'OUT-OF-TOWN CABINET RETURN FEE', '', '', 3, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (81, '订单损失费', 'ORDER LOSS FEE', '', '', 4, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (82, '空运费', 'AIR FREIGHT', '', '', 5, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (83, '燃油附加费', 'FUEL SURCHARGE', '', '', 6, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (84, '铁路运费', 'RAILWAY FREIGHT', '', '', 7, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (85, 'UPS费用', 'UPS COST', '', '', 1, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (86, '分单费', 'ORDER SPLITTING FEE', '', '', 4, 'active', 5, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (87, '多个进口VAT申报费', 'MULTIPLE IMPORT VAT DECLARATIONS', '', '', 5, 'active', 5, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (88, '卡车停靠清关费', 'TRUCK PARKING CLEARANCE FEE', '', '', 6, 'active', 5, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (89, '商检费', 'COMMODITY INSPECTION FEE', '', '', 7, 'active', 6, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (90, '熏蒸费', 'FUMIGATION FEE', '', '', 8, 'active', 6, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (91, '单证翻译费', 'DOCUMENT TRANSLATION FEE', '', '', 9, 'active', 6, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (92, '安检费', 'SECURITY CHECK FEE', '', '', 10, 'active', 6, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (93, '铁路文件费', 'RAILWAY DOCUMENT FEES', '', '', 11, 'active', 6, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (94, 'THC', 'THC', '', '', 6, 'active', 8, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (95, '关税代垫', 'CUSTOMS DUTY ADVANCE PAYMENT', '', '', 3, 'active', 9, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (96, '增值税代垫', 'VALUE-ADDED TAX PREPAYMENT', '', '', 4, 'active', 9, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (97, '税号使用费', 'TAX ID USAGE FEE', '', '', 2, 'active', 10, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (98, '税务代理服务', 'TAX AGENCY SERVICES', '', '', 3, 'active', 10, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (99, '周末等待费', 'WEEKEND WAITING FEE', '', '', 4, 'active', 12, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (100, '码头查验费', 'PORT INSPECTION FEE', '', '', 1, 'active', 74, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (101, '清关查验费', 'CUSTOMS CLEARANCE INSPECTION FEE', '', '', 2, 'active', 74, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (102, '海关申报查验协助费', 'CUSTOMS DECLARATION AND INSPECTION ASSISTANCE FEE', '', '', 3, 'active', 74, 2)
ON CONFLICT (id) DO NOTHING;

-- 更新序列
SELECT setval('service_fee_categories_id_seq', 103, true);

-- 验证
SELECT COUNT(*) as total FROM service_fee_categories;