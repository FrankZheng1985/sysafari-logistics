-- =====================================================
-- 信息中心 - 聊天模块数据库迁移脚本
-- 创建时间: 2024-12-20
-- 功能: 即时聊天、群聊、业务讨论
-- =====================================================

-- 1. 聊天会话表 (chat_conversations)
-- 支持私聊(private)和群聊(group)两种类型
CREATE TABLE IF NOT EXISTS chat_conversations (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'private',  -- private: 私聊, group: 群聊
    name VARCHAR(100),                             -- 群聊名称（私聊可为空）
    avatar VARCHAR(500),                           -- 群聊头像URL
    description TEXT,                              -- 群聊描述
    creator_id VARCHAR(50),                        -- 创建者ID
    creator_name VARCHAR(100),                     -- 创建者名称
    last_message_id VARCHAR(50),                   -- 最后一条消息ID
    last_message_content TEXT,                     -- 最后一条消息内容摘要
    last_message_time TIMESTAMP,                   -- 最后消息时间
    member_count INTEGER DEFAULT 2,                -- 成员数量
    is_active INTEGER DEFAULT 1,                   -- 是否激活
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 会话参与者表 (chat_participants)
-- 记录每个会话的参与成员
CREATE TABLE IF NOT EXISTS chat_participants (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,                  -- 用户ID
    user_name VARCHAR(100),                        -- 用户名称
    user_avatar VARCHAR(500),                      -- 用户头像
    nickname VARCHAR(100),                         -- 群内昵称
    role VARCHAR(20) DEFAULT 'member',             -- admin: 管理员, member: 普通成员
    is_muted INTEGER DEFAULT 0,                    -- 是否免打扰
    is_pinned INTEGER DEFAULT 0,                   -- 是否置顶
    unread_count INTEGER DEFAULT 0,                -- 未读消息数
    last_read_at TIMESTAMP,                        -- 最后阅读时间
    last_read_message_id VARCHAR(50),              -- 最后已读消息ID
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,                             -- 离开时间（用于群聊）
    UNIQUE(conversation_id, user_id)
);

-- 3. 聊天消息表 (chat_messages)
-- 存储所有聊天消息
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(50) PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(50) NOT NULL,                -- 发送者ID
    sender_name VARCHAR(100),                      -- 发送者名称
    sender_avatar VARCHAR(500),                    -- 发送者头像
    content TEXT,                                  -- 消息内容
    msg_type VARCHAR(20) DEFAULT 'text',           -- text: 文本, image: 图片, file: 文件, system: 系统消息
    file_url VARCHAR(500),                         -- 文件URL（图片/文件消息）
    file_name VARCHAR(200),                        -- 文件名
    file_size INTEGER,                             -- 文件大小(字节)
    reply_to_id VARCHAR(50),                       -- 回复的消息ID
    reply_to_content TEXT,                         -- 回复的消息内容摘要
    mentioned_users TEXT,                          -- @的用户ID列表(JSON数组)
    related_type VARCHAR(50),                      -- 关联业务类型: order, customer, contract, invoice等
    related_id VARCHAR(50),                        -- 关联业务ID
    related_title VARCHAR(200),                    -- 关联业务标题
    is_recalled INTEGER DEFAULT 0,                 -- 是否已撤回
    recalled_at TIMESTAMP,                         -- 撤回时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 业务讨论表 (business_discussions)
-- 针对特定业务（订单、客户、合同等）的讨论
CREATE TABLE IF NOT EXISTS business_discussions (
    id SERIAL PRIMARY KEY,
    business_type VARCHAR(50) NOT NULL,            -- order: 订单, customer: 客户, contract: 合同, invoice: 发票
    business_id VARCHAR(50) NOT NULL,              -- 业务ID
    business_title VARCHAR(200),                   -- 业务标题（如订单号）
    user_id VARCHAR(50) NOT NULL,                  -- 评论用户ID
    user_name VARCHAR(100),                        -- 用户名称
    user_avatar VARCHAR(500),                      -- 用户头像
    content TEXT NOT NULL,                         -- 评论内容
    parent_id INTEGER REFERENCES business_discussions(id) ON DELETE CASCADE,  -- 父评论ID（用于回复）
    mentioned_users TEXT,                          -- @的用户ID列表(JSON数组)
    attachment_url VARCHAR(500),                   -- 附件URL
    attachment_name VARCHAR(200),                  -- 附件名称
    is_deleted INTEGER DEFAULT 0,                  -- 是否已删除
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 用户在线状态表 (user_online_status)
-- 记录用户在线状态
CREATE TABLE IF NOT EXISTS user_online_status (
    user_id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(100),
    is_online INTEGER DEFAULT 0,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    socket_id VARCHAR(100),                        -- WebSocket连接ID
    device_type VARCHAR(20) DEFAULT 'web',         -- 设备类型: web, mobile, desktop
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 创建索引以优化查询性能
-- =====================================================

-- 会话索引
CREATE INDEX IF NOT EXISTS idx_conversations_type ON chat_conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_creator ON chat_conversations(creator_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_time ON chat_conversations(last_message_time DESC);

-- 参与者索引
CREATE INDEX IF NOT EXISTS idx_participants_conversation ON chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_unread ON chat_participants(user_id, unread_count) WHERE unread_count > 0;

-- 消息索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_related ON chat_messages(related_type, related_id);

-- 业务讨论索引
CREATE INDEX IF NOT EXISTS idx_discussions_business ON business_discussions(business_type, business_id);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON business_discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_parent ON business_discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created ON business_discussions(created_at DESC);

-- 在线状态索引
CREATE INDEX IF NOT EXISTS idx_online_status_active ON user_online_status(is_online, last_active_at DESC);

-- =====================================================
-- 插入默认数据
-- =====================================================

-- 创建系统公告群（所有用户自动加入）
INSERT INTO chat_conversations (id, type, name, description, creator_id, creator_name, member_count, is_active)
VALUES ('conv-system-announce', 'group', '系统公告', '系统公告和重要通知', 'system', '系统', 0, 1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE chat_conversations IS '聊天会话表 - 存储私聊和群聊会话';
COMMENT ON TABLE chat_participants IS '会话参与者表 - 存储会话成员信息';
COMMENT ON TABLE chat_messages IS '聊天消息表 - 存储所有聊天消息';
COMMENT ON TABLE business_discussions IS '业务讨论表 - 针对业务的评论讨论';
COMMENT ON TABLE user_online_status IS '用户在线状态表 - 追踪用户在线情况';
