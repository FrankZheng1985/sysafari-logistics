import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, Check, X, 
  Building2, Phone, Mail, User, Star, RefreshCw,
  FileText, CreditCard, Download
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

// ==================== 类型定义 ====================

interface Supplier {
  id: string
  supplierCode: string
  supplierName: string
  shortName: string
  supplierType: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  contactMobile: string
  fax: string
  website: string
  country: string
  province: string
  city: string
  address: string
  postalCode: string
  taxNumber: string
  bankName: string
  bankAccount: string
  bankBranch: string
  currency: string
  paymentTerms: string
  creditLimit: number
  status: string
  level: string
  rating: number
  cooperationDate: string
  contractExpireDate: string
  remark: string
  createdAt: string
  updatedAt: string
}

interface SupplierFormData {
  supplierCode: string
  supplierName: string
  shortName: string
  supplierType: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  contactMobile: string
  fax: string
  website: string
  country: string
  province: string
  city: string
  address: string
  postalCode: string
  taxNumber: string
  bankName: string
  bankAccount: string
  bankBranch: string
  currency: string
  paymentTerms: string
  creditLimit: number
  status: string
  level: string
  rating: number
  cooperationDate: string
  contractExpireDate: string
  remark: string
}

interface SupplierStats {
  total: number
  active: number
  inactive: number
  pending: number
  blacklist: number
  vip: number
  levelA: number
  levelB: number
  levelC: number
  newSupplier: number
}

// ==================== 常量定义 ====================

const SUPPLIER_TYPES = [
  { value: 'manufacturer', label: '生产厂家' },
  { value: 'trader', label: '贸易商' },
  { value: 'agent', label: '代理商' },
  { value: 'distributor', label: '分销商' },
  { value: 'other', label: '其他' },
]

const SUPPLIER_STATUS = [
  { value: 'active', label: '启用', color: 'bg-green-100 text-green-700' },
  { value: 'inactive', label: '停用', color: 'bg-gray-100 text-gray-500' },
  { value: 'pending', label: '待审核', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'blacklist', label: '黑名单', color: 'bg-red-100 text-red-700' },
]

const SUPPLIER_LEVELS = [
  { value: 'vip', label: 'VIP', color: 'bg-purple-100 text-purple-700' },
  { value: 'a', label: 'A级', color: 'bg-blue-100 text-blue-700' },
  { value: 'b', label: 'B级', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'c', label: 'C级', color: 'bg-gray-100 text-gray-600' },
  { value: 'new', label: '新供应商', color: 'bg-amber-100 text-amber-700' },
]

const CURRENCIES = [
  { value: 'CNY', label: '人民币 (CNY)' },
  { value: 'USD', label: '美元 (USD)' },
  { value: 'EUR', label: '欧元 (EUR)' },
  { value: 'GBP', label: '英镑 (GBP)' },
  { value: 'JPY', label: '日元 (JPY)' },
]

const initialFormData: SupplierFormData = {
  supplierCode: '',
  supplierName: '',
  shortName: '',
  supplierType: 'trader',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  contactMobile: '',
  fax: '',
  website: '',
  country: '',
  province: '',
  city: '',
  address: '',
  postalCode: '',
  taxNumber: '',
  bankName: '',
  bankAccount: '',
  bankBranch: '',
  currency: 'CNY',
  paymentTerms: '',
  creditLimit: 0,
  status: 'active',
  level: 'new',
  rating: 0,
  cooperationDate: '',
  contractExpireDate: '',
  remark: '',
}

// ==================== 主组件 ====================

