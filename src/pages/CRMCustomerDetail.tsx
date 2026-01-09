import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Building, Building2, User, Phone, Mail, MapPin,
  Package, TrendingUp, Ship, Plus, Trash2, Star,
  Edit, ExternalLink, RefreshCw, FileText, X, CheckCircle, ChevronDown, Copy,
  Key, Eye, EyeOff, UserCheck, BarChart3, Calendar
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'
import { copyToClipboard } from '../components/Toast'
import { 
  getCustomerById, getCustomerOrders, getCustomerOrderStats, getCustomerOrderTrend,
  getCustomerAddresses, createCustomerAddress, updateCustomerAddress, deleteCustomerAddress,
  getCustomerTaxNumbers, createCustomerTaxNumber, updateCustomerTaxNumber, deleteCustomerTaxNumber,
  getCustomerAccounts, createCustomerAccount, updateCustomerAccount, deleteCustomerAccount, resetCustomerAccountPassword,
  staffProxyLoginToPortal,
  type Customer, type CustomerAddress, type CustomerTaxNumber, type CustomerAccount, type OrderTrendItem, type OrderTrendData
} from '../utils/api'

interface CustomerOrder {
  id: string
  orderNumber: string
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
  totalVolume: number
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
  const [pageSize, setPageSize] = useState(20)
  const [searchValue, setSearchValue] = useState('')
  
