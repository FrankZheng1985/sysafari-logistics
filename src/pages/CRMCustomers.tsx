import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Eye, Edit, Trash2, 
  Phone, Mail, MapPin, X
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

interface Customer {
  id: string
  customerCode: string
  customerName: string
  companyName: string
  customerType: string
  customerLevel: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  countryCode: string
  city: string
  address: string
  status: string
  assignedName: string
  lastFollowUpTime: string | null
  createTime: string
}

interface CustomerFormData {
  customerCode: string
  customerName: string
  companyName: string
  customerType: string
  customerLevel: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  countryCode: string
  province: string
  city: string
  address: string
  taxNumber: string
  notes: string
}

export default function CRMCustomers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>({
    customerCode: '',
    customerName: '',
    companyName: '',
    customerType: 'shipper',
    customerLevel: 'normal',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    countryCode: '',
    province: '',
    city: '',
    address: '',
    taxNumber: '',
    notes: ''
  })

   
  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchValue, filterLevel, filterType])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      })
      if (searchValue) params.append('search', searchValue)
      if (filterLevel) params.append('level', filterLevel)
      if (filterType) params.append('type', filterType)

      const response = await fetch(`/api/customers?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setCustomers(data.data.list || [])
        setTotal(data.data.total || 0)
      }
    } catch (error) {
      console.error('加载客户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateCustomerCode = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `C${date}${random}`
  }

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        companyName: customer.companyName || '',
        customerType: customer.customerType,
        customerLevel: customer.customerLevel,
        contactPerson: customer.contactPerson || '',
        contactPhone: customer.contactPhone || '',
        contactEmail: customer.contactEmail || '',
        countryCode: customer.countryCode || '',
        province: '',
        city: customer.city || '',
        address: customer.address || '',
        taxNumber: '',
        notes: ''
      })
    } else {
      setEditingCustomer(null)
      setFormData({
        customerCode: generateCustomerCode(),
        customerName: '',
        companyName: '',
        customerType: 'shipper',
        customerLevel: 'normal',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        countryCode: '',
        province: '',
        city: '',
        address: '',
        taxNumber: '',
        notes: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.customerName) {
      alert('请输入客户名称')
      return
    }

    try {
      const url = editingCustomer 
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers'
      const method = editingCustomer ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.errCode === 200) {
        setShowModal(false)
        loadCustomers()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('保存客户失败:', error)
      alert('保存失败')
    }
  }

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`确定要删除客户"${customer.customerName}"吗？`)) return

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.errCode === 200) {
        loadCustomers()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除客户失败:', error)
    }
  }

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      vip: 'bg-amber-100 text-amber-700 border-amber-200',
      important: 'bg-blue-100 text-blue-700 border-blue-200',
      normal: 'bg-gray-100 text-gray-700 border-gray-200',
      potential: 'bg-green-100 text-green-700 border-green-200'
    }
    const labels: Record<string, string> = {
      vip: 'VIP',
      important: '重要',
      normal: '普通',
      potential: '潜在'
    }
    return (
      <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${styles[level] || styles.normal}`}>
        {labels[level] || level}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      shipper: 'bg-indigo-100 text-indigo-700',
      consignee: 'bg-teal-100 text-teal-700',
      both: 'bg-purple-100 text-purple-700'
    }
    const labels: Record<string, string> = {
      shipper: '发货人',
      consignee: '收货人',
      both: '两者'
    }
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] ${styles[type] || styles.shipper}`}>
        {labels[type] || type}
      </span>
    )
  }

  const columns: Column<Customer>[] = useMemo(() => [
    {
      key: 'customerCode',
      label: '客户编号',
      width: 120,
      render: (item) => (
        <span className="text-primary-600 font-medium text-xs">{item.customerCode}</span>
      )
    },
    {
      key: 'customerName',
      label: '客户名称',
      width: 160,
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900 text-xs">{item.customerName}</div>
          {item.companyName && (
            <div className="text-[10px] text-gray-500">{item.companyName}</div>
          )}
        </div>
      )
    },
    {
      key: 'customerLevel',
      label: '级别',
      width: 80,
      render: (item) => getLevelBadge(item.customerLevel)
    },
    {
      key: 'customerType',
      label: '类型',
      width: 80,
      render: (item) => getTypeBadge(item.customerType)
    },
    {
      key: 'contact',
      label: '联系方式',
      width: 180,
      render: (item) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 text-gray-700">
            <Phone className="w-3 h-3 text-gray-400" />
            {item.contactPerson || '-'}
            {item.contactPhone && <span className="text-gray-400">({item.contactPhone})</span>}
          </div>
          {item.contactEmail && (
            <div className="flex items-center gap-1 text-gray-500">
              <Mail className="w-3 h-3 text-gray-400" />
              {item.contactEmail}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'location',
      label: '地址',
      width: 150,
      render: (item) => (
        <div className="text-xs text-gray-600 flex items-start gap-1">
          <MapPin className="w-3 h-3 text-gray-400 mt-0.5" />
          <span className="line-clamp-2">{item.city || '-'} {item.address}</span>
        </div>
      )
    },
    {
      key: 'assignedName',
      label: '负责人',
      width: 80,
      render: (item) => (
        <span className="text-xs text-gray-600">{item.assignedName || '-'}</span>
      )
    },
    {
      key: 'lastFollowUpTime',
      label: '最后跟进',
      width: 100,
      render: (item) => (
        <span className="text-xs text-gray-500">
          {item.lastFollowUpTime ? new Date(item.lastFollowUpTime).toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 70,
      render: (item) => (
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
          item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {item.status === 'active' ? '活跃' : '不活跃'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 120,
      render: (item) => (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => navigate(`/crm/customers/${item.id}`)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
            title="查看详情"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleOpenModal(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => handleDelete(item)}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate])

  const tabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户关系管理"
        tabs={tabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-3">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索客户名称、编号、联系人..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            />
          </div>

          {/* 级别筛选 */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部级别</option>
            <option value="vip">VIP</option>
            <option value="important">重要</option>
            <option value="normal">普通</option>
            <option value="potential">潜在</option>
          </select>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部类型</option>
            <option value="shipper">发货人</option>
            <option value="consignee">收货人</option>
            <option value="both">两者</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增客户
        </button>
      </div>

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        rowKey="id"
      />

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500">
            共 {total} 条记录，第 {page} / {Math.ceil(total / pageSize)} 页
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[640px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-medium">{editingCustomer ? '编辑客户' : '新增客户'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户编号 *</label>
                  <input
                    type="text"
                    value={formData.customerCode}
                    onChange={(e) => setFormData({...formData, customerCode: e.target.value})}
                    disabled={!!editingCustomer}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户名称 *</label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入客户名称"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">公司名称</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入公司全称"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">税号</label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入税号"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户类型</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({...formData, customerType: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="shipper">发货人</option>
                    <option value="consignee">收货人</option>
                    <option value="both">两者</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">客户级别</label>
                  <select
                    value={formData.customerLevel}
                    onChange={(e) => setFormData({...formData, customerLevel: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="potential">潜在客户</option>
                    <option value="normal">普通客户</option>
                    <option value="important">重要客户</option>
                    <option value="vip">VIP客户</option>
                  </select>
                </div>
              </div>

              {/* 联系信息 */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-gray-700 mb-3">联系信息</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">联系人</label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="请输入联系人姓名"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">联系电话</label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="请输入电话号码"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">电子邮箱</label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="请输入邮箱地址"
                    />
                  </div>
                </div>
              </div>

              {/* 地址信息 */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-gray-700 mb-3">地址信息</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">国家</label>
                    <input
                      type="text"
                      value={formData.countryCode}
                      onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="请输入国家"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">省/州</label>
                    <input
                      type="text"
                      value={formData.province}
                      onChange={(e) => setFormData({...formData, province: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="请输入省份"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">城市</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      placeholder="请输入城市"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-600 mb-1">详细地址</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="请输入详细地址"
                  />
                </div>
              </div>

              {/* 备注 */}
              <div className="border-t pt-4">
                <label className="block text-xs text-gray-600 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none"
                  rows={3}
                  placeholder="请输入备注信息"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-xs text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

