/**
 * 聊天模块 - 控制器
 */

import * as model from './model.js'

// ==================== 会话相关 ====================

/**
 * 获取用户的会话列表
 */
export async function getConversations(req, res) {
  try {
    const { userId, type, page, pageSize } = req.query
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    const result = await model.getConversations(userId, { type, page, pageSize })
    res.json({ errCode: 200, data: result })
  } catch (error) {
    console.error('获取会话列表失败:', error)
    res.json({ errCode: 500, msg: '获取会话列表失败: ' + error.message })
  }
}

/**
 * 获取会话详情
 */
export async function getConversationById(req, res) {
  try {
    const { id } = req.params
    const { userId } = req.query
    
    const conversation = await model.getConversationById(id, userId)
    if (!conversation) {
      return res.json({ errCode: 404, msg: '会话不存在' })
    }
    res.json({ errCode: 200, data: conversation })
  } catch (error) {
    console.error('获取会话详情失败:', error)
    res.json({ errCode: 500, msg: '获取会话详情失败: ' + error.message })
  }
}

/**
 * 创建私聊会话
 */
export async function createPrivateConversation(req, res) {
  try {
    const { userId1, userName1, userAvatar1, userId2, userName2, userAvatar2 } = req.body
    
    if (!userId1 || !userId2) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    const result = await model.createPrivateConversation(
      userId1, userName1, userAvatar1,
      userId2, userName2, userAvatar2
    )
    
    res.json({ 
      errCode: 200, 
      data: result,
      msg: result.isNew ? '会话创建成功' : '会话已存在'
    })
  } catch (error) {
    console.error('创建私聊会话失败:', error)
    res.json({ errCode: 500, msg: '创建私聊会话失败: ' + error.message })
  }
}

/**
 * 创建群聊会话
 */
export async function createGroupConversation(req, res) {
  try {
    const data = req.body
    
    if (!data.name || !data.creatorId) {
      return res.json({ errCode: 400, msg: '缺少群名称或创建者' })
    }
    
    if (!data.members || data.members.length < 2) {
      return res.json({ errCode: 400, msg: '群聊至少需要3个成员（含创建者）' })
    }
    
    const result = await model.createGroupConversation(data)
    res.json({ errCode: 200, data: result, msg: '群聊创建成功' })
  } catch (error) {
    console.error('创建群聊失败:', error)
    res.json({ errCode: 500, msg: '创建群聊失败: ' + error.message })
  }
}

/**
 * 更新群聊信息
 */
export async function updateConversation(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    await model.updateConversation(id, data)
    res.json({ errCode: 200, msg: '群聊信息更新成功' })
  } catch (error) {
    console.error('更新群聊信息失败:', error)
    res.json({ errCode: 500, msg: '更新群聊信息失败: ' + error.message })
  }
}

/**
 * 添加群成员
 */
export async function addParticipants(req, res) {
  try {
    const { id } = req.params
    const { members } = req.body
    
    if (!members || members.length === 0) {
      return res.json({ errCode: 400, msg: '缺少成员信息' })
    }
    
    await model.addParticipants(id, members)
    res.json({ errCode: 200, msg: '成员添加成功' })
  } catch (error) {
    console.error('添加群成员失败:', error)
    res.json({ errCode: 500, msg: '添加群成员失败: ' + error.message })
  }
}

/**
 * 移除群成员
 */
export async function removeParticipant(req, res) {
  try {
    const { id, userId } = req.params
    
    await model.removeParticipant(id, userId)
    res.json({ errCode: 200, msg: '成员已移除' })
  } catch (error) {
    console.error('移除群成员失败:', error)
    res.json({ errCode: 500, msg: '移除群成员失败: ' + error.message })
  }
}

/**
 * 退出群聊
 */
