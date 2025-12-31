import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, Search, Copy } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { copyToClipboard } from '../components/Toast'
// UI components available if needed: PageContainer, ContentCard, LoadingSpinner, EmptyState
import { useColumnSettings } from '../hooks/useColumnSettings'

interface SearchResult {
  id: string
  labelNumber: string
  orderNumber: string
  billNumber: string
  recipient: string
  address: string
  createTime: string
  status: string
  printTime?: string
}

const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    labelNumber: 'LABEL-2025-001',
    orderNumber: 'COSU643327630',
    billNumber: 'EGLV010501130029',
    recipient: 'John Doe',
    address: '123 Main Street, Amsterdam, Netherlands',
    createTime: '2025-11-20 09:42:27',
    status: '已打印',
    printTime: '2025-11-20 10:15:30',
  },
  {
    id: '2',
    labelNumber: 'LABEL-2025-002',
    orderNumber: 'COSU643327631',
    billNumber: 'EGLV010501130030',
    recipient: 'Jane Smith',
    address: '456 Oak Avenue, Rotterdam, Netherlands',
    createTime: '2025-11-21 10:15:30',
    status: '待打印',
  },
]

export default function LabelSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  // 根据当前路径确定激活的标签页
  const currentPath = location.pathname
  const activeTabPath = 
    currentPath === '/bookings/labels/pure' ? '/bookings/labels/pure' :
    currentPath === '/bookings/labels/search' ? '/bookings/labels/search' :
    '/bookings/labels'

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    // 模拟搜索延迟
    setTimeout(() => {
      // 简单的搜索逻辑：根据查询匹配订单号、标签号或提单号
      const filtered = mockSearchResults.filter(item =>
        item.labelNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.billNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.recipient.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setSearchResults(filtered)
      setIsSearching(false)
    }, 500)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const pageKey = '/bookings/labels/search'
  
  const columns: Column<SearchResult>[] = [
    { key: 'id', label: '序号', sorter: true },
    {
      key: 'labelNumber',
      label: '标签号',
      sorter: true,
      render: (_value, record: SearchResult) => (
        <div className="flex items-center gap-1">
          <span className="text-primary-600 hover:underline cursor-pointer">
            {record.labelNumber}
          </span>
          {record.labelNumber && (
            <button
              onClick={(e) => copyToClipboard(record.labelNumber, e)}
              className="text-gray-400 hover:text-gray-600"
              title="复制标签号"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'orderNumber',
      label: '订单号',
      sorter: true,
      render: (_value, record: SearchResult) => (
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
      key: 'billNumber',
      label: '提单号',
      sorter: true,
      render: (_value, record: SearchResult) => (
        <div className="flex items-center gap-1">
          <span className="text-primary-600 hover:underline cursor-pointer">
            {record.billNumber}
          </span>
          {record.billNumber && (
            <button
              onClick={(e) => copyToClipboard(record.billNumber, e)}
              className="text-gray-400 hover:text-gray-600"
              title="复制提单号"
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
    },
    {
      key: 'address',
      label: '地址',
      render: (_value, record: SearchResult) => (
        <div className="max-w-xs truncate" title={record.address}>
          {record.address}
        </div>
      ),
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
        { text: '已打印', value: '已打印' },
        { text: '待打印', value: '待打印' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (_value, record: SearchResult) => (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            record.status === '已打印' ? 'bg-green-500' : 'bg-yellow-500'
          }`}></span>
          <span>{record.status}</span>
        </div>
      ),
    },
    {
      key: 'printTime',
      label: '打印时间',
      render: (_value, record: SearchResult) => record.printTime || '-',
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

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="打单"
        icon={<FileText className="w-6 h-6 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '打单', path: '/bookings/labels' },
          { label: '搜索页面' }
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
        searchPlaceholder="标签号、订单号、提单号或收件人"
        onSettingsClick={handleSettingsClick}
        summary={
          <div>
            搜索结果: {searchResults.length} 条
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        {/* 搜索区域 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入标签号、订单号、提单号或收件人进行搜索..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                />
              </div>
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-1.5 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
            >
              <Search className="w-4 h-4" />
              <span>{isSearching ? '搜索中...' : '搜索'}</span>
            </button>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
              >
                清空
              </button>
            )}
          </div>
        </div>

        {/* 搜索结果 */}
        {searchResults.length > 0 ? (
          <DataTable
            columns={columns}
            data={searchResults}
            visibleColumns={visibleColumns}
            compact={true}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        ) : searchQuery ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">未找到相关结果</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">请输入搜索关键词进行查询</p>
          </div>
        )}
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

