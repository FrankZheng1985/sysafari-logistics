-- ============================================================
-- 新加坡生产数据库同步脚本
-- 创建时间: 2025-12-28
-- 问题: 新加坡数据库 service_fee_categories 缺少 parent_id 和 level 字段
-- 执行方式: 使用 psql 连接阿里云 RDS 执行，或在阿里云 DMS 控制台执行
-- ============================================================

-- ==================== 1. 添加缺失的字段 ====================

-- service_fee_categories 表添加层级支持字段
ALTER TABLE service_fee_categories ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL;
ALTER TABLE service_fee_categories ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_service_fee_categories_parent ON service_fee_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_service_fee_categories_level ON service_fee_categories(level);

-- 更新现有数据的层级
UPDATE service_fee_categories SET level = 1 WHERE level IS NULL;

-- ==================== 2. bills_of_lading 表添加缺失字段 ====================

ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS cmr_status TEXT DEFAULT 'pending';
ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS cmr_updated_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_bills_cmr_status ON bills_of_lading(cmr_status);

-- ==================== 3. product_fee_items 表添加缺失字段 ====================

ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS route_from TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS route_to TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE product_fee_items ADD COLUMN IF NOT EXISTS return_point TEXT;

-- ==================== 4. 删除现有的服务费类别数据并重新导入 ====================

-- 先清空现有数据
TRUNCATE TABLE service_fee_categories RESTART IDENTITY CASCADE;

