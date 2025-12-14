import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Building, User, Phone, Mail, MapPin,
  Package, TrendingUp, Ship,
  Edit, ExternalLink, RefreshCw
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { getCustomerById, getCustomerOrders, getCustomerOrderStats, type Customer } from '../utils/api'

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

   
  useEffect(() => {
    if (id) {
      loadCustomer()
      loadOrderStats()
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
          onClick={() => navigate(`/bookings/bills/${item.id}`)}
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
      render: (item) => item.weight ? item.weight.toFixed(2) : '-'
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
          onClick={() => navigate(`/bookings/bills/${item.id}`)}
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
                <div className="text-lg font-semibold text-orange-700">{orderStats.totalWeight?.toFixed(0) || 0}</div>
                <div className="text-xs text-orange-600">总重量(KG)</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">暂无统计数据</div>
          )}
        </div>
      </div>

      {/* 订单列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              关联订单 ({total})
            </h3>
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
      </div>
    </div>
  )
}

