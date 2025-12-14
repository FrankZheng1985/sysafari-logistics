import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, Clock, CheckCircle, XCircle, 
  RefreshCw, FileText, ArrowRight
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { type BillOfLading } from '../utils/api'

interface ExceptionRecord {
  id: string
  type: string
  description: string
  reportedAt: string
  reportedBy: string
  status: 'pending' | 'processing' | 'resolved' | 'closed'
  resolution?: string
  resolvedAt?: string
  resolvedBy?: string
}

interface ExceptionBill extends BillOfLading {
  exceptionRecords?: ExceptionRecord[]
}

export default function CMRExceptionManage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [bills, setBills] = useState<ExceptionBill[]>([])
  const [selectedBill, setSelectedBill] = useState<ExceptionBill | null>(null)
  const [showResolutionModal, setShowResolutionModal] = useState(false)
  const [resolution, setResolution] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    closed: 0
  })

  const tabs = [
    { label: 'TMS概览', path: '/tms' },
    { label: 'CMR管理', path: '/cmr-manage' },
    { label: '异常管理', path: '/tms/exceptions' },
    { label: '服务商管理', path: '/tms/service-providers' },
  ]

  useEffect(() => {
    fetchExceptionBills()
  }, [])

  const fetchExceptionBills = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cmr/exceptions')
      const data = await response.json()
      
      if (data.errCode === 200) {
        setBills(data.data?.list || [])
        setStats(data.data?.stats || { total: 0, pending: 0, processing: 0, closed: 0 })
      }
    } catch (error) {
      console.error('获取异常订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!selectedBill || !resolution.trim()) return
    
    try {
      const response = await fetch(`/api/cmr/${selectedBill.id}/resolve-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        setShowResolutionModal(false)
        setResolution('')
        setSelectedBill(null)
        fetchExceptionBills()
      }
    } catch (error) {
      console.error('处理异常失败:', error)
    }
  }

  const handleClose = async (billId: string) => {
    if (!confirm('确定要关闭此异常订单吗？关闭后将无法恢复。')) return
    
    try {
      const response = await fetch(`/api/cmr/${billId}/close-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      if (data.errCode === 200) {
        fetchExceptionBills()
      }
    } catch (error) {
      console.error('关闭异常订单失败:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      'pending': { label: '待处理', color: 'text-yellow-700', bg: 'bg-yellow-100' },
      'processing': { label: '处理中', color: 'text-blue-700', bg: 'bg-blue-100' },
      'resolved': { label: '已解决', color: 'text-green-700', bg: 'bg-green-100' },
      'closed': { label: '已关闭', color: 'text-gray-700', bg: 'bg-gray-100' },
    }
    const config = configs[status] || configs['pending']
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
        {config.label}
      </span>
    )
  }

  const columns: Column<ExceptionBill>[] = [
    {
      key: 'billNumber',
      label: '提单号',
      render: (item) => (
        <span 
          className="text-primary-600 hover:underline cursor-pointer font-medium"
          onClick={() => navigate(`/cmr-manage/${item.id}`)}
        >
          {item.billNumber}
        </span>
      )
    },
    {
      key: 'containerNumber',
      label: '集装箱号',
      render: (item) => <span className="text-gray-900">{item.containerNumber || '-'}</span>
    },
    {
      key: 'cmrExceptionNote',
      label: '异常说明',
      render: (item) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-900 truncate">{item.cmrExceptionNote || '暂无说明'}</p>
        </div>
      )
    },
    {
      key: 'cmrExceptionTime',
      label: '异常时间',
      render: (item) => (
        <span className="text-gray-600 text-sm">
          {item.cmrExceptionTime ? new Date(item.cmrExceptionTime).toLocaleString('zh-CN') : '-'}
        </span>
      )
    },
    {
      key: 'cmrExceptionStatus',
      label: '处理状态',
      render: (item) => getStatusBadge(item.cmrExceptionStatus || 'pending')
    },
    {
      key: 'deliveryStatus',
      label: '派送状态',
      render: (item) => {
        const status = item.deliveryStatus || '未派送'
        const isException = status === '订单异常'
        const isClosed = status === '异常关闭'
        return (
          <span className={`text-sm ${isException ? 'text-red-600 font-medium' : isClosed ? 'text-gray-500' : 'text-gray-900'}`}>
            {status}
          </span>
        )
      }
    },
    {
      key: 'actions',
      label: '操作',
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.deliveryStatus !== '异常关闭' && (
            <>
              <button
                onClick={() => {
                  setSelectedBill(item)
                  setShowResolutionModal(true)
                }}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
              >
                处理
              </button>
              <button
                onClick={() => handleClose(item.id)}
                className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
              >
                关闭
              </button>
            </>
          )}
          <button
            onClick={() => navigate(`/cmr-manage/${item.id}`)}
            className="px-2 py-1 text-xs bg-primary-50 text-primary-600 rounded hover:bg-primary-100 transition-colors"
          >
            详情
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="异常订单管理"
        icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
        breadcrumbs={[
          { label: 'TMS运输管理', path: '/tms' },
          { label: '异常订单管理' }
        ]}
        tabs={tabs}
        activeTab="/tms/exceptions"
        onTabChange={(path) => navigate(path)}
      />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">异常订单总数</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">待处理</p>
                <p className="text-2xl font-bold mt-1">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">处理中</p>
                <p className="text-2xl font-bold mt-1">{stats.processing}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-sm">已关闭</p>
                <p className="text-2xl font-bold mt-1">{stats.closed}</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-200" />
            </div>
          </div>
        </div>

        {/* 异常订单列表 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              异常订单列表
            </h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
              加载中...
            </div>
          ) : bills.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <p>暂无异常订单</p>
              <p className="text-sm mt-1">所有订单运行正常</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={bills}
              loading={loading}
              rowKey="id"
              onRowClick={(item) => navigate(`/cmr-manage/${item.id}`)}
            />
          )}
        </div>

        {/* 异常处理流程说明 */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border border-red-100">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            异常处理流程
          </h4>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-gray-700">发现异常</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-gray-700">记录问题</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-gray-700">跟进处理</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">4</div>
              <span className="text-gray-700">解决/关闭</span>
            </div>
          </div>
        </div>
      </div>

      {/* 处理异常模态框 */}
      {showResolutionModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-xl">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                处理异常订单
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">提单号</p>
                <p className="font-medium text-gray-900">{selectedBill.billNumber}</p>
              </div>
              
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-sm text-red-600">异常说明</p>
                <p className="text-gray-900">{selectedBill.cmrExceptionNote || '暂无说明'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  处理方案 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="请输入处理方案和跟进措施..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowResolutionModal(false)
                  setResolution('')
                  setSelectedBill(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolution.trim()}
                className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                提交处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

