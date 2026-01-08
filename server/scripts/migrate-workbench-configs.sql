-- 工作台配置表迁移脚本
-- 用于存储用户的工作台卡片配置

-- 创建工作台配置表
CREATE TABLE IF NOT EXISTS workbench_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_order TEXT[] DEFAULT ARRAY[
    'pending_tasks', 'order_stats', 'finance_stats',
    'tms_stats', 'inspection_stats', 'crm_stats',
    'document_stats', 'recent_activity', 'notifications',
    'quick_links', 'calendar', 'team_overview'
  ],
  hidden_cards TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- 添加注释
COMMENT ON TABLE workbench_configs IS '用户工作台配置表';
COMMENT ON COLUMN workbench_configs.user_id IS '用户ID';
COMMENT ON COLUMN workbench_configs.card_order IS '卡片显示顺序数组';
COMMENT ON COLUMN workbench_configs.hidden_cards IS '隐藏的卡片ID数组';
COMMENT ON COLUMN workbench_configs.created_at IS '创建时间';
COMMENT ON COLUMN workbench_configs.updated_at IS '更新时间';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_workbench_configs_user_id ON workbench_configs(user_id);
