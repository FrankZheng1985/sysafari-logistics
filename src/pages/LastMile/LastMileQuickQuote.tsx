import { useState, useEffect } from 'react'
import { 
  Calculator, Search, RefreshCw, TrendingUp, 
  Package, MapPin, DollarSign, ArrowRight,
  Check, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react'
import PageHeader from '../../components/PageHeader'
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

interface QuoteResult {
  success: boolean
  error?: string
  data?: {
    actualWeight: number
    volumeWeight: number
    chargeableWeight: number
    zoneCode: string
    zoneName: string
    rateCardId: number
    priceUnit: string
    weightRange: string
    basePurchasePrice: number
    baseSalesPrice: number
    purchaseCost: number
    salesAmount: number
    surcharges: Array<{
      code: string
      name: string
      purchaseAmount: number
      salesAmount: number
    }>
    totalPurchaseSurcharge: number
    totalSalesSurcharge: number
    totalPurchase: number
    totalSales: number
    profit: number
    profitRate: number
    currency: string
  }
}

interface CompareQuote {
  carrierId: number
  carrierCode: string
  carrierName: string
  success: boolean
  error?: string
  data?: QuoteResult['data']
}

// ==================== 主组件 ====================

export default function LastMileQuickQuote() {
  // 状态
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  
  // 表单数据
  const [carrierId, setCarrierId] = useState<number | null>(null)
  const [zoneCode, setZoneCode] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [weight, setWeight] = useState('')
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' })
  const [useDimensions, setUseDimensions] = useState(false)
  
  // 计算结果
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null)
  const [compareResults, setCompareResults] = useState<CompareQuote[]>([])
  const [showCompare, setShowCompare] = useState(false)

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

  // 获取Zone列表
  const fetchZones = async (cId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/carriers/${cId}/zones`)
      const data = await res.json()
      if (data.errCode === 200) {
        setZones(data.data)
      }
    } catch (error) {
      console.error('获取Zone列表失败:', error)
    }
  }

  useEffect(() => {
    fetchCarriers()
  }, [])

  useEffect(() => {
    if (carrierId) {
      fetchZones(carrierId)
      setZoneCode('')
    } else {
      setZones([])
    }
  }, [carrierId])

  // 根据邮编匹配Zone
  const matchZone = async () => {
    if (!carrierId || !postalCode) return
    
    try {
      const res = await fetch(`${API_BASE}/api/last-mile/match-zone?carrierId=${carrierId}&postalCode=${postalCode}`)
      const data = await res.json()
      
      if (data.errCode === 200 && data.data) {
        setZoneCode(data.data.zoneCode)
      }
    } catch (error) {
      console.error('匹配Zone失败:', error)
    }
  }

  // 计算报价
  const handleCalculate = async () => {
    if (!carrierId || (!zoneCode && !postalCode) || !weight) {
      alert('请选择承运商，填写Zone或邮编，以及重量')
      return
    }
    
    setLoading(true)
    setQuoteResult(null)
    
    try {
      const payload: any = {
        carrierId,
        weight: parseFloat(weight)
      }
      
      if (zoneCode) {
        payload.zoneCode = zoneCode
      } else if (postalCode) {
        payload.postalCode = postalCode
      }
      
      if (useDimensions && dimensions.length && dimensions.width && dimensions.height) {
        payload.dimensions = {
          length: parseFloat(dimensions.length),
          width: parseFloat(dimensions.width),
          height: parseFloat(dimensions.height)
        }
      }
      
      const res = await fetch(`${API_BASE}/api/last-mile/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setQuoteResult({ success: true, data: data.data })
      } else {
        setQuoteResult({ success: false, error: data.msg })
      }
    } catch (error) {
      console.error('计算失败:', error)
      setQuoteResult({ success: false, error: '计算失败，请重试' })
    } finally {
      setLoading(false)
    }
  }

  // 多承运商比价
  const handleCompare = async () => {
    if ((!zoneCode && !postalCode) || !weight) {
      alert('请填写Zone或邮编，以及重量')
      return
    }
    
    setComparing(true)
    setCompareResults([])
    setShowCompare(true)
    
    try {
      const payload: any = {
        weight: parseFloat(weight)
      }
      
      if (zoneCode) {
        payload.zoneCode = zoneCode
      } else if (postalCode) {
        payload.postalCode = postalCode
      }
      
      if (useDimensions && dimensions.length && dimensions.width && dimensions.height) {
        payload.dimensions = {
          length: parseFloat(dimensions.length),
          width: parseFloat(dimensions.width),
          height: parseFloat(dimensions.height)
        }
      }
      
      const res = await fetch(`${API_BASE}/api/last-mile/compare-quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      
      if (data.errCode === 200) {
        setCompareResults(data.data)
      }
    } catch (error) {
      console.error('比价失败:', error)
    } finally {
      setComparing(false)
    }
  }

  // 重置表单
  const handleReset = () => {
    setCarrierId(null)
    setZoneCode('')
    setPostalCode('')
    setWeight('')
    setDimensions({ length: '', width: '', height: '' })
    setUseDimensions(false)
    setQuoteResult(null)
    setCompareResults([])
    setShowCompare(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="快速报价计算器"
        subtitle="根据承运商、Zone、重量快速计算运费和利润"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧：输入表单 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              报价参数
            </h3>

            {/* 承运商选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                承运商
              </label>
              <select
                value={carrierId || ''}
                onChange={(e) => setCarrierId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择承运商</option>
                {carriers.map(carrier => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.carrierCode} - {carrier.carrierName}
                  </option>
                ))}
              </select>
            </div>

            {/* Zone选择 / 邮编 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone区域
                </label>
                <select
                  value={zoneCode}
                  onChange={(e) => setZoneCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!carrierId}
                >
                  <option value="">选择Zone</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.zoneCode}>
                      {zone.zoneCode} - {zone.zoneName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  或输入邮编
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="邮编"
                  />
                  <button
                    onClick={matchZone}
                    disabled={!carrierId || !postalCode}
                    className="px-2 py-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                    title="自动匹配Zone"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 重量 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                重量 (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="输入重量"
                min={0}
                step={0.1}
              />
            </div>

            {/* 尺寸（可选） */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="useDimensions"
                  checked={useDimensions}
                  onChange={(e) => setUseDimensions(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="useDimensions" className="text-sm font-medium text-gray-700">
                  计算体积重
                </label>
              </div>
              {useDimensions && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      type="number"
                      value={dimensions.length}
                      onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })}
                      className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="长(cm)"
                      min={0}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={dimensions.width}
                      onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })}
                      className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="宽(cm)"
                      min={0}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={dimensions.height}
                      onChange={(e) => setDimensions({ ...dimensions, height: e.target.value })}
                      className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="高(cm)"
                      min={0}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4" />
                )}
                计算报价
              </button>
              <button
                onClick={handleCompare}
                disabled={comparing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                {comparing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                比价
              </button>
            </div>

            <button
              onClick={handleReset}
              className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              重置
            </button>
          </div>
        </div>

        {/* 右侧：计算结果 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 单一报价结果 */}
          {quoteResult && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  报价结果
                </h3>
              </div>
              
              {quoteResult.success && quoteResult.data ? (
                <div className="p-6">
                  {/* 重量信息 */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-500">实际重量</div>
                      <div className="text-xl font-bold">{quoteResult.data.actualWeight} kg</div>
                    </div>
                    {quoteResult.data.volumeWeight > 0 && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500">体积重</div>
                        <div className="text-xl font-bold">{quoteResult.data.volumeWeight} kg</div>
                      </div>
                    )}
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-600">计费重量</div>
                      <div className="text-xl font-bold text-blue-700">{quoteResult.data.chargeableWeight} kg</div>
                    </div>
                  </div>

                  {/* Zone信息 */}
                  <div className="flex items-center gap-2 mb-4 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">Zone:</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">
                      {quoteResult.data.zoneCode}
                    </span>
                    <span className="text-gray-600">{quoteResult.data.zoneName}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="text-gray-500">重量段:</span>
                    <span className="text-gray-700">{quoteResult.data.weightRange} kg</span>
                  </div>

                  {/* 费用明细 */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">费用项</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">采购价</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">销售价</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="px-4 py-3 text-gray-700">基础运费</td>
                          <td className="px-4 py-3 text-right font-mono">{quoteResult.data.purchaseCost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono">{quoteResult.data.salesAmount.toFixed(2)}</td>
                        </tr>
                        {quoteResult.data.surcharges.map((surcharge, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2 text-gray-600 text-sm">{surcharge.name}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm">{surcharge.purchaseAmount.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-mono text-sm">{surcharge.salesAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="border-t bg-gray-50 font-medium">
                          <td className="px-4 py-3">合计</td>
                          <td className="px-4 py-3 text-right font-mono">{quoteResult.data.totalPurchase.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono">{quoteResult.data.totalSales.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 利润汇总 */}
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-green-600">预计利润</div>
                        <div className="text-2xl font-bold text-green-700">
                          {quoteResult.data.currency} {quoteResult.data.profit.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-green-600">利润率</div>
                        <div className="text-2xl font-bold text-green-700">
                          {quoteResult.data.profitRate}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="text-red-600">{quoteResult.error || '计算失败'}</p>
                </div>
              )}
            </div>
          )}

          {/* 多承运商比价结果 */}
          {showCompare && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  承运商比价
                </h3>
                <button
                  onClick={() => setShowCompare(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  收起
                </button>
              </div>
              
              <div className="p-4">
                {comparing ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : compareResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无比价结果
                  </div>
                ) : (
                  <div className="space-y-3">
                    {compareResults.map((result, idx) => (
                      <div
                        key={result.carrierId}
                        className={`border rounded-lg p-4 ${idx === 0 && result.success ? 'border-green-300 bg-green-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {idx === 0 && result.success && (
                              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded">最低价</span>
                            )}
                            <span className="font-medium">{result.carrierCode}</span>
                            <span className="text-gray-500">{result.carrierName}</span>
                          </div>
                          {result.success && result.data ? (
                            <div className="text-right">
                              <div className="text-sm text-gray-500">采购成本</div>
                              <div className="font-bold text-lg">{result.data.currency} {result.data.totalPurchase.toFixed(2)}</div>
                            </div>
                          ) : (
                            <div className="text-red-500 text-sm">{result.error || '无法报价'}</div>
                          )}
                        </div>
                        {result.success && result.data && (
                          <div className="mt-2 pt-2 border-t flex items-center gap-6 text-sm">
                            <div>
                              <span className="text-gray-500">销售价: </span>
                              <span className="font-mono">{result.data.totalSales.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">利润: </span>
                              <span className="font-mono text-green-600">{result.data.profit.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">利润率: </span>
                              <span className="text-green-600">{result.data.profitRate}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 使用说明 */}
          {!quoteResult && !showCompare && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium text-gray-900 mb-4">使用说明</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</div>
                  <div>选择承运商，或使用"比价"功能对比所有承运商</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</div>
                  <div>选择Zone区域，或输入收件人邮编自动匹配</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</div>
                  <div>输入货物重量（kg），可选填尺寸计算体积重</div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">4</div>
                  <div>点击"计算报价"获取详细费用，包含采购价、销售价、利润分析</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
