import { useState, useEffect } from 'react'
import { History, MessageSquare, Copy, Ship, FileText } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import RemarkModal from '../components/RemarkModal'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { PageContainer, ContentCard, LoadingSpinner, EmptyState } from '../components/ui'
import { getBillsList, type BillOfLading } from '../utils/api'
import { useColumnSettings } from '../hooks/useColumnSettings'
import { copyToClipboard } from '../components/Toast'
import { formatDate, formatDateTimeShort } from '../utils/dateFormat'

type CompletedBillOfLading = BillOfLading & {
  completeTime: string
  status: '已完成' | '已归档' | '已取消'
  deliveryStatus: string
}

export default function BPHistory() {
  const navigate = useNavigate()
  const location = useLocation()
  const [remarkModalVisible, setRemarkModalVisible] = useState(false)
  const [selectedBill, setSelectedBill] = useState<CompletedBillOfLading | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [bills, setBills] = useState<CompletedBillOfLading[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  const currentPath = location.pathname
  const activeTabPath = currentPath === '/bp-view/history' ? '/bp-view/history' : '/bp-view'

  const pageKey = '/bp-view/history'

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getBillsList({
          type: 'history',
          search: searchValue || undefined,
          page: 1,
          pageSize: 1000,
        })
        
        if (response.errCode === 200 && response.data) {
          const completedBills = (response.data.list || []).map(bill => ({
            ...bill,
            completeTime: bill.completeTime || '',
            deliveryStatus: bill.deliveryStatus || '',
            status: (bill.status as '已完成' | '已归档' | '已取消') || '已完成',
          }))
          setBills(completedBills as CompletedBillOfLading[])
          setTotal(response.data.total || 0)
        } else {
          console.warn('API 返回错误，使用 mock 数据:', response.msg)
          const { historyBills } = await import('../data/mockOrders')
          setBills(historyBills as CompletedBillOfLading[])
          setTotal(historyBills.length)
        }
      } catch (error) {
        console.error('加载数据失败:', error)
        setError(error instanceof Error ? error.message : '加载数据失败')
        const { historyBills } = await import('../data/mockOrders')
        setBills(historyBills as CompletedBillOfLading[])
        setTotal(historyBills.length)
      } finally {
        setLoading(false)
      }
    }
    
    loadBills()
  }, [searchValue])

  const columns: Column<CompletedBillOfLading>[] = [
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: true,
      render: (_value, record: CompletedBillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className="text-primary-600 hover:underline cursor-pointer text-xs font-medium"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${record.id}`)
            }}
          >
            {record.orderNumber || '-'}
          </span>
          {record.orderNumber && (
            <button
              onClick={(e) => copyToClipboard(record.orderNumber || '', e)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="复制订单号"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'billNumber',
      label: '提单号',
      sorter: true,
      filterable: true,
      render: (_value, record: CompletedBillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className="text-gray-700 hover:underline cursor-pointer text-xs"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${record.id}`)
            }}
          >
            {record.billNumber}
          </span>
          {record.billNumber && (
            <button
              onClick={(e) => copyToClipboard(record.billNumber || '', e)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
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
      render: (_value, record: CompletedBillOfLading) => (
        <div className="flex items-center gap-1">
          <span
            className="text-primary-600 hover:underline cursor-pointer text-xs"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/bookings/bill/${record.id}`)
            }}
          >
            {record.containerNumber}
          </span>
          {record.containerNumber && (
            <button
              onClick={(e) => copyToClipboard(record.containerNumber || '', e)}
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
      key: 'customerName',
      label: '关联客户',
      sorter: true,
      filterable: true,
      render: (_value, record: CompletedBillOfLading) => (
        <div className="max-w-[120px]">
          <span 
            className="text-xs text-gray-900 truncate block" 
            title={record.customerName || '-'}
          >
            {record.customerName || '-'}
          </span>
          {record.customerCode && (
            <span className="text-[10px] text-gray-500">{record.customerCode}</span>
          )}
        </div>
      ),
    },
    {
      key: 'vessel',
      label: '航班号/船名航次',
      sorter: true,
      filterable: true,
      render: (_value, record: CompletedBillOfLading) => (
        <div className="flex items-center gap-1.5">
          <Ship className="w-3 h-3 text-gray-400" />
          <span className="text-xs">{record.vessel}</span>
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
      render: (_value, record: CompletedBillOfLading) => (
        <div className="text-xs">
          <span>{formatDateTimeShort(record.eta)}</span>
          {record.ata && (
            <>
              <span className="mx-0.5 text-gray-400">/</span>
              <span className="text-green-600">{formatDateTimeShort(record.ata)}</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'pieces',
      label: '件数 / 毛重',
      sorter: (a, b) => a.pieces - b.pieces,
      render: (_value, record: CompletedBillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{record.pieces} 件</div>
          <div className="text-green-600">{record.weight} KGS</div>
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
      render: (_value, record: CompletedBillOfLading) => (
        <span className={`text-xs ${record.inspection !== '-' ? 'text-orange-600' : 'text-gray-400'}`}>
          {record.inspection}
        </span>
      ),
    },
    {
      key: 'customsStats',
      label: '报关统计',
      render: (_value, record: CompletedBillOfLading) => (
        <span className="text-xs">{record.customsStats}</span>
      ),
    },
    {
      key: 'customsInfo',
      label: '报关信息',
      render: () => (
        <button
          onClick={(e) => e.stopPropagation()}
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
      render: (_value, record: CompletedBillOfLading) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setSelectedBill(record)
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
      render: (_value, record: CompletedBillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{record.creator}</div>
          <div className="text-[10px] text-gray-500">{formatDate(record.createTime)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      filters: [
        { text: '已到港', value: '已到港' },
        { text: '已完成', value: '已完成' },
        { text: '已归档', value: '已归档' },
        { text: '异常关闭', value: '异常关闭' },
        { text: '已取消', value: '已取消' },
      ],
      onFilter: (value, record) => {
        if (value === '异常关闭') {
          return record.deliveryStatus === '异常关闭'
        }
        return record.status === value
      },
      render: (_value, record: CompletedBillOfLading) => {
        const isExceptionClosed = record.deliveryStatus === '异常关闭'
        const displayStatus = isExceptionClosed ? '异常关闭' : record.status
        const statusStyles: Record<string, string> = {
          '异常关闭': 'bg-gray-500',
          '已到港': 'bg-green-500',
          '已完成': 'bg-emerald-500',
          '已归档': 'bg-blue-500',
          '已取消': 'bg-gray-400',
        }
        return (
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[displayStatus] || 'bg-gray-400'}`} />
            <span className={`text-xs ${isExceptionClosed ? 'text-gray-500' : ''}`}>{displayStatus}</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value, record: CompletedBillOfLading) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/bookings/bill/${record.id}`)
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

  return (
    <PageContainer>
      <PageHeader
        title="BP View"
        icon={<History className="w-4 h-4 text-primary-600" />}
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
        searchPlaceholder="订单号、提单号、集装箱号、客户名..."
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={<div className="text-xs text-gray-500">历史记录: <span className="font-medium text-gray-900">{total}</span></div>}
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
            title="暂无历史数据"
          />
        ) : (
          <DataTable
            columns={columns}
            data={bills}
            loading={loading}
            searchValue={searchValue}
            searchableColumns={['orderNumber', 'billNumber', 'containerNumber', 'vessel', 'customerName']}
            visibleColumns={visibleColumns}
            compact={true}
            pagination={{
              pageSize: 20,
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

