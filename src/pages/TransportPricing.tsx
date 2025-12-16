import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Search, Edit, Trash2, Calculator,
  Truck, MapPin, Calendar
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DataTable, { Column } from '../components/DataTable'

interface TransportPrice {
  id: string
  routeCode: string
  routeName: string
  origin: string
  destination: string
  serviceType: string
  priceType: string
  unitPrice: number
  currency: string
  minWeight: number
  maxWeight: number
  effectiveDate: string
  expiryDate: string
  providerId: string
  providerName: string
  status: string
  remark: string
  createTime: string
}

interface PriceFormData {
  routeCode: string
  routeName: string
  origin: string
  destination: string
  serviceType: string
  priceType: string
  unitPrice: number
  currency: string
  minWeight: number
  maxWeight: number
  effectiveDate: string
  expiryDate: string
  providerId: string
  providerName: string
  status: string
  remark: string
}

const SERVICE_TYPES = [
  { value: 'fcl', label: '整箱 FCL' },
  { value: 'lcl', label: '拼箱 LCL' },
  { value: 'air', label: '空运' },
  { value: 'rail', label: '铁路' },
  { value: 'trucking', label: '拖车' },
  { value: 'delivery', label: '派送' },
]

const PRICE_TYPES = [
  { value: 'per_kg', label: '每公斤' },
  { value: 'per_cbm', label: '每立方米' },
  { value: 'per_container', label: '每箱' },
  { value: 'per_order', label: '每单' },
  { value: 'flat_rate', label: '固定费用' },
]

const CURRENCIES = [
  { value: 'CNY', label: '人民币 ¥' },
  { value: 'USD', label: '美元 $' },
  { value: 'EUR', label: '欧元 €' },
  { value: 'GBP', label: '英镑 £' },
]

const initialFormData: PriceFormData = {
  routeCode: '',
  routeName: '',
  origin: '',
  destination: '',
  serviceType: 'delivery',
  priceType: 'per_kg',
  unitPrice: 0,
  currency: 'CNY',
  minWeight: 0,
  maxWeight: 0,
  effectiveDate: new Date().toISOString().split('T')[0],
  expiryDate: '',
  providerId: '',
  providerName: '',
  status: 'active',
  remark: '',
}

// 模拟数据
const mockPrices: TransportPrice[] = [
  {
    id: '1',
    routeCode: 'RT001',
    routeName: '上海-鹿特丹派送',
    origin: '上海',
    destination: '鹿特丹',
    serviceType: 'delivery',
    priceType: 'per_kg',
    unitPrice: 12.5,
    currency: 'CNY',
    minWeight: 0,
    maxWeight: 1000,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-12-31',
    providerId: '1',
    providerName: 'DHL快递',
    status: 'active',
    remark: '含基本保险',
    createTime: '2024-01-01',
  },
  {
    id: '2',
    routeCode: 'RT002',
    routeName: '宁波-汉堡派送',
    origin: '宁波',
    destination: '汉堡',
    serviceType: 'delivery',
    priceType: 'per_kg',
    unitPrice: 15.0,
    currency: 'CNY',
    minWeight: 0,
    maxWeight: 500,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-12-31',
    providerId: '2',
    providerName: 'UPS物流',
    status: 'active',
    remark: '',
    createTime: '2024-01-01',
  },
  {
    id: '3',
    routeCode: 'RT003',
    routeName: '深圳-伦敦整柜',
    origin: '深圳',
    destination: '伦敦',
    serviceType: 'fcl',
    priceType: 'per_container',
    unitPrice: 2800,
    currency: 'USD',
    minWeight: 0,
    maxWeight: 0,
    effectiveDate: '2024-01-01',
    expiryDate: '2024-06-30',
    providerId: '3',
    providerName: 'MSC海运',
    status: 'expired',
    remark: '40尺柜',
    createTime: '2024-01-01',
  },
]

