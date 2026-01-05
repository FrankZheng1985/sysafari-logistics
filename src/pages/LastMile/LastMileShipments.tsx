import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit, Trash2, Eye, Download, RefreshCw, 
  Package, Truck, MapPin, Clock, CheckCircle, AlertCircle,
  X, ChevronDown, Filter, FileText, Printer
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import DataTable, { Column } from '../../components/DataTable'
import { getApiBaseUrl } from '../../utils/api'
import { formatDateTime } from '../../utils/dateFormat'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface Shipment {
  id: number
  shipmentNo: string
  carrierId: number
  carrierCode: string
  carrierTrackingNo: string
  billId: string
  billNumber: string
  senderName: string
  senderCompany: string
  senderPhone: string
  senderAddress: string
  senderCity: string
  senderPostalCode: string
  senderCountry: string
  receiverName: string
  receiverCompany: string
  receiverPhone: string
  receiverAddress: string
  receiverCity: string
  receiverPostalCode: string
  receiverCountry: string
  pieces: number
  weight: number
  volumeWeight: number
  chargeableWeight: number
  dimensions: string
  goodsDescription: string
  serviceType: string
  zoneCode: string
  purchaseCost: number
  salesAmount: number
  profitAmount: number
  currency: string
  status: string
  labelUrl: string
  createdAt: string
  shippedAt: string
  deliveredAt: string
  tracking?: TrackingEvent[]
}

interface TrackingEvent {
  id: number
  eventTime: string
  eventCode: string
  eventDescription: string
  eventLocation: string
}

interface Carrier {
  id: number
  carrierCode: string
  carrierName: string
}

interface ShipmentFormData {
  carrierId: number
  billId: string
  billNumber: string
  senderName: string
  senderCompany: string
  senderPhone: string
  senderAddress: string
  senderCity: string
  senderPostalCode: string
  senderCountry: string
  receiverName: string
  receiverCompany: string
  receiverPhone: string
  receiverAddress: string
  receiverCity: string
  receiverPostalCode: string
  receiverCountry: string
  pieces: number
  weight: number
  dimensions: string
  goodsDescription: string
  serviceType: string
}

// ==================== 常量定义 ====================

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-gray-100 text-gray-700', icon: Clock },
  created: { label: '已创建', color: 'bg-blue-100 text-blue-700', icon: FileText },
  in_transit: { label: '运输中', color: 'bg-yellow-100 text-yellow-700', icon: Truck },
  delivered: { label: '已送达', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  exception: { label: '异常', color: 'bg-red-100 text-red-700', icon: AlertCircle }
}

const SERVICE_TYPES = [
  { value: 'standard', label: '标准服务' },
  { value: 'express', label: '快速服务' },
  { value: 'economy', label: '经济服务' }
]

const initialFormData: ShipmentFormData = {
  carrierId: 0,
  billId: '',
  billNumber: '',
  senderName: '',
  senderCompany: '',
  senderPhone: '',
  senderAddress: '',
  senderCity: '',
  senderPostalCode: '',
  senderCountry: 'DE',
  receiverName: '',
  receiverCompany: '',
  receiverPhone: '',
  receiverAddress: '',
  receiverCity: '',
  receiverPostalCode: '',
  receiverCountry: '',
  pieces: 1,
  weight: 0,
  dimensions: '',
  goodsDescription: '',
  serviceType: 'standard'
}

// ==================== 主组件 ====================

