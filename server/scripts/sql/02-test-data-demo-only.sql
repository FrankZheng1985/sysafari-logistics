-- ============================================================
-- 测试数据脚本
-- ⚠️ 仅用于：演示环境
-- ❌ 禁止在生产环境执行！
-- 执行方式：psql -h host -U user -d database -f 02-test-data-demo-only.sql
-- ============================================================

-- ==================== 产品数据（应收费用基础） ====================

INSERT INTO products (id, product_code, product_name, product_name_en, category, description, is_active, sort_order, created_by) VALUES
('prod-001', 'FCL-SEA', '整柜海运服务', 'Full Container Load Sea Freight', 'sea_freight', '提供整柜海运服务，包含订舱、港口操作、海运运输等', 1, 1, 'admin'),
('prod-002', 'LCL-SEA', '拼箱海运服务', 'Less Container Load Sea Freight', 'sea_freight', '提供拼箱海运服务，适合小批量货物', 1, 2, 'admin'),
('prod-003', 'CUSTOMS', '清关服务', 'Customs Clearance Service', 'customs', '提供进出口清关服务，包含报关、查验、放行等', 1, 3, 'admin'),
('prod-004', 'WAREHOUSE', '仓储服务', 'Warehousing Service', 'warehouse', '提供仓储、分拣、包装等增值服务', 1, 4, 'admin'),
('prod-005', 'TRUCKING', '陆运配送服务', 'Trucking & Delivery Service', 'trucking', '提供欧洲境内陆运配送服务', 1, 5, 'admin'),
('prod-006', 'AIR-FREIGHT', '空运服务', 'Air Freight Service', 'air_freight', '提供空运服务，适合紧急或高价值货物', 1, 6, 'admin'),
('prod-007', 'RAIL-FREIGHT', '铁路运输服务', 'Rail Freight Service', 'rail_freight', '提供中欧铁路运输服务', 1, 7, 'admin')
ON CONFLICT (id) DO NOTHING;

-- ==================== 产品费用项（整柜海运服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-001', '海运费', 'Ocean Freight', 'freight', '柜', 1200.00, 800.00, 2000.00, 'EUR', 1, '基本海运费用', 1),
('prod-001', '订舱费', 'Booking Fee', 'handling', '票', 50.00, 50.00, 50.00, 'EUR', 1, '订舱服务费', 2),
('prod-001', '文件费', 'Documentation Fee', 'handling', '票', 35.00, 35.00, 50.00, 'EUR', 1, '提单、舱单等文件费用', 3),
('prod-001', '港口操作费', 'Terminal Handling Charge', 'terminal', '柜', 280.00, 250.00, 350.00, 'EUR', 1, '起运港装卸费', 4),
('prod-001', '封条费', 'Seal Fee', 'handling', '个', 15.00, 15.00, 20.00, 'EUR', 0, '集装箱封条', 5),
('prod-001', '燃油附加费', 'Bunker Adjustment Factor', 'surcharge', '柜', 150.00, NULL, NULL, 'EUR', 0, '根据油价浮动，实报实销', 6),
('prod-001', '紧急燃油附加费', 'Emergency Bunker Surcharge', 'surcharge', '柜', 80.00, NULL, NULL, 'EUR', 0, '临时燃油附加费', 7);

-- ==================== 产品费用项（拼箱海运服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-002', '海运费', 'Ocean Freight', 'freight', 'CBM', 65.00, 50.00, 100.00, 'EUR', 1, '按立方计费', 1),
('prod-002', '拼箱服务费', 'Consolidation Fee', 'handling', 'CBM', 25.00, 20.00, 35.00, 'EUR', 1, '货物拼装服务', 2),
('prod-002', '文件费', 'Documentation Fee', 'handling', '票', 35.00, 35.00, 50.00, 'EUR', 1, '提单文件费', 3),
('prod-002', '港口操作费', 'Terminal Handling Charge', 'terminal', 'CBM', 18.00, 15.00, 25.00, 'EUR', 1, '港口操作费按立方计', 4),
('prod-002', '最低收费', 'Minimum Charge', 'freight', '票', 150.00, 150.00, 150.00, 'EUR', 0, '不足最低立方按此收费', 5);

