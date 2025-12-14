import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, CheckSquare, Square } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

interface PrintLabel {
  id: string
  labelNumber: string
  orderNumber: string
  recipient: string
  address: string
  phone: string
  weight: number
  createTime: string
  printStatus: string
}

const mockData: PrintLabel[] = [
  {
    id: '1',
    labelNumber: 'LABEL-2025-001',
    orderNumber: 'COSU643327630',
    recipient: 'John Doe',
    address: '123 Main Street, Amsterdam, Netherlands',
    phone: '+31 20 123 4567',
    weight: 2.5,
    createTime: '2025-11-20 09:42:27',
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
    printStatus: '未打印',
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
    printStatus: '未打印',
  },
]

export default function PureLabelPrintBatch() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set())
      setSelectAll(false)
    } else {
      setSelectedIds(new Set(mockData.map(item => item.id)))
      setSelectAll(true)
    }
  }

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
    setSelectAll(newSelected.size === mockData.length)
  }

  const handlePrint = async () => {
    if (selectedIds.size === 0) {
      alert('请至少选择一个标签进行打印')
      return
    }

    setLoading(true)
    try {
      // 模拟打印 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      alert(`成功打印 ${selectedIds.size} 个标签！`)
      navigate('/bookings/labels/pure')
    } catch (error) {
      console.error('打印失败:', error)
      alert('打印失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/bookings/labels/pure')
  }

  const columns: Column<PrintLabel>[] = [
    {
      key: 'select',
      label: '选择',
      render: (item: PrintLabel) => (
        <button
          onClick={() => handleSelectItem(item.id)}
          className="flex items-center justify-center"
          title={selectedIds.has(item.id) ? '取消选择' : '选择'}
        >
          {selectedIds.has(item.id) ? (
            <CheckSquare className="w-5 h-5 text-primary-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" />
          )}
        </button>
      ),
    },
    {
      key: 'labelNumber',
      label: '标签号',
      sorter: true,
      render: (item: PrintLabel) => (
        <div className="text-primary-600 font-medium">
          {item.labelNumber}
        </div>
      ),
    },
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: true,
      render: (item: PrintLabel) => (
        <div className="text-primary-600">
          {item.orderNumber}
        </div>
      ),
    },
    {
      key: 'recipient',
      label: '收件人',
      sorter: true,
    },
    {
      key: 'address',
      label: '地址',
      render: (item: PrintLabel) => (
        <div className="max-w-xs truncate" title={item.address}>
          {item.address}
        </div>
      ),
    },
    { key: 'phone', label: '电话' },
    {
      key: 'weight',
      label: '重量 (KG)',
      sorter: (a, b) => a.weight - b.weight,
      render: (item: PrintLabel) => `${item.weight} KG`,
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
      render: (item: PrintLabel) => (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            item.printStatus === '已打印' ? 'bg-green-500' : 'bg-gray-400'
          }`}></span>
          <span>{item.printStatus}</span>
        </div>
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="批量打印"
        icon={<Printer className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打单', path: '/bookings/labels' },
          { label: '纯打单', path: '/bookings/labels/pure' },
          { label: '批量打印' }
        ]}
        actionButtons={
          <button
            onClick={handleCancel}
            className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-full mx-auto">
          {/* 操作提示 */}
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <h3 className="text-xs font-medium text-blue-900 mb-2">批量打印说明</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>请选择需要打印的标签（可多选）</li>
                  <li>点击"全选"可以选择所有标签</li>
                  <li>已选择的标签数量：<strong>{selectedIds.size}</strong> 个</li>
                  <li>点击"开始打印"将打印所有选中的标签</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 统计信息 */}
          <div className="mb-4 bg-white rounded-lg border border-gray-200 shadow-sm p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-gray-600">已选择：</span>
                  <span className="ml-2 text-xs font-semibold text-primary-600">
                    {selectedIds.size}
                  </span>
                  <span className="text-xs text-gray-600 ml-1">个标签</span>
                </div>
                <div>
                  <span className="text-xs text-gray-600">总计：</span>
                  <span className="ml-2 text-xs font-semibold text-gray-900">
                    {mockData.length}
                  </span>
                  <span className="text-xs text-gray-600 ml-1">个标签</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  {selectAll ? '取消全选' : '全选'}
                </button>
              </div>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={mockData}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-1.5 py-0.5 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>取消</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || selectedIds.size === 0}
              className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{loading ? '打印中...' : `开始打印 (${selectedIds.size}个)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

