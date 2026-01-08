/**
 * 新建聊天弹窗组件
 */

import { useState, useEffect } from 'react'
import { 
  X, 
  Search, 
  Users, 
  MessageSquare, 
  Check,
  Plus
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api'

const API_BASE = getApiBaseUrl()

interface User {
  id: string
  username: string
  name: string
  avatar?: string
  email?: string
  department?: string
}

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onChatCreated: (conversationId: string) => void
}

export default function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<'private' | 'group'>('private')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  // 加载用户列表
  const fetchUsers = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: user.id,
      })
      if (searchKeyword) {
        params.append('keyword', searchKeyword)
      }
      
      const response = await fetch(`${API_BASE}/api/chat/users/chatable?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setUsers(data.data || [])
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
      setSelectedUsers([])
      setGroupName('')
      setSearchKeyword('')
    }
  }, [isOpen, user?.id])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchUsers()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchKeyword])

  // 选择/取消选择用户
  const toggleSelectUser = (targetUser: User) => {
    if (mode === 'private') {
      // 私聊直接创建
      createPrivateChat(targetUser)
    } else {
      // 群聊选择多个用户
      setSelectedUsers(prev => {
        const exists = prev.find(u => u.id === targetUser.id)
        if (exists) {
          return prev.filter(u => u.id !== targetUser.id)
        }
        return [...prev, targetUser]
      })
    }
  }

  // 创建私聊
  const createPrivateChat = async (targetUser: User) => {
    if (!user) return
    
    setCreating(true)
    try {
      const response = await fetch(`${API_BASE}/api/chat/conversations/private`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          userId1: user.id,
          userName1: user.name || user.username,
          userAvatar1: user.avatar,
          userId2: targetUser.id,
          userName2: targetUser.name || targetUser.username,
          userAvatar2: targetUser.avatar,
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200 && data.data?.id) {
        onChatCreated(data.data.id)
        onClose()
      } else {
        alert(data.msg || '创建会话失败')
      }
    } catch (error) {
      console.error('创建私聊失败:', error)
      alert('创建会话失败')
    } finally {
      setCreating(false)
    }
  }

  // 创建群聊
  const createGroupChat = async () => {
    if (!user || selectedUsers.length < 2) {
      alert('群聊至少需要选择2位成员')
      return
    }
    
    if (!groupName.trim()) {
      alert('请输入群名称')
      return
    }
    
    setCreating(true)
    try {
      const response = await fetch(`${API_BASE}/api/chat/conversations/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: groupName.trim(),
          creatorId: user.id,
          creatorName: user.name || user.username,
          creatorAvatar: user.avatar,
          members: selectedUsers.map(u => ({
            userId: u.id,
            userName: u.name || u.username,
            userAvatar: u.avatar,
          }))
        })
      })
      
      const data = await response.json()
      if (data.errCode === 200 && data.data?.id) {
        onChatCreated(data.data.id)
        onClose()
      } else {
        alert(data.msg || '创建群聊失败')
      }
    } catch (error) {
      console.error('创建群聊失败:', error)
      alert('创建群聊失败')
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {mode === 'private' ? '发起私聊' : '创建群聊'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模式切换 */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMode('private'); setSelectedUsers([]) }}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                mode === 'private'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              私聊
            </button>
            <button
              onClick={() => setMode('group')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                mode === 'group'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              群聊
            </button>
          </div>
        </div>

        {/* 群聊名称（仅群聊模式） */}
        {mode === 'group' && (
          <div className="px-6 py-3 border-b border-gray-200">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="输入群名称"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        )}

        {/* 已选成员（仅群聊模式） */}
        {mode === 'group' && selectedUsers.length > 0 && (
          <div className="px-6 py-2 border-b border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">已选 {selectedUsers.length} 人:</span>
              {selectedUsers.map(u => (
                <span
                  key={u.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-full"
                >
                  {u.name || u.username}
                  <button
                    onClick={() => toggleSelectUser(u)}
                    className="hover:text-primary-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 搜索 */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索用户..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* 用户列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              加载中...
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Users className="w-10 h-10 mb-2 opacity-50" />
              <span className="text-sm">暂无可用用户</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map(targetUser => {
                const isSelected = selectedUsers.some(u => u.id === targetUser.id)
                
                return (
                  <div
                    key={targetUser.id}
                    onClick={() => toggleSelectUser(targetUser)}
                    className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* 头像 */}
                    {targetUser.avatar ? (
                      <img
                        src={targetUser.avatar}
                        alt={targetUser.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                        <span className="text-sm font-medium">
                          {(targetUser.name || targetUser.username)?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {targetUser.name || targetUser.username}
                      </p>
                      {targetUser.department && (
                        <p className="text-xs text-gray-500 truncate">
                          {targetUser.department}
                        </p>
                      )}
                    </div>

                    {/* 选中状态（群聊模式） */}
                    {mode === 'group' && (
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部按钮（仅群聊模式） */}
        {mode === 'group' && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={createGroupChat}
              disabled={creating || selectedUsers.length < 2 || !groupName.trim()}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '创建中...' : `创建群聊 (${selectedUsers.length + 1}人)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
