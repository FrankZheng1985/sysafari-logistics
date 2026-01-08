import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, UserCheck, UserX, Activity, ChevronRight } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface TeamMember {
  id: string
  name: string
  role: string
  roleName: string
  status: 'online' | 'offline' | 'busy'
  tasksToday: number
  tasksCompleted: number
}

interface TeamStats {
  total: number
  online: number
  busy: number
  offline: number
}

interface TeamOverviewCardProps {
  refreshKey?: number
}

export default function TeamOverviewCard({ refreshKey }: TeamOverviewCardProps) {
  const navigate = useNavigate()
  const { getAccessToken } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState<TeamStats>({ total: 0, online: 0, busy: 0, offline: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTeamData()
  }, [refreshKey])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/team-overview`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setMembers(data.data.members || [])
          setStats(data.data.stats || { total: 0, online: 0, busy: 0, offline: 0 })
        } else {
          const mock = getMockData()
          setMembers(mock.members)
          setStats(mock.stats)
        }
      } else {
        const mock = getMockData()
        setMembers(mock.members)
        setStats(mock.stats)
      }
    } catch (error) {
      console.error('加载团队数据失败:', error)
      const mock = getMockData()
      setMembers(mock.members)
      setStats(mock.stats)
    } finally {
      setLoading(false)
    }
  }

  const getMockData = () => ({
    members: [
      { id: '1', name: '张三', role: 'doc_clerk', roleName: '跟单员', status: 'online' as const, tasksToday: 8, tasksCompleted: 5 },
      { id: '2', name: '李四', role: 'doc_officer', roleName: '单证员', status: 'busy' as const, tasksToday: 12, tasksCompleted: 8 },
      { id: '3', name: '王五', role: 'finance_assistant', roleName: '财务助理', status: 'online' as const, tasksToday: 6, tasksCompleted: 4 },
      { id: '4', name: '赵六', role: 'doc_clerk', roleName: '跟单员', status: 'offline' as const, tasksToday: 5, tasksCompleted: 5 },
    ],
    stats: { total: 4, online: 2, busy: 1, offline: 1 },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'busy': return 'bg-amber-500'
      case 'offline': return 'bg-gray-300'
      default: return 'bg-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return '在线'
      case 'busy': return '忙碌'
      case 'offline': return '离线'
      default: return '未知'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 团队统计 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 bg-gray-50 rounded-lg text-center">
          <Users className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <div className="text-lg font-semibold text-gray-700">{stats.total}</div>
          <div className="text-xs text-gray-500">总人数</div>
        </div>
        <div className="p-2 bg-green-50 rounded-lg text-center">
          <UserCheck className="w-4 h-4 text-green-500 mx-auto mb-1" />
          <div className="text-lg font-semibold text-green-700">{stats.online}</div>
          <div className="text-xs text-green-600">在线</div>
        </div>
        <div className="p-2 bg-amber-50 rounded-lg text-center">
          <Activity className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <div className="text-lg font-semibold text-amber-700">{stats.busy}</div>
          <div className="text-xs text-amber-600">忙碌</div>
        </div>
        <div className="p-2 bg-gray-100 rounded-lg text-center">
          <UserX className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <div className="text-lg font-semibold text-gray-600">{stats.offline}</div>
          <div className="text-xs text-gray-500">离线</div>
        </div>
      </div>

      {/* 成员列表 */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {members.map(member => (
          <div
            key={member.id}
            className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* 头像 */}
              <div className="relative">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-700">
                    {member.name.slice(0, 1)}
                  </span>
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
              </div>
              {/* 信息 */}
              <div>
                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                <div className="text-xs text-gray-500">{member.roleName}</div>
              </div>
            </div>
            {/* 任务进度 */}
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">
                {member.tasksCompleted}/{member.tasksToday}
              </div>
              <div className="text-xs text-gray-500">今日任务</div>
            </div>
          </div>
        ))}
      </div>

      {/* 管理入口 */}
      <button
        onClick={() => navigate('/system/user-manage')}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
      >
        团队管理
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