  // 地址和税号状态
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [taxNumbers, setTaxNumbers] = useState<CustomerTaxNumber[]>([])
  const [addressModalVisible, setAddressModalVisible] = useState(false)
  const [taxModalVisible, setTaxModalVisible] = useState(false)
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null)
  const [editingTax, setEditingTax] = useState<CustomerTaxNumber | null>(null)
  const [editingCompanyTaxes, setEditingCompanyTaxes] = useState<CustomerTaxNumber[] | null>(null)
  const [activeInfoTab, setActiveInfoTab] = useState<'orders' | 'addresses' | 'tax' | 'portal'>('orders')
  
  // 门户账户相关状态
  const [portalAccounts, setPortalAccounts] = useState<CustomerAccount[]>([])
  const [portalLoading, setPortalLoading] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CustomerAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountForm, setAccountForm] = useState({
    username: '',
    password: '',
    email: ''
  })
  
  // 订单趋势统计状态
  const [orderTrend, setOrderTrend] = useState<OrderTrendData | null>(null)
  const [trendDimension, setTrendDimension] = useState<'month' | 'year'>('month')
  const [trendDateType, setTrendDateType] = useState<'created' | 'cleared'>('created')  // 日期类型：创建时间/清关完成时间
  const [trendLoading, setTrendLoading] = useState(false)

   
  useEffect(() => {
    if (id) {
      loadCustomer()
      loadOrderStats()
      loadOrderTrend()
      loadAddresses()
      loadTaxNumbers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 当切换到门户 tab 时加载数据
  useEffect(() => {
    if (id && activeInfoTab === 'portal') {
      loadPortalAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeInfoTab])

  useEffect(() => {
    if (id) {
      loadOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page, pageSize, searchValue])

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

  const loadOrderTrend = async (dimension: 'month' | 'year' = trendDimension) => {
    setTrendLoading(true)
    try {
      const response = await getCustomerOrderTrend(id!, dimension)
      if (response.errCode === 200 && response.data) {
        setOrderTrend(response.data)
      }
    } catch (error) {
      console.error('加载订单趋势失败:', error)
    } finally {
      setTrendLoading(false)
    }
  }

  // 切换趋势维度时重新加载
  const handleTrendDimensionChange = (dim: 'month' | 'year') => {
    setTrendDimension(dim)
    loadOrderTrend(dim)
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

  // 加载门户账户
  const loadPortalAccounts = async () => {
    setPortalLoading(true)
    try {
      const response = await getCustomerAccounts({ customerId: id })
      if (response.errCode === 200 && response.data) {
        setPortalAccounts(response.data.list || [])
      }
    } catch (error) {
      console.error('加载门户账户失败:', error)
    } finally {
      setPortalLoading(false)
    }
  }

  // 创建门户账户
  const handleCreateAccount = async () => {
    if (!accountForm.username || !accountForm.password) {
      alert('请填写用户名和密码')
      return
    }
    if (accountForm.password.length < 8) {
      alert('密码长度不能少于8位')
      return
    }
    try {
      const response = await createCustomerAccount({
        customerId: id!,
        username: accountForm.username,
        password: accountForm.password,
        email: accountForm.email || undefined
      })
      if (response.errCode === 200) {
        setShowAccountModal(false)
        setAccountForm({ username: '', password: '', email: '' })
        loadPortalAccounts()
        alert('账户创建成功')
      } else {
        alert(response.msg || response.errMessage || '创建失败')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '创建失败'
      alert(errorMessage)
    }
  }

  // 重置密码
  const handleResetPassword = async () => {
    if (!editingAccount || !newPassword) {
      alert('请输入新密码')
      return
    }
    if (newPassword.length < 8) {
      alert('新密码长度不能少于8位')
      return
    }
    try {
      const response = await resetCustomerAccountPassword(editingAccount.id, newPassword)
      if (response.errCode === 200) {
        setShowPasswordModal(false)
        setNewPassword('')
        setEditingAccount(null)
        alert('密码重置成功')
      } else {
        alert(response.msg || response.errMessage || '重置密码失败')
      }
    } catch (error) {
      console.error('重置密码失败:', error)
      alert('重置密码失败')
    }
  }

  // 切换账户状态
  const handleToggleAccountStatus = async (account: CustomerAccount) => {
    const newStatus = account.status === 'active' ? 'suspended' : 'active'
    try {
      const response = await updateCustomerAccount(account.id, { status: newStatus })
      if (response.errCode === 200) {
        loadPortalAccounts()
      }
    } catch (error) {
      console.error('更新账户状态失败:', error)
    }
  }

  // 删除账户
  const handleDeleteAccount = async (account: CustomerAccount) => {
    if (!confirm(`确定要删除账户 "${account.username}" 吗？`)) return
    try {
      const response = await deleteCustomerAccount(account.id)
      if (response.errCode === 200) {
        loadPortalAccounts()
      }
    } catch (error) {
      console.error('删除账户失败:', error)
    }
  }

  const handleSaveAddress = async (data: CustomerAddress) => {
    try {
      let response
      if (editingAddress?.id) {
        response = await updateCustomerAddress(id!, editingAddress.id, data)
      } else {
        response = await createCustomerAddress(id!, data)
      }
      
      if (response.errCode === 200) {
        alert(editingAddress?.id ? '地址更新成功' : '地址添加成功')
        setAddressModalVisible(false)
        setEditingAddress(null)
        loadAddresses()
      } else {
        alert(`保存失败: ${response.errMsg || '未知错误'}`)
      }
    } catch (error) {
      console.error('保存地址失败:', error)
      alert(`保存地址失败: ${error instanceof Error ? error.message : '网络错误'}`)
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

  const handleSaveTax = async (data: CustomerTaxNumber, closeAfterSave = true) => {
    try {
      if (editingTax?.id) {
        await updateCustomerTaxNumber(id!, editingTax.id, data)
      } else {
        await createCustomerTaxNumber(id!, data)
      }
      if (closeAfterSave) {
      setTaxModalVisible(false)
      setEditingTax(null)
      }
      await loadTaxNumbers()
    } catch (error) {
      console.error('保存税号失败:', error)
      throw error // 抛出错误让调用方知道保存失败
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

  // 删除一个公司的所有税号
  const handleDeleteCompanyTaxes = async (taxes: CustomerTaxNumber[]) => {
    const companyName = taxes[0]?.companyName || '未命名公司'
    if (!confirm(`确定要删除"${companyName}"的所有税号吗？`)) return
    try {
      for (const tax of taxes) {
        if (tax.id) {
          await deleteCustomerTaxNumber(id!, tax.id)
        }
      }
      loadTaxNumbers()
    } catch (error) {
      console.error('删除公司税号失败:', error)
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
      key: 'orderNumber',
      label: '订单号',
      width: 130,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/crm/bill/${record.id}`)}
            className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
          >
            {record.orderNumber || '-'}
          </button>
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
      )
    },
    {
      key: 'billNumber',
      label: '提单号',
      width: 160,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <span className="text-gray-900">{record.billNumber}</span>
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
      )
    },
    {
      key: 'containerNumber',
      label: '集装箱号',
      width: 115,
      render: (_value, record) => (
        <div className="flex items-center gap-1">
          <span className="text-gray-900">{record.containerNumber || '-'}</span>
          {record.containerNumber && (
            <button
              onClick={(e) => copyToClipboard(record.containerNumber, e)}
              className="text-gray-400 hover:text-gray-600"
              title="复制集装箱号"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>
      )
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
      render: (_value, record) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusStyle(record.shipStatus)}`}>
          {record.shipStatus}
        </span>
      )
    },
    {
      key: 'deliveryStatus',
      label: '派送状态',
      width: 90,
      render: (_value, record) => (
        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusStyle(record.deliveryStatus)}`}>
          {record.deliveryStatus}
        </span>
      )
    },
    {
      key: 'pieces',
      label: '件数',
      width: 60,
      render: (_value, record) => record.pieces || '-'
    },
    {
      key: 'weight',
      label: '重量(KG)',
      width: 80,
      render: (_value, record) => record.weight ? Number(record.weight).toFixed(2) : '-'
    },
    {
      key: 'eta',
      label: 'ETA',
      width: 100,
      render: (_value, record) => record.eta ? record.eta.split('T')[0] : '-'
    },
    {
      key: 'createTime',
      label: '创建时间',
      width: 100,
      render: (_value, record) => record.createTime ? record.createTime.split('T')[0] : '-'
    },
    {
      key: 'actions',
      label: '操作',
      width: 60,
      render: (_value, record) => (
        <button
          onClick={() => navigate(`/bookings/bill/${record.id}`)}
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
            title="返回客户列表"
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
          onClick={() => navigate(`/crm/customers/${customer.id}/edit`)}
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
              <span className="text-gray-500">公司名称（中文）</span>
              <span className="text-gray-900">{customer.companyName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">公司名称（英文）</span>
              <span className="text-gray-900">{(customer as any).companyNameEn || '-'}</span>
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
              <span className="text-gray-500">负责销售员</span>
              <span className="text-gray-900">{customer.assignedName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">负责跟单员</span>
              <span className="text-gray-900">{(customer as any).assignedOperatorName || '-'}</span>
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
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
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
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold text-orange-700">{orderStats.totalWeight ? Number(orderStats.totalWeight).toFixed(0) : 0}</div>
                  <div className="text-xs text-orange-600">总重量(KG)</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold text-purple-700">{orderStats.totalVolume ? Number(orderStats.totalVolume).toFixed(2) : 0}</div>
                  <div className="text-xs text-purple-600">总立方(CBM)</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">暂无统计数据</div>
          )}
        </div>
        
        {/* 订单量趋势图 - 大屏幕占满整行 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              订单量趋势
            </h3>
            <div className="flex items-center gap-2">
              {/* 日期类型切换：创建时间 / 清关完成 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTrendDateType('created')}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    trendDateType === 'created'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  创建时间
                </button>
                <button
                  onClick={() => setTrendDateType('cleared')}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    trendDateType === 'cleared'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  清关完成
                </button>
              </div>
              {/* 时间维度切换：月 / 年 */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => handleTrendDimensionChange('month')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    trendDimension === 'month'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Calendar className="w-3 h-3 inline-block mr-1" />
                  月
                </button>
                <button
                  onClick={() => handleTrendDimensionChange('year')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    trendDimension === 'year'
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Calendar className="w-3 h-3 inline-block mr-1" />
                  年
                </button>
              </div>
            </div>
          </div>
          
          {trendLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : orderTrend && (trendDateType === 'created' ? orderTrend.created : orderTrend.cleared)?.length > 0 ? (
            <div className="space-y-3">
              {/* 图表区域 - CSS柱状图 */}
              {(() => {
                const currentData = trendDateType === 'created' ? orderTrend.created : orderTrend.cleared
                const maxCount = Math.max(...currentData.map(d => d.orderCount), 1)
                // 计算一个合适的Y轴最大值（向上取整到合理的刻度）
                const yAxisMax = maxCount <= 5 ? 5
                  : maxCount <= 10 ? 10
                  : maxCount <= 20 ? 20
                  : maxCount <= 50 ? Math.ceil(maxCount / 10) * 10
                  : maxCount <= 100 ? Math.ceil(maxCount / 20) * 20
                  : Math.ceil(maxCount / 50) * 50
                const yAxisValues = [yAxisMax, Math.round(yAxisMax / 2), 0]
                // 图表内容区高度（不含X轴标签）
                const chartHeight = 180 // 像素
                
                return (
                  <div className="relative">
                    {/* Y轴参考线和数值 */}
                    <div className="absolute left-0 top-0 w-10 flex flex-col justify-between text-right pr-2" style={{ height: chartHeight }}>
                      {yAxisValues.map((val, i) => (
                        <span key={i} className="text-[10px] text-gray-400 leading-none">{val}</span>
                      ))}
                    </div>
                    
                    {/* 背景参考线 */}
                    <div className="absolute left-10 right-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height: chartHeight }}>
                      <div className="border-t border-gray-200 border-dashed w-full"></div>
                      <div className="border-t border-gray-200 border-dashed w-full"></div>
                      <div className="border-t border-gray-300 w-full"></div>
                    </div>
                    
                    {/* 柱状图主体 */}
                    <div className="ml-10 flex items-end gap-2 border-l border-gray-300 px-2" style={{ height: chartHeight }}>
                      {currentData.map((item) => {
                        // 精确计算高度百分比
                        const heightPercent = yAxisMax > 0 ? (item.orderCount / yAxisMax) * 100 : 0
                        // 计算实际像素高度
                        const barHeight = item.orderCount > 0 
                          ? Math.max((heightPercent / 100) * chartHeight, 6) // 最小6px可见
                          : 2
                        
                        return (
                          <div 
                            key={item.period}
                            className="flex-1 flex flex-col items-center justify-end group relative min-w-0"
                          >
                            {/* 悬浮提示 */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                              <div className="bg-gray-900 text-white text-xs rounded px-2 py-1.5 whitespace-nowrap shadow-lg">
                                <div className="font-medium">{item.label}</div>
                                <div>订单: {item.orderCount}单</div>
                                <div>重量: {item.totalWeight.toFixed(0)}kg</div>
                                <div>体积: {item.totalVolume.toFixed(2)}cbm</div>
                              </div>
                            </div>
                            
                            {/* 数值标签 - 显示在柱子顶部 */}
                            {item.orderCount > 0 && (
                              <div className="text-[10px] text-gray-700 font-semibold mb-1">
                                {item.orderCount}
                              </div>
                            )}
                            
                            {/* 柱子 - 使用固定像素高度确保比例正确 */}
                            <div
                              className={`w-full max-w-[28px] rounded-t-sm transition-all duration-300 cursor-pointer
                                ${item.orderCount > 0 
                                  ? trendDateType === 'created'
                                    ? 'bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 hover:from-blue-700 hover:to-blue-500 shadow-md'
                                    : 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 shadow-md'
                                  : 'bg-gray-300'
                                }`}
                              style={{ height: `${barHeight}px` }}
                            />
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* X轴标签 - 独立一行 */}
                    <div className="ml-10 flex gap-2 px-2 mt-1">
                      {currentData.map((item) => (
                        <div key={item.period} className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-500 truncate text-center" title={item.label}>
                            {trendDimension === 'month' 
                              ? item.month 
                              : item.year?.slice(-2) + '年'
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              
              {/* 趋势数据汇总 */}
              {(() => {
                const currentData = trendDateType === 'created' ? orderTrend.created : orderTrend.cleared
                return (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {currentData.reduce((sum, d) => sum + d.orderCount, 0)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {trendDimension === 'month' ? '近12月订单' : '累计订单'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {currentData.reduce((sum, d) => sum + d.totalWeight, 0).toFixed(0)}
                      </div>
                      <div className="text-[10px] text-gray-500">累计重量(kg)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {currentData.reduce((sum, d) => sum + d.totalVolume, 0).toFixed(1)}
                      </div>
                      <div className="text-[10px] text-gray-500">累计体积(cbm)</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无订单趋势数据
            </div>
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
                税号 ({new Set(taxNumbers.map(t => t.companyName || '未命名公司')).size})
              </div>
            </button>
            <button
              onClick={() => setActiveInfoTab('portal')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeInfoTab === 'portal'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                门户账户
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
                      onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
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
                showSizeChanger: true,
                onChange: (p, newPageSize) => {
                  setPage(p)
                  if (newPageSize && newPageSize !== pageSize) {
                    setPageSize(newPageSize)
                  }
                }
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
                  setEditingCompanyTaxes(null)
                  setTaxModalVisible(true)
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                添加公司
              </button>
            </div>
            {(() => {
              // 按公司名称分组税号（优先使用简称作为key）
              const companyGroups: Record<string, CustomerTaxNumber[]> = {}
              taxNumbers.forEach(tax => {
                const key = tax.companyShortName || tax.companyName || '未命名公司'
                if (!companyGroups[key]) companyGroups[key] = []
                companyGroups[key].push(tax)
              })
              const companyNames = Object.keys(companyGroups)
              
              if (companyNames.length === 0) {
                return <div className="text-center py-8 text-gray-400 text-sm">暂无税号信息</div>
              }
              
              return (
              <div className="space-y-3">
                  {companyNames.map((companyName) => {
                    const taxes = companyGroups[companyName]
                    const vatTax = taxes.find(t => t.taxType === 'vat')
                    const eoriTax = taxes.find(t => t.taxType === 'eori')
                    const otherTaxes = taxes.filter(t => t.taxType === 'other')
                    const firstTax = taxes[0]
                    
                    return (
                      <div key={companyName} className="border border-gray-200 rounded-lg p-3 hover:border-primary-300 transition-colors">
                        {/* 公司名称和操作按钮 */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm text-gray-900">{companyName}</div>
                            {firstTax?.country && (
                              <div className="text-xs text-gray-500">{firstTax.country}</div>
                            )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                                setEditingCompanyTaxes(taxes)
                            setTaxModalVisible(true)
                          }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-primary-600"
                          title="编辑"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                              onClick={() => handleDeleteCompanyTaxes(taxes)}
                              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                        
                        {/* 税号列表 */}
                        <div className="space-y-1.5">
                          {vatTax && (
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 w-12 text-center">VAT</span>
                              <span 
                                className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${vatTax.isVerified ? 'bg-green-500' : 'bg-red-500'}`}
                                title={vatTax.isVerified ? '验证通过' : '未验证或验证失败'}
                              />
                              <span className="text-xs text-gray-700">{vatTax.taxNumber}</span>
                  </div>
                          )}
                          {eoriTax && (
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700 w-12 text-center">EORI</span>
                              <span 
                                className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${eoriTax.isVerified ? 'bg-green-500' : 'bg-red-500'}`}
                                title={eoriTax.isVerified ? '验证通过' : '未验证或验证失败'}
                              />
                              <span className="text-xs text-gray-700">{eoriTax.taxNumber}</span>
              </div>
            )}
                          {otherTaxes.map((tax) => (
                            <div key={tax.id} className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600 w-12 text-center">其他</span>
                              <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-gray-300" />
                              <span className="text-xs text-gray-700">{tax.taxNumber}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* 门户账户管理 */}
        {activeInfoTab === 'portal' && (
          <div className="p-4">
            {portalLoading ? (
              <div className="text-center py-8 text-gray-400">加载中...</div>
            ) : (
              <div className="space-y-6">
                {/* 门户登录账户 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      门户登录账户
                    </h3>
                    <button
                      onClick={() => {
                        setAccountForm({ username: '', password: '', email: '' })
                        setShowAccountModal(true)
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      创建账户
                    </button>
                  </div>
                  
                  {portalAccounts.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <UserCheck className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">该客户暂无门户账户</p>
                      <p className="text-xs text-gray-400 mt-1">创建账户后，客户可登录门户系统查看订单</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {portalAccounts.map((account) => (
                        <div 
                          key={account.id} 
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              account.status === 'active' ? 'bg-green-100' : 'bg-gray-200'
                            }`}>
                              <User className={`w-4 h-4 ${
                                account.status === 'active' ? 'text-green-600' : 'text-gray-500'
                              }`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{account.username}</div>
                              {account.email && (
                                <div className="text-xs text-gray-500">{account.email}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              account.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : account.status === 'suspended'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {account.status === 'active' ? '正常' : account.status === 'suspended' ? '已停用' : '未激活'}
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  // 调用工作人员代登录 API
                                  const res = await staffProxyLoginToPortal(account.id)
                                  if (res.errCode === 200 && res.data?.token) {
                                    // 获取门户系统地址（根据当前环境）
                                    const hostname = window.location.hostname
                                    let portalBase = 'http://localhost:5174'
                                    if (hostname === 'erp.xianfeng-eu.com') {
                                      portalBase = 'https://portal.xianfeng-eu.com'
                                    } else if (hostname === 'demo.xianfeng-eu.com') {
                                      portalBase = 'https://demo-portal.xianfeng-eu.com'
                                    }
                                    // 跳转到门户系统，携带代登录 token
                                    const portalUrl = `${portalBase}/login?token=${encodeURIComponent(res.data.token)}`
                                    window.open(portalUrl, '_blank')
                                  } else {
                                    alert(res.msg || '代登录失败，请稍后重试')
                                  }
                                } catch (error) {
                                  console.error('代登录失败:', error)
                                  alert('代登录失败，请稍后重试')
                                }
                              }}
                              className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-1"
                              title="登录到客户门户"
                            >
                              <ExternalLink className="w-3 h-3" />
                              登录
                            </button>
                            <button
                              onClick={() => handleToggleAccountStatus(account)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                              title={account.status === 'active' ? '停用账户' : '启用账户'}
                            >
                              {account.status === 'active' ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingAccount(account)
                                setNewPassword('')
                                setShowPasswordModal(true)
                              }}
                              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-blue-600"
                              title="重置密码"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600"
                              title="删除账户"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 创建门户账户弹窗 */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[400px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium">创建门户账户</h3>
              <button onClick={() => setShowAccountModal(false)} className="text-gray-400 hover:text-gray-600" title="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">用户名 *</label>
                <input
                  type="text"
                  value={accountForm.username}
                  onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="请输入登录用户名"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">密码 * <span className="text-gray-400 font-normal">(至少8位)</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 pr-10"
                    placeholder="请输入登录密码（至少8位）"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">邮箱</label>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="可选，用于接收通知"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreateAccount}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码弹窗 */}
      {showPasswordModal && editingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[400px]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium">重置密码</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600" title="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                为账户 <span className="font-medium text-gray-900">{editingAccount.username}</span> 设置新密码
              </p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">新密码 * <span className="text-gray-400 font-normal">(至少8位)</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 pr-10"
                    placeholder="请输入新密码（至少8位）"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

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
            setEditingCompanyTaxes(null)
          }}
          onSave={handleSaveTax}
          initialCompanyTaxes={editingCompanyTaxes}
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
  const [selectedCountryCode, setSelectedCountryCode] = useState('')
  
  // 城市相关状态
  const [cities, setCities] = useState<Array<{ id: number; cityNameCn: string; cityNameEn?: string; cityNamePinyin?: string; level: number; postalCode?: string }>>([])
  const [citySearch, setCitySearch] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  
  // HERE API 相关状态
  const [isLoadingHere, setIsLoadingHere] = useState(false)
  const [hereError, setHereError] = useState('')
  const [hereSuggestions, setHereSuggestions] = useState<Array<{
    title: string
    address: string
    city: string
    country: string
    countryCode: string
    postalCode: string
  }>>([])
  const [showHereDropdown, setShowHereDropdown] = useState(false)
  const [hereSearchQuery, setHereSearchQuery] = useState('')

  useEffect(() => {
    loadCountries()
  }, [])

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
      setCountrySearch(initialData.country || '')
      setCitySearch(initialData.city || '')
      // 尝试找到对应的国家代码
      const matchedCountry = countries.find(c => c.countryNameCn === initialData.country)
      if (matchedCountry) {
        setSelectedCountryCode(matchedCountry.countryCode)
        loadCities(matchedCountry.countryCode)
      }
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
      setCitySearch('')
      setSelectedCountryCode('')
      setCities([])
    }
  }, [initialData, countries])

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

  const loadCities = async (countryCode: string) => {
    console.log('[CRM] loadCities called with:', countryCode)
    if (!countryCode) {
      console.log('[CRM] No countryCode, clearing cities')
      setCities([])
      return
    }
    try {
      const { getCitiesByCountry } = await import('../utils/api')
      console.log('[CRM] Fetching cities for:', countryCode)
      const response = await getCitiesByCountry(countryCode)
      console.log('[CRM] Cities response:', response)
      if (response.errCode === 200 && response.data) {
        console.log('[CRM] Setting cities:', response.data.length, 'items')
        setCities(response.data)
      } else {
        console.log('[CRM] Invalid response, clearing cities')
        setCities([])
      }
    } catch (error) {
      console.error('[CRM] 加载城市列表失败:', error)
      setCities([])
    }
  }

  const filteredCountries = countries.filter(c => 
    c.countryNameCn.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.countryCode.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const filteredCities = cities.filter(c => 
    c.cityNameCn.toLowerCase().includes(citySearch.toLowerCase()) ||
    (c.cityNameEn && c.cityNameEn.toLowerCase().includes(citySearch.toLowerCase())) ||
    (c.cityNamePinyin && c.cityNamePinyin.toLowerCase().includes(citySearch.toLowerCase()))
  )

  const handleSelectCountry = (country: { countryNameCn: string; countryCode: string }) => {
    console.log('[CRM] handleSelectCountry:', country)
    setFormData({ ...formData, country: country.countryNameCn, city: '' })
    setCountrySearch(country.countryNameCn)
    setSelectedCountryCode(country.countryCode)
    setShowCountryDropdown(false)
    setCitySearch('')
    loadCities(country.countryCode)
  }

  // 当国家输入框失去焦点时，尝试匹配国家并加载城市
  const handleCountryBlur = () => {
    setTimeout(() => {
      setShowCountryDropdown(false)
      console.log('[CRM] handleCountryBlur, countrySearch:', countrySearch, 'countries:', countries.length)
      // 如果输入的内容能精确匹配到一个国家，自动选择它
      const exactMatch = countries.find(c => 
        c.countryNameCn === countrySearch || 
        c.countryCode.toUpperCase() === countrySearch.toUpperCase()
      )
      console.log('[CRM] exactMatch:', exactMatch, 'selectedCountryCode:', selectedCountryCode)
      if (exactMatch && exactMatch.countryCode !== selectedCountryCode) {
        console.log('[CRM] Matching country found, loading cities for:', exactMatch.countryCode)
        setFormData({ ...formData, country: exactMatch.countryNameCn, city: '' })
        setSelectedCountryCode(exactMatch.countryCode)
        setCitySearch('')
        loadCities(exactMatch.countryCode)
      }
    }, 200)
  }

  const handleSelectCity = (city: { cityNameCn: string; postalCode?: string }) => {
    setFormData({ 
      ...formData, 
      city: city.cityNameCn,
      postalCode: city.postalCode || formData.postalCode  // 自动填充邮编
    })
    setCitySearch(city.cityNameCn)
    setShowCityDropdown(false)
  }

  // 当城市输入框失去焦点时关闭下拉
  const handleCityBlur = () => {
    setTimeout(() => setShowCityDropdown(false), 200)
  }
  
  // 调用 HERE API 获取地址建议列表
  const handleHereAutosuggest = async (query: string) => {
    if (!query || query.length < 2) {
      setHereSuggestions([])
      setShowHereDropdown(false)
      return
    }
    
    setIsLoadingHere(true)
    setHereError('')
    setHereSearchQuery(query)
    
    try {
      const { hereAutosuggest } = await import('../utils/api')
      const response = await hereAutosuggest(query, 8)
      
      if (response.errCode === 200 && response.data && response.data.length > 0) {
        setHereSuggestions(response.data)
        setShowHereDropdown(true)
      } else {
        setHereSuggestions([])
        setShowHereDropdown(false)
      }
    } catch (error) {
      console.error('HERE API 调用失败:', error)
      setHereSuggestions([])
    } finally {
      setIsLoadingHere(false)
    }
  }
  
  // 选择 HERE 建议的地址
  const handleSelectHereAddress = (suggestion: typeof hereSuggestions[0]) => {
    console.log('选择的地址:', suggestion)
    
    // 从 title 中解析信息（格式通常是: "邮编, 城市, 州/省, 国家"）
    const titleParts = suggestion.title?.split(', ') || []
    const parsedPostalCode = suggestion.postalCode || titleParts[0] || ''
    const parsedCity = suggestion.city || titleParts[1] || ''
    const parsedCountry = suggestion.country || titleParts[titleParts.length - 1] || ''
    
    // 自动填充所有地址相关字段
    setFormData(prev => ({
      ...prev,
      address: suggestion.address || suggestion.title || prev.address,
      country: parsedCountry,
      city: parsedCity,
      postalCode: parsedPostalCode
    }))
    setCountrySearch(parsedCountry)
    setCitySearch(parsedCity)
    setHereSearchQuery('')
    setShowHereDropdown(false)
    setHereSuggestions([])
    
    // 尝试匹配国家代码
    const matchedCountry = countries.find(c => 
      c.countryCode === suggestion.countryCode || 
      c.countryNameCn === parsedCountry ||
      c.countryNameCn?.includes(parsedCountry) ||
      parsedCountry?.includes(c.countryNameCn || '')
    )
    if (matchedCountry) {
      setSelectedCountryCode(matchedCountry.countryCode)
    }
  }
  
  // 防抖定时器引用
  const hereSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 防抖处理 HERE 查询
  const debounceHereSearch = (query: string) => {
    // 清除之前的定时器
    if (hereSearchTimeoutRef.current) {
      clearTimeout(hereSearchTimeoutRef.current)
    }
    // 设置新的定时器
    hereSearchTimeoutRef.current = setTimeout(() => {
      handleHereAutosuggest(query)
    }, 300)
  }

  const getLevelLabel = (level: number) => {
    switch (level) {
      case 1: return '省/州'
      case 2: return '市'
      case 3: return '区/县'
      case 4: return '镇/乡'
      default: return ''
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            {initialData ? '编辑地址' : '添加地址'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" title="关闭">
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
          {/* HERE 地址搜索 */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              地址搜索
              <span className="text-[10px] text-gray-400 ml-1">(输入邮编或地址，从HERE获取匹配结果)</span>
              {isLoadingHere && <span className="ml-1 text-primary-500 text-[10px]">查询中...</span>}
            </label>
            <input
              type="text"
              value={hereSearchQuery}
              onChange={(e) => {
                setHereSearchQuery(e.target.value)
                debounceHereSearch(e.target.value)
              }}
              onFocus={() => {
                if (hereSuggestions.length > 0) {
                  setShowHereDropdown(true)
                }
              }}
              onBlur={() => {
                // 延迟关闭，以便点击选项
                setTimeout(() => setShowHereDropdown(false), 200)
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="输入邮编或地址搜索，如: 41751 或 Berlin..."
            />
            {showHereDropdown && hereSuggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {hereSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectHereAddress(suggestion)}
                    className="px-2.5 py-2 text-xs hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{suggestion.title}</div>
                    <div className="text-gray-500 text-[10px] mt-0.5">
                      {suggestion.address}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                      {suggestion.postalCode && <span>邮编: {suggestion.postalCode}</span>}
                      {suggestion.city && <span>城市: {suggestion.city}</span>}
                      {suggestion.country && <span>国家: {suggestion.country}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 详细地址 - 显示选中的完整地址 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              详细地址
              <span className="text-[10px] text-gray-400 ml-1">(选择后自动填充，可手动修改)</span>
            </label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="选择地址后自动填充，或手动输入"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                国家
                <span className="text-[10px] text-gray-400 ml-1">(自动填充)</span>
              </label>
              <input
                type="text"
                value={countrySearch || formData.country || ''}
                readOnly
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-700 cursor-not-allowed"
                placeholder="选择地址后自动填充"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                城市
                <span className="text-[10px] text-gray-400 ml-1">(自动填充)</span>
              </label>
              <input
                type="text"
                value={citySearch || formData.city || ''}
                readOnly
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-700 cursor-not-allowed"
                placeholder="选择地址后自动填充"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              邮编
              <span className="text-[10px] text-gray-400 ml-1">(自动填充)</span>
            </label>
            <input
              type="text"
              value={formData.postalCode || ''}
              readOnly
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-700 cursor-not-allowed"
              placeholder="选择地址后自动填充"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">地址类型</label>
              <select
                value={formData.addressType}
                onChange={(e) => setFormData({ ...formData, addressType: e.target.value as CustomerAddress['addressType'] })}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                title="选择地址类型"
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
              if (!formData.companyName) {
                alert('请填写公司名称')
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

// 税号编辑弹窗组件 - 支持多选税号类型和验证
// 验证状态: 'none' = 未验证, 'valid' = 有效(绿灯), 'invalid' = 无效(红灯)
type ValidationStatus = 'none' | 'valid' | 'invalid'

// VAT格式规则（按国家代码）
const vatFormatRules: Record<string, { format: string; regex: RegExp; example: string; description: string }> = {
  'AT': { format: 'ATU + 8位数字', regex: /^ATU\d{8}$/, example: 'ATU12345678', description: '奥地利VAT以ATU开头，后跟8位数字' },
  'BE': { format: 'BE + 10位数字', regex: /^BE[01]\d{9}$/, example: 'BE0123456789', description: '比利时VAT以BE开头，后跟10位数字（首位0或1）' },
  'BG': { format: 'BG + 9或10位数字', regex: /^BG\d{9,10}$/, example: 'BG123456789', description: '保加利亚VAT以BG开头，后跟9-10位数字' },
  'HR': { format: 'HR + 11位数字', regex: /^HR\d{11}$/, example: 'HR12345678901', description: '克罗地亚VAT以HR开头，后跟11位数字' },
  'CY': { format: 'CY + 8位字符 + L', regex: /^CY\d{8}[A-Z]$/, example: 'CY12345678L', description: '塞浦路斯VAT以CY开头，8位数字+1位字母' },
  'CZ': { format: 'CZ + 8-10位数字', regex: /^CZ\d{8,10}$/, example: 'CZ12345678', description: '捷克VAT以CZ开头，后跟8-10位数字' },
  'DK': { format: 'DK + 8位数字', regex: /^DK\d{8}$/, example: 'DK12345678', description: '丹麦VAT以DK开头，后跟8位数字' },
  'EE': { format: 'EE + 9位数字', regex: /^EE\d{9}$/, example: 'EE123456789', description: '爱沙尼亚VAT以EE开头，后跟9位数字' },
  'FI': { format: 'FI + 8位数字', regex: /^FI\d{8}$/, example: 'FI12345678', description: '芬兰VAT以FI开头，后跟8位数字' },
  'FR': { format: 'FR + 2位字符 + 9位数字', regex: /^FR[A-Z0-9]{2}\d{9}$/, example: 'FRXX123456789', description: '法国VAT以FR开头，2位字母/数字+9位数字' },
  'DE': { format: 'DE + 9位数字', regex: /^DE\d{9}$/, example: 'DE123456789', description: '德国VAT以DE开头，后跟9位数字' },
  'EL': { format: 'EL + 9位数字', regex: /^EL\d{9}$/, example: 'EL123456789', description: '希腊VAT以EL开头，后跟9位数字' },
  'GR': { format: 'EL + 9位数字', regex: /^EL\d{9}$/, example: 'EL123456789', description: '希腊VAT以EL开头，后跟9位数字' },
  'HU': { format: 'HU + 8位数字', regex: /^HU\d{8}$/, example: 'HU12345678', description: '匈牙利VAT以HU开头，后跟8位数字' },
  'IE': { format: 'IE + 7位数字 + 1-2位字母', regex: /^IE\d{7}[A-Z]{1,2}$/, example: 'IE1234567X', description: '爱尔兰VAT以IE开头，7位数字+1-2位字母' },
  'IT': { format: 'IT + 11位数字', regex: /^IT\d{11}$/, example: 'IT12345678901', description: '意大利VAT以IT开头，后跟11位数字' },
  'LV': { format: 'LV + 11位数字', regex: /^LV\d{11}$/, example: 'LV12345678901', description: '拉脱维亚VAT以LV开头，后跟11位数字' },
  'LT': { format: 'LT + 9或12位数字', regex: /^LT(\d{9}|\d{12})$/, example: 'LT123456789', description: '立陶宛VAT以LT开头，后跟9或12位数字' },
  'LU': { format: 'LU + 8位数字', regex: /^LU\d{8}$/, example: 'LU12345678', description: '卢森堡VAT以LU开头，后跟8位数字' },
  'MT': { format: 'MT + 8位数字', regex: /^MT\d{8}$/, example: 'MT12345678', description: '马耳他VAT以MT开头，后跟8位数字' },
  'NL': { format: 'NL + 9位数字 + B + 2位数字', regex: /^NL\d{9}B\d{2}$/, example: 'NL123456789B01', description: '荷兰VAT以NL开头，9位数字+B+2位数字' },
  'PL': { format: 'PL + 10位数字', regex: /^PL\d{10}$/, example: 'PL1234567890', description: '波兰VAT以PL开头，后跟10位数字' },
  'PT': { format: 'PT + 9位数字', regex: /^PT\d{9}$/, example: 'PT123456789', description: '葡萄牙VAT以PT开头，后跟9位数字' },
  'RO': { format: 'RO + 2-10位数字', regex: /^RO\d{2,10}$/, example: 'RO1234567890', description: '罗马尼亚VAT以RO开头，后跟2-10位数字' },
  'SK': { format: 'SK + 10位数字', regex: /^SK\d{10}$/, example: 'SK1234567890', description: '斯洛伐克VAT以SK开头，后跟10位数字' },
  'SI': { format: 'SI + 8位数字', regex: /^SI\d{8}$/, example: 'SI12345678', description: '斯洛文尼亚VAT以SI开头，后跟8位数字' },
  'ES': { format: 'ES + 字母 + 7位数字 + 字母', regex: /^ES[A-Z]\d{7}[A-Z]$|^ES\d{8}[A-Z]$|^ES[A-Z]\d{8}$/, example: 'ESX1234567X', description: '西班牙VAT以ES开头，格式多样' },
  'SE': { format: 'SE + 12位数字', regex: /^SE\d{12}$/, example: 'SE123456789012', description: '瑞典VAT以SE开头，后跟12位数字' },
  'GB': { format: 'GB + 9或12位数字', regex: /^GB(\d{9}|\d{12})$/, example: 'GB123456789', description: '英国VAT以GB开头，后跟9或12位数字' },
  'XI': { format: 'XI + 9或12位数字', regex: /^XI(\d{9}|\d{12})$/, example: 'XI123456789', description: '北爱尔兰VAT以XI开头，后跟9或12位数字' },
}

// EORI格式规则（按国家代码）
const eoriFormatRules: Record<string, { format: string; regex: RegExp; example: string; description: string }> = {
  'AT': { format: 'AT + 数字', regex: /^AT\d+$/, example: 'AT1234567', description: '奥地利EORI以AT开头，后跟数字' },
  'BE': { format: 'BE + 10位数字', regex: /^BE\d{10}$/, example: 'BE0123456789', description: '比利时EORI以BE开头，后跟10位数字' },
  'BG': { format: 'BG + 数字', regex: /^BG\d+$/, example: 'BG123456789', description: '保加利亚EORI以BG开头，后跟数字' },
  'HR': { format: 'HR + 11位数字', regex: /^HR\d{11}$/, example: 'HR12345678901', description: '克罗地亚EORI以HR开头，后跟11位数字' },
  'CY': { format: 'CY + 数字', regex: /^CY\d+$/, example: 'CY12345678', description: '塞浦路斯EORI以CY开头，后跟数字' },
  'CZ': { format: 'CZ + 数字', regex: /^CZ\d+$/, example: 'CZ12345678', description: '捷克EORI以CZ开头，后跟数字' },
  'DK': { format: 'DK + 10位数字', regex: /^DK\d{10}$/, example: 'DK1234567890', description: '丹麦EORI以DK开头，后跟10位数字' },
  'EE': { format: 'EE + 数字', regex: /^EE\d+$/, example: 'EE123456789', description: '爱沙尼亚EORI以EE开头，后跟数字' },
  'FI': { format: 'FI + 数字', regex: /^FI\d+$/, example: 'FI12345678', description: '芬兰EORI以FI开头，后跟数字' },
  'FR': { format: 'FR + 14位字符', regex: /^FR[A-Z0-9]{14}$/, example: 'FR12345678901234', description: '法国EORI以FR开头，后跟14位字符' },
  'DE': { format: 'DE + 15位数字', regex: /^DE\d{15}$/, example: 'DE123456789012345', description: '德国EORI以DE开头，后跟15位数字' },
  'EL': { format: 'EL/GR + 9位数字', regex: /^(EL|GR)\d{9}$/, example: 'EL123456789', description: '希腊EORI以EL或GR开头，后跟9位数字' },
  'GR': { format: 'EL/GR + 9位数字', regex: /^(EL|GR)\d{9}$/, example: 'GR123456789', description: '希腊EORI以EL或GR开头，后跟9位数字' },
  'HU': { format: 'HU + 数字', regex: /^HU\d+$/, example: 'HU12345678', description: '匈牙利EORI以HU开头，后跟数字' },
  'IE': { format: 'IE + 数字', regex: /^IE\d+$/, example: 'IE1234567', description: '爱尔兰EORI以IE开头，后跟数字' },
  'IT': { format: 'IT + 11-16位数字', regex: /^IT\d{11,16}$/, example: 'IT12345678901', description: '意大利EORI以IT开头，后跟11-16位数字' },
  'LV': { format: 'LV + 11位数字', regex: /^LV\d{11}$/, example: 'LV12345678901', description: '拉脱维亚EORI以LV开头，后跟11位数字' },
  'LT': { format: 'LT + 9-12位数字', regex: /^LT\d{9,12}$/, example: 'LT123456789', description: '立陶宛EORI以LT开头，后跟9-12位数字' },
  'LU': { format: 'LU + 数字', regex: /^LU\d+$/, example: 'LU12345678', description: '卢森堡EORI以LU开头，后跟数字' },
  'MT': { format: 'MT + 数字', regex: /^MT\d+$/, example: 'MT12345678', description: '马耳他EORI以MT开头，后跟数字' },
  'NL': { format: 'NL + 9位数字 + 6位字符', regex: /^NL\d{9}[A-Z0-9]{6}$/, example: 'NL123456789ABCDEF', description: '荷兰EORI以NL开头，9位数字+6位字符' },
  'PL': { format: 'PL + 10位数字', regex: /^PL\d{10}$/, example: 'PL1234567890', description: '波兰EORI以PL开头，后跟10位数字' },
  'PT': { format: 'PT + 9位数字', regex: /^PT\d{9}$/, example: 'PT123456789', description: '葡萄牙EORI以PT开头，后跟9位数字' },
  'RO': { format: 'RO + 数字', regex: /^RO\d+$/, example: 'RO1234567890', description: '罗马尼亚EORI以RO开头，后跟数字' },
  'SK': { format: 'SK + 10位数字', regex: /^SK\d{10}$/, example: 'SK1234567890', description: '斯洛伐克EORI以SK开头，后跟10位数字' },
  'SI': { format: 'SI + 8位数字', regex: /^SI\d{8}$/, example: 'SI12345678', description: '斯洛文尼亚EORI以SI开头，后跟8位数字' },
  'ES': { format: 'ES + 字母 + 数字 + 字母', regex: /^ES[A-Z0-9]+$/, example: 'ESX1234567X', description: '西班牙EORI以ES开头' },
  'SE': { format: 'SE + 10位数字', regex: /^SE\d{10}$/, example: 'SE1234567890', description: '瑞典EORI以SE开头，后跟10位数字' },
  'GB': { format: 'GB + 12位数字', regex: /^GB\d{12}$/, example: 'GB123456789012', description: '英国EORI以GB开头，后跟12位数字' },
  'XI': { format: 'XI + 12位数字', regex: /^XI\d{12}$/, example: 'XI123456789012', description: '北爱尔兰EORI以XI开头，后跟12位数字' },
}

// 验证VAT格式并返回提示
function validateVatFormat(vatNumber: string): { isValid: boolean; hint: string } {
  if (!vatNumber || vatNumber.length < 2) {
    return { isValid: false, hint: '请输入VAT税号，以国家代码开头（如DE、FR、NL等）' }
  }
  
  const countryCode = vatNumber.substring(0, 2).toUpperCase()
  const rule = vatFormatRules[countryCode]
  
  if (!rule) {
    return { 
      isValid: false, 
      hint: `未识别的国家代码"${countryCode}"。支持的国家：${Object.keys(vatFormatRules).join(', ')}` 
    }
  }
  
  if (rule.regex.test(vatNumber)) {
    return { isValid: true, hint: `✓ ${rule.description}` }
  }
  
  return { 
    isValid: false, 
    hint: `格式错误！${rule.description}。正确示例：${rule.example}` 
  }
}

// 验证EORI格式并返回提示
function validateEoriFormat(eoriNumber: string): { isValid: boolean; hint: string } {
  if (!eoriNumber || eoriNumber.length < 2) {
    return { isValid: false, hint: '请输入EORI号码，以国家代码开头（如DE、FR、NL等）' }
  }
  
  const countryCode = eoriNumber.substring(0, 2).toUpperCase()
  const rule = eoriFormatRules[countryCode]
  
  if (!rule) {
    return { 
      isValid: false, 
      hint: `未识别的国家代码"${countryCode}"。支持的国家：${Object.keys(eoriFormatRules).join(', ')}` 
    }
  }
  
  if (rule.regex.test(eoriNumber)) {
    return { isValid: true, hint: `✓ ${rule.description}` }
  }
  
  return { 
    isValid: false, 
    hint: `格式错误！${rule.description}。正确示例：${rule.example}` 
  }
}

interface TaxFormData {
  // 公司信息（公共）
  companyShortName: string
  companyName: string
  companyAddress: string
  country: string
  isDefault: boolean
  // VAT
  vatEnabled: boolean
  vatNumber: string
  vatVerified: boolean
  vatValidationStatus: ValidationStatus
  vatValidationError: string
  // EORI
  eoriEnabled: boolean
  eoriNumber: string
  eoriVerified: boolean
  eoriValidationStatus: ValidationStatus
  eoriValidationError: string
  // 其他
  otherEnabled: boolean
  otherNumber: string
}

// 验证状态指示灯组件
function ValidationLight({ status, error }: { status: ValidationStatus; error?: string }) {
  if (status === 'none') {
    return <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" title="未验证" />
  }
  if (status === 'valid') {
    return <span className="w-3 h-3 rounded-full bg-green-500 inline-block" title="验证通过" />
  }
  return <span className="w-3 h-3 rounded-full bg-red-500 inline-block" title={error || '验证失败'} />
}

function TaxModal({ 
  visible, 
  onClose, 
  onSave, 
  initialCompanyTaxes 
}: { 
  visible: boolean
  onClose: () => void
  onSave: (data: CustomerTaxNumber, closeAfterSave?: boolean) => Promise<void>
  initialCompanyTaxes: CustomerTaxNumber[] | null
}) {
  // 欧盟国家代码映射表
  const euCountryCodeMap: Record<string, string> = {
    'AT': '奥地利', 'BE': '比利时', 'BG': '保加利亚', 'HR': '克罗地亚',
    'CY': '塞浦路斯', 'CZ': '捷克', 'DK': '丹麦', 'EE': '爱沙尼亚',
    'FI': '芬兰', 'FR': '法国', 'DE': '德国', 'EL': '希腊', 'GR': '希腊',
    'HU': '匈牙利', 'IE': '爱尔兰', 'IT': '意大利', 'LV': '拉脱维亚',
    'LT': '立陶宛', 'LU': '卢森堡', 'MT': '马耳他', 'NL': '荷兰',
    'PL': '波兰', 'PT': '葡萄牙', 'RO': '罗马尼亚', 'SK': '斯洛伐克',
    'SI': '斯洛文尼亚', 'ES': '西班牙', 'SE': '瑞典', 'GB': '英国', 'XI': '北爱尔兰'
  }

  // 从税号中提取国家代码并获取国家名称
  const getCountryFromTaxNumber = (taxNumber: string): string | null => {
    const code = taxNumber.substring(0, 2).toUpperCase()
    return euCountryCodeMap[code] || null
  }

  // 从公司税号列表中提取各类型税号
  const existingVat = initialCompanyTaxes?.find(t => t.taxType === 'vat')
  const existingEori = initialCompanyTaxes?.find(t => t.taxType === 'eori')
  const existingOther = initialCompanyTaxes?.find(t => t.taxType === 'other')
  const isEditMode = initialCompanyTaxes && initialCompanyTaxes.length > 0
  const [formData, setFormData] = useState<TaxFormData>({
    companyShortName: '',
    companyName: '',
    companyAddress: '',
    country: '',
    isDefault: false,
    vatEnabled: false,
    vatNumber: '',
    vatVerified: false,
    vatValidationStatus: 'none',
    vatValidationError: '',
    eoriEnabled: false,
    eoriNumber: '',
    eoriVerified: false,
    eoriValidationStatus: 'none',
    eoriValidationError: '',
    otherEnabled: false,
    otherNumber: ''
  })
  const [countries, setCountries] = useState<Array<{ id: string; countryNameCn: string; countryCode: string }>>([])
  const [countrySearch, setCountrySearch] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [vatValidating, setVatValidating] = useState(false)
  const [eoriValidating, setEoriValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  
  // 按公司分组的共享税号类型定义（需要在状态声明前定义）
  interface GroupedSharedTax {
    companyKey: string
    companyShortName: string
    companyName: string
    companyAddress: string
    country: string
    vatNumber?: string
    vatVerified?: boolean
    eoriNumber?: string
    eoriVerified?: boolean
  }

  // 共享税号选择相关状态
  const [taxSource, setTaxSource] = useState<'self' | 'shared'>('self')
  const [sharedTaxList, setSharedTaxList] = useState<Array<{
    id: number
    taxType: 'vat' | 'eori' | 'other'
    taxNumber: string
    country?: string
    companyShortName?: string
    companyName?: string
    companyAddress?: string
    isVerified: boolean
  }>>([])
  const [sharedTaxSearch, setSharedTaxSearch] = useState('')
  const [loadingSharedTax, setLoadingSharedTax] = useState(false)
  const [showSharedTaxDropdown, setShowSharedTaxDropdown] = useState(false)
  const [selectedSharedCompanies, setSelectedSharedCompanies] = useState<GroupedSharedTax[]>([])

  useEffect(() => {
    loadCountries()
  }, [])

  // 加载共享税号列表
  const loadSharedTaxNumbers = async () => {
    setLoadingSharedTax(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/shared-tax-numbers?status=active`)
      const data = await response.json()
      if (data.errCode === 200 && data.data) {
        // API返回的是 {list: [...], total: ...} 格式
        const list = Array.isArray(data.data) ? data.data : (data.data.list || [])
        setSharedTaxList(list)
      }
    } catch (error) {
      console.error('加载共享税号失败:', error)
    } finally {
      setLoadingSharedTax(false)
    }
  }

  useEffect(() => {
    if (taxSource === 'shared' && sharedTaxList.length === 0) {
      loadSharedTaxNumbers()
    }
  }, [taxSource])

  // 按公司分组的共享税号列表
  const groupedSharedTaxList: GroupedSharedTax[] = useMemo(() => {
    const grouped: Record<string, GroupedSharedTax> = {}
    
    sharedTaxList.forEach(tax => {
      // 使用公司名称或公司简称作为分组键
      const key = tax.companyName || tax.companyShortName || tax.taxNumber
      
      if (!grouped[key]) {
        grouped[key] = {
          companyKey: key,
          companyShortName: tax.companyShortName || '',
          companyName: tax.companyName || '',
          companyAddress: tax.companyAddress || '',
          country: tax.country || ''
        }
      }
      
      const taxTypeLower = tax.taxType.toLowerCase()
      if (taxTypeLower === 'vat') {
        grouped[key].vatNumber = tax.taxNumber
        grouped[key].vatVerified = tax.isVerified
      } else if (taxTypeLower === 'eori') {
        grouped[key].eoriNumber = tax.taxNumber
        grouped[key].eoriVerified = tax.isVerified
      }
    })
    
    return Object.values(grouped)
  }, [sharedTaxList])

  // 过滤分组后的共享税号列表
  const filteredGroupedSharedTaxList = groupedSharedTaxList.filter(company => 
    (company.vatNumber || '').toLowerCase().includes(sharedTaxSearch.toLowerCase()) ||
    (company.eoriNumber || '').toLowerCase().includes(sharedTaxSearch.toLowerCase()) ||
    company.companyName.toLowerCase().includes(sharedTaxSearch.toLowerCase()) ||
    company.companyShortName.toLowerCase().includes(sharedTaxSearch.toLowerCase())
  )

  // 切换选中共享公司（多选模式）
  const toggleSelectSharedCompany = (company: GroupedSharedTax) => {
    setSelectedSharedCompanies(prev => {
      const isSelected = prev.some(c => c.companyKey === company.companyKey)
      if (isSelected) {
        // 取消选中
        return prev.filter(c => c.companyKey !== company.companyKey)
      } else {
        // 添加选中
        return [...prev, company]
      }
    })
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedSharedCompanies.length === filteredGroupedSharedTaxList.length) {
      setSelectedSharedCompanies([])
    } else {
      setSelectedSharedCompanies([...filteredGroupedSharedTaxList])
    }
  }

  // 检查公司是否被选中
  const isCompanySelected = (company: GroupedSharedTax) => {
    return selectedSharedCompanies.some(c => c.companyKey === company.companyKey)
  }

  useEffect(() => {
    if (isEditMode && initialCompanyTaxes) {
      // 编辑模式：从公司的所有税号中提取数据
      const firstTax = initialCompanyTaxes[0]
      setFormData({
        companyShortName: firstTax?.companyShortName || '',
        companyName: firstTax?.companyName || '',
        companyAddress: firstTax?.companyAddress || '',
        country: firstTax?.country || '',
        isDefault: initialCompanyTaxes.some(t => t.isDefault) || false,
        vatEnabled: !!existingVat,
        vatNumber: existingVat?.taxNumber || '',
        vatVerified: existingVat?.isVerified || false,
        vatValidationStatus: existingVat ? (existingVat.isVerified ? 'valid' : 'invalid') : 'none',
        vatValidationError: '',
        eoriEnabled: !!existingEori,
        eoriNumber: existingEori?.taxNumber || '',
        eoriVerified: existingEori?.isVerified || false,
        eoriValidationStatus: existingEori ? (existingEori.isVerified ? 'valid' : 'invalid') : 'none',
        eoriValidationError: '',
        otherEnabled: !!existingOther,
        otherNumber: existingOther?.taxNumber || ''
      })
      setCountrySearch(firstTax?.country || '')
    } else {
      // 新增模式：清空所有字段
      setFormData({
        companyShortName: '',
        companyName: '',
        companyAddress: '',
        country: '',
        isDefault: false,
        vatEnabled: false,
        vatNumber: '',
        vatVerified: false,
        vatValidationStatus: 'none',
        vatValidationError: '',
        eoriEnabled: false,
        eoriNumber: '',
        eoriVerified: false,
        eoriValidationStatus: 'none',
        eoriValidationError: '',
        otherEnabled: false,
        otherNumber: ''
      })
      setCountrySearch('')
      setTaxSource('self')  // 重置为自建模式
      setSharedTaxSearch('')
      setSelectedSharedCompanies([])  // 重置多选公司列表
    }
    setValidationError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyTaxes])

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

  // VAT验证
  const handleValidateVAT = async () => {
    if (!formData.vatNumber.trim()) {
      setFormData(prev => ({ ...prev, vatValidationError: '请先输入VAT税号' }))
      return
    }
    
    setVatValidating(true)
    setValidationError(null)
    
    try {
      const { validateVATNumber } = await import('../utils/api')
      const response = await validateVATNumber(formData.vatNumber.trim())
      
      if (response.errCode === 200 && response.data) {
        const data = response.data
        // 从VAT号码中提取国家
        const detectedCountry = getCountryFromTaxNumber(formData.vatNumber.trim())
        if (data.valid) {
          // 如果公司名称/国家为空，自动填充验证返回的信息
          setFormData(prev => ({
            ...prev,
            companyName: prev.companyName || data.companyName || '',
            companyAddress: prev.companyAddress || data.companyAddress || '',
            country: prev.country || detectedCountry || '',
            vatVerified: true,
            vatValidationStatus: 'valid',
            vatValidationError: ''
          }))
          // 同步更新国家搜索框
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        } else {
          // 即使验证失败，也尝试填充国家
          setFormData(prev => ({ 
            ...prev, 
            country: prev.country || detectedCountry || '',
            vatVerified: false,
            vatValidationStatus: 'invalid',
            vatValidationError: data.error || 'VAT税号在欧盟数据库中不存在'
          }))
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        }
      } else {
        setFormData(prev => ({ 
          ...prev, 
          vatValidationStatus: 'invalid',
          vatValidationError: 'VAT验证服务暂时不可用'
        }))
      }
    } catch (error) {
      console.error('VAT验证失败:', error)
      setFormData(prev => ({ 
        ...prev, 
        vatValidationStatus: 'invalid',
        vatValidationError: 'VAT验证服务暂时不可用'
      }))
    } finally {
      setVatValidating(false)
    }
  }

  // EORI验证
  const handleValidateEORI = async () => {
    if (!formData.eoriNumber.trim()) {
      setFormData(prev => ({ ...prev, eoriValidationError: '请先输入EORI号码' }))
      return
    }
    
    setEoriValidating(true)
    setValidationError(null)
    
    try {
      const { validateEORINumber } = await import('../utils/api')
      const response = await validateEORINumber(formData.eoriNumber.trim())
      
      if (response.errCode === 200 && response.data) {
        const data = response.data
        // 从EORI号码中提取国家
        const detectedCountry = getCountryFromTaxNumber(formData.eoriNumber.trim())
        if (data.valid) {
          // 如果公司名称/国家为空，自动填充验证返回的信息
          setFormData(prev => ({
            ...prev,
            companyName: prev.companyName || data.companyName || '',
            companyAddress: prev.companyAddress || data.companyAddress || '',
            country: prev.country || detectedCountry || '',
            eoriVerified: true,
            eoriValidationStatus: 'valid',
            eoriValidationError: ''
          }))
          // 同步更新国家搜索框
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        } else {
          // 即使验证失败，也尝试填充国家
          setFormData(prev => ({ 
            ...prev, 
            country: prev.country || detectedCountry || '',
            eoriVerified: false,
            eoriValidationStatus: 'invalid',
            eoriValidationError: data.error || 'EORI号码在欧盟数据库中不存在或已失效'
          }))
          if (!formData.country && detectedCountry) {
            setCountrySearch(detectedCountry)
          }
        }
      } else {
        setFormData(prev => ({ 
          ...prev, 
          eoriValidationStatus: 'invalid',
          eoriValidationError: 'EORI验证服务暂时不可用'
        }))
      }
    } catch (error) {
      console.error('EORI验证失败:', error)
      setFormData(prev => ({ 
        ...prev, 
        eoriValidationStatus: 'invalid',
        eoriValidationError: 'EORI验证服务暂时不可用'
      }))
    } finally {
      setEoriValidating(false)
    }
  }

  const handleSave = async () => {
    // 从共享库多选模式
    if (taxSource === 'shared' && selectedSharedCompanies.length > 0) {
      if (selectedSharedCompanies.length === 0) {
        alert('请至少选择一个共享税号公司')
        return
      }

      setSaving(true)
      try {
        // 收集所有选中公司的税号
        const allTaxNumbers: Array<{
          taxType: 'vat' | 'eori' | 'other'
          taxNumber: string
          companyShortName: string
          companyName: string
          companyAddress: string
          country: string
          isVerified: boolean
        }> = []

        selectedSharedCompanies.forEach(company => {
          if (company.vatNumber) {
            allTaxNumbers.push({
              taxType: 'vat',
              taxNumber: company.vatNumber,
              companyShortName: company.companyShortName,
              companyName: company.companyName,
              companyAddress: company.companyAddress,
              country: company.country,
              isVerified: company.vatVerified || false
            })
          }
          if (company.eoriNumber) {
            allTaxNumbers.push({
              taxType: 'eori',
              taxNumber: company.eoriNumber,
              companyShortName: company.companyShortName,
              companyName: company.companyName,
              companyAddress: company.companyAddress,
              country: company.country,
              isVerified: company.eoriVerified || false
            })
          }
        })

        // 批量保存
        for (let i = 0; i < allTaxNumbers.length; i++) {
          const tax = allTaxNumbers[i]
          const isLast = i === allTaxNumbers.length - 1
          await onSave({
            taxType: tax.taxType,
            taxNumber: tax.taxNumber,
            companyShortName: tax.companyShortName,
            companyName: tax.companyName,
            companyAddress: tax.companyAddress,
            country: tax.country,
            isVerified: tax.isVerified,
            isDefault: false
          }, isLast)
        }
      } catch (error) {
        console.error('批量保存税号失败:', error)
        alert('保存失败，请重试')
      } finally {
        setSaving(false)
      }
      return
    }

    // 自建税号模式 - 原有逻辑
    // 收集所有选中的税号
    const taxNumbers: Array<{ 
      taxType: 'vat' | 'eori' | 'other'
      taxNumber: string
      companyShortName: string
      companyName: string
      companyAddress: string
      isVerified: boolean
    }> = []
    
    if (formData.vatEnabled && formData.vatNumber.trim()) {
      taxNumbers.push({ 
        taxType: 'vat', 
        taxNumber: formData.vatNumber.trim(),
        companyShortName: formData.companyShortName,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
        isVerified: formData.vatVerified
      })
    }
    if (formData.eoriEnabled && formData.eoriNumber.trim()) {
      taxNumbers.push({ 
        taxType: 'eori', 
        taxNumber: formData.eoriNumber.trim(),
        companyShortName: formData.companyShortName,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
        isVerified: formData.eoriVerified
      })
    }
    if (formData.otherEnabled && formData.otherNumber.trim()) {
      taxNumbers.push({ 
        taxType: 'other', 
        taxNumber: formData.otherNumber.trim(),
        companyShortName: formData.companyShortName,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
        isVerified: false
      })
    }

    if (taxNumbers.length === 0) {
      alert('请至少选择一种税号类型并填写税号')
      return
    }

    // 检查公司名称
    if (!formData.companyName.trim()) {
      alert('请填写公司名称')
      return
    }

    setSaving(true)
    try {
      if (isEditMode && initialCompanyTaxes) {
        // 编辑模式：更新、新增或删除税号
        const { deleteCustomerTaxNumber } = await import('../utils/api')
        
        // 处理VAT
        if (existingVat) {
          const newVat = taxNumbers.find(t => t.taxType === 'vat')
          if (newVat) {
            // 更新
            await onSave({ ...existingVat, ...newVat, country: formData.country, isDefault: formData.isDefault }, false)
          } else {
            // 删除（用户取消勾选了）
            // 注意：这里需要获取customerId，从URL中获取
            const customerId = window.location.pathname.split('/').pop()
            if (customerId && existingVat.id) {
              await deleteCustomerTaxNumber(customerId, existingVat.id)
            }
          }
        } else {
          const newVat = taxNumbers.find(t => t.taxType === 'vat')
          if (newVat) {
            // 新增
            await onSave({ ...newVat, country: formData.country, isDefault: formData.isDefault }, false)
          }
        }
        
        // 处理EORI
        if (existingEori) {
          const newEori = taxNumbers.find(t => t.taxType === 'eori')
          if (newEori) {
            await onSave({ ...existingEori, ...newEori, country: formData.country, isDefault: false }, false)
          } else {
            const customerId = window.location.pathname.split('/').pop()
            if (customerId && existingEori.id) {
              await deleteCustomerTaxNumber(customerId, existingEori.id)
            }
          }
        } else {
          const newEori = taxNumbers.find(t => t.taxType === 'eori')
          if (newEori) {
            await onSave({ ...newEori, country: formData.country, isDefault: false }, false)
          }
        }
        
        // 处理其他
        if (existingOther) {
          const newOther = taxNumbers.find(t => t.taxType === 'other')
          if (newOther) {
            await onSave({ ...existingOther, ...newOther, country: formData.country, isDefault: false }, false)
          } else {
            const customerId = window.location.pathname.split('/').pop()
            if (customerId && existingOther.id) {
              await deleteCustomerTaxNumber(customerId, existingOther.id)
            }
          }
        } else {
          const newOther = taxNumbers.find(t => t.taxType === 'other')
          if (newOther) {
            await onSave({ ...newOther, country: formData.country, isDefault: false }, false)
          }
        }
        
        // 完成后关闭
        onClose()
      } else {
        // 新增模式：依次保存每个税号
        for (let i = 0; i < taxNumbers.length; i++) {
          const tax = taxNumbers[i]
          const isLast = i === taxNumbers.length - 1
          await onSave({
            taxType: tax.taxType,
            taxNumber: tax.taxNumber,
            companyName: tax.companyName,
            companyAddress: tax.companyAddress,
            isVerified: tax.isVerified,
            country: formData.country,
            isDefault: i === 0 ? formData.isDefault : false
          }, isLast)
        }
      }
    } catch (error) {
      console.error('保存税号失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">
            {isEditMode ? '编辑公司税号' : '添加公司税号'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" title="关闭">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* 新增模式下显示来源选择 */}
          {!isEditMode && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">税号来源</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="taxSource"
                    value="self"
                    checked={taxSource === 'self'}
                    onChange={() => setTaxSource('self')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-xs text-gray-700">自建税号</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="taxSource"
                    value="shared"
                    checked={taxSource === 'shared'}
                    onChange={() => setTaxSource('shared')}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-xs text-gray-700">从共享库选择</span>
                </label>
              </div>
            </div>
          )}

          {/* 共享税号选择 - 多选模式 */}
          {!isEditMode && taxSource === 'shared' && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">共享税号库</span>
                </div>
                {selectedSharedCompanies.length > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    已选择 {selectedSharedCompanies.length} 家公司
                  </span>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSharedTaxDropdown(!showSharedTaxDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs border border-amber-300 rounded-lg bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <span className={selectedSharedCompanies.length > 0 ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedSharedCompanies.length > 0 
                      ? selectedSharedCompanies.map(c => c.companyShortName || c.companyName).join(', ')
                      : '请选择共享税号公司（可多选）...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${showSharedTaxDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showSharedTaxDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        value={sharedTaxSearch}
                        onChange={(e) => setSharedTaxSearch(e.target.value)}
                        placeholder="搜索税号或公司名称..."
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {/* 全选操作栏 */}
                    {filteredGroupedSharedTaxList.length > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSharedCompanies.length === filteredGroupedSharedTaxList.length && filteredGroupedSharedTaxList.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                          />
                          <span className="text-xs text-gray-600">全选</span>
                        </label>
                        <span className="text-[10px] text-gray-400">
                          {selectedSharedCompanies.length}/{filteredGroupedSharedTaxList.length}
                        </span>
                      </div>
                    )}
                    <div className="max-h-48 overflow-y-auto">
                      {loadingSharedTax ? (
                        <div className="text-xs text-gray-400 text-center py-4">加载中...</div>
                      ) : filteredGroupedSharedTaxList.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-4">暂无共享税号</div>
                      ) : (
                        filteredGroupedSharedTaxList.map(company => (
                          <div
                            key={company.companyKey}
                            onClick={() => toggleSelectSharedCompany(company)}
                            className={`flex items-center gap-3 p-3 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors ${
                              isCompanySelected(company) ? 'bg-amber-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isCompanySelected(company)}
                              onChange={() => toggleSelectSharedCompany(company)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {company.companyShortName || company.companyName}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {company.vatNumber && (
                                  <div className="flex items-center gap-1">
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700">VAT</span>
                                    <span className="text-[10px] font-mono text-gray-600">{company.vatNumber}</span>
                                    {company.vatVerified && <CheckCircle className="w-3 h-3 text-green-500" />}
                                  </div>
                                )}
                                {company.eoriNumber && (
                                  <div className="flex items-center gap-1">
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700">EORI</span>
                                    <span className="text-[10px] font-mono text-gray-600">{company.eoriNumber}</span>
                                    {company.eoriVerified && <CheckCircle className="w-3 h-3 text-green-500" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 已选公司列表预览 */}
              {selectedSharedCompanies.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-[10px] text-amber-700 mb-1.5 font-medium">已选择的公司：</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSharedCompanies.map(company => (
                      <div 
                        key={company.companyKey}
                        className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-amber-200 text-[10px]"
                      >
                        <span className="text-gray-700">{company.companyShortName || company.companyName}</span>
                        <button
                          type="button"
                          onClick={() => toggleSelectSharedCompany(company)}
                          className="text-gray-400 hover:text-red-500 ml-0.5"
                          title="移除"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[10px] text-amber-600 mt-2">
                💡 可选择多个公司，保存时将批量添加所有选中公司的税号
              </div>
            </div>
          )}

          {/* 税号类型多选 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">税号类型 *</label>
            <div className="space-y-3">
              {/* VAT税号 */}
              <div className="p-2 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="vat-checkbox"
                    checked={formData.vatEnabled}
                    onChange={(e) => setFormData({ ...formData, vatEnabled: e.target.checked, vatVerified: false, vatValidationStatus: 'none', vatValidationError: '' })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="vat-checkbox" className="text-xs font-medium text-gray-700">VAT税号</label>
                  {formData.vatEnabled && formData.vatNumber && (
                    <ValidationLight status={formData.vatValidationStatus} error={formData.vatValidationError} />
                  )}
                </div>
                {formData.vatEnabled && (
                  <div className="space-y-2 ml-6">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.vatNumber}
                        onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value.toUpperCase(), vatVerified: false, vatValidationStatus: 'none', vatValidationError: '' })}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="例如: DE123456789"
                      />
                      <button
                        type="button"
                        onClick={handleValidateVAT}
                        disabled={vatValidating || !formData.vatNumber.trim()}
                        className="px-2 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {vatValidating ? '验证中...' : '验证'}
                      </button>
                    </div>
                    {/* 格式提示 */}
                    {formData.vatNumber && formData.vatValidationStatus === 'none' && (() => {
                      const formatResult = validateVatFormat(formData.vatNumber)
                      return (
                        <div className={`text-xs px-2 py-1 rounded ${formatResult.isValid ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
                          {formatResult.hint}
                        </div>
                      )
                    })()}
                    {/* VAT验证状态提示 */}
                    {formData.vatValidationStatus === 'invalid' && formData.vatValidationError && (
                      <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        ⚠ {formData.vatValidationError}
                      </div>
                    )}
                    {formData.vatValidationStatus === 'valid' && (
                      <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        ✓ VAT税号验证通过
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* EORI号 */}
              <div className="p-2 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="eori-checkbox"
                    checked={formData.eoriEnabled}
                    onChange={(e) => setFormData({ ...formData, eoriEnabled: e.target.checked, eoriVerified: false, eoriValidationStatus: 'none', eoriValidationError: '' })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="eori-checkbox" className="text-xs font-medium text-gray-700">EORI号</label>
                  {formData.eoriEnabled && formData.eoriNumber && (
                    <ValidationLight status={formData.eoriValidationStatus} error={formData.eoriValidationError} />
                  )}
                </div>
                {formData.eoriEnabled && (
                  <div className="space-y-2 ml-6">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.eoriNumber}
                        onChange={(e) => setFormData({ ...formData, eoriNumber: e.target.value.toUpperCase(), eoriVerified: false, eoriValidationStatus: 'none', eoriValidationError: '' })}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="例如: DE123456789012345"
                      />
                      <button
                        type="button"
                        onClick={handleValidateEORI}
                        disabled={eoriValidating || !formData.eoriNumber.trim()}
                        className="px-2 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {eoriValidating ? '验证中...' : '验证'}
                      </button>
                    </div>
                    {/* 格式提示 */}
                    {formData.eoriNumber && formData.eoriValidationStatus === 'none' && (() => {
                      const formatResult = validateEoriFormat(formData.eoriNumber)
                      return (
                        <div className={`text-xs px-2 py-1 rounded ${formatResult.isValid ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
                          {formatResult.hint}
                        </div>
                      )
                    })()}
                    {/* EORI验证状态提示 */}
                    {formData.eoriValidationStatus === 'invalid' && formData.eoriValidationError && (
                      <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        ⚠ {formData.eoriValidationError}
                      </div>
                    )}
                    {formData.eoriValidationStatus === 'valid' && (
                      <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        ✓ EORI号码验证通过
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 其他 */}
              <div className="p-2 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="other-checkbox"
                    checked={formData.otherEnabled}
                    onChange={(e) => setFormData({ ...formData, otherEnabled: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="other-checkbox" className="text-xs font-medium text-gray-700">其他税号</label>
                </div>
                {formData.otherEnabled && (
                  <div className="ml-6">
                    <input
                      type="text"
                      value={formData.otherNumber}
                      onChange={(e) => setFormData({ ...formData, otherNumber: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="请输入税号"
            />
          </div>
                )}
              </div>
            </div>
          </div>

          {/* 公司信息（公共） */}
          <div className="space-y-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
            <label className="block text-xs font-medium text-gray-700">公司信息</label>
            <input
              type="text"
              value={formData.companyShortName}
              onChange={(e) => setFormData({ ...formData, companyShortName: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              placeholder="公司简称"
            />
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              placeholder="公司全称（验证后自动填充）"
            />
            <input
              type="text"
              value={formData.companyAddress}
              onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              placeholder="公司地址（验证后自动填充）"
            />
          </div>

          {/* 国家选择 */}
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
              onBlur={() => setTimeout(() => setShowCountryDropdown(false), 200)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="搜索国家..."
            />
            {showCountryDropdown && filteredCountries.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCountries.slice(0, 20).map((country) => (
                  <div
                    key={country.id}
                    onMouseDown={(e) => e.preventDefault()}
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

          {/* 设为默认 */}
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
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

