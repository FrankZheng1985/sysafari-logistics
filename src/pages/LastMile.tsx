import { useState } from 'react'
import { Truck, MapPin, Clock, Package } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
// UI components available if needed: PageContainer, ContentCard, LoadingSpinner, EmptyState
import { useColumnSettings } from '../hooks/useColumnSettings'

interface LastMileOrder {
  id: string
  orderNumber: string
  billNumber: string
  recipient: string
  address: string
  phone: string
  status: string
  deliveryDate?: string
  createTime: string
  deliveryCompany?: string
  trackingNumber?: string
}

const mockData: LastMileOrder[] = [
  {
    id: '1',
    orderNumber: 'LM-2025-001',
    billNumber: 'EGLV010501130029',
    recipient: 'John Doe',
    address: '123 Main Street, Amsterdam, Netherlands',
    phone: '+31 20 123 4567',
    status: '待派送',
    createTime: '2025-12-19 10:00',
  },
  {
    id: '2',
    orderNumber: 'LM-2025-002',
    billNumber: 'EGLV010501130030',
    recipient: 'Jane Smith',
    address: '456 Oak Avenue, Rotterdam, Netherlands',
    phone: '+31 10 987 6543',
    status: '派送中',
    createTime: '2025-12-19 11:00',
    deliveryCompany: 'DHL',
    trackingNumber: 'DHL123456789',
  },
  {
    id: '3',
    orderNumber: 'LM-2025-003',
    billNumber: 'EGLV010501130031',
    recipient: 'Bob Johnson',
    address: '789 Pine Road, Utrecht, Netherlands',
    phone: '+31 30 555 1234',
    status: '已送达',
    createTime: '2025-12-18 09:00',
    deliveryDate: '2025-12-20 14:30',
    deliveryCompany: 'PostNL',
    trackingNumber: 'PNL987654321',
  },
]

export default function LastMile() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchValue, setSearchValue] = useState('')

  const pageKey = '/last-mile'

  const filteredData = mockData.filter((item) => {
    if (selectedStatus === 'all') return true
    return item.status === selectedStatus
  })

  const columns: Column<LastMileOrder>[] = [
    { key: 'id', label: '序号' },
    {
      key: 'orderNumber',
      label: '订单号',
      render: (item: LastMileOrder) => (
        <span className="text-primary-600 font-medium">{item.orderNumber}</span>
      ),
    },
    {
      key: 'billNumber',
      label: '提单号',
      render: (item: LastMileOrder) => (
        <span className="text-primary-600 hover:underline cursor-pointer">
          {item.billNumber}
        </span>
      ),
    },
    { key: 'recipient', label: '收件人' },
    {
      key: 'address',
      label: '地址',
      render: (item: LastMileOrder) => (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs">{item.address}</span>
        </div>
      ),
    },
    { key: 'phone', label: '电话' },
    {
      key: 'status',
      label: '状态',
      render: (item: LastMileOrder) => {
        const statusColors: Record<string, string> = {
          '待派送': 'bg-yellow-100 text-yellow-800',
          '派送中': 'bg-blue-100 text-blue-800',
          '已送达': 'bg-green-100 text-green-800',
          '已取消': 'bg-red-100 text-red-800',
        }
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              statusColors[item.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {item.status}
          </span>
        )
      },
    },
    {
      key: 'deliveryCompany',
      label: '派送公司',
      render: (item: LastMileOrder) => item.deliveryCompany || '-',
    },
    {
      key: 'trackingNumber',
      label: '跟踪号',
      render: (item: LastMileOrder) => (
        <span className="text-xs font-mono">
          {item.trackingNumber || '-'}
        </span>
      ),
    },
    { key: 'deliveryDate', label: '送达时间' },
    { key: 'createTime', label: '创建时间' },
    {
      key: 'actions',
      label: '操作',
      render: (item: LastMileOrder) => (
        <div className="flex gap-2">
          <button className="text-primary-600 hover:underline text-xs">编辑</button>
          <button className="text-primary-600 hover:underline text-xs">跟踪</button>
          {item.status === '待派送' && (
            <button className="text-green-600 hover:underline text-xs">派送</button>
          )}
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
    待派送: mockData.filter((item) => item.status === '待派送').length,
    派送中: mockData.filter((item) => item.status === '派送中').length,
    已送达: mockData.filter((item) => item.status === '已送达').length,
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="最后里程管理"
        icon={<Truck className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '最后里程' }
        ]}
        tabs={[
          { label: '全部', path: '/last-mile?status=all', count: statusCounts.all },
          { label: '待派送', path: '/last-mile?status=pending', count: statusCounts.待派送 },
          { label: '派送中', path: '/last-mile?status=delivering', count: statusCounts.派送中 },
          { label: '已送达', path: '/last-mile?status=delivered', count: statusCounts.已送达 },
        ]}
        activeTab={`/last-mile?status=${selectedStatus === 'all' ? 'all' : selectedStatus}`}
        searchPlaceholder="订单号、提单号或收件人..."
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={
          <div className="flex gap-4 text-xs">
            <span>待派送: {statusCounts.待派送}</span>
            <span>派送中: {statusCounts.派送中}</span>
            <span>已送达: {statusCounts.已送达}</span>
          </div>
        }
        actionButtons={
          <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1 text-xs">
            <Package className="w-4 h-4" />
            <span>批量导入</span>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* 状态筛选 */}
        <div className="mb-4 flex gap-2">
          {(['all', '待派送', '派送中', '已送达'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                selectedStatus === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? '全部' : status}
            </button>
          ))}
        </div>

        {/* 数据表格 */}
        <DataTable
          columns={columns}
          data={filteredData}
          searchValue={searchValue}
          searchableColumns={['orderNumber', 'billNumber', 'recipient', 'address', 'phone', 'trackingNumber']}
          visibleColumns={visibleColumns}
          compact={true}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />

        {/* 统计信息卡片 */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">待派送</div>
                <div className="text-base font-bold text-gray-900">
                  {statusCounts.待派送}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">派送中</div>
                <div className="text-base font-bold text-gray-900">
                  {statusCounts.派送中}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">已送达</div>
                <div className="text-base font-bold text-gray-900">
                  {statusCounts.已送达}
                </div>
              </div>
            </div>
          </div>
        </div>
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

