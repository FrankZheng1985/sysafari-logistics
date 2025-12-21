-- ==================== 合同签署流程数据库迁移脚本 ====================
-- 创建时间: 2024-12
-- 说明: 为合同表添加签署状态和文件字段，支持成交前强制签署流程
-- 执行方式: psql -h host -U user -d database -f migrate-contract-signing.sql

-- ==================== 1. 给合同表添加签署相关字段 ====================
DO $$
BEGIN
    -- 签署状态：unsigned(未签署), pending_sign(待签署), signed(已签署), rejected(已拒签)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'sign_status'
    ) THEN
        ALTER TABLE contracts ADD COLUMN sign_status TEXT DEFAULT 'unsigned';
        COMMENT ON COLUMN contracts.sign_status IS '签署状态：unsigned-未签署, pending_sign-待签署, signed-已签署, rejected-已拒签';
    END IF;
    
    -- 签署文件路径（存储上传的签署合同扫描件）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'signed_file_path'
    ) THEN
        ALTER TABLE contracts ADD COLUMN signed_file_path TEXT;
        COMMENT ON COLUMN contracts.signed_file_path IS '已签署合同文件路径';
    END IF;
    
    -- 签署文件名
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'signed_file_name'
    ) THEN
        ALTER TABLE contracts ADD COLUMN signed_file_name TEXT;
        COMMENT ON COLUMN contracts.signed_file_name IS '已签署合同文件名';
    END IF;
    
    -- 签署时间（实际签署完成时间）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'signed_at'
    ) THEN
        ALTER TABLE contracts ADD COLUMN signed_at TIMESTAMP;
        COMMENT ON COLUMN contracts.signed_at IS '签署完成时间';
    END IF;
    
    -- 签署人（跟单人员）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'signed_by'
    ) THEN
        ALTER TABLE contracts ADD COLUMN signed_by INTEGER;
        COMMENT ON COLUMN contracts.signed_by IS '签署人ID（跟单人员）';
    END IF;
    
    -- 签署人姓名
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'signed_by_name'
    ) THEN
        ALTER TABLE contracts ADD COLUMN signed_by_name TEXT;
        COMMENT ON COLUMN contracts.signed_by_name IS '签署人姓名';
    END IF;
    
    -- 合同PDF文件路径（生成的待签署合同）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'contract_file_path'
    ) THEN
        ALTER TABLE contracts ADD COLUMN contract_file_path TEXT;
        COMMENT ON COLUMN contracts.contract_file_path IS '待签署合同PDF路径';
    END IF;
    
    -- 合同模板ID
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE contracts ADD COLUMN template_id TEXT;
        COMMENT ON COLUMN contracts.template_id IS '使用的合同模板ID';
    END IF;
    
    -- 是否自动生成
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'auto_generated'
    ) THEN
        ALTER TABLE contracts ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN contracts.auto_generated IS '是否自动生成';
    END IF;
    
    -- 关联的销售机会ID（便于从机会自动生成合同）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'opportunity_id'
    ) THEN
        ALTER TABLE contracts ADD COLUMN opportunity_id TEXT;
        COMMENT ON COLUMN contracts.opportunity_id IS '关联的销售机会ID';
    END IF;
END $$;

-- ==================== 2. 创建索引 ====================
CREATE INDEX IF NOT EXISTS idx_contracts_sign_status ON contracts(sign_status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_opportunity_id ON contracts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_signed_by ON contracts(signed_by);

-- ==================== 3. 给销售机会表添加合同关联字段 ====================
DO $$
BEGIN
    -- 关联的合同ID
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_opportunities' AND column_name = 'contract_id'
    ) THEN
        ALTER TABLE sales_opportunities ADD COLUMN contract_id TEXT;
        COMMENT ON COLUMN sales_opportunities.contract_id IS '关联的合同ID';
    END IF;
    
    -- 合同编号（冗余字段，方便查询）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_opportunities' AND column_name = 'contract_number'
    ) THEN
        ALTER TABLE sales_opportunities ADD COLUMN contract_number TEXT;
        COMMENT ON COLUMN sales_opportunities.contract_number IS '合同编号';
    END IF;
    
    -- 是否需要合同（默认需要）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_opportunities' AND column_name = 'require_contract'
    ) THEN
        ALTER TABLE sales_opportunities ADD COLUMN require_contract BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN sales_opportunities.require_contract IS '是否需要签署合同才能成交';
    END IF;
END $$;

-- ==================== 4. 合同签署历史记录表 ====================
CREATE TABLE IF NOT EXISTS contract_sign_history (
    id SERIAL PRIMARY KEY,
    contract_id TEXT NOT NULL,
    action TEXT NOT NULL,  -- generate(生成), send(发送), sign(签署), upload(上传), reject(拒签)
    action_name TEXT NOT NULL,
    operator_id INTEGER,
    operator_name TEXT,
    old_status TEXT,
    new_status TEXT,
    file_path TEXT,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_sign_history_contract ON contract_sign_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_sign_history_time ON contract_sign_history(created_at);

-- ==================== 5. 更新现有合同的签署状态 ====================
-- 已签署日期不为空的合同，状态设为已签署
UPDATE contracts 
SET sign_status = 'signed', signed_at = sign_date 
WHERE sign_date IS NOT NULL AND sign_status IS NULL;

-- 其他合同设为未签署
UPDATE contracts 
SET sign_status = 'unsigned' 
WHERE sign_status IS NULL;

-- ==================== 完成 ====================
SELECT '✅ 合同签署流程数据库迁移完成！' AS status;

-- 显示合同表结构
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'contracts' 
ORDER BY ordinal_position;
