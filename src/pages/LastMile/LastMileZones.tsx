import { useState, useEffect } from 'react'
import { 
  Plus, Search, Edit, Trash2, Check, X, 
  MapPin, Globe, RefreshCw, ChevronDown, ChevronRight
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api'

const API_BASE = getApiBaseUrl()

// ==================== 类型定义 ====================

interface Carrier {
  id: number
  carrierCode: string
  carrierName: string
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
  createdAt: string
}

interface ZoneFormData {
  zoneCode: string
  zoneName: string
  countries: string
  postalPrefixes: string
  cities: string
  description: string
  sortOrder: number
}

// ==================== 常量定义 ====================

const EU_COUNTRIES = [
  { code: 'DE', name: '德国' },
  { code: 'FR', name: '法国' },
  { code: 'NL', name: '荷兰' },
  { code: 'BE', name: '比利时' },
  { code: 'AT', name: '奥地利' },
  { code: 'PL', name: '波兰' },
  { code: 'CZ', name: '捷克' },
  { code: 'IT', name: '意大利' },
  { code: 'ES', name: '西班牙' },
  { code: 'PT', name: '葡萄牙' },
  { code: 'DK', name: '丹麦' },
  { code: 'SE', name: '瑞典' },
  { code: 'FI', name: '芬兰' },
  { code: 'IE', name: '爱尔兰' },
  { code: 'GR', name: '希腊' },
  { code: 'HU', name: '匈牙利' },
  { code: 'RO', name: '罗马尼亚' },
  { code: 'SK', name: '斯洛伐克' },
  { code: 'SI', name: '斯洛文尼亚' },
  { code: 'LU', name: '卢森堡' },
  { code: 'GB', name: '英国' },
  { code: 'CH', name: '瑞士' },
  { code: 'NO', name: '挪威' }
]

const initialFormData: ZoneFormData = {
  zoneCode: '',
  zoneName: '',
  countries: '',
  postalPrefixes: '',
  cities: '',
  description: '',
  sortOrder: 0
}

// ==================== 主组件 ====================

export default function LastMileZones() {
  // 状态
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [selectedCarrierId, setSelectedCarrierId] = useState<number | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCarriers, setLoadingCarriers] = useState(false)
  
  // 展开状态
  const [expandedCarriers, setExpandedCarriers] = useState<Set<number>>(new Set())
  
  // 模态框
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [currentZone, setCurrentZone] = useState<Zone | null>(null)
  const [formData, setFormData] = useState<ZoneFormData>(initialFormData)
  const [saving, setSaving] = useState(false)

  // 获取承运商列表
  const fetchCarriers = async () => {
    setLoadingCarriers(true)
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers?status=active&pageSize=100`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setCarriers(data.data.list)
        // 默认选中第一个
        if (data.data.list.length > 0 && !selectedCarrierId) {
          setSelectedCarrierId(data.data.list[0].id)
        }
      }
    } catch (error) {
      console.error('获取承运商列表失败:', error)
    } finally {
      setLoadingCarriers(false)
    }
  }

  // 获取Zone列表
  const fetchZones = async (carrierId: number) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers/${carrierId}/zones`)
      const data = await res.json()
      
      if (data.errCode === 200) {
        setZones(data.data)
      }
    } catch (error) {
      console.error('获取Zone列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCarriers()
  }, [])

  useEffect(() => {
    if (selectedCarrierId) {
      fetchZones(selectedCarrierId)
    }
  }, [selectedCarrierId])

  // 切换承运商展开状态
  const toggleCarrierExpand = (carrierId: number) => {
    const newExpanded = new Set(expandedCarriers)
    if (newExpanded.has(carrierId)) {
      newExpanded.delete(carrierId)
    } else {
      newExpanded.add(carrierId)
    }
    setExpandedCarriers(newExpanded)
  }

  // 打开创建模态框
  const handleCreate = () => {
    if (!selectedCarrierId) {
      alert('请先选择承运商')
      return
    }
    setModalMode('create')
    setCurrentZone(null)
    setFormData({
      ...initialFormData,
      sortOrder: zones.length
    })
    setShowModal(true)
  }

  // 打开编辑模态框
  const handleEdit = (zone: Zone) => {
    setModalMode('edit')
    setCurrentZone(zone)
    setFormData({
      zoneCode: zone.zoneCode,
      zoneName: zone.zoneName || '',
      countries: zone.countries?.join(', ') || '',
      postalPrefixes: zone.postalPrefixes?.join(', ') || '',
      cities: zone.cities?.join(', ') || '',
      description: zone.description || '',
      sortOrder: zone.sortOrder || 0
    })
    setShowModal(true)
  }

  // 保存Zone
  const handleSave = async () => {
    if (!formData.zoneCode) {
      alert('请填写Zone编码')
      return
    }
    
    setSaving(true)
    try {
      // 处理数组字段
      const payload = {
        ...formData,
        countries: formData.countries ? formData.countries.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        postalPrefixes: formData.postalPrefixes ? formData.postalPrefixes.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        cities: formData.cities ? formData.cities.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
      }
      
      const url = modalMode === 'create' 
        ? `${API_BASE}/api/last-mile/carriers/${selectedCarrierId}/zones`
        : `${API_BASE}/api/last-mile/zones/${currentZone?.id}`
      
      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setShowModal(false)
        if (selectedCarrierId) {
          fetchZones(selectedCarrierId)
        }
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

  // 删除Zone
  const handleDelete = async (zone: Zone) => {
    if (!confirm(`确定要删除Zone "${zone.zoneCode}" 吗？`)) {
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/zones/${zone.id}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        if (selectedCarrierId) {
          fetchZones(selectedCarrierId)
        }
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  const selectedCarrier = carriers.find(c => c.id === selectedCarrierId)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zone区域配置"
        description="配置各承运商的服务区域划分，用于费率计算"
      />

      <div className="flex gap-4">
        {/* 左侧承运商列表 */}
        <div className="w-64 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-medium">承运商列表</h3>
          </div>
          <div className="p-2">
            {loadingCarriers ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : carriers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                暂无承运商
              </div>
            ) : (
              <div className="space-y-1">
                {carriers.map(carrier => (
                  <button
                    key={carrier.id}
                    onClick={() => setSelectedCarrierId(carrier.id)}
                    className={`w-full px-3 py-2 text-left rounded-lg flex items-center gap-2 transition-colors ${
                      selectedCarrierId === carrier.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{carrier.carrierCode}</div>
                      <div className="text-xs text-gray-500 truncate">{carrier.carrierName}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧Zone配置 */}
        <div className="flex-1 bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-medium">
                {selectedCarrier ? `${selectedCarrier.carrierCode} - Zone配置` : 'Zone配置'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                共 {zones.length} 个Zone区域
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectedCarrierId && fetchZones(selectedCarrierId)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="刷新"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedCarrierId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                新建Zone
              </button>
            </div>
          </div>

          <div className="p-4">
            {!selectedCarrierId ? (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>请从左侧选择一个承运商</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : zones.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂未配置Zone区域</p>
                <p className="text-sm mt-1">点击上方"新建Zone"按钮添加</p>
              </div>
            ) : (
              <div className="space-y-3">
                {zones.map(zone => (
                  <div key={zone.id} className="border rounded-lg p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-mono font-bold text-lg">
                          {zone.zoneCode}
                        </span>
                        <div>
                          <div className="font-medium">{zone.zoneName || zone.zoneCode}</div>
                          {zone.description && (
                            <div className="text-sm text-gray-500 mt-0.5">{zone.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(zone)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(zone)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-2 text-sm">
                      {zone.countries && zone.countries.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Globe className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-500">国家: </span>
                            <span className="text-gray-700">
                              {zone.countries.map(code => {
                                const country = EU_COUNTRIES.find(c => c.code === code)
                                return country ? country.name : code
                              }).join('、')}
                            </span>
                          </div>
                        </div>
                      )}
                      {zone.postalPrefixes && zone.postalPrefixes.length > 0 && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-500">邮编前缀: </span>
                            <span className="font-mono text-gray-700">
                              {zone.postalPrefixes.slice(0, 15).join(', ')}
                              {zone.postalPrefixes.length > 15 && (
                                <span className="text-gray-500"> ...等{zone.postalPrefixes.length}个</span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新建/编辑模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                {modalMode === 'create' ? '新建Zone' : '编辑Zone'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zone编码 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.zoneCode}
                    onChange={(e) => setFormData({ ...formData, zoneCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="如: Zone1, Zone2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zone名称
                  </label>
                  <input
                    type="text"
                    value={formData.zoneName}
                    onChange={(e) => setFormData({ ...formData, zoneName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="如: 德国本土"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  包含国家
                </label>
                <input
                  type="text"
                  value={formData.countries}
                  onChange={(e) => setFormData({ ...formData, countries: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="国家代码，逗号分隔，如: DE, AT, NL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  常用: DE(德国), FR(法国), NL(荷兰), BE(比利时), AT(奥地利), PL(波兰)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮编前缀
                </label>
                <textarea
                  value={formData.postalPrefixes}
                  onChange={(e) => setFormData({ ...formData, postalPrefixes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="邮编前缀，逗号分隔，如: 10, 12, 13, 14"
                />
                <p className="text-xs text-gray-500 mt-1">
                  用于根据收件人邮编自动匹配Zone
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  包含城市
                </label>
                <input
                  type="text"
                  value={formData.cities}
                  onChange={(e) => setFormData({ ...formData, cities: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="城市名称，逗号分隔"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Zone区域说明"
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
    </div>
  )
}
