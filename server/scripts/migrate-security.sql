-- ==================== 安全管理数据库迁移脚本 ====================
-- 创建时间: 2024-12
-- 说明: 增强系统安全功能，包括登录尝试记录、安全设置、操作审计等
-- 执行方式: psql -h host -U user -d database -f migrate-security.sql

-- ==================== 1. 登录尝试记录表 ====================
-- 用于记录所有登录尝试，支持账号锁定和安全审计
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT,
    -- 地理位置信息（可选）
    country TEXT,
    city TEXT,
    -- 设备指纹（可选，用于识别可疑设备）
    device_fingerprint TEXT
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);

-- ==================== 2. 安全设置表增强 ====================
-- 删除旧的安全设置类型字段（如果存在）
DO $$
BEGIN
    -- 先添加 setting_type 列（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_settings' AND column_name = 'setting_type'
    ) THEN
        ALTER TABLE security_settings ADD COLUMN setting_type TEXT DEFAULT 'string';
    END IF;
    
    -- 添加 category 列（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'security_settings' AND column_name = 'category'
    ) THEN
        ALTER TABLE security_settings ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
END $$;

-- 初始化安全设置（使用 ON CONFLICT 避免重复插入）
INSERT INTO security_settings (setting_key, setting_value, setting_type, category, description)
VALUES 
    -- 登录安全设置
    ('login_max_attempts', '5', 'number', 'login', '最大登录尝试次数'),
    ('login_lockout_duration', '15', 'number', 'login', '账号锁定时长（分钟）'),
    ('login_remember_days', '7', 'number', 'login', '记住登录状态天数'),
    ('login_require_captcha_after', '3', 'number', 'login', '多少次失败后需要验证码'),
    
    -- 密码安全设置
    ('password_min_length', '8', 'number', 'password', '密码最小长度'),
    ('password_require_uppercase', 'true', 'boolean', 'password', '密码需要大写字母'),
    ('password_require_lowercase', 'true', 'boolean', 'password', '密码需要小写字母'),
    ('password_require_number', 'true', 'boolean', 'password', '密码需要数字'),
    ('password_require_special', 'false', 'boolean', 'password', '密码需要特殊字符'),
    ('password_expire_days', '90', 'number', 'password', '密码有效期（天，0为永不过期）'),
    ('password_history_count', '3', 'number', 'password', '不能重复使用最近N个密码'),
    
    -- 会话安全设置
    ('session_timeout', '30', 'number', 'session', '会话超时时间（分钟）'),
    ('session_single_login', 'false', 'boolean', 'session', '单点登录（同一账号只能一处登录）'),
    ('session_remember_max_days', '30', 'number', 'session', '记住登录最长天数'),
    
    -- API安全设置
    ('api_rate_limit', '100', 'number', 'api', 'API请求速率限制（每分钟）'),
    ('api_rate_limit_window', '60', 'number', 'api', '速率限制时间窗口（秒）'),
    ('api_whitelist_ips', '', 'string', 'api', 'IP白名单（逗号分隔）'),
    ('api_blacklist_ips', '', 'string', 'api', 'IP黑名单（逗号分隔）'),
    
    -- 安全审计设置
    ('audit_enabled', 'true', 'boolean', 'audit', '启用操作审计'),
    ('audit_sensitive_operations', 'true', 'boolean', 'audit', '记录敏感操作'),
    ('audit_retention_days', '365', 'number', 'audit', '审计日志保留天数'),
    
    -- 数据备份设置
    ('backup_enabled', 'true', 'boolean', 'backup', '启用自动备份'),
    ('backup_frequency', 'daily', 'string', 'backup', '备份频率（daily/weekly/monthly）'),
    ('backup_retention_count', '30', 'number', 'backup', '备份保留份数'),
    ('backup_time', '03:00', 'string', 'backup', '备份时间（每天）')
    
ON CONFLICT (setting_key) DO UPDATE SET 
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    setting_type = EXCLUDED.setting_type;

-- ==================== 3. 敏感操作审计日志表 ====================
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id SERIAL PRIMARY KEY,
    -- 用户信息
    user_id INTEGER,
    username TEXT,
    user_role TEXT,
    -- 操作信息
    action_type TEXT NOT NULL,        -- login, logout, create, update, delete, export, permission_change
    action_name TEXT NOT NULL,        -- 操作名称（中文）
    resource_type TEXT,               -- 资源类型：user, role, customer, bill, etc.
    resource_id TEXT,                 -- 资源ID
    resource_name TEXT,               -- 资源名称
    -- 详细信息
    old_value TEXT,                   -- 修改前的值（JSON格式）
    new_value TEXT,                   -- 修改后的值（JSON格式）
    description TEXT,                 -- 操作描述
    -- 请求信息
    ip_address TEXT,
    user_agent TEXT,
    request_url TEXT,
    request_method TEXT,
    -- 结果
    result TEXT DEFAULT 'success',    -- success, failed
    error_message TEXT,
    -- 时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON security_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON security_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON security_audit_logs(ip_address);

-- ==================== 4. IP黑名单表 ====================
CREATE TABLE IF NOT EXISTS ip_blacklist (
    id SERIAL PRIMARY KEY,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_by TEXT,
    expires_at TIMESTAMP,             -- NULL表示永久封禁
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blacklist_ip ON ip_blacklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON ip_blacklist(is_active);

-- ==================== 5. API访问速率限制记录表 ====================
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id SERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,         -- IP或用户ID
    identifier_type TEXT NOT NULL,    -- ip, user
    endpoint TEXT,                    -- API端点（可为空表示全局）
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON api_rate_limits(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON api_rate_limits(window_start);

-- ==================== 6. 密码历史表（防止重复使用密码） ====================
CREATE TABLE IF NOT EXISTS password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);

-- ==================== 7. 活动会话表（用于会话管理和单点登录） ====================
CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON active_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON active_sessions(expires_at);

-- ==================== 8. 数据备份记录表 ====================
CREATE TABLE IF NOT EXISTS backup_records (
    id SERIAL PRIMARY KEY,
    backup_name TEXT NOT NULL,
    backup_type TEXT DEFAULT 'full',  -- full, incremental
    backup_size BIGINT,               -- 字节
    backup_path TEXT,
    backup_status TEXT DEFAULT 'completed',  -- running, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_status ON backup_records(backup_status);
CREATE INDEX IF NOT EXISTS idx_backup_time ON backup_records(created_at);

-- ==================== 9. 给用户表添加安全相关字段 ====================
DO $$
BEGIN
    -- 密码过期时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_expires_at'
    ) THEN
        ALTER TABLE users ADD COLUMN password_expires_at TIMESTAMP;
    END IF;
    
    -- 密码修改时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_changed_at'
    ) THEN
        ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP;
    END IF;
    
    -- 用户类型字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'normal';
    END IF;
    
    -- 两步验证启用
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_enabled'
    ) THEN
        ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- 两步验证密钥
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_secret'
    ) THEN
        ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
    END IF;
END $$;

-- ==================== 10. 清理函数：定期清理过期数据 ====================
-- 创建清理过期登录尝试记录的函数
CREATE OR REPLACE FUNCTION cleanup_expired_login_attempts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM login_attempts 
    WHERE attempt_time < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建清理过期速率限制记录的函数
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_rate_limits 
    WHERE window_start < NOW() - INTERVAL '1 hour';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建清理过期会话的函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE active_sessions 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==================== 完成 ====================
-- 输出安全设置
SELECT '✅ 安全管理数据库迁移完成！' AS status;
SELECT setting_key, setting_value, category, description 
FROM security_settings 
ORDER BY category, setting_key;