export default function TransportPricing() {
  const navigate = useNavigate()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false) // setLoading reserved for API integration
  const [prices, setPrices] = useState<TransportPrice[]>(mockPrices)
  const [total, setTotal] = useState(mockPrices.length)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [editingPrice, setEditingPrice] = useState<TransportPrice | null>(null)
  const [formData, setFormData] = useState<PriceFormData>(initialFormData)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [saving, setSaving] = useState(false) // setSaving reserved for API integration

  const [calcModalVisible, setCalcModalVisible] = useState(false)
  const [calcData, setCalcData] = useState({
    weight: 0,
    cbm: 0,
    selectedPrice: null as TransportPrice | null,
    result: 0,
  })

  const tabs = [
    { label: 'TMS概览', path: '/tms' },
    { label: 'TMS管理', path: '/cmr-manage' },
    { label: '服务商管理', path: '/tms/service-providers' },
    { label: '运费管理', path: '/tms/pricing' },
    { label: '条件管理', path: '/tms/conditions' },
  ]

  useEffect(() => {
    // 筛选数据
    let filtered = mockPrices
    if (searchText) {
      filtered = filtered.filter(p => 
        p.routeName.includes(searchText) || 
        p.origin.includes(searchText) || 
        p.destination.includes(searchText) ||
        p.providerName.includes(searchText)
      )
    }
    if (filterType) {
      filtered = filtered.filter(p => p.serviceType === filterType)
    }
    if (filterStatus) {
      filtered = filtered.filter(p => p.status === filterStatus)
    }
    setPrices(filtered)
    setTotal(filtered.length)
  }, [searchText, filterType, filterStatus])

  const handleOpenModal = (price?: TransportPrice) => {
    if (price) {
      setEditingPrice(price)
      setFormData({
        routeCode: price.routeCode,
        routeName: price.routeName,
        origin: price.origin,
        destination: price.destination,
        serviceType: price.serviceType,
        priceType: price.priceType,
        unitPrice: price.unitPrice,
        currency: price.currency,
        minWeight: price.minWeight,
        maxWeight: price.maxWeight,
        effectiveDate: price.effectiveDate,
        expiryDate: price.expiryDate,
        providerId: price.providerId,
        providerName: price.providerName,
        status: price.status,
        remark: price.remark,
      })
    } else {
      setEditingPrice(null)
      setFormData(initialFormData)
    }
    setModalVisible(true)
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setEditingPrice(null)
    setFormData(initialFormData)
  }

  const handleSave = () => {
    if (!formData.routeCode || !formData.routeName) {
      alert('请填写路线编码和名称')
      return
    }
    
    // 模拟保存
    if (editingPrice) {
      setPrices(prev => prev.map(p => 
        p.id === editingPrice.id 
          ? { ...p, ...formData, updateTime: new Date().toISOString() }
          : p
      ))
    } else {
      const newPrice: TransportPrice = {
        id: String(Date.now()),
        ...formData,
        createTime: new Date().toISOString(),
      }
      setPrices(prev => [newPrice, ...prev])
      setTotal(prev => prev + 1)
    }
    
    handleCloseModal()
  }

  const handleDelete = (price: TransportPrice) => {
    if (!confirm(`确定要删除运费方案 "${price.routeName}" 吗？`)) {
      return
    }
    setPrices(prev => prev.filter(p => p.id !== price.id))
    setTotal(prev => prev - 1)
  }

  const handleCalculate = (price: TransportPrice) => {
    setCalcData({
      weight: 0,
      cbm: 0,
      selectedPrice: price,
      result: 0,
    })
    setCalcModalVisible(true)
  }

  const calculateTotal = () => {
    if (!calcData.selectedPrice) return 0
    
    const { priceType, unitPrice } = calcData.selectedPrice
    let result = 0
    
    switch (priceType) {
      case 'per_kg':
        result = unitPrice * calcData.weight
        break
      case 'per_cbm':
        result = unitPrice * calcData.cbm
        break
      case 'per_container':
      case 'per_order':
      case 'flat_rate':
        result = unitPrice
        break
    }
    
    return result
  }

  const getServiceTypeName = (type: string) => {
    return SERVICE_TYPES.find(t => t.value === type)?.label || type
  }

  const getPriceTypeName = (type: string) => {
    return PRICE_TYPES.find(t => t.value === type)?.label || type
  }

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€', GBP: '£' }
    return symbols[currency] || currency
  }

  const columns: Column<TransportPrice>[] = [
    {
      key: 'routeCode',
      label: '路线编码',
      width: '100px',
      render: (item) => (
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          {item.routeCode}
        </span>
      ),
    },
    {
      key: 'routeName',
      label: '路线名称',
      render: (item) => (
        <div>
          <div className="font-medium text-gray-900">{item.routeName}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" />
            {item.origin} → {item.destination}
          </div>
        </div>
      ),
    },
    {
      key: 'serviceType',
      label: '服务类型',
      width: '100px',
      render: (item) => {
        const typeConfig: Record<string, { bg: string; text: string }> = {
          fcl: { bg: 'bg-blue-100', text: 'text-blue-700' },
          lcl: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
          air: { bg: 'bg-purple-100', text: 'text-purple-700' },
          rail: { bg: 'bg-amber-100', text: 'text-amber-700' },
          trucking: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
          delivery: { bg: 'bg-green-100', text: 'text-green-700' },
        }
        const config = typeConfig[item.serviceType] || { bg: 'bg-gray-100', text: 'text-gray-700' }
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {getServiceTypeName(item.serviceType)}
          </span>
        )
      },
    },
    {
      key: 'unitPrice',
      label: '单价',
      width: '120px',
      render: (item) => (
        <div>
          <div className="font-bold text-primary-600">
            {getCurrencySymbol(item.currency)} {item.unitPrice.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">{getPriceTypeName(item.priceType)}</div>
        </div>
      ),
    },
    {
      key: 'providerName',
      label: '服务商',
      width: '120px',
      render: (item) => (
        <div className="flex items-center gap-1 text-gray-600">
          <Truck className="w-3 h-3" />
          {item.providerName || '-'}
        </div>
      ),
    },
    {
      key: 'effectiveDate',
      label: '有效期',
      width: '160px',
      render: (item) => (
        <div className="text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {item.effectiveDate}
          </div>
          {item.expiryDate && (
            <div className="text-gray-400">至 {item.expiryDate}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      width: '80px',
      render: (item) => {
        const statusConfig: Record<string, { bg: string; text: string }> = {
          active: { bg: 'bg-green-100', text: 'text-green-700' },
          inactive: { bg: 'bg-gray-100', text: 'text-gray-500' },
          expired: { bg: 'bg-red-100', text: 'text-red-600' },
        }
        const config = statusConfig[item.status] || statusConfig.inactive
        const label = item.status === 'active' ? '生效中' : item.status === 'expired' ? '已过期' : '未启用'
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: '操作',
      width: '120px',
      render: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCalculate(item)}
            className="p-1 text-gray-400 hover:text-green-600 rounded"
            title="计算运费"
          >
            <Calculator className="w-4 h-4" />
          </button>
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
        activeTab="/tms/pricing"
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
              placeholder="搜索路线、城市、服务商..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 w-64 bg-white"
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部服务类型</option>
            {SERVICE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="">全部状态</option>
            <option value="active">生效中</option>
            <option value="inactive">未启用</option>
            <option value="expired">已过期</option>
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          新建运费方案
        </button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <DataTable
          columns={columns}
          data={prices}
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
          <div className="relative bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPrice ? '编辑运费方案' : '新建运费方案'}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    路线编码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.routeCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, routeCode: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="如：RT001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    路线名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.routeName}
                    onChange={(e) => setFormData(prev => ({ ...prev, routeName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入路线名称"
                  />
                </div>
              </div>

              {/* 起止点 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">起始地</label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入起始城市/港口"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目的地</label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入目的城市/港口"
                  />
                </div>
              </div>

              {/* 服务类型和计价方式 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务类型</label>
                  <select
                    value={formData.serviceType}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {SERVICE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">计价方式</label>
                  <select
                    value={formData.priceType}
                    onChange={(e) => setFormData(prev => ({ ...prev, priceType: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {PRICE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 价格和货币 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">单价</label>
                  <input
                    type="number"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">货币</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="active">生效中</option>
                    <option value="inactive">未启用</option>
                  </select>
                </div>
              </div>

              {/* 重量范围 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最小重量 (kg)</label>
                  <input
                    type="number"
                    value={formData.minWeight}
                    onChange={(e) => setFormData(prev => ({ ...prev, minWeight: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最大重量 (kg)</label>
                  <input
                    type="number"
                    value={formData.maxWeight}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxWeight: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="不限"
                    min="0"
                  />
                </div>
              </div>

              {/* 有效期 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">生效日期</label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">失效日期</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
              </div>

              {/* 服务商 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服务商</label>
                <input
                  type="text"
                  value={formData.providerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, providerName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="输入或选择服务商"
                />
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  placeholder="输入备注信息"
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

      {/* 运费计算弹窗 */}
      {calcModalVisible && calcData.selectedPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCalcModalVisible(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-[400px]">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">运费计算器</h3>
            </div>

            <div className="p-4 space-y-4">
              {/* 路线信息 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {calcData.selectedPrice.routeName}
                </div>
                <div className="text-xs text-gray-500">
                  {calcData.selectedPrice.origin} → {calcData.selectedPrice.destination}
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">单价：</span>
                  <span className="font-bold text-primary-600">
                    {getCurrencySymbol(calcData.selectedPrice.currency)} {calcData.selectedPrice.unitPrice}
                  </span>
                  <span className="text-gray-400 ml-1">/ {getPriceTypeName(calcData.selectedPrice.priceType)}</span>
                </div>
              </div>

              {/* 输入区域 */}
              {(calcData.selectedPrice.priceType === 'per_kg') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">重量 (kg)</label>
                  <input
                    type="number"
                    value={calcData.weight || ''}
                    onChange={(e) => setCalcData(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入货物重量"
                    min="0"
                  />
                </div>
              )}

              {(calcData.selectedPrice.priceType === 'per_cbm') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">体积 (CBM)</label>
                  <input
                    type="number"
                    value={calcData.cbm || ''}
                    onChange={(e) => setCalcData(prev => ({ ...prev, cbm: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    placeholder="输入货物体积"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}

              {/* 计算结果 */}
              <div className="p-4 bg-primary-50 rounded-lg text-center">
                <div className="text-sm text-gray-600 mb-1">预估运费</div>
                <div className="text-3xl font-bold text-primary-600">
                  {getCurrencySymbol(calcData.selectedPrice.currency)} {calculateTotal().toFixed(2)}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setCalcModalVisible(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

