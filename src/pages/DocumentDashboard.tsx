import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileCheck, Upload, CheckCircle, Clock, AlertTriangle,
  ChevronRight, Package, Calculator, FilePlus
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface DocumentStats {
  totalImports: number
  pendingMatching: number
  pendingReview: number
  completed: number
  totalValue: number
  totalDuty: number
  recentImports: Array<{
    id: number
    importNo: string
    customerName: string
    containerNo: string
    billNumber?: string
    totalItems: number
    matchedItems: number
    status: string
    createdAt: string
  }>
}

export default function DocumentDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/documents/stats`)
      const data = await res.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载单证统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      matching: 'bg-blue-100 text-blue-700',
      reviewing: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700'
    }
    const labels: Record<string, string> = {
      pending: '待处理',
      matching: '匹配中',
      reviewing: '待审核',
      confirmed: '已确认',
      completed: '已完成'
    }
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    )
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
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
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 导入批次 */}
        <div 
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/documents/import')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-100 text-xs mb-1">导入批次</div>
              <div className="text-2xl font-bold">{stats?.totalImports || 0}</div>
            </div>
            <Upload className="w-10 h-10 text-blue-200" />
          </div>
          <div className="mt-3 text-xs text-blue-100">
            点击导入新的货物清单
          </div>
        </div>

        {/* 待匹配 */}
        <div 
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/documents/matching')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-100 text-xs mb-1">待审核</div>
              <div className="text-2xl font-bold">{stats?.pendingReview || 0}</div>
            </div>
            <Clock className="w-10 h-10 text-amber-200" />
          </div>
          <div className="mt-3 text-xs text-amber-100">
            {stats?.pendingMatching || 0} 个待匹配
          </div>
        </div>

        {/* 已完成 */}
        <div 
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/documents/tax-calc')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-100 text-xs mb-1">已完成</div>
              <div className="text-2xl font-bold">{stats?.completed || 0}</div>
            </div>
            <CheckCircle className="w-10 h-10 text-emerald-200" />
          </div>
          <div className="mt-3 text-xs text-emerald-100">
            货值: {formatCurrency(stats?.totalValue || 0)}
          </div>
        </div>

        {/* 关税总额 */}
        <div 
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/documents/tax-calc')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-purple-100 text-xs mb-1">预估关税</div>
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalDuty || 0)}</div>
            </div>
            <Calculator className="w-10 h-10 text-purple-200" />
          </div>
          <div className="mt-3 text-xs text-purple-100">
            含增值税及其他税费
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 快捷操作 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">快捷操作</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate('/documents/import')}
              className="w-full flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">导入货物</div>
                <div className="text-xs text-gray-500">上传Excel货物清单</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>

            <button
              onClick={() => navigate('/documents/matching')}
              className="w-full flex items-center gap-3 p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">HS匹配审核</div>
                <div className="text-xs text-gray-500">审核待确认的HS编码</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>

            <button
              onClick={() => navigate('/documents/tax-calc')}
              className="w-full flex items-center gap-3 p-3 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">税费计算</div>
                <div className="text-xs text-gray-500">查看税费明细和报表</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>

            <button
              onClick={() => navigate('/documents/supplement')}
              className="w-full flex items-center gap-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <FilePlus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-900">数据补充</div>
                <div className="text-xs text-gray-500">补充税率库商品信息</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
            </button>
          </div>
        </div>

        {/* 最近导入记录 */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">最近导入记录</h3>
            <button 
              onClick={() => navigate('/documents/import')}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-2 font-medium">批次号</th>
                  <th className="text-left py-2 font-medium">客户</th>
                  <th className="text-left py-2 font-medium">柜号</th>
                  <th className="text-left py-2 font-medium">提单号</th>
                  <th className="text-center py-2 font-medium">商品数</th>
                  <th className="text-center py-2 font-medium">已匹配</th>
                  <th className="text-center py-2 font-medium">状态</th>
                  <th className="text-left py-2 font-medium">导入时间</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentImports && stats.recentImports.length > 0 ? (
                  stats.recentImports.map((item) => (
                    <tr 
                      key={item.id} 
                      className="text-xs border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/documents/import?id=${item.id}`)}
                    >
                      <td className="py-2 font-medium text-primary-600">{item.importNo}</td>
                      <td className="py-2 text-gray-900">{item.customerName || '-'}</td>
                      <td className="py-2 text-gray-600">{item.containerNo || '-'}</td>
                      <td className="py-2 text-gray-600">{item.billNumber || '-'}</td>
                      <td className="py-2 text-center">{item.totalItems}</td>
                      <td className="py-2 text-center">
                        <span className={item.matchedItems === item.totalItems ? 'text-green-600' : 'text-amber-600'}>
                          {item.matchedItems}/{item.totalItems}
                        </span>
                      </td>
                      <td className="py-2 text-center">{getStatusBadge(item.status)}</td>
                      <td className="py-2 text-gray-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FileCheck className="w-8 h-8 text-gray-300" />
                        <span>暂无导入记录</span>
                        <button
                          onClick={() => navigate('/documents/import')}
                          className="mt-2 px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                        >
                          立即导入
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 待处理提醒 */}
      {((stats?.pendingReview || 0) > 0 || (stats?.pendingMatching || 0) > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">待处理提醒</span>
          </div>
          <div className="mt-2 text-sm text-amber-600">
            {stats?.pendingMatching ? `${stats.pendingMatching} 个货物待匹配HS编码` : ''}
            {stats?.pendingMatching && stats?.pendingReview ? '，' : ''}
            {stats?.pendingReview ? `${stats.pendingReview} 个匹配结果待审核确认` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
