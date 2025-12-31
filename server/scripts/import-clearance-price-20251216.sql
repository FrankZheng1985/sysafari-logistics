-- ============================================================
-- 欧洲自税清关服务报价导入脚本
-- 报价表: 报价表-12.16 生效(1).pdf
-- 生效日期: 2025-12-16
-- 产品ID: ed0d483d-7693-480d-be6c-ed668e2fa620 (PRD0004 欧洲自税清关服务)
-- ============================================================

-- 开始事务
BEGIN;

-- 先删除该产品的现有费用项（全量替换）
DELETE FROM product_fee_items WHERE product_id = 'ed0d483d-7693-480d-be6c-ed668e2fa620';

-- ==================== 海运整柜/铁路整柜进口操作 ====================
INSERT INTO product_fee_items (
  product_id, fee_name, fee_name_en, fee_category, unit, 
  standard_price, currency, is_required, description, billing_type, 
  cost_price, profit_type, profit_value, sort_order, created_at, updated_at
) VALUES
-- 码头处理费 THC (仅限海运)
('ed0d483d-7693-480d-be6c-ed668e2fa620', '码头处理费（THC）ISPS 20FT', 'THC ISPS 20FT (Sea Only)', '港口费用', '柜', 
  0, 'EUR', 0, '仅限海运，实报实销', 'actual', 0, 'amount', 0, 1, NOW(), NOW()),

('ed0d483d-7693-480d-be6c-ed668e2fa620', '码头处理费（THC）ISPS 40FT/HQ', 'THC ISPS 40FT/HQ (Sea Only)', '港口费用', '柜', 
  0, 'EUR', 0, '仅限海运，实报实销', 'actual', 0, 'amount', 0, 2, NOW(), NOW()),

('ed0d483d-7693-480d-be6c-ed668e2fa620', '码头处理费（THC）ISPS 45FT/HQ', 'THC ISPS 45FT/HQ (Sea Only)', '港口费用', '柜', 
  0, 'EUR', 0, '仅限海运，实报实销', 'actual', 0, 'amount', 0, 3, NOW(), NOW()),

-- 提单管理费
('ed0d483d-7693-480d-be6c-ed668e2fa620', '提单管理费', 'B/L Management Fee', '文件费', '提单/订单', 
  60, 'EUR', 1, '', 'fixed', 50, 'amount', 10, 4, NOW(), NOW()),

-- ==================== 海运、铁路、卡航清关和递延服务 ====================
-- 关税
('ed0d483d-7693-480d-be6c-ed668e2fa620', '关税', 'Import Duties', '税务费', '清关申报', 
  0, 'EUR', 0, '实报实销', 'actual', 0, 'amount', 0, 10, NOW(), NOW()),

-- 本土清关（含10个HS Code）
('ed0d483d-7693-480d-be6c-ed668e2fa620', '本土清关费', 'Local Customs Clearance Fee', '清关服务', '提单/订单', 
  155, 'EUR', 0, '含10个HS Code', 'fixed', 100, 'amount', 55, 11, NOW(), NOW()),

-- 离岸税号（含10个HS Code）
('ed0d483d-7693-480d-be6c-ed668e2fa620', '离岸税号清关费', 'Offshore Tax ID Clearance Fee', '清关服务', '提单/订单', 
  175, 'EUR', 0, '含10个HS Code', 'fixed', 150, 'amount', 25, 12, NOW(), NOW()),

-- 一个提单多个柜子（第二个柜子起）
('ed0d483d-7693-480d-be6c-ed668e2fa620', '多柜附加清关费', 'Additional Container Clearance Fee', '清关服务', '每柜', 
  155, 'EUR', 0, '一个提单多个柜子，第二个柜子起', 'fixed', 100, 'amount', 55, 13, NOW(), NOW()),

-- 税务代理服务
('ed0d483d-7693-480d-be6c-ed668e2fa620', '税务代理服务', 'Tax Agency Service', '清关服务', '清关申报', 
  200, 'EUR', 1, '', 'fixed', 150, 'amount', 50, 14, NOW(), NOW()),

-- 多个进口VAT申报
('ed0d483d-7693-480d-be6c-ed668e2fa620', '多个进口VAT申报', 'Multiple Import VAT Declaration', '税务费', '每分单', 
  155, 'EUR', 0, '', 'fixed', 100, 'amount', 55, 15, NOW(), NOW()),

