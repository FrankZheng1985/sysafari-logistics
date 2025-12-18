import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Plus, Search, Edit2, Trash2, Building2, DollarSign,
  Languages, Loader2, ArrowLeft, Filter, CheckCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Supplier {
  id: string
  supplierCode: string
  supplierName: string
  status: string
}

interface SupplierPrice {
  id: number
  supplierId: string
  category: string
  name: string
  nameEn: string
  unit: string
  unitPrice: number
  currency: string
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  notes: string
}

const CATEGORY_OPTIONS = [
  '运输服务',
  '港口服务',
  '报关服务',
  '仓储服务',
  '文件费',
  '管理费',
  '其他服务'
]

const CURRENCIES = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'CNY', label: 'CNY' }
]

export default function SupplierPrices() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const supplierId = searchParams.get('supplierId') || ''
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [prices, setPrices] = useState<SupplierPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(false)
  
  // 筛选
  const [searchValue, setSearchValue] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive, setFilterActive] = useState<string>('')
  
  // 编辑弹窗
  const [modalVisible, setModalVisible] = useState(false)
  const [editingPrice, setEditingPrice] = useState<SupplierPrice | null>(null)
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  
  const [formData, setFormData] = useState({
    category: '',
    name: '',
    nameEn: '',
    unit: '次',
    unitPrice: 0,
    currency: 'EUR',
    validFrom: '',
    validUntil: '',
    isActive: true,
    notes: ''
  })

  const tabs = [
    { key: 'dashboard', label: '供应商概览', path: '/suppliers' },
    { key: 'manage', label: '供应商管理', path: '/suppliers/manage' },
    { key: 'prices', label: '采购价管理', path: '/suppliers/prices' }
  ]

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (supplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === supplierId)
      if (supplier) {
        setSelectedSupplier(supplier)
        loadPrices(supplierId)
      }
    }
  }, [supplierId, suppliers])

  const loadSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/active`)
      const data = await res.json()
      if (data.errCode === 200) {
        setSuppliers(data.data || [])
      }
    } catch (error) {
      console.error('加载供应商失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPrices = async (id: string) => {
    setLoadingPrices(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.append('category', filterCategory)
      if (filterActive) params.append('isActive', filterActive)
      
      const res = await fetch(`${API_BASE}/api/suppliers/${id}/prices?${params}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setPrices(data.data || [])
      }
    } catch (error) {
      console.error('加载采购价失败:', error)
    } finally {
      setLoadingPrices(false)
    }
  }

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    navigate(`/suppliers/prices?supplierId=${supplier.id}`, { replace: true })
    loadPrices(supplier.id)
  }

  const handleOpenModal = (price?: SupplierPrice) => {
    if (price) {
      setEditingPrice(price)
      setFormData({
        category: price.category,
        name: price.name,
        nameEn: price.nameEn || '',
        unit: price.unit || '次',
        unitPrice: price.unitPrice,
        currency: price.currency || 'EUR',
        validFrom: price.validFrom ? price.validFrom.split('T')[0] : '',
        validUntil: price.validUntil ? price.validUntil.split('T')[0] : '',
        isActive: price.isActive,
        notes: price.notes || ''
      })
    } else {
      setEditingPrice(null)
      setFormData({
        category: '',
        name: '',
        nameEn: '',
        unit: '次',
        unitPrice: 0,
        currency: 'EUR',
        validFrom: '',
        validUntil: '',
        isActive: true,
        notes: ''
      })
    }
    setModalVisible(true)
  }

  const handleTranslate = async () => {
    if (!formData.name.trim()) return
    
    setTranslating(true)
    try {
      const res = await fetch(`${API_BASE}/api/translate/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name })
      })
      const data = await res.json()
      if (data.errCode === 200 && data.data?.translated) {
        setFormData({ ...formData, nameEn: data.data.translated })
      }
    } catch (error) {
      console.error('翻译失败:', error)
    } finally {
      setTranslating(false)
    }
  }

  const handleSave = async () => {
    if (!formData.category || !formData.name || formData.unitPrice <= 0) {
      alert('请填写费用类别、名称和单价')
      return
    }
    if (!selectedSupplier) return

    setSaving(true)
    try {
      const url = editingPrice
        ? `${API_BASE}/api/suppliers/${selectedSupplier.id}/prices/${editingPrice.id}`
        : `${API_BASE}/api/suppliers/${selectedSupplier.id}/prices`
      
      const res = await fetch(url, {
        method: editingPrice ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          validFrom: formData.validFrom || null,
          validUntil: formData.validUntil || null
        })
      })

      const data = await res.json()
      if (data.errCode === 200) {
        setModalVisible(false)
        loadPrices(selectedSupplier.id)
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

  const handleDelete = async (price: SupplierPrice) => {
    if (!selectedSupplier) return
    if (!confirm(`确定要删除 "${price.name}" 吗？`)) return

    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${selectedSupplier.id}/prices/${price.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadPrices(selectedSupplier.id)
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败')
    }
  }

  // 过滤采购价列表
  const filteredPrices = prices.filter(price => {
    if (searchValue && !price.name.includes(searchValue) && !price.nameEn?.includes(searchValue)) {
      return false
    }
    return true
  })

  // 按类别分组
  const pricesByCategory = filteredPrices.reduce((acc, price) => {
    const category = price.category || '其他'
    if (!acc[category]) acc[category] = []
    acc[category].push(price)
    return acc
  }, {} as Record<string, SupplierPrice[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="供应商管理"
        tabs={tabs}
        activeTab="prices"
      />

      <div className="p-4">
        <div className="grid grid-cols-4 gap-4">
          {/* 左侧供应商列表 */}
          <div className="col-span-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                选择供应商
              </h3>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">加载中...</div>
              ) : suppliers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">暂无供应商</div>
              ) : (
                <div className="divide-y">
                  {suppliers.map(supplier => (
                    <button
                      key={supplier.id}
                      onClick={() => handleSelectSupplier(supplier)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        selectedSupplier?.id === supplier.id ? 'bg-primary-50 border-l-2 border-primary-600' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900 text-sm">{supplier.supplierName}</div>
                      <div className="text-xs text-gray-500">{supplier.supplierCode}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧采购价列表 */}
          <div className="col-span-3 space-y-4">
            {!selectedSupplier ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">请从左侧选择一个供应商</p>
                <p className="text-sm text-gray-400 mt-1">选择后可查看和管理该供应商的采购价</p>
              </div>
            ) : (
              <>
                {/* 工具栏 */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h2 className="font-medium text-gray-900">
                        {selectedSupplier.supplierName} - 采购价列表
                      </h2>
                      <span className="text-sm text-gray-500">
                        共 {filteredPrices.length} 项
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenModal()}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <Plus className="w-4 h-4" />
                      添加采购价
                    </button>
                  </div>
                  
                  {/* 筛选条件 */}
                  <div className="flex items-center gap-4 mt-4">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        placeholder="搜索费用名称..."
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <select
                      value={filterCategory}
                      onChange={e => {
                        setFilterCategory(e.target.value)
                        if (selectedSupplier) loadPrices(selectedSupplier.id)
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">全部类别</option>
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select
                      value={filterActive}
                      onChange={e => {
                        setFilterActive(e.target.value)
                        if (selectedSupplier) loadPrices(selectedSupplier.id)
                      }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">全部状态</option>
                      <option value="true">启用</option>
                      <option value="false">禁用</option>
                    </select>
                  </div>
                </div>

                {/* 采购价列表 */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  {loadingPrices ? (
                    <div className="p-12 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
                      <p className="mt-2">加载中...</p>
                    </div>
                  ) : filteredPrices.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p>暂无采购价数据</p>
                      <p className="text-sm mt-1">点击"添加采购价"创建</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {Object.entries(pricesByCategory).map(([category, categoryPrices]) => (
                        <div key={category}>
                          <div className="px-4 py-2 bg-gray-50 border-b">
                            <span className="text-sm font-medium text-gray-700">{category}</span>
                            <span className="ml-2 text-xs text-gray-500">({categoryPrices.length}项)</span>
                          </div>
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50/50">
                                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">费用名称</th>
                                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">英文名称</th>
                                <th className="text-right py-2 px-4 text-xs font-medium text-gray-500">单价</th>
                                <th className="text-center py-2 px-4 text-xs font-medium text-gray-500">有效期</th>
                                <th className="text-center py-2 px-4 text-xs font-medium text-gray-500">状态</th>
                                <th className="text-center py-2 px-4 text-xs font-medium text-gray-500">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryPrices.map(price => (
                                <tr key={price.id} className="border-t hover:bg-gray-50">
                                  <td className="py-3 px-4">
                                    <div className="text-sm font-medium text-gray-900">{price.name}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="text-sm text-gray-600">{price.nameEn || '-'}</div>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="text-sm font-medium text-gray-900">
                                      {price.unitPrice?.toLocaleString()} {price.currency}
                                    </span>
                                    <span className="text-xs text-gray-500">/{price.unit}</span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="text-xs text-gray-500">
                                      {price.validFrom && price.validUntil ? (
                                        `${price.validFrom.split('T')[0]} ~ ${price.validUntil.split('T')[0]}`
                                      ) : (
                                        <span className="text-gray-400">长期有效</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                                      price.isActive 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {price.isActive && <CheckCircle className="w-3 h-3" />}
                                      {price.isActive ? '启用' : '禁用'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => handleOpenModal(price)}
                                        className="p-1 text-gray-400 hover:text-primary-600 rounded"
                                        title="编辑"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(price)}
                                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                                        title="删除"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalVisible(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPrice ? '编辑采购价' : '添加采购价'}
              </h3>
              <button onClick={() => setModalVisible(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-xl">&times;</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 费用类别 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  费用类别 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">请选择</option>
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 费用名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  费用名称（中文） <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="如：海运费"
                />
              </div>

              {/* 英文名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">英文名称</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="如：Ocean Freight"
                  />
                  <button
                    type="button"
                    onClick={handleTranslate}
                    disabled={translating || !formData.name.trim()}
                    className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
                  >
                    {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                    翻译
                  </button>
                </div>
              </div>

              {/* 单价和单位 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    单价 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.unitPrice}
                      onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                      min="0"
                      step="0.01"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="次"
                  />
                </div>
              </div>

              {/* 有效期 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有效期开始</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有效期结束</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 状态 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">启用</label>
              </div>

              {/* 备注 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="备注信息"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setModalVisible(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
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
