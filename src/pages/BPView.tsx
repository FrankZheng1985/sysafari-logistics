import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Play, MessageSquare, Copy, Ship, FileText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import RemarkModal from '../components/RemarkModal'
import ATAModal from '../components/ATAModal'
import CustomsInfoModal from '../components/CustomsInfoModal'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { PageContainer, ContentCard, LoadingSpinner, EmptyState } from '../components/ui'
import { getBillsList, type BillOfLading } from '../utils/api'
import { scheduleBills } from '../data/mockOrders'
import { useColumnSettings } from '../hooks/useColumnSettings'

export default function BPView() {
  const navigate = useNavigate()
  const location = useLocation()
  const [remarkModalVisible, setRemarkModalVisible] = useState(false)
  const [ataModalVisible, setATAModalVisible] = useState(false)
  const [customsInfoModalVisible, setCustomsInfoModalVisible] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillOfLading | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<BillOfLading | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const currentPath = location.pathname
  const activeTabPath = currentPath === '/bp-view/history' ? '/bp-view/history' : '/bp-view'
  
  const pageKey = '/bp-view'

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getBillsList({
          type: 'schedule',
          search: searchValue || undefined,
          page: 1,
          pageSize: 1000,
        })
        
        if (response.errCode === 200 && response.data) {
          setBills(response.data.list || [])
          setTotal(response.data.total || 0)
        } else {
          console.warn('API 返回错误，使用 mock 数据:', response.msg)
          setBills(scheduleBills)
          setTotal(scheduleBills.length)
        }
      } catch (error) {
        console.error('加载数据失败:', error)
        setError(error instanceof Error ? error.message : '加载数据失败')
        setBills(scheduleBills)
        setTotal(scheduleBills.length)
      } finally {
        setLoading(false)
      }
    }
    
    loadBills()
  }, [searchValue, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }
  
  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板')
    }).catch(() => {
      alert('复制失败')
    })
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
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
          <span
            className="text-primary-600 hover:underline cursor-pointer text-xs"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${item.id}`)
            }}
          >
            {item.containerNumber}
          </span>
          <button
            onClick={(e) => handleCopy(item.containerNumber || '', e)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="复制提单号"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ),
    },
    {
      key: 'actualContainerNo',
      label: '集装箱号',
      sorter: true,
      filterable: true,
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span className="text-xs">{item.actualContainerNo || '-'}</span>
          {item.actualContainerNo && (
            <button
              onClick={(e) => handleCopy(item.actualContainerNo || '', e)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
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
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1.5">
          <Ship className="w-3 h-3 text-gray-400" />
          <span className="text-xs">{item.vessel}</span>
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
          <span>{item.eta}</span>
          {item.ata && (
            <>
              <span className="mx-0.5 text-gray-400">/</span>
              <span className="text-green-600">{item.ata}</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'pieces',
      label: '件数 / 毛重',
      sorter: (a, b) => a.pieces - b.pieces,
      render: (item: BillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{item.pieces} 件</div>
          <div className="text-green-600">{item.weight} KGS</div>
        </div>
      ),
    },
    {
      key: 'inspection',
      label: '查验',
      filters: [
        { text: '已查验', value: '已查验' },
        { text: '未查验', value: '-' },
      ],
      onFilter: (value, record) => {
        if (value === '已查验') return record.inspection !== '-'
        return record.inspection === value
      },
      render: (item: BillOfLading) => (
        <span className={`text-xs ${item.inspection !== '-' ? 'text-orange-600' : 'text-gray-400'}`}>
          {item.inspection}
        </span>
      ),
    },
    {
      key: 'customsStats',
      label: '报关统计',
      render: (item: BillOfLading) => (
        <span className="text-xs">{item.customsStats}</span>
      ),
    },
    {
      key: 'customsInfo',
      label: '报关信息',
      render: (item: BillOfLading) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setSelectedContainer(item)
            setCustomsInfoModalVisible(true)
          }}
          className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
          title="报关信息"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
      ),
    },
    {
      key: 'remarks',
      label: '备注',
      render: (item: BillOfLading) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setSelectedBill(item)
            setRemarkModalVisible(true)
          }}
          className="p-1 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
          title="备注"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      ),
    },
    {
      key: 'creator',
      label: '创建者 / 时间',
      render: (item: BillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{item.creator}</div>
          <div className="text-[10px] text-gray-500">{item.createTime}</div>
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
        { text: '已送达', value: '已送达' },
      ],
      onFilter: (value, record) => (record.deliveryStatus || '待派送') === value,
      render: (item: BillOfLading) => {
        const status = item.deliveryStatus || '待派送'
        const statusStyles: Record<string, string> = {
          '待派送': 'bg-gray-400',
          '派送中': 'bg-orange-500',
          '已送达': 'bg-green-500',
          '订单异常': 'bg-red-500',
        }
        const isException = status === '订单异常'
        return (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[status] || 'bg-gray-400'}`} />
            <span className={`text-xs ${isException ? 'text-red-600 font-medium' : ''}`}>{status}</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: '船状态',
      filters: [
        { text: '船未到港', value: '船未到港' },
        { text: '已到港', value: '已到港' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (item: BillOfLading) => (
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${item.status === '已到港' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs">{item.status}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (item: BillOfLading) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/bookings/bill/${item.id}`)
          }}
          className="px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
        >
          详情
        </button>
      ),
    },
  ]

  const {
    columnConfigs,
    visibleColumns,
    settingsModalVisible,
    setSettingsModalVisible,
    handleSettingsClick,
    handleSaveColumnSettings,
  } = useColumnSettings(pageKey, columns)

  const handleRemarkSubmit = async (_remark: string) => {
    // 提交备注到后台
    await new Promise((resolve) => setTimeout(resolve, 500))
    alert('备注信息添加成功')
  }

  const handleATASubmit = async (_ata: string) => {
    // 提交 ATA 到后台
    await new Promise((resolve) => setTimeout(resolve, 500))
    alert('ATA 更新成功')
  }

  return (
    <PageContainer>
      <PageHeader
        title="BP View"
        icon={<Play className="w-4 h-4 text-primary-600" />}
        tabs={[
          { label: 'SCHEDULE', path: '/bp-view' },
          { label: 'HISTORY', path: '/bp-view/history' },
        ]}
        activeTab={activeTabPath}
        onTabChange={(path) => {
          if (path !== currentPath) {
            navigate(path)
          }
        }}
        searchPlaceholder="提单号或者集装箱编号..."
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        onRefresh={handleRefresh}
        summary={<div className="text-xs text-gray-500">提单总数: <span className="font-medium text-gray-900">{total}</span></div>}
      />
      
      <ContentCard noPadding>
        {error && (
          <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ {error}，已使用 mock 数据
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : bills.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="暂无数据"
          />
        ) : (
          <DataTable
            columns={columns}
            data={bills}
            loading={loading}
            searchValue={searchValue}
            searchableColumns={['billNumber', 'containerNumber', 'vessel']}
            visibleColumns={visibleColumns}
            compact={true}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            onRow={(record) => ({
              onClick: () => {
                navigate(`/bookings/bill/${record.id}`)
              },
              className: 'cursor-pointer hover:bg-gray-50 transition-colors',
            })}
          />
        )}
      </ContentCard>

      {selectedBill && (
        <RemarkModal
          visible={remarkModalVisible}
          onClose={() => {
            setRemarkModalVisible(false)
            setSelectedBill(null)
          }}
          billNo={selectedBill.billNumber}
          billId={selectedBill.id}
          onSubmit={handleRemarkSubmit}
        />
      )}

      {selectedBill && (
        <ATAModal
          visible={ataModalVisible}
          onClose={() => {
            setATAModalVisible(false)
            setSelectedBill(null)
          }}
          billNo={selectedBill.billNumber}
          oldAta={selectedBill.ata}
          onSubmit={handleATASubmit}
        />
      )}

      {selectedContainer && (
        <CustomsInfoModal
          visible={customsInfoModalVisible}
          onClose={() => {
            setCustomsInfoModalVisible(false)
            setSelectedContainer(null)
          }}
          containerNumber={selectedContainer.containerNumber || ''}
          billGrossWeight={selectedContainer.weight}
          billPieces={selectedContainer.pieces}
        />
      )}

      <ColumnSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        columns={columnConfigs}
        onSave={handleSaveColumnSettings}
        pageKey={pageKey}
      />
    </PageContainer>
  )
}

