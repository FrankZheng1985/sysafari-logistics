import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Clock, Package, Truck, Users, DollarSign, 
  FileText, Search, Filter, RefreshCw,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { PageContainer, ContentCard, LoadingSpinner, EmptyState } from '../components/ui'
import DatePicker from '../components/DatePicker'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface ActivityLog {
  id: string
  type: 'order' | 'tms' | 'crm' | 'finance' | 'system'
  action: string
  description: string
  time: string
  user: string
  relatedId?: string
  relatedPath?: string
}

// 活动类型配置
const activityTypeConfig = {
  order: { 
    label: '订单', 
    icon: Package, 
    color: 'text-blue-600', 
    bg: 'bg-blue-100',
    path: '/bookings/bill'
  },
  tms: { 
    label: 'TMS', 
    icon: Truck, 
    color: 'text-green-600', 
    bg: 'bg-green-100',
    path: '/cmr-manage'
  },
  crm: { 
    label: 'CRM', 
    icon: Users, 
    color: 'text-purple-600', 
    bg: 'bg-purple-100',
    path: '/crm'
  },
  finance: { 
    label: '财务', 
    icon: DollarSign, 
    color: 'text-amber-600', 
    bg: 'bg-amber-100',
    path: '/finance'
  },
  system: { 
    label: '系统', 
    icon: FileText, 
    color: 'text-gray-600', 
    bg: 'bg-gray-100',
    path: '/system/user-manage'
  },
}

