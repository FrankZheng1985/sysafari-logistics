/* eslint-disable react-refresh/only-export-components */
/**
 * Socket.io 上下文
 * 管理WebSocket连接和实时消息
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

// 获取 Socket 服务器地址（阿里云部署）
function getSocketUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001'
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    
    // 演示环境 -> 演示 API
    if (hostname === 'demo.xianfeng-eu.com') {
      return 'https://demo-api.xianfeng-eu.com'
    }
    
    // 生产环境 -> 阿里云 API
    if (hostname === 'erp.xianfeng-eu.com') {
      return 'https://api.xianfeng-eu.com'
    }
  }
  
  return window.location.origin
}

// 全局 socket 实例（避免 StrictMode 重复创建）
let globalSocket: Socket | null = null
let globalSocketUserId: string | null = null

// 消息类型
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
  content: string
  msg_type: 'text' | 'image' | 'file' | 'system'
  file_url?: string
  file_name?: string
  file_size?: number
  reply_to_id?: string
  reply_to_content?: string
  mentioned_users?: string
  related_type?: string
  related_id?: string
  related_title?: string
  is_recalled: number
  created_at: string
}

// 会话类型
export interface Conversation {
  id: string
  type: 'private' | 'group'
  name: string
  avatar?: string
  description?: string
  creator_id?: string
  creator_name?: string
  last_message_id?: string
  last_message_content?: string
  last_message_time?: string
  member_count: number
  is_active: number
  unread_count: number
  is_pinned: number
  is_muted: number
  my_role?: string
  other_user?: {
    user_id: string
    user_name: string
    user_avatar?: string
  }
  participants?: Array<{
    user_id: string
    user_name: string
    user_avatar?: string
    role: string
  }>
}

// 通知类型
export interface Notification {
  id: string
  type: string
  title: string
  content: string
  related_type?: string
  related_id?: string
  created_at: string
}

// 上下文类型
interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  // 会话操作
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void
  // 消息操作
  sendMessage: (data: {
    conversationId: string
    content: string
    msgType?: 'text' | 'image' | 'file'
    replyToId?: string
    replyToContent?: string
    mentionedUsers?: string[]
    relatedType?: string
    relatedId?: string
    relatedTitle?: string
    fileUrl?: string
    fileName?: string
    fileSize?: number
  }) => void
  recallMessage: (messageId: string, conversationId: string) => void
  markAsRead: (conversationId: string, lastMessageId: string) => void
  // 输入状态
  startTyping: (conversationId: string) => void
  stopTyping: (conversationId: string) => void
  // 事件监听
  onNewMessage: (callback: (message: ChatMessage) => void) => () => void
  onMessageRecalled: (callback: (data: { messageId: string; conversationId: string }) => void) => () => void
  onConversationUpdate: (callback: (data: { conversationId: string; lastMessage: ChatMessage }) => void) => () => void
  onTypingUpdate: (callback: (data: { conversationId: string; userId: string; userName?: string; isTyping: boolean }) => void) => () => void
  onUserStatus: (callback: (data: { userId: string; isOnline: boolean }) => void) => () => void
  onNotification: (callback: (notification: Notification) => void) => () => void
  onReadReceipt: (callback: (data: { conversationId: string; userId: string; lastMessageId: string }) => void) => () => void
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  // 使用 ref 追踪组件是否仍然挂载（避免 StrictMode 警告）
  const isMountedRef = useRef(true)
  const userRef = useRef(user)
  
  // 保持 userRef 最新
  useEffect(() => {
    userRef.current = user
  }, [user])

  // 初始化 Socket 连接
  useEffect(() => {
    isMountedRef.current = true
    
    if (!isAuthenticated || !user?.id) {
      // 未登录，断开连接
      if (globalSocket && globalSocketUserId) {
        globalSocket.emit('user:offline', { userId: globalSocketUserId })
        globalSocket.disconnect()
        globalSocket = null
        globalSocketUserId = null
      }
      setSocket(null)
      setIsConnected(false)
      return
    }

    // 如果已有相同用户的连接（无论是否已连接成功），直接复用
    if (globalSocket && globalSocketUserId === user.id) {
      setSocket(globalSocket)
      setIsConnected(globalSocket.connected)
      
      // 如果已经连接，发送上线事件
      if (globalSocket.connected) {
        globalSocket.emit('user:online', {
          userId: user.id,
          userName: user.name || user.username,
        })
      }
      return
    }
    
    // 如果有旧的不同用户的连接，先断开
    if (globalSocket && globalSocketUserId !== user.id) {
      globalSocket.emit('user:offline', { userId: globalSocketUserId })
      globalSocket.disconnect()
      globalSocket = null
      globalSocketUserId = null
    }

    // 创建 Socket 连接
    const socketUrl = getSocketUrl()
    const newSocket = io(socketUrl, {
      // 优先使用 websocket，polling 作为备用
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: import.meta.env.DEV ? 3 : 5,  // 减少重试次数
      reconnectionDelay: 5000,  // 增加重连间隔到5秒
      reconnectionDelayMax: 30000,  // 最大30秒
      timeout: 20000,
      autoConnect: true,
      // 生产环境添加路径前缀
      path: '/socket.io/',
    })
    
    // 存储全局引用
    globalSocket = newSocket
    globalSocketUserId = user.id

    // 连接成功
    newSocket.on('connect', () => {
      // 只有在组件仍然挂载时才更新状态
      if (!isMountedRef.current) return
      
      console.log('[Socket] 已连接:', newSocket.id)
      setIsConnected(true)
      
      // 发送用户上线事件
      const currentUser = userRef.current
      if (currentUser) {
        newSocket.emit('user:online', {
          userId: currentUser.id,
          userName: currentUser.name || currentUser.username,
        })
      }
    })

    // 断开连接
    newSocket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return
      console.log('[Socket] 断开连接:', reason)
      setIsConnected(false)
    })

    // 连接错误 - 静默处理，避免控制台噪音
    newSocket.on('connect_error', () => {
      if (!isMountedRef.current) return
      // 静默处理连接错误，不打印到控制台
      setIsConnected(false)
    })

    setSocket(newSocket)

    // 清理函数 - 在 StrictMode 下不立即断开连接
    return () => {
      isMountedRef.current = false
      // 注意：不在这里断开连接，让全局实例保持
      // 只有在用户登出或切换用户时才断开
    }
  }, [isAuthenticated, user?.id])

  // 加入会话
  const joinConversation = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('conversation:join', { conversationId })
    }
  }, [socket, isConnected])

  // 离开会话
  const leaveConversation = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('conversation:leave', { conversationId })
    }
  }, [socket, isConnected])

  // 发送消息
  const sendMessage = useCallback((data: {
    conversationId: string
    content: string
    msgType?: 'text' | 'image' | 'file'
    replyToId?: string
    replyToContent?: string
    mentionedUsers?: string[]
    relatedType?: string
    relatedId?: string
    relatedTitle?: string
    fileUrl?: string
    fileName?: string
    fileSize?: number
  }) => {
    if (socket && isConnected && user) {
      socket.emit('message:send', {
        ...data,
        senderId: user.id,
        senderName: user.name || user.username,
        senderAvatar: user.avatar,
      })
    }
  }, [socket, isConnected, user])

  // 撤回消息
  const recallMessage = useCallback((messageId: string, conversationId: string) => {
    if (socket && isConnected && user) {
      socket.emit('message:recall', {
        messageId,
        conversationId,
        userId: user.id,
      })
    }
  }, [socket, isConnected, user])

  // 标记已读
  const markAsRead = useCallback((conversationId: string, lastMessageId: string) => {
    if (socket && isConnected && user) {
      socket.emit('message:read', {
        conversationId,
        userId: user.id,
        lastMessageId,
      })
    }
  }, [socket, isConnected, user])

  // 开始输入
  const startTyping = useCallback((conversationId: string) => {
    if (socket && isConnected && user) {
      socket.emit('typing:start', {
        conversationId,
        userId: user.id,
        userName: user.name || user.username,
      })
    }
  }, [socket, isConnected, user])

  // 停止输入
  const stopTyping = useCallback((conversationId: string) => {
    if (socket && isConnected && user) {
      socket.emit('typing:stop', {
        conversationId,
        userId: user.id,
      })
    }
  }, [socket, isConnected, user])

  // 监听新消息
  const onNewMessage = useCallback((callback: (message: ChatMessage) => void) => {
    if (!socket) return () => {}
    socket.on('message:new', callback)
    return () => socket.off('message:new', callback)
  }, [socket])

  // 监听消息撤回
  const onMessageRecalled = useCallback((callback: (data: { messageId: string; conversationId: string }) => void) => {
    if (!socket) return () => {}
    socket.on('message:recalled', callback)
    return () => socket.off('message:recalled', callback)
  }, [socket])

  // 监听会话更新
  const onConversationUpdate = useCallback((callback: (data: { conversationId: string; lastMessage: ChatMessage }) => void) => {
    if (!socket) return () => {}
    socket.on('conversation:update', callback)
    return () => socket.off('conversation:update', callback)
  }, [socket])

  // 监听输入状态
  const onTypingUpdate = useCallback((callback: (data: { conversationId: string; userId: string; userName?: string; isTyping: boolean }) => void) => {
    if (!socket) return () => {}
    socket.on('typing:update', callback)
    return () => socket.off('typing:update', callback)
  }, [socket])

  // 监听用户状态
  const onUserStatus = useCallback((callback: (data: { userId: string; isOnline: boolean }) => void) => {
    if (!socket) return () => {}
    socket.on('user:status', callback)
    return () => socket.off('user:status', callback)
  }, [socket])

  // 监听通知
  const onNotification = useCallback((callback: (notification: Notification) => void) => {
    if (!socket) return () => {}
    socket.on('notification', callback)
    return () => socket.off('notification', callback)
  }, [socket])

  // 监听已读回执
  const onReadReceipt = useCallback((callback: (data: { conversationId: string; userId: string; lastMessageId: string }) => void) => {
    if (!socket) return () => {}
    socket.on('message:read_receipt', callback)
    return () => socket.off('message:read_receipt', callback)
  }, [socket])

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinConversation,
        leaveConversation,
        sendMessage,
        recallMessage,
        markAsRead,
        startTyping,
        stopTyping,
        onNewMessage,
        onMessageRecalled,
        onConversationUpdate,
        onTypingUpdate,
        onUserStatus,
        onNotification,
        onReadReceipt,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export default SocketContext
