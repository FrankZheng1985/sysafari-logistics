import { useState } from 'react'
import { Package } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { useColumnSettings } from '../hooks/useColumnSettings'

interface PackageItem {
  id: string
  packageNumber: string
  quantity: number
  creator: string
  createTime: string
  status: string
}

const mockData: PackageItem[] = [
  {
    id: '1',
    packageNumber: 'PN-39K4ZPK8',
    quantity: 1,
    creator: 'op1@xianfenghk.com',
    createTime: '2025-08-09 15:14:00',
    status: '成功',
  },
]

export default function OrderPackages() {
  const [searchValue, setSearchValue] = useState('')
  
  const pageKey = '/bookings/packages'
  
  const columns: Column<PackageItem>[] = [
    { key: 'id', label: '序号' },
    {
      key: 'packageNumber',
      label: '包裹号',
      render: (_value, record: PackageItem) => (
        <div className="flex items-center gap-2">
          <span className="text-primary-600">{record.packageNumber}</span>
        </div>
      ),
    },
    { key: 'quantity', label: '数量' },
    { key: 'creator', label: '创建者' },
    { key: 'createTime', label: '创建时间' },
    {
      key: 'status',
      label: '状态',
      render: (_value, record: PackageItem) => (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>{record.status}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: () => (
        <div className="flex gap-2">
          <button className="text-primary-600 hover:underline">详情</button>
          <button className="text-primary-600 hover:underline">下载</button>
          <button className="text-red-600 hover:underline">删除</button>
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

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="打包"
        icon={<Package className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打包' }
        ]}
        searchPlaceholder="包裹号"
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={<div>包裹数量: 1</div>}
        actionButtons={
          <>
            <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1 text-xs">
              <span>+</span>
              <span>单个创建</span>
            </button>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
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
          searchableColumns={['packageNumber', 'creator']}
          visibleColumns={visibleColumns}
          compact={true}
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

