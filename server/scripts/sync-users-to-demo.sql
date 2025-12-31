-- ==================== 同步生产环境用户和权限到演示环境 ====================
-- 执行方式：使用 psql 连接阿里云 RDS 演示数据库执行，或在阿里云 DMS 控制台执行
-- 数据库：logistics_quotation_db (测试环境数据库)
-- 执行时间：2025-12-24

-- ==================== 1. 清空现有数据（按依赖顺序）====================
DELETE FROM role_permissions;
DELETE FROM users WHERE username NOT IN ('admin'); -- 保留admin用户

-- ==================== 2. 同步角色表 ====================
-- 插入/更新角色（使用 UPSERT）
INSERT INTO roles (role_code, role_name, description, is_system, status, color_code, role_level, can_manage_team, can_approve, created_at, updated_at)
VALUES 
  ('admin', '系统管理员', '拥有所有权限，可管理用户和系统设置', 1, 'active', 'blue', 1, 1, 1, NOW(), NOW()),
  ('manager', '业务经理', '可查看所有订单，管理操作员', 1, 'active', 'blue', 3, 1, 1, NOW(), NOW()),
  ('operator', '操作员', '处理分配的订单，执行日常操作', 1, 'active', 'blue', 4, 0, 0, NOW(), NOW()),
  ('viewer', '查看者', '只能查看分配的订单，无法操作', 1, 'active', 'blue', 5, 0, 0, NOW(), NOW()),
  ('finance_manager', '财务经理', '', NULL, 'active', 'red', 3, 1, 1, NOW(), NOW()),
  ('do', '单证员', '', NULL, 'active', 'green', 99, 0, 0, NOW(), NOW()),
  ('czjl', '操作经理', '', NULL, 'active', 'orange', 3, 1, 1, NOW(), NOW()),
  ('boss', '老板', '', NULL, 'active', 'red', 2, 1, 1, NOW(), NOW()),
  ('finance', '财务助理', '', NULL, 'active', 'yellow', 99, 0, 0, NOW(), NOW())
ON CONFLICT (role_code) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  status = EXCLUDED.status,
  color_code = EXCLUDED.color_code,
  role_level = EXCLUDED.role_level,
  can_manage_team = EXCLUDED.can_manage_team,
  can_approve = EXCLUDED.can_approve,
  updated_at = NOW();

-- ==================== 3. 同步权限表 ====================
-- 清空并重新插入权限
DELETE FROM permissions;