export async function leaveConversation(req, res) {
  try {
    const { id } = req.params
    const { userId } = req.body
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    await model.removeParticipant(id, userId)
    res.json({ errCode: 200, msg: '已退出群聊' })
  } catch (error) {
    console.error('退出群聊失败:', error)
    res.json({ errCode: 500, msg: '退出群聊失败: ' + error.message })
  }
}

/**
 * 设置会话置顶
 */
export async function setPinned(req, res) {
  try {
    const { id } = req.params
    const { userId, isPinned } = req.body
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    await model.setPinned(id, userId, isPinned)
    res.json({ errCode: 200, msg: isPinned ? '已置顶' : '已取消置顶' })
  } catch (error) {
    console.error('设置置顶失败:', error)
    res.json({ errCode: 500, msg: '设置置顶失败: ' + error.message })
  }
}

/**
 * 设置会话免打扰
 */
export async function setMuted(req, res) {
  try {
    const { id } = req.params
    const { userId, isMuted } = req.body
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    await model.setMuted(id, userId, isMuted)
    res.json({ errCode: 200, msg: isMuted ? '已开启免打扰' : '已关闭免打扰' })
  } catch (error) {
    console.error('设置免打扰失败:', error)
    res.json({ errCode: 500, msg: '设置免打扰失败: ' + error.message })
  }
}

// ==================== 消息相关 ====================

/**
 * 获取会话消息列表
 */
export async function getMessages(req, res) {
  try {
    const { id } = req.params
    const { beforeId, afterId, limit } = req.query
    
    const messages = await model.getMessages(id, { beforeId, afterId, limit: parseInt(limit) || 50 })
    res.json({ errCode: 200, data: messages })
  } catch (error) {
    console.error('获取消息列表失败:', error)
    res.json({ errCode: 500, msg: '获取消息列表失败: ' + error.message })
  }
}

/**
 * 发送消息
 */
export async function sendMessage(req, res) {
  try {
    const { id } = req.params
    const data = req.body
    
    if (!data.senderId || !data.content) {
      return res.json({ errCode: 400, msg: '缺少发送者或消息内容' })
    }
    
    const message = await model.sendMessage({
      ...data,
      conversationId: id
    })
    
    res.json({ errCode: 200, data: message, msg: '发送成功' })
  } catch (error) {
    console.error('发送消息失败:', error)
    res.json({ errCode: 500, msg: '发送消息失败: ' + error.message })
  }
}

/**
 * 撤回消息
 */
export async function recallMessage(req, res) {
  try {
    const { messageId } = req.params
    const { userId } = req.body
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    const result = await model.recallMessage(messageId, userId)
    res.json({ errCode: 200, data: result, msg: '消息已撤回' })
  } catch (error) {
    console.error('撤回消息失败:', error)
    res.json({ errCode: 500, msg: error.message || '撤回消息失败' })
  }
}

/**
 * 标记消息已读
 */
export async function markMessagesAsRead(req, res) {
  try {
    const { id } = req.params
    const { userId, lastMessageId } = req.body
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    await model.markMessagesAsRead(id, userId, lastMessageId)
    res.json({ errCode: 200, msg: '已标记为已读' })
  } catch (error) {
    console.error('标记已读失败:', error)
    res.json({ errCode: 500, msg: '标记已读失败: ' + error.message })
  }
}

/**
 * 获取未读消息总数
 */
export async function getTotalUnreadCount(req, res) {
  try {
    const { userId } = req.query
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    const count = await model.getTotalUnreadCount(userId)
    res.json({ errCode: 200, data: { count } })
  } catch (error) {
    console.error('获取未读数失败:', error)
    res.json({ errCode: 500, msg: '获取未读数失败: ' + error.message })
  }
}

// ==================== 业务讨论相关 ====================

/**
 * 获取业务讨论列表
 */
export async function getBusinessDiscussions(req, res) {
  try {
    const { businessType, businessId, page, pageSize } = req.query
    
    if (!businessType || !businessId) {
      return res.json({ errCode: 400, msg: '缺少业务类型或ID' })
    }
    
    const result = await model.getBusinessDiscussions(businessType, businessId, { page, pageSize })
    res.json({ errCode: 200, data: result })
  } catch (error) {
    console.error('获取业务讨论失败:', error)
    res.json({ errCode: 500, msg: '获取业务讨论失败: ' + error.message })
  }
}

