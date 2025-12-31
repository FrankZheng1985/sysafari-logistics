import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, TrendingUp, MessageSquare, 
  AlertTriangle, CheckCircle, Clock, Target,
  ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface CustomerStats {
  total: number
  byLevel: {
    vip: number
    important: number
    normal: number
    potential: number
  }
  byStatus: {
    active: number
    inactive: number
  }
}

interface OpportunityStats {
  total: number
  byStage: {
    lead: number
    qualification: number
    proposal: number
    negotiation: number
    closedWon: number
    closedLost: number
  }
  pipelineValue: number
  wonValue: number
  winRate: string | number
}

interface FeedbackStats {
  total: number
  byType: {
    complaint: number
    suggestion: number
    inquiry: number
    praise: number
  }
  byStatus: {
    open: number
    processing: number
    resolved: number
  }
  highPriority: number
}

interface FunnelData {
  stage: string
  count: number
  value: number
}

interface ActivityRanking {
  id: string
  customerName: string
  customerLevel: string
  followUpCount: number
  opportunityCount: number
  contractCount: number
  lastFollowUpTime: string | null
}

export default function CRMDashboard() {
  const navigate = useNavigate()
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null)
  const [opportunityStats, setOpportunityStats] = useState<OpportunityStats | null>(null)
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null)
  const [salesFunnel, setSalesFunnel] = useState<FunnelData[]>([])
  const [activityRanking, setActivityRanking] = useState<ActivityRanking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 独立处理每个请求，避免一个失败导致全部失败
      const fetchJson = async (url: string) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return { errCode: res.status, msg: 'error', data: null }
          return await res.json()
        } catch {
          return { errCode: 500, msg: 'error', data: null }
        }
      }

      const [custData, oppData, fbData, funnelData, rankingData] = await Promise.all([
        fetchJson(`${API_BASE}/api/customers/stats`),
        fetchJson(`${API_BASE}/api/opportunities/stats`),
        fetchJson(`${API_BASE}/api/feedbacks/stats`),
        fetchJson(`${API_BASE}/api/analytics/sales-funnel`),
        fetchJson(`${API_BASE}/api/analytics/activity-ranking?limit=5`)
      ])

      if (custData.errCode === 200) setCustomerStats(custData.data)
      if (oppData.errCode === 200) setOpportunityStats(oppData.data)
      if (fbData.errCode === 200) setFeedbackStats(fbData.data)
      if (funnelData.errCode === 200) setSalesFunnel(funnelData.data || [])
      if (rankingData.errCode === 200) setActivityRanking(rankingData.data || [])
    } catch (error) {
      console.error('加载CRM数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      lead: '线索',
      qualification: '资格确认',
      proposal: '方案报价',
      negotiation: '谈判中'
    }
    return labels[stage] || stage
  }

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      vip: 'bg-amber-100 text-amber-700',
      important: 'bg-blue-100 text-blue-700',
      normal: 'bg-gray-100 text-gray-700',
      potential: 'bg-green-100 text-green-700'
    }
    const labels: Record<string, string> = {
      vip: 'VIP',
      important: '重要',
      normal: '普通',
      potential: '潜在'
    }
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[level] || styles.normal}`}>
        {labels[level] || level}
      </span>
    )
  }

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
    { label: '提成规则', path: '/crm/commission/rules' },
    { label: '提成记录', path: '/crm/commission/records' },
    { label: '月度结算', path: '/crm/commission/settlements' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 客户统计 */}
        <div 
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/crm/customers')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-100 text-xs mb-1">客户总数</div>
              <div className="text-2xl font-bold">{customerStats?.total || 0}</div>
            </div>
            <Users className="w-10 h-10 text-blue-200" />
          </div>
          <div className="mt-3 flex gap-3 text-xs">
            <span>VIP: {customerStats?.byLevel.vip || 0}</span>
            <span>重要: {customerStats?.byLevel.important || 0}</span>
            <span>普通: {customerStats?.byLevel.normal || 0}</span>
          </div>
        </div>

        {/* 销售机会 */}
        <div 
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/crm/opportunities')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-100 text-xs mb-1">销售机会</div>
              <div className="text-2xl font-bold">{opportunityStats?.total || 0}</div>
            </div>
            <Target className="w-10 h-10 text-emerald-200" />
          </div>
          <div className="mt-3 text-xs">
            <span>管道价值: {formatCurrency(opportunityStats?.pipelineValue || 0)}</span>
          </div>
        </div>

        {/* 成交数据 */}
        <div 
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/crm/opportunities?stage=won')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-100 text-xs mb-1">成交金额</div>
              <div className="text-2xl font-bold">{formatCurrency(opportunityStats?.wonValue || 0)}</div>
            </div>
            <TrendingUp className="w-10 h-10 text-amber-200" />
          </div>
          <div className="mt-3 text-xs flex items-center gap-1">
            <span>转化率: {opportunityStats?.winRate || '0%'}</span>
            {Number(opportunityStats?.winRate || 0) > 30 ? (
              <ArrowUpRight className="w-3 h-3 text-green-200" />
            ) : (
              <ArrowDownRight className="w-3 h-3 text-red-200" />
            )}
          </div>
        </div>

        {/* 客户反馈 */}
        <div 
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/crm/feedbacks')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-purple-100 text-xs mb-1">待处理反馈</div>
              <div className="text-2xl font-bold">{feedbackStats?.byStatus.open || 0}</div>
            </div>
            <MessageSquare className="w-10 h-10 text-purple-200" />
          </div>
          <div className="mt-3 flex gap-3 text-xs">
            <span>投诉: {feedbackStats?.byType.complaint || 0}</span>
            <span>建议: {feedbackStats?.byType.suggestion || 0}</span>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 销售漏斗 */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">销售漏斗</h3>
            <button 
              onClick={() => navigate('/crm/opportunities')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看详情 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="space-y-3">
            {salesFunnel.length > 0 ? salesFunnel.map((item, index) => {
              const maxValue = Math.max(...salesFunnel.map(f => f.value))
              const width = maxValue > 0 ? (item.value / maxValue) * 100 : 0
              const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500']
              
              return (
                <div key={item.stage} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-gray-600">{getStageLabel(item.stage)}</div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div 
                      className={`h-full ${colors[index % colors.length]} transition-all duration-500`}
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs font-medium text-white drop-shadow">{item.count}个机会</span>
                      <span className="text-xs text-gray-600">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="text-center py-8 text-gray-400 text-sm">暂无销售机会数据</div>
            )}
          </div>
        </div>

        {/* 反馈状态 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">反馈处理</h3>
            <button 
              onClick={() => navigate('/crm/feedbacks')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-700">待处理</span>
              </div>
              <span className="text-lg font-bold text-red-600">{feedbackStats?.byStatus.open || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-gray-700">处理中</span>
              </div>
              <span className="text-lg font-bold text-amber-600">{feedbackStats?.byStatus.processing || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-700">已解决</span>
              </div>
              <span className="text-lg font-bold text-green-600">{feedbackStats?.byStatus.resolved || 0}</span>
            </div>

            {(feedbackStats?.highPriority || 0) > 0 && (
              <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                有 {feedbackStats?.highPriority} 个紧急/高优先级反馈待处理
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 客户活跃度排行 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">客户活跃度排行</h3>
          <button 
            onClick={() => navigate('/crm/customers')}
            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            查看全部客户 <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-2 font-medium">排名</th>
                <th className="text-left py-2 font-medium">客户名称</th>
                <th className="text-left py-2 font-medium">级别</th>
                <th className="text-center py-2 font-medium">跟进次数</th>
                <th className="text-center py-2 font-medium">销售机会</th>
                <th className="text-center py-2 font-medium">合同数</th>
                <th className="text-left py-2 font-medium">最后跟进</th>
              </tr>
            </thead>
            <tbody>
              {activityRanking.length > 0 ? activityRanking.map((customer, index) => (
                <tr 
                  key={customer.id} 
                  className="text-xs border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/crm/customers/${customer.id}`)}
                >
                  <td className="py-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                      ${index === 0 ? 'bg-amber-100 text-amber-700' : 
                        index === 1 ? 'bg-gray-200 text-gray-700' : 
                        index === 2 ? 'bg-orange-100 text-orange-700' : 
                        'bg-gray-100 text-gray-500'}`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-2 font-medium text-gray-900">{customer?.customerName || '-'}</td>
                  <td className="py-2">{getLevelBadge(customer?.customerLevel || 'normal')}</td>
                  <td className="py-2 text-center">{customer.followUpCount}</td>
                  <td className="py-2 text-center">{customer.opportunityCount}</td>
                  <td className="py-2 text-center">{customer.contractCount}</td>
                  <td className="py-2 text-gray-500">
                    {customer.lastFollowUpTime ? new Date(customer.lastFollowUpTime).toLocaleDateString() : '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">暂无客户数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

