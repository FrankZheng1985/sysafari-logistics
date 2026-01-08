/**
 * 敏感产品库管理页面
 * 管理高敏感/反倾销产品和海关查验产品
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, Shield, Plus, Edit2, Trash2, Search, Filter,
  Eye, RefreshCw, Download, Upload, ChevronDown, X, Check, Package
} from 'lucide-react'
import { PageContainer, ContentCard } from '../components/ui'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'
import { useToast } from '../components/Toast'

const API_BASE = getApiBaseUrl()

// 敏感产品接口
interface SensitiveProduct {
  id: number
  category: string
  product_name: string
  hs_code: string
  duty_rate: string
  duty_rate_min: number
  duty_rate_max: number
  product_type: 'sensitive' | 'anti_dumping'
  risk_level: 'high' | 'medium' | 'low'
  risk_notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// 查验产品接口
interface InspectionProduct {
  id: number
  product_name: string
  hs_code: string
  duty_rate: number
  inspection_rate: number
  risk_level: 'high' | 'medium' | 'low'
  risk_notes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// 产品类型配置
const PRODUCT_TYPE_CONFIG = {
  sensitive: { label: '高敏感产品', color: 'bg-amber-100 text-amber-700' },
  anti_dumping: { label: '反倾销产品', color: 'bg-red-100 text-red-700' }
}

// 风险等级配置
const RISK_LEVEL_CONFIG = {
  high: { label: '高风险', color: 'bg-red-100 text-red-700' },
  medium: { label: '中风险', color: 'bg-amber-100 text-amber-700' },
  low: { label: '低风险', color: 'bg-green-100 text-green-700' }
}

export default function SensitiveProducts() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  
  // Tab状态
  const [activeTab, setActiveTab] = useState<'sensitive' | 'inspection'>('sensitive')
  
  // 敏感产品状态
  const [sensitiveProducts, setSensitiveProducts] = useState<SensitiveProduct[]>([])
  const [sensitiveTotal, setSensitiveTotal] = useState(0)
  const [sensitiveLoading, setSensitiveLoading] = useState(true)
  const [sensitiveCategories, setSensitiveCategories] = useState<{category: string, count: number}[]>([])
  
  // 查验产品状态
  const [inspectionProducts, setInspectionProducts] = useState<InspectionProduct[]>([])
  const [inspectionTotal, setInspectionTotal] = useState(0)
  const [inspectionLoading, setInspectionLoading] = useState(true)
  
  // 分页
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  
  // 筛选
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProductType, setFilterProductType] = useState('')
  const [filterRiskLevel, setFilterRiskLevel] = useState('')
  
  // 弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SensitiveProduct | InspectionProduct | null>(null)
  const [modalType, setModalType] = useState<'sensitive' | 'inspection'>('sensitive')
  
  // 统计数据
  const [stats, setStats] = useState<any>(null)

  // 加载敏感产品列表
  const loadSensitiveProducts = async () => {
    setSensitiveLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (search) params.append('search', search)
      if (filterCategory) params.append('category', filterCategory)
      if (filterProductType) params.append('productType', filterProductType)
      if (filterRiskLevel) params.append('riskLevel', filterRiskLevel)
      
      const response = await fetch(`${API_BASE}/api/cargo/sensitive-products?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setSensitiveProducts(data.data?.list || [])
        setSensitiveTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载敏感产品失败:', error)
    } finally {
      setSensitiveLoading(false)
    }
  }
  
  // 加载敏感产品分类
  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cargo/sensitive-products/categories`)
      const data = await response.json()
      if (data.errCode === 200) {
        setSensitiveCategories(data.data || [])
      }
    } catch (error) {
      console.error('加载分类失败:', error)
    }
  }
  
  // 加载查验产品列表
  const loadInspectionProducts = async () => {
    setInspectionLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      })
      if (search) params.append('search', search)
      if (filterRiskLevel) params.append('riskLevel', filterRiskLevel)
      
      const response = await fetch(`${API_BASE}/api/cargo/inspection-products?${params}`)
      const data = await response.json()
      
      if (data.errCode === 200) {
        setInspectionProducts(data.data?.list || [])
        setInspectionTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载查验产品失败:', error)
    } finally {
      setInspectionLoading(false)
    }
  }
  
  // 加载统计数据
  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cargo/product-risk/stats`)
      const data = await response.json()
      if (data.errCode === 200) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  useEffect(() => {
    loadCategories()
    loadStats()
  }, [])
  
  useEffect(() => {
    if (activeTab === 'sensitive') {
      loadSensitiveProducts()
    } else {
      loadInspectionProducts()
    }
  }, [activeTab, page, search, filterCategory, filterProductType, filterRiskLevel])
  
  // 删除敏感产品
  const deleteSensitiveProduct = async (id: number) => {
    if (!confirm('确定要删除此产品吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/cargo/sensitive-products/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        showToast('删除成功', 'success')
        loadSensitiveProducts()
        loadStats()
      } else {
        showToast(data.msg || '删除失败', 'error')
      }
    } catch (error) {
      showToast('删除失败', 'error')
    }
  }
  
  // 删除查验产品
  const deleteInspectionProduct = async (id: number) => {
    if (!confirm('确定要删除此产品吗？')) return
    
    try {
      const response = await fetch(`${API_BASE}/api/cargo/inspection-products/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.errCode === 200) {
        showToast('删除成功', 'success')
        loadInspectionProducts()
        loadStats()
      } else {
        showToast(data.msg || '删除失败', 'error')
      }
    } catch (error) {
      showToast('删除失败', 'error')
    }
  }
  
  // 打开新增弹窗
  const openAddModal = (type: 'sensitive' | 'inspection') => {
    setModalType(type)
    setEditingItem(null)
    setModalOpen(true)
  }
  
  // 打开编辑弹窗
  const openEditModal = (item: SensitiveProduct | InspectionProduct, type: 'sensitive' | 'inspection') => {
    setModalType(type)
    setEditingItem(item)
    setModalOpen(true)
  }

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
    { label: '匹配记录库', path: '/documents/match-records' },
    { label: '敏感产品库', path: '/documents/sensitive-products' },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="敏感产品库管理"
        description="管理高敏感/反倾销产品和海关查验产品，辅助风险评估"
        icon={<AlertTriangle className="w-6 h-6" />}
        tabs={tabs}
        activeTab="/documents/sensitive-products"
        onTabChange={(path) => navigate(path)}
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">高敏感产品</div>
              <div className="text-2xl font-bold text-amber-600">
                {stats?.sensitive?.total || 0}
              </div>
            </div>
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">反倾销产品</div>
              <div className="text-2xl font-bold text-red-600">
                {stats?.sensitive?.antiDumpingCount || 0}
              </div>
            </div>
            <Shield className="w-10 h-10 text-red-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">查验产品库</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats?.inspection?.total || 0}
              </div>
            </div>
            <Eye className="w-10 h-10 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">产品分类</div>
              <div className="text-2xl font-bold text-green-600">
                {sensitiveCategories.length}
              </div>
            </div>
            <Package className="w-10 h-10 text-green-400" />
          </div>
        </div>
      </div>

      <ContentCard>
        {/* Tab切换 */}
        <div className="flex items-center justify-between border-b border-gray-200 mb-4">
          <div className="flex">
            <button
              onClick={() => { setActiveTab('sensitive'); setPage(1) }}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'sensitive'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              高敏感/反倾销产品 ({sensitiveTotal})
            </button>
            <button
              onClick={() => { setActiveTab('inspection'); setPage(1) }}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'inspection'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              海关查验产品 ({inspectionTotal})
            </button>
          </div>
          
          <button
            onClick={() => openAddModal(activeTab)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            新增产品
          </button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索品名或HS编码..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          
          {activeTab === 'sensitive' && (
            <>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">全部分类</option>
                {sensitiveCategories.map(cat => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </option>
                ))}
              </select>
              
              <select
                value={filterProductType}
                onChange={(e) => setFilterProductType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">全部类型</option>
                <option value="sensitive">高敏感产品</option>
                <option value="anti_dumping">反倾销产品</option>
              </select>
            </>
          )}
          
          <select
            value={filterRiskLevel}
            onChange={(e) => setFilterRiskLevel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部风险</option>
            <option value="high">高风险</option>
            <option value="medium">中风险</option>
            <option value="low">低风险</option>
          </select>
          
          <button
            onClick={() => {
              setSearch('')
              setFilterCategory('')
              setFilterProductType('')
              setFilterRiskLevel('')
            }}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            重置
          </button>
        </div>

        {/* 敏感产品表格 */}
        {activeTab === 'sensitive' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-3 text-left font-medium">分类</th>
                  <th className="px-3 py-3 text-left font-medium">品名</th>
                  <th className="px-3 py-3 text-left font-medium">HS编码</th>
                  <th className="px-3 py-3 text-center font-medium">税率</th>
                  <th className="px-3 py-3 text-center font-medium">类型</th>
                  <th className="px-3 py-3 text-center font-medium">风险等级</th>
                  <th className="px-3 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sensitiveLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : sensitiveProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  sensitiveProducts.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{item.category || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-primary-600 text-xs">{item.hs_code || '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{item.duty_rate || '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center justify-center min-w-[80px] px-2 py-0.5 rounded text-xs ${
                            PRODUCT_TYPE_CONFIG[item.product_type]?.color || 'bg-gray-100 text-gray-600'
                          }`}>
                            {PRODUCT_TYPE_CONFIG[item.product_type]?.label || item.product_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
                            RISK_LEVEL_CONFIG[item.risk_level]?.color || 'bg-gray-100 text-gray-600'
                          }`}>
                            {RISK_LEVEL_CONFIG[item.risk_level]?.label || item.risk_level}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(item, 'sensitive')}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSensitiveProduct(item.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 查验产品表格 */}
        {activeTab === 'inspection' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-3 text-left font-medium">品名</th>
                  <th className="px-3 py-3 text-left font-medium">HS编码</th>
                  <th className="px-3 py-3 text-center font-medium">税率</th>
                  <th className="px-3 py-3 text-center font-medium">查验率</th>
                  <th className="px-3 py-3 text-center font-medium">风险等级</th>
                  <th className="px-3 py-3 text-left font-medium">备注</th>
                  <th className="px-3 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inspectionLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : inspectionProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  inspectionProducts.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-primary-600 text-xs">{item.hs_code || '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {item.duty_rate ? `${(item.duty_rate * 100).toFixed(1)}%` : '0%'}
                      </td>
                      <td className="px-3 py-2 text-center text-amber-600 font-medium">
                        {item.inspection_rate ? `${item.inspection_rate}%` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-xs ${
                            RISK_LEVEL_CONFIG[item.risk_level]?.color || 'bg-gray-100 text-gray-600'
                          }`}>
                            {RISK_LEVEL_CONFIG[item.risk_level]?.label || item.risk_level}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={item.risk_notes}>
                        {item.risk_notes || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(item, 'inspection')}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteInspectionProduct(item.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-gray-500">
            共 {activeTab === 'sensitive' ? sensitiveTotal : inspectionTotal} 条记录
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-sm">
              第 {page} 页
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(activeTab === 'sensitive' ? sensitiveProducts : inspectionProducts).length < pageSize}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        </div>
      </ContentCard>

      {/* 新增/编辑弹窗 */}
      {modalOpen && (
        <ProductModal
          type={modalType}
          item={editingItem}
          categories={sensitiveCategories}
          onClose={() => {
            setModalOpen(false)
            setEditingItem(null)
          }}
          onSuccess={() => {
            setModalOpen(false)
            setEditingItem(null)
            if (modalType === 'sensitive') {
              loadSensitiveProducts()
              loadCategories()
            } else {
              loadInspectionProducts()
            }
            loadStats()
          }}
        />
      )}
    </PageContainer>
  )
}

// 产品弹窗组件
interface ProductModalProps {
  type: 'sensitive' | 'inspection'
  item: SensitiveProduct | InspectionProduct | null
  categories: {category: string, count: number}[]
  onClose: () => void
  onSuccess: () => void
}

function ProductModal({ type, item, categories, onClose, onSuccess }: ProductModalProps) {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  
  // 敏感产品表单
  const [sensitiveForm, setSensitiveForm] = useState({
    category: (item as SensitiveProduct)?.category || '',
    productName: item?.product_name || '',
    hsCode: item?.hs_code || '',
    dutyRate: (item as SensitiveProduct)?.duty_rate || '',
    dutyRateMin: (item as SensitiveProduct)?.duty_rate_min?.toString() || '',
    dutyRateMax: (item as SensitiveProduct)?.duty_rate_max?.toString() || '',
    productType: (item as SensitiveProduct)?.product_type || 'sensitive',
    riskLevel: item?.risk_level || 'high',
    riskNotes: (item as SensitiveProduct)?.risk_notes || ''
  })
  
  // 查验产品表单
  const [inspectionForm, setInspectionForm] = useState({
    productName: item?.product_name || '',
    hsCode: item?.hs_code || '',
    dutyRate: (item as InspectionProduct)?.duty_rate?.toString() || '0',
    inspectionRate: (item as InspectionProduct)?.inspection_rate?.toString() || '',
    riskLevel: item?.risk_level || 'medium',
    riskNotes: (item as InspectionProduct)?.risk_notes || ''
  })
  
  const handleSubmit = async () => {
    setSaving(true)
    try {
      let url: string
      let body: any
      
      if (type === 'sensitive') {
        url = item 
          ? `${API_BASE}/api/cargo/sensitive-products/${item.id}`
          : `${API_BASE}/api/cargo/sensitive-products`
        body = sensitiveForm
      } else {
        url = item
          ? `${API_BASE}/api/cargo/inspection-products/${item.id}`
          : `${API_BASE}/api/cargo/inspection-products`
        body = inspectionForm
      }
      
      const response = await fetch(url, {
        method: item ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body)
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        showToast(item ? '更新成功' : '创建成功', 'success')
        onSuccess()
      } else {
        showToast(data.msg || '操作失败', 'error')
      }
    } catch (error) {
      showToast('操作失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {item ? '编辑' : '新增'}{type === 'sensitive' ? '敏感产品' : '查验产品'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {type === 'sensitive' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={sensitiveForm.category}
                  onChange={e => setSensitiveForm({ ...sensitiveForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">请选择分类</option>
                  {categories.map(cat => (
                    <option key={cat.category} value={cat.category}>{cat.category}</option>
                  ))}
                  <option value="__new">+ 新建分类</option>
                </select>
                {sensitiveForm.category === '__new' && (
                  <input
                    type="text"
                    placeholder="输入新分类名称"
                    onChange={e => setSensitiveForm({ ...sensitiveForm, category: e.target.value })}
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">品名 *</label>
                <input
                  type="text"
                  value={sensitiveForm.productName}
                  onChange={e => setSensitiveForm({ ...sensitiveForm, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="如：帐篷、披肩等"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HS编码参考</label>
                <input
                  type="text"
                  value={sensitiveForm.hsCode}
                  onChange={e => setSensitiveForm({ ...sensitiveForm, hsCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="如：6306、6402、6403"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">税率</label>
                  <input
                    type="text"
                    value={sensitiveForm.dutyRate}
                    onChange={e => setSensitiveForm({ ...sensitiveForm, dutyRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="如：12% 或 3%-9.7%"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">产品类型</label>
                  <select
                    value={sensitiveForm.productType}
                    onChange={e => setSensitiveForm({ ...sensitiveForm, productType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="sensitive">高敏感产品</option>
                    <option value="anti_dumping">反倾销产品</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">风险等级</label>
                <select
                  value={sensitiveForm.riskLevel}
                  onChange={e => setSensitiveForm({ ...sensitiveForm, riskLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">风险说明</label>
                <textarea
                  value={sensitiveForm.riskNotes}
                  onChange={e => setSensitiveForm({ ...sensitiveForm, riskNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="备注信息..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">品名 *</label>
                <input
                  type="text"
                  value={inspectionForm.productName}
                  onChange={e => setInspectionForm({ ...inspectionForm, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="如：喷墨打印机"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HS编码 *</label>
                <input
                  type="text"
                  value={inspectionForm.hsCode}
                  onChange={e => setInspectionForm({ ...inspectionForm, hsCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="10位HS编码，如：8443328000"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">税率 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inspectionForm.dutyRate}
                    onChange={e => setInspectionForm({ ...inspectionForm, dutyRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">查验率 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={inspectionForm.inspectionRate}
                    onChange={e => setInspectionForm({ ...inspectionForm, inspectionRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="历史查验率"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">风险等级</label>
                <select
                  value={inspectionForm.riskLevel}
                  onChange={e => setInspectionForm({ ...inspectionForm, riskLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="high">高风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">风险说明</label>
                <textarea
                  value={inspectionForm.riskNotes}
                  onChange={e => setInspectionForm({ ...inspectionForm, riskNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="备注信息..."
                />
              </div>
            </>
          )}
        </div>
        
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (type === 'sensitive' ? !sensitiveForm.productName : !inspectionForm.productName || !inspectionForm.hsCode)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
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
  )
}

