/**
 * 聊天模块 - 数据模型
 * 支持私聊、群聊、业务讨论
 */

import { getDatabase } from '../../config/database.js'
import { v4 as uuidv4 } from 'uuid'

// ==================== 会话相关 ====================

/**
 * 获取用户的会话列表
 */
export async function getConversations(userId, params = {}) {
  const db = getDatabase()
  const { type, page = 1, pageSize = 50 } = params
  
  let whereConditions = ['cp.user_id = $1', 'cp.left_at IS NULL', 'c.is_active = 1']
  const queryParams = [userId]
  let paramIndex = 2
  
  if (type && type !== 'all') {
    whereConditions.push(`c.type = $${paramIndex++}`)
    queryParams.push(type)
  }
  
  const whereClause = whereConditions.join(' AND ')
  const offset = (page - 1) * pageSize
  
  // 获取会话列表，按最后消息时间排序，置顶的排在前面
  const list = await db.prepare(`
    SELECT 
      c.*,
      cp.unread_count,
      cp.is_pinned,
      cp.is_muted,
      cp.last_read_at,
      cp.role as my_role
    FROM chat_conversations c
    INNER JOIN chat_participants cp ON c.id = cp.conversation_id
    WHERE ${whereClause}
    ORDER BY cp.is_pinned DESC, c.last_message_time DESC NULLS LAST, c.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `).all(...queryParams, pageSize, offset)
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total 
    FROM chat_conversations c
    INNER JOIN chat_participants cp ON c.id = cp.conversation_id
    WHERE ${whereClause}
  `).get(...queryParams.slice(0, paramIndex - 3))
  
  // 对于私聊，获取对方用户信息
  for (const conv of list) {
    if (conv.type === 'private') {
      const otherUser = await db.prepare(`
        SELECT user_id, user_name, user_avatar 
        FROM chat_participants 
        WHERE conversation_id = $1 AND user_id != $2
        LIMIT 1
      `).get(conv.id, userId)
      if (otherUser) {
        conv.other_user = otherUser
        conv.name = otherUser.user_name
        conv.avatar = otherUser.user_avatar
      }
    }
  }
  
  return {
    list,
    total: parseInt(countResult?.total || 0),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 获取会话详情
 */
export async function getConversationById(conversationId, userId) {
  const db = getDatabase()
  
  const conversation = await db.prepare(`
    SELECT 
      c.*,
      cp.unread_count,
      cp.is_pinned,
      cp.is_muted,
      cp.last_read_at,
      cp.role as my_role
    FROM chat_conversations c
    LEFT JOIN chat_participants cp ON c.id = cp.conversation_id AND cp.user_id = $2
    WHERE c.id = $1
  `).get(conversationId, userId)
  
  if (!conversation) return null
  
  // 获取所有参与者
  conversation.participants = await db.prepare(`
    SELECT user_id, user_name, user_avatar, nickname, role, joined_at, last_read_at
    FROM chat_participants
    WHERE conversation_id = $1 AND left_at IS NULL
    ORDER BY role DESC, joined_at ASC
  `).all(conversationId)
  
  return conversation
}

/**
 * 创建私聊会话（如果已存在则返回现有会话）
 */
export async function createPrivateConversation(userId1, userName1, userAvatar1, userId2, userName2, userAvatar2) {
  const db = getDatabase()
  
  // 检查是否已存在私聊会话
  const existing = await db.prepare(`
    SELECT c.id FROM chat_conversations c
    WHERE c.type = 'private' AND EXISTS (
      SELECT 1 FROM chat_participants cp1 
      WHERE cp1.conversation_id = c.id AND cp1.user_id = $1 AND cp1.left_at IS NULL
    ) AND EXISTS (
      SELECT 1 FROM chat_participants cp2 
      WHERE cp2.conversation_id = c.id AND cp2.user_id = $2 AND cp2.left_at IS NULL
    )
    LIMIT 1
  `).get(userId1, userId2)
  
  if (existing) {
    return { id: existing.id, isNew: false }
  }
  
  // 创建新会话
  const conversationId = `conv-${uuidv4()}`
  
  await db.prepare(`
    INSERT INTO chat_conversations (id, type, member_count, is_active)
    VALUES ($1, 'private', 2, 1)
  `).run(conversationId)
  
  // 添加参与者
  await db.prepare(`
    INSERT INTO chat_participants (conversation_id, user_id, user_name, user_avatar, role)
    VALUES ($1, $2, $3, $4, 'member')
  `).run(conversationId, userId1, userName1, userAvatar1)
  
  await db.prepare(`
    INSERT INTO chat_participants (conversation_id, user_id, user_name, user_avatar, role)
    VALUES ($1, $2, $3, $4, 'member')
  `).run(conversationId, userId2, userName2, userAvatar2)
  
  return { id: conversationId, isNew: true }
}

/**
 * 创建群聊会话
 */
export async function createGroupConversation(data) {
  const db = getDatabase()
  const conversationId = `conv-${uuidv4()}`
  const { name, description, avatar, creatorId, creatorName, members = [] } = data
  
  // 创建会话
  await db.prepare(`
    INSERT INTO chat_conversations (id, type, name, description, avatar, creator_id, creator_name, member_count, is_active)
    VALUES ($1, 'group', $2, $3, $4, $5, $6, $7, 1)
  `).run(conversationId, name, description || null, avatar || null, creatorId, creatorName, members.length + 1)
  
  // 添加创建者为管理员
  await db.prepare(`
    INSERT INTO chat_participants (conversation_id, user_id, user_name, user_avatar, role)
    VALUES ($1, $2, $3, $4, 'admin')
  `).run(conversationId, creatorId, creatorName, data.creatorAvatar || null)
  
  // 添加其他成员
  for (const member of members) {
    if (member.userId !== creatorId) {
      await db.prepare(`
        INSERT INTO chat_participants (conversation_id, user_id, user_name, user_avatar, role)
        VALUES ($1, $2, $3, $4, 'member')
      `).run(conversationId, member.userId, member.userName, member.userAvatar || null)
    }
  }
  
  return { id: conversationId }
}

/**
 * 更新群聊信息
 */
export async function updateConversation(conversationId, data) {
  const db = getDatabase()
  
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`)
    values.push(data.name)
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`)
    values.push(data.description)
  }
  if (data.avatar !== undefined) {
    fields.push(`avatar = $${paramIndex++}`)
    values.push(data.avatar)
  }
  
  fields.push(`updated_at = CURRENT_TIMESTAMP`)
  
  if (fields.length > 1) {
    values.push(conversationId)
    await db.prepare(`
      UPDATE chat_conversations SET ${fields.join(', ')} WHERE id = $${paramIndex}
    `).run(...values)
  }
  
  return { success: true }
}

/**
 * 添加群成员
 */
export async function addParticipants(conversationId, members) {
  const db = getDatabase()
  
  for (const member of members) {
    // 检查是否已是成员
    const existing = await db.prepare(`
      SELECT id, left_at FROM chat_participants 
      WHERE conversation_id = $1 AND user_id = $2
    `).get(conversationId, member.userId)
    
    if (existing) {
      // 如果之前离开过，重新加入
      if (existing.left_at) {
        await db.prepare(`
          UPDATE chat_participants 
          SET left_at = NULL, joined_at = CURRENT_TIMESTAMP, user_name = $3, user_avatar = $4
          WHERE id = $1
        `).run(existing.id, member.userId, member.userName, member.userAvatar || null)
      }
    } else {
      await db.prepare(`
        INSERT INTO chat_participants (conversation_id, user_id, user_name, user_avatar, role)
        VALUES ($1, $2, $3, $4, 'member')
      `).run(conversationId, member.userId, member.userName, member.userAvatar || null)
    }
  }
  
  // 更新成员数
  await updateMemberCount(conversationId)
  
  return { success: true }
}

/**
 * 移除群成员
 */
export async function removeParticipant(conversationId, userId) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE chat_participants SET left_at = CURRENT_TIMESTAMP
    WHERE conversation_id = $1 AND user_id = $2
  `).run(conversationId, userId)
  
  // 更新成员数
  await updateMemberCount(conversationId)
  
  return { success: true }
}

