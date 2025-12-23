import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, FileText, Ship, Clock, CheckCircle, TrendingUp } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ColumnSettingsModal from '../components/ColumnSettingsModal'
import { StatsCard, PageContainer, ContentCard, LoadingSpinner, EmptyState } from '../components/ui'
import { getBillsList, type BillOfLading } from '../utils/api'
import { useColumnSettings } from '../hooks/useColumnSettings'

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [bills, setBills] = useState<BillOfLading[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  
  const pageKey = '/dashboard'
  
  // 统计数据
  const stats = {
    total: total,
    arrived: bills.filter(b => b.status === '已到港').length,
    pending: bills.filter(b => b.status === '船未到港').length,
    inTransit: bills.filter(b => b.deliveryStatus === '派送中').length,
  }
  
  const columns: Column<BillOfLading>[] = [
    { 
      key: 'id', 
      label: '序号',
      render: (_value, record: BillOfLading) => (
        <span className="text-xs text-gray-600">{record.orderSeq || record.id}</span>
      ),
    },
    {
      key: 'orderNumber',
      label: '订单号',
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <span 
            className="text-primary-600 hover:underline cursor-pointer text-xs font-medium"
            onClick={() => navigate(`/bookings/bill/${record.id}`)}
          >
            {record.orderNumber || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'billNumber',
      label: '提单号',
      render: (_value, record: BillOfLading) => (
        <span 
          className="text-primary-600 hover:underline cursor-pointer text-xs font-medium"
          onClick={() => navigate(`/bookings/bill/${record.id}`)}
        >
          {record.billNumber}
        </span>
      ),
    },
    {
      key: 'containerNumber',
      label: '集装箱编号',
      render: (_value, record: BillOfLading) => (
        <span 
          className="text-primary-600 hover:underline cursor-pointer text-xs"
          onClick={() => navigate(`/bookings/bill/${record.id}`)}
        >
          {record.containerNumber}
        </span>
      ),
    },
    { 
      key: 'vessel', 
      label: '航班号/船名航次',
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1">
          <Ship className="w-3 h-3 text-gray-400" />
          <span className="text-xs">{record.vessel}</span>
        </div>
      ),
    },
    { 
      key: 'eta', 
      label: 'ETA/ATA',
      render: (_value, record: BillOfLading) => (
        <span className="text-xs">{record.eta}{record.ata ? ` / ${record.ata}` : ''}</span>
      ),
    },
    {
      key: 'pieces',
      label: '件数 / 毛重',
      render: (_value, record: BillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{record.pieces} 件</div>
          <div className="text-green-600">{record.weight} KGS</div>
        </div>
      ),
    },
    { 
      key: 'inspection', 
      label: '查验',
      render: (_value, record: BillOfLading) => (
        <span className="text-xs">{record.inspection || '-'}</span>
      ),
    },
    { 
      key: 'customsStats', 
      label: '报关统计',
      render: (_value, record: BillOfLading) => (
        <span className="text-xs">{record.customsStats || '-'}</span>
      ),
    },
    { 
      key: 'creator', 
      label: '创建者 / 时间',
      render: (_value, record: BillOfLading) => (
        <div className="text-xs">
          <div className="text-gray-900">{record.creator}</div>
          <div className="text-[10px] text-gray-500">{record.createTime}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (_value, record: BillOfLading) => (
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${record.status === '已到港' ? 'bg-green-500' : 'bg-orange-500'}`} />
          <span className="text-xs">{record.status}</span>
        </div>
      ),
    },
  ]

  // 从 API 获取数据
  useEffect(() => {
    const loadBills = async () => {
      setLoading(true)
      try {
        const response = await getBillsList({
          type: 'schedule',
          search: searchValue || undefined,
          page: 1,
          pageSize: 1000,
        })
        
        if (response.errCode === 200 && response.data) {
          setBills(response.data.list || [])
          setTotal(response.data.total || 0)
        } else {
          const { scheduleBills } = await import('../data/mockOrders')
          setBills(scheduleBills)
          setTotal(scheduleBills.length)
        }
      } catch (error) {
        console.error('加载数据失败:', error)
        const { scheduleBills } = await import('../data/mockOrders')
        setBills(scheduleBills)
        setTotal(scheduleBills.length)
      } finally {
        setLoading(false)
      }
    }
    
    loadBills()
  }, [searchValue])

  const {
    columnConfigs,
    visibleColumns,
    settingsModalVisible,
    setSettingsModalVisible,
    handleSettingsClick,
    handleSaveColumnSettings,
  } = useColumnSettings(pageKey, columns)

  return (
    <PageContainer>
      <PageHeader
        title="BP View"
        icon={<Play className="w-4 h-4 text-primary-600" />}
        tabs={[
          { label: 'SCHEDULE', path: '/schedule' },
          { label: 'HISTORY', path: '/history' },
        ]}
        activeTab="/schedule"
        searchPlaceholder="提单号或者集装箱编号..."
        onSearch={setSearchValue}
        onSettingsClick={handleSettingsClick}
        summary={<div className="text-xs text-gray-500">提单总数: <span className="font-medium text-gray-900">{total}</span></div>}
      />
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="总提单数"
          value={stats.total}
          icon={<FileText className="w-8 h-8" />}
          gradient="blue"
          onClick={() => navigate('/bookings/bill')}
        />
        <StatsCard
          title="已到港"
          value={stats.arrived}
          icon={<CheckCircle className="w-8 h-8" />}
          gradient="green"
        />
        <StatsCard
          title="待到港"
          value={stats.pending}
          icon={<Clock className="w-8 h-8" />}
          gradient="orange"
        />
        <StatsCard
          title="派送中"
          value={stats.inTransit}
          icon={<TrendingUp className="w-8 h-8" />}
          gradient="purple"
        />
      </div>
      
      {/* 数据表格 */}
      <ContentCard noPadding>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : bills.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="暂无数据"
          />
        ) : (
          <DataTable
            columns={columns}
            data={bills}
            loading={loading}
            searchValue={searchValue}
            searchableColumns={['billNumber', 'containerNumber', 'vessel']}
            visibleColumns={visibleColumns}
            compact={true}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        )}
      </ContentCard>

      <ColumnSettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        columns={columnConfigs}
        onSave={handleSaveColumnSettings}
        pageKey={pageKey}
      />
    </PageContainer>
  )
}
