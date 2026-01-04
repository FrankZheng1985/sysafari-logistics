/**
 * 聊天模块 - WebSocket服务
 * 使用 Socket.io 实现实时通信
 */

import { Server } from 'socket.io'
import * as model from './model.js'

// 存储用户与socket的映射关系
const userSocketMap = new Map() // userId -> Set<socketId>
const socketUserMap = new Map() // socketId -> userId

/**
 * 初始化 Socket.io 服务
 * @param {http.Server} httpServer - HTTP服务器实例
 * @returns {Server} Socket.io服务器实例
 */
export function initSocketServer(httpServer) {
  // 开发环境允许所有来源，生产环境限制特定域名
  const isDev = process.env.NODE_ENV !== 'production'
  
  const io = new Server(httpServer, {
    cors: {
      origin: isDev 
        ? true  // 开发环境允许所有来源
        : [
            'http://localhost:5173', 
            'http://localhost:3000', 
            'http://localhost:3001', 
            'http://127.0.0.1:5173',
            'https://erp.xianfeng-eu.com',
            'https://demo.xianfeng-eu.com'
          ],
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],  // 支持 WebSocket 和轮询
    allowEIO3: true  // 兼容旧版本客户端
  })
  
  // 连接事件
  io.on('connection', (socket) => {
    console.log(`[Socket] 新连接: ${socket.id}`)
    
    // 用户上线
    socket.on('user:online', async (data) => {
      try {
        const { userId, userName } = data
        if (!userId) return
        
        // 记录映射关系
        if (!userSocketMap.has(userId)) {
          userSocketMap.set(userId, new Set())
        }
        userSocketMap.get(userId).add(socket.id)
        socketUserMap.set(socket.id, userId)
        
        // 将用户加入自己的房间（用于点对点消息）
        socket.join(`user:${userId}`)
        
        // 更新数据库在线状态
        await model.updateOnlineStatus(userId, userName, true, socket.id)
        
        // 广播用户上线事件
        socket.broadcast.emit('user:status', { userId, isOnline: true })
        
        console.log(`[Socket] 用户上线: ${userName} (${userId})`)
      } catch (error) {
        console.error('[Socket] 用户上线失败:', error)
      }
    })
    
    // 用户下线
    socket.on('user:offline', async (data) => {
      await handleUserOffline(socket.id)
    })
    
    // 加入会话房间
    socket.on('conversation:join', (data) => {
      const { conversationId } = data
      if (conversationId) {
        socket.join(`conv:${conversationId}`)
        console.log(`[Socket] ${socket.id} 加入会话: ${conversationId}`)
      }
    })
    
    // 离开会话房间
    socket.on('conversation:leave', (data) => {
      const { conversationId } = data
      if (conversationId) {
        socket.leave(`conv:${conversationId}`)
        console.log(`[Socket] ${socket.id} 离开会话: ${conversationId}`)
      }
    })
    
    // 发送消息
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, senderId, senderName, senderAvatar, content, msgType, replyToId, replyToContent, mentionedUsers, relatedType, relatedId, relatedTitle, fileUrl, fileName, fileSize } = data
        
        // 保存消息到数据库
        const message = await model.sendMessage({
          conversationId,
          senderId,
          senderName,
          senderAvatar,
          content,
          msgType: msgType || 'text',
          replyToId,
          replyToContent,
          mentionedUsers,
          relatedType,
          relatedId,
          relatedTitle,
          fileUrl,
          fileName,
          fileSize
        })
        
        // 广播消息到会话房间
        io.to(`conv:${conversationId}`).emit('message:new', message)
        
        // 获取会话参与者，发送通知给不在房间内的用户
        const participantIds = await model.getConversationParticipantIds(conversationId)
        for (const participantId of participantIds) {
          if (participantId !== senderId) {
            // 发送到用户的个人房间（会显示在消息列表）
            io.to(`user:${participantId}`).emit('conversation:update', {
              conversationId,
              lastMessage: message
            })
          }
        }
        
        console.log(`[Socket] 新消息: ${conversationId} from ${senderName}`)
      } catch (error) {
        console.error('[Socket] 发送消息失败:', error)
        socket.emit('message:error', { error: error.message })
      }
    })
    
    // 撤回消息
    socket.on('message:recall', async (data) => {
      try {
        const { messageId, userId, conversationId } = data
        
        await model.recallMessage(messageId, userId)
        
        // 广播撤回事件
        io.to(`conv:${conversationId}`).emit('message:recalled', { messageId, conversationId })
        
        console.log(`[Socket] 消息撤回: ${messageId}`)
      } catch (error) {
        console.error('[Socket] 撤回消息失败:', error)
        socket.emit('message:error', { error: error.message })
      }
    })
    
    // 正在输入
    socket.on('typing:start', (data) => {
      const { conversationId, userId, userName } = data
      socket.to(`conv:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        userName,
        isTyping: true
      })
    })
    
    // 停止输入
    socket.on('typing:stop', (data) => {
      const { conversationId, userId } = data
      socket.to(`conv:${conversationId}`).emit('typing:update', {
        conversationId,
        userId,
        isTyping: false
      })
    })
    
    // 标记已读
    socket.on('message:read', async (data) => {
      try {
        const { conversationId, userId, lastMessageId } = data
        
        await model.markMessagesAsRead(conversationId, userId, lastMessageId)
        
        // 通知其他人某用户已读
        socket.to(`conv:${conversationId}`).emit('message:read_receipt', {
          conversationId,
          userId,
          lastMessageId
        })
      } catch (error) {
        console.error('[Socket] 标记已读失败:', error)
      }
    })
    
    // 断开连接
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] 断开连接: ${socket.id}, 原因: ${reason}`)
      await handleUserOffline(socket.id)
    })
  })
  
  return io
}

/**
 * 处理用户下线
 */
async function handleUserOffline(socketId) {
  try {
    const userId = socketUserMap.get(socketId)
    if (!userId) return
    
    // 清理映射关系
    socketUserMap.delete(socketId)
    const userSockets = userSocketMap.get(userId)
    if (userSockets) {
      userSockets.delete(socketId)
      
      // 如果用户没有其他连接了，才标记为离线
      if (userSockets.size === 0) {
        userSocketMap.delete(userId)
        
        // 更新数据库在线状态
        await model.updateOnlineStatus(userId, null, false, null)
        
        console.log(`[Socket] 用户下线: ${userId}`)
      }
    }
  } catch (error) {
    console.error('[Socket] 处理用户下线失败:', error)
  }
}

/**
 * 发送系统通知到指定用户
 */
export function sendNotification(io, userId, notification) {
  io.to(`user:${userId}`).emit('notification', notification)
}

/**
 * 广播系统公告
 */
export function broadcastAnnouncement(io, announcement) {
  io.emit('announcement', announcement)
}

/**
 * 获取在线用户数量
 */
export function getOnlineUserCount() {
  return userSocketMap.size
}

/**
 * 检查用户是否在线
 */
export function isUserOnline(userId) {
  const sockets = userSocketMap.get(userId)
  return sockets && sockets.size > 0
}

export default {
  initSocketServer,
  sendNotification,
  broadcastAnnouncement,
  getOnlineUserCount,
  isUserOnline
}
