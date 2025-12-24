-- 为 users 表添加缺失的字段
-- 这些字段是新增的，用于支持团队管理和组织结构功能
-- 执行时间: 2025-12-24

-- 添加直属上级字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES users(id);

-- 添加部门字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT '';

-- 添加职位字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100) DEFAULT '';

-- 为 supervisor_id 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);

-- 添加注释
COMMENT ON COLUMN users.supervisor_id IS '直属上级ID';
COMMENT ON COLUMN users.department IS '部门';
COMMENT ON COLUMN users.position IS '职位';