-- 进口商
('ed0d483d-7693-480d-be6c-ed668e2fa620', '进口商服务费', 'Importer Service Fee', '清关服务', '票', 
  800, 'EUR', 0, '', 'fixed', 600, 'amount', 200, 16, NOW(), NOW()),

-- ==================== 额外费用 ====================
-- 提前X光扫描
('ed0d483d-7693-480d-be6c-ed668e2fa620', '提前X光扫描', 'Pre-arrival X-ray Scanning', '查验费用', '柜', 
  750, 'EUR', 0, '到港前的海关查验', 'fixed', 600, 'amount', 150, 20, NOW(), NOW()),

-- 海关申报查验协助费用
('ed0d483d-7693-480d-be6c-ed668e2fa620', '海关申报查验协助费', 'Customs Declaration Inspection Assistance', '查验费用', '产品', 
  60, 'EUR', 0, '', 'fixed', 40, 'amount', 20, 21, NOW(), NOW()),

-- 集装箱气体检测
('ed0d483d-7693-480d-be6c-ed668e2fa620', '集装箱气体检测', 'Container Gas Testing', '查验费用', '柜', 
  0, 'EUR', 0, '实报实销', 'actual', 0, 'amount', 0, 22, NOW(), NOW()),

-- 仓库查验费（卸柜费）
('ed0d483d-7693-480d-be6c-ed668e2fa620', '仓库查验费', 'Warehouse Inspection Fee', '查验费用', '柜', 
  650, 'EUR', 0, '卸柜费', 'fixed', 500, 'amount', 150, 23, NOW(), NOW()),

-- 安排T1文件
('ed0d483d-7693-480d-be6c-ed668e2fa620', '安排T1文件', 'T1 Document Arrangement', '文件费', '文件', 
  85, 'EUR', 0, '', 'fixed', 60, 'amount', 25, 24, NOW(), NOW()),

-- 海关罚款
('ed0d483d-7693-480d-be6c-ed668e2fa620', '海关罚款', 'Customs Penalty', '罚款', '案件', 
  0, 'EUR', 0, '实报实销', 'actual', 0, 'amount', 0, 25, NOW(), NOW()),

-- 文件错误/瞒报/其他海关违规申报
('ed0d483d-7693-480d-be6c-ed668e2fa620', '文件错误/违规申报处理费', 'Document Error/Customs Violation Fee', '罚款', '案件', 
  250, 'EUR', 0, '瞒报及其他海关违规申报', 'fixed', 200, 'amount', 50, 26, NOW(), NOW()),

-- 海关重新申报
('ed0d483d-7693-480d-be6c-ed668e2fa620', '海关重新申报', 'Customs Re-declaration', '清关服务', '清关申报', 
  180, 'EUR', 0, '', 'fixed', 120, 'amount', 60, 27, NOW(), NOW()),

-- 10个以上HS Code
('ed0d483d-7693-480d-be6c-ed668e2fa620', '额外HS Code费', 'Additional HS Code Fee', '文件费', 'HS Code', 
  8, 'EUR', 0, '10个以上HS Code，每个', 'fixed', 6, 'amount', 2, 28, NOW(), NOW()),

-- 清关事宜人工咨询费
('ed0d483d-7693-480d-be6c-ed668e2fa620', '清关咨询费', 'Customs Consultation Fee', '服务费', '小时', 
  120, 'EUR', 0, '清关事宜人工咨询', 'fixed', 80, 'amount', 40, 29, NOW(), NOW()),

-- 卡车停靠清关费
('ed0d483d-7693-480d-be6c-ed668e2fa620', '卡车停靠清关费', 'Truck Parking Clearance Fee', '清关服务', '车', 
  100, 'EUR', 0, '', 'fixed', 70, 'amount', 30, 30, NOW(), NOW());

-- 提交事务
COMMIT;

-- 验证导入结果
SELECT 
  fee_name,
  fee_name_en,
  fee_category,
  unit,
  standard_price,
  currency,
  description,
  billing_type,
  cost_price,
  sort_order
FROM product_fee_items 
WHERE product_id = 'ed0d483d-7693-480d-be6c-ed668e2fa620'
ORDER BY sort_order;