/**
 * 更新成员数量
 */
async function updateMemberCount(conversationId) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE chat_conversations 
    SET member_count = (
      SELECT COUNT(*) FROM chat_participants 
      WHERE conversation_id = $1 AND left_at IS NULL
    )
    WHERE id = $1
  `).run(conversationId)
}

/**
 * 设置会话置顶
 */
export async function setPinned(conversationId, userId, isPinned) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE chat_participants SET is_pinned = $3
    WHERE conversation_id = $1 AND user_id = $2
  `).run(conversationId, userId, isPinned ? 1 : 0)
  return { success: true }
}

/**
 * 设置会话免打扰
 */
export async function setMuted(conversationId, userId, isMuted) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE chat_participants SET is_muted = $3
    WHERE conversation_id = $1 AND user_id = $2
  `).run(conversationId, userId, isMuted ? 1 : 0)
  return { success: true }
}

// ==================== 消息相关 ====================

/**
 * 获取会话消息列表
 */
export async function getMessages(conversationId, params = {}) {
  const db = getDatabase()
  const { beforeId, afterId, limit = 50 } = params
  
  let whereConditions = ['conversation_id = $1']
  const queryParams = [conversationId]
  let paramIndex = 2
  
  // 分页：基于消息ID（比时间更精确）
  if (beforeId) {
    whereConditions.push(`created_at < (SELECT created_at FROM chat_messages WHERE id = $${paramIndex++})`)
    queryParams.push(beforeId)
  }
  if (afterId) {
    whereConditions.push(`created_at > (SELECT created_at FROM chat_messages WHERE id = $${paramIndex++})`)
    queryParams.push(afterId)
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  const messages = await db.prepare(`
    SELECT * FROM chat_messages
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
  `).all(...queryParams, limit)
  
  // 返回时按时间正序
  return messages.reverse()
}

/**
 * 发送消息
 */
export async function sendMessage(data) {
  const db = getDatabase()
  const messageId = `msg-${uuidv4()}`
  
  const {
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    content,
    msgType = 'text',
    fileUrl,
    fileName,
    fileSize,
    replyToId,
    replyToContent,
    mentionedUsers,
    relatedType,
    relatedId,
    relatedTitle
  } = data
  
  await db.prepare(`
    INSERT INTO chat_messages (
      id, conversation_id, sender_id, sender_name, sender_avatar,
      content, msg_type, file_url, file_name, file_size,
      reply_to_id, reply_to_content, mentioned_users,
      related_type, related_id, related_title
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `).run(
    messageId,
    conversationId,
    senderId,
    senderName,
    senderAvatar || null,
    content,
    msgType,
    fileUrl || null,
    fileName || null,
    fileSize || null,
    replyToId || null,
    replyToContent || null,
    mentionedUsers ? JSON.stringify(mentionedUsers) : null,
    relatedType || null,
    relatedId || null,
    relatedTitle || null
  )
  
  // 更新会话最后消息
  const contentSummary = msgType === 'text' 
    ? (content?.substring(0, 50) || '') 
    : msgType === 'image' ? '[图片]' : '[文件]'
    
  await db.prepare(`
    UPDATE chat_conversations 
    SET last_message_id = $2, 
        last_message_content = $3, 
        last_message_time = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `).run(conversationId, messageId, contentSummary)
  
  // 增加其他成员的未读数
  await db.prepare(`
    UPDATE chat_participants 
    SET unread_count = unread_count + 1
    WHERE conversation_id = $1 AND user_id != $2 AND left_at IS NULL
  `).run(conversationId, senderId)
  
  // 获取完整消息返回
  return await db.prepare(`SELECT * FROM chat_messages WHERE id = $1`).get(messageId)
}

/**
 * 撤回消息
 */
export async function recallMessage(messageId, userId) {
  const db = getDatabase()
  
  // 检查是否是发送者（只能撤回自己的消息）
  const message = await db.prepare(`
    SELECT * FROM chat_messages WHERE id = $1 AND sender_id = $2
  `).get(messageId, userId)
  
  if (!message) {
    throw new Error('无法撤回此消息')
  }
  
  // 检查时间（2分钟内可撤回）
  const msgTime = new Date(message.created_at).getTime()
  const now = Date.now()
  if (now - msgTime > 2 * 60 * 1000) {
    throw new Error('消息发送超过2分钟，无法撤回')
  }
  
  await db.prepare(`
    UPDATE chat_messages 
    SET is_recalled = 1, recalled_at = CURRENT_TIMESTAMP, content = '消息已撤回'
    WHERE id = $1
  `).run(messageId)
  
  return { success: true, conversationId: message.conversation_id }
}

/**
 * 标记消息已读
 */
export async function markMessagesAsRead(conversationId, userId, lastMessageId) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE chat_participants 
    SET unread_count = 0, 
        last_read_at = CURRENT_TIMESTAMP,
        last_read_message_id = $3
    WHERE conversation_id = $1 AND user_id = $2
  `).run(conversationId, userId, lastMessageId)
  
  return { success: true }
}

