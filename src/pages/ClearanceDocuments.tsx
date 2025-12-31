import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText, Plus, Filter, Edit2, Trash2,
  CheckCircle, Clock, AlertCircle, XCircle, FileCheck, Send
} from 'lucide-react'
import { PageContainer, ContentCard } from '../components/ui'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import ClearanceDocumentModal from '../components/ClearanceDocumentModal'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 单证类型接口
interface DocumentType {
  id: number
  code: string
  nameCn: string
  nameEn: string
  description: string
}

// 清关单证接口
interface ClearanceDocument {
  id: string
  documentNo: string
  billId: string
  billNumber: string
  documentType: string
  documentTypeName: string
  shipperName: string
  consigneeName: string
  goodsDescription: string
  hsCode: string
  quantity: number
  grossWeight: number
  totalValue: number
  currency: string
  status: string
  reviewStatus: string
  createdByName: string
  createdAt: string
}

// 统计数据接口
interface ClearanceStats {
  total: { count: number; totalValue: number }
  byType: Array<{ type: string; typeName: string; count: number }>
  byStatus: Array<{ status: string; count: number }>
}

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: Clock },
  pending: { label: '待提交', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  submitted: { label: '已提交', color: 'bg-blue-100 text-blue-700', icon: Send },
  processing: { label: '处理中', color: 'bg-purple-100 text-purple-700', icon: Clock },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '已审核', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
}

