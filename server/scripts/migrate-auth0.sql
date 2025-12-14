-- Auth0 集成迁移脚本
-- 在 Render PostgreSQL 控制台中执行此脚本

-- 1. 给 users 表添加 auth0_id 字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth0_id TEXT UNIQUE;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);

-- 3. 创建 Auth0 待绑定用户表
CREATE TABLE IF NOT EXISTS auth0_pending_users (
    id SERIAL PRIMARY KEY,
    auth0_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    picture TEXT,
    first_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_bound BOOLEAN DEFAULT FALSE,
    bound_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_auth0_pending_auth0_id ON auth0_pending_users(auth0_id);
CREATE INDEX IF NOT EXISTS idx_auth0_pending_is_bound ON auth0_pending_users(is_bound);

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ Auth0 集成迁移完成！';
END $$;
