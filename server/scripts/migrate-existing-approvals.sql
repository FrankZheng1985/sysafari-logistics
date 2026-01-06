-- =====================================================
-- 迁移现有审批数据到统一审批表
-- 将 approvals 表和 approval_requests 表的数据迁移到 unified_approvals 表
-- =====================================================

-- 1. 迁移业务审批表 (approvals) 数据
INSERT INTO unified_approvals (
    category,
    approval_type,
    business_id,
    business_table,
    title,
    content,
    amount,
    currency,
    applicant_id,
    applicant_name,
    approver_id,
    approver_name,
    status,
    approval_comment,
    created_at,
    updated_at,
    approved_at,
    rejected_at
)
SELECT 
    'business' as category,
    CASE 
        WHEN approval_type = 'order' THEN 'ORDER_APPROVAL'
        WHEN approval_type = 'payment' THEN 'PAYMENT_REQUEST'
        WHEN approval_type = 'supplier' THEN 'SUPPLIER_CREATE'
        WHEN approval_type = 'fee' THEN 'FEE_SUPPLEMENT'
        WHEN approval_type = 'inquiry' THEN 'INQUIRY_APPROVAL'
        WHEN approval_type = 'void' THEN 'VOID_REQUEST'
        WHEN approval_type = 'contract' THEN 'CONTRACT_APPROVAL'
        ELSE UPPER(approval_type)
    END as approval_type,
    business_id::text,
    CASE 
        WHEN approval_type = 'order' THEN 'bills_of_lading'
        WHEN approval_type = 'payment' THEN 'payments'
        WHEN approval_type = 'supplier' THEN 'suppliers'
        WHEN approval_type = 'fee' THEN 'fees'
        ELSE NULL
    END as business_table,
    COALESCE(title, '审批请求'),
    COALESCE(content, ''),
    amount,
    'EUR' as currency,
    applicant_id::text,
    applicant_name,
    approver_id::text,
    approver_name,
    status,
    COALESCE(remark, reject_reason) as approval_comment,
    created_at,
    COALESCE(processed_at, created_at) as updated_at,
    CASE WHEN status = 'approved' THEN processed_at ELSE NULL END as approved_at,
    CASE WHEN status = 'rejected' THEN processed_at ELSE NULL END as rejected_at
FROM approvals
WHERE NOT EXISTS (
    SELECT 1 FROM unified_approvals ua 
    WHERE ua.business_id = approvals.business_id::text 
    AND ua.category = 'business'
)
ON CONFLICT DO NOTHING;

-- 2. 迁移敏感操作审批表 (approval_requests) 数据
INSERT INTO unified_approvals (
    category,
    approval_type,
    business_id,
    business_table,
    title,
    content,
    amount,
    currency,
    request_data,
    applicant_id,
    applicant_name,
    applicant_dept,
    status,
    priority,
    created_at,
    updated_at
)
SELECT 
    CASE 
        WHEN request_type LIKE 'USER_%' THEN 'system'
        WHEN request_type LIKE 'FINANCE_%' THEN 'finance'
        WHEN request_type LIKE 'PERMISSION_%' THEN 'system'
        ELSE 'business'
    END as category,
    request_type as approval_type,
    business_id,
    business_type as business_table,
    title,
    COALESCE(content, '') as content,
    amount,
    COALESCE(currency, 'EUR') as currency,
    form_data as request_data,
    applicant_id::text,
    applicant_name,
    department as applicant_dept,
    status,
    COALESCE(priority, 'normal') as priority,
    created_at,
    updated_at
FROM approval_requests
WHERE NOT EXISTS (
    SELECT 1 FROM unified_approvals ua 
    WHERE ua.approval_type = approval_requests.request_type 
    AND ua.applicant_id = approval_requests.applicant_id::text
    AND ua.created_at = approval_requests.created_at
)
ON CONFLICT DO NOTHING;

-- 3. 显示迁移结果
SELECT 
    'approvals' as source_table,
    COUNT(*) as total_records
FROM approvals
UNION ALL
SELECT 
    'approval_requests' as source_table,
    COUNT(*) as total_records
FROM approval_requests
UNION ALL
SELECT 
    'unified_approvals (迁移后)' as source_table,
    COUNT(*) as total_records
FROM unified_approvals;

-- 4. 输出迁移完成消息
SELECT '✅ 审批数据迁移完成！' as message;

