import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit, Trash2, Check, X, 
  Truck, Package, Globe, Phone, Mail, Settings,
  RefreshCw, MapPin, Link
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
  carrierNameEn: string
  carrierType: string
  countryCode: string
  serviceRegion: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  website: string
  apiEnabled: boolean
  apiConfig: any
  status: string
  remark: string
  createdAt: string
  updatedAt: string
  zones?: Zone[]
}

interface Zone {
  id: number
  carrierId: number
  zoneCode: string
  zoneName: string
  countries: string[]
  postalPrefixes: string[]
  cities: string[]
  description: string
  sortOrder: number
}

interface CarrierFormData {
  carrierCode: string
  carrierName: string
  carrierNameEn: string
  carrierType: string
  countryCode: string
  serviceRegion: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  website: string
  apiEnabled: boolean
  status: string
  remark: string
}

// ==================== 常量定义 ====================

const CARRIER_TYPES = [
  { value: 'express', label: '快递公司', icon: Package },
  { value: 'trucking', label: '卡车运输', icon: Truck }
]

const CARRIER_STATUS = [
  { value: 'active', label: '启用', color: 'bg-green-100 text-green-700' },
  { value: 'inactive', label: '停用', color: 'bg-gray-100 text-gray-500' }
]

const COUNTRIES = [
  { value: 'DE', label: '德国' },
  { value: 'FR', label: '法国' },
  { value: 'NL', label: '荷兰' },
  { value: 'BE', label: '比利时' },
  { value: 'AT', label: '奥地利' },
  { value: 'PL', label: '波兰' },
  { value: 'IT', label: '意大利' },
  { value: 'ES', label: '西班牙' },
  { value: 'GB', label: '英国' },
  { value: 'US', label: '美国' }
]

const initialFormData: CarrierFormData = {
  carrierCode: '',
  carrierName: '',
  carrierNameEn: '',
  carrierType: 'express',
  countryCode: 'DE',
  serviceRegion: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  website: '',
  apiEnabled: false,
  status: 'active',
  remark: ''
}

// ==================== 主组件 ====================

