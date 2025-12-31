-- ============================================================
-- 同步生产环境数据到本地开发环境
-- 添加生产环境独有的服务费类别（30条）
-- 生成时间: 2025-12-28
-- ============================================================

-- 二级分类
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (74, '仓租', 'WAREHOUSE RENT', '', '', 6, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (75, '出仓费', 'OUTBOUND FEE', '', '', 7, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (76, '打托费', 'PALLETIZING FEE', '', '', 8, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (77, '换标签', 'RELABELING FEE', '', '', 9, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (78, '装卸搬运', 'HANDLING', '', '', 10, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (79, '理货服务', 'TALLYING SERVICE', '', '', 11, 'active', 2, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (80, '尾程运输', 'LAST MILE TRANSPORT', '', '', 1, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (81, '全程运输', 'FULL TRANSPORT', '', '', 2, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (82, '掏柜', 'DEVANNING', '', '', 3, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (83, '还柜费', 'CONTAINER RETURN FEE', '', '', 4, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (84, '铅封', 'SEAL', '', '', 5, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (85, 'T1转关', 'T1 TRANSIT', '', '', 6, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (86, '卡车租用', 'TRUCK RENTAL', '', '', 7, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (87, '超公里费', 'OVER-MILEAGE FEE', '', '', 8, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (88, '预约费', 'APPOINTMENT FEE', '', '', 9, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (89, '夜间运输', 'NIGHT TRANSPORT', '', '', 10, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (90, '周末运输', 'WEEKEND TRANSPORT', '', '', 11, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (91, '快递', 'EXPRESS DELIVERY', '', '', 12, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (92, '绑扎费', 'LASHING FEE', '', '', 13, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (93, '提货费', 'PICKUP FEE', '', '', 14, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (94, '转柜费', 'CONTAINER TRANSFER FEE', '', '', 15, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (95, '空跑费', 'EMPTY RUN FEE', '', '', 16, 'active', 3, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (96, '保险', 'INSURANCE', '', '', 1, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (97, '垫付费', 'ADVANCE PAYMENT FEE', '', '', 2, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (98, '银行手续费', 'BANK CHARGES', '', '', 3, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (99, '分拨费', 'DISTRIBUTION FEE', '', '', 5, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (100, '押金', 'DEPOSIT', '', '', 6, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (101, '超重费', 'OVERWEIGHT FEE', '', '', 7, 'active', 4, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (102, '查验加急费', 'INSPECTION RUSH FEE', '', '', 4, 'active', 5, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level)
VALUES (103, '二次清关', 'SECOND CLEARANCE', '', '', 5, 'active', 5, 2)
ON CONFLICT (id) DO NOTHING;

-- 更新序列
SELECT setval('service_fee_categories_id_seq', 104, true);

-- 验证
SELECT COUNT(*) as total FROM service_fee_categories;