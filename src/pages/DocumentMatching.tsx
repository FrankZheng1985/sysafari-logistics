import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  FileCheck, CheckCircle, XCircle, RefreshCw, Search,
  ChevronDown, AlertTriangle, Edit2, Check, X,
  Save, MapPin, Package, FileText, Globe, Zap
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl, getAuthHeaders, lookupTaricRealtime } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface ImportBatch {
  id: number
  importNo: string
  customerName: string
  containerNo: string
  totalItems: number
  matchedItems: number
  pendingItems: number
  status: string
}

interface ReviewItem {
  id: number
  importId: number
  itemNo: number
  productName: string
  productNameEn: string
  customerHsCode: string
  matchedHsCode: string
  matchConfidence: number
  matchSource: string
  quantity: number
  unitName: string
  totalValue: number
  originCountry: string
  material: string
  materialEn: string
  usageScenario: string
  matchStatus: string
  dutyRate: number
  vatRate: number
  antiDumpingRate: number
  countervailingRate: number
  reviewedAt: string
  reviewedBy: string
}

interface Recommendation {
  hsCode: string
  confidence: number
  source: string
  reason: string
  productName: string
  dutyRate: number
  vatRate: number
}

// 价格异常检测结果
interface PriceAnomalyItem {
  itemId: number
  productName: string
  currentUnitPrice: number
  currentKgPrice: number
  hasAnomaly: boolean
  isNewProduct: boolean
  priceDeviation?: string
  historyAvgPrice?: number
  historyMinPrice?: number
  historyMaxPrice?: number
  matchCount?: number
  hsCode?: string
  anomalyReasons?: string[]
  message: string
}