/**
 * 获取评论的回复列表
 */
export async function getDiscussionReplies(req, res) {
  try {
    const { id } = req.params
    const { page, pageSize } = req.query
    
    const result = await model.getDiscussionReplies(id, { page, pageSize })
    res.json({ errCode: 200, data: result })
  } catch (error) {
    console.error('获取回复列表失败:', error)
    res.json({ errCode: 500, msg: '获取回复列表失败: ' + error.message })
  }
}

/**
 * 创建业务讨论
 */
export async function createDiscussion(req, res) {
  try {
    const data = req.body
    
    if (!data.businessType || !data.businessId || !data.userId || !data.content) {
      return res.json({ errCode: 400, msg: '缺少必填字段' })
    }
    
    const result = await model.createDiscussion(data)
    res.json({ errCode: 200, data: result, msg: '评论发布成功' })
  } catch (error) {
    console.error('创建讨论失败:', error)
    res.json({ errCode: 500, msg: '创建讨论失败: ' + error.message })
  }
}

/**
 * 删除业务讨论
 */
export async function deleteDiscussion(req, res) {
  try {
    const { id } = req.params
    const { userId } = req.body
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    const result = await model.deleteDiscussion(id, userId)
    if (!result.success) {
      return res.json({ errCode: 403, msg: '无权删除此评论' })
    }
    res.json({ errCode: 200, msg: '评论已删除' })
  } catch (error) {
    console.error('删除讨论失败:', error)
    res.json({ errCode: 500, msg: '删除讨论失败: ' + error.message })
  }
}

/**
 * 获取业务讨论数量
 */
export async function getDiscussionCount(req, res) {
  try {
    const { businessType, businessId } = req.query
    
    if (!businessType || !businessId) {
      return res.json({ errCode: 400, msg: '缺少业务类型或ID' })
    }
    
    const count = await model.getDiscussionCount(businessType, businessId)
    res.json({ errCode: 200, data: { count } })
  } catch (error) {
    console.error('获取讨论数量失败:', error)
    res.json({ errCode: 500, msg: '获取讨论数量失败: ' + error.message })
  }
}

// ==================== 用户相关 ====================

/**
 * 获取在线用户列表
 */
export async function getOnlineUsers(req, res) {
  try {
    const users = await model.getOnlineUsers()
    res.json({ errCode: 200, data: users })
  } catch (error) {
    console.error('获取在线用户失败:', error)
    res.json({ errCode: 500, msg: '获取在线用户失败: ' + error.message })
  }
}

/**
 * 获取可聊天的用户列表
 */
export async function getChatableUsers(req, res) {
  try {
    const { userId, keyword } = req.query
    
    if (!userId) {
      return res.json({ errCode: 400, msg: '缺少用户ID' })
    }
    
    const users = await model.getChatableUsers(userId, keyword)
    res.json({ errCode: 200, data: users })
  } catch (error) {
    console.error('获取用户列表失败:', error)
    res.json({ errCode: 500, msg: '获取用户列表失败: ' + error.message })
  }
}

/**
 * 批量获取用户在线状态
 */
export async function getUsersOnlineStatus(req, res) {
  try {
    const { userIds } = req.body
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.json({ errCode: 400, msg: '缺少用户ID列表' })
    }
    
    const statuses = await model.getUsersOnlineStatus(userIds)
    res.json({ errCode: 200, data: statuses })
  } catch (error) {
    console.error('获取在线状态失败:', error)
    res.json({ errCode: 500, msg: '获取在线状态失败: ' + error.message })
  }
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
  leaveConversation,
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
  // 用户
  getOnlineUsers,
  getChatableUsers,
  getUsersOnlineStatus
}