export default function ActivityLogs() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    fetchActivities()
  }, [])

  useEffect(() => {
    filterActivities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, searchValue, typeFilter, dateRange])

  const fetchActivities = async () => {
    setLoading(true)
    try {
      // 尝试从API获取活动日志
      const response = await fetch(`${API_BASE}/api/activity-logs`).then(r => r.json()).catch(() => null)
      
      if (response?.data) {
        setActivities(response.data)
      } else {
        // 使用模拟数据
        const mockActivities: ActivityLog[] = [
          { id: '1', type: 'order', action: '创建订单', description: '创建新提单 COSU1234567', time: '2024-12-13 14:30:00', user: '张三', relatedId: 'COSU1234567', relatedPath: '/bookings/bill' },
          { id: '2', type: 'finance', action: '收款', description: '收到客户付款 ¥15,000', time: '2024-12-13 14:25:00', user: '李四', relatedPath: '/finance/payments' },
          { id: '3', type: 'crm', action: '新增客户', description: '添加新客户: 德国汽车配件公司', time: '2024-12-13 14:20:00', user: '王五', relatedPath: '/crm/customers' },
          { id: '4', type: 'tms', action: '派送完成', description: '订单 MSCU7654321 已送达', time: '2024-12-13 14:15:00', user: '张三', relatedId: 'MSCU7654321', relatedPath: '/cmr-manage/archived' },
          { id: '5', type: 'order', action: '更新状态', description: '提单 EGLV010501130029 已到港', time: '2024-12-13 14:10:00', user: '李四', relatedPath: '/bookings/bill' },
          { id: '6', type: 'finance', action: '开具发票', description: '开具销售发票 SINV202412130001', time: '2024-12-13 14:05:00', user: '王五', relatedPath: '/finance/invoices' },
          { id: '7', type: 'crm', action: '跟进客户', description: '更新客户 ABC Trading 跟进记录', time: '2024-12-13 14:00:00', user: '张三', relatedPath: '/crm/customers' },
          { id: '8', type: 'tms', action: '开始派送', description: '订单 HLCU1122334 开始派送', time: '2024-12-13 13:55:00', user: '李四', relatedPath: '/cmr-manage/delivering' },
          { id: '9', type: 'order', action: '查验放行', description: '提单 COSU8765432 查验放行', time: '2024-12-13 13:50:00', user: '王五', relatedPath: '/inspection-overview' },
          { id: '10', type: 'system', action: '用户登录', description: '管理员登录系统', time: '2024-12-13 13:45:00', user: '系统管理员' },
          { id: '11', type: 'finance', action: '录入费用', description: '录入运费 ¥5,000', time: '2024-12-13 13:40:00', user: '张三', relatedPath: '/finance/fees' },
          { id: '12', type: 'crm', action: '成交机会', description: '销售机会 OPP-001 已成交', time: '2024-12-13 13:35:00', user: '李四', relatedPath: '/crm/opportunities' },
          { id: '13', type: 'order', action: '创建草稿', description: '创建提单草稿 DRAFT-001', time: '2024-12-13 13:30:00', user: '王五', relatedPath: '/bookings/bill/draft' },
          { id: '14', type: 'tms', action: '异常处理', description: '订单 EMCU9876543 异常已解决', time: '2024-12-13 13:25:00', user: '张三', relatedPath: '/cmr-manage/exception' },
          { id: '15', type: 'finance', action: '付款', description: '支付供应商款项 ¥8,500', time: '2024-12-13 13:20:00', user: '李四', relatedPath: '/finance/payments' },
        ]
        setActivities(mockActivities)
      }
    } catch (error) {
      console.error('获取活动日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterActivities = () => {
    let filtered = [...activities]
    
    // 按类型筛选
    if (typeFilter !== 'all') {
      filtered = filtered.filter(a => a.type === typeFilter)
    }
    
    // 按关键词搜索
    if (searchValue.trim()) {
      const keyword = searchValue.toLowerCase()
      filtered = filtered.filter(a => 
        a.description.toLowerCase().includes(keyword) ||
        a.action.toLowerCase().includes(keyword) ||
        a.user.toLowerCase().includes(keyword)
      )
    }
    
    // 按日期筛选
    if (dateRange.start) {
      filtered = filtered.filter(a => a.time >= dateRange.start)
    }
    if (dateRange.end) {
      filtered = filtered.filter(a => a.time <= dateRange.end + ' 23:59:59')
    }
    
    setFilteredActivities(filtered)
    setCurrentPage(1)
  }

  // 分页
  const totalPages = Math.ceil(filteredActivities.length / pageSize)
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleActivityClick = (activity: ActivityLog) => {
    if (activity.relatedPath) {
      navigate(activity.relatedPath)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="系统活动日志"
        icon={<Clock className="w-4 h-4 text-primary-600" />}
        breadcrumbs={[
          { label: '系统概览', path: '/dashboard' },
          { label: '活动日志' }
        ]}
      />

      {/* 筛选区域 */}
      <ContentCard>
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索活动内容、操作者..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchActivities()}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* 类型筛选 */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">全部类型</option>
              <option value="order">订单</option>
              <option value="tms">TMS</option>
              <option value="crm">CRM</option>
              <option value="finance">财务</option>
              <option value="system">系统</option>
            </select>
          </div>

          {/* 日期范围 */}
          <div className="flex items-center gap-2">
            <DatePicker
              value={dateRange.start}
              onChange={(value) => setDateRange(prev => ({ ...prev, start: value }))}
              placeholder="开始日期"
            />
            <span className="text-gray-400 text-xs">至</span>
            <DatePicker
              value={dateRange.end}
              onChange={(value) => setDateRange(prev => ({ ...prev, end: value }))}
              placeholder="结束日期"
            />
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={fetchActivities}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 统计信息 */}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
          <span>共 {filteredActivities.length} 条记录</span>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-3">
            {Object.entries(activityTypeConfig).map(([key, config]) => {
              const count = filteredActivities.filter(a => a.type === key).length
              if (count === 0) return null
              return (
                <span key={key} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${config.bg}`}></span>
                  {config.label}: {count}
                </span>
              )
            })}
          </div>
        </div>
      </ContentCard>

      {/* 活动列表 */}
      <ContentCard noPadding>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : paginatedActivities.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-12 h-12" />}
            title="暂无活动记录"
            description="系统活动记录将显示在这里"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedActivities.map(activity => {
              const config = activityTypeConfig[activity.type]
              const Icon = config.icon
              return (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className={`flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors ${activity.relatedPath ? 'cursor-pointer' : ''}`}
                >
                  <div className={`p-2 rounded-lg ${config.bg}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{activity.action}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{activity.user}</span>
                      <span>•</span>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                  {activity.relatedPath && (
                    <div className="text-gray-400">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              第 {currentPage} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </ContentCard>
    </PageContainer>
  )
}

