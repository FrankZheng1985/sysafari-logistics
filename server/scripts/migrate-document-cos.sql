-- ==================== 文档管理COS升级迁移脚本 ====================
-- 版本: 1.0.0
-- 日期: 2024-12-20
-- 说明: 升级documents表结构，支持腾讯云COS存储和订单关联

-- ==================== 1. 添加COS存储相关字段 ====================

-- COS对象Key（存储路径）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cos_key TEXT;

-- COS访问URL
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cos_url TEXT;

-- 存储桶名称
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cos_bucket TEXT;

-- 存储区域
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cos_region TEXT;

-- ==================== 2. 添加文件元数据字段 ====================

-- 文档名称（显示名称）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_name TEXT;

-- 原始文件名
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_name TEXT;

-- 文件大小（字节）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;

-- MIME类型
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 文件扩展名
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_extension TEXT;

-- ==================== 3. 添加订单关联字段 ====================

-- 关联订单号（冗余存储，便于查询）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS bill_number TEXT;

-- 客户名称（冗余存储）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- ==================== 4. 添加权限控制字段 ====================

-- 访问级别: order_related(订单相关人员), finance(财务), admin(管理员)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'order_related';

-- 是否公开（订单相关人员都可见）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- ==================== 5. 添加上传者信息字段 ====================

-- 上传人ID
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

-- 上传人姓名
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;

-- 上传时间
ALTER TABLE documents ADD COLUMN IF NOT EXISTS upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ==================== 6. 添加描述和标签字段 ====================

-- 文档描述
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;

-- 标签（JSON数组）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';

-- 备注
ALTER TABLE documents ADD COLUMN IF NOT EXISTS remark TEXT;

-- ==================== 7. 添加版本管理字段 ====================

-- 版本号
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 是否为最新版本
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true;

-- 父文档ID（用于版本关联）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_id TEXT;

-- ==================== 8. 创建索引优化查询性能 ====================

-- 订单关联索引
CREATE INDEX IF NOT EXISTS idx_documents_bill_id ON documents(bill_id);
CREATE INDEX IF NOT EXISTS idx_documents_bill_number ON documents(bill_number);

-- 客户关联索引
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);

-- 文档类型索引
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);

-- 状态索引
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- 访问级别索引
CREATE INDEX IF NOT EXISTS idx_documents_access_level ON documents(access_level);

-- 上传时间索引
CREATE INDEX IF NOT EXISTS idx_documents_upload_time ON documents(upload_time);

-- COS Key索引
CREATE INDEX IF NOT EXISTS idx_documents_cos_key ON documents(cos_key);

-- 组合索引：订单+类型
CREATE INDEX IF NOT EXISTS idx_documents_bill_type ON documents(bill_id, document_type);

-- ==================== 9. 创建文档版本历史表 ====================

CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    cos_key TEXT,
    cos_url TEXT,
    file_size BIGINT DEFAULT 0,
    change_note TEXT,
    uploaded_by TEXT,
    uploaded_by_name TEXT,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_version ON document_versions(document_id, version);

-- ==================== 10. 更新现有数据 ====================

-- 为现有记录设置默认值
UPDATE documents SET access_level = 'order_related' WHERE access_level IS NULL;
UPDATE documents SET is_public = true WHERE is_public IS NULL;
UPDATE documents SET version = 1 WHERE version IS NULL;
UPDATE documents SET is_latest = true WHERE is_latest IS NULL;

-- 如果有title字段但没有document_name，复制title到document_name
UPDATE documents SET document_name = title WHERE document_name IS NULL AND title IS NOT NULL;

-- ==================== 11. 创建文档类型枚举说明 ====================
-- 支持的文档类型:
-- bill_of_lading     - 提单
-- invoice            - 发票
-- packing_list       - 装箱单
-- customs_declaration - 报关单
-- contract           - 合同
-- certificate        - 证书（原产地证、检验证书等）
-- insurance          - 保险单
-- delivery_note      - 送货单/CMR
-- inspection_report  - 查验报告
-- quotation          - 报价单
-- payment_receipt    - 付款凭证
-- other              - 其他

-- ==================== 迁移完成 ====================