-- 重新插入完整的服务费类别数据（72条）
INSERT INTO service_fee_categories (id, name, code, name_en, description, sort_order, status, parent_id, level) VALUES
(1, '出口报关服务', 'EXPORT CUSTOMS CLEARANCE SERVICES', '', '', 1, 'active', NULL, 1),
(2, '仓储服务', 'WAREHOUSE', '', '', 2, 'active', NULL, 1),
(3, '运输服务', 'TRANSPORT', '', '', 3, 'active', NULL, 1),
(4, '其他服务', 'OTHER', '', '', 4, 'active', NULL, 1),
(5, '清关服务', 'CLEARANCE', '', '', 5, 'active', NULL, 1),
(6, '文件费', 'DOCUMENT FEES', '', '', 6, 'active', NULL, 1),
(7, '换单费', 'DOCUMENT EXCHANGE FEE', '', '', 7, 'active', NULL, 1),
(8, '港杂费', 'PORT CHARGES', '', '', 8, 'active', NULL, 1),
(9, '税务费', 'TAX FEES', '', '', 9, 'active', NULL, 1),
(10, '进口商代理费', 'IMPORTER''S AGENCY FEE', '', '', 10, 'active', NULL, 1),
(11, '管理费', 'MANAGEMENT FEE', '', '', 11, 'active', NULL, 1),
(12, '卡车等待费', 'TRUCK WAITING FEE', '', '卸货等待费，卡车卸货压夜费，清关卡车等待费', 12, 'active', NULL, 1),
(13, '卸货等待费', 'UNLOADING WAITING FEE', '', '', 1, 'active', 12, 2),
(14, '卡车卸货压夜费', 'TRUCK UNLOADING OVERNIGHT FEE', '', '', 2, 'active', 12, 2),
(15, '清关卡车等待费', 'CUSTOMS CLEARANCE TRUCK WAITING FEES', '', '', 3, 'active', 12, 2),
(16, '提单管理费', 'BILL OF LADING MANAGEMENT FEE', '', '', 1, 'active', 11, 2),
(17, '进口商代理进口', 'IMPORTER AS AN AGENT FOR IMPORT', '', '', 1, 'active', 10, 2),
(18, '关税', 'DUTY', '', '', 1, 'active', 9, 2),
(19, '增值税', 'VAT', '', '', 2, 'active', 9, 2),
(20, '税务代理费', 'TAX AGENCY FEES', '', '', 2, 'active', 11, 2),
(21, '船东港杂费', 'PORT CHARGES FOR SHIPOWNERS', '', '', 1, 'active', 8, 2),
(22, '码头费', 'DOCK FEES', '', '', 2, 'active', 8, 2),
(23, 'X关扫描', 'X-RAY SCANNING', '', '', 3, 'active', 8, 2),
(24, '集装箱气体检测', 'CONTAINER GAS DETECTION', '', '', 4, 'active', 8, 2),
(25, '码头换单', 'DOCK DOCUMENT EXCHANGE', '', '', 1, 'active', 7, 2),
(26, '机场换单费', 'AIRPORT DOCUMENT EXCHANGE', '', '', 2, 'active', 7, 2),
(27, '铁路换单', 'RAILWAY DOCUMENT EXCHANGE', '', '', 3, 'active', 7, 2),
(28, '转关T1文件费', 'TRANSFER T1 FEE', '', '', 1, 'active', 6, 2),
(29, 'HS Code', 'HS CODE', '', '', 2, 'active', 6, 2),
(30, '文件错误费', 'FILE ERROR FEE', '', '', 4, 'active', 6, 2),
(31, '瞒报罚款', 'CONCEALMENT', '', '', 3, 'active', 6, 2),
(32, '海关罚款', 'CUSTOMS FINES', '', '', 5, 'active', 6, 2),
(33, '一个提单多个柜子', 'ONE BILL OF LADING FOR MULTIPLE CONTAINERS', '', '', 6, 'active', 6, 2),
(34, '清关服务费', 'CUSTOMS CLEARANCE RELATED SERVICE FEES', 'Clearance Services', '', 1, 'active', 5, 2),
(35, '海关重新申报', 'CUSTOMS RE-DECLARATION', '', '', 2, 'active', 5, 2),
(36, '清关事宜人工咨询费', 'CUSTOMS CLEARANCE CONSULTATION FEE', '', '', 3, 'active', 5, 2),
(37, '操作费', 'OPERATION FEE', '', '', 1, 'active', 2, 2),
(38, '卸货费', 'UNLOADING FEE', '', '', 2, 'active', 2, 2),
(39, '装货费', 'LOADING FEE', '', '', 5, 'active', 2, 2),
(40, '找货人工费', 'FINDING GOODS LABOR COST', '', '', 4, 'active', 2, 2),
(41, '扫描费', 'SCANNING FEE', '', '', 3, 'active', 2, 2),
(42, '仓租', 'WAREHOUSE RENT', '', '', 6, 'active', 2, 2),
(43, '出仓费', 'OUTBOUND FEE', '', '', 7, 'active', 2, 2),
(44, '打托费', 'PALLETIZING FEE', '', '', 8, 'active', 2, 2),
(45, '换标签', 'RELABELING FEE', '', '', 9, 'active', 2, 2),
(46, '保险', 'INSURANCE', '', '', 1, 'active', 4, 2),
(47, '垫付费', 'ADVANCE PAYMENT FEE', '', '', 2, 'active', 4, 2),
(48, '银行手续费', 'BANK CHARGES', '', '', 3, 'active', 4, 2),
(49, '滞期费', 'DEMURRAGE', '', '', 4, 'active', 4, 2),
(50, '分拨费', 'DISTRIBUTION FEE', '', '', 5, 'active', 4, 2),
(51, '押金', 'DEPOSIT', '', '', 6, 'active', 4, 2),
(52, '超重费', 'OVERWEIGHT FEE', '', '', 7, 'active', 4, 2),
(53, '尾程运输', 'LAST MILE TRANSPORT', '', '', 1, 'active', 3, 2),
(54, '全程运输', 'FULL TRANSPORT', '', '', 2, 'active', 3, 2),
(55, '掏柜', 'DEVANNING', '', '', 3, 'active', 3, 2),
(56, '还柜费', 'CONTAINER RETURN FEE', '', '', 4, 'active', 3, 2),
(57, '铅封', 'SEAL', '', '', 5, 'active', 3, 2),
(58, 'T1转关', 'T1 TRANSIT', '', '', 6, 'active', 3, 2),
(59, '卡车租用', 'TRUCK RENTAL', '', '', 7, 'active', 3, 2),
(60, '超公里费', 'OVER-MILEAGE FEE', '', '', 8, 'active', 3, 2),
(61, '预约费', 'APPOINTMENT FEE', '', '', 9, 'active', 3, 2),
(62, '夜间运输', 'NIGHT TRANSPORT', '', '', 10, 'active', 3, 2),
(63, '周末运输', 'WEEKEND TRANSPORT', '', '', 11, 'active', 3, 2),
(64, '快递', 'EXPRESS DELIVERY', '', '', 12, 'active', 3, 2),
(65, '装卸搬运', 'HANDLING', '', '', 10, 'active', 2, 2),
(66, '理货服务', 'TALLYING SERVICE', '', '', 11, 'active', 2, 2),
(67, '查验加急费', 'INSPECTION RUSH FEE', '', '', 4, 'active', 5, 2),
(68, '绑扎费', 'LASHING FEE', '', '', 13, 'active', 3, 2),
(69, '提货费', 'PICKUP FEE', '', '', 14, 'active', 3, 2),
(70, '二次清关', 'SECOND CLEARANCE', '', '', 5, 'active', 5, 2),
(71, '转柜费', 'CONTAINER TRANSFER FEE', '', '', 15, 'active', 3, 2),
(72, '空跑费', 'EMPTY RUN FEE', '', '', 16, 'active', 3, 2);

-- 重置序列
SELECT setval('service_fee_categories_id_seq', (SELECT MAX(id) FROM service_fee_categories), true);

-- ==================== 5. 验证结果 ====================

SELECT '服务费类别总数: ' || COUNT(*) as result FROM service_fee_categories;
SELECT '一级分类数: ' || COUNT(*) as result FROM service_fee_categories WHERE level = 1;
SELECT '二级分类数: ' || COUNT(*) as result FROM service_fee_categories WHERE level = 2;

