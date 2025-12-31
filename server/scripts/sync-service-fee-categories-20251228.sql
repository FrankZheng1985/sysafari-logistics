-- 同步服务费类别数据到生产环境
-- 创建时间: 2025-12-28
-- 记录数: 61 条

-- 重置序列以避免冲突
SELECT setval('service_fee_categories_id_seq', (SELECT MAX(id) FROM service_fee_categories), true);


INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (12, '卡车等待费', 'TRUCK WAITING FEE', '', '卸货等待费，卡车卸货压夜费，清关卡车等待费', 12, 'active', NULL, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (13, '卸货等待费', 'UNLOADING WAITING FEE', '', '', 1, 'active', 12, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (14, '卡车卸货压夜费', 'TRUCK UNLOADING OVERNIGHT FEE', '', '', 2, 'active', 12, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (15, '清关卡车等待费', 'CUSTOMS CLEARANCE TRUCK WAITING FEES', '', '', 3, 'active', 12, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (16, '提单管理费', 'BILL OF LADING MANAGEMENT FEE', '', '', 1, 'active', 11, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (17, '进口商代理进口', 'IMPORTER AS AN AGENT FOR IMPORT', '', '', 1, 'active', 10, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (18, '关税', 'DUTY', '', '', 1, 'active', 9, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (19, '增值税', 'VAT', '', '', 2, 'active', 9, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (20, '税务代理费', 'TAX AGENCY FEES', '', '', 2, 'active', 11, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (21, '船东港杂费', 'PORT CHARGES FOR SHIPOWNERS', '', '', 1, 'active', 8, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (22, '码头费', 'DOCK FEES', '', '', 2, 'active', 8, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (23, 'X关扫描', 'X-RAY SCANNING', '', '', 3, 'active', 8, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (24, '集装箱气体检测', 'CONTAINER GAS DETECTION', '', '', 4, 'active', 8, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (25, '码头换单', 'DOCK DOCUMENT EXCHANGE', '', '', 1, 'active', 7, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (26, '机场换单费', 'AIRPORT DOCUMENT EXCHANGE', '', '', 2, 'active', 7, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (27, '铁路换单', 'RAILWAY DOCUMENT EXCHANGE', '', '', 3, 'active', 7, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (28, '转关T1文件费', 'TRANSFER T1 FEE', '', '', 1, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (29, 'HS Code', 'HS CODE', '', '', 2, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (30, '文件错误费', 'FILE ERROR FEE', '', '', 4, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (31, '瞒报罚款', 'CONCEALMENT', '', '', 3, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (32, '海关罚款', 'CUSTOMS FINES', '', '', 5, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (33, '一个提单多个柜子', 'ONE BILL OF LADING FOR MULTIPLE CONTAINERS', '', '', 6, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (34, '清关服务费', 'CUSTOMS CLEARANCE RELATED SERVICE FEES', 'Clearance Services', '', 1, 'active', 5, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (35, '海关重新申报', 'CUSTOMS RE-DECLARATION', '', '', 2, 'active', 5, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (36, '清关事宜人工咨询费', 'CUSTOMS CLEARANCE CONSULTATION FEE', '', '', 3, 'active', 5, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (37, '操作费', 'OPERATION FEE', '', '', 1, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (38, '卸货费', 'UNLOADING FEE', '', '', 2, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (39, '装货费', 'LOADING FEE', '', '', 5, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (40, '找货人工费', 'FINDING GOODS LABOR COST', '', '', 4, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (41, '扫描费', 'SCANNING FEE', '', '', 3, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (42, '运输费', 'TRANSPORTATION FEES', '', '', 1, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (43, '偏远地区运输费', 'TRANSPORTATION FEES TO REMOTE AREAS', '', '', 2, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (44, '异地还柜费', 'OUT-OF-TOWN CABINET RETURN FEE', '', '', 3, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (45, '清关查验费', 'CUSTOMS CLEARANCE INSPECTION FEE', '', '', 2, 'active', 46, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (46, '查验费', 'INSPECTION FEE', '', '', 13, 'active', NULL, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (47, '码头查验费', 'PORT INSPECTION FEE', '', '', 1, 'active', 46, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (48, '订单损失费', 'ORDER LOSS FEE', '', '', 4, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (49, '周末等待费', 'WEEKEND WAITING FEE', '', '', 4, 'active', 12, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (50, '堆存费', 'STORAGE FEE', '', '', 6, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (51, '滞港费', 'DEMURRAGE', '', '', 5, 'active', 8, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (52, '税号使用费', 'TAX ID USAGE FEE', '', '', 2, 'active', 10, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (53, '分单费', 'ORDER SPLITTING FEE', '', '', 4, 'active', 5, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (55, 'UPS费用', 'UPS COST', '', '', 1, 'active', 4, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (56, '税务代理服务', 'TAX AGENCY SERVICES', '', '', 3, 'active', 10, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (57, '多个进口VAT申报费', 'MULTIPLE IMPORT VAT DECLARATIONS', '', '', 5, 'active', 5, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (58, 'THC', 'THC', '', '', 6, 'active', 8, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (59, '清提派业务', 'CLEARING AND DISPATCHING BUSINESS', '', '', 0, 'active', NULL, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (60, '商检费', 'COMMODITY INSPECTION FEE', '', '', 7, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (61, '熏蒸费', 'FUMIGATION FEE', '', '', 8, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (62, '单证翻译费', 'DOCUMENT TRANSLATION FEE', '', '', 9, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (63, '关税代垫', 'CUSTOMS DUTY ADVANCE PAYMENT', '', '', 3, 'active', 9, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (64, '增值税代垫', 'VALUE-ADDED TAX PREPAYMENT', '', '', 4, 'active', 9, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (65, '空运费', 'AIR FREIGHT', '', '', 5, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (66, '燃油附加费', 'FUEL SURCHARGE', '', '', 6, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (67, '安检费', 'SECURITY CHECK FEE', '', '', 10, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (68, '机场操作费', 'AIRPORT HANDLING FEES', '', '', 7, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (69, '铁路运费', 'RAILWAY FREIGHT', '', '', 7, 'active', 3, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (70, '口岸换装费', 'PORT TRANSSHIPMENT FEE', '', '', 8, 'active', 2, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (71, '铁路文件费', 'RAILWAY DOCUMENT FEES', '', '', 11, 'active', 6, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (72, '海关申报查验协助费', 'CUSTOMS DECLARATION AND INSPECTION ASSISTANCE FEE', '', '', 3, 'active', 46, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES (73, '卡车停靠清关费', 'TRUCK PARKING CLEARANCE FEE', '', '', 6, 'active', 5, 2) ON CONFLICT (id) DO NOTHING;


-- 更新序列
SELECT setval('service_fee_categories_id_seq', (SELECT MAX(id) FROM service_fee_categories), true);

-- 验证
SELECT COUNT(*) as total_categories FROM service_fee_categories;