/**
 * 获取未读消息总数
 */
export async function getTotalUnreadCount(userId) {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT COALESCE(SUM(unread_count), 0) as total 
    FROM chat_participants 
    WHERE user_id = $1 AND left_at IS NULL
  `).get(userId)
  return parseInt(result?.total || 0)
}

// ==================== 业务讨论相关 ====================

/**
 * 获取业务讨论列表
 */
export async function getBusinessDiscussions(businessType, businessId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20 } = params
  
  const offset = (page - 1) * pageSize
  
  // 获取总数
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM business_discussions 
    WHERE business_type = $1 AND business_id = $2 AND is_deleted = 0 AND parent_id IS NULL
  `).get(businessType, businessId)
  
  // 获取顶级评论
  const list = await db.prepare(`
    SELECT * FROM business_discussions 
    WHERE business_type = $1 AND business_id = $2 AND is_deleted = 0 AND parent_id IS NULL
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
  `).all(businessType, businessId, pageSize, offset)
  
  // 获取每条评论的回复数量
  for (const item of list) {
    const replyCount = await db.prepare(`
      SELECT COUNT(*) as count FROM business_discussions 
      WHERE parent_id = $1 AND is_deleted = 0
    `).get(item.id)
    item.reply_count = parseInt(replyCount?.count || 0)
    
    // 获取最近2条回复预览
    item.recent_replies = await db.prepare(`
      SELECT * FROM business_discussions 
      WHERE parent_id = $1 AND is_deleted = 0
      ORDER BY created_at ASC
      LIMIT 2
    `).all(item.id)
  }
  
  return {
    list,
    total: parseInt(countResult?.total || 0),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 获取评论的回复列表
 */
export async function getDiscussionReplies(parentId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 20 } = params
  
  const offset = (page - 1) * pageSize
  
  const countResult = await db.prepare(`
    SELECT COUNT(*) as total FROM business_discussions 
    WHERE parent_id = $1 AND is_deleted = 0
  `).get(parentId)
  
  const list = await db.prepare(`
    SELECT * FROM business_discussions 
    WHERE parent_id = $1 AND is_deleted = 0
    ORDER BY created_at ASC
    LIMIT $2 OFFSET $3
  `).all(parentId, pageSize, offset)
  
  return {
    list,
    total: parseInt(countResult?.total || 0),
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }
}

