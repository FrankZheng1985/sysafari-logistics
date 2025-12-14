import { useState } from 'react'
import { FileText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { useColumnSettings } from '../hooks/useColumnSettings'

interface Invoice {
  id: string
  invoiceNumber: string
  amount: number
  invoiceDate: string
}

const mockInvoices: Invoice[] = [
  { id: '1', invoiceNumber: 'GL041569', amount: 2330.88, invoiceDate: '2025-11-19' },
  { id: '2', invoiceNumber: 'GL041508', amount: 413.04, invoiceDate: '2025-11-17' },
  { id: '3', invoiceNumber: 'GL041509', amount: 2554.32, invoiceDate: '2025-11-17' },
]

export default function PaymentInvoice() {
  const [searchValue, setSearchValue] = useState('')
  
  const pageKey = '/tools/payment'
  
  const columns: Column<Invoice>[] = [
    { key: 'id', label: '序号' },
    { key: 'invoiceNumber', label: '发票号' },
    {
      key: 'amount',
      label: '金额',
      render: (item: Invoice) => `€${item.amount.toLocaleString()}`,
    },
    { key: 'invoiceDate', label: '开票日期' },
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
        title="付款&发票"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '工具', path: '/tools/inquiry' },
          { label: '付款&发票' }
        ]}
        tabs={[
          { label: '未付款', path: '/tools/payment' },
          { label: '消费明细', path: '/tools/payment/consumption' },
          { label: '充值记录', path: '/tools/payment/recharge' },
        ]}
        activeTab="/tools/payment"
        searchPlaceholder="模糊搜索"
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={
          <div>
            未付款金额: <span className="text-red-600 font-bold text-lg">26,981.29</span>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <DataTable
          columns={columns}
          data={mockInvoices}
          searchValue={searchValue}
          searchableColumns={['invoiceNumber']}
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