export default function SupplierManage() {
  const navigate = useNavigate()
  
  // 列表状态
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stats, setStats] = useState<SupplierStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // 搜索筛选状态
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterLevel, setFilterLevel] = useState('')
  
  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'finance'>('basic')
  
  // 选中行
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const tabs = [
    { label: '供应商概览', path: '/suppliers' },
    { label: '供应商列表', path: '/suppliers/list' },
  ]

  // ==================== 数据获取 ====================

  useEffect(() => {
    fetchSuppliers()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filterType, filterStatus, filterLevel])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchText && { search: searchText }),
        ...(filterType && { type: filterType }),
        ...(filterStatus && { status: filterStatus }),
        ...(filterLevel && { level: filterLevel }),
      })
      
      const res = await fetch(`/api/suppliers?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setSuppliers(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取供应商列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/suppliers/stats')
      const data = await res.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchSuppliers()
  }

  // ==================== 弹窗处理 ====================

  const handleOpenModal = async (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        supplierCode: supplier.supplierCode,
        supplierName: supplier.supplierName,
        shortName: supplier.shortName || '',
        supplierType: supplier.supplierType,
        contactPerson: supplier.contactPerson || '',
        contactPhone: supplier.contactPhone || '',
        contactEmail: supplier.contactEmail || '',
        contactMobile: supplier.contactMobile || '',
        fax: supplier.fax || '',
        website: supplier.website || '',
        country: supplier.country || '',
        province: supplier.province || '',
        city: supplier.city || '',
        address: supplier.address || '',
        postalCode: supplier.postalCode || '',
        taxNumber: supplier.taxNumber || '',
        bankName: supplier.bankName || '',
        bankAccount: supplier.bankAccount || '',
        bankBranch: supplier.bankBranch || '',
        currency: supplier.currency || 'CNY',
        paymentTerms: supplier.paymentTerms || '',
        creditLimit: supplier.creditLimit || 0,
        status: supplier.status,
        level: supplier.level || 'new',
        rating: supplier.rating || 0,
        cooperationDate: supplier.cooperationDate || '',
        contractExpireDate: supplier.contractExpireDate || '',
        remark: supplier.remark || '',
      })
    } else {
      setEditingSupplier(null)
      // 获取新编码
      try {
        const res = await fetch('/api/suppliers/generate-code')
        const data = await res.json()
        if (data.errCode === 200) {
          setFormData({ ...initialFormData, supplierCode: data.data.code })
        } else {
          setFormData(initialFormData)
        }
      } catch {
        setFormData(initialFormData)
      }
    }
    setActiveTab('basic')
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setEditingSupplier(null)
    setFormData(initialFormData)
  }

  const handleSave = async () => {
    if (!formData.supplierCode || !formData.supplierName) {
      alert('请填写供应商编码和名称')
      return
    }

    setSaving(true)
    try {
      const url = editingSupplier 
        ? `/api/suppliers/${editingSupplier.id}`
        : '/api/suppliers'
      
      const res = await fetch(url, {
        method: editingSupplier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        handleCloseModal()
        fetchSuppliers()
        fetchStats()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存供应商失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // ==================== 操作处理 ====================

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`确定要删除供应商 "${supplier.supplierName}" 吗？`)) {
      return
    }

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchSuppliers()
        fetchStats()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除供应商失败:', error)
      alert('删除失败')
    }
  }

  const handleToggleStatus = async (supplier: Supplier) => {
    const newStatus = supplier.status === 'active' ? 'inactive' : 'active'
    
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchSuppliers()
        fetchStats()
      } else {
        alert(data.msg || '更新状态失败')
      }
    } catch (error) {
      console.error('更新状态失败:', error)
      alert('更新状态失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      alert('请选择要删除的供应商')
      return
    }
    
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个供应商吗？`)) {
      return
    }

    try {
      const res = await fetch('/api/suppliers/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setSelectedIds([])
        fetchSuppliers()
        fetchStats()
      } else {
        alert(data.msg || '批量删除失败')
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      alert('批量删除失败')
    }
  }

  // ==================== 表格配置 ====================

  const getStatusConfig = (status: string) => {
    return SUPPLIER_STATUS.find(s => s.value === status) || SUPPLIER_STATUS[0]
  }

  const getLevelConfig = (level: string) => {
    return SUPPLIER_LEVELS.find(l => l.value === level) || SUPPLIER_LEVELS[4]
  }

  const getTypeLabel = (type: string) => {
    return SUPPLIER_TYPES.find(t => t.value === type)?.label || type
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'supplierCode',
      label: '供应商编码',
      width: '110px',
      render: (item) => (
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          {item.supplierCode}
        </span>
      ),
    },
    {
      key: 'supplierName',
      label: '供应商名称',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary-600" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{item.supplierName}</div>
            {item.shortName && (
              <div className="text-xs text-gray-500 truncate">{item.shortName}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'supplierType',
      label: '类型',
      width: '90px',
      render: (item) => (
        <span className="text-xs text-gray-600">
          {getTypeLabel(item.supplierType)}
        </span>
      ),
    },
    {
      key: 'level',
      label: '级别',
      width: '80px',
      render: (item) => {
        const config = getLevelConfig(item.level)
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            {item.level === 'vip' && <Star className="w-3 h-3" />}
            {config.label}
          </span>
        )
      },
    },
    {
      key: 'contactPerson',
      label: '联系人',
      width: '100px',
      render: (item) => (
        <div className="flex items-center gap-1 text-gray-600 text-xs">
          <User className="w-3 h-3" />
          {item.contactPerson || '-'}
        </div>
      ),
    },
    {
      key: 'contactPhone',
      label: '联系电话',
      width: '120px',
      render: (item) => (
        <div className="flex items-center gap-1 text-gray-600 text-xs">
          <Phone className="w-3 h-3" />
          {item.contactPhone || item.contactMobile || '-'}
        </div>
      ),
    },
    {
      key: 'address',
      label: '地址',
      render: (item) => {
        const fullAddress = [item.country, item.province, item.city, item.address]
          .filter(Boolean)
          .join(' ')
        return (
          <span className="text-xs text-gray-600 truncate block max-w-[200px]" title={fullAddress}>
            {fullAddress || '-'}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: '状态',
      width: '80px',
      render: (item) => {
        const config = getStatusConfig(item.status)
        return (
          <button
            onClick={() => handleToggleStatus(item)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
          >
            {item.status === 'active' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {config.label}
          </button>
        )
      },
    },
    {
      key: 'actions',
      label: '操作',
      width: '100px',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(item)}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  // ==================== 渲染 ====================

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="供应商管理"
        icon={<Building2 className="w-6 h-6 text-primary-600" />}
        tabs={tabs}
        activeTab="/suppliers/list"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">总供应商</div>
            <div className="text-xl font-semibold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">启用</div>
            <div className="text-xl font-semibold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">VIP供应商</div>
            <div className="text-xl font-semibold text-purple-600">{stats.vip}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">待审核</div>
            <div className="text-xl font-semibold text-yellow-600">{stats.pending}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">黑名单</div>
            <div className="text-xl font-semibold text-red-600">{stats.blacklist}</div>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索编码、名称、联系人..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 w-60 bg-white"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            搜索
          </button>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
            title="筛选供应商类型"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            {SUPPLIER_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* 级别筛选 */}
          <select
            value={filterLevel}
            onChange={(e) => { setFilterLevel(e.target.value); setPage(1) }}
            title="筛选供应商级别"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部级别</option>
            {SUPPLIER_LEVELS.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
            title="筛选供应商状态"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            {SUPPLIER_STATUS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          {/* 刷新按钮 */}
          <button
            onClick={() => { fetchSuppliers(); fetchStats() }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              删除选中 ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            添加供应商
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={suppliers}
          loading={loading}
          rowKey="id"
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (p, ps) => {
              setPage(p)
              if (ps) setPageSize(ps)
            },
          }}
        />
      </div>

      {/* 编辑弹窗 */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-lg shadow-xl w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {editingSupplier ? '编辑供应商' : '添加供应商'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600" title="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab切换 */}
            <div className="px-4 border-b border-gray-200">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === 'basic' 
                      ? 'border-primary-600 text-primary-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-1" />
                  基本信息
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === 'contact' 
                      ? 'border-primary-600 text-primary-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Phone className="w-4 h-4 inline mr-1" />
                  联系信息
                </button>
                <button
                  onClick={() => setActiveTab('finance')}
                  className={`py-3 px-1 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === 'finance' 
                      ? 'border-primary-600 text-primary-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 inline mr-1" />
                  财务信息
                </button>
              </div>
            </div>

            {/* 表单内容 */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* 基本信息 */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* 供应商编码 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        供应商编码 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.supplierCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierCode: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="如：SUP0001"
                      />
                    </div>

                    {/* 供应商名称 */}
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        供应商名称 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.supplierName}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入供应商全称"
                      />
                    </div>

                    {/* 简称 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">简称</label>
                      <input
                        type="text"
                        value={formData.shortName}
                        onChange={(e) => setFormData(prev => ({ ...prev, shortName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入简称"
                      />
                    </div>

                    {/* 供应商类型 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">供应商类型</label>
                      <select
                        value={formData.supplierType}
                        onChange={(e) => setFormData(prev => ({ ...prev, supplierType: e.target.value }))}
                        title="选择供应商类型"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        {SUPPLIER_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 供应商级别 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">供应商级别</label>
                      <select
                        value={formData.level}
                        onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                        title="选择供应商级别"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        {SUPPLIER_LEVELS.map(level => (
                          <option key={level.value} value={level.value}>{level.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 状态 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">状态</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        title="选择状态"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        {SUPPLIER_STATUS.map(status => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 合作开始日期 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">合作开始日期</label>
                      <input
                        type="date"
                        value={formData.cooperationDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, cooperationDate: e.target.value }))}
                        title="选择合作开始日期"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                    </div>

                    {/* 合同到期日期 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">合同到期日期</label>
                      <input
                        type="date"
                        value={formData.contractExpireDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, contractExpireDate: e.target.value }))}
                        title="选择合同到期日期"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* 备注 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                    <textarea
                      value={formData.remark}
                      onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="输入备注信息"
                    />
                  </div>
                </div>
              )}

              {/* 联系信息 */}
              {activeTab === 'contact' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* 联系人 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">联系人</label>
                      <input
                        type="text"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入联系人姓名"
                      />
                    </div>

                    {/* 联系电话 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">联系电话</label>
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入联系电话"
                      />
                    </div>

                    {/* 手机号 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">手机号</label>
                      <input
                        type="tel"
                        value={formData.contactMobile}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactMobile: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入手机号"
                      />
                    </div>

                    {/* 邮箱 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">邮箱</label>
                      <input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入邮箱地址"
                      />
                    </div>

                    {/* 传真 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">传真</label>
                      <input
                        type="text"
                        value={formData.fax}
                        onChange={(e) => setFormData(prev => ({ ...prev, fax: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入传真号码"
                      />
                    </div>

                    {/* 网站 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">网站</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入公司网站"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">地址信息</h4>
                    <div className="grid grid-cols-4 gap-4">
                      {/* 国家 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">国家</label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                          placeholder="国家"
                        />
                      </div>

                      {/* 省/州 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">省/州</label>
                        <input
                          type="text"
                          value={formData.province}
                          onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                          placeholder="省/州"
                        />
                      </div>

                      {/* 城市 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">城市</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                          placeholder="城市"
                        />
                      </div>

                      {/* 邮编 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">邮编</label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                          placeholder="邮政编码"
                        />
                      </div>
                    </div>

                    {/* 详细地址 */}
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">详细地址</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入详细地址"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 财务信息 */}
              {activeTab === 'finance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* 税号 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">税号</label>
                      <input
                        type="text"
                        value={formData.taxNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, taxNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入纳税人识别号"
                      />
                    </div>

                    {/* 结算币种 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">结算币种</label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                        title="选择结算币种"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        {CURRENCIES.map(currency => (
                          <option key={currency.value} value={currency.value}>{currency.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 开户行 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">开户行</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入开户银行名称"
                      />
                    </div>

                    {/* 开户支行 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">开户支行</label>
                      <input
                        type="text"
                        value={formData.bankBranch}
                        onChange={(e) => setFormData(prev => ({ ...prev, bankBranch: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入支行名称"
                      />
                    </div>

                    {/* 银行账号 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">银行账号</label>
                      <input
                        type="text"
                        value={formData.bankAccount}
                        onChange={(e) => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入银行账号"
                      />
                    </div>

                    {/* 信用额度 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">信用额度</label>
                      <input
                        type="number"
                        value={formData.creditLimit}
                        onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="输入信用额度"
                      />
                    </div>

                    {/* 付款条款 */}
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">付款条款</label>
                      <input
                        type="text"
                        value={formData.paymentTerms}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        placeholder="如：月结30天、预付款等"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
