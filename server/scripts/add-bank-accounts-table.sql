-- 添加银行账户表
-- 执行方式：psql -h host -U user -d database -f add-bank-accounts-table.sql
-- 或在 Render 控制台的 PostgreSQL Shell 中执行

-- ==================== 银行账户表 ====================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id SERIAL PRIMARY KEY,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    bank_branch TEXT,
    swift_code TEXT,
    iban TEXT,
    currency TEXT DEFAULT 'EUR',
    account_type TEXT DEFAULT 'current',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_default ON bank_accounts(is_default);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ bank_accounts 表创建成功！';
END $$;

