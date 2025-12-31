/**
 * 消息项组件
 */

import { useState } from 'react'
import { 
  CornerUpLeft, 
  MoreHorizontal, 
  Copy, 
  Trash2,
  FileText,
  Image as ImageIcon,
  Download
} from 'lucide-react'
import { type ChatMessage } from '../../contexts/SocketContext'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'

interface MessageItemProps {
  message: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  onReply: () => void
}

export default function MessageItem({ message, isOwn, showAvatar, onReply }: MessageItemProps) {
  const { user } = useAuth()
  const { recallMessage } = useSocket()
  const [showMenu, setShowMenu] = useState(false)

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // 复制消息
  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content)
    }
    setShowMenu(false)
  }

  // 撤回消息
  const handleRecall = () => {
    if (isOwn) {
      recallMessage(message.id, message.conversation_id)
    }
    setShowMenu(false)
  }

  // 检查是否可以撤回（2分钟内）
  const canRecall = isOwn && !message.is_recalled && 
    (Date.now() - new Date(message.created_at).getTime() < 2 * 60 * 1000)

  // 渲染消息内容
  const renderContent = () => {
    // 已撤回的消息
    if (message.is_recalled) {
      return (
        <span className="text-gray-400 italic text-sm">消息已撤回</span>
      )
    }

    // 系统消息
    if (message.msg_type === 'system') {
      return (
        <div className="text-center py-2">
          <span className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
            {message.content}
          </span>
        </div>
      )
    }

    // 图片消息
    if (message.msg_type === 'image' && message.file_url) {
      return (
        <div className="max-w-xs">
          <img
            src={message.file_url}
            alt="图片"
            className="rounded-lg max-w-full cursor-pointer hover:opacity-90"
            onClick={() => window.open(message.file_url, '_blank')}
          />
        </div>
      )
    }

    // 文件消息
    if (message.msg_type === 'file' && message.file_url) {
      return (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          isOwn ? 'bg-primary-500' : 'bg-white border border-gray-200'
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isOwn ? 'bg-primary-400' : 'bg-gray-100'
          }`}>
            <FileText className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-gray-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {message.file_name || '文件'}
            </p>
            {message.file_size && (
              <p className={`text-xs ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>
                {(message.file_size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <a
            href={message.file_url}
            download={message.file_name}
            className={`p-1 rounded hover:opacity-80 ${
              isOwn ? 'text-white' : 'text-gray-500'
            }`}
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      )
    }

    // 文本消息
    return (
      <div>
        {/* 回复引用 */}
        {message.reply_to_content && (
          <div className={`mb-1 px-2 py-1 text-xs rounded ${
            isOwn 
              ? 'bg-primary-400 text-primary-100' 
              : 'bg-gray-100 text-gray-500'
          }`}>
            <span className="block truncate">{message.reply_to_content}</span>
          </div>
        )}
        
        {/* 关联业务 */}
        {message.related_type && message.related_title && (
          <div className={`mb-1 px-2 py-1 text-xs rounded flex items-center gap-1 ${
            isOwn 
              ? 'bg-primary-400 text-primary-100' 
              : 'bg-blue-50 text-blue-600'
          }`}>
            <span className="truncate">📎 {message.related_title}</span>
          </div>
        )}
        
        {/* 消息文本 */}
        <p className={`text-sm whitespace-pre-wrap break-words ${
          isOwn ? 'text-white' : 'text-gray-900'
        }`}>
          {message.content}
        </p>
      </div>
    )
  }

  // 系统消息单独渲染
  if (message.msg_type === 'system') {
    return renderContent()
  }

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      {showAvatar ? (
        <div className="flex-shrink-0">
          {message.sender_avatar ? (
            <img
              src={message.sender_avatar}
              alt={message.sender_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isOwn ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <span className="text-sm font-medium">
                {message.sender_name?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* 消息内容 */}
      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* 发送者名称（群聊显示） */}
        {showAvatar && !isOwn && (
          <span className="text-xs text-gray-500 mb-1 ml-1">
            {message.sender_name}
          </span>
        )}
        
        {/* 消息气泡 */}
        <div className="relative group">
          <div className={`px-3 py-2 rounded-lg ${
            message.is_recalled
              ? 'bg-gray-100'
              : isOwn 
                ? 'bg-primary-600 text-white' 
                : 'bg-white border border-gray-200'
          }`}>
            {renderContent()}
          </div>

          {/* 操作按钮 */}
          {!message.is_recalled && (
            <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
              isOwn ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
            }`}>
              <button
                onClick={onReply}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="回复"
              >
                <CornerUpLeft className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className={`absolute top-full mt-1 w-28 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 ${
                      isOwn ? 'right-0' : 'left-0'
                    }`}>
                      <button
                        onClick={handleCopy}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        复制
                      </button>
                      {canRecall && (
                        <button
                          onClick={handleRecall}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          撤回
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 时间 */}
        <span className={`text-xs text-gray-400 mt-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  )
}
