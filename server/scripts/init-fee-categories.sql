-- 初始化服务费类别基础数据
-- 用于费用管理模块的费用分类

-- 先清空现有数据（如果有的话）
-- DELETE FROM service_fee_categories;

-- 插入标准费用分类
INSERT INTO service_fee_categories (name, code, description, sort_order, status) VALUES
('运输服务', 'transport', '陆运、海运、空运等运输相关费用', 1, 'active'),
('报关/清关', 'clearance', '报关、清关、商检等费用', 2, 'active'),
('仓储服务', 'warehouse', '仓储、装卸、分拣等费用', 3, 'active'),
('税费', 'tax', '关税、增值税、消费税等', 4, 'active'),
('港杂费', 'thc', 'THC、码头操作费等港口相关费用', 5, 'active'),
('换单费', 'exchange', '换单、提单、文件处理等费用', 6, 'active'),
('代理费', 'agency', '代理服务、代办手续等费用', 7, 'active'),
('文件费', 'document', '单证费、文件处理费等', 8, 'active'),
('管理费', 'management', '管理费、手续费等', 9, 'active'),
('其他服务', 'other', '其他未分类费用', 99, 'active')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  updated_at = CURRENT_TIMESTAMP;

-- 查看结果
SELECT * FROM service_fee_categories ORDER BY sort_order;