/**
 * 创建业务讨论
 */
export async function createDiscussion(data) {
  const db = getDatabase()
  
  const result = await db.prepare(`
    INSERT INTO business_discussions (
      business_type, business_id, business_title,
      user_id, user_name, user_avatar,
      content, parent_id, mentioned_users,
      attachment_url, attachment_name
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `).get(
    data.businessType,
    data.businessId,
    data.businessTitle || null,
    data.userId,
    data.userName,
    data.userAvatar || null,
    data.content,
    data.parentId || null,
    data.mentionedUsers ? JSON.stringify(data.mentionedUsers) : null,
    data.attachmentUrl || null,
    data.attachmentName || null
  )
  
  return { id: result.id }
}

/**
 * 删除业务讨论
 */
export async function deleteDiscussion(id, userId) {
  const db = getDatabase()
  
  // 软删除，只能删除自己的评论
  const result = await db.prepare(`
    UPDATE business_discussions 
    SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
  `).run(id, userId)
  
  return { success: result.changes > 0 }
}

/**
 * 获取业务讨论数量
 */
export async function getDiscussionCount(businessType, businessId) {
  const db = getDatabase()
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM business_discussions 
    WHERE business_type = $1 AND business_id = $2 AND is_deleted = 0
  `).get(businessType, businessId)
  return parseInt(result?.count || 0)
}

// ==================== 用户在线状态 ====================

/**
 * 更新用户在线状态
 */
export async function updateOnlineStatus(userId, userName, isOnline, socketId, deviceType = 'web') {
  const db = getDatabase()
  
  await db.prepare(`
    INSERT INTO user_online_status (user_id, user_name, is_online, socket_id, device_type, last_active_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
      user_name = $2,
      is_online = $3,
      socket_id = $4,
      device_type = $5,
      last_active_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, userName, isOnline ? 1 : 0, socketId, deviceType)
  
  return { success: true }
}

