import { useState } from 'react'
import { MapPin } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { useColumnSettings } from '../hooks/useColumnSettings'

interface Address {
  id: string
  companyName: string
  abbreviation: string
  addressCode: string
  vatNumber: string
  eoriNo: string
  isEntity: boolean
  creator: string
  createTime: string
}

const mockAddresses: Address[] = [
  {
    id: '1',
    companyName: 'Shanghai Fuzun Trading Co., Ltd',
    abbreviation: 'Fuzun Trading',
    addressCode: 'SS_VHCQF',
    vatNumber: '-',
    eoriNo: '',
    isEntity: false,
    creator: 'op1@xianfenghk.com',
    createTime: '2025-11-19 03:18:36',
  },
]

export default function AddressTax() {
  const [searchValue, setSearchValue] = useState('')
  
  const pageKey = '/tools/address'
  
  const columns: Column<Address>[] = [
    { key: 'id', label: '序号' },
    { key: 'companyName', label: '公司名' },
    { key: 'abbreviation', label: '公司简称' },
    { key: 'addressCode', label: '地址编码' },
    { key: 'vatNumber', label: '增值税号' },
    { key: 'eoriNo', label: 'EORI No.' },
    {
      key: 'isEntity',
      label: '是实体公司?',
      render: (item: Address) => (
        <span>{item.isEntity ? '✓' : '✗'}</span>
      ),
    },
    { key: 'creator', label: '创建者' },
    { key: 'createTime', label: '创建时间' },
    {
      key: 'actions',
      label: '操作',
      render: () => (
        <div className="flex gap-2">
          <button className="text-primary-600 hover:underline">详情</button>
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
        title="地址 & 税号"
        icon={<MapPin className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '地址 & 税号' }
        ]}
        tabs={[
          { label: '我的地址', path: '/tools/address' },
          { label: '我的税号', path: '/tools/address/tax' },
          { label: 'POA模板', path: '/tools/address/poa' },
        ]}
        activeTab="/tools/address"
        searchPlaceholder="地址编码、增值税号或eori no."
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        actionButtons={
          <>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
              上传创建
            </button>
            <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs">
              单个创建
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <DataTable
          columns={columns}
          data={mockAddresses}
          searchValue={searchValue}
          searchableColumns={['companyName', 'abbreviation', 'addressCode', 'vatNumber', 'eoriNo']}
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