export default function DocumentMatching() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const importIdParam = searchParams.get('importId')

  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [editHsCode, setEditHsCode] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // 批次筛选：未匹配批次 / 已匹配批次
  const [batchFilter, setBatchFilter] = useState<'unmatched' | 'matched'>('unmatched')

  // 已匹配商品列表
  const [matchedItems, setMatchedItems] = useState<ReviewItem[]>([])
  const [matchedTotal, setMatchedTotal] = useState(0)
  const [matchedPage, setMatchedPage] = useState(1)
  const [loadingMatched, setLoadingMatched] = useState(false)

  // 整个提单的原产地设置弹窗
  const [showOriginModal, setShowOriginModal] = useState(false)
  const [batchOriginCountry, setBatchOriginCountry] = useState('')
  const [savingOrigin, setSavingOrigin] = useState(false)

  // 编辑单个商品的材质和用途
  const [editingDetail, setEditingDetail] = useState<ReviewItem | null>(null)
  const [detailForm, setDetailForm] = useState({
    material: '',
    materialEn: '',
    usageScenario: ''
  })
  const [savingDetail, setSavingDetail] = useState(false)

  // 价格异常检测
  const [priceAnomalies, setPriceAnomalies] = useState<Map<number, PriceAnomalyItem>>(new Map())
  const [checkingPrice, setCheckingPrice] = useState(false)
  const [anomalyCount, setAnomalyCount] = useState(0)

  // 实时查询HS编码
  const [queryHsCode, setQueryHsCode] = useState('')
  const [queryOriginCountry, setQueryOriginCountry] = useState('')
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryResult, setQueryResult] = useState<{
    hsCode: string
    description: string
    descriptionCn: string
    dutyRate: string
    vatRate: string
    antiDumpingRate: string
    countervailingRate: string
    dataSource: string
    savedToDb: string
  } | null>(null)

  useEffect(() => {
    loadBatches()
  }, [])

  useEffect(() => {
    if (importIdParam) {
      const batch = batches.find(b => b.id === parseInt(importIdParam))
      if (batch) {
        setSelectedBatch(batch)
      }
    }
  }, [importIdParam, batches])

  useEffect(() => {
    if (selectedBatch) {
      loadReviewItems()
      loadMatchedItems()
      checkPriceAnomalies()
    }
  }, [selectedBatch, page])

  // 已匹配列表分页变化时重新加载
  useEffect(() => {
    if (selectedBatch && batchFilter === 'matched') {
      loadMatchedItems()
    }
  }, [matchedPage])

  // 价格异常检测
  const checkPriceAnomalies = async () => {
    if (!selectedBatch) return
    setCheckingPrice(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports/${selectedBatch.id}/price-check`)
      const data = await res.json()
      if (data.errCode === 200 && data.data?.items) {
        const anomalyMap = new Map<number, PriceAnomalyItem>()
        data.data.items.forEach((item: PriceAnomalyItem) => {
          anomalyMap.set(item.itemId, item)
        })
        setPriceAnomalies(anomalyMap)
        setAnomalyCount(data.data.anomalyCount || 0)
      }
    } catch (error) {
      console.error('价格异常检测失败:', error)
    } finally {
      setCheckingPrice(false)
    }
  }

  // 实时查询HS编码税率
  const handleQueryHs = async () => {
    if (!queryHsCode || queryHsCode.length < 6) {
      setQueryError('请输入至少6位的 HS 编码')
      return
    }

    setQueryLoading(true)
    setQueryError(null)
    setQueryResult(null)

    try {
      const response = await lookupTaricRealtime(queryHsCode, queryOriginCountry || undefined, true)
      if (response.errCode === 200 && response.data) {
        setQueryResult({
          hsCode: response.data.hsCode || queryHsCode,
          description: response.data.description || '',
          descriptionCn: response.data.descriptionCn || '',
          dutyRate: response.data.dutyRate || '0',
          vatRate: response.data.vatRate || '0',
          antiDumpingRate: response.data.antiDumpingRate || '0',
          countervailingRate: response.data.countervailingRate || '0',
          dataSource: response.data.dataSource || 'unknown',
          savedToDb: response.data.savedToDb || ''
        })
      } else {
        setQueryError(response.msg || '查询失败')
      }
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setQueryLoading(false)
    }
  }

  const loadBatches = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/imports?pageSize=100`)
      const data = await res.json()
      if (data.errCode === 200) {
        setBatches(data.data?.list || [])
        // 如果有importId参数，选中对应批次
        if (importIdParam) {
          const batch = data.data?.list?.find((b: ImportBatch) => b.id === parseInt(importIdParam))
          if (batch) {
            setSelectedBatch(batch)
          }
        }
      }
    } catch (error) {
      console.error('加载批次列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadReviewItems = async () => {
    if (!selectedBatch) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/review?importId=${selectedBatch.id}&page=${page}&pageSize=${pageSize}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setItems(data.data?.list || [])
        setTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载待审核列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载已匹配的商品列表
  const loadMatchedItems = async () => {
    if (!selectedBatch) return
    setLoadingMatched(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/matched?importId=${selectedBatch.id}&page=${matchedPage}&pageSize=${pageSize}`)
      const data = await res.json()
      if (data.errCode === 200) {
        setMatchedItems(data.data?.list || [])
        setMatchedTotal(data.data?.total || 0)
      }
    } catch (error) {
      console.error('加载已匹配列表失败:', error)
    } finally {
      setLoadingMatched(false)
    }
  }

  const handleRunMatch = async () => {
    if (!selectedBatch) return
    setMatching(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ importId: selectedBatch.id })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert(`匹配完成！自动通过: ${data.data?.matched || 0}, 待审核: ${data.data?.review || 0}`)
        loadBatches()
        loadReviewItems()
      } else {
        alert(data.msg || '匹配失败')
      }
    } catch (error) {
      console.error('匹配失败:', error)
      alert('匹配失败')
    } finally {
      setMatching(false)
    }
  }

  const handleBatchAction = async (action: 'approve' | 'reject') => {
    if (selectedItems.length === 0) {
      alert('请先选择要操作的项目')
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          itemIds: selectedItems,
          action
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        alert(`${action === 'approve' ? '批准' : '拒绝'}成功`)
        setSelectedItems([])
        loadReviewItems()
        loadBatches()
      } else {
        alert(data.msg || '操作失败')
      }
    } catch (error) {
      console.error('操作失败:', error)
      alert('操作失败')
    }
  }

  const handleEditHs = async (item: ReviewItem) => {
    setEditingItem(item.id)
    setEditHsCode(item.matchedHsCode || item.customerHsCode || '')
    
    // 加载推荐（传递原产国参数以获取正确的关税税率）
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          productName: item.productName,
          productNameEn: item.productNameEn,
          material: item.material,
          originCountry: item.originCountry || 'CN'
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setRecommendations(data.data || [])
        setShowRecommendations(true)
      }
    } catch (error) {
      console.error('加载推荐失败:', error)
    }
  }

  const handleSaveHs = async (itemId: number) => {
    if (!editHsCode.trim()) {
      alert('请输入HS编码')
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          itemIds: [itemId],
          action: 'approve',
          hsCode: editHsCode.trim()
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setEditingItem(null)
        setShowRecommendations(false)
        loadReviewItems()
        loadBatches()
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    }
  }

  const handleSelectRecommendation = (hsCode: string) => {
    setEditHsCode(hsCode)
  }

  // 打开设置整个提单原产地的弹窗
  const handleOpenOriginModal = () => {
    // 获取当前批次商品的原产地（如果有的话）
    const existingOrigin = items.find(i => i.originCountry)?.originCountry || ''
    setBatchOriginCountry(existingOrigin)
    setShowOriginModal(true)
  }

  // 保存整个提单的原产地
  const handleSaveBatchOrigin = async () => {
    if (!selectedBatch) return
    if (!batchOriginCountry.trim()) {
      alert('请输入原产地国家代码')
      return
    }
    
    // 验证国家代码格式（2位字母）
    if (!/^[A-Z]{2}$/i.test(batchOriginCountry.trim())) {
      alert('原产国代码格式错误，应为2位字母（如 CN, US, DE）')
      return
    }
    
    setSavingOrigin(true)
    try {
      // 批量更新所有商品的原产地
      const itemIds = items.map(i => i.id)
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/batch-origin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          importId: selectedBatch.id,
          originCountry: batchOriginCountry.trim().toUpperCase()
        })
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setShowOriginModal(false)
        loadReviewItems()
        alert(data.errMsg || '原产地已更新')
      } else {
        alert(data.msg || '更新失败')
      }
    } catch (error) {
      console.error('更新原产地失败:', error)
      alert('更新失败')
    } finally {
      setSavingOrigin(false)
    }
  }

  // 打开编辑商品材质/用途弹窗
  const handleEditDetail = (item: ReviewItem) => {
    setEditingDetail(item)
    setDetailForm({
      material: item.material || '',
      materialEn: item.materialEn || '',
      usageScenario: item.usageScenario || ''
    })
  }

  // 保存商品材质/用途
  const handleSaveDetail = async () => {
    if (!editingDetail) return
    
    setSavingDetail(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/item/${editingDetail.id}/detail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(detailForm)
      })
      const data = await res.json()
      if (data.errCode === 200) {
        setEditingDetail(null)
        loadReviewItems()
        alert(data.errMsg || '保存成功')
      } else {
        alert(data.msg || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败')
    } finally {
      setSavingDetail(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.map(i => i.id))
    }
  }

  const toggleSelectItem = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">高 {confidence}%</span>
    } else if (confidence >= 60) {
      return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">中 {confidence}%</span>
    } else if (confidence > 0) {
      return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">低 {confidence}%</span>
    } else {
      return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px]">未匹配</span>
    }
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      exact: '精确匹配',
      prefix_8: '8位前缀',
      prefix_6: '6位前缀',
      history: '历史学习',
      fuzzy: '模糊匹配',
      manual: '人工指定'
    }
    return labels[source] || source || '-'
  }

  // 获取未匹配的批次（还有待审核商品的批次）
  const unmatchedBatches = batches.filter(b => b.pendingItems > 0 || b.matchedItems < b.totalItems)
  // 获取已匹配的批次（所有商品都已匹配）
  const matchedBatches = batches.filter(b => b.pendingItems === 0 && b.matchedItems >= b.totalItems)

  const filteredBatches = batchFilter === 'unmatched' ? unmatchedBatches : matchedBatches

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
    { label: '匹配记录库', path: '/documents/match-records' },
    { label: '敏感产品库', path: '/documents/sensitive-products' },
  ]

  const totalPages = Math.ceil(total / pageSize)

  // 检查当前批次是否缺少原产地
  const hasMissingOrigin = items.some(i => !i.originCountry)
  // 获取当前批次的原产地（所有商品应该一样）
  const currentBatchOrigin = items.find(i => i.originCountry)?.originCountry || ''

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="单证管理"
        icon={<FileCheck className="w-5 h-5 text-primary-600" />}
        tabs={tabs}
        activeTab="/documents/matching"
        onTabChange={(path) => navigate(path)}
      />

      {/* 批次选择 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {/* 批次筛选 Tab */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setBatchFilter('unmatched'); setSelectedBatch(null) }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                batchFilter === 'unmatched' 
                  ? 'bg-white text-amber-700 shadow-sm font-medium' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              未匹配批次 ({unmatchedBatches.length})
            </button>
            <button
              onClick={() => { setBatchFilter('matched'); setSelectedBatch(null) }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                batchFilter === 'matched' 
                  ? 'bg-white text-green-700 shadow-sm font-medium' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              已匹配批次 ({matchedBatches.length})
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              选择导入批次
              {batchFilter === 'unmatched' && unmatchedBatches.length > 0 && (
                <span className="text-amber-600 ml-2">（显示有待匹配商品的批次）</span>
              )}
            </label>
            <div className="relative">
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => {
                  const batch = batches.find(b => b.id === parseInt(e.target.value))
                  setSelectedBatch(batch || null)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm appearance-none bg-white"
                title="选择导入批次"
              >
                <option value="">请选择批次</option>
                {filteredBatches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.importNo} - {batch.containerNo || '无柜号'} 
                    ({batch.matchedItems}/{batch.totalItems}件已匹配)
                    {batch.pendingItems > 0 ? ` [待审核${batch.pendingItems}]` : ' ✓'}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          {selectedBatch && (
            <>
              <div className="text-center">
                <div className="text-xs text-gray-500">商品总数</div>
                <div className="text-lg font-semibold">{selectedBatch.totalItems}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">已匹配</div>
                <div className="text-lg font-semibold text-green-600">{selectedBatch.matchedItems}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">待审核</div>
                <div className="text-lg font-semibold text-amber-600">{selectedBatch.pendingItems}</div>
              </div>
              <button
                onClick={handleRunMatch}
                disabled={matching}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
              >
                {matching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {matching ? '匹配中...' : '执行匹配'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 原产地设置提示 */}
      {selectedBatch && hasMissingOrigin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-800">
                请设置该提单货物的原产地
              </h4>
              <p className="text-xs text-amber-700 mt-1">
                原产地会影响关税税率计算，特别是反倾销税和反补贴税。一个提单的货物通常来自同一原产国。
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenOriginModal}
            className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 flex items-center gap-2"
          >
            <MapPin className="w-4 h-4" />
            设置原产地
          </button>
        </div>
      )}

      {/* 已设置原产地显示 */}
      {selectedBatch && !hasMissingOrigin && currentBatchOrigin && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">
              该提单原产地：
              <span className="font-medium ml-1 px-2 py-0.5 bg-green-100 rounded">
                {currentBatchOrigin}
              </span>
            </span>
          </div>
          <button
            onClick={handleOpenOriginModal}
            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            修改
          </button>
        </div>
      )}

      {/* 价格异常提示 */}
      {selectedBatch && anomalyCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-800">
              发现 {anomalyCount} 个价格异常商品
            </h4>
            <p className="text-xs text-red-700 mt-1">
              以下商品的申报价格与历史记录差异超过±5%，请仔细核对后再审核通过
            </p>
          </div>
        </div>
      )}

      {/* HS编码实时查询 */}
      {selectedBatch && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">HS编码实时查询</h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">EU TARIC</span>
            </div>
            
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs">
                <label className="block text-xs text-gray-600 mb-1">HS 编码 (8-10位)</label>
                <input
                  type="text"
                  value={queryHsCode}
                  onChange={(e) => setQueryHsCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="如: 6109100010"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleQueryHs()}
                />
              </div>
              <div className="w-40">
                <label className="block text-xs text-gray-600 mb-1">原产国 (可选)</label>
                <input
                  type="text"
                  value={queryOriginCountry}
                  onChange={(e) => setQueryOriginCountry(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="如: CN"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleQueryHs()}
                />
              </div>
              <button
                onClick={handleQueryHs}
                disabled={queryLoading || !queryHsCode}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {queryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {queryLoading ? '查询中...' : '实时查询'}
              </button>
              {queryResult && (
                <button
                  onClick={() => { setQueryResult(null); setQueryHsCode(''); setQueryOriginCountry(''); }}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50"
                >
                  清空
                </button>
              )}
            </div>

            {/* 错误提示 */}
            {queryError && (
              <div className="mt-3 p-2 bg-red-50 text-red-700 rounded text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {queryError}
              </div>
            )}

            {/* 查询结果 */}
            {queryResult && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">查询结果</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      queryResult.dataSource === 'taric' || queryResult.dataSource === 'eu_api'
                        ? 'bg-blue-100 text-blue-700'
                        : queryResult.dataSource === 'local_database'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {queryResult.dataSource === 'taric' || queryResult.dataSource === 'eu_api' ? '🇪🇺 EU TARIC' :
                       queryResult.dataSource === 'local_database' ? '📦 本地数据库' : queryResult.dataSource}
                    </span>
                    {queryResult.savedToDb && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        queryResult.savedToDb === 'inserted' ? 'bg-green-100 text-green-700' :
                        queryResult.savedToDb === 'updated' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {queryResult.savedToDb === 'inserted' ? '✓ 已新增' :
                         queryResult.savedToDb === 'updated' ? '✓ 已更新' : 
                         queryResult.savedToDb === 'exists' ? '已存在' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">HS编码:</span>
                      <span className="ml-2 font-mono font-medium text-blue-600">{queryResult.hsCode}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">关税率:</span>
                      <span className="ml-2 font-medium text-amber-600">{queryResult.dutyRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">增值税:</span>
                      <span className="ml-2 font-medium">{queryResult.vatRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">反倾销税:</span>
                      <span className="ml-2 font-medium">{queryResult.antiDumpingRate}%</span>
                    </div>
                  </div>
                  {queryResult.descriptionCn && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-gray-500 text-xs">商品描述:</span>
                      <p className="text-xs text-gray-700 mt-1">{queryResult.descriptionCn}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 审核列表 */}
      {selectedBatch && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-900">
                待审核项目 ({total}条)
              </h3>
              {checkingPrice && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  检测价格中...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && (
                <>
                  <span className="text-xs text-gray-500">已选 {selectedItems.length} 项</span>
                  <button
                    onClick={() => handleBatchAction('approve')}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    批量通过
                  </button>
                  <button
                    onClick={() => handleBatchAction('reject')}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    批量拒绝
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === items.length && items.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                      title="全选"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">行号</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">商品名称</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">原产地</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">材质</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">客户HS</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">匹配HS</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">置信度</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">来源</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">货值</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : items.length === 0 && matchedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      没有待审核项目
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      所有商品已审核完成，请查看下方已匹配列表
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const anomaly = priceAnomalies.get(item.id)
                    const hasAnomaly = anomaly?.hasAnomaly || false
                    const missingMaterial = !item.material
                    return (
                    <tr key={item.id} className={`border-b hover:bg-gray-50 ${hasAnomaly ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="rounded border-gray-300"
                          title={`选择项目 ${item.itemNo}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-500">{item.itemNo}</td>
                      <td className="px-3 py-2">
                        <div className="max-w-[200px]">
                          <div className="flex items-center gap-1">
                            <span className="font-medium truncate" title={item.productName}>{item.productName}</span>
                            {hasAnomaly && (
                              <span 
                                className="flex-shrink-0 cursor-help" 
                                title={anomaly?.message || '价格异常'}
                              >
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              </span>
                            )}
                          </div>
                          {item.usageScenario && (
                            <div className="text-gray-400 text-[10px] truncate">用途: {item.usageScenario}</div>
                          )}
                          {/* 价格异常详情 */}
                          {hasAnomaly && anomaly && (
                            <div className="text-[10px] text-red-600 mt-0.5">
                              {anomaly.anomalyReasons?.map((r, i) => (
                                <span key={i} className="mr-2">{r}</span>
                              ))}
                              <span className="text-gray-400 ml-1">
                                (历史均价: €{anomaly.historyAvgPrice?.toFixed(2)})
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.originCountry === 'CN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.originCountry || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.material ? (
                          <span className="text-gray-600 text-[10px] truncate max-w-[60px] inline-block" title={item.material}>
                            {item.material.length > 8 ? item.material.slice(0, 8) + '...' : item.material}
                          </span>
                        ) : (
                          <span className="text-amber-500 text-[10px] flex items-center justify-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            待填
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{item.customerHsCode || '-'}</td>
                      <td className="px-3 py-2">
                        {editingItem === item.id ? (
                          <input
                            type="text"
                            value={editHsCode}
                            onChange={(e) => setEditHsCode(e.target.value)}
                            className="w-24 px-2 py-1 border border-primary-300 rounded text-xs font-mono"
                            placeholder="输入HS编码"
                          />
                        ) : (
                          <span className="font-mono">{item.matchedHsCode || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {getConfidenceBadge(item.matchConfidence)}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{getSourceLabel(item.matchSource)}</td>
                      <td className="px-3 py-2 text-right">€{item.totalValue.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {editingItem === item.id ? (
                            <>
                              <button
                                onClick={() => handleSaveHs(item.id)}
                                className="p-1 hover:bg-green-100 rounded text-green-600"
                                title="保存"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(null)
                                  setShowRecommendations(false)
                                }}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500"
                                title="取消"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* 编辑材质/用途按钮 */}
                              <button
                                onClick={() => handleEditDetail(item)}
                                className={`p-1 hover:bg-amber-100 rounded ${missingMaterial ? 'text-amber-500' : 'text-gray-400'} hover:text-amber-600`}
                                title="编辑材质/用途"
                              >
                                <Package className="w-4 h-4" />
                              </button>
                              {/* 编辑HS编码按钮 */}
                              <button
                                onClick={() => handleEditHs(item)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                                title="编辑HS编码"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {total > pageSize && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                共 {total} 条，第 {page}/{totalPages} 页
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 已匹配商品列表 */}
      {selectedBatch && matchedItems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mt-4">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-green-50">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="text-sm font-medium text-gray-900">
                已匹配商品 ({matchedTotal}条)
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">行号</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">商品名称</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">原产地</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">材质</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">客户HS</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">匹配HS</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">状态</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">关税率</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">货值</th>
                </tr>
              </thead>
              <tbody>
                {loadingMatched ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : (
                  matchedItems.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{item.itemNo}</td>
                      <td className="px-3 py-2">
                        <div className="max-w-[200px]">
                          <span className="font-medium truncate" title={item.productName}>{item.productName}</span>
                          {item.productNameEn && (
                            <div className="text-gray-400 text-[10px] truncate">{item.productNameEn}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[32px] px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.originCountry === 'CN' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.originCountry || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-gray-600 text-[10px] truncate max-w-[60px] inline-block" title={item.material || ''}>
                          {item.material ? (item.material.length > 8 ? item.material.slice(0, 8) + '...' : item.material) : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-gray-500">{item.customerHsCode || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-green-600 font-medium">{item.matchedHsCode}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.matchStatus === 'auto_approved' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.matchStatus === 'auto_approved' ? '自动匹配' : '人工审核'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={item.dutyRate > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          {item.dutyRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">€{item.totalValue?.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 已匹配列表分页 */}
          {matchedTotal > pageSize && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                共 {matchedTotal} 条，第 {matchedPage} / {Math.ceil(matchedTotal / pageSize)} 页
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMatchedPage(p => Math.max(1, p - 1))}
                  disabled={matchedPage === 1}
                  className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setMatchedPage(p => Math.min(Math.ceil(matchedTotal / pageSize), p + 1))}
                  disabled={matchedPage === Math.ceil(matchedTotal / pageSize)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HS推荐面板 */}
      {showRecommendations && recommendations.length > 0 && (
        <div className="fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium">HS编码推荐</span>
              <button
                onClick={() => setShowRecommendations(false)}
                className="p-1 hover:bg-gray-100 rounded"
                title="关闭推荐"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectRecommendation(rec.hsCode)}
                className="px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-primary-600">{rec.hsCode}</span>
                  {getConfidenceBadge(rec.confidence)}
                </div>
                <div className="text-xs text-gray-600 mt-1 truncate">{rec.productName}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{rec.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 设置整个提单原产地弹窗 */}
      {showOriginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary-600" />
                <h3 className="text-lg font-medium text-gray-900">设置提单原产地</h3>
              </div>
              <button
                onClick={() => setShowOriginModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  原产国代码
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={batchOriginCountry}
                  onChange={(e) => setBatchOriginCountry(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-medium uppercase focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center"
                  placeholder="CN"
                  maxLength={2}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  请输入2位国家代码，例如：CN (中国), US (美国), DE (德国), JP (日本)
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-700">
                    <p className="font-medium mb-1">原产地影响关税计算</p>
                    <ul className="space-y-0.5 text-blue-600">
                      <li>• 不同原产国可能有不同的关税税率</li>
                      <li>• 某些原产国商品可能需要缴纳反倾销税或反补贴税</li>
                      <li>• 设置后将应用到该提单的所有 {items.length} 件商品</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowOriginModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSaveBatchOrigin}
                disabled={savingOrigin || !batchOriginCountry.trim()}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {savingOrigin ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存并应用
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑商品材质/用途弹窗 */}
      {editingDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">编辑材质和用途</h3>
                <p className="text-sm text-gray-500 mt-1">
                  行号 {editingDetail.itemNo}: {editingDetail.productName}
                </p>
              </div>
              <button
                onClick={() => setEditingDetail(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              {/* 材质 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Package className="w-4 h-4 inline mr-1" />
                    材质（中文）
                  </label>
                  <input
                    type="text"
                    value={detailForm.material}
                    onChange={(e) => setDetailForm({ ...detailForm, material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="如：塑料、金属、木材"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    材质（英文）
                  </label>
                  <input
                    type="text"
                    value={detailForm.materialEn}
                    onChange={(e) => setDetailForm({ ...detailForm, materialEn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. Plastic, Metal"
                  />
                </div>
              </div>

              {/* 用途 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  用途/使用场景
                </label>
                <input
                  type="text"
                  value={detailForm.usageScenario}
                  onChange={(e) => setDetailForm({ ...detailForm, usageScenario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="如：家用、工业用、装饰用"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <strong>提示：</strong>材质和用途信息有助于更准确地匹配HS编码
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setEditingDetail(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSaveDetail}
                disabled={savingDetail}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {savingDetail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 无批次提示 */}
      {!selectedBatch && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-amber-700">
            {filteredBatches.length === 0 
              ? (batchFilter === 'unmatched' ? '没有待匹配的批次' : '没有已匹配的批次')
              : '请先选择一个导入批次进行HS匹配审核'
            }
          </p>
          {batchFilter === 'unmatched' && filteredBatches.length === 0 && matchedBatches.length > 0 && (
            <button
              onClick={() => setBatchFilter('matched')}
              className="mt-3 px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              查看已匹配批次
            </button>
          )}
          {filteredBatches.length === 0 && unmatchedBatches.length === 0 && matchedBatches.length === 0 && (
            <button
              onClick={() => navigate('/documents/import')}
              className="mt-3 px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
            >
              去导入货物
            </button>
          )}
        </div>
      )}
    </div>
  )
}
