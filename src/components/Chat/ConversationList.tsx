/**
 * 会话列表组件
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  MessageSquare, 
  Users, 
  Search, 
  Plus, 
  Pin, 
  BellOff,
  Check,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket, type Conversation } from '../../contexts/SocketContext'
import { getApiBaseUrl } from '../../utils/api'

const API_BASE = getApiBaseUrl()

interface ConversationListProps {
  activeConversationId?: string
  onSelectConversation: (conversation: Conversation) => void
  onNewChat: () => void
  unreadTotal: number
  refreshTrigger?: number
}

export default function ConversationList({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  unreadTotal,
  refreshTrigger
}: ConversationListProps) {
  const { user } = useAuth()
  const { onConversationUpdate, onNewMessage } = useSocket()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filter, setFilter] = useState<'all' | 'private' | 'group'>('all')

  // 加载会话列表
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: user.id,
        pageSize: '100'
      })
      
      if (filter !== 'all') {
        params.append('type', filter)
      }
      
      const response = await fetch(`${API_BASE}/api/chat/conversations?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setConversations(data.data.list || [])
      }
    } catch (error) {
      console.error('加载会话列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, filter])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // 监听外部触发的刷新
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchConversations()
    }
  }, [refreshTrigger, fetchConversations])

  // 监听会话更新事件（新消息、已读状态变化等）
  useEffect(() => {
    const unsubConv = onConversationUpdate(() => {
      // 会话有更新时刷新列表
      fetchConversations()
    })
    
    const unsubMsg = onNewMessage(() => {
      // 收到新消息时刷新列表
      fetchConversations()
    })
    
    return () => {
      unsubConv()
      unsubMsg()
    }
  }, [onConversationUpdate, onNewMessage, fetchConversations])

  // 刷新会话列表
  const refreshConversations = () => {
    fetchConversations()
  }

  // 过滤搜索结果
  const filteredConversations = conversations.filter(conv => {
    if (!searchKeyword) return true
    const name = conv.name || conv.other_user?.user_name || ''
    return name.toLowerCase().includes(searchKeyword.toLowerCase())
  })

  // 格式化时间
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    // 昨天
    if (diff < 48 * 60 * 60 * 1000) {
      return '昨天'
    }
    // 本周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return days[date.getDay()]
    }
    // 更早
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }

  // 获取会话显示名称
  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'private') {
      return conv.other_user?.user_name || conv.name || '私聊'
    }
    return conv.name || '群聊'
  }

  // 获取会话头像
  const getConversationAvatar = (conv: Conversation) => {
    if (conv.type === 'private') {
      return conv.other_user?.user_avatar || conv.avatar
    }
    return conv.avatar
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">消息</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshConversations}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onNewChat}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
              title="新建聊天"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* 筛选标签 */}
        <div className="flex items-center gap-2 mt-3">
          {[
            { value: 'all', label: '全部' },
            { value: 'private', label: '私聊' },
            { value: 'group', label: '群聊' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value as typeof filter)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === item.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
          {unreadTotal > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {unreadTotal > 99 ? '99+' : unreadTotal}
            </span>
          )}
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
            <span className="text-sm">暂无会话</span>
            <button
              onClick={onNewChat}
              className="mt-4 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
            >
              开始新聊天
            </button>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId
              const name = getConversationName(conv)
              const avatar = getConversationAvatar(conv)
              
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    // 选择对话并立即在本地清除未读数
                    onSelectConversation(conv)
                    if (conv.unread_count > 0) {
                      setConversations(prev => prev.map(c => 
                        c.id === conv.id ? { ...c, unread_count: 0 } : c
                      ))
                    }
                  }}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-primary-50 border-l-2 border-primary-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* 头像 */}
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        conv.type === 'group' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {conv.type === 'group' ? (
                          <Users className="w-6 h-6" />
                        ) : (
                          <span className="text-lg font-medium">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                    {/* 未读数 */}
                    {conv.unread_count > 0 && !conv.is_muted && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs bg-red-500 text-white rounded-full">
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {conv.is_pinned === 1 && (
                          <Pin className="w-3 h-3 text-orange-500" />
                        )}
                        <span className={`text-sm truncate ${
                          conv.unread_count > 0 && !conv.is_muted
                            ? 'font-semibold text-gray-900'
                            : 'text-gray-700'
                        }`}>
                          {name}
                        </span>
                        {conv.type === 'group' && (
                          <span className="text-xs text-gray-400">
                            ({conv.member_count})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatTime(conv.last_message_time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${
                        conv.unread_count > 0 && !conv.is_muted
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      }`}>
                        {conv.last_message_content || '暂无消息'}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.is_muted === 1 && (
                          <BellOff className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