export default function ClearanceDocuments() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<ClearanceDocument[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [stats, setStats] = useState<ClearanceStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // 筛选条件
  const [searchValue, setSearchValue] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDocument, setEditingDocument] = useState<ClearanceDocument | null>(null)
  
  // 当前选中的Tab
  const [activeTab, setActiveTab] = useState('overview')
  
  const tabs = [
    { key: 'overview', label: '单证概览', path: '/bookings/clearance' },
    { key: 'pending', label: '待处理', path: '/bookings/clearance?status=pending' },
    { key: 'processing', label: '处理中', path: '/bookings/clearance?status=processing' },
    { key: 'completed', label: '已完成', path: '/bookings/clearance?status=completed' },
    { key: 'draft', label: '草稿', path: '/bookings/clearance?status=draft' },
  ]

  useEffect(() => {
    loadDocumentTypes()
    loadStats()
  }, [])

   
  useEffect(() => {
    loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchValue, filterType, filterStatus, activeTab])

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/clearance/document-types`)
      const data = await response.json()
      if (data.errCode === 200) {
        setDocumentTypes(data.data || [])
      }
    } catch (error) {
      console.error('加载单证类型失败:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/clearance/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      
      if (searchValue) params.append('search', searchValue)
      if (filterType) params.append('documentType', filterType)
      if (filterStatus) params.append('status', filterStatus)
      // 根据标签筛选状态
      if (activeTab !== 'overview') {
        params.append('status', activeTab)
      }
      
      const response = await fetch(`${API_BASE}/api/clearance/documents?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setDocuments(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载单证列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingDocument(null)
    setModalVisible(true)
  }

  const handleEdit = (doc: ClearanceDocument) => {
    setEditingDocument(doc)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此单证吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/clearance/documents/${id}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadDocuments()
        loadStats()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const handleModalSuccess = () => {
    setModalVisible(false)
    setEditingDocument(null)
    loadDocuments()
    loadStats()
  }

  const columns: Column<ClearanceDocument>[] = [
    {
      key: 'documentNo',
      label: '单证编号',
      render: (_value, record) => (
        <span className="text-primary-600 font-medium cursor-pointer hover:underline" onClick={() => handleEdit(record)}>
          {record.documentNo}
        </span>
      ),
    },
    {
      key: 'documentTypeName',
      label: '单证类型',
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span>{record.documentTypeName || record.documentType}</span>
        </div>
      ),
    },
    {
      key: 'billNumber',
      label: '关联订单',
      render: (_value, record) => (
        record.billNumber ? (
          <span 
            className="text-primary-600 cursor-pointer hover:underline"
            onClick={() => record.billId && navigate(`/bookings/bill/${record.billId}`)}
          >
            {record.billNumber}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'shipperName',
      label: '发货人',
      render: (_value, record) => <span className="truncate max-w-[120px]" title={record.shipperName}>{record.shipperName || '-'}</span>,
    },
    {
      key: 'consigneeName',
      label: '收货人',
      render: (_value, record) => <span className="truncate max-w-[120px]" title={record.consigneeName}>{record.consigneeName || '-'}</span>,
    },
    {
      key: 'goodsDescription',
      label: '货物描述',
      render: (_value, record) => <span className="truncate max-w-[150px]" title={record.goodsDescription}>{record.goodsDescription || '-'}</span>,
    },
    {
      key: 'totalValue',
      label: '货值',
      render: (_value, record) => (
        <span className="font-medium">
          {record.currency} {record.totalValue?.toLocaleString() || '0'}
        </span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (_value, record) => {
        const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.draft
        const Icon = config.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${config.color}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        )
      },
    },
    {
      key: 'reviewStatus',
      label: '审核',
      render: (_value, record) => {
        const config = REVIEW_STATUS_CONFIG[record.reviewStatus] || REVIEW_STATUS_CONFIG.pending
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${config.color}`}>
            {config.label}
          </span>
        )
      },
    },
    {
      key: 'createdAt',
      label: '创建时间',
      render: (_value, record) => <span className="text-gray-500 text-xs">{record.createdAt?.slice(0, 16)}</span>,
    },
    {
      key: 'actions',
      label: '操作',
      render: (_value, record) => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleEdit(record)} className="text-primary-600 hover:text-primary-700" title="编辑">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-700" title="删除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        breadcrumbs={[
          { label: '订单管理', path: '/bookings/bill' },
          { label: '单证管理' }
        ]}
        tabs={tabs.map(t => ({ label: t.label, path: t.path }))}
        activeTab={tabs.find(t => t.key === activeTab)?.path || tabs[0].path}
        onTabChange={(path) => {
          const tab = tabs.find(t => t.path === path)
          if (tab) {
            setActiveTab(tab.key)
          }
        }}
        searchPlaceholder="搜索单证编号/发货人/收货人"
        onSearch={setSearchValue}
        actionButtons={
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            新建单证
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* 统计卡片 - 仅在概览页显示 */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-6 gap-4">
            {/* 单证总数 - 蓝色 */}
            <div className="relative rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 overflow-hidden">
              <div className="absolute top-3 right-3">
                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-blue-600/80">单证总数</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{stats?.total?.count || 0}</p>
              </div>
            </div>
            
            {/* 待处理 - 黄色 */}
            <div 
              className="relative rounded-xl p-4 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setActiveTab('pending')}
            >
              <div className="absolute top-3 right-3">
                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-amber-600/80">待处理</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {stats?.byStatus?.find(s => s.status === 'pending')?.count || 0}
                </p>
              </div>
            </div>
            
            {/* 处理中 - 紫色 */}
            <div 
              className="relative rounded-xl p-4 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setActiveTab('processing')}
            >
              <div className="absolute top-3 right-3">
                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                  <AlertCircle className="w-4 h-4 text-purple-600" />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-purple-600/80">处理中</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">
                  {stats?.byStatus?.find(s => s.status === 'processing')?.count || 0}
                </p>
              </div>
            </div>
            
            {/* 已完成 - 绿色 */}
            <div 
              className="relative rounded-xl p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setActiveTab('completed')}
            >
              <div className="absolute top-3 right-3">
                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-green-600/80">已完成</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {stats?.byStatus?.find(s => s.status === 'completed')?.count || 0}
                </p>
              </div>
            </div>
            
            {/* 草稿 - 灰色 */}
            <div 
              className="relative rounded-xl p-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setActiveTab('draft')}
            >
              <div className="absolute top-3 right-3">
                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                  <FileText className="w-4 h-4 text-slate-600" />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-slate-600/80">草稿</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">
                  {stats?.byStatus?.find(s => s.status === 'draft')?.count || 0}
                </p>
              </div>
            </div>
            
            {/* 货值总额 - 青绿色 */}
            <div className="relative rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 overflow-hidden">
              <div className="absolute top-3 right-3">
                <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-medium text-emerald-600/80">货值总额</p>
                <p className="text-xl font-bold text-emerald-700 mt-1">
                  ${(stats?.total?.totalValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 筛选栏 */}
        <ContentCard className="p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">筛选:</span>
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部类型</option>
              {documentTypes.map((type) => (
                <option key={type.code} value={type.code}>{type.nameCn}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            
            {(filterType || filterStatus) && (
              <button
                onClick={() => { setFilterType(''); setFilterStatus(''); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                清除筛选
              </button>
            )}
          </div>
        </ContentCard>

        {/* 数据表格 */}
        <ContentCard>
          <DataTable
            columns={columns}
            data={documents}
            loading={loading}
            searchValue={searchValue}
            pagination={{
              total,
              page,
              pageSize,
              onChange: setPage,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
            compact
          />
        </ContentCard>
      </div>

      {/* 新建/编辑单证弹窗 */}
      <ClearanceDocumentModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setEditingDocument(null); }}
        onSuccess={handleModalSuccess}
        data={editingDocument}
        documentTypes={documentTypes}
      />
    </PageContainer>
  )
}

