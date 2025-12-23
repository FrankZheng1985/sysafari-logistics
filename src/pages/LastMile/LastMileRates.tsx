import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit, Trash2, Check, X, 
  FileText, RefreshCw, DollarSign, TrendingUp,
  ChevronDown, ChevronRight, Copy, Download
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import DataTable, { Column } from '../../components/DataTable'
import { getApiBaseUrl } from '../../utils/api'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface Carrier {
  id: number
  carrierCode: string
  carrierName: string
}

interface Zone {
  id: number
  zoneCode: string
  zoneName: string
}

interface RateCard {
  id: number
  rateCardCode: string
  rateCardName: string
  carrierId: number
  carrierName?: string
  carrierCode?: string
  rateType: string
  serviceType: string
  validFrom: string
  validUntil: string
  currency: string
  status: string
  isDefault: boolean
  createdAt: string
  tiers?: RateTier[]
  surcharges?: Surcharge[]
}

interface RateTier {
  id: number
  rateCardId: number
  zoneId: number
  zoneCode: string
  weightFrom: number
  weightTo: number
  purchasePrice: number | null
  purchaseMinCharge: number | null
  salesPrice: number | null
  salesMinCharge: number | null
  priceUnit: string
  marginRate: number | null
  marginAmount: number | null
}

interface Surcharge {
  id: number
  surchargeCode: string
  surchargeName: string
  chargeType: string
  purchaseAmount: number | null
  salesAmount: number | null
  percentage: number | null
  isMandatory: boolean
}

interface RateCardFormData {
  rateCardName: string
  carrierId: number | null
  rateType: string
  serviceType: string
  validFrom: string
  validUntil: string
  currency: string
  status: string
  remark: string
}

// ==================== 常量定义 ====================

const RATE_TYPES = [
  { value: 'last_mile', label: '最后里程' },
  { value: 'freight', label: '运费' },
  { value: 'clearance', label: '清关' },
  { value: 'other', label: '其他' }
]

const SERVICE_TYPES = [
  { value: 'standard', label: '标准服务' },
  { value: 'express', label: '加急服务' },
  { value: 'economy', label: '经济服务' }
]

const RATE_STATUS = [
  { value: 'active', label: '有效', color: 'bg-green-100 text-green-700' },
  { value: 'inactive', label: '停用', color: 'bg-gray-100 text-gray-500' },
  { value: 'expired', label: '已过期', color: 'bg-red-100 text-red-700' }
]

const initialFormData: RateCardFormData = {
  rateCardName: '',
  carrierId: null,
  rateType: 'last_mile',
  serviceType: 'standard',
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
  currency: 'EUR',
  status: 'active',
  remark: ''
}

// ==================== 主组件 ====================

