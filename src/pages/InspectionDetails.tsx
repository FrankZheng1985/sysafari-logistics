import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ClipboardList, Ship, Copy, Eye } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import InspectionModal, { type InspectionDetail } from '../components/InspectionModal'
// UI components available if needed: PageContainer, ContentCard, LoadingSpinner, EmptyState
import { getInspectionsList, updateBillInspection, type BillOfLading, type InspectionDetailData } from '../utils/api'

export default function InspectionDetails() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // 从 URL 参数读取初始搜索值
  const [searchValue, setSearchValue] = useState(() => searchParams.get('search') || '')
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ pending: 0, released: 0 })
  
  // 查验模态框状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillOfLading | null>(null)
  
  // 根据当前路径确定激活的标签页
  const currentPath = location.pathname
  const isReleasedTab = currentPath === '/inspection/released'
  const activeTabPath = isReleasedTab ? '/inspection/released' : '/inspection/pending'
  
  // 从 API 获取数据
  useEffect(() => {
    const loadInspections = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getInspectionsList({
          type: isReleasedTab ? 'released' : 'pending',
          search: searchValue || undefined,
        })
        
        if (response.errCode === 200 && response.data) {
          setBills(response.data.list || [])
          setTotal(response.data.total || 0)
          if (response.data.stats) {
            setStats(response.data.stats as { pending: number; released: number })
          }
        } else {
          console.error('获取数据失败:', response.msg)
          setError(response.msg || '获取数据失败')
          setBills([])
          setTotal(0)
        }
      } catch (error) {
        console.error('加载查验列表失败:', error)
        setError(error instanceof Error ? error.message : '加载数据失败')
        setBills([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }
    
    loadInspections()
  }, [isReleasedTab, searchValue])
  
  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板')
    }).catch(() => {
      alert('复制失败')
    })
  }
  
  // 打开查验模态框
  const openInspectionModal = (bill: BillOfLading) => {
    setSelectedBill(bill)
    setInspectionModalVisible(true)
  }

  // 处理查验提交
  const handleInspectionSubmit = async (data: { status: string; detail: InspectionDetail }) => {
    if (!selectedBill) return
    
    const detailData: InspectionDetailData = {
      items: data.detail.items,
      estimatedTime: data.detail.estimatedTime,
      actualStartTime: data.detail.actualStartTime,
      actualEndTime: data.detail.actualEndTime,
      result: data.detail.result,
      resultNote: data.detail.resultNote,
      releaseTime: data.detail.releaseTime,
      confirmedTime: data.detail.confirmedTime,
    }
    
    const response = await updateBillInspection(String(selectedBill.id), data.status, detailData)
    if (response.errCode === 200) {
      // 刷新列表
      setBills(prev => prev.map(bill => 
        bill.id === selectedBill.id ? { ...bill, inspection: data.status, ...response.data } : bill
      ))
      // 更新统计
      if (data.status === '已放行') {
        setStats(prev => ({ ...prev, pending: prev.pending - 1, released: prev.released + 1 }))
      }
    } else {
      throw new Error(response.msg || '操作失败')
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  // 处理简单查验状态更新（用于快速操作）- 保留用于扩展功能
  const handleUpdateInspectionReserved = async (id: string | number, newStatus: string) => {
    try {
      const response = await updateBillInspection(String(id), newStatus)
      if (response.errCode === 200) {
        // 刷新列表
        setBills(prev => prev.map(bill => 
          bill.id === id ? { ...bill, inspection: newStatus } : bill
        ))
        alert('查验状态更新成功')
      } else {
        alert(`更新失败: ${response.msg}`)
      }
    } catch (error) {
      console.error('更新查验状态失败:', error)
      alert('更新失败，请稍后重试')
    }
  }
  
  // 处理放行操作（放行后会转移到"查验-放行"标签，同时在CMR管理显示）- 保留用于扩展功能
  const handleReleaseInspectionReserved = async (bill: BillOfLading) => {
    if (!confirm(`确定要放行提单 ${bill.billNumber} 吗？放行后将转移到"查验-放行"并可在CMR管理中派送。`)) return
    
    try {
      const response = await updateBillInspection(String(bill.id), '已放行')
      if (response.errCode === 200) {
        // 从当前列表移除（因为会转移到放行标签）
        setBills(prev => prev.filter(b => b.id !== bill.id))
        setTotal(prev => prev - 1)
        alert('放行成功！柜子已转移到"查验-放行"标签页。')
      } else {
        alert(`放行失败: ${response.msg}`)
      }
    } catch (error) {
      console.error('放行失败:', error)
      alert('放行失败，请稍后重试')
    }
  }

  const columns: Column<BillOfLading>[] = [
    {
      key: 'billNumber',
      label: '序号',
      sorter: true,
      filterable: true,
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className="text-primary-600 hover:underline cursor-pointer text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${item.id}`)
            }}
          >
            {item.billNumber}
          </span>
          <button
            onClick={(e) => handleCopy(item.billNumber, e)}
            className="text-gray-400 hover:text-gray-600"
            title="复制序号"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ),
    },
    {
      key: 'containerNumber',
      label: '提单号',
      sorter: true,
      filterable: true,
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span className="text-xs">{item.containerNumber || '-'}</span>
          {item.containerNumber && (
            <button
              onClick={(e) => handleCopy(item.containerNumber || '', e)}
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
      key: 'actualContainerNo',
      label: '集装箱号',
      sorter: true,
      filterable: true,
      render: (item: BillOfLading) => (
        <span className="text-xs">{item.actualContainerNo || '-'}</span>
      ),
    },
    {
      key: 'vessel',
      label: '航班号/船名航次',
      sorter: true,
      filterable: true,
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1">
          <Ship className="w-3 h-3 text-gray-500" />
          <span className="text-xs">{item.vessel || '-'}</span>
        </div>
      ),
    },
    {
      key: 'eta',
      label: 'ETA/ATA',
      sorter: (a, b) => {
        const dateA = a.eta ? new Date(a.eta).getTime() : 0
        const dateB = b.eta ? new Date(b.eta).getTime() : 0
        return dateA - dateB
      },
      render: (item: BillOfLading) => (
        <div className="text-xs">
          <span>{item.eta || '-'}</span>
          {item.ata && (
            <>
              <span className="mx-0.5">/</span>
              <span>{item.ata}</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'pieces',
      label: '件数/毛重(KGS)',
      sorter: (a, b) => a.pieces - b.pieces,
      render: (item: BillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{item.pieces}</div>
          <div className="text-green-600">{item.weight}</div>
        </div>
      ),
    },
    {
      key: 'inspection',
      label: '查验状态',
      filters: [
        { text: '待查验', value: '待查验' },
        { text: '查验中', value: '查验中' },
        { text: '已查验', value: '已查验' },
        { text: '查验放行', value: '查验放行' },
        { text: '已放行', value: '已放行' },
      ],
      onFilter: (value, record) => record.inspection === value,
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              item.inspection === '待查验' ? 'bg-yellow-500' :
              item.inspection === '查验中' ? 'bg-orange-500' :
              item.inspection === '已查验' ? 'bg-blue-500' :
              item.inspection === '查验放行' ? 'bg-emerald-500' :
              item.inspection === '已放行' ? 'bg-green-500' :
              'bg-gray-500'
            }`}
          ></span>
          <span className="text-xs">{item.inspection}</span>
        </div>
      ),
    },
    {
      key: 'creator',
      label: '创建者/创建时间',
      render: (item: BillOfLading) => (
        <div className="text-xs">
          <div>{item.creator}</div>
          <div className="text-[10px] text-gray-500">{item.createTime}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/inspection/${item.id}`)
            }}
            className="text-primary-600 hover:text-primary-700 hover:underline text-xs flex items-center gap-0.5"
          >
            <Eye className="w-3 h-3" />
            详情
          </button>
          {!isReleasedTab && item.inspection === '待查验' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openInspectionModal(item)
              }}
              className="text-orange-600 hover:text-orange-700 hover:underline text-xs"
            >
              开始查验
            </button>
          )}
          {!isReleasedTab && item.inspection === '查验中' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openInspectionModal(item)
              }}
              className="text-blue-600 hover:text-blue-700 hover:underline text-xs"
            >
              录入结果
            </button>
          )}
          {!isReleasedTab && item.inspection === '已查验' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openInspectionModal(item)
              }}
              className="text-green-600 hover:text-green-700 hover:underline text-xs"
            >
              查验放行
            </button>
          )}
          {!isReleasedTab && item.inspection === '查验放行' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openInspectionModal(item)
              }}
              className="text-emerald-600 hover:text-emerald-700 hover:underline text-xs"
            >
              确认放行
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col bg-white">
      <PageHeader
        title="查验管理"
        icon={<ClipboardList className="w-6 h-6 text-primary-600" />}
        tabs={[
          { label: '查验概览', path: '/inspection' },
          { label: `待查验 (${stats.pending})`, path: '/inspection/pending' },
          { label: `已放行 (${stats.released})`, path: '/inspection/released' },
        ]}
        activeTab={activeTabPath}
        onTabChange={(path) => {
          if (path !== currentPath) {
            navigate(path)
          }
        }}
        searchPlaceholder="提单号或集装箱编号..."
        defaultSearchValue={searchValue}
        onSearch={setSearchValue}
        summary={<div>当前显示: {total} 条记录</div>}
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
            <ClipboardList className="w-12 h-12 mb-2" />
            <span className="text-xs">暂无{isReleasedTab ? '已放行' : '待查验'}的集装箱</span>
            <span className="text-xs text-gray-400 mt-2">
              提示：在提单详情页面点击"标记查验"可将集装箱加入查验列表
            </span>
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
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            onRow={(record) => ({
              onClick: () => {
                navigate(`/inspection-overview/${record.id}`)
              },
              className: 'cursor-pointer hover:bg-gray-50',
            })}
          />
        )}
      </div>
      
      {/* 查验模态框 */}
      <InspectionModal
        visible={inspectionModalVisible}
        onClose={() => {
          setInspectionModalVisible(false)
          setSelectedBill(null)
        }}
        billNumber={selectedBill?.billNumber || ''}
        currentStatus={selectedBill?.inspection || '待查验'}
        inspectionDetail={selectedBill?.inspectionDetail ? {
          items: typeof selectedBill.inspectionDetail === 'string' 
            ? JSON.parse(selectedBill.inspectionDetail) 
            : selectedBill.inspectionDetail,
          estimatedTime: selectedBill.inspectionEstimatedTime,
          actualStartTime: selectedBill.inspectionStartTime,
          actualEndTime: selectedBill.inspectionEndTime,
          result: selectedBill.inspectionResult as 'pass' | 'second_inspection' | 'fail' | undefined,
          resultNote: selectedBill.inspectionResultNote,
          releaseTime: selectedBill.inspectionReleaseTime,
          confirmedTime: selectedBill.inspectionConfirmedTime,
        } : undefined}
        onSubmit={handleInspectionSubmit}
      />
    </div>
  )
}
