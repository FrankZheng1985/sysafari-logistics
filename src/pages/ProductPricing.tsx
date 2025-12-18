import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, Package, ChevronRight, ChevronDown, Settings, DollarSign, Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface Product {
  id: string
  productCode: string
  productName: string
  productNameEn: string
  category: string
  description: string
  isActive: boolean
  feeItems?: FeeItem[]
}

interface FeeItem {
  id: number
  feeName: string
  feeNameEn: string
  feeCategory: string
  unit: string
  standardPrice: number
  minPrice: number | null
  maxPrice: number | null
  currency: string
  isRequired: boolean
  description: string
}

const CATEGORIES = [
  { value: '', label: '全部分类' },
  { value: 'shipping', label: '海运服务' },
  { value: 'rail', label: '铁路服务' },
  { value: 'air', label: '空运服务' },
  { value: 'customs', label: '报关服务' },
  { value: 'warehouse', label: '仓储服务' },
  { value: 'trucking', label: '卡车运输' },
  { value: 'other', label: '其他服务' }
]

const FEE_CATEGORIES: Record<string, { label: string; color: string }> = {
  freight: { label: '运费', color: 'bg-blue-100 text-blue-700' },
  customs: { label: '关税', color: 'bg-red-100 text-red-700' },
  warehouse: { label: '仓储', color: 'bg-orange-100 text-orange-700' },
  insurance: { label: '保险', color: 'bg-green-100 text-green-700' },
  handling: { label: '操作', color: 'bg-purple-100 text-purple-700' },
  documentation: { label: '文件', color: 'bg-cyan-100 text-cyan-700' },
  other: { label: '其他', color: 'bg-gray-100 text-gray-700' }
}

