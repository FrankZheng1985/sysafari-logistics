/**
 * 业务讨论组件
 * 可嵌入到订单详情、客户详情等页面
 */

import { useState, useEffect, useRef } from 'react'
import { 
  MessageSquare, 
  Send, 
  CornerUpLeft, 
  Trash2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  X,
  RefreshCw,
  AtSign
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Discussion {
  id: number
  business_type: string
  business_id: string
  business_title: string
  user_id: string
  user_name: string
  user_avatar?: string
  content: string
  parent_id?: number
  mentioned_users?: string
  attachment_url?: string
  attachment_name?: string
  created_at: string
  reply_count: number
  recent_replies?: Discussion[]
}

interface BusinessDiscussionProps {
  businessType: 'order' | 'customer' | 'contract' | 'invoice' | 'quotation'
  businessId: string
  businessTitle?: string
  className?: string
  maxHeight?: string
  defaultExpanded?: boolean
}

export default function BusinessDiscussion({
  businessType,
  businessId,
  businessTitle,
  className = '',
  maxHeight = '400px',
  defaultExpanded = true
}: BusinessDiscussionProps) {
  const { user } = useAuth()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [inputValue, setInputValue] = useState('')
  const [replyTo, setReplyTo] = useState<Discussion | null>(null)
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set())
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set())
  const [repliesData, setRepliesData] = useState<Map<number, Discussion[]>>(new Map())
  
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 加载讨论列表
  const fetchDiscussions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        businessType,
        businessId,
        page: page.toString(),
        pageSize: '20'
      })
      
      const response = await fetch(`${API_BASE}/api/chat/discussions?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        if (page === 1) {
          setDiscussions(data.data.list || [])
        } else {
          setDiscussions(prev => [...prev, ...(data.data.list || [])])
        }
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载讨论失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (businessId) {
      fetchDiscussions()
    }
  }, [businessType, businessId, page])

  // 加载回复
  const fetchReplies = async (parentId: number) => {
    setLoadingReplies(prev => new Set(prev).add(parentId))
    try {
      const response = await fetch(`${API_BASE}/api/chat/discussions/${parentId}/replies?pageSize=50`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setRepliesData(prev => {
          const next = new Map(prev)
          next.set(parentId, data.data.list || [])
          return next
        })
      }
    } catch (error) {
      console.error('加载回复失败:', error)
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev)
        next.delete(parentId)
        return next
      })
    }
  }

  // 展开/收起回复
  const toggleReplies = (discussionId: number, replyCount: number) => {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      if (next.has(discussionId)) {
        next.delete(discussionId)
      } else {
        next.add(discussionId)
        // 如果还没有加载过回复，则加载
        if (!repliesData.has(discussionId) && replyCount > 0) {
          fetchReplies(discussionId)
        }
      }
      return next
    })
  }

  // 发送评论
  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || sending || !user?.id) return
    
    setSending(true)
    try {
      const response = await fetch(`${API_BASE}/api/chat/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType,
          businessId,
          businessTitle,
          userId: user.id,
          userName: user.name || user.username,
          userAvatar: user.avatar,
          content,
          parentId: replyTo?.id
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        setInputValue('')
        setReplyTo(null)
        
        // 如果是回复，刷新该评论的回复列表
        if (replyTo) {
          fetchReplies(replyTo.id)
          // 更新回复数
          setDiscussions(prev => prev.map(d => 
            d.id === replyTo.id 
              ? { ...d, reply_count: d.reply_count + 1 }
              : d
          ))
        } else {
          // 刷新整个列表
          setPage(1)
          fetchDiscussions()
        }
      } else {
        alert(data.msg || '发送失败')
      }
    } catch (error) {
      console.error('发送评论失败:', error)
      alert('发送失败')
    } finally {
      setSending(false)
    }
  }

  // 删除评论
  const handleDelete = async (discussionId: number) => {
    if (!confirm('确定删除这条评论吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/chat/discussions/${discussionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        setDiscussions(prev => prev.filter(d => d.id !== discussionId))
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除评论失败:', error)
      alert('删除失败')
    }
  }

  // 回复评论
  const handleReply = (discussion: Discussion) => {
    setReplyTo(discussion)
    inputRef.current?.focus()
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取业务类型标签
  const getBusinessTypeLabel = () => {
    const labels: Record<string, string> = {
      order: '订单',
      customer: '客户',
      contract: '合同',
      invoice: '发票',
      quotation: '报价'
    }
    return labels[businessType] || businessType
  }

  // 渲染单条评论
  const renderDiscussionItem = (discussion: Discussion, isReply = false) => {
    const isOwn = discussion.user_id === user?.id
    const isExpanded = expandedReplies.has(discussion.id)
    const replies = repliesData.get(discussion.id) || []
    const isLoadingReplies = loadingReplies.has(discussion.id)
    
    return (
      <div 
        key={discussion.id} 
        className={`${isReply ? 'ml-10 mt-2' : 'mt-4'}`}
      >
        <div className="flex gap-3">
          {/* 头像 */}
          <div className="flex-shrink-0">
            {discussion.user_avatar ? (
              <img
                src={discussion.user_avatar}
                alt={discussion.user_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                <span className="text-sm font-medium">
                  {discussion.user_name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-900">
                {discussion.user_name}
              </span>
              <span className="text-xs text-gray-400">
                {formatTime(discussion.created_at)}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
              {discussion.content}
            </p>
            
            {/* 操作按钮 */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => handleReply(discussion)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600"
              >
                <CornerUpLeft className="w-3.5 h-3.5" />
                回复
              </button>
              
              {!isReply && discussion.reply_count > 0 && (
                <button
                  onClick={() => toggleReplies(discussion.id, discussion.reply_count)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {discussion.reply_count}条回复
                </button>
              )}
              
              {isOwn && (
                <button
                  onClick={() => handleDelete(discussion.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除
                </button>
              )}
            </div>
            
            {/* 回复列表 */}
            {!isReply && isExpanded && (
              <div className="mt-2 pl-2 border-l-2 border-gray-100">
                {isLoadingReplies ? (
                  <div className="text-xs text-gray-400 py-2">加载中...</div>
                ) : replies.length > 0 ? (
                  replies.map(reply => renderDiscussionItem(reply, true))
                ) : (
                  <div className="text-xs text-gray-400 py-2">暂无回复</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* 头部 */}
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          <span className="text-sm font-medium text-gray-900">
            {getBusinessTypeLabel()}讨论
          </span>
          {total > 0 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPage(1)
              fetchDiscussions()
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* 内容区域 */}
      {expanded && (
        <>
          {/* 讨论列表 */}
          <div 
            className="px-4 overflow-y-auto" 
            style={{ maxHeight }}
          >
            {loading && discussions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                加载中...
              </div>
            ) : discussions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
                <span className="text-sm">暂无讨论</span>
              </div>
            ) : (
              <>
                {discussions.map(discussion => renderDiscussionItem(discussion))}
                
                {/* 加载更多 */}
                {discussions.length < total && (
                  <button
                    onClick={() => setPage(prev => prev + 1)}
                    disabled={loading}
                    className="w-full py-3 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
                  >
                    {loading ? '加载中...' : '加载更多'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* 回复提示 */}
          {replyTo && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500">回复 {replyTo.user_name}:</span>
                <p className="text-xs text-gray-600 truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 输入区域 */}
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={replyTo ? `回复 ${replyTo.user_name}...` : '发表评论...'}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || sending}
                className="flex-shrink-0 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
