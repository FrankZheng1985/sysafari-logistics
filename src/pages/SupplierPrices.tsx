import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  Plus, Search, Edit2, Trash2, Building2, DollarSign,
  Languages, Loader2, ArrowLeft, Filter, CheckCircle, Copy
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
  routeFrom?: string      // 起运地
  routeTo?: string        // 目的地
  city?: string           // 城市
  returnPoint?: string    // 还柜点
  transportMode?: string  // 运输方式（空运/海运）
  billingType?: string    // 计费类型（fixed/actual/percentage）
}

// 费用类别接口
interface ServiceFeeCategory {
  id: string
  name: string
  code: string
  status: string
  parentId?: string | null
  level?: number
  sortOrder?: number
}

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
  const [feeCategories, setFeeCategories] = useState<ServiceFeeCategory[]>([])
  
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
    notes: '',
    routeFrom: '',      // 起运地（仅运输服务）
    routeTo: '',        // 目的地（仅运输服务）
    returnPoint: '',    // 还柜点（仅运输服务）
    transportMode: '',  // 运输方式（空运/海运）
    billingType: 'fixed' // 计费类型（fixed/actual）
  })

  // 费用名称相关状态
  const [subCategories, setSubCategories] = useState<ServiceFeeCategory[]>([])  // 选中类别的子分类
  const [isNewFeeName, setIsNewFeeName] = useState(false)  // 是否是新的费用名称
  const [showFeeNameInput, setShowFeeNameInput] = useState(false)  // 是否显示输入框
  const [submittingApproval, setSubmittingApproval] = useState(false)  // 是否正在提交审批

  const tabs = [
    { key: 'product-pricing', label: '产品定价', path: '/tools/product-pricing' },
    { key: 'supplier-pricing', label: '供应商报价', path: '/suppliers/prices' },
    { key: 'import', label: '智能导入', path: '/suppliers/import' }
  ]

  useEffect(() => {
    loadSuppliers()
    loadFeeCategories()  // 加载费用类别
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

  // 加载服务费类别（从基础数据）
  const loadFeeCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/service-fee-categories?status=active`)
      const data = await res.json()
      if (data.errCode === 200) {
        // 对数据进行排序：父级分类在前，子级紧随其后
        const sorted = sortCategoriesWithChildren(data.data || [])
        setFeeCategories(sorted)
      }
    } catch (error) {
      console.error('加载费用类别失败:', error)
    }
  }

  // 排序服务类别：父级在前，子级紧随其后
  const sortCategoriesWithChildren = (data: ServiceFeeCategory[]): ServiceFeeCategory[] => {
    const result: ServiceFeeCategory[] = []
    const topLevel = data.filter(item => !item.parentId)
    const childrenMap = new Map<string, ServiceFeeCategory[]>()
    
    // 构建子分类映射
    data.forEach(item => {
      if (item.parentId) {
        if (!childrenMap.has(item.parentId)) {
          childrenMap.set(item.parentId, [])
        }
        childrenMap.get(item.parentId)!.push(item)
      }
    })
    
    // 按排序值排序顶级分类，然后插入子分类
    topLevel
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .forEach(parent => {
        result.push(parent)
        const children = childrenMap.get(parent.id) || []
        children
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .forEach(child => result.push(child))
      })
    
    return result
  }

  // 获取选中类别的子分类
  const getSubCategoriesForParent = (parentName: string): ServiceFeeCategory[] => {
    // 先找到父级分类
    const parent = feeCategories.find(cat => cat.name === parentName && !cat.parentId)
    if (!parent) return []
    // 返回该父级的所有子分类（使用字符串比较，兼容 id/parentId 类型不一致）
    return feeCategories.filter(cat => String(cat.parentId) === String(parent.id))
  }

  // 当费用类别变化时，更新子分类列表
  useEffect(() => {
    if (formData.category) {
      const subs = getSubCategoriesForParent(formData.category)
      setSubCategories(subs)
      // 如果是选择了父级分类，清空费用名称
      const selectedCat = feeCategories.find(c => c.name === formData.category)
      if (selectedCat && !selectedCat.parentId) {
        // 如果当前名称不在子分类中，保留但标记为新名称
        const existsInSubs = subs.some(s => s.name === formData.name)
        if (!existsInSubs && formData.name) {
          setIsNewFeeName(true)
        }
      }
    } else {
      setSubCategories([])
    }
  }, [formData.category, feeCategories])

  // 获取父级分类ID
  const getParentCategoryId = (parentName: string): string | null => {
    const parent = feeCategories.find(cat => cat.name === parentName && !cat.parentId)
    return parent?.id || null
  }

  // 提交新费用分类审批
  const submitNewCategoryApproval = async () => {
    if (!formData.name.trim() || !formData.category) {
      alert('请填写费用名称和选择费用类别')
      return
    }

    const parentId = getParentCategoryId(formData.category)
    if (!parentId) {
      alert('无法找到父级分类')
      return
    }

    setSubmittingApproval(true)
    try {
      const res = await fetch(`${API_BASE}/api/fee-item-approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalType: 'new_category',
          feeName: formData.name.trim(),
          feeNameEn: formData.nameEn.trim() || null,
          parentCategoryId: parentId,
          parentCategoryName: formData.category,
          category: formData.category,
          description: `新费用分类申请：在「${formData.category}」下添加子分类「${formData.name}」`,
          requestedBy: 'current_user',  // TODO: 替换为实际登录用户
          requestedByName: '当前用户'
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert(`✅ 已提交审批申请！\n\n新费用名称「${formData.name}」需要老板审批后才能使用。\n审批通过后会自动添加到「${formData.category}」分类下。`)
        setIsNewFeeName(false)
        setShowFeeNameInput(false)
      } else {
        alert(`提交失败: ${data.msg}`)
      }
    } catch (error) {
      console.error('提交审批失败:', error)
      alert('提交审批失败，请稍后重试')
    } finally {
      setSubmittingApproval(false)
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
        // 兼容两种返回格式：data.data.list 或 data.data（直接数组）
        const list = data.data?.list || (Array.isArray(data.data) ? data.data : [])
        setPrices(list)
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
        notes: price.notes || '',
        routeFrom: price.routeFrom || '',
        routeTo: price.routeTo || '',
        returnPoint: price.returnPoint || '',
        transportMode: price.transportMode || '',
        billingType: price.billingType || 'fixed'
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
        notes: '',
        routeFrom: '',
        routeTo: '',
        returnPoint: '',
        transportMode: '',
        billingType: 'fixed'
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
    // 按实际计算时不需要验证单价
    if (!formData.category || !formData.name) {
      alert('请填写费用类别和名称')
      return
    }
    if (formData.billingType === 'fixed' && formData.unitPrice <= 0) {
      alert('固定价格类型需要填写单价')
      return
    }
    if (formData.billingType === 'percentage' && formData.unitPrice <= 0) {
      alert('按百分比类型需要填写百分比值')
      return
    }
    if (!selectedSupplier) return

    setSaving(true)
    try {
      const url = editingPrice
        ? `${API_BASE}/api/suppliers/${selectedSupplier.id}/prices/${editingPrice.id}`
        : `${API_BASE}/api/suppliers/${selectedSupplier.id}/prices`
      
      // 只有运输服务才发送路线字段
      const payload = {
        ...formData,
        validFrom: formData.validFrom || null,
        validUntil: formData.validUntil || null,
        // 非运输服务不发送路线字段
        routeFrom: formData.category === '运输服务' ? formData.routeFrom : '',
        routeTo: formData.category === '运输服务' ? formData.routeTo : '',
        returnPoint: formData.category === '运输服务' ? formData.returnPoint : ''
      }
      
      const res = await fetch(url, {
        method: editingPrice ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  // 复制费用条目
  const handleCopy = (price: SupplierPrice) => {
    // 预填充数据但不设置 editingPrice（这样保存时会创建新记录）
    setEditingPrice(null)
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
      notes: price.notes || '',
      routeFrom: price.routeFrom || '',
      routeTo: price.routeTo || '',
      returnPoint: price.returnPoint || '',
      transportMode: price.transportMode || '',
      billingType: price.billingType || 'fixed'
    })
    setModalVisible(true)
  }

  // 切换启用/禁用状态
  const handleToggleStatus = async (price: SupplierPrice) => {
    if (!selectedSupplier) return
    
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/${selectedSupplier.id}/prices/${price.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !price.isActive })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        loadPrices(selectedSupplier.id)
      } else {
        alert(data.msg || '状态更新失败')
      }
    } catch (error) {
      console.error('状态更新失败:', error)
      alert('状态更新失败')
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

  // 过滤采购价列表（支持搜索所有显示字段）
  const filteredPrices = prices.filter(price => {
    if (!searchValue) return true
    
    const search = searchValue.toLowerCase()
    
    // 搜索所有显示的字段
    return (
      price.name?.toLowerCase().includes(search) ||           // 费用名称
      price.nameEn?.toLowerCase().includes(search) ||         // 英文名称
      price.category?.toLowerCase().includes(search) ||       // 分类
      price.transportMode?.toLowerCase().includes(search) ||  // 运输方式
      price.routeFrom?.toLowerCase().includes(search) ||      // 起运地
      price.routeTo?.toLowerCase().includes(search) ||        // 目的地
      price.city?.toLowerCase().includes(search) ||           // 城市
      price.returnPoint?.toLowerCase().includes(search) ||    // 还柜点
      price.unit?.toLowerCase().includes(search) ||           // 单位
      price.currency?.toLowerCase().includes(search) ||       // 币种
      price.notes?.toLowerCase().includes(search) ||          // 备注
      String(price.unitPrice).includes(search)                // 单价
    )
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
        title="供应商报价"
        tabs={tabs}
        activeTab="/suppliers/prices"
        onTabChange={(path) => navigate(path)}
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
                        onKeyDown={(e) => e.key === 'Enter' && selectedSupplier && loadPrices(selectedSupplier.id)}
                        placeholder="搜索费用名称/路线/城市/备注..."
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
                      {feeCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
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
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50/50">
                                <th className="text-left py-2 px-3 font-medium text-gray-500">费用名称</th>
                                <th className="text-left py-2 px-3 font-medium text-gray-500">英文名称</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-500">运输方式</th>
                                {category === '运输服务' && (
                                  <>
                                    <th className="text-left py-2 px-3 font-medium text-gray-500">起运地</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-500">目的地</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-500">还柜点</th>
                                  </>
                                )}
                                <th className="text-right py-2 px-3 font-medium text-gray-500">单价</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-500">有效期</th>
                                <th className="text-left py-2 px-3 font-medium text-gray-500">备注</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-500">状态</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-500">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryPrices.map(price => (
                                <tr key={price.id} className="border-t hover:bg-gray-50">
                                  <td className="py-2 px-3">
                                    <div className="font-medium text-gray-900">{price.name || '-'}</div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="text-gray-600">{price.nameEn || '-'}</div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {price.transportMode ? (
                                      <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                                        price.transportMode === '海运' ? 'bg-blue-100 text-blue-700' :
                                        price.transportMode === '空运' ? 'bg-purple-100 text-purple-700' :
                                        price.transportMode === '铁路' ? 'bg-orange-100 text-orange-700' :
                                        price.transportMode === '卡航' ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {price.transportMode}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  {category === '运输服务' && (
                                    <>
                                      <td className="py-2 px-3">
                                        <div className="text-gray-700">{price.routeFrom || '-'}</div>
                                      </td>
                                      <td className="py-2 px-3">
                                        <div className="text-gray-700">{price.routeTo || '-'}</div>
                                        {price.city && <div className="text-gray-400 text-[10px]">{price.city}</div>}
                                      </td>
                                      <td className="py-2 px-3">
                                        <div className="text-gray-700">{price.returnPoint || '-'}</div>
                                      </td>
                                    </>
                                  )}
                                  <td className="py-2 px-3 text-right">
                                    {price.billingType === 'actual' ? (
                                      <span className="inline-flex px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">
                                        按实际
                                      </span>
                                    ) : price.billingType === 'percentage' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                                        {price.unitPrice}%
                                      </span>
                                    ) : (
                                      <>
                                        <span className="font-medium text-gray-900">
                                          {price.unitPrice?.toLocaleString()} {price.currency}
                                        </span>
                                        <span className="text-gray-500">/{price.unit}</span>
                                      </>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="text-gray-500">
                                      {price.validFrom && price.validUntil ? (
                                        `${price.validFrom.split('T')[0]} ~ ${price.validUntil.split('T')[0]}`
                                      ) : (
                                        <span className="text-gray-400">长期有效</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="text-gray-600 max-w-[120px] truncate" title={price.notes || ''}>
                                      {price.notes || '-'}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      onClick={() => handleToggleStatus(price)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                        price.isActive 
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      }`}
                                      title={price.isActive ? '点击禁用' : '点击启用'}
                                    >
                                      {price.isActive && <CheckCircle className="w-3 h-3" />}
                                      {price.isActive ? '启用' : '禁用'}
                                    </button>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleCopy(price)}
                                        className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                        title="复制"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenModal(price)}
                                        className="p-1 text-gray-400 hover:text-primary-600 rounded"
                                        title="编辑"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(price)}
                                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                                        title="删除"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
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
              {/* 费用类别和运输方式 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    费用类别 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => {
                      setFormData({ ...formData, category: e.target.value, name: '' })
                      setShowFeeNameInput(false)
                      setIsNewFeeName(false)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">请选择</option>
                    {/* 只显示顶级分类 */}
                    {feeCategories.filter(cat => !cat.parentId).map(cat => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    运输方式
                  </label>
                  <select
                    value={formData.transportMode}
                    onChange={e => {
                      const mode = e.target.value
                      // 根据运输方式自动设置单位
                      let unit = formData.unit
                      if (mode === '海运' || mode === '铁路' || mode === '卡航') {
                        unit = '柜'
                      } else if (mode === '空运') {
                        unit = 'KG'
                      }
                      setFormData({ ...formData, transportMode: mode, unit })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">不限</option>
                    <option value="海运">海运（按柜计费）</option>
                    <option value="空运">空运（按KG计费）</option>
                    <option value="铁路">铁路（按柜计费）</option>
                    <option value="卡航">卡航（按柜计费）</option>
                  </select>
                </div>
              </div>

              {/* 费用名称 - 关联子分类 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  费用名称（中文） <span className="text-red-500">*</span>
                </label>
                
                {/* 有子分类时显示下拉选择 */}
                {formData.category && subCategories.length > 0 && !showFeeNameInput ? (
                  <div className="space-y-2">
                    <select
                      value={formData.name}
                      onChange={e => {
                        const value = e.target.value
                        if (value === '__NEW__') {
                          setShowFeeNameInput(true)
                          setFormData({ ...formData, name: '' })
                        } else {
                          setFormData({ ...formData, name: value })
                          setIsNewFeeName(false)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">请选择费用名称</option>
                      {subCategories.map(sub => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                      <option value="__NEW__">➕ 新增费用名称（需审批）</option>
                    </select>
                  </div>
                ) : formData.category && showFeeNameInput ? (
                  /* 输入新费用名称 */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => {
                          setFormData({ ...formData, name: e.target.value })
                          setIsNewFeeName(true)
                        }}
                        className="flex-1 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-orange-50"
                        placeholder="输入新的费用名称"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowFeeNameInput(false)
                          setFormData({ ...formData, name: '' })
                          setIsNewFeeName(false)
                        }}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700"
                      >
                        取消
                      </button>
                    </div>
                    {formData.name && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                        <span className="text-orange-600 text-sm">
                          ⚠️ 新费用名称「{formData.name}」需要提交审批
                        </span>
                        <button
                          type="button"
                          onClick={submitNewCategoryApproval}
                          disabled={submittingApproval}
                          className="ml-auto px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-50"
                        >
                          {submittingApproval ? '提交中...' : '提交审批'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 未选择类别或无子分类时直接输入 */
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder={formData.category ? "直接输入或选择已有分类" : "请先选择费用类别"}
                  />
                )}
                
                {/* 提示信息 */}
                {formData.category && subCategories.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    该类别暂无子分类，请直接输入费用名称
                  </p>
                )}
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

              {/* 运输服务特有字段：起运地、目的地、还柜点 */}
              {formData.category === '运输服务' && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">起运地</label>
                    <input
                      type="text"
                      value={formData.routeFrom}
                      onChange={e => setFormData({ ...formData, routeFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="如：鹿特丹"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目的地（邮编）</label>
                    <input
                      type="text"
                      value={formData.routeTo}
                      onChange={e => setFormData({ ...formData, routeTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="如：DE-41751"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">还柜点</label>
                    <input
                      type="text"
                      value={formData.returnPoint}
                      onChange={e => setFormData({ ...formData, returnPoint: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="如：鹿特丹"
                    />
                  </div>
                </div>
              )}

              {/* 计费类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">计费类型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billingType"
                      value="fixed"
                      checked={formData.billingType === 'fixed'}
                      onChange={e => setFormData({ ...formData, billingType: e.target.value })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">固定价格</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billingType"
                      value="actual"
                      checked={formData.billingType === 'actual'}
                      onChange={e => setFormData({ ...formData, billingType: e.target.value, unitPrice: 0 })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">按实际计算</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billingType"
                      value="percentage"
                      checked={formData.billingType === 'percentage'}
                      onChange={e => setFormData({ ...formData, billingType: e.target.value })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">按百分比</span>
                  </label>
                </div>
                {formData.billingType === 'percentage' && (
                  <p className="text-xs text-blue-600 mt-1">📊 按垫付金额的百分比收取手续费（如：关税代垫、增值税代垫）</p>
                )}
              </div>

              {/* 单价和单位 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.billingType === 'percentage' ? '百分比率 (%)' : '单价'} {(formData.billingType === 'fixed' || formData.billingType === 'percentage') && <span className="text-red-500">*</span>}
                  </label>
                  <div className="flex gap-2">
                    {formData.billingType === 'percentage' ? (
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={formData.unitPrice}
                          onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.1"
                          placeholder="如：2 表示 2%"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={formData.billingType === 'actual' ? 0 : formData.unitPrice}
                        onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                        disabled={formData.billingType === 'actual'}
                        placeholder={formData.billingType === 'actual' ? '按实际计算' : ''}
                        className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 ${
                          formData.billingType === 'actual' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                        }`}
                      />
                    )}
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
                  {formData.billingType === 'percentage' && formData.unitPrice > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      例：垫付 €1000，收取 {formData.unitPrice}% = €{(formData.unitPrice * 10).toFixed(2)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">单位</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    disabled={['海运', '铁路', '卡航', '空运'].includes(formData.transportMode)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 ${
                      ['海运', '铁路', '卡航', '空运'].includes(formData.transportMode) 
                        ? 'bg-gray-100 text-gray-600 cursor-not-allowed' 
                        : ''
                    }`}
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