-- ==================== 产品费用项（清关服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-003', '报关费', 'Customs Declaration Fee', 'customs', '票', 85.00, 65.00, 120.00, 'EUR', 1, '标准报关服务', 1),
('prod-003', '查验费', 'Inspection Fee', 'customs', '票', 180.00, 150.00, 300.00, 'EUR', 0, '海关查验配合费', 2),
('prod-003', '商检费', 'CIQ Fee', 'customs', '票', 120.00, 100.00, 180.00, 'EUR', 0, '商品检验检疫', 3),
('prod-003', '熏蒸费', 'Fumigation Fee', 'customs', '票', 200.00, 150.00, 350.00, 'EUR', 0, '木质包装熏蒸', 4),
('prod-003', '单证翻译费', 'Document Translation Fee', 'handling', '页', 25.00, 20.00, 40.00, 'EUR', 0, '报关单据翻译', 5),
('prod-003', '关税代垫', 'Duty Advance', 'duty', '票', 0.00, NULL, NULL, 'EUR', 0, '实报实销', 6),
('prod-003', '增值税代垫', 'VAT Advance', 'tax', '票', 0.00, NULL, NULL, 'EUR', 0, '实报实销', 7);

-- ==================== 产品费用项（仓储服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-004', '仓储费', 'Storage Fee', 'warehouse', 'CBM/天', 1.50, 1.00, 2.50, 'EUR', 1, '按立方按天计费', 1),
('prod-004', '入库费', 'Receiving Fee', 'warehouse', 'CBM', 8.00, 6.00, 12.00, 'EUR', 1, '货物入库操作', 2),
('prod-004', '出库费', 'Dispatching Fee', 'warehouse', 'CBM', 8.00, 6.00, 12.00, 'EUR', 1, '货物出库操作', 3),
('prod-004', '分拣费', 'Sorting Fee', 'warehouse', '件', 0.50, 0.30, 1.00, 'EUR', 0, '按件分拣', 4),
('prod-004', '贴标费', 'Labeling Fee', 'warehouse', '件', 0.30, 0.20, 0.50, 'EUR', 0, '贴条码标签', 5),
('prod-004', '打托费', 'Palletizing Fee', 'warehouse', '托', 15.00, 12.00, 20.00, 'EUR', 0, '货物打托服务', 6);

-- ==================== 产品费用项（陆运配送服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-005', '陆运费', 'Trucking Fee', 'freight', 'KM', 2.50, 2.00, 4.00, 'EUR', 1, '按公里计费', 1),
('prod-005', '起步价', 'Minimum Charge', 'freight', '票', 180.00, 150.00, 250.00, 'EUR', 1, '最低运费', 2),
('prod-005', '提货费', 'Pick-up Fee', 'handling', '票', 65.00, 50.00, 100.00, 'EUR', 0, '上门提货服务', 3),
('prod-005', '送货费', 'Delivery Fee', 'handling', '票', 65.00, 50.00, 100.00, 'EUR', 0, '送货上门服务', 4),
('prod-005', '尾板车附加费', 'Tail Lift Surcharge', 'surcharge', '票', 80.00, 60.00, 120.00, 'EUR', 0, '需要尾板卸货', 5),
('prod-005', '等候费', 'Waiting Fee', 'surcharge', '小时', 45.00, 35.00, 60.00, 'EUR', 0, '超过1小时收取', 6);

-- ==================== 产品费用项（空运服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-006', '空运费', 'Air Freight', 'freight', 'KG', 4.50, 3.00, 8.00, 'EUR', 1, '按公斤计费', 1),
('prod-006', '燃油附加费', 'Fuel Surcharge', 'surcharge', 'KG', 0.80, NULL, NULL, 'EUR', 1, '按重量收取', 2),
('prod-006', '安检费', 'Security Fee', 'handling', 'KG', 0.15, 0.10, 0.25, 'EUR', 1, '航空安检费', 3),
('prod-006', '机场操作费', 'Airport Handling Fee', 'terminal', '票', 120.00, 100.00, 180.00, 'EUR', 1, '机场地面操作', 4),
('prod-006', '最低收费', 'Minimum Charge', 'freight', '票', 200.00, 180.00, 250.00, 'EUR', 0, '不足45KG按此收费', 5);