export default function ProductPricing() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  
  // 模态框状态
  const [showProductModal, setShowProductModal] = useState(false)
  const [showFeeItemModal, setShowFeeItemModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingFeeItem, setEditingFeeItem] = useState<FeeItem | null>(null)
  const [currentProductId, setCurrentProductId] = useState<string | null>(null)
  
  // 表单数据
  const [productForm, setProductForm] = useState({
    productName: '',
    productNameEn: '',
    category: '',
    description: '',
    isActive: true
  })
  
  const [feeItemForm, setFeeItemForm] = useState({
    feeName: '',
    feeNameEn: '',
    feeCategory: 'other',
    unit: '',
    standardPrice: '',
    minPrice: '',
    maxPrice: '',
    currency: 'EUR',
    isRequired: false,
    description: ''
  })
  
  const [submitting, setSubmitting] = useState(false)

  const tabs = [
    { key: 'product-pricing', label: '产品定价', path: '/tools/product-pricing' },
    { key: 'supplier-pricing', label: '供应商报价', path: '/suppliers/prices' }
  ]

  useEffect(() => {
    loadProducts()
  }, [search, category])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (category) params.append('category', category)
      params.append('pageSize', '100')
      
      const response = await fetch(`${API_BASE}/api/products?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setProducts(data.data?.list || [])
      }
    } catch (error) {
      console.error('加载产品列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProductFeeItems = async (productId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`)
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        setProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, feeItems: data.data.feeItems } : p
        ))
      }
    } catch (error) {
      console.error('加载费用项失败:', error)
    }
  }

  const handleExpandProduct = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null)
    } else {
      setExpandedProduct(productId)
      const product = products.find(p => p.id === productId)
      if (product && !product.feeItems) {
        await loadProductFeeItems(productId)
      }
    }
  }

  // 产品操作
  const handleAddProduct = () => {
    setEditingProduct(null)
    setProductForm({
      productName: '',
      productNameEn: '',
      category: '',
      description: '',
      isActive: true
    })
    setShowProductModal(true)
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      productName: product.productName,
      productNameEn: product.productNameEn || '',
      category: product.category || '',
      description: product.description || '',
      isActive: product.isActive
    })
    setShowProductModal(true)
  }

  const handleSaveProduct = async () => {
    if (!productForm.productName.trim()) {
      alert('请输入产品名称')
      return
    }
    
    setSubmitting(true)
    try {
      const url = editingProduct 
        ? `${API_BASE}/api/products/${editingProduct.id}`
        : `${API_BASE}/api/products`
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm)
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowProductModal(false)
        loadProducts()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存产品失败:', error)
      alert('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('确定要删除此产品吗？关联的费用项也会被删除。')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadProducts()
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除产品失败:', error)
      alert('删除失败')
    }
  }

  // 费用项操作
  const handleAddFeeItem = (productId: string) => {
    setCurrentProductId(productId)
    setEditingFeeItem(null)
    setFeeItemForm({
      feeName: '',
      feeNameEn: '',
      feeCategory: 'other',
      unit: '',
      standardPrice: '',
      minPrice: '',
      maxPrice: '',
      currency: 'EUR',
      isRequired: false,
      description: ''
    })
    setShowFeeItemModal(true)
  }

  const handleEditFeeItem = (productId: string, feeItem: FeeItem) => {
    setCurrentProductId(productId)
    setEditingFeeItem(feeItem)
    setFeeItemForm({
      feeName: feeItem.feeName,
      feeNameEn: feeItem.feeNameEn || '',
      feeCategory: feeItem.feeCategory || 'other',
      unit: feeItem.unit || '',
      standardPrice: String(feeItem.standardPrice || ''),
      minPrice: feeItem.minPrice ? String(feeItem.minPrice) : '',
      maxPrice: feeItem.maxPrice ? String(feeItem.maxPrice) : '',
      currency: feeItem.currency || 'EUR',
      isRequired: feeItem.isRequired,
      description: feeItem.description || ''
    })
    setShowFeeItemModal(true)
  }

  const handleSaveFeeItem = async () => {
    if (!feeItemForm.feeName.trim()) {
      alert('请输入费用名称')
      return
    }
    
    setSubmitting(true)
    try {
      const url = editingFeeItem
        ? `${API_BASE}/api/products/fee-items/${editingFeeItem.id}`
        : `${API_BASE}/api/products/${currentProductId}/fee-items`
      
      const response = await fetch(url, {
        method: editingFeeItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feeItemForm,
          standardPrice: parseFloat(feeItemForm.standardPrice) || 0,
          minPrice: feeItemForm.minPrice ? parseFloat(feeItemForm.minPrice) : null,
          maxPrice: feeItemForm.maxPrice ? parseFloat(feeItemForm.maxPrice) : null
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        setShowFeeItemModal(false)
        if (currentProductId) {
          loadProductFeeItems(currentProductId)
        }
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存费用项失败:', error)
      alert('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteFeeItem = async (feeItemId: number, productId: string) => {
    if (!confirm('确定要删除此费用项吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/products/fee-items/${feeItemId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        loadProductFeeItems(productId)
      } else {
        alert(data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除费用项失败:', error)
      alert('删除失败')
    }
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="报价管理"
        subtitle="管理公司销售产品定价和供应商报价"
        tabs={tabs}
        activeTab="product-pricing"
        onTabChange={(key) => {
          const tab = tabs.find(t => t.key === key)
          if (tab) navigate(tab.path)
        }}
      />

      {/* 工具栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索产品名称或编码..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加产品
          </button>
        </div>
      </div>

      {/* 产品列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无产品</p>
            <button
              onClick={handleAddProduct}
              className="mt-3 text-primary-600 hover:text-primary-700 text-sm"
            >
              点击添加第一个产品
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {products.map(product => (
              <div key={product.id} className="group">
                {/* 产品行 */}
                <div
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleExpandProduct(product.id)}
                >
                  <div className="flex items-center gap-3">
                    <button className="text-gray-400">
                      {expandedProduct === product.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{product.productName}</span>
                        <span className="text-xs text-gray-400">{product.productCode}</span>
                        {!product.isActive && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            已停用
                          </span>
                        )}
                      </div>
                      {product.productNameEn && (
                        <div className="text-xs text-gray-500">{product.productNameEn}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {CATEGORIES.find(c => c.value === product.category)?.label || '未分类'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {product.feeItems?.length || 0} 个费用项
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditProduct(product) }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="编辑产品"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="删除产品"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 费用项列表 */}
                {expandedProduct === product.id && (
                  <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
                    <div className="ml-8">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          费用项配置
                        </h4>
                        <button
                          onClick={() => handleAddFeeItem(product.id)}
                          className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          添加费用项
                        </button>
                      </div>
                      
                      {product.feeItems && product.feeItems.length > 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">费用名称</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">类别</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600">单位</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">标准价</th>
                                <th className="text-center px-3 py-2 font-medium text-gray-600">必选</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.feeItems.map(item => (
                                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-gray-900">{item.feeName}</div>
                                    {item.feeNameEn && (
                                      <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                                      FEE_CATEGORIES[item.feeCategory]?.color || FEE_CATEGORIES.other.color
                                    }`}>
                                      {FEE_CATEGORIES[item.feeCategory]?.label || '其他'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{item.unit || '-'}</td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="font-medium text-gray-900">
                                      {item.currency} {item.standardPrice?.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                    </span>
                                    {(item.minPrice || item.maxPrice) && (
                                      <div className="text-xs text-gray-500">
                                        {item.minPrice && `最低 ${item.minPrice}`}
                                        {item.minPrice && item.maxPrice && ' - '}
                                        {item.maxPrice && `最高 ${item.maxPrice}`}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {item.isRequired ? (
                                      <span className="text-green-600">✓</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => handleEditFeeItem(product.id, item)}
                                      className="p-1 text-gray-400 hover:text-primary-600"
                                      title="编辑"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFeeItem(item.id, product.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 ml-1"
                                      title="删除"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">暂无费用项</p>
                          <button
                            onClick={() => handleAddFeeItem(product.id)}
                            className="mt-2 text-primary-600 hover:text-primary-700 text-sm"
                          >
                            添加第一个费用项
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 产品编辑模态框 */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {editingProduct ? '编辑产品' : '添加产品'}
              </h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.productName}
                  onChange={(e) => setProductForm(prev => ({ ...prev, productName: e.target.value }))}
                  placeholder="如：整柜海运"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">英文名称</label>
                <input
                  type="text"
                  value={productForm.productNameEn}
                  onChange={(e) => setProductForm(prev => ({ ...prev, productNameEn: e.target.value }))}
                  placeholder="如：FCL Ocean Freight"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">服务类别</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {CATEGORIES.slice(1).map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="产品描述..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">启用此产品</label>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 费用项编辑模态框 */}
      {showFeeItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFeeItemModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {editingFeeItem ? '编辑费用项' : '添加费用项'}
              </h3>
            </div>
            
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    费用名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={feeItemForm.feeName}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, feeName: e.target.value }))}
                    placeholder="如：海运费"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">英文名称</label>
                  <input
                    type="text"
                    value={feeItemForm.feeNameEn}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, feeNameEn: e.target.value }))}
                    placeholder="如：Ocean Freight"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">费用类别</label>
                  <select
                    value={feeItemForm.feeCategory}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, feeCategory: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(FEE_CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">计费单位</label>
                  <input
                    type="text"
                    value={feeItemForm.unit}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="如：柜、票、件"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">标准价格</label>
                  <div className="flex">
                    <select
                      value={feeItemForm.currency}
                      onChange={(e) => setFeeItemForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="px-2 py-2 text-sm border border-r-0 border-gray-300 rounded-l-lg bg-gray-50"
                    >
                      <option value="EUR">EUR</option>
                      <option value="CNY">CNY</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={feeItemForm.standardPrice}
                      onChange={(e) => setFeeItemForm(prev => ({ ...prev, standardPrice: e.target.value }))}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">最低价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeItemForm.minPrice}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, minPrice: e.target.value }))}
                    placeholder="可选"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">最高价</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeItemForm.maxPrice}
                    onChange={(e) => setFeeItemForm(prev => ({ ...prev, maxPrice: e.target.value }))}
                    placeholder="可选"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                <input
                  type="text"
                  value={feeItemForm.description}
                  onChange={(e) => setFeeItemForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="费用项说明..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={feeItemForm.isRequired}
                  onChange={(e) => setFeeItemForm(prev => ({ ...prev, isRequired: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="isRequired" className="text-sm text-gray-700">必选费用项（报价时默认勾选）</label>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowFeeItemModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSaveFeeItem}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
