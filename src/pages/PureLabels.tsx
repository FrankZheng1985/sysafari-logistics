import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, Printer, Copy } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { copyToClipboard } from '../components/Toast'
import { useColumnSettings } from '../hooks/useColumnSettings'

interface PureLabel {
  id: string
  labelNumber: string
  orderNumber: string
  recipient: string
  address: string
  phone: string
  weight: number
  createTime: string
  status: string
  printStatus: string
}

const mockData: PureLabel[] = [
  {
    id: '1',
    labelNumber: 'LABEL-2025-001',
    orderNumber: 'COSU643327630',
    recipient: 'John Doe',
    address: '123 Main Street, Amsterdam, Netherlands',
    phone: '+31 20 123 4567',
    weight: 2.5,
    createTime: '2025-11-20 09:42:27',
    status: '待打印',
    printStatus: '未打印',
  },
  {
    id: '2',
    labelNumber: 'LABEL-2025-002',
    orderNumber: 'COSU643327631',
    recipient: 'Jane Smith',
    address: '456 Oak Avenue, Rotterdam, Netherlands',
    phone: '+31 10 987 6543',
    weight: 3.2,
    createTime: '2025-11-21 10:15:30',
    status: '已打印',
    printStatus: '已打印',
  },
  {
    id: '3',
    labelNumber: 'LABEL-2025-003',
    orderNumber: 'COSU643327632',
    recipient: 'Bob Johnson',
    address: '789 Pine Road, Utrecht, Netherlands',
    phone: '+31 30 555 1234',
    weight: 1.8,
    createTime: '2025-11-22 14:20:15',
    status: '待打印',
    printStatus: '未打印',
  },
]

export default function PureLabels() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchValue, setSearchValue] = useState('')
  
  // 根据当前路径确定激活的标签页
  const currentPath = location.pathname
  const activeTabPath = 
    currentPath === '/bookings/labels/pure' ? '/bookings/labels/pure' :
    currentPath === '/bookings/labels/search' ? '/bookings/labels/search' :
    '/bookings/labels'

  const pageKey = '/bookings/labels/pure'

  const columns: Column<PureLabel>[] = [
    { key: 'id', label: '序号', sorter: true },
    {
      key: 'labelNumber',
      label: '标签号',
      sorter: true,
      filterable: true,
      render: (_value, record: PureLabel) => (
        <div>
          <div className="text-primary-600 hover:underline cursor-pointer">
            {record.labelNumber}
          </div>
        </div>
      ),
    },
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: true,
      filterable: true,
      render: (_value, record: PureLabel) => (
        <div className="flex items-center gap-1">
          <span className="text-primary-600 hover:underline cursor-pointer">
            {record.orderNumber}
          </span>
          {record.orderNumber && (
            <button
              onClick={(e) => copyToClipboard(record.orderNumber, e)}
              className="text-gray-400 hover:text-gray-600"
              title="复制订单号"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'recipient',
      label: '收件人',
      sorter: true,
      filterable: true,
    },
    {
      key: 'address',
      label: '地址',
      filterable: true,
      render: (_value, record: PureLabel) => (
        <div className="max-w-xs truncate" title={record.address}>
          {record.address}
        </div>
      ),
    },
    { key: 'phone', label: '电话' },
    {
      key: 'weight',
      label: '重量 (KG)',
      sorter: (a, b) => a.weight - b.weight,
      render: (_value, record: PureLabel) => `${record.weight} KG`,
    },
    {
      key: 'createTime',
      label: '创建时间',
      sorter: (a, b) => {
        const dateA = new Date(a.createTime).getTime()
        const dateB = new Date(b.createTime).getTime()
        return dateA - dateB
      },
    },
    {
      key: 'printStatus',
      label: '打印状态',
      filters: [
        { text: '已打印', value: '已打印' },
        { text: '未打印', value: '未打印' },
      ],
      onFilter: (value, record) => record.printStatus === value,
      render: (_value, record: PureLabel) => (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            record.printStatus === '已打印' ? 'bg-green-500' : 'bg-gray-400'
          }`}></span>
          <span>{record.printStatus}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: () => (
        <div className="flex gap-2">
          <button className="text-primary-600 hover:underline text-xs flex items-center gap-1">
            <Printer className="w-3 h-3" />
            打印
          </button>
          <button className="text-primary-600 hover:underline text-xs">详情</button>
        </div>
      ),
    },
  ]

  // 使用列设置 hook
  const {
    columnConfigs,
    visibleColumns,
    settingsModalVisible,
    setSettingsModalVisible,
    handleSettingsClick,
    handleSaveColumnSettings,
  } = useColumnSettings(pageKey, columns)

  const statusCounts = {
    all: mockData.length,
    printed: mockData.filter(item => record.printStatus === '已打印').length,
    unprinted: mockData.filter(item => record.printStatus === '未打印').length,
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="打单"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打单', path: '/bookings/labels' },
          { label: '纯打单' }
        ]}
        tabs={[
          { label: '订单列表', path: '/bookings/labels' },
          { label: '纯打单', path: '/bookings/labels/pure' },
          { label: '搜索页面', path: '/bookings/labels/search' },
        ]}
        activeTab={activeTabPath}
        onTabChange={(path) => {
          if (path !== currentPath) {
            navigate(path)
          }
        }}
        searchPlaceholder="标签号或订单号"
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={
          <div>
            全部 / 已打印 / 未打印: {statusCounts.all} / {statusCounts.printed} / {statusCounts.unprinted}
          </div>
        }
        actionButtons={
          <>
            <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1 text-xs">
              <Printer className="w-4 h-4" />
              <span>批量打印</span>
            </button>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
              创建标签
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <DataTable
          columns={columns}
          data={mockData}
          searchValue={searchValue}
          searchableColumns={['labelNumber', 'orderNumber', 'recipient', 'address', 'phone']}
          visibleColumns={visibleColumns}
          compact={true}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </div>

      {/* Column Settings Modal */}
      <ColumnSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        columns={columnConfigs}
        onSave={handleSaveColumnSettings}
        pageKey={pageKey}
      />
    </div>
  )
}