-- ==================== 产品费用项（铁路运输服务） ====================
INSERT INTO product_fee_items (product_id, fee_name, fee_name_en, fee_category, unit, standard_price, min_price, max_price, currency, is_required, description, sort_order) VALUES
('prod-007', '铁路运费', 'Rail Freight', 'freight', '柜', 3500.00, 3000.00, 5000.00, 'EUR', 1, '中欧铁路运费', 1),
('prod-007', '装车费', 'Loading Fee', 'handling', '柜', 200.00, 150.00, 280.00, 'EUR', 1, '铁路站装车', 2),
('prod-007', '口岸换装费', 'Transshipment Fee', 'handling', '柜', 350.00, 300.00, 450.00, 'EUR', 1, '边境口岸换装', 3),
('prod-007', '铁路文件费', 'Rail Documentation Fee', 'handling', '票', 80.00, 60.00, 100.00, 'EUR', 1, '铁路运单等文件', 4);

-- ==================== 供应商报价（COSCO 海运） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-001', 'COSCO Shipping Lines Co., Ltd', '整柜海运费 20GP', 'Ocean Freight 20GP', 'freight', '柜', 850.00, 'EUR', '2025-01-01', '2025-06-30', '上海', '汉堡', ''),
('sup-001', 'COSCO Shipping Lines Co., Ltd', '整柜海运费 40GP', 'Ocean Freight 40GP', 'freight', '柜', 1100.00, 'EUR', '2025-01-01', '2025-06-30', '上海', '汉堡', ''),
('sup-001', 'COSCO Shipping Lines Co., Ltd', '整柜海运费 40HQ', 'Ocean Freight 40HQ', 'freight', '柜', 1150.00, 'EUR', '2025-01-01', '2025-06-30', '上海', '汉堡', ''),
('sup-001', 'COSCO Shipping Lines Co., Ltd', 'THC起运港', 'Origin THC', 'terminal', '柜', 180.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-001', 'COSCO Shipping Lines Co., Ltd', '文件费', 'Documentation Fee', 'handling', '票', 30.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-001', 'COSCO Shipping Lines Co., Ltd', '封条费', 'Seal Fee', 'handling', '个', 12.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-001', 'COSCO Shipping Lines Co., Ltd', '燃油附加费', 'BAF', 'surcharge', '柜', 120.00, 'EUR', '2025-01-01', '2025-03-31', '', '', '季度调整');

-- ==================== 供应商报价（Maersk 海运） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-002', 'Maersk Line', '整柜海运费 20GP', 'Ocean Freight 20GP', 'freight', '柜', 920.00, 'EUR', '2025-01-01', '2025-06-30', '宁波', '鹿特丹', ''),
('sup-002', 'Maersk Line', '整柜海运费 40GP', 'Ocean Freight 40GP', 'freight', '柜', 1200.00, 'EUR', '2025-01-01', '2025-06-30', '宁波', '鹿特丹', ''),
('sup-002', 'Maersk Line', '整柜海运费 40HQ', 'Ocean Freight 40HQ', 'freight', '柜', 1250.00, 'EUR', '2025-01-01', '2025-06-30', '宁波', '鹿特丹', ''),
('sup-002', 'Maersk Line', 'THC起运港', 'Origin THC', 'terminal', '柜', 195.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-002', 'Maersk Line', '文件费', 'Documentation Fee', 'handling', '票', 35.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-002', 'Maersk Line', '低硫燃油附加费', 'LSS', 'surcharge', '柜', 85.00, 'EUR', '2025-01-01', '2025-03-31', '', '', '');

-- ==================== 供应商报价（Hamburg Logistics 仓储） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-003', 'Hamburg Logistics GmbH', '仓储费', 'Storage Fee', 'warehouse', 'CBM/天', 1.20, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '入库费', 'Receiving Fee', 'warehouse', 'CBM', 6.50, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '出库费', 'Dispatching Fee', 'warehouse', 'CBM', 6.50, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '分拣费', 'Sorting Fee', 'warehouse', '件', 0.35, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '贴标费', 'Labeling Fee', 'warehouse', '件', 0.20, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '打托费', 'Palletizing Fee', 'warehouse', '托', 12.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '拆柜费 20GP', 'Devanning 20GP', 'warehouse', '柜', 180.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-003', 'Hamburg Logistics GmbH', '拆柜费 40GP/HQ', 'Devanning 40GP/HQ', 'warehouse', '柜', 280.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '');

