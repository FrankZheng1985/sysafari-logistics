import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { useColumnSettings } from '../hooks/useColumnSettings'

interface Order {
  id: string
  orderNumber: string
  transferMethod: string
  success: number
  failed: number
  generating: number
  total: number
  creationMethod: string
  creator: string
  createTime: string
  status: string
}

const mockData: Order[] = [
  {
    id: '1',
    orderNumber: 'COSU643327630',
    transferMethod: 'DECLARATION ONLY',
    success: 1,
    failed: 0,
    generating: 0,
    total: 1,
    creationMethod: 'EasyBill',
    creator: 'op1@xianfenghk.com',
    createTime: '2025-11-20 09:42:27',
    status: '成功',
  },
  {
    id: '2',
    orderNumber: 'COSU643327631',
    transferMethod: 'FULL CONTAINER',
    success: 5,
    failed: 0,
    generating: 2,
    total: 7,
    creationMethod: 'EasyBill',
    creator: 'op2@xianfenghk.com',
    createTime: '2025-11-21 10:15:30',
    status: '生成中',
  },
  {
    id: '3',
    orderNumber: 'COSU643327632',
    transferMethod: 'LCL',
    success: 10,
    failed: 1,
    generating: 0,
    total: 11,
    creationMethod: 'Manual',
    creator: 'danzheng1',
    createTime: '2025-11-22 14:20:15',
    status: '成功',
  },
]

export default function OrderLabels() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchValue, setSearchValue] = useState('')
  
  // 根据当前路径确定激活的标签页
  const currentPath = location.pathname
  const activeTabPath = 
    currentPath === '/bookings/labels/pure' ? '/bookings/labels/pure' :
    currentPath === '/bookings/labels/search' ? '/bookings/labels/search' :
    '/bookings/labels'

  const pageKey = '/bookings/labels'

  const columns: Column<Order>[] = [
    { key: 'id', label: '序号', sorter: true },
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: true,
      filterable: true,
      render: (item: Order) => (
        <div>
          <div className="text-primary-600 hover:underline cursor-pointer">
            {item.orderNumber}
          </div>
        </div>
      ),
    },
    { 
      key: 'transferMethod', 
      label: '转运方式',
      sorter: true,
      filterable: true,
    },
    {
      key: 'counts',
      label: '成功 / 失败 / 生成中 / 全部',
      render: (item: Order) => (
        <span>
          {item.success} / {item.failed} / {item.generating} / {item.total}
        </span>
      ),
    },
    { 
      key: 'creationMethod', 
      label: '创建方式',
      sorter: true,
      filterable: true,
    },
    { 
      key: 'creator', 
      label: '创建者',
      sorter: true,
      filterable: true,
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
      key: 'status',
      label: '状态',
      filters: [
        { text: '成功', value: '成功' },
        { text: '生成中', value: '生成中' },
        { text: '失败', value: '失败' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (item: Order) => (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            item.status === '成功' ? 'bg-green-500' :
            item.status === '生成中' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}></span>
          <span>{item.status}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: () => (
        <div className="flex gap-2">
          <button className="text-primary-600 hover:underline text-xs">详情</button>
          <button className="text-primary-600 hover:underline text-xs">下载</button>
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
    success: mockData.filter(item => item.status === '成功').length,
    generating: mockData.filter(item => item.status === '生成中').length,
    failed: mockData.filter(item => item.status === '失败').length,
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="打单"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打单' }
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
        searchPlaceholder="订单号"
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={
          <div>
            全部 / 成功 / 生成中 / 失败: {statusCounts.all} / {statusCounts.success} / {statusCounts.generating} / {statusCounts.failed}
          </div>
        }
        actionButtons={
          <>
            <button
              onClick={() => navigate('/bookings/labels/create-single')}
              className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1 text-xs"
            >
              <span>+</span>
              <span>单个创建</span>
            </button>
            <button
              onClick={() => navigate('/bookings/labels/create-batch')}
              className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
            >
              批量创建
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <DataTable
          columns={columns}
          data={mockData}
          searchValue={searchValue}
          searchableColumns={['orderNumber', 'transferMethod', 'creationMethod', 'creator']}
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

