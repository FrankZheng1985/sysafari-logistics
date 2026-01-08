/**
 * 聊天窗口组件
 */

import { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Smile, 
  Paperclip, 
  Image as ImageIcon, 
  MoreVertical,
  Users,
  Pin,
  BellOff,
  Bell,
  ChevronLeft,
  X,
  Loader2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket, type Conversation, type ChatMessage } from '../../contexts/SocketContext'
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api'
import MessageItem from './MessageItem'

const API_BASE = getApiBaseUrl()

// 常用表情列表
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
  '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
  '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤',
  '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
  '💯', '💢', '💥', '💫', '💦', '💨', '🎉', '🎊'
]

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

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

  // 处理粘贴事件（支持粘贴截图）
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      // 检查是否是图片
      if (item.type.startsWith('image/')) {
        e.preventDefault() // 阻止默认粘贴行为
        
        const file = item.getAsFile()
        if (!file) continue
        
        // 验证文件大小（最大 10MB）
        if (file.size > 10 * 1024 * 1024) {
          alert('图片大小不能超过 10MB')
          return
        }
        
        // 生成文件名（截图没有文件名）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = `screenshot_${timestamp}.png`
        
        // 创建带文件名的新 File 对象
        const namedFile = new File([file], fileName, { type: file.type })
        
        setUploading(true)
        try {
          const result = await uploadFile(namedFile)
          if (result && result.url) {
            // 发送图片消息
            socketSendMessage({
              conversationId: conversation.id,
              content: '[截图]',
              msgType: 'image',
              fileUrl: result.url,
              fileName: result.name,
              fileSize: result.size
            })
          } else {
            alert(`截图上传失败：${result?.error || '未知错误'}`)
          }
        } finally {
          setUploading(false)
        }
        
        return // 只处理第一张图片
      }
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

  // 点击外部关闭表情选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  // 插入表情
  const handleEmojiSelect = (emoji: string) => {
    setInputValue(prev => prev + emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  // 上传文件到服务器
  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number; error?: string } | null> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', 'chat')
    formData.append('documentName', file.name)
    formData.append('accessLevel', 'all')
    formData.append('isPublic', 'true')
    
    try {
      console.log('[ChatWindow] 开始上传文件:', file.name, file.size, file.type)
      const response = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        body: formData
      })
      
      console.log('[ChatWindow] 上传响应状态:', response.status, response.statusText)
      
      const data = await response.json()
      console.log('[ChatWindow] 上传响应数据:', data)
      
      // 返回的数据结构: { errCode: 200, data: { cosUrl: '...', ... } }
      if (data.errCode === 200 && data.data?.cosUrl) {
        return {
          url: data.data.cosUrl,
          name: file.name,
          size: file.size
        }
      }
      
      const errorMsg = data.msg || '上传失败'
      console.error('[ChatWindow] 上传失败:', errorMsg)
      return { url: '', name: '', size: 0, error: errorMsg }
    } catch (error) {
      console.error('[ChatWindow] 上传文件异常:', error)
      return { url: '', name: '', size: 0, error: error instanceof Error ? error.message : '网络错误' }
    }
  }

  // 处理图片选择
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }
    
    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB')
      return
    }
    
    setUploading(true)
    try {
      const result = await uploadFile(file)
      if (result && result.url) {
        // 发送图片消息
        socketSendMessage({
          conversationId: conversation.id,
          content: '[图片]',
          msgType: 'image',
          fileUrl: result.url,
          fileName: result.name,
          fileSize: result.size
        })
      } else {
        alert(`图片上传失败：${result?.error || '未知错误'}`)
      }
    } finally {
      setUploading(false)
      // 清空 input，允许重复选择同一文件
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    }
  }

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 验证文件大小（最大 50MB）
    if (file.size > 50 * 1024 * 1024) {
      alert('文件大小不能超过 50MB')
      return
    }
    
    setUploading(true)
    try {
      const result = await uploadFile(file)
      if (result && result.url) {
        // 发送文件消息
        socketSendMessage({
          conversationId: conversation.id,
          content: `[文件] ${result.name}`,
          msgType: 'file',
          fileUrl: result.url,
          fileName: result.name,
          fileSize: result.size
        })
      } else {
        alert(`文件上传失败：${result?.error || '未知错误'}`)
      }
    } finally {
      setUploading(false)
      // 清空 input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

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
            {messages.map((message, index) => {
              // 确保类型一致比较（都转为字符串）
              const senderId = String(message.sender_id).trim()
              const currentUserId = String(user?.id || '').trim()
              const isOwnMessage = senderId === currentUserId
              
              // 调试日志（临时）
              if (index === 0) {
                console.log('[ChatWindow] 用户ID比较:', {
                  messageSenderId: message.sender_id,
                  messageSenderIdType: typeof message.sender_id,
                  userId: user?.id,
                  userIdType: typeof user?.id,
                  senderId,
                  currentUserId,
                  isOwnMessage
                })
              }
              
              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  isOwn={isOwnMessage}
                  showAvatar={
                    index === 0 ||
                    messages[index - 1].sender_id !== message.sender_id
                  }
                  onReply={() => handleReply(message)}
                />
              )
            })}
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
        {/* 隐藏的文件输入框 */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="输入消息...（可直接粘贴截图）"
              rows={1}
              className="w-full px-4 py-2 pr-28 text-sm border border-gray-300 rounded-lg resize-none focus:ring-primary-500 focus:border-primary-500"
              style={{ maxHeight: '120px' }}
              disabled={uploading}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {/* 表情按钮 */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-1 transition-colors ${showEmojiPicker ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="表情"
                  disabled={uploading}
                >
                  <Smile className="w-5 h-5" />
                </button>
                
                {/* 表情选择器 */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50">
                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                      {EMOJI_LIST.map((emoji, index) => (
                        <button
                          key={index}
                          onClick={() => handleEmojiSelect(emoji)}
                          className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 图片按钮 */}
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="发送图片"
                disabled={uploading}
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              {/* 文件按钮 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="发送文件"
                disabled={uploading}
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && !uploading) || sending || uploading}
            className="flex-shrink-0 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={uploading ? '上传中...' : '发送'}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
