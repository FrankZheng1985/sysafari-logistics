/**
 * 聊天窗口组件
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Send, 
  Smile, 
  Paperclip, 
  Image as ImageIcon, 
  MoreVertical,
  Phone,
  Video,
  Users,
  Pin,
  BellOff,
  Bell,
  Trash2,
  LogOut,
  ChevronLeft,
  Check,
  CheckCheck,
  X
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket, type Conversation, type ChatMessage } from '../../contexts/SocketContext'
import { getApiBaseUrl } from '../../utils/api'
import MessageItem from './MessageItem'

const API_BASE = getApiBaseUrl()

interface ChatWindowProps {
  conversation: Conversation
  onBack?: () => void
  onOpenGroupInfo?: () => void
}

export default function ChatWindow({ conversation, onBack, onOpenGroupInfo }: ChatWindowProps) {
  const { user } = useAuth()
  const { 
    joinConversation, 
    leaveConversation, 
    sendMessage: socketSendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    onNewMessage,
    onMessageRecalled,
    onTypingUpdate
  } = useSocket()
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const [showMenu, setShowMenu] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 获取会话名称
  const conversationName = conversation.type === 'private'
    ? conversation.other_user?.user_name || conversation.name
    : conversation.name

  // 加载消息
  const fetchMessages = async () => {
    if (!conversation.id) return
    
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/chat/conversations/${conversation.id}/messages?limit=50`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setMessages(data.data || [])
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加入会话房间
  useEffect(() => {
    if (conversation.id) {
      joinConversation(conversation.id)
      fetchMessages()
      
      return () => {
        leaveConversation(conversation.id)
      }
    }
  }, [conversation.id])

  // 监听新消息
  useEffect(() => {
    const unsubscribe = onNewMessage((message) => {
      if (message.conversation_id === conversation.id) {
        setMessages(prev => [...prev, message])
        
        // 标记已读
        if (user?.id && message.sender_id !== user.id) {
          markAsRead(conversation.id, message.id)
        }
      }
    })
    
    return unsubscribe
  }, [conversation.id, user?.id, onNewMessage, markAsRead])

  // 监听消息撤回
  useEffect(() => {
    const unsubscribe = onMessageRecalled(({ messageId, conversationId }) => {
      if (conversationId === conversation.id) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, is_recalled: 1, content: '消息已撤回' }
            : msg
        ))
      }
    })
    
    return unsubscribe
  }, [conversation.id, onMessageRecalled])

  // 监听输入状态
  useEffect(() => {
    const unsubscribe = onTypingUpdate(({ conversationId, userId, userName, isTyping }) => {
      if (conversationId === conversation.id && userId !== user?.id) {
        setTypingUsers(prev => {
          const next = new Map(prev)
          if (isTyping && userName) {
            next.set(userId, userName)
          } else {
            next.delete(userId)
          }
          return next
        })
      }
    })
    
    return unsubscribe
  }, [conversation.id, user?.id, onTypingUpdate])

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 标记已读
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.sender_id !== user.id) {
        markAsRead(conversation.id, lastMessage.id)
      }
    }
  }, [messages, conversation.id, user?.id, markAsRead])

  // 处理输入
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    
    // 发送正在输入状态
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    startTyping(conversation.id)
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversation.id)
    }, 2000)
  }

  // 发送消息
  const handleSendMessage = async () => {
    const content = inputValue.trim()
    if (!content || sending) return
    
    setSending(true)
    try {
      socketSendMessage({
        conversationId: conversation.id,
        content,
        msgType: 'text',
        replyToId: replyTo?.id,
        replyToContent: replyTo?.content?.substring(0, 50),
      })
      
      setInputValue('')
      setReplyTo(null)
      stopTyping(conversation.id)
    } catch (error) {
      console.error('发送消息失败:', error)
    } finally {
      setSending(false)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 回复消息
  const handleReply = (message: ChatMessage) => {
    setReplyTo(message)
    inputRef.current?.focus()
  }

  // 设置置顶/免打扰
  const handleSetPinned = async () => {
    try {
      await fetch(`${API_BASE}/api/chat/conversations/${conversation.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, isPinned: !conversation.is_pinned })
      })
      setShowMenu(false)
    } catch (error) {
      console.error('设置置顶失败:', error)
    }
  }

  const handleSetMuted = async () => {
    try {
      await fetch(`${API_BASE}/api/chat/conversations/${conversation.id}/mute`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, isMuted: !conversation.is_muted })
      })
      setShowMenu(false)
    } catch (error) {
      console.error('设置免打扰失败:', error)
    }
  }

  // 格式化正在输入提示
  const typingText = typingUsers.size > 0
    ? Array.from(typingUsers.values()).join(', ') + ' 正在输入...'
    : ''

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg lg:hidden"
              title="返回"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          
          {/* 头像 */}
          <div className="relative">
            {conversation.avatar || conversation.other_user?.user_avatar ? (
              <img
                src={conversation.avatar || conversation.other_user?.user_avatar}
                alt={conversationName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                conversation.type === 'group'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-green-100 text-green-600'
              }`}>
                {conversation.type === 'group' ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <span className="text-lg font-medium">
                    {conversationName?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-900">{conversationName}</h3>
            {conversation.type === 'group' ? (
              <p className="text-xs text-gray-500">{conversation.member_count} 位成员</p>
            ) : typingText ? (
              <p className="text-xs text-primary-600">{typingText}</p>
            ) : null}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          {conversation.type === 'group' && onOpenGroupInfo && (
            <button
              onClick={onOpenGroupInfo}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="群信息"
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="更多"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={handleSetPinned}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Pin className="w-4 h-4" />
                    {conversation.is_pinned ? '取消置顶' : '置顶会话'}
                  </button>
                  <button
                    onClick={handleSetMuted}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {conversation.is_muted ? (
                      <>
                        <Bell className="w-4 h-4" />
                        开启通知
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4" />
                        免打扰
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Send className="w-10 h-10 mb-2 opacity-50" />
            <span className="text-sm">暂无消息，发送第一条消息吧</span>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                isOwn={message.sender_id === user?.id}
                showAvatar={
                  index === 0 ||
                  messages[index - 1].sender_id !== message.sender_id
                }
                onReply={() => handleReply(message)}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 回复提示 */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-500">回复 {replyTo.sender_name}:</span>
            <p className="text-xs text-gray-600 truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="取消回复"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 输入区域 */}
      <div className="px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              className="w-full px-4 py-2 pr-20 text-sm border border-gray-300 rounded-lg resize-none focus:ring-primary-500 focus:border-primary-500"
              style={{ maxHeight: '120px' }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                className="p-1 text-gray-400 hover:text-gray-600"
                title="表情"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                className="p-1 text-gray-400 hover:text-gray-600"
                title="图片"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                className="p-1 text-gray-400 hover:text-gray-600"
                title="文件"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || sending}
            className="flex-shrink-0 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="发送"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