export default function LastMileCarriers() {
  // 状态
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // 搜索筛选
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // 模态框
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [currentCarrier, setCurrentCarrier] = useState<Carrier | null>(null)
  const [formData, setFormData] = useState<CarrierFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  
  // Zone模态框
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [loadingZones, setLoadingZones] = useState(false)

  // 获取承运商列表
  const fetchCarriers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (searchText) params.append('search', searchText)
      if (filterType) params.append('type', filterType)
      if (filterStatus) params.append('status', filterStatus)
      
      const res = await fetch(`${API_BASE}/api/last-mile/carriers?${params}`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setCarriers(data.data.list)
        setTotal(data.data.total)
      }
    } catch (error) {
      console.error('获取承运商列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCarriers()
  }, [page, pageSize, searchText, filterType, filterStatus])

  // 打开创建模态框
  const handleCreate = () => {
    setModalMode('create')
    setCurrentCarrier(null)
    setFormData(initialFormData)
    setShowModal(true)
  }

  // 打开编辑模态框
  const handleEdit = (carrier: Carrier) => {
    setModalMode('edit')
    setCurrentCarrier(carrier)
    setFormData({
      carrierCode: carrier.carrierCode,
      carrierName: carrier.carrierName,
      carrierNameEn: carrier.carrierNameEn || '',
      carrierType: carrier.carrierType,
      countryCode: carrier.countryCode || 'DE',
      serviceRegion: carrier.serviceRegion || '',
      contactPerson: carrier.contactPerson || '',
      contactPhone: carrier.contactPhone || '',
      contactEmail: carrier.contactEmail || '',
      website: carrier.website || '',
      apiEnabled: carrier.apiEnabled,
      status: carrier.status,
      remark: carrier.remark || ''
    })
    setShowModal(true)
  }

  // 保存承运商
  const handleSave = async () => {
    if (!formData.carrierCode || !formData.carrierName) {
      alert('请填写承运商编码和名称')
      return
    }
    
    setSaving(true)
    try {
      const url = modalMode === 'create' 
        ? `${API_BASE}/api/last-mile/carriers`
        : `${API_BASE}/api/last-mile/carriers/${currentCarrier?.id}`
      
      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setShowModal(false)
        fetchCarriers()
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

  // 删除承运商
  const handleDelete = async (carrier: Carrier) => {
    if (!confirm(`确定要删除承运商 "${carrier.carrierName}" 吗？`)) {
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers/${carrier.id}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        fetchCarriers()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  // 查看Zone配置
  const handleViewZones = async (carrier: Carrier) => {
    setCurrentCarrier(carrier)
    setLoadingZones(true)
    setShowZoneModal(true)
    
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers/${carrier.id}/zones`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setZones(data.data)
      }
    } catch (error) {
      console.error('获取Zone列表失败:', error)
    } finally {
      setLoadingZones(false)
    }
  }

  // 表格列定义
  const columns: Column<Carrier>[] = [
    {
      key: 'carrierCode',
      title: '承运商编码',
      width: 120,
      render: (_, record) => (
        <span className="font-mono font-medium text-blue-600">{record.carrierCode}</span>
      )
    },
    {
      key: 'carrierName',
      title: '承运商名称',
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.carrierName}</div>
          {record.carrierNameEn && (
            <div className="text-xs text-gray-500">{record.carrierNameEn}</div>
          )}
        </div>
      )
    },
    {
      key: 'carrierType',
      title: '类型',
      width: 100,
      render: (_, record) => {
        const type = CARRIER_TYPES.find(t => t.value === record.carrierType)
        const Icon = type?.icon || Package
        return (
          <div className="flex items-center gap-1">
            <Icon className="w-4 h-4 text-gray-500" />
            <span>{type?.label || record.carrierType}</span>
          </div>
        )
      }
    },
    {
      key: 'countryCode',
      title: '服务国家',
      width: 100,
      render: (_, record) => {
        const country = COUNTRIES.find(c => c.value === record.countryCode)
        return (
          <div className="flex items-center gap-1">
            <Globe className="w-4 h-4 text-gray-400" />
            <span>{country?.label || record.countryCode}</span>
          </div>
        )
      }
    },
    {
      key: 'contact',
      title: '联系人',
      width: 150,
      render: (_, record) => (
        <div className="text-sm">
          {record.contactPerson && (
            <div className="flex items-center gap-1">
              <span>{record.contactPerson}</span>
            </div>
          )}
          {record.contactPhone && (
            <div className="text-gray-500 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {record.contactPhone}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'apiEnabled',
      title: 'API对接',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center">
          {record.apiEnabled ? (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">
              <Link className="w-3 h-3" />
              已启用
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">未启用</span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      title: '状态',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const status = CARRIER_STATUS.find(s => s.value === record.status)
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
            onClick={() => handleViewZones(record)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="Zone配置"
          >
            <MapPin className="w-4 h-4" />
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="最后里程承运商"
        description="管理海外快递和卡车公司，配置Zone和费率"
      />

      {/* 工具栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索承运商编码/名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 类型筛选 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部类型</option>
            {CARRIER_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            {CARRIER_STATUS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>

          {/* 刷新按钮 */}
          <button
            onClick={fetchCarriers}
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
            新建承运商
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          dataSource={carriers}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            }
          }}
        />
      </div>

      {/* 新建/编辑模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                {modalMode === 'create' ? '新建承运商' : '编辑承运商'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    承运商编码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.carrierCode}
                    onChange={(e) => setFormData({ ...formData, carrierCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="如: DHL, DPD"
                    disabled={modalMode === 'edit'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    承运商类型
                  </label>
                  <select
                    value={formData.carrierType}
                    onChange={(e) => setFormData({ ...formData, carrierType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CARRIER_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    中文名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.carrierName}
                    onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="如: DHL快递"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    英文名称
                  </label>
                  <input
                    type="text"
                    value={formData.carrierNameEn}
                    onChange={(e) => setFormData({ ...formData, carrierNameEn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="如: DHL Express"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    服务国家
                  </label>
                  <select
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {COUNTRIES.map(country => (
                      <option key={country.value} value={country.value}>{country.label}</option>
                    ))}
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
                    {CARRIER_STATUS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  服务区域描述
                </label>
                <input
                  type="text"
                  value={formData.serviceRegion}
                  onChange={(e) => setFormData({ ...formData, serviceRegion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="如: 德国全境、欧盟区域"
                />
              </div>

              {/* 联系信息 */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">联系信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      联系人
                    </label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      联系电话
                    </label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      邮箱
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      官网
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="https://"
                    />
                  </div>
                </div>
              </div>

              {/* API配置 */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="apiEnabled"
                    checked={formData.apiEnabled}
                    onChange={(e) => setFormData({ ...formData, apiEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="apiEnabled" className="text-sm font-medium text-gray-700">
                    启用API对接（用于打单/轨迹查询）
                  </label>
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
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

      {/* Zone配置模态框 */}
      {showZoneModal && currentCarrier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                Zone配置 - {currentCarrier.carrierName}
              </h3>
              <button onClick={() => setShowZoneModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {loadingZones ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : zones.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>暂未配置Zone区域</p>
                  <p className="text-sm mt-1">请前往Zone配置页面添加</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {zones.map(zone => (
                    <div key={zone.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono font-medium">
                            {zone.zoneCode}
                          </span>
                          <span className="font-medium">{zone.zoneName}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {zone.countries && zone.countries.length > 0 && (
                          <div>
                            <span className="text-gray-500">国家: </span>
                            {zone.countries.join(', ')}
                          </div>
                        )}
                        {zone.postalPrefixes && zone.postalPrefixes.length > 0 && (
                          <div>
                            <span className="text-gray-500">邮编前缀: </span>
                            {zone.postalPrefixes.slice(0, 10).join(', ')}
                            {zone.postalPrefixes.length > 10 && ` 等${zone.postalPrefixes.length}个`}
                          </div>
                        )}
                        {zone.description && (
                          <div className="text-gray-500">{zone.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowZoneModal(false)}
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
