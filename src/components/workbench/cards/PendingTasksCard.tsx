import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, Receipt, Truck, AlertTriangle, ChevronRight } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { getApiBaseUrl } from '../../../utils/api'

const API_BASE = getApiBaseUrl()

interface PendingTask {
  id: string
  type: string
  title: string
  count: number
  priority: 'high' | 'medium' | 'low'
  link: string
  icon: typeof Clock
}

interface PendingTasksCardProps {
  refreshKey?: number
}

export default function PendingTasksCard({ refreshKey }: PendingTasksCardProps) {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const [tasks, setTasks] = useState<PendingTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPendingTasks()
  }, [refreshKey, user?.role])

  const loadPendingTasks = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      const response = await fetch(`${API_BASE}/api/workbench/pending-tasks`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.errCode === 200 && data.data) {
          setTasks(data.data)
        } else {
          setTasks([])
        }
      } else {
        setTasks([])
      }
    } catch (error) {
      console.error('加载待办任务失败:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  // 根据角色获取默认待办任务（用于演示）
  const getDefaultTasks = (role: string): PendingTask[] => {
    const tasksByRole: Record<string, PendingTask[]> = {
      operator: [
        { id: '1', type: 'order', title: '待更新状态订单', count: 5, priority: 'high', link: '/bookings/bill', icon: FileText },
        { id: '2', type: 'fee', title: '待录入费用', count: 3, priority: 'medium', link: '/finance/fees', icon: Receipt },
        { id: '3', type: 'tms', title: '运输异常跟进', count: 2, priority: 'high', link: '/tms/exceptions', icon: Truck },
      ],
      doc_clerk: [
        { id: '1', type: 'order', title: '待更新状态订单', count: 8, priority: 'high', link: '/bookings/bill', icon: FileText },
        { id: '2', type: 'tms', title: '待派送订单', count: 12, priority: 'medium', link: '/cmr-manage', icon: Truck },
        { id: '3', type: 'inspection', title: '待查验订单', count: 3, priority: 'high', link: '/inspection/pending', icon: AlertTriangle },
      ],
      doc_officer: [
        { id: '1', type: 'document', title: '待匹配单证', count: 15, priority: 'high', link: '/documents/matching', icon: FileText },
        { id: '2', type: 'document', title: '待补充数据', count: 8, priority: 'medium', link: '/documents/supplement', icon: FileText },
        { id: '3', type: 'document', title: '待计算税费', count: 5, priority: 'medium', link: '/documents/tax-calc', icon: Receipt },
      ],
      finance_assistant: [
        { id: '1', type: 'invoice', title: '待开发票', count: 10, priority: 'high', link: '/finance/invoices', icon: Receipt },
        { id: '2', type: 'payment', title: '待核销收款', count: 6, priority: 'medium', link: '/finance/payments', icon: Receipt },
        { id: '3', type: 'fee', title: '待出账单', count: 4, priority: 'medium', link: '/finance/fees', icon: FileText },
      ],
      finance_director: [
        { id: '1', type: 'approval', title: '待审批付款', count: 5, priority: 'high', link: '/system/approvals', icon: Clock },
        { id: '2', type: 'approval', title: '费用审批', count: 3, priority: 'medium', link: '/finance/fee-approval', icon: Receipt },
        { id: '3', type: 'alert', title: '逾期预警', count: 8, priority: 'high', link: '/finance/invoices?status=overdue', icon: AlertTriangle },
      ],
      manager: [
        { id: '1', type: 'approval', title: '待审批事项', count: 7, priority: 'high', link: '/system/approvals', icon: Clock },
        { id: '2', type: 'exception', title: '异常订单跟进', count: 4, priority: 'high', link: '/tms/exceptions', icon: AlertTriangle },
        { id: '3', type: 'task', title: '团队任务分配', count: 6, priority: 'medium', link: '/crm/customers', icon: FileText },
      ],
      boss: [
        { id: '1', type: 'approval', title: '重要审批', count: 3, priority: 'high', link: '/system/approvals', icon: Clock },
        { id: '2', type: 'alert', title: '重要预警', count: 2, priority: 'high', link: '/system/alerts', icon: AlertTriangle },
      ],
      admin: [
        { id: '1', type: 'approval', title: '待审批事项', count: 5, priority: 'high', link: '/system/approvals', icon: Clock },
        { id: '2', type: 'system', title: '系统告警', count: 1, priority: 'medium', link: '/system/alerts', icon: AlertTriangle },
      ],
    }
    return tasksByRole[role] || tasksByRole.operator
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700'
      case 'medium': return 'bg-amber-100 text-amber-700'
      case 'low': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const totalCount = tasks.reduce((sum, task) => sum + task.count, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 总数提示 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {totalCount} 项待办</span>
        <span className="text-xs text-gray-400">点击查看详情</span>
      </div>

      {/* 任务列表 */}
      <div className="space-y-2">
        {tasks.map(task => {
          const IconComponent = task.icon
          return (
            <div
              key={task.id}
              onClick={() => navigate(task.link)}
              className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded ${getPriorityColor(task.priority)}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <span className="text-sm text-gray-700">{task.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                  {task.count}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </div>
            </div>
          )
        })}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无待办任务</p>
        </div>
      )}
    </div>
  )
}
