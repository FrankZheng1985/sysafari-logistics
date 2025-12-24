-- ==================== 备份记录表 COS 字段扩展 ====================
-- 为数据库备份功能添加腾讯云 COS 支持

-- 添加 COS 存储路径
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'cos_key'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN cos_key TEXT;
        COMMENT ON COLUMN backup_records.cos_key IS 'COS 存储路径';
    END IF;
END $$;

-- 添加 COS 下载链接（临时）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'cos_url'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN cos_url TEXT;
        COMMENT ON COLUMN backup_records.cos_url IS 'COS 下载链接';
    END IF;
END $$;

-- 添加云同步状态
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'is_cloud_synced'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN is_cloud_synced INTEGER DEFAULT 0;
        COMMENT ON COLUMN backup_records.is_cloud_synced IS '是否已同步到云端：0-否，1-是';
    END IF;
END $$;

-- 添加文件名字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'file_name'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN file_name TEXT;
        COMMENT ON COLUMN backup_records.file_name IS '备份文件名';
    END IF;
END $$;

-- 添加备份描述
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'description'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN description TEXT;
        COMMENT ON COLUMN backup_records.description IS '备份描述';
    END IF;
END $$;

-- 添加恢复时间字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'restored_at'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN restored_at TIMESTAMP;
        COMMENT ON COLUMN backup_records.restored_at IS '最后恢复时间';
    END IF;
END $$;

-- 添加恢复次数字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_records' AND column_name = 'restore_count'
    ) THEN
        ALTER TABLE backup_records ADD COLUMN restore_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN backup_records.restore_count IS '恢复次数';
    END IF;
END $$;

-- 创建 COS 同步状态索引
CREATE INDEX IF NOT EXISTS idx_backup_cloud_synced ON backup_records(is_cloud_synced);

-- ==================== 恢复记录表 ====================
CREATE TABLE IF NOT EXISTS restore_records (
    id SERIAL PRIMARY KEY,
    backup_id INTEGER NOT NULL,
    backup_name TEXT,
    restore_type TEXT DEFAULT 'full',  -- full: 全量恢复, partial: 部分恢复
    restore_status TEXT DEFAULT 'running',  -- running, completed, failed
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    tables_restored TEXT,  -- JSON 格式，记录恢复的表
    rows_affected INTEGER DEFAULT 0,
    restored_by TEXT,
    restored_by_name TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restore_backup_id ON restore_records(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_status ON restore_records(restore_status);
CREATE INDEX IF NOT EXISTS idx_restore_time ON restore_records(created_at);

COMMENT ON TABLE restore_records IS '数据恢复记录表';

