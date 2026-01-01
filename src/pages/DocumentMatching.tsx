import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  FileCheck, CheckCircle, XCircle, RefreshCw, Search,
  ChevronDown, AlertTriangle, Edit2, Check, X, TrendingUp, TrendingDown
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

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
  matchStatus: string
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

  // 价格异常检测
  const [priceAnomalies, setPriceAnomalies] = useState<Map<number, PriceAnomalyItem>>(new Map())
  const [checkingPrice, setCheckingPrice] = useState(false)
  const [anomalyCount, setAnomalyCount] = useState(0)

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
      checkPriceAnomalies()
    }
  }, [selectedBatch, page])

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

  const handleRunMatch = async () => {
    if (!selectedBatch) return
    setMatching(true)
    try {
      const res = await fetch(`${API_BASE}/api/cargo/documents/matching/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  const tabs = [
    { label: '单证概览', path: '/documents' },
    { label: '货物导入', path: '/documents/import' },
    { label: 'HS匹配审核', path: '/documents/matching' },
    { label: '税费计算', path: '/documents/tax-calc' },
    { label: '数据补充', path: '/documents/supplement' },
  ]

  const totalPages = Math.ceil(total / pageSize)

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
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">选择导入批次</label>
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
                {batches.map(batch => (
                  <option key={batch.id} value={batch.id}>
                    {batch.importNo} - {batch.containerNo || '无柜号'} ({batch.totalItems}件)
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

      {/* 价格异常提示 */}
      {selectedBatch && anomalyCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-800">
              发现 {anomalyCount} 个价格异常商品
            </h4>
            <p className="text-xs text-amber-700 mt-1">
              以下商品的申报价格与历史记录差异超过±5%，请仔细核对后再审核通过
            </p>
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
                  <th className="px-3 py-2 text-center font-medium text-gray-500">原产国</th>
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
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      加载中...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      没有待审核项目
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const anomaly = priceAnomalies.get(item.id)
                    const hasAnomaly = anomaly?.hasAnomaly || false
                    return (
                    <tr key={item.id} className={`border-b hover:bg-gray-50 ${hasAnomaly ? 'bg-amber-50' : ''}`}>
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
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              </span>
                            )}
                          </div>
                          {item.material && (
                            <div className="text-gray-400 text-[10px] truncate">{item.material}</div>
                          )}
                          {/* 价格异常详情 */}
                          {hasAnomaly && anomaly && (
                            <div className="text-[10px] text-amber-600 mt-0.5">
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
                          {item.originCountry || 'CN'}
                        </span>
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
                            <button
                              onClick={() => handleEditHs(item)}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                              title="编辑HS"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
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

      {/* 无批次提示 */}
      {!selectedBatch && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-amber-700">请先选择一个导入批次进行HS匹配审核</p>
          <button
            onClick={() => navigate('/documents/import')}
            className="mt-3 px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
          >
            去导入货物
          </button>
        </div>
      )}
    </div>
  )
}