export default function LastMileRates() {
  // 状态
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // 搜索筛选
  const [searchText, setSearchText] = useState('')
  const [filterCarrierId, setFilterCarrierId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // 模态框
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [currentRateCard, setCurrentRateCard] = useState<RateCard | null>(null)
  const [formData, setFormData] = useState<RateCardFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  
  // 费率明细模态框
  const [showTiersModal, setShowTiersModal] = useState(false)
  const [currentTiers, setCurrentTiers] = useState<RateTier[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loadingTiers, setLoadingTiers] = useState(false)
  const [editingTiers, setEditingTiers] = useState(false)
  const [tiersFormData, setTiersFormData] = useState<any[]>([])

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

  // 获取费率卡列表
  const fetchRateCards = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (searchText) params.append('search', searchText)
      if (filterCarrierId) params.append('carrierId', filterCarrierId)
      if (filterStatus) params.append('status', filterStatus)
      
      const res = await fetch(`${API_BASE}/api/last-mile/rate-cards?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setRateCards(data.data.list)
        setTotal(data.data.total)
      }
    } catch (error) {
      console.error('获取费率卡列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCarriers()
  }, [])

  useEffect(() => {
    fetchRateCards()
  }, [page, pageSize, searchText, filterCarrierId, filterStatus])

  // 打开创建模态框
  const handleCreate = () => {
    setModalMode('create')
    setCurrentRateCard(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  // 打开编辑模态框
  const handleEdit = (rateCard: RateCard) => {
    setModalMode('edit')
    setCurrentRateCard(rateCard)
    setFormData({
      rateCardName: rateCard.rateCardName,
      carrierId: rateCard.carrierId,
      rateType: rateCard.rateType,
      serviceType: rateCard.serviceType,
      validFrom: rateCard.validFrom,
      validUntil: rateCard.validUntil || '',
      currency: rateCard.currency,
      status: rateCard.status,
      remark: ''
    })
    setShowModal(true)
  }

  // 保存费率卡
  const handleSave = async () => {
    if (!formData.rateCardName || !formData.carrierId) {
      alert('请填写费率卡名称并选择承运商')
      return
    }
    
    setSaving(true)
    try {
      const url = modalMode === 'create' 
        ? `${API_BASE}/api/last-mile/rate-cards`
        : `${API_BASE}/api/last-mile/rate-cards/${currentRateCard?.id}`
      
      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setShowModal(false)
        fetchRateCards()
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

  // 删除费率卡
  const handleDelete = async (rateCard: RateCard) => {
    if (!confirm(`确定要删除费率卡 "${rateCard.rateCardName}" 吗？`)) {
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/rate-cards/${rateCard.id}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchRateCards()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  // 查看/编辑费率明细
  const handleViewTiers = async (rateCard: RateCard) => {
    setCurrentRateCard(rateCard)
    setLoadingTiers(true)
    setShowTiersModal(true)
    setEditingTiers(false)
    
    try {
      // 获取费率卡详情（包含明细）
      const [rateRes, zonesRes] = await Promise.all([
        fetch(`${API_BASE}/api/last-mile/rate-cards/${rateCard.id}`),
        fetch(`${API_BASE}/api/last-mile/carriers/${rateCard.carrierId}/zones`)
      ])
      
      const rateData = await rateRes.json()
      const zonesData = await zonesRes.json()
      
      if (rateData.errCode === 200) {
        setCurrentTiers(rateData.data.tiers || [])
      }
      
      if (zonesData.errCode === 200) {
        setZones(zonesData.data)
      }
    } catch (error) {
      console.error('获取费率明细失败:', error)
    } finally {
      setLoadingTiers(false)
    }
  }

  // 开始编辑费率
  const handleStartEditTiers = () => {
    // 将当前数据转为可编辑格式
    const editData: any[] = []
    zones.forEach(zone => {
      const zoneTiers = currentTiers.filter(t => t.zoneCode === zone.zoneCode)
      if (zoneTiers.length === 0) {
        // 添加默认重量段
        editData.push({
          zoneCode: zone.zoneCode,
          zoneName: zone.zoneName,
          weightFrom: 0,
          weightTo: 5,
          purchasePrice: '',
          salesPrice: ''
        })
      } else {
        zoneTiers.forEach(tier => {
          editData.push({
            id: tier.id,
            zoneCode: tier.zoneCode,
            zoneName: zone.zoneName,
            weightFrom: tier.weightFrom,
            weightTo: tier.weightTo,
            purchasePrice: tier.purchasePrice ?? '',
            salesPrice: tier.salesPrice ?? ''
          })
        })
      }
    })
    setTiersFormData(editData)
    setEditingTiers(true)
  }

  // 添加重量段
  const handleAddTier = (zoneCode: string, zoneName: string) => {
    const zoneTiers = tiersFormData.filter(t => t.zoneCode === zoneCode)
    const lastTier = zoneTiers[zoneTiers.length - 1]
    const newWeightFrom = lastTier ? lastTier.weightTo : 0
    
    setTiersFormData([
      ...tiersFormData,
      {
        zoneCode,
        zoneName,
        weightFrom: newWeightFrom,
        weightTo: newWeightFrom + 5,
        purchasePrice: '',
        salesPrice: ''
      }
    ])
  }

  // 删除重量段
  const handleRemoveTier = (index: number) => {
    setTiersFormData(tiersFormData.filter((_, i) => i !== index))
  }

  // 更新费率数据
  const handleTierChange = (index: number, field: string, value: any) => {
    const newData = [...tiersFormData]
    newData[index] = { ...newData[index], [field]: value }
    setTiersFormData(newData)
  }

  // 保存费率明细
  const handleSaveTiers = async () => {
    if (!currentRateCard) return
    
    setSaving(true)
    try {
      // 构建要保存的数据
      const tiers = tiersFormData.map(t => ({
        zoneCode: t.zoneCode,
        weightFrom: parseFloat(t.weightFrom) || 0,
        weightTo: parseFloat(t.weightTo) || 0,
        purchasePrice: t.purchasePrice === '' ? null : parseFloat(t.purchasePrice),
        salesPrice: t.salesPrice === '' ? null : parseFloat(t.salesPrice),
        priceUnit: 'per_kg'
      }))
      
      const res = await fetch(`${API_BASE}/api/last-mile/rate-cards/${currentRateCard.id}/tiers/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers, clearExisting: true })
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setEditingTiers(false)
        // 重新加载数据
        handleViewTiers(currentRateCard)
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

  // 按Zone分组显示费率
  const getTiersByZone = () => {
    const grouped: { [key: string]: RateTier[] } = {}
    currentTiers.forEach(tier => {
      const zone = tier.zoneCode || 'default'
      if (!grouped[zone]) {
        grouped[zone] = []
      }
      grouped[zone].push(tier)
    })
    return grouped
  }

  // 表格列定义
  const columns: Column<RateCard>[] = [
    {
      key: 'rateCardCode',
      title: '费率卡编码',
      width: 160,
      sorter: true,
      render: (_, record) => (
        <span className="font-mono text-blue-600">{record.rateCardCode}</span>
      )
    },
    {
      key: 'rateCardName',
      title: '费率卡名称',
      width: 200,
      sorter: true,
      filterable: true,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.rateCardName}</div>
          {record.isDefault && (
            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">默认</span>
          )}
        </div>
      )
    },
    {
      key: 'carrier',
      title: '承运商',
      width: 120,
      sorter: true,
      filterable: true,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.carrierCode}</div>
          <div className="text-xs text-gray-500">{record.carrierName}</div>
        </div>
      )
    },
    {
      key: 'serviceType',
      title: '服务类型',
      width: 100,
      sorter: true,
      filters: [
        { text: '标准服务', value: 'standard' },
        { text: '快速服务', value: 'express' },
        { text: '经济服务', value: 'economy' },
      ],
      onFilter: (value, record) => record.serviceType === value,
      render: (_, record) => {
        const type = SERVICE_TYPES.find(t => t.value === record.serviceType)
        return <span>{type?.label || record.serviceType}</span>
      }
    },
    {
      key: 'validity',
      title: '有效期',
      width: 180,
      sorter: (a, b) => {
        const dateA = a.validFrom ? new Date(a.validFrom).getTime() : 0
        const dateB = b.validFrom ? new Date(b.validFrom).getTime() : 0
        return dateA - dateB
      },
      render: (_, record) => (
        <div className="text-sm">
          <div>{record.validFrom}</div>
          <div className="text-gray-500">至 {record.validUntil || '长期'}</div>
        </div>
      )
    },
    {
      key: 'currency',
      title: '币种',
      width: 80,
      align: 'center',
      sorter: true,
      render: (_, record) => (
        <span className="px-2 py-0.5 bg-gray-100 rounded text-sm">{record.currency}</span>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: 80,
      sorter: true,
      filters: [
        { text: '启用', value: 'active' },
        { text: '停用', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
      align: 'center',
      render: (_, record) => {
        const status = RATE_STATUS.find(s => s.value === record.status)
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${status?.color || 'bg-gray-100'}`}>
            {status?.label || record.status}
          </span>
        )
      }
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewTiers(record)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="费率明细"
          >
            <DollarSign className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEdit(record)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>
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

  const tiersByZone = getTiersByZone()

  return (
    <div className="space-y-4">
      <PageHeader
        title="费率卡管理"
        description="管理各承运商的费率配置，支持按Zone和重量段设置价格"
      />

      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索费率卡编码/名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 承运商筛选 */}
          <select
            value={filterCarrierId}
            onChange={(e) => setFilterCarrierId(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部承运商</option>
            {carriers.map(carrier => (
              <option key={carrier.id} value={carrier.id}>{carrier.carrierCode} - {carrier.carrierName}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            {RATE_STATUS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          {/* 刷新按钮 */}
          <button
            onClick={fetchRateCards}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="刷新"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* 新建按钮 */}
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            新建费率卡
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow">
        <DataTable<RateCard>
          columns={columns}
          data={rateCards}
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

      {/* 新建/编辑费率卡模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                {modalMode === 'create' ? '新建费率卡' : '编辑费率卡'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  费率卡名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rateCardName}
                  onChange={(e) => setFormData({ ...formData, rateCardName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="如: DHL德国标准费率2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  承运商 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.carrierId || ''}
                  onChange={(e) => setFormData({ ...formData, carrierId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择承运商</option>
                  {carriers.map(carrier => (
                    <option key={carrier.id} value={carrier.id}>{carrier.carrierCode} - {carrier.carrierName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    费率类型
                  </label>
                  <select
                    value={formData.rateType}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {RATE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    服务类型
                  </label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    生效日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    失效日期
                  </label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    币种
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EUR">EUR - 欧元</option>
                    <option value="USD">USD - 美元</option>
                    <option value="CNY">CNY - 人民币</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    状态
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {RATE_STATUS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
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
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 费率明细模态框 */}
      {showTiersModal && currentRateCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-medium">
                  费率明细 - {currentRateCard.rateCardName}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {currentRateCard.carrierCode} · {currentRateCard.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!editingTiers && (
                  <button
                    onClick={handleStartEditTiers}
                    className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                    编辑费率
                  </button>
                )}
                <button onClick={() => setShowTiersModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {loadingTiers ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : editingTiers ? (
                // 编辑模式
                <div className="space-y-6">
                  {zones.map(zone => (
                    <div key={zone.zoneCode} className="border rounded-lg">
                      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono font-medium">
                            {zone.zoneCode}
                          </span>
                          <span className="font-medium">{zone.zoneName}</span>
                        </div>
                        <button
                          onClick={() => handleAddTier(zone.zoneCode, zone.zoneName || zone.zoneCode)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          + 添加重量段
                        </button>
                      </div>
                      <div className="p-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-2 w-32">重量范围(kg)</th>
                              <th className="text-right py-2 w-32">采购价</th>
                              <th className="text-right py-2 w-32">销售价</th>
                              <th className="text-right py-2 w-32">利润</th>
                              <th className="text-center py-2 w-16">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tiersFormData
                              .filter(t => t.zoneCode === zone.zoneCode)
                              .map((tier, idx) => {
                                const globalIdx = tiersFormData.indexOf(tier)
                                const profit = tier.purchasePrice && tier.salesPrice 
                                  ? (parseFloat(tier.salesPrice) - parseFloat(tier.purchasePrice)).toFixed(2)
                                  : '-'
                                return (
                                  <tr key={globalIdx} className="border-b last:border-0">
                                    <td className="py-2">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={tier.weightFrom}
                                          onChange={(e) => handleTierChange(globalIdx, 'weightFrom', e.target.value)}
                                          className="w-14 px-2 py-1 border rounded text-center"
                                          min={0}
                                          step={0.5}
                                        />
                                        <span>-</span>
                                        <input
                                          type="number"
                                          value={tier.weightTo}
                                          onChange={(e) => handleTierChange(globalIdx, 'weightTo', e.target.value)}
                                          className="w-14 px-2 py-1 border rounded text-center"
                                          min={0}
                                          step={0.5}
                                        />
                                      </div>
                                    </td>
                                    <td className="py-2 text-right">
                                      <input
                                        type="number"
                                        value={tier.purchasePrice}
                                        onChange={(e) => handleTierChange(globalIdx, 'purchasePrice', e.target.value)}
                                        className="w-24 px-2 py-1 border rounded text-right"
                                        min={0}
                                        step={0.01}
                                        placeholder="采购价"
                                      />
                                    </td>
                                    <td className="py-2 text-right">
                                      <input
                                        type="number"
                                        value={tier.salesPrice}
                                        onChange={(e) => handleTierChange(globalIdx, 'salesPrice', e.target.value)}
                                        className="w-24 px-2 py-1 border rounded text-right"
                                        min={0}
                                        step={0.01}
                                        placeholder="销售价"
                                      />
                                    </td>
                                    <td className="py-2 text-right">
                                      <span className={`${parseFloat(profit) > 0 ? 'text-green-600' : parseFloat(profit) < 0 ? 'text-red-600' : ''}`}>
                                        {profit}
                                      </span>
                                    </td>
                                    <td className="py-2 text-center">
                                      <button
                                        onClick={() => handleRemoveTier(globalIdx)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                        {tiersFormData.filter(t => t.zoneCode === zone.zoneCode).length === 0 && (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            暂无重量段，点击上方"添加重量段"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {zones.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      请先为该承运商配置Zone区域
                    </div>
                  )}
                </div>
              ) : (
                // 查看模式
                <div className="space-y-4">
                  {Object.entries(tiersByZone).map(([zoneCode, tiers]) => (
                    <div key={zoneCode} className="border rounded-lg">
                      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono font-medium">
                          {zoneCode}
                        </span>
                        <span className="text-gray-600">{tiers.length} 个重量段</span>
                      </div>
                      <div className="p-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-2">重量范围</th>
                              <th className="text-right py-2">采购价</th>
                              <th className="text-right py-2">销售价</th>
                              <th className="text-right py-2">利润</th>
                              <th className="text-right py-2">利润率</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tiers.map(tier => {
                              const profit = (tier.salesPrice ?? 0) - (tier.purchasePrice ?? 0)
                              const profitRate = tier.purchasePrice && tier.purchasePrice > 0
                                ? (profit / tier.purchasePrice * 100).toFixed(1)
                                : '-'
                              return (
                                <tr key={tier.id} className="border-b last:border-0">
                                  <td className="py-2">{tier.weightFrom} - {tier.weightTo} kg</td>
                                  <td className="py-2 text-right font-mono">
                                    {tier.purchasePrice?.toFixed(2) ?? '-'}
                                  </td>
                                  <td className="py-2 text-right font-mono">
                                    {tier.salesPrice?.toFixed(2) ?? '-'}
                                  </td>
                                  <td className="py-2 text-right font-mono">
                                    <span className={profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : ''}>
                                      {profit.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right">
                                    {profitRate !== '-' && <span>{profitRate}%</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {Object.keys(tiersByZone).length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>暂未配置费率明细</p>
                      <p className="text-sm mt-1">点击"编辑费率"按钮添加</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              {editingTiers ? (
                <>
                  <button
                    onClick={() => setEditingTiers(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveTiers}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        保存费率
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowTiersModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                >
                  关闭
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
