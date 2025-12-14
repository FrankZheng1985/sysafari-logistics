import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, Check, X, 
  Building2, Phone, Mail, User, Truck
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

interface ServiceProvider {
  id: string
  providerCode: string
  providerName: string
  serviceType: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  description: string
  status: string
  createTime: string
  updateTime: string
}

interface ProviderFormData {
  providerCode: string
  providerName: string
  serviceType: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  description: string
  status: string
}

const SERVICE_TYPES = [
  { value: 'delivery', label: '派送服务' },
  { value: 'warehouse', label: '仓储服务' },
  { value: 'customs', label: '报关服务' },
  { value: 'trucking', label: '拖车服务' },
  { value: 'shipping', label: '船运服务' },
  { value: 'other', label: '其他服务' },
]

const initialFormData: ProviderFormData = {
  providerCode: '',
  providerName: '',
  serviceType: 'delivery',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  description: '',
  status: 'active',
}

export default function ServiceProviders() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<ServiceProvider[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('active')

  const [modalVisible, setModalVisible] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>(initialFormData)
  const [saving, setSaving] = useState(false)

  const tabs = [
    { label: 'TMS概览', path: '/tms' },
    { label: 'CMR管理', path: '/cmr-manage' },
    { label: '服务商管理', path: '/tms/service-providers' },
    { label: '运费管理', path: '/tms/pricing' },
  ]

  useEffect(() => {
    fetchProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, searchText, filterType, filterStatus])

  const fetchProviders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchText && { search: searchText }),
        ...(filterType && { type: filterType }),
        ...(filterStatus && { status: filterStatus }),
      })
      
      const res = await fetch(`/api/service-providers?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setProviders(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取服务商列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (provider?: ServiceProvider) => {
    if (provider) {
      setEditingProvider(provider)
      setFormData({
        providerCode: provider.providerCode,
        providerName: provider.providerName,
        serviceType: provider.serviceType,
        contactPerson: provider.contactPerson,
        contactPhone: provider.contactPhone,
        contactEmail: provider.contactEmail,
        address: provider.address,
        description: provider.description,
        status: provider.status,
      })
    } else {
      setEditingProvider(null)
      setFormData(initialFormData)
    }
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setEditingProvider(null)
    setFormData(initialFormData)
  }

  const handleSave = async () => {
    if (!formData.providerCode || !formData.providerName) {
      alert('请填写服务商编码和名称')
      return
    }

    setSaving(true)
    try {
      const url = editingProvider 
        ? `/api/service-providers/${editingProvider.id}`
        : '/api/service-providers'
      
      const res = await fetch(url, {
        method: editingProvider ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        handleCloseModal()
        fetchProviders()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存服务商失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (provider: ServiceProvider) => {
    if (!confirm(`确定要删除服务商 "${provider.providerName}" 吗？`)) {
      return
    }

    try {
      const res = await fetch(`/api/service-providers/${provider.id}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchProviders()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除服务商失败:', error)
      alert('删除失败')
    }
  }

  const handleToggleStatus = async (provider: ServiceProvider) => {
    const newStatus = provider.status === 'active' ? 'inactive' : 'active'
    
    try {
      const res = await fetch(`/api/service-providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchProviders()
      } else {
        alert(data.msg || '更新状态失败')
      }
    } catch (error) {
      console.error('更新状态失败:', error)
      alert('更新状态失败')
    }
  }

  const getServiceTypeName = (type: string) => {
    return SERVICE_TYPES.find(t => t.value === type)?.label || type
  }

  const columns: Column<ServiceProvider>[] = [
    {
      key: 'providerCode',
      label: '服务商编码',
      width: '100px',
      render: (item) => (
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          {item.providerCode}
        </span>
      ),
    },
    {
      key: 'providerName',
      label: '服务商名称',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary-600" />
          </div>
          <span className="font-medium text-gray-900">{item.providerName}</span>
        </div>
      ),
    },
    {
      key: 'serviceType',
      label: '服务类型',
      width: '100px',
      render: (item) => {
        const typeConfig: Record<string, { bg: string; text: string; icon: typeof Truck }> = {
          delivery: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Truck },
          warehouse: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Building2 },
          customs: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Building2 },
          trucking: { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: Truck },
          shipping: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Truck },
          other: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Building2 },
        }
        const config = typeConfig[item.serviceType] || typeConfig.other
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {getServiceTypeName(item.serviceType)}
          </span>
        )
      },
    },
    {
      key: 'contactPerson',
      label: '联系人',
      width: '120px',
      render: (item) => (
        <div className="flex items-center gap-1 text-gray-600">
          <User className="w-3 h-3" />
          {item.contactPerson || '-'}
        </div>
      ),
    },
    {
      key: 'contactPhone',
      label: '联系电话',
      width: '130px',
      render: (item) => (
        <div className="flex items-center gap-1 text-gray-600">
          <Phone className="w-3 h-3" />
          {item.contactPhone || '-'}
        </div>
      ),
    },
    {
      key: 'contactEmail',
      label: '邮箱',
      render: (item) => (
        <div className="flex items-center gap-1 text-gray-600 text-xs">
          <Mail className="w-3 h-3" />
          {item.contactEmail || '-'}
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      width: '80px',
      render: (item) => (
        <button
          onClick={() => handleToggleStatus(item)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            item.status === 'active' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {item.status === 'active' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {item.status === 'active' ? '启用' : '禁用'}
        </button>
      ),
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

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="TMS运输管理"
        tabs={tabs}
        activeTab="/tms/service-providers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索服务商..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 w-60 bg-white"
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            title="筛选服务类型"
            aria-label="服务类型筛选"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            {SERVICE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="筛选服务商状态"
            aria-label="状态筛选"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">禁用</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          添加服务商
        </button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={providers}
          loading={loading}
          rowKey="id"
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
          <div className="relative bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingProvider ? '编辑服务商' : '添加服务商'}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 服务商编码 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    服务商编码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.providerCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, providerCode: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="如：SP001"
                  />
                </div>

                {/* 服务商名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    服务商名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.providerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, providerName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入服务商名称"
                  />
                </div>

                {/* 服务类型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务类型</label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                    title="选择服务类型"
                    aria-label="服务类型"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {SERVICE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* 状态 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    title="选择服务商状态"
                    aria-label="状态"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="active">启用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>

                {/* 联系人 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系人</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入联系电话"
                  />
                </div>
              </div>

              {/* 邮箱 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="输入联系邮箱"
                />
              </div>

              {/* 地址 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="输入公司地址"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="输入服务商描述信息"
                />
              </div>
            </div>

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