-- ==================== 供应商报价（Euro Customs 清关） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-004', 'Euro Customs Services', '报关费', 'Customs Declaration Fee', 'customs', '票', 65.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '标准报关'),
('sup-004', 'Euro Customs Services', '查验配合费', 'Inspection Assistance Fee', 'customs', '票', 150.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-004', 'Euro Customs Services', '单证翻译费', 'Document Translation', 'handling', '页', 18.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-004', 'Euro Customs Services', '加急报关费', 'Express Clearance Fee', 'customs', '票', 120.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '24小时内完成'),
('sup-004', 'Euro Customs Services', 'EORI代办费', 'EORI Registration Fee', 'handling', '票', 80.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '新客户首次');

-- ==================== 供应商报价（Rotterdam Trucking 陆运） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-005', 'Rotterdam Trucking BV', '陆运费 - 荷兰境内', 'Trucking - NL', 'freight', 'KM', 2.20, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-005', 'Rotterdam Trucking BV', '陆运费 - 德国', 'Trucking - DE', 'freight', 'KM', 2.40, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-005', 'Rotterdam Trucking BV', '陆运费 - 比利时', 'Trucking - BE', 'freight', 'KM', 2.30, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-005', 'Rotterdam Trucking BV', '起步价', 'Minimum Charge', 'freight', '票', 150.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-005', 'Rotterdam Trucking BV', '尾板车', 'Tail Lift', 'surcharge', '票', 65.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-005', 'Rotterdam Trucking BV', '等候费', 'Waiting Fee', 'surcharge', '小时', 38.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '超过1小时'),
('sup-005', 'Rotterdam Trucking BV', '周末配送附加', 'Weekend Surcharge', 'surcharge', '票', 120.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '');

-- ==================== 供应商报价（Antwerp Terminal 码头） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-006', 'Antwerp Terminal Operations', 'THC 20GP', 'THC 20GP', 'terminal', '柜', 165.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-006', 'Antwerp Terminal Operations', 'THC 40GP/HQ', 'THC 40GP/HQ', 'terminal', '柜', 245.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-006', 'Antwerp Terminal Operations', '港口安保费', 'Port Security Fee', 'terminal', '柜', 25.00, 'EUR', '2025-01-01', '2025-12-31', '', '', ''),
('sup-006', 'Antwerp Terminal Operations', '堆存费 (免费期后)', 'Demurrage', 'terminal', '柜/天', 45.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '7天免费期后'),
('sup-006', 'Antwerp Terminal Operations', '查验移箱费', 'Inspection Move', 'terminal', '柜', 280.00, 'EUR', '2025-01-01', '2025-12-31', '', '', '');

-- ==================== 供应商报价（德邦物流） ====================
INSERT INTO supplier_price_items (supplier_id, supplier_name, fee_name, fee_name_en, fee_category, unit, price, currency, effective_date, expiry_date, route_from, route_to, remark) VALUES
('sup-sp-1', '德邦物流', '首重', 'First Weight', 'freight', 'KG', 15.00, 'CNY', '2025-01-01', '2025-12-31', '', '', '首公斤'),
('sup-sp-1', '德邦物流', '续重', 'Additional Weight', 'freight', 'KG', 3.00, 'CNY', '2025-01-01', '2025-12-31', '', '', ''),
('sup-sp-1', '德邦物流', '上门提货费', 'Pick-up Fee', 'handling', '票', 30.00, 'CNY', '2025-01-01', '2025-12-31', '', '', ''),
('sup-sp-1', '德邦物流', '送货上楼费', 'Upstairs Delivery', 'handling', '层', 10.00, 'CNY', '2025-01-01', '2025-12-31', '', '', '无电梯');

-- ==================== 完成提示 ====================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ 测试数据导入完成！';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '产品数据: 7 个产品，40 个费用项';
    RAISE NOTICE '供应商报价: 7 个供应商，42 条报价';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 此脚本仅用于演示环境！';
    RAISE NOTICE '============================================================';
END $$;
