/**
 * 聊天模块 - 路由定义
 */

import express from 'express'
import * as controller from './controller.js'

const router = express.Router()

// ==================== 会话相关 ====================
// 获取会话列表
router.get('/conversations', controller.getConversations)
// 获取会话详情
router.get('/conversations/:id', controller.getConversationById)
// 创建私聊会话
router.post('/conversations/private', controller.createPrivateConversation)
// 创建群聊会话
router.post('/conversations/group', controller.createGroupConversation)
// 更新群聊信息
router.put('/conversations/:id', controller.updateConversation)
// 添加群成员
router.post('/conversations/:id/participants', controller.addParticipants)
// 移除群成员
router.delete('/conversations/:id/participants/:userId', controller.removeParticipant)
// 退出群聊
router.post('/conversations/:id/leave', controller.leaveConversation)
// 设置置顶
router.put('/conversations/:id/pin', controller.setPinned)
// 设置免打扰
router.put('/conversations/:id/mute', controller.setMuted)

// ==================== 消息相关 ====================
// 获取会话消息列表
router.get('/conversations/:id/messages', controller.getMessages)
// 发送消息
router.post('/conversations/:id/messages', controller.sendMessage)
// 标记消息已读
router.put('/conversations/:id/read', controller.markMessagesAsRead)
// 撤回消息
router.put('/messages/:messageId/recall', controller.recallMessage)
// 获取未读消息总数
router.get('/unread-count', controller.getTotalUnreadCount)

// ==================== 业务讨论相关 ====================
// 获取业务讨论列表
router.get('/discussions', controller.getBusinessDiscussions)
// 获取业务讨论数量
router.get('/discussions/count', controller.getDiscussionCount)
// 获取评论的回复列表
router.get('/discussions/:id/replies', controller.getDiscussionReplies)
// 创建业务讨论
router.post('/discussions', controller.createDiscussion)
// 删除业务讨论
router.delete('/discussions/:id', controller.deleteDiscussion)

// ==================== 用户相关 ====================
// 获取在线用户列表
router.get('/users/online', controller.getOnlineUsers)
// 获取可聊天的用户列表
router.get('/users/chatable', controller.getChatableUsers)
// 批量获取用户在线状态
router.post('/users/online-status', controller.getUsersOnlineStatus)

export default router
