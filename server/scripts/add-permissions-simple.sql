-- ==================== 生产环境：添加缺失权限（简化版） ====================
-- 说明: 不依赖唯一约束，直接插入缺失的权限

-- 1. 先添加唯一约束
ALTER TABLE permissions ADD CONSTRAINT permissions_permission_code_key UNIQUE (permission_code);

-- 2. 系统管理权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('dashboard:view', '查看系统概览', 'system', 'system', '访问系统概览仪表盘', 10, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('bp:view', '查看BP View', 'system', 'system', '访问BP View页面', 11, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('system:message', '信息中心', 'system', 'system', '访问信息中心', 950, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('system:data_import', '数据导入', 'system', 'system', '执行数据导入', 951, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('system:security', '安全设置', 'system', 'system', '管理安全设置', 952, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('system:api_integrations', 'API对接管理', 'system', 'system', '管理API对接', 953, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('system:activity_log', '活动日志', 'system', 'system', '查看活动日志', 954, 0);

-- 3. CRM权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('crm:view', '查看CRM', 'crm', 'crm', '查看客户和商机', 150, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('crm:customer_manage', '客户管理', 'crm', 'crm', '管理客户', 151, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('crm:opportunity_manage', '商机管理', 'crm', 'crm', '管理商机', 152, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('crm:quotation_manage', '报价管理', 'crm', 'crm', '管理报价', 153, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('crm:contract_manage', '合同管理', 'crm', 'crm', '管理合同', 154, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('crm:feedback_manage', '客户反馈', 'crm', 'crm', '管理反馈', 155, 0);

-- 4. 供应商权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('supplier:view', '查看供应商', 'supplier', 'supplier', '查看供应商', 180, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('supplier:manage', '管理供应商', 'supplier', 'supplier', '管理供应商', 181, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('supplier:price_import', '价格导入', 'supplier', 'supplier', '导入价格', 182, 0);

-- 5. 财务权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:view', '查看财务', 'finance', 'finance', '查看财务', 600, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:invoice_view', '查看发票', 'finance', 'finance', '查看发票', 601, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:invoice_create', '创建发票', 'finance', 'finance', '创建发票', 602, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:invoice_edit', '编辑发票', 'finance', 'finance', '编辑发票', 603, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:invoice_delete', '删除发票', 'finance', 'finance', '删除发票', 604, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:payment_view', '查看收付款', 'finance', 'finance', '查看收付款', 610, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:payment_register', '登记收付款', 'finance', 'finance', '登记收付款', 611, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:payment_approve', '审批收付款', 'finance', 'finance', '审批收付款', 612, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:report_view', '查看报表', 'finance', 'finance', '查看报表', 620, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:report_export', '导出报表', 'finance', 'finance', '导出报表', 621, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:statements', '财务报表', 'finance', 'finance', '财务报表', 622, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:bank_manage', '银行管理', 'finance', 'finance', '银行管理', 630, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('finance:fee_manage', '费用管理', 'finance', 'finance', '费用管理', 631, 0);

-- 6. 单证权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:view', '查看单证', 'document', 'document', '查看单证', 700, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:create', '创建单证', 'document', 'document', '创建单证', 701, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:edit', '编辑单证', 'document', 'document', '编辑单证', 702, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:delete', '删除单证', 'document', 'document', '删除单证', 703, 1);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:import', '导入单证', 'document', 'document', '导入单证', 704, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:export', '导出单证', 'document', 'document', '导出单证', 705, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:match', '单证匹配', 'document', 'document', '单证匹配', 706, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:tax_calc', '税费计算', 'document', 'document', '税费计算', 707, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:supplement', '数据补充', 'document', 'document', '数据补充', 708, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('document:match_records', '匹配记录', 'document', 'document', '匹配记录', 709, 0);

-- 7. TMS权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:view', '查看TMS', 'tms', 'cmr', '查看TMS', 800, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:track', '跟踪运输', 'tms', 'cmr', '跟踪运输', 801, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:operate', 'TMS操作', 'tms', 'cmr', 'TMS操作', 802, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:dispatch', '派车调度', 'tms', 'cmr', '派车调度', 803, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:exception', '异常处理', 'tms', 'cmr', '异常处理', 804, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:pricing', '运费管理', 'tms', 'cmr', '运费管理', 805, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:conditions', '条件管理', 'tms', 'cmr', '条件管理', 806, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tms:last_mile', '最后里程', 'tms', 'cmr', '最后里程', 807, 0);

-- 8. 产品权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('product:view', '查看产品', 'product', 'product', '查看产品', 850, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('product:manage', '管理产品', 'product', 'product', '管理产品', 851, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('product:price_adjust', '价格调整', 'product', 'product', '价格调整', 852, 1);

-- 9. 查验权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('inspection:release', '查验放行', 'inspection', 'inspection', '查验放行', 302, 0);

-- 10. 审批权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('approval:view', '查看审批', 'approval', 'system', '查看审批', 900, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('approval:submit', '提交审批', 'approval', 'system', '提交审批', 901, 0);
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('approval:approve', '审批操作', 'approval', 'system', '审批操作', 902, 1);

-- 11. 工具权限
INSERT INTO permissions (permission_code, permission_name, module, category, description, sort_order, is_sensitive) VALUES ('tool:shared_tax', '共享税号库', 'tool', 'tool', '共享税号库', 560, 0);

-- 12. 为管理员添加所有权限
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', permission_code FROM permissions
WHERE permission_code NOT IN (SELECT permission_code FROM role_permissions WHERE role_code = 'admin');

-- 完成
SELECT COUNT(*) AS total_permissions FROM permissions;

