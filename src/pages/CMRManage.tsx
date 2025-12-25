import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Truck, Copy, Ship, Eye, Play, CheckCircle, Archive, Check, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import CMRModal, { type CMRDetail, type ExceptionRecord } from '../components/CMRModal'
// UI components available if needed: PageContainer, ContentCard, LoadingSpinner, EmptyState
import { getCMRList, updateBillDelivery, markBillComplete, type BillOfLading, type CMRStats, type CMRDetailData } from '../utils/api'
import { copyToClipboard } from '../components/Toast'
import { formatDate } from '../utils/dateFormat'

// 扩展stats类型
interface ExtendedCMRStats extends CMRStats {
  exception?: number
}

export default function CMRManage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // 从 URL 参数读取初始搜索值
  const [searchValue, setSearchValue] = useState(() => searchParams.get('search') || '')
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<ExtendedCMRStats>({ undelivered: 0, delivering: 0, archived: 0, exception: 0 })
  const [error, setError] = useState<string | null>(null)
  
  // CMR模态框状态
  const [cmrModalVisible, setCmrModalVisible] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillOfLading | null>(null)
  
  // 根据当前路径确定激活的标签页
  const currentPath = location.pathname
  const getTabType = (): 'undelivered' | 'delivering' | 'exception' | 'archived' => {
    if (currentPath === '/cmr-manage/delivering') return 'delivering'
    if (currentPath === '/cmr-manage/exception') return 'exception'
    if (currentPath === '/cmr-manage/archived') return 'archived'
    return 'undelivered'
  }
  const tabType = getTabType()
  const activeTabPath = currentPath.startsWith('/cmr-manage/') ? currentPath : '/cmr-manage'
  
  // 从 API 获取数据
  const loadCMRList = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { type: tabType, search: searchValue || undefined }
      const response = await getCMRList(params)
      
      if (response.errCode === 200 && response.data) {
        setBills(response.data.list || [])
        setTotal(response.data.total || 0)
        setStats(response.data.stats || { undelivered: 0, delivering: 0, archived: 0, exception: 0 })
      } else {
        console.error('获取数据失败:', response.msg)
        setError(response.msg || '获取数据失败')
        setBills([])
        setTotal(0)
      }
    } catch (error) {
      console.error('加载 CMR 列表失败:', error)
      setError(error instanceof Error ? error.message : '加载数据失败')
      setBills([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }
  
   
  useEffect(() => {
    loadCMRList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabType, searchValue])
  
  // 打开CMR模态框
  const openCMRModal = (bill: BillOfLading) => {
    setSelectedBill(bill)
    setCmrModalVisible(true)
  }
  
  // CMR模态框提交处理
  const handleCMRSubmit = async (data: { 
    status: string
    detail: CMRDetail
    hasException?: boolean
    exceptionAction?: 'report' | 'followup' | 'resolve' | 'continue' | 'close'
  }) => {
    if (!selectedBill) return
    
    const cmrDetailData: CMRDetailData = {
      estimatedPickupTime: data.detail.estimatedPickupTime,
      serviceProvider: data.detail.serviceProvider,
      pickupNote: data.detail.pickupNote,
      deliveryAddress: data.detail.deliveryAddress,
      estimatedArrivalTime: data.detail.estimatedArrivalTime,
      arrivalNote: data.detail.arrivalNote,
      actualArrivalTime: data.detail.actualArrivalTime,
      deliveryNote: data.detail.deliveryNote,
      unloadingCompleteTime: data.detail.unloadingCompleteTime,
      unloadingNote: data.detail.unloadingNote,
      confirmedTime: data.detail.confirmedTime,
      confirmNote: data.detail.confirmNote,
      hasException: data.hasException,
      exceptionNote: data.detail.exceptionNote,
      exceptionTime: data.detail.exceptionTime,
    }
    
    // 添加异常状态和记录
    if (data.detail.exceptionStatus) {
      (cmrDetailData as any).exceptionStatus = data.detail.exceptionStatus
    }
    if (data.detail.exceptionRecords) {
      (cmrDetailData as any).exceptionRecords = data.detail.exceptionRecords
    }
    
    const response = await updateBillDelivery(
      String(selectedBill.id),
      data.status,
      undefined,
      cmrDetailData
    )
    
    if (response.errCode === 200) {
      // 刷新列表
      await loadCMRList()
      const actionMsg = data.exceptionAction === 'report' ? '异常已报告' :
                       data.exceptionAction === 'followup' ? '跟进记录已添加' :
                       data.exceptionAction === 'resolve' ? '异常已标记解决' :
                       data.exceptionAction === 'continue' ? '已恢复派送' :
                       data.exceptionAction === 'close' ? '订单已关闭' :
                       '派送状态更新成功'
      alert(actionMsg)
    } else {
      throw new Error(response.msg || '更新失败')
    }
  }
  
  // 解析CMR详情
  const parseCMRDetail = (bill: BillOfLading): CMRDetail | undefined => {
    if (!bill) return undefined
    
    try {
      const notes = bill.cmrNotes ? JSON.parse(bill.cmrNotes) : {}
      let exceptionRecords: ExceptionRecord[] = []
      
      // 尝试解析异常记录
      if ((bill as any).cmrExceptionRecords) {
        try {
          exceptionRecords = typeof (bill as any).cmrExceptionRecords === 'string' 
            ? JSON.parse((bill as any).cmrExceptionRecords) 
            : (bill as any).cmrExceptionRecords
        } catch { /* ignore parse error */ }
      }
      
      return {
        estimatedPickupTime: bill.cmrEstimatedPickupTime,
        serviceProvider: bill.cmrServiceProvider,
        pickupNote: notes.pickupNote,
        deliveryAddress: bill.cmrDeliveryAddress,
        estimatedArrivalTime: bill.cmrEstimatedArrivalTime,
        arrivalNote: notes.arrivalNote,
        actualArrivalTime: bill.cmrActualArrivalTime,
        deliveryNote: notes.deliveryNote,
        unloadingCompleteTime: bill.cmrUnloadingCompleteTime,
        unloadingNote: notes.unloadingNote,
        confirmedTime: bill.cmrConfirmedTime,
        confirmNote: notes.confirmNote,
        hasException: !!bill.cmrHasException,
        exceptionNote: bill.cmrExceptionNote,
        exceptionTime: bill.cmrExceptionTime,
        exceptionStatus: (bill as any).cmrExceptionStatus,
        exceptionRecords,
      }
    } catch {
      return undefined
    }
  }

  // 标记提单为已完成
  const handleMarkComplete = async (id: string | number) => {
    if (!confirm('确定要将此提单标记为已完成吗？标记后将不可更改。')) return
    try {
      const response = await markBillComplete(String(id))
      if (response.errCode === 200) {
        // 更新列表中的状态
        setBills(prev => prev.map(bill => 
          bill.id === id ? { ...bill, status: '已完成' } : bill
        ))
        alert('提单已标记为完成')
      } else {
        alert(`标记失败: ${response.msg}`)
      }
    } catch (error) {
      console.error('标记完成失败:', error)
      alert('标记失败，请稍后重试')
    }
  }

  const columns: Column<BillOfLading>[] = [
    {
      key: 'billNumber',
      label: '提单号',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className="text-primary-600 hover:underline cursor-pointer text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${record.id}`)
            }}
          >
            {record.billNumber}
          </span>
          {record.billNumber && (
            <button
              onClick={(e) => copyToClipboard(record.billNumber, e)}
              className="text-gray-400 hover:text-gray-600"
              title="复制提单号"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'containerNumber',
      label: '集装箱号',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span className="text-xs">{record.containerNumber || '-'}</span>
          {record.containerNumber && (
            <button
              onClick={(e) => copyToClipboard(record.containerNumber || '', e)}
              className="text-gray-400 hover:text-gray-600"
              title="复制集装箱号"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'vessel',
      label: '航班号/船名航次',
      sorter: true,
      filterable: true,
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <Ship className="w-3 h-3 text-gray-500" />
          <span className="text-xs">{record.vessel || '-'}</span>
        </div>
      ),
    },
    {
      key: 'portOfDischarge',
      label: '目的港',
      sorter: true,
      render: (_value, record: BillOfLading) => (
        <span className="text-xs">{record.portOfDischarge || '-'}</span>
      ),
    },
    {
      key: 'placeOfDelivery',
      label: '交货地',
      sorter: true,
      render: (_value, record: BillOfLading) => (
        <span className="text-xs">{record.placeOfDelivery || '-'}</span>
      ),
    },
    {
      key: 'pieces',
      label: '件数/毛重',
      sorter: (a, b) => a.pieces - b.pieces,
      render: (_value, record: BillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{record.pieces}</div>
          <div className="text-green-600">{record.weight} KGS</div>
        </div>
      ),
    },
    {
      key: 'deliveryStatus',
      label: '派送状态',
      filters: [
        { text: '待派送', value: '待派送' },
        { text: '派送中', value: '派送中' },
        { text: '订单异常', value: '订单异常' },
        { text: '异常关闭', value: '异常关闭' },
        { text: '已送达', value: '已送达' },
      ],
      onFilter: (value, record) => (record.deliveryStatus || '待派送') === value,
      render: (_value, record: BillOfLading) => {
        const status = record.deliveryStatus || '待派送'
        const isException = status === '订单异常'
        const isClosed = status === '异常关闭'
        return (
          <div className="flex items-center gap-1">
            {isException ? (
              <AlertTriangle className="w-3 h-3 text-red-500" />
            ) : isClosed ? (
              <AlertTriangle className="w-3 h-3 text-gray-500" />
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status === '待派送' ? 'bg-gray-500' :
                  status === '派送中' ? 'bg-orange-500' :
                  status === '已送达' ? 'bg-green-500' :
                  'bg-gray-500'
                }`}
              ></span>
            )}
            <span className={`text-xs ${isException ? 'text-red-600 font-medium' : isClosed ? 'text-gray-500' : ''}`}>
              {status}
            </span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: '提单状态',
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              record.status === '已到港' ? 'bg-green-500' : 
              record.status === '船未到港' ? 'bg-yellow-500' :
              'bg-gray-500'
            }`}
          ></span>
          <span className="text-xs">{record.status}</span>
        </div>
      ),
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => {
        const dateA = a.createTime ? new Date(a.createTime).getTime() : 0
        const dateB = b.createTime ? new Date(b.createTime).getTime() : 0
        return dateA - dateB
      },
      render: (_value, record: BillOfLading) => (
        <span className="text-xs">{formatDate(record.createTime)}</span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value, record: BillOfLading) => {
        const status = record.deliveryStatus || '待派送'
        const isException = status === '订单异常'
        const isClosed = status === '异常关闭'
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/cmr-manage/${record.id}`)
              }}
              className="text-primary-600 hover:text-primary-700 hover:underline text-xs flex items-center gap-0.5"
            >
              <Eye className="w-3 h-3" />
              详情
            </button>
            {status === '待派送' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openCMRModal(record)
                }}
                className="text-orange-600 hover:text-orange-700 hover:underline text-xs flex items-center gap-0.5"
              >
                <Play className="w-3 h-3" />
                开始派送
              </button>
            )}
            {status === '派送中' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openCMRModal(record)
                }}
                className="text-green-600 hover:text-green-700 hover:underline text-xs flex items-center gap-0.5"
              >
                <CheckCircle className="w-3 h-3" />
                {/* 根据步骤显示不同的按钮文字 */}
                {record.cmrUnloadingCompleteTime ? '完成派送' : 
                 record.cmrActualArrivalTime ? '卸货完成' : '确认送达'}
              </button>
            )}
            {isException && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openCMRModal(record)
                }}
                className="text-red-600 hover:text-red-700 hover:underline text-xs flex items-center gap-0.5"
              >
                <AlertTriangle className="w-3 h-3" />
                处理异常
              </button>
            )}
            {status === '已送达' && record.status !== '已完成' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkComplete(record.id)
                }}
                className="text-emerald-600 hover:text-emerald-700 hover:underline text-xs flex items-center gap-0.5"
              >
                <Check className="w-3 h-3" />
                标记完成
              </button>
            )}
            {record.status === '已完成' && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Check className="w-3 h-3" />
                已完成
              </span>
            )}
            {isClosed && (
              <span className="text-xs text-gray-400">已关闭</span>
            )}
          </div>
        )
      },
    },
  ]

  const getTabTitle = () => {
    switch (tabType) {
      case 'undelivered': return '待派送'
      case 'delivering': return '派送中'
      case 'exception': return '订单异常'
      case 'archived': return '已归档'
      default: return '待派送'
    }
  }
  
  const getEmptyIcon = () => {
    switch (tabType) {
      case 'undelivered': return <Truck className="w-12 h-12 mb-2" />
      case 'delivering': return <Play className="w-12 h-12 mb-2" />
      case 'exception': return <AlertTriangle className="w-12 h-12 mb-2" />
      case 'archived': return <Archive className="w-12 h-12 mb-2" />
      default: return <Truck className="w-12 h-12 mb-2" />
    }
  }
  
  const getEmptyText = () => {
    switch (tabType) {
      case 'undelivered': return '暂无待派送的柜子'
      case 'delivering': return '暂无派送中的柜子'
      case 'exception': return '暂无异常订单'
      case 'archived': return '暂无已归档的柜子'
      default: return '暂无数据'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="TMS管理"
        icon={<Truck className="w-6 h-6 text-primary-600" />}
        tabs={[
          { label: '待派送', path: '/cmr-manage', count: stats.undelivered },
          { label: '派送中', path: '/cmr-manage/delivering', count: stats.delivering },
          { label: '订单异常', path: '/cmr-manage/exception', count: stats.exception || 0 },
          { label: '归档', path: '/cmr-manage/archived', count: stats.archived },
        ]}
        activeTab={activeTabPath === '/cmr-manage' ? '/cmr-manage' : activeTabPath}
        onTabChange={(path) => {
          if (path !== currentPath) {
            navigate(path)
          }
        }}
        searchPlaceholder="提单号或集装箱编号..."
        defaultSearchValue={searchValue}
        onSearch={setSearchValue}
        summary={<div>{getTabTitle()}: {total}</div>}
      />
      <div className="flex-1 overflow-auto p-6 bg-white">
        {error && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-xs text-gray-500">加载中...</div>
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            {getEmptyIcon()}
            <span className="text-xs">{getEmptyText()}</span>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={bills}
            loading={loading}
            searchValue={searchValue}
            searchableColumns={['billNumber', 'containerNumber', 'vessel']}
            compact={true}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            onRow={(record) => ({
              onClick: () => {
                navigate(`/cmr-manage/${record.id}`)
              },
              className: 'cursor-pointer hover:bg-gray-50',
            })}
          />
        )}
      </div>
      
      {/* CMR模态框 */}
      {selectedBill && (
        <CMRModal
          visible={cmrModalVisible}
          onClose={() => setCmrModalVisible(false)}
          billNumber={selectedBill.billNumber}
          currentStatus={selectedBill.deliveryStatus || '待派送'}
          cmrDetail={parseCMRDetail(selectedBill)}
          defaultDeliveryAddress={selectedBill.placeOfDelivery || selectedBill.portOfDischarge}
          deliveryAddresses={
            // 从 referenceList 中提取地址列表
            selectedBill.referenceList?.filter(ref => ref.consigneeAddress || ref.consigneeAddressDetails).map(ref => ({
              label: ref.referenceNumber || '未命名',
              address: ref.consigneeAddress || '',
              details: ref.consigneeAddressDetails || ref.consigneeAddress || ''
            })) || []
          }
          onSubmit={handleCMRSubmit}
        />
      )}
    </div>
  )
}