INSERT INTO permissions (permission_code, permission_name, module, description, sort_order, category, is_sensitive, created_at) VALUES
('bill:view', '查看提单', 'order', '查看提单列表和详情', 100, 'order', 0, NOW()),
('bill:create', '创建提单', 'order', '创建新提单', 101, 'order', 0, NOW()),
('bill:edit', '编辑提单', 'order', '编辑提单信息', 102, 'order', 0, NOW()),
('bill:delete', '删除提单', 'order', '删除或作废提单', 103, 'order', 1, NOW()),
('bill:view_all', '查看所有提单', 'order', '查看所有人的提单（不限于分配的）', 104, 'order', 1, NOW()),
('inspection:view', '查看查验', 'inspection', '查看查验列表', 200, 'inspection', 0, NOW()),
('inspection:operate', '查验操作', 'inspection', '执行查验相关操作', 201, 'inspection', 0, NOW()),
('inspection:release', '查验放行', 'inspection', '查验放行', 302, 'inspection', 0, NOW()),
('cmr:view', '查看CMR', 'cmr', '查看CMR列表', 300, 'cmr', 0, NOW()),
('cmr:operate', 'CMR操作', 'cmr', '执行CMR派送操作', 301, 'cmr', 0, NOW()),
('tool:inquiry', '报价管理', 'tool', '访问报价管理功能', 400, 'tool', 0, NOW()),
('tool:tariff', '关税计算', 'tool', '访问关税计算功能', 401, 'tool', 0, NOW()),
('tool:payment', '付款发票', 'tool', '访问付款发票功能', 402, 'tool', 0, NOW()),
('tool:address', '地址税号', 'tool', '访问地址税号功能', 403, 'tool', 0, NOW()),
('tool:commodity', '海关编码', 'tool', '访问海关编码功能', 404, 'tool', 0, NOW()),
('tool:category', '品类库', 'tool', '访问品类库功能', 405, 'tool', 0, NOW()),
('tool:shared_tax', '共享税号库', 'tool', '共享税号库', 560, 'tool', 0, NOW()),
('system:menu', '板块开关', 'system', '管理系统菜单开关', 500, 'system', 1, NOW()),
('system:user', '用户管理', 'system', '管理用户账号', 501, 'system', 1, NOW()),
('system:logo', 'Logo管理', 'system', '管理系统Logo', 502, 'system', 0, NOW()),
('system:basic_data', '基础数据', 'system', '管理基础数据', 503, 'system', 0, NOW()),
('system:tariff_rate', '税率管理', 'system', '管理税率数据', 504, 'system', 0, NOW()),
('dashboard:view', '查看系统概览', 'system', '访问系统概览仪表盘', 10, 'system', 0, NOW()),
('bp:view', '查看BP View', 'system', '访问BP View页面', 11, 'system', 0, NOW()),
('system:message', '信息中心', 'system', '访问信息中心', 950, 'system', 0, NOW()),
('system:data_import', '数据导入', 'system', '执行数据导入', 951, 'system', 0, NOW()),
('system:security', '安全设置', 'system', '管理安全设置', 952, 'system', 1, NOW()),
('system:api_integrations', 'API对接管理', 'system', '管理API对接', 953, 'system', 1, NOW()),
('system:activity_log', '活动日志', 'system', '查看活动日志', 954, 'system', 0, NOW()),
('crm:view', '查看CRM', 'crm', '查看客户和商机', 150, 'crm', 0, NOW()),
('crm:customer_manage', '客户管理', 'crm', '管理客户', 151, 'crm', 0, NOW()),
('crm:opportunity_manage', '商机管理', 'crm', '管理商机', 152, 'crm', 0, NOW()),
('crm:quotation_manage', '报价管理', 'crm', '管理报价', 153, 'crm', 0, NOW()),
('crm:contract_manage', '合同管理', 'crm', '管理合同', 154, 'crm', 0, NOW()),
('crm:feedback_manage', '客户反馈', 'crm', '管理反馈', 155, 'crm', 0, NOW()),
('supplier:view', '查看供应商', 'supplier', '查看供应商', 180, 'supplier', 0, NOW()),
('supplier:manage', '管理供应商', 'supplier', '管理供应商', 181, 'supplier', 0, NOW()),
('supplier:price_import', '价格导入', 'supplier', '导入价格', 182, 'supplier', 0, NOW()),
('finance:view', '查看财务', 'finance', '查看财务', 600, 'finance', 0, NOW()),
('finance:invoice_view', '查看发票', 'finance', '查看发票', 601, 'finance', 0, NOW()),
('finance:invoice_create', '创建发票', 'finance', '创建发票', 602, 'finance', 0, NOW()),
('finance:invoice_edit', '编辑发票', 'finance', '编辑发票', 603, 'finance', 0, NOW()),
('finance:invoice_delete', '删除发票', 'finance', '删除发票', 604, 'finance', 1, NOW()),
('finance:payment_view', '查看收付款', 'finance', '查看收付款', 610, 'finance', 0, NOW()),
('finance:payment_register', '登记收付款', 'finance', '登记收付款', 611, 'finance', 0, NOW()),
('finance:payment_approve', '审批收付款', 'finance', '审批收付款', 612, 'finance', 1, NOW()),
('finance:report_view', '查看报表', 'finance', '查看报表', 620, 'finance', 0, NOW()),
('finance:report_export', '导出报表', 'finance', '导出报表', 621, 'finance', 1, NOW()),
('finance:statements', '财务报表', 'finance', '财务报表', 622, 'finance', 0, NOW()),
('finance:bank_manage', '银行管理', 'finance', '银行管理', 630, 'finance', 1, NOW()),
('finance:fee_manage', '费用管理', 'finance', '费用管理', 631, 'finance', 0, NOW()),
('document:view', '查看单证', 'document', '查看单证', 700, 'document', 0, NOW()),
('document:create', '创建单证', 'document', '创建单证', 701, 'document', 0, NOW()),
('document:edit', '编辑单证', 'document', '编辑单证', 702, 'document', 0, NOW()),
('document:delete', '删除单证', 'document', '删除单证', 703, 'document', 1, NOW()),
('document:import', '导入单证', 'document', '导入单证', 704, 'document', 0, NOW()),
('document:export', '导出单证', 'document', '导出单证', 705, 'document', 0, NOW()),
('document:match', '单证匹配', 'document', '单证匹配', 706, 'document', 0, NOW()),
('document:tax_calc', '税费计算', 'document', '税费计算', 707, 'document', 0, NOW()),
('document:supplement', '数据补充', 'document', '数据补充', 708, 'document', 0, NOW()),
('document:match_records', '匹配记录', 'document', '匹配记录', 709, 'document', 0, NOW()),
('tms:view', '查看TMS', 'tms', '查看TMS', 800, 'cmr', 0, NOW()),
('tms:track', '跟踪运输', 'tms', '跟踪运输', 801, 'cmr', 0, NOW()),
('tms:operate', 'TMS操作', 'tms', 'TMS操作', 802, 'cmr', 0, NOW()),
('tms:dispatch', '派车调度', 'tms', '派车调度', 803, 'cmr', 0, NOW()),
('tms:exception', '异常处理', 'tms', '异常处理', 804, 'cmr', 0, NOW()),
('tms:pricing', '运费管理', 'tms', '运费管理', 805, 'cmr', 0, NOW()),
('tms:conditions', '条件管理', 'tms', '条件管理', 806, 'cmr', 0, NOW()),
('tms:last_mile', '最后里程', 'tms', '最后里程', 807, 'cmr', 0, NOW()),
('product:view', '查看产品', 'product', '查看产品', 850, 'product', 0, NOW()),
('product:manage', '管理产品', 'product', '管理产品', 851, 'product', 0, NOW()),
('product:price_adjust', '价格调整', 'product', '价格调整', 852, 'product', 1, NOW()),
('approval:view', '查看审批', 'approval', '查看审批', 900, 'system', 0, NOW()),
('approval:submit', '提交审批', 'approval', '提交审批', 901, 'system', 0, NOW()),
('approval:approve', '审批操作', 'approval', '审批操作', 902, 'system', 1, NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  category = EXCLUDED.category,
  is_sensitive = EXCLUDED.is_sensitive;

-- ==================== 4. 同步角色权限关联 ====================
-- admin 角色权限 (75个)
INSERT INTO role_permissions (role_code, permission_code) VALUES
('admin', 'approval:approve'), ('admin', 'approval:submit'), ('admin', 'approval:view'),
('admin', 'bill:create'), ('admin', 'bill:delete'), ('admin', 'bill:edit'), ('admin', 'bill:view'), ('admin', 'bill:view_all'),
('admin', 'bp:view'), ('admin', 'cmr:operate'), ('admin', 'cmr:view'),
('admin', 'crm:contract_manage'), ('admin', 'crm:customer_manage'), ('admin', 'crm:feedback_manage'),
('admin', 'crm:opportunity_manage'), ('admin', 'crm:quotation_manage'), ('admin', 'crm:view'),
('admin', 'dashboard:view'),
('admin', 'document:create'), ('admin', 'document:delete'), ('admin', 'document:edit'), ('admin', 'document:export'),
('admin', 'document:import'), ('admin', 'document:match'), ('admin', 'document:match_records'),
('admin', 'document:supplement'), ('admin', 'document:tax_calc'), ('admin', 'document:view'),
('admin', 'finance:bank_manage'), ('admin', 'finance:fee_manage'), ('admin', 'finance:invoice_create'),
('admin', 'finance:invoice_delete'), ('admin', 'finance:invoice_edit'), ('admin', 'finance:invoice_view'),
('admin', 'finance:payment_approve'), ('admin', 'finance:payment_register'), ('admin', 'finance:payment_view'),
('admin', 'finance:report_export'), ('admin', 'finance:report_view'), ('admin', 'finance:statements'), ('admin', 'finance:view'),
('admin', 'inspection:operate'), ('admin', 'inspection:release'), ('admin', 'inspection:view'),
('admin', 'product:manage'), ('admin', 'product:price_adjust'), ('admin', 'product:view'),
('admin', 'supplier:manage'), ('admin', 'supplier:price_import'), ('admin', 'supplier:view'),
('admin', 'system:activity_log'), ('admin', 'system:api_integrations'), ('admin', 'system:basic_data'),
('admin', 'system:data_import'), ('admin', 'system:logo'), ('admin', 'system:menu'),
('admin', 'system:message'), ('admin', 'system:security'), ('admin', 'system:tariff_rate'), ('admin', 'system:user'),
('admin', 'tms:conditions'), ('admin', 'tms:dispatch'), ('admin', 'tms:exception'), ('admin', 'tms:last_mile'),
('admin', 'tms:operate'), ('admin', 'tms:pricing'), ('admin', 'tms:track'), ('admin', 'tms:view'),
('admin', 'tool:address'), ('admin', 'tool:category'), ('admin', 'tool:commodity'),
('admin', 'tool:inquiry'), ('admin', 'tool:payment'), ('admin', 'tool:shared_tax'), ('admin', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- boss 角色权限 (与admin相同)
INSERT INTO role_permissions (role_code, permission_code) VALUES
('boss', 'approval:approve'), ('boss', 'approval:submit'), ('boss', 'approval:view'),
('boss', 'bill:create'), ('boss', 'bill:delete'), ('boss', 'bill:edit'), ('boss', 'bill:view'), ('boss', 'bill:view_all'),
('boss', 'bp:view'), ('boss', 'cmr:operate'), ('boss', 'cmr:view'),
('boss', 'crm:contract_manage'), ('boss', 'crm:customer_manage'), ('boss', 'crm:feedback_manage'),
('boss', 'crm:opportunity_manage'), ('boss', 'crm:quotation_manage'), ('boss', 'crm:view'),
('boss', 'dashboard:view'),
('boss', 'document:create'), ('boss', 'document:delete'), ('boss', 'document:edit'), ('boss', 'document:export'),
('boss', 'document:import'), ('boss', 'document:match'), ('boss', 'document:match_records'),
('boss', 'document:supplement'), ('boss', 'document:tax_calc'), ('boss', 'document:view'),
('boss', 'finance:bank_manage'), ('boss', 'finance:fee_manage'), ('boss', 'finance:invoice_create'),
('boss', 'finance:invoice_delete'), ('boss', 'finance:invoice_edit'), ('boss', 'finance:invoice_view'),
('boss', 'finance:payment_approve'), ('boss', 'finance:payment_register'), ('boss', 'finance:payment_view'),
('boss', 'finance:report_export'), ('boss', 'finance:report_view'), ('boss', 'finance:statements'), ('boss', 'finance:view'),
('boss', 'inspection:operate'), ('boss', 'inspection:release'), ('boss', 'inspection:view'),
('boss', 'product:manage'), ('boss', 'product:price_adjust'), ('boss', 'product:view'),
('boss', 'supplier:manage'), ('boss', 'supplier:price_import'), ('boss', 'supplier:view'),
('boss', 'system:activity_log'), ('boss', 'system:api_integrations'), ('boss', 'system:basic_data'),
('boss', 'system:data_import'), ('boss', 'system:logo'), ('boss', 'system:menu'),
('boss', 'system:message'), ('boss', 'system:security'), ('boss', 'system:tariff_rate'), ('boss', 'system:user'),
('boss', 'tms:conditions'), ('boss', 'tms:dispatch'), ('boss', 'tms:exception'), ('boss', 'tms:last_mile'),
('boss', 'tms:operate'), ('boss', 'tms:pricing'), ('boss', 'tms:track'), ('boss', 'tms:view'),
('boss', 'tool:address'), ('boss', 'tool:category'), ('boss', 'tool:commodity'),
('boss', 'tool:inquiry'), ('boss', 'tool:payment'), ('boss', 'tool:shared_tax'), ('boss', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- finance_manager 角色权限 (与boss相同)
INSERT INTO role_permissions (role_code, permission_code) VALUES
('finance_manager', 'approval:approve'), ('finance_manager', 'approval:submit'), ('finance_manager', 'approval:view'),
('finance_manager', 'bill:create'), ('finance_manager', 'bill:delete'), ('finance_manager', 'bill:edit'), ('finance_manager', 'bill:view'), ('finance_manager', 'bill:view_all'),
('finance_manager', 'bp:view'), ('finance_manager', 'cmr:operate'), ('finance_manager', 'cmr:view'),
('finance_manager', 'crm:contract_manage'), ('finance_manager', 'crm:customer_manage'), ('finance_manager', 'crm:feedback_manage'),
('finance_manager', 'crm:opportunity_manage'), ('finance_manager', 'crm:quotation_manage'), ('finance_manager', 'crm:view'),
('finance_manager', 'dashboard:view'),
('finance_manager', 'document:create'), ('finance_manager', 'document:delete'), ('finance_manager', 'document:edit'), ('finance_manager', 'document:export'),
('finance_manager', 'document:import'), ('finance_manager', 'document:match'), ('finance_manager', 'document:match_records'),
('finance_manager', 'document:supplement'), ('finance_manager', 'document:tax_calc'), ('finance_manager', 'document:view'),
('finance_manager', 'finance:bank_manage'), ('finance_manager', 'finance:fee_manage'), ('finance_manager', 'finance:invoice_create'),
('finance_manager', 'finance:invoice_delete'), ('finance_manager', 'finance:invoice_edit'), ('finance_manager', 'finance:invoice_view'),
('finance_manager', 'finance:payment_approve'), ('finance_manager', 'finance:payment_register'), ('finance_manager', 'finance:payment_view'),
('finance_manager', 'finance:report_export'), ('finance_manager', 'finance:report_view'), ('finance_manager', 'finance:statements'), ('finance_manager', 'finance:view'),
('finance_manager', 'inspection:operate'), ('finance_manager', 'inspection:release'), ('finance_manager', 'inspection:view'),
('finance_manager', 'product:manage'), ('finance_manager', 'product:price_adjust'), ('finance_manager', 'product:view'),
('finance_manager', 'supplier:manage'), ('finance_manager', 'supplier:price_import'), ('finance_manager', 'supplier:view'),
('finance_manager', 'system:activity_log'), ('finance_manager', 'system:api_integrations'), ('finance_manager', 'system:basic_data'),
('finance_manager', 'system:data_import'), ('finance_manager', 'system:logo'), ('finance_manager', 'system:menu'),
('finance_manager', 'system:message'), ('finance_manager', 'system:security'), ('finance_manager', 'system:tariff_rate'), ('finance_manager', 'system:user'),
('finance_manager', 'tms:conditions'), ('finance_manager', 'tms:dispatch'), ('finance_manager', 'tms:exception'), ('finance_manager', 'tms:last_mile'),
('finance_manager', 'tms:operate'), ('finance_manager', 'tms:pricing'), ('finance_manager', 'tms:track'), ('finance_manager', 'tms:view'),
('finance_manager', 'tool:address'), ('finance_manager', 'tool:category'), ('finance_manager', 'tool:commodity'),
('finance_manager', 'tool:inquiry'), ('finance_manager', 'tool:payment'), ('finance_manager', 'tool:shared_tax'), ('finance_manager', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- czjl (操作经理) 角色权限
INSERT INTO role_permissions (role_code, permission_code) VALUES
('czjl', 'bill:create'), ('czjl', 'bill:delete'), ('czjl', 'bill:edit'), ('czjl', 'bill:view'), ('czjl', 'bill:view_all'),
('czjl', 'bp:view'), ('czjl', 'cmr:operate'), ('czjl', 'cmr:view'),
('czjl', 'crm:contract_manage'), ('czjl', 'crm:customer_manage'), ('czjl', 'crm:feedback_manage'),
('czjl', 'crm:opportunity_manage'), ('czjl', 'crm:quotation_manage'), ('czjl', 'crm:view'),
('czjl', 'dashboard:view'), ('czjl', 'document:match_records'), ('czjl', 'document:supplement'), ('czjl', 'document:view'),
('czjl', 'inspection:operate'), ('czjl', 'inspection:release'), ('czjl', 'inspection:view'),
('czjl', 'product:manage'), ('czjl', 'product:price_adjust'), ('czjl', 'product:view'),
('czjl', 'supplier:manage'), ('czjl', 'supplier:price_import'), ('czjl', 'supplier:view'),
('czjl', 'system:message'),
('czjl', 'tms:conditions'), ('czjl', 'tms:dispatch'), ('czjl', 'tms:exception'), ('czjl', 'tms:last_mile'),
('czjl', 'tms:operate'), ('czjl', 'tms:pricing'), ('czjl', 'tms:track'), ('czjl', 'tms:view'),
('czjl', 'tool:address'), ('czjl', 'tool:category'), ('czjl', 'tool:commodity'),
('czjl', 'tool:inquiry'), ('czjl', 'tool:payment'), ('czjl', 'tool:shared_tax'), ('czjl', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- manager (业务经理) 角色权限
INSERT INTO role_permissions (role_code, permission_code) VALUES
('manager', 'bill:create'), ('manager', 'bill:delete'), ('manager', 'bill:edit'), ('manager', 'bill:view'), ('manager', 'bill:view_all'),
('manager', 'bp:view'), ('manager', 'cmr:operate'), ('manager', 'cmr:view'),
('manager', 'crm:contract_manage'), ('manager', 'crm:customer_manage'), ('manager', 'crm:feedback_manage'),
('manager', 'crm:opportunity_manage'), ('manager', 'crm:quotation_manage'), ('manager', 'crm:view'),
('manager', 'dashboard:view'), ('manager', 'document:match_records'), ('manager', 'document:supplement'), ('manager', 'document:view'),
('manager', 'inspection:operate'), ('manager', 'inspection:release'), ('manager', 'inspection:view'),
('manager', 'product:manage'), ('manager', 'product:price_adjust'), ('manager', 'product:view'),
('manager', 'supplier:manage'), ('manager', 'supplier:price_import'), ('manager', 'supplier:view'),
('manager', 'system:message'),
('manager', 'tms:conditions'), ('manager', 'tms:dispatch'), ('manager', 'tms:exception'), ('manager', 'tms:last_mile'),
('manager', 'tms:operate'), ('manager', 'tms:pricing'), ('manager', 'tms:track'), ('manager', 'tms:view'),
('manager', 'tool:address'), ('manager', 'tool:category'), ('manager', 'tool:commodity'),
('manager', 'tool:inquiry'), ('manager', 'tool:payment'), ('manager', 'tool:shared_tax'), ('manager', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- do (单证员) 角色权限
INSERT INTO role_permissions (role_code, permission_code) VALUES
('do', 'bill:create'), ('do', 'bill:edit'), ('do', 'bill:view'), ('do', 'bill:view_all'),
('do', 'bp:view'), ('do', 'dashboard:view'),
('do', 'document:create'), ('do', 'document:delete'), ('do', 'document:edit'), ('do', 'document:export'),
('do', 'document:import'), ('do', 'document:match'), ('do', 'document:match_records'),
('do', 'document:supplement'), ('do', 'document:tax_calc'), ('do', 'document:view'),
('do', 'system:message'), ('do', 'tool:shared_tax'), ('do', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- finance (财务助理) 角色权限
INSERT INTO role_permissions (role_code, permission_code) VALUES
('finance', 'bp:view'),
('finance', 'finance:bank_manage'), ('finance', 'finance:fee_manage'),
('finance', 'finance:invoice_create'), ('finance', 'finance:invoice_delete'), ('finance', 'finance:invoice_edit'), ('finance', 'finance:invoice_view'),
('finance', 'finance:payment_approve'), ('finance', 'finance:payment_register'), ('finance', 'finance:payment_view'),
('finance', 'finance:view'),
('finance', 'system:basic_data'), ('finance', 'system:tariff_rate')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- operator (操作员) 角色权限
INSERT INTO role_permissions (role_code, permission_code) VALUES
('operator', 'bill:create'), ('operator', 'bill:edit'), ('operator', 'bill:view'), ('operator', 'bill:view_all'),
('operator', 'bp:view'), ('operator', 'cmr:operate'), ('operator', 'cmr:view'),
('operator', 'crm:contract_manage'), ('operator', 'crm:customer_manage'),
('operator', 'crm:opportunity_manage'), ('operator', 'crm:quotation_manage'), ('operator', 'crm:view'),
('operator', 'dashboard:view'),
('operator', 'inspection:operate'), ('operator', 'inspection:release'), ('operator', 'inspection:view'),
('operator', 'product:manage'), ('operator', 'product:price_adjust'), ('operator', 'product:view'),
('operator', 'supplier:manage'), ('operator', 'supplier:price_import'), ('operator', 'supplier:view'),
('operator', 'system:message'),
('operator', 'tms:dispatch'), ('operator', 'tms:exception'), ('operator', 'tms:operate'),
('operator', 'tms:pricing'), ('operator', 'tms:track'), ('operator', 'tms:view'),
('operator', 'tool:address'), ('operator', 'tool:category'), ('operator', 'tool:commodity'),
('operator', 'tool:inquiry'), ('operator', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- viewer (查看者) 角色权限
INSERT INTO role_permissions (role_code, permission_code) VALUES
('viewer', 'bill:view'), ('viewer', 'cmr:view'), ('viewer', 'inspection:view'),
('viewer', 'tool:commodity'), ('viewer', 'tool:inquiry'), ('viewer', 'tool:tariff')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================== 5. 同步用户（先插入无 supervisor_id 依赖的用户）====================
-- 更新 admin 用户
UPDATE users SET 
  name = '系统管理员',
  email = 'admin@xianfenghk.com',
  role = 'admin',
  status = 'active',
  department = '',
  position = '',
  updated_at = NOW()
WHERE username = 'admin';

-- 插入无上级的用户
INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
VALUES 
  ('manager', '21bec725394fa5140d0395ee9ffa03c8aca23f5e042c7e581d2685ef1604b82a', '业务经理', 'manager@xianfenghk.com', '13800138001', 'manager', 'active', '', '', NULL, NOW(), NOW()),
  ('operator2', '39e832992b971dc958bcd8f33fd1e84da9967e4a6dc162a01eee0bc50d27d17c', '操作员2', 'op2@xianfenghk.com', '13800138003', 'operator', 'active', '', '', NULL, NOW(), NOW()),
  ('viewer1', '8a0d7e4846a66141438a36bc8ffc2540d5c300378eeb81ed257159ce7dcb61b2', '查看者', 'viewer@xianfenghk.com', '13800138004', 'viewer', 'active', '', '', NULL, NOW(), NOW()),
  ('ZF', '9072c01005319dd3dc4417164cf82c21925bc61d03e8823a9348e5ec1545b107', '郑锋', '', '', 'boss', 'active', '', '', NULL, NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  updated_at = NOW();

-- 插入有上级依赖的用户（需要先获取 ZF 的 id）
DO $$
DECLARE
  v_zf_id INTEGER;
  v_zrz_id INTEGER;
  v_qqq_id INTEGER;
BEGIN
  -- 获取 ZF(郑锋) 的 id
  SELECT id INTO v_zf_id FROM users WHERE username = 'ZF';
  
  -- 插入/更新 QQQ(覃茜茜) - 上级是 ZF
  INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
  VALUES ('QQQ', 'ce7353f35af2bcb19e4e1fd8c3921d0c5e142098b403ea0af81e10c1e283e6e1', '覃茜茜', '', '', 'czjl', 'active', '操作部门', '运营', v_zf_id, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
    department = EXCLUDED.department, position = EXCLUDED.position, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();
  
  -- 获取 QQQ 的 id
  SELECT id INTO v_qqq_id FROM users WHERE username = 'QQQ';
  
  -- 插入/更新 ZRZ(张若芝) - 上级是 ZF
  INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
  VALUES ('ZRZ', '09f2a11c4c9d163c64d2dd5eecfa3da5dea01dd4f574f2e60d45f191eb267cfd', '张若芝', '', '', 'finance_manager', 'active', '财务部门', '财务经理', v_zf_id, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
    department = EXCLUDED.department, position = EXCLUDED.position, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();
  
  -- 获取 ZRZ 的 id
  SELECT id INTO v_zrz_id FROM users WHERE username = 'ZRZ';
  
  -- 插入/更新 HBR(黄蓓茹) - 上级是 QQQ
  INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
  VALUES ('HBR', 'b7c0ec2f93d9a2dc948e0b02e776574bb9bbd21b5451ecda1ba84ddc48e2fe2d', '黄蓓茹', '', '', 'operator', 'active', '操作部门', '跟单员', v_qqq_id, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
    department = EXCLUDED.department, position = EXCLUDED.position, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();
  
  -- 插入/更新 WTX(伍童欣) - 上级是 QQQ
  INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
  VALUES ('WTX', '5d944988c217e51cc45876e4008af9b38f700677ecbe85b815c3461c7e88e550', '伍童欣', '', '', 'do', 'active', '操作部门', '单证员', v_qqq_id, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
    department = EXCLUDED.department, position = EXCLUDED.position, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();
  
  -- 插入/更新 HWK(何汶珂) - 上级是 QQQ
  INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
  VALUES ('HWK', '9b9dbda8082de37c035fd598b413e091ad3f6086f525aab1530ba091d517eac7', '何汶珂', '', '', 'operator', 'active', '操作部门', '跟单员', v_qqq_id, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
    department = EXCLUDED.department, position = EXCLUDED.position, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();
  
  -- 插入/更新 ZMY(朱梦雅) - 上级是 ZRZ
  INSERT INTO users (username, password_hash, name, email, phone, role, status, department, position, supervisor_id, created_at, updated_at)
  VALUES ('ZMY', '8c62f6b9b0f7464f63696013380201c878e913b253cbf39ef78f89cc20d5bb1b', '朱梦雅', '', '', 'finance', 'active', '财务部门', '财务助理', v_zrz_id, NOW(), NOW())
  ON CONFLICT (username) DO UPDATE SET
    name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
    department = EXCLUDED.department, position = EXCLUDED.position, supervisor_id = EXCLUDED.supervisor_id, updated_at = NOW();

END $$;

-- ==================== 6. 重置序列 ====================
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1));
SELECT setval('permissions_id_seq', COALESCE((SELECT MAX(id) FROM permissions), 1));
SELECT setval('role_permissions_id_seq', COALESCE((SELECT MAX(id) FROM role_permissions), 1));

-- ==================== 完成 ====================
SELECT '同步完成！' AS message;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS role_count FROM roles;
SELECT COUNT(*) AS permission_count FROM permissions;
SELECT COUNT(*) AS role_permission_count FROM role_permissions;

