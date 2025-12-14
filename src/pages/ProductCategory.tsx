import { useState } from 'react'
import { Package } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { useColumnSettings } from '../hooks/useColumnSettings'

export default function ProductCategory() {
  const [searchValue, setSearchValue] = useState('')
  
  const pageKey = '/tools/product-category'
  
  const columns: Column<any>[] = []
  
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
        title="品类库"
        icon={<Package className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '品类库' }
        ]}
        tabs={[
          { label: '未提交审核', path: '/tools/productCare', count: 2 },
          { label: '待审核', path: '/tools/productCare/pending' },
          { label: '不通过', path: '/tools/productCare/rejected' },
        ]}
        activeTab="/tools/productCare"
        searchPlaceholder="请输入商品编号,多个以空格分隔,..."
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        actionButtons={
          <>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
              申请审核
            </button>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
              NL品类库
            </button>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
              BE品类库
            </button>
            <button className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs">
              上传创建
            </button>
            <button className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs">
              + 单个创建
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            未提交审核列表来源为报关单创建的品类,是报关单生产失败的品类,需要手动修改补充价格等信息
          </div>
        </div>
        <DataTable
          columns={columns}
          data={[]}
          searchValue={searchValue}
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