export default function LastMileShipments() {
  // 数据状态
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // 筛选状态
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')
  
  // 模态框状态
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [currentShipment, setCurrentShipment] = useState<Shipment | null>(null)
  const [formData, setFormData] = useState<ShipmentFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  
  // 轨迹状态
  const [loadingTracking, setLoadingTracking] = useState(false)

  // 获取承运商列表
  const fetchCarriers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers?status=active&pageSize=100`)
      const data = await res.json()
      if (data.errCode === 200) {
        setCarriers(data.data.list)
      }
    } catch (error) {
      console.error('获取承运商列表失败:', error)
    }
  }

  // 获取运单列表
  const fetchShipments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (searchText) params.append('search', searchText)
      if (filterStatus) params.append('status', filterStatus)
      if (filterCarrier) params.append('carrierId', filterCarrier)
      
      const res = await fetch(`${API_BASE}/api/last-mile/shipments?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setShipments(data.data.list)
        setTotal(data.data.total)
      }
    } catch (error) {
      console.error('获取运单列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCarriers()
  }, [])

  useEffect(() => {
    fetchShipments()
  }, [page, pageSize, searchText, filterStatus, filterCarrier])

  // 打开创建模态框
  const handleCreate = () => {
    setCurrentShipment(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  // 查看详情
  const handleView = async (shipment: Shipment) => {
    setCurrentShipment(shipment)
    setShowDetailModal(true)
    
    // 获取轨迹信息
    setLoadingTracking(true)
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/shipments/${shipment.id}/tracking`)
      const data = await res.json()
      if (data.errCode === 200) {
        setCurrentShipment(prev => prev ? { ...prev, tracking: data.data } : null)
      }
    } catch (error) {
      console.error('获取轨迹失败:', error)
    } finally {
      setLoadingTracking(false)
    }
  }

  // 保存运单
  const handleSave = async () => {
    if (!formData.carrierId) {
      alert('请选择承运商')
      return
    }
    if (!formData.receiverName || !formData.receiverAddress) {
      alert('请填写收件人信息')
      return
    }
    
    setSaving(true)
    try {
      const url = currentShipment
        ? `${API_BASE}/api/last-mile/shipments/${currentShipment.id}`
        : `${API_BASE}/api/last-mile/shipments`
      
      const carrier = carriers.find(c => c.id === formData.carrierId)
      
      const res = await fetch(url, {
        method: currentShipment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          carrierCode: carrier?.carrierCode || ''
        })
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setShowModal(false)
        fetchShipments()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 删除运单
  const handleDelete = async (shipment: Shipment) => {
    if (!confirm(`确定要删除运单 "${shipment.shipmentNo}" 吗？`)) {
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/shipments/${shipment.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchShipments()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  // 下载面单
  const handleDownloadLabel = (shipment: Shipment) => {
    if (shipment.labelUrl) {
      window.open(shipment.labelUrl, '_blank')
    } else {
      alert('暂无面单')
    }
  }

  // 统计数据
  const statusCounts = {
    all: total,
    pending: shipments.filter(s => s.status === 'pending').length,
    in_transit: shipments.filter(s => s.status === 'in_transit').length,
    delivered: shipments.filter(s => s.status === 'delivered').length
  }

  // 表格列定义
  const columns: Column<Shipment>[] = [
    {
      key: 'shipmentNo',
      label: '运单号',
      width: 140,
      sorter: true,
      render: (record: Shipment) => (
        <div>
          <span className="font-mono font-medium text-blue-600">{record.shipmentNo}</span>
          {record.carrierTrackingNo && (
            <div className="text-xs text-gray-500 font-mono">{record.carrierTrackingNo}</div>
          )}
        </div>
      )
    },
    {
      key: 'carrier',
      label: '承运商',
      width: 100,
      sorter: true,
      filterable: true,
      render: (record: Shipment) => (
        <span className="px-2 py-0.5 bg-gray-100 rounded text-sm">{record.carrierCode}</span>
      )
    },
    {
      key: 'receiver',
      label: '收件人',
      width: 180,
      sorter: true,
      filterable: true,
      render: (record: Shipment) => (
        <div className="text-sm">
          <div className="font-medium">{record.receiverName}</div>
          <div className="text-gray-500 truncate max-w-[160px]" title={record.receiverAddress}>
            {record.receiverCity}, {record.receiverCountry}
          </div>
        </div>
      )
    },
    {
      key: 'weight',
      label: '重量/件数',
      width: 100,
      align: 'right',
      sorter: (a, b) => (a.chargeableWeight || a.weight) - (b.chargeableWeight || b.weight),
      render: (record: Shipment) => (
        <div className="text-sm">
          <div>{record.chargeableWeight || record.weight} kg</div>
          <div className="text-gray-500">{record.pieces} 件</div>
        </div>
      )
    },
    {
      key: 'zoneCode',
      label: 'Zone',
      width: 70,
      align: 'center',
      sorter: true,
      filterable: true,
      render: (record: Shipment) => (
        record.zoneCode ? (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-mono">
            {record.zoneCode}
          </span>
        ) : '-'
      )
    },
    {
      key: 'cost',
      label: '费用',
      width: 120,
      align: 'right',
      sorter: (a, b) => (a.salesAmount || 0) - (b.salesAmount || 0),
      render: (record: Shipment) => (
        <div className="text-sm">
          {record.salesAmount ? (
            <>
              <div className="font-medium">€{record.salesAmount.toFixed(2)}</div>
              {record.profitAmount !== undefined && (
                <div className={`text-xs ${record.profitAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  利润: €{record.profitAmount.toFixed(2)}
                </div>
              )}
            </>
          ) : '-'}
        </div>
      )
    },
    {
      key: 'status',
      label: '状态',
      width: 100,
      align: 'center',
      sorter: true,
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '已创建', value: 'created' },
        { text: '运输中', value: 'in_transit' },
        { text: '已送达', value: 'delivered' },
        { text: '异常', value: 'exception' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (record: Shipment) => {
        const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending
        const Icon = config.icon
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${config.color}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        )
      }
    },
    {
      key: 'createdAt',
      label: '创建时间',
      width: 140,
      sorter: (a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateA - dateB
      },
      render: (record: Shipment) => (
        <span className="text-sm text-gray-600">
          {record.createdAt ? formatDateTime(record.createdAt) : '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '操作',
      width: 150,
      render: (record: Shipment) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleView(record)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="查看详情"
          >
            <Eye className="w-4 h-4" />
          </button>
          {record.labelUrl && (
            <button
              onClick={() => handleDownloadLabel(record)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
              title="下载面单"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDelete(record)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="运单管理"
        description="管理最后里程运单，打单、查询轨迹"
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-sm text-gray-500">全部运单</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>
              <div className="text-sm text-gray-500">待处理</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{statusCounts.in_transit}</div>
              <div className="text-sm text-gray-500">运输中</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{statusCounts.delivered}</div>
              <div className="text-sm text-gray-500">已送达</div>
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索运单号、收件人..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchShipments()}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 承运商筛选 */}
          <select
            value={filterCarrier}
            onChange={(e) => setFilterCarrier(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部承运商</option>
            {carriers.map(carrier => (
              <option key={carrier.id} value={carrier.id}>{carrier.carrierName}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>

          {/* 刷新 */}
          <button
            onClick={fetchShipments}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* 新建运单 */}
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            新建运单
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow">
        <DataTable<Shipment>
          columns={columns}
          data={shipments}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p)
              if (ps !== undefined) setPageSize(ps)
            }
          }}
        />
      </div>

      {/* 新建运单模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-medium">新建运单</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* 基本信息 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  基本信息
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      承运商 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.carrierId}
                      onChange={(e) => setFormData({ ...formData, carrierId: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>请选择承运商</option>
                      {carriers.map(carrier => (
                        <option key={carrier.id} value={carrier.id}>{carrier.carrierName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">服务类型</label>
                    <select
                      value={formData.serviceType}
                      onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {SERVICE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">关联提单号</label>
                    <input
                      type="text"
                      value={formData.billNumber}
                      onChange={(e) => setFormData({ ...formData, billNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="可选"
                    />
                  </div>
                </div>
              </div>

              {/* 发件人信息 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  发件人信息
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">发件人</label>
                    <input
                      type="text"
                      value={formData.senderName}
                      onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">公司</label>
                    <input
                      type="text"
                      value={formData.senderCompany}
                      onChange={(e) => setFormData({ ...formData, senderCompany: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
                    <input
                      type="text"
                      value={formData.senderPhone}
                      onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">城市/邮编</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.senderCity}
                        onChange={(e) => setFormData({ ...formData, senderCity: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="城市"
                      />
                      <input
                        type="text"
                        value={formData.senderPostalCode}
                        onChange={(e) => setFormData({ ...formData, senderPostalCode: e.target.value })}
                        className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="邮编"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                    <input
                      type="text"
                      value={formData.senderAddress}
                      onChange={(e) => setFormData({ ...formData, senderAddress: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 收件人信息 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  收件人信息
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      收件人 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.receiverName}
                      onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">公司</label>
                    <input
                      type="text"
                      value={formData.receiverCompany}
                      onChange={(e) => setFormData({ ...formData, receiverCompany: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      电话 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.receiverPhone}
                      onChange={(e) => setFormData({ ...formData, receiverPhone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      城市/邮编 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.receiverCity}
                        onChange={(e) => setFormData({ ...formData, receiverCity: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="城市"
                      />
                      <input
                        type="text"
                        value={formData.receiverPostalCode}
                        onChange={(e) => setFormData({ ...formData, receiverPostalCode: e.target.value })}
                        className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="邮编"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      地址 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.receiverAddress}
                      onChange={(e) => setFormData({ ...formData, receiverAddress: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      国家 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.receiverCountry}
                      onChange={(e) => setFormData({ ...formData, receiverCountry: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="如: DE, NL, FR"
                    />
                  </div>
                </div>
              </div>

              {/* 货物信息 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-600" />
                  货物信息
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">件数</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.pieces}
                      onChange={(e) => setFormData({ ...formData, pieces: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">重量 (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">尺寸 (cm)</label>
                    <input
                      type="text"
                      value={formData.dimensions}
                      onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="L x W x H"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">货物描述</label>
                    <textarea
                      value={formData.goodsDescription}
                      onChange={(e) => setFormData({ ...formData, goodsDescription: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : '创建运单'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 运单详情模态框 */}
      {showDetailModal && currentShipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-medium">运单详情</h3>
                <div className="text-sm text-gray-500 font-mono">{currentShipment.shipmentNo}</div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* 状态和承运商 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-gray-100 rounded-lg font-medium">
                    {currentShipment.carrierCode}
                  </span>
                  {(() => {
                    const config = STATUS_CONFIG[currentShipment.status] || STATUS_CONFIG.pending
                    const Icon = config.icon
                    return (
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg ${config.color}`}>
                        <Icon className="w-4 h-4" />
                        {config.label}
                      </span>
                    )
                  })()}
                </div>
                {currentShipment.carrierTrackingNo && (
                  <div className="text-sm">
                    <span className="text-gray-500">承运商单号: </span>
                    <span className="font-mono">{currentShipment.carrierTrackingNo}</span>
                  </div>
                )}
              </div>

              {/* 发收件人信息 */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-3">发件人</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{currentShipment.senderName || '-'}</div>
                    {currentShipment.senderCompany && (
                      <div className="text-gray-600">{currentShipment.senderCompany}</div>
                    )}
                    <div className="text-gray-600">{currentShipment.senderAddress}</div>
                    <div className="text-gray-600">
                      {currentShipment.senderPostalCode} {currentShipment.senderCity}, {currentShipment.senderCountry}
                    </div>
                    {currentShipment.senderPhone && (
                      <div className="text-gray-600">电话: {currentShipment.senderPhone}</div>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-700 mb-3">收件人</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{currentShipment.receiverName}</div>
                    {currentShipment.receiverCompany && (
                      <div className="text-gray-600">{currentShipment.receiverCompany}</div>
                    )}
                    <div className="text-gray-600">{currentShipment.receiverAddress}</div>
                    <div className="text-gray-600">
                      {currentShipment.receiverPostalCode} {currentShipment.receiverCity}, {currentShipment.receiverCountry}
                    </div>
                    {currentShipment.receiverPhone && (
                      <div className="text-gray-600">电话: {currentShipment.receiverPhone}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 货物和费用 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">货物信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">件数</span>
                      <span>{currentShipment.pieces} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">实际重量</span>
                      <span>{currentShipment.weight} kg</span>
                    </div>
                    {currentShipment.volumeWeight > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">体积重</span>
                        <span>{currentShipment.volumeWeight} kg</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-500">计费重</span>
                      <span>{currentShipment.chargeableWeight || currentShipment.weight} kg</span>
                    </div>
                    {currentShipment.zoneCode && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Zone</span>
                        <span className="font-mono">{currentShipment.zoneCode}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">费用信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">采购成本</span>
                      <span>€{(currentShipment.purchaseCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">销售金额</span>
                      <span>€{(currentShipment.salesAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-medium">
                      <span className="text-gray-500">利润</span>
                      <span className={currentShipment.profitAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                        €{(currentShipment.profitAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 轨迹信息 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">运单轨迹</h4>
                {loadingTracking ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : currentShipment.tracking && currentShipment.tracking.length > 0 ? (
                  <div className="space-y-3">
                    {currentShipment.tracking.map((event, index) => (
                      <div key={event.id || index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                          {index < currentShipment.tracking!.length - 1 && (
                            <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="text-sm font-medium">{event.eventDescription}</div>
                          <div className="text-xs text-gray-500">
                            {event.eventLocation && <span>{event.eventLocation} · </span>}
                            {formatDateTime(event.eventTime)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>暂无轨迹信息</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              {currentShipment.labelUrl && (
                <button
                  onClick={() => handleDownloadLabel(currentShipment)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  下载面单
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
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
