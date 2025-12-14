import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { useColumnSettings } from '../hooks/useColumnSettings'
import { downloadFile } from '../utils/api'

interface Declaration {
  id: string
  declarationId: string
  country: string
  type: string
  success: number
  producing: number
  failed: number
  total: number
  priority: string
  creator: string
  createTime: string
}

const mockData: Declaration[] = [
  {
    id: '1',
    declarationId: 'DC-XRNN6W6V',
    country: 'NL',
    type: 'DMS',
    success: 1,
    producing: 0,
    failed: 0,
    total: 1,
    priority: '正常',
    creator: 'op1@xianfenghk.com',
    createTime: '2025-11-20 17:26',
  },
]

export default function OrderDeclarations() {
  const [searchValue, setSearchValue] = useState('')
  
  const pageKey = '/bookings/declarations'

  const handleDownload = async (declarationId: string) => {
    try {
      await downloadFile(declarationId)
    } catch (error) {
      alert('下载失败，请稍后重试')
      console.error('下载文件失败:', error)
    }
  }
  
  const columns: Column<Declaration>[] = [
    { key: 'id', label: '序号' },
    {
      key: 'declarationId',
      label: '申报 ID',
      render: (item: Declaration) => (
        <div className="flex items-center gap-2">
          <span className="text-primary-600">{item.declarationId}</span>
        </div>
      ),
    },
    { key: 'country', label: '申报国家' },
    { key: 'type', label: '申报类型' },
    {
      key: 'status',
      label: '成功 / 生产中 / 失败 / 全部',
      render: (item: Declaration) => (
        <span>
          {item.success} / {item.producing} / {item.failed} / {item.total}
        </span>
      ),
    },
    { key: 'priority', label: '优先级' },
    { key: 'creator', label: '创建者' },
    { key: 'createTime', label: '创建时间' },
    {
      key: 'actions',
      label: '操作',
      render: (item: Declaration) => (
        <div className="flex gap-2">
          <button className="text-primary-600 hover:underline">详情</button>
          <button
            onClick={() => handleDownload(item.declarationId)}
            className="flex items-center gap-1 text-primary-600 hover:underline"
            title="下载文件"
          >
            <Download className="w-4 h-4" />
            <span>下载</span>
          </button>
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
        title="报关"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '报关' }
        ]}
        tabs={[
          { label: '申报列表', path: '/bookings/declarations' },
          { label: '下单失败', path: '/bookings/declarations/failed' },
          { label: '审查列表', path: '/bookings/declarations/review', count: 25 },
          { label: '税务未审核', path: '/bookings/declarations/tax', count: 2 },
          { label: '待确认税金', path: '/bookings/declarations/tax-confirm', count: 1 },
          { label: '待发送报关', path: '/bookings/declarations/pending', count: 31 },
          { label: '搜索页面', path: '/bookings/declarations/search' },
        ]}
        activeTab="/bookings/declarations"
        searchPlaceholder="申报 ID"
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={
          <div className="flex gap-4">
            <span className="text-primary-600 font-medium">成功 324</span>
            <span>生产中</span>
            <span>失败 7</span>
          </div>
        }
        actionButtons={
          <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs">
            + 上传创建
          </button>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800 space-y-2">
            <p>
              1. 电商AMAZON报关单下单流程调整:无需先创建品类库,再来创建报关资料,只需要创建报关资料,系统会根据资料自行创建品类库,此时报关单状态:生产中;
            </p>
            <p>
              2. 系统会在闲时(晚10点)进行品类信息拉取和截图,成功后会更新报关单状态,失败进入未提交审核状态,需手动修改;若需加急生产请联系管理员加急;报关资料请提前创建
            </p>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={mockData}
          searchValue={searchValue}
          searchableColumns={['declarationId', 'country', 'type', 'creator']}
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

