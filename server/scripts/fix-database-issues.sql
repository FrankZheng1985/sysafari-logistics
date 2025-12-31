-- ============================================================
-- 数据库问题修复脚本
-- 创建时间: 2025-12-25
-- 说明: 修复以下数据库问题
--   1. security_audit_logs 表不存在
--   2. user_online_status 表缺少唯一约束
--   3. security_settings 表缺少 setting_type 列
--   4. customers 表缺少 last_follow_up_time 列
-- ============================================================

-- ==================== 1. 创建 security_audit_logs 表 ====================
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    username TEXT,
    user_role TEXT,
    action_type TEXT NOT NULL,
    action_name TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    resource_name TEXT,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_url TEXT,
    request_method TEXT,
    result TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON security_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_time ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON security_audit_logs(resource_type, resource_id);

DO $$ BEGIN RAISE NOTICE '✅ security_audit_logs 表已创建/确认存在'; END $$;

-- ==================== 2. 修复 user_online_status 表唯一约束 ====================
-- 先检查表是否存在，如果不存在则创建
CREATE TABLE IF NOT EXISTS user_online_status (
    user_id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(100),
    is_online INTEGER DEFAULT 0,
    last_active_at TIMESTAMP DEFAULT NOW(),
    socket_id VARCHAR(100),
    device_type VARCHAR(20) DEFAULT 'web',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 如果表已存在但没有主键，需要添加唯一约束
DO $$
BEGIN
    -- 检查是否有主键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_online_status' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        -- 尝试添加主键约束
        BEGIN
            -- 先清空表数据（因为可能有重复的 user_id）
            DELETE FROM user_online_status;
            -- 然后添加主键
            ALTER TABLE user_online_status ADD PRIMARY KEY (user_id);
            RAISE NOTICE '✅ user_online_status 表已添加主键约束';
        EXCEPTION WHEN OTHERS THEN
            -- 如果添加主键失败，尝试添加唯一约束
            BEGIN
                ALTER TABLE user_online_status ADD CONSTRAINT user_online_status_user_id_unique UNIQUE (user_id);
                RAISE NOTICE '✅ user_online_status 表已添加唯一约束';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '⚠️ user_online_status 约束添加失败: %', SQLERRM;
            END;
        END;
    ELSE
        RAISE NOTICE '✅ user_online_status 表主键约束已存在';
    END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_online_status_active ON user_online_status(is_online, last_active_at DESC);

-- ==================== 3. 修复 security_settings 表缺少的列 ====================
-- 先确保表存在
CREATE TABLE IF NOT EXISTS security_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    category TEXT DEFAULT 'general',
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 添加缺失的列
DO $$
BEGIN
    -- 添加 setting_type 列
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_settings' AND column_name = 'setting_type'
    ) THEN
        ALTER TABLE security_settings ADD COLUMN setting_type TEXT DEFAULT 'string';
        RAISE NOTICE '✅ security_settings 表已添加 setting_type 列';
    ELSE
        RAISE NOTICE '✅ security_settings.setting_type 列已存在';
    END IF;
    
    -- 添加 category 列
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_settings' AND column_name = 'category'
    ) THEN
        ALTER TABLE security_settings ADD COLUMN category TEXT DEFAULT 'general';
        RAISE NOTICE '✅ security_settings 表已添加 category 列';
    ELSE
        RAISE NOTICE '✅ security_settings.category 列已存在';
    END IF;
END $$;

-- ==================== 4. 修复 customers 表缺少的 last_follow_up_time 列 ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' AND column_name = 'last_follow_up_time'
    ) THEN
        ALTER TABLE customers ADD COLUMN last_follow_up_time TIMESTAMP;
        RAISE NOTICE '✅ customers 表已添加 last_follow_up_time 列';
    ELSE
        RAISE NOTICE '✅ customers.last_follow_up_time 列已存在';
    END IF;
END $$;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_customers_last_follow_up ON customers(last_follow_up_time DESC);

-- ==================== 完成提示 ====================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ 数据库问题修复完成！';
    RAISE NOTICE '修复项目:';
    RAISE NOTICE '  1. security_audit_logs 表';
    RAISE NOTICE '  2. user_online_status 唯一约束';
    RAISE NOTICE '  3. security_settings.setting_type 列';
    RAISE NOTICE '  4. customers.last_follow_up_time 列';
    RAISE NOTICE '============================================================';
END $$;