/**
 * 获取在线用户列表
 */
export async function getOnlineUsers() {
  const db = getDatabase()
  return await db.prepare(`
    SELECT user_id, user_name, last_active_at, device_type
    FROM user_online_status
    WHERE is_online = 1
    ORDER BY last_active_at DESC
  `).all()
}

/**
 * 获取用户在线状态
 */
export async function getUserOnlineStatus(userId) {
  const db = getDatabase()
  const status = await db.prepare(`
    SELECT * FROM user_online_status WHERE user_id = $1
  `).get(userId)
  return status
}

/**
 * 批量获取用户在线状态
 */
export async function getUsersOnlineStatus(userIds) {
  const db = getDatabase()
  if (!userIds || userIds.length === 0) return []
  
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',')
  return await db.prepare(`
    SELECT user_id, is_online, last_active_at 
    FROM user_online_status 
    WHERE user_id IN (${placeholders})
  `).all(...userIds)
}

/**
 * 获取会话参与者ID列表（用于WebSocket广播）
 */
export async function getConversationParticipantIds(conversationId) {
  const db = getDatabase()
  const participants = await db.prepare(`
    SELECT user_id FROM chat_participants
    WHERE conversation_id = $1 AND left_at IS NULL
  `).all(conversationId)
  return participants.map(p => p.user_id)
}

/**
 * 获取可聊天的用户列表（用于新建会话时选择）
 */
export async function getChatableUsers(currentUserId, keyword) {
  const db = getDatabase()
  
  let whereConditions = ['id != $1']
  const params = [currentUserId]
  let paramIndex = 2
  
  if (keyword) {
    whereConditions.push(`(username ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`)
    params.push(`%${keyword}%`)
    paramIndex++
  }
  
  const whereClause = whereConditions.join(' AND ')
  
  return await db.prepare(`
    SELECT id, username, name, avatar, email, department
    FROM users
    WHERE ${whereClause}
    ORDER BY name ASC
    LIMIT 50
  `).all(...params)
}

export default {
  // 会话
  getConversations,
  getConversationById,
  createPrivateConversation,
  createGroupConversation,
  updateConversation,
  addParticipants,
  removeParticipant,
  setPinned,
  setMuted,
  // 消息
  getMessages,
  sendMessage,
  recallMessage,
  markMessagesAsRead,
  getTotalUnreadCount,
  // 业务讨论
  getBusinessDiscussions,
  getDiscussionReplies,
  createDiscussion,
  deleteDiscussion,
  getDiscussionCount,
  // 在线状态
  updateOnlineStatus,
  getOnlineUsers,
  getUserOnlineStatus,
  getUsersOnlineStatus,
  getConversationParticipantIds,
  getChatableUsers
}
