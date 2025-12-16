import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Building, User, Phone, Mail, MapPin,
  Package, TrendingUp, Ship, Plus, Trash2, Star,
  Edit, ExternalLink, RefreshCw, FileText, X
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { 
  getCustomerById, getCustomerOrders, getCustomerOrderStats, 
  getCustomerAddresses, createCustomerAddress, updateCustomerAddress, deleteCustomerAddress,
  getCustomerTaxNumbers, createCustomerTaxNumber, updateCustomerTaxNumber, deleteCustomerTaxNumber,
  type Customer, type CustomerAddress, type CustomerTaxNumber 
} from '../utils/api'

interface CustomerOrder {
  id: string
  billNumber: string
  containerNumber: string
  shipper: string
  consignee: string
  status: string
  shipStatus: string
  customsStatus: string
  inspection: string
  deliveryStatus: string
  pieces: number
  weight: number
  eta: string
  portOfLoading: string
  portOfDischarge: string
  createTime: string
}

interface OrderStats {
  totalOrders: number
  activeOrders: number
  completedOrders: number
  totalPieces: number
  totalWeight: number
}

export default function CRMCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(10)
  const [searchValue, setSearchValue] = useState('')
  
  // 地址和税号状态
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [taxNumbers, setTaxNumbers] = useState<CustomerTaxNumber[]>([])
  const [addressModalVisible, setAddressModalVisible] = useState(false)
  const [taxModalVisible, setTaxModalVisible] = useState(false)
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null)
  const [editingTax, setEditingTax] = useState<CustomerTaxNumber | null>(null)
  const [activeInfoTab, setActiveInfoTab] = useState<'orders' | 'addresses' | 'tax'>('orders')

   
  useEffect(() => {
    if (id) {
      loadCustomer()
      loadOrderStats()
      loadAddresses()
      loadTaxNumbers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (id) {
      loadOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, searchValue])

  const loadCustomer = async () => {
    setLoading(true)
    try {
      const response = await getCustomerById(id!)
      if (response.errCode === 200 && response.data) {
        setCustomer(response.data)
      }
    } catch (error) {
      console.error('加载客户详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const response = await getCustomerOrders(id!, { page, pageSize, search: searchValue })
      if (response.errCode === 200 && response.data) {
        setOrders(response.data.list || [])
        setTotal(response.data.total || 0)
      }
    } catch (error) {
      console.error('加载客户订单失败:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  const loadOrderStats = async () => {
    try {
      const response = await getCustomerOrderStats(id!)
      if (response.errCode === 200 && response.data) {
        setOrderStats(response.data)
      }
    } catch (error) {
      console.error('加载订单统计失败:', error)
    }
  }

  const loadAddresses = async () => {
    try {
      const response = await getCustomerAddresses(id!)
      if (response.errCode === 200 && response.data) {
        setAddresses(response.data)
      }
    } catch (error) {
      console.error('加载地址列表失败:', error)
    }
  }

  const loadTaxNumbers = async () => {
    try {
      const response = await getCustomerTaxNumbers(id!)
      if (response.errCode === 200 && response.data) {
        setTaxNumbers(response.data)
      }
    } catch (error) {
      console.error('加载税号列表失败:', error)
    }
  }

  const handleSaveAddress = async (data: CustomerAddress) => {
    try {
      if (editingAddress?.id) {
        await updateCustomerAddress(id!, editingAddress.id, data)
      } else {
        await createCustomerAddress(id!, data)
      }
      setAddressModalVisible(false)
      setEditingAddress(null)
      loadAddresses()
    } catch (error) {
      console.error('保存地址失败:', error)
    }
  }

  const handleDeleteAddress = async (addressId: number) => {
    if (!confirm('确定要删除这个地址吗？')) return
    try {
      await deleteCustomerAddress(id!, addressId)
      loadAddresses()
    } catch (error) {
      console.error('删除地址失败:', error)
    }
  }

  const handleSaveTax = async (data: CustomerTaxNumber) => {
    try {
      if (editingTax?.id) {
        await updateCustomerTaxNumber(id!, editingTax.id, data)
      } else {
        await createCustomerTaxNumber(id!, data)
      }
      setTaxModalVisible(false)
      setEditingTax(null)
      loadTaxNumbers()
    } catch (error) {
      console.error('保存税号失败:', error)
    }
  }

  const handleDeleteTax = async (taxId: number) => {
    if (!confirm('确定要删除这个税号吗？')) return
    try {
      await deleteCustomerTaxNumber(id!, taxId)
      loadTaxNumbers()
    } catch (error) {
      console.error('删除税号失败:', error)
    }
  }

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      vip: 'bg-yellow-100 text-yellow-700',
      important: 'bg-blue-100 text-blue-700',
      normal: 'bg-gray-100 text-gray-600',
      potential: 'bg-green-100 text-green-700'
    }
    const labels: Record<string, string> = {
      vip: 'VIP客户',
      important: '重要客户',
      normal: '普通客户',
      potential: '潜在客户'
    }
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${styles[level] || styles.normal}`}>
        {labels[level] || level}
      </span>
    )
  }

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      shipper: '发货人',
      consignee: '收货人',
      both: '发/收货人'
    }
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
        {labels[type] || type}
      </span>
    )
  }

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      '已到港': 'bg-blue-100 text-blue-700',
      '未到港': 'bg-gray-100 text-gray-600',
      '已放行': 'bg-green-100 text-green-700',
      '已送达': 'bg-green-100 text-green-700',
      '派送中': 'bg-orange-100 text-orange-700',
      '订单异常': 'bg-red-100 text-red-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-600'
  }

  const orderColumns: Column<CustomerOrder>[] = [
    {
      key: 'billNumber',
      label: '提单号',
      width: 140,
      render: (item) => (
        <button
          onClick={() => navigate(`/bookings/bill/${item.id}`)}
          className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
        >
          {item.billNumber}
        </button>
      )
    },
    {
      key: 'containerNumber',
      label: '集装箱号',
      width: 120,
    },
    {
      key: 'portOfLoading',
      label: '起运港',
      width: 100,
    },
    {
      key: 'portOfDischarge',
      label: '目的港',
      width: 100,
    },
    {
      key: 'shipStatus',
      label: '船运状态',
      width: 90,
      render: (item) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusStyle(item.shipStatus)}`}>
          {item.shipStatus}
        </span>
      )
    },
    {
      key: 'deliveryStatus',
      label: '派送状态',
      width: 90,
      render: (item) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusStyle(item.deliveryStatus)}`}>
          {item.deliveryStatus}
        </span>
      )
    },
    {
      key: 'pieces',
      label: '件数',
      width: 60,
      render: (item) => item.pieces || '-'
    },
    {
      key: 'weight',
      label: '重量(KG)',
      width: 80,
      render: (item) => item.weight ? Number(item.weight).toFixed(2) : '-'
    },
    {
      key: 'eta',
      label: 'ETA',
      width: 100,
      render: (item) => item.eta ? item.eta.split('T')[0] : '-'
    },
    {
      key: 'createTime',
      label: '创建时间',
      width: 100,
      render: (item) => item.createTime ? item.createTime.split('T')[0] : '-'
    },
    {
      key: 'actions',
      label: '操作',
      width: 60,
      render: (item) => (
        <button
          onClick={() => navigate(`/bookings/bill/${item.id}`)}
          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
          title="查看详情"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )
    }
  ]

  const crmTabs = [
    { label: '仪表盘', path: '/crm' },
    { label: '客户管理', path: '/crm/customers' },
    { label: '销售机会', path: '/crm/opportunities' },
    { label: '报价管理', path: '/crm/quotations' },
    { label: '合同管理', path: '/crm/contracts' },
    { label: '客户反馈', path: '/crm/feedbacks' },
  ]

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <p className="text-gray-500">客户不存在或已被删除</p>
          <button
            onClick={() => navigate('/crm/customers')}
            className="mt-4 text-primary-600 hover:text-primary-800"
          >
            返回客户列表
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="CRM客户管理"
        description="客户详情"
        tabs={crmTabs}
        activeTab="/crm/customers"
        onTabChange={(path) => navigate(path)}
      />

      {/* 返回按钮和标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/crm/customers')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{customer.customerName}</h2>
              {getLevelBadge(customer.customerLevel)}
              {getTypeBadge(customer.customerType)}
            </div>
            <p className="text-sm text-gray-500">{customer.customerCode}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/crm/customers?edit=${customer.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Edit className="w-4 h-4" />
          编辑客户
        </button>
      </div>

      {/* 基本信息卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 客户信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-400" />
            公司信息
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">公司名称</span>
              <span className="text-gray-900">{customer.companyName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">客户编码</span>
              <span className="text-gray-900">{customer.customerCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">状态</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                customer.status === 'active' ? 'bg-green-100 text-green-700' :
                customer.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
                'bg-red-100 text-red-700'
              }`}>
                {customer.status === 'active' ? '活跃' : customer.status === 'inactive' ? '不活跃' : '黑名单'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">负责人</span>
              <span className="text-gray-900">{customer.assignedName || '-'}</span>
            </div>
          </div>
        </div>

        {/* 联系信息 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            联系信息
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-900">{customer.contactPerson || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-900">{customer.contactPhone || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-900">{customer.contactEmail || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-900">{customer.address || '-'}</span>
            </div>
          </div>
        </div>

        {/* 订单统计 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            订单统计
          </h3>
          {orderStats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold text-blue-700">{orderStats.totalOrders}</div>
                <div className="text-xs text-blue-600">总订单数</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold text-green-700">{orderStats.activeOrders}</div>
                <div className="text-xs text-green-600">进行中</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold text-gray-700">{orderStats.completedOrders}</div>
                <div className="text-xs text-gray-600">已完成</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <div className="text-lg font-semibold text-orange-700">{orderStats.totalWeight ? Number(orderStats.totalWeight).toFixed(0) : 0}</div>
                <div className="text-xs text-orange-600">总重量(KG)</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">暂无统计数据</div>
          )}
        </div>
      </div>

      {/* Tab切换 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveInfoTab('orders')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeInfoTab === 'orders'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                关联订单 ({total})
              </div>
            </button>
            <button
              onClick={() => setActiveInfoTab('addresses')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeInfoTab === 'addresses'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                地址 ({addresses.length})
              </div>
            </button>
            <button
              onClick={() => setActiveInfoTab('tax')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeInfoTab === 'tax'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                税号 ({taxNumbers.length})
              </div>
            </button>
          </div>
        </div>

        {/* 订单列表 */}
        {activeInfoTab === 'orders' && (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="搜索提单号/箱号..."
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value)
                        setPage(1)
                      }}
                      className="w-48 px-3 py-1.5 pl-8 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                    <Ship className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <button
                    onClick={() => {
                      setPage(1)
                      loadOrders()
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg"
                    title="刷新"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-500 ${ordersLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
            <DataTable
              data={orders}
              columns={orderColumns}
              loading={ordersLoading}
              pagination={{
                current: page,
                pageSize,
                total,
                onChange: (p) => setPage(p)
              }}
              emptyText="该客户暂无关联订单"
            />
          </>
        )}

        {/* 地址列表 */}
        {activeInfoTab === 'addresses' && (
          <div className="p-4">
            <div className="flex justify-end mb-3">
              <button
                onClick={() => {
                  setEditingAddress(null)
                  setAddressModalVisible(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                添加地址
              </button>
            </div>
            {addresses.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">暂无地址信息</div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className="border border-gray-200 rounded-lg p-3 hover:border-primary-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">{addr.companyName}</span>
                          {addr.isDefault && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                              <Star className="w-3 h-3" />
                              默认
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            addr.addressType === 'shipper' ? 'bg-blue-100 text-blue-700' :
                            addr.addressType === 'consignee' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {addr.addressType === 'shipper' ? '发货地址' : addr.addressType === 'consignee' ? '收货地址' : '通用'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {addr.contactPerson && <div>联系人: {addr.contactPerson} {addr.phone && `(${addr.phone})`}</div>}
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {[addr.country, addr.city, addr.address, addr.postalCode].filter(Boolean).join(', ')}
                          </div>
                          {addr.addressCode && <div>地址编码: {addr.addressCode}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingAddress(addr)
                            setAddressModalVisible(true)
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                          title="编辑"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => addr.id && handleDeleteAddress(addr.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 税号列表 */}
        {activeInfoTab === 'tax' && (
          <div className="p-4">
            <div className="flex justify-end mb-3">
              <button
                onClick={() => {
                  setEditingTax(null)
                  setTaxModalVisible(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                添加税号
              </button>
            </div>
            {taxNumbers.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">暂无税号信息</div>
            ) : (
              <div className="space-y-3">
                {taxNumbers.map((tax) => (
                  <div key={tax.id} className="border border-gray-200 rounded-lg p-3 hover:border-primary-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">{tax.taxNumber}</span>
                          {tax.isDefault && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                              <Star className="w-3 h-3" />
                              默认
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            tax.taxType === 'vat' ? 'bg-blue-100 text-blue-700' :
                            tax.taxType === 'eori' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {tax.taxType === 'vat' ? 'VAT税号' : tax.taxType === 'eori' ? 'EORI号' : '其他'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {tax.country && <span>国家: {tax.country}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingTax(tax)
                            setTaxModalVisible(true)
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                          title="编辑"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => tax.id && handleDeleteTax(tax.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 地址编辑弹窗 */}
      {addressModalVisible && (
        <AddressModal
          visible={addressModalVisible}
          onClose={() => {
            setAddressModalVisible(false)
            setEditingAddress(null)
          }}
          onSave={handleSaveAddress}
          initialData={editingAddress}
        />
      )}

      {/* 税号编辑弹窗 */}
      {taxModalVisible && (
        <TaxModal
          visible={taxModalVisible}
          onClose={() => {
            setTaxModalVisible(false)
            setEditingTax(null)
          }}
          onSave={handleSaveTax}
          initialData={editingTax}
        />
      )}
    </div>
  )
}

// 地址编辑弹窗组件
function AddressModal({ 
  visible, 
  onClose, 
  onSave, 
  initialData 
}: { 
  visible: boolean
  onClose: () => void
  onSave: (data: CustomerAddress) => void
  initialData: CustomerAddress | null
}) {
  const [formData, setFormData] = useState<CustomerAddress>({
    companyName: '',
    address: '',
    addressCode: '',
    contactPerson: '',
    phone: '',
    country: '',
    city: '',
    postalCode: '',
    isDefault: false,
    addressType: 'both'
  })
  const [countries, setCountries] = useState<Array<{ id: string; countryNameCn: string; countryCode: string }>>([])
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    loadCountries()
  }, [])

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      setCountrySearch(initialData.country || '')
    } else {
      setFormData({
        companyName: '',
        address: '',
        addressCode: '',
        contactPerson: '',
        phone: '',
        country: '',
        city: '',
        postalCode: '',
        isDefault: false,
        addressType: 'both'
      })
      setCountrySearch('')
    }
  }, [initialData])

  const loadCountries = async () => {
    try {
      const { getCountriesList } = await import('../utils/api')
      const response = await getCountriesList({ status: 'active' })
      if (response.errCode === 200 && response.data) {
        setCountries(response.data)
      }
    } catch (error) {
      console.error('加载国家列表失败:', error)
    }
  }

  const filteredCountries = countries.filter(c => 
    c.countryNameCn.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const handleSelectCountry = (country: { countryNameCn: string; countryCode: string }) => {
    setFormData({ ...formData, country: country.countryNameCn })
    setCountrySearch(country.countryNameCn)
    setShowCountryDropdown(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            {initialData ? '编辑地址' : '添加地址'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">公司名称 *</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="请输入公司名称"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">联系人</label>
              <input
                type="text"
                value={formData.contactPerson || ''}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="联系人"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">电话</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="联系电话"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">国家</label>
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => {
                  setCountrySearch(e.target.value)
                  setShowCountryDropdown(true)
                  if (!e.target.value) {
                    setFormData({ ...formData, country: '' })
                  }
                }}
                onFocus={() => setShowCountryDropdown(true)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="搜索国家..."
              />
              {showCountryDropdown && filteredCountries.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCountries.slice(0, 20).map((country) => (
                    <div
                      key={country.id}
                      onClick={() => handleSelectCountry(country)}
                      className="px-2.5 py-1.5 text-xs hover:bg-primary-50 cursor-pointer flex items-center justify-between"
                    >
                      <span>{country.countryNameCn}</span>
                      <span className="text-gray-400">{country.countryCode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">城市</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="城市"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">详细地址 *</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              placeholder="请输入详细地址"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">邮编</label>
              <input
                type="text"
                value={formData.postalCode || ''}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="邮政编码"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">地址编码</label>
              <input
                type="text"
                value={formData.addressCode || ''}
                onChange={(e) => setFormData({ ...formData, addressCode: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="地址编码"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">地址类型</label>
              <select
                value={formData.addressType}
                onChange={(e) => setFormData({ ...formData, addressType: e.target.value as CustomerAddress['addressType'] })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="both">通用</option>
                <option value="shipper">发货地址</option>
                <option value="consignee">收货地址</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-xs text-gray-700">设为默认</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (!formData.companyName || !formData.address) {
                alert('请填写公司名称和详细地址')
                return
              }
              onSave(formData)
            }}
            className="px-3 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// 税号编辑弹窗组件
function TaxModal({ 
  visible, 
  onClose, 
  onSave, 
  initialData 
}: { 
  visible: boolean
  onClose: () => void
  onSave: (data: CustomerTaxNumber) => void
  initialData: CustomerTaxNumber | null
}) {
  const [formData, setFormData] = useState<CustomerTaxNumber>({
    taxType: 'vat',
    taxNumber: '',
    country: '',
    isDefault: false
  })
  const [countries, setCountries] = useState<Array<{ id: string; countryNameCn: string; countryCode: string }>>([])
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    loadCountries()
  }, [])

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      setCountrySearch(initialData.country || '')
    } else {
      setFormData({
        taxType: 'vat',
        taxNumber: '',
        country: '',
        isDefault: false
      })
      setCountrySearch('')
    }
  }, [initialData])

  const loadCountries = async () => {
    try {
      const { getCountriesList } = await import('../utils/api')
      const response = await getCountriesList({ status: 'active' })
      if (response.errCode === 200 && response.data) {
        setCountries(response.data)
      }
    } catch (error) {
      console.error('加载国家列表失败:', error)
    }
  }

  const filteredCountries = countries.filter(c => 
    c.countryNameCn.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const handleSelectCountry = (country: { countryNameCn: string; countryCode: string }) => {
    setFormData({ ...formData, country: country.countryNameCn })
    setCountrySearch(country.countryNameCn)
    setShowCountryDropdown(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            {initialData ? '编辑税号' : '添加税号'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">税号类型 *</label>
            <select
              value={formData.taxType}
              onChange={(e) => setFormData({ ...formData, taxType: e.target.value as CustomerTaxNumber['taxType'] })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="vat">VAT税号</option>
              <option value="eori">EORI号</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">税号 *</label>
            <input
              type="text"
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="请输入税号"
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">国家</label>
            <input
              type="text"
              value={countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value)
                setShowCountryDropdown(true)
                if (!e.target.value) {
                  setFormData({ ...formData, country: '' })
                }
              }}
              onFocus={() => setShowCountryDropdown(true)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="搜索国家..."
            />
            {showCountryDropdown && filteredCountries.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCountries.slice(0, 20).map((country) => (
                  <div
                    key={country.id}
                    onClick={() => handleSelectCountry(country)}
                    className="px-2.5 py-1.5 text-xs hover:bg-primary-50 cursor-pointer flex items-center justify-between"
                  >
                    <span>{country.countryNameCn}</span>
                    <span className="text-gray-400">{country.countryCode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-xs text-gray-700">设为默认</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (!formData.taxType || !formData.taxNumber) {
                alert('请填写税号类型和税号')
                return
              }
              onSave(formData)
            }}
            className="px-3 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

