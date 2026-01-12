import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Search, TrendingUp, TrendingDown, Minus,
  Truck, MapPin, Calculator, RefreshCw, Info, AlertCircle,
  BarChart3, DollarSign
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getApiBaseUrl } from '../utils/api'

const API_BASE = getApiBaseUrl()

interface SupplierPriceAnalysis {
  id: number
  supplierId: string
  supplierName: string
  supplierCode: string
  feeName: string
  feeNameEn: string
  price: number
  currency: string
  unit: string
  routeFrom: string
  routeTo: string
  // 分析字段
  marketRefPrice: number | null
  diffAmount: number | null
  diffPercent: number | null
  advantage: 'strong' | 'slight' | 'normal' | 'weak' | 'unknown'
  ratePerKm: number | null
}

interface CompareSummary {
  totalSuppliers: number
  strongAdvantage: number
  slightAdvantage: number
  normalPrice: number
  weakAdvantage: number
  marketRefPrice: number | null
  marketRatePerKm: number
  distance: number | null
  bestPrice: number | null
  avgPrice: number | null
}

interface RouteOverview {
  routeFrom: string
  routeTo: string
  feeCategory: string
  supplierCount: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  priceSpread: number
  suppliers: any[]
}

// 卡车类型选项
const TRUCK_TYPES = [
  { value: 'sprinter', label: 'Sprinter', rate: 1.0 },
  { value: 'small_van', label: '小型厢式车', rate: 1.2 },
  { value: 'medium_van', label: '中型厢式车', rate: 1.5 },
  { value: 'large_van', label: '大型厢式车', rate: 1.8 },
  { value: 'curtainsider', label: '篷布半挂车', rate: 2.2 },
  { value: 'semi_40', label: '40尺标准半挂', rate: 2.5 },
  { value: 'mega_trailer', label: 'Mega半挂车', rate: 2.7 },
  { value: 'double_deck', label: '双层半挂车', rate: 3.0 },
  { value: 'reefer_small', label: '冷藏车(小)', rate: 2.0 },
  { value: 'reefer_large', label: '冷藏半挂', rate: 3.5 },
  { value: 'flatbed', label: '平板车', rate: 2.8 },
  { value: 'lowloader', label: '低板车', rate: 4.0 },
  { value: 'hazmat', label: 'ADR危险品车', rate: 4.5 },
  { value: 'tanker', label: '罐车', rate: 3.8 }
]

export default function SupplierPriceCompare() {
  const navigate = useNavigate()
  
  // 搜索条件
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [distance, setDistance] = useState<string>('')
  const [truckType, setTruckType] = useState('semi_40')
  
  // 结果数据
  const [analysis, setAnalysis] = useState<SupplierPriceAnalysis[]>([])
  const [summary, setSummary] = useState<CompareSummary | null>(null)
  const [overview, setOverview] = useState<RouteOverview[]>([])
  
  // 状态
  const [loading, setLoading] = useState(false)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [activeTab, setActiveTab] = useState<'compare' | 'overview'>('compare')

  // 初始加载概览数据
  useEffect(() => {
    loadOverview()
  }, [])

  // 加载路线报价概览
  const loadOverview = async () => {
    setLoadingOverview(true)
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/prices/transport-overview`)
      const data = await res.json()
      if (data.errCode === 200) {
        setOverview(data.data || [])
      }
    } catch (error) {
      console.error('加载报价概览失败:', error)
    } finally {
      setLoadingOverview(false)
    }
  }

  // 执行价格比对分析
  const handleCompare = async () => {
    if (!origin && !destination) {
      alert('请至少输入起点或终点')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/suppliers/prices/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          truckType,
          distance: parseFloat(distance) || null
        })
      })
      const data = await res.json()
      
      if (data.errCode === 200) {
        setAnalysis(data.data.analysis || [])
        setSummary(data.data.summary || null)
      } else {
        alert(data.msg || '查询失败')
      }
    } catch (error) {
      console.error('价格比对分析失败:', error)
      alert('查询失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 获取优势标签
  const getAdvantageBadge = (advantage: string) => {
    switch (advantage) {
      case 'strong':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
            <TrendingDown className="w-3 h-3" />
            优势明显
          </span>
        )
      case 'slight':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
            <TrendingDown className="w-3 h-3" />
            略有优势
          </span>
        )
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
            <Minus className="w-3 h-3" />
            价格合理
          </span>
        )
      case 'weak':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
            <TrendingUp className="w-3 h-3" />
            价格偏高
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
            待分析
          </span>
        )
    }
  }

  // 获取差价显示
  const getDiffDisplay = (diffPercent: number | null, diffAmount: number | null) => {
    if (diffPercent === null || diffAmount === null) {
      return <span className="text-gray-400">-</span>
    }
    
    const isNegative = diffAmount < 0
    const color = isNegative ? 'text-green-600' : diffAmount > 0 ? 'text-red-600' : 'text-gray-500'
    
    return (
      <div className={`text-right ${color}`}>
        <div className="font-medium">
          {isNegative ? '' : '+'}€{diffAmount.toFixed(2)}
        </div>
        <div className="text-xs">
          ({isNegative ? '' : '+'}{diffPercent}%)
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="供应商报价比对分析"
        description="将供应商运输报价与市场参考价格进行对比，分析供应商的价格优劣势"
        action={
          <button
            onClick={() => navigate('/suppliers')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            返回供应商管理
          </button>
        }
      />

      {/* Tab 切换 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'compare'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline-block mr-2" />
              路线价格比对
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'overview'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="w-4 h-4 inline-block mr-2" />
              报价概览
            </button>
          </nav>
        </div>

        {/* 路线价格比对 Tab */}
        {activeTab === 'compare' && (
          <div className="p-6 space-y-6">
            {/* 搜索条件 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-primary-500" />
                查询条件
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 起点 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">起点</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="输入起点城市或地址"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                {/* 终点 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">终点</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="输入终点城市或地址"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                {/* 距离 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">距离 (km)</label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="预估距离"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                
                {/* 车型 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">参考车型</label>
                  <select
                    value={truckType}
                    onChange={(e) => setTruckType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    {TRUCK_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label} (€{type.rate}/km)
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 查询按钮 */}
                <div className="flex items-end">
                  <button
                    onClick={handleCompare}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4" />
                    )}
                    开始分析
                  </button>
                </div>
              </div>
              
              {/* 提示信息 */}
              <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  输入起点、终点和预估距离后，系统将匹配供应商报价并与市场参考价格进行对比分析。
                  市场参考价基于欧洲卡车运输行业标准费率计算。
                </p>
              </div>
            </div>

            {/* 分析结果摘要 */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">匹配供应商</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalSuppliers}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-600 mb-1">优势明显</p>
                  <p className="text-2xl font-bold text-green-700">{summary.strongAdvantage}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-600 mb-1">略有优势</p>
                  <p className="text-2xl font-bold text-blue-700">{summary.slightAdvantage}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-600 mb-1">价格合理</p>
                  <p className="text-2xl font-bold text-gray-700">{summary.normalPrice}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-red-600 mb-1">价格偏高</p>
                  <p className="text-2xl font-bold text-red-700">{summary.weakAdvantage}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-amber-600 mb-1">市场参考价</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {summary.marketRefPrice ? `€${summary.marketRefPrice.toFixed(0)}` : '-'}
                  </p>
                </div>
              </div>
            )}

            {/* 分析结果表格 */}
            {analysis.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">供应商</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">费用名称</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">路线</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">报价</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">市场参考</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">差价</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">€/km</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">评估</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysis.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-gray-900">{item.supplierName}</div>
                          <div className="text-xs text-gray-500">{item.supplierCode}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm text-gray-900">{item.feeName}</div>
                          {item.feeNameEn && (
                            <div className="text-xs text-gray-500">{item.feeNameEn}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <MapPin className="w-3 h-3" />
                            {item.routeFrom || '任意'} → {item.routeTo || '任意'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            €{item.price?.toFixed(2) || '-'}
                          </span>
                          {item.unit && (
                            <span className="text-xs text-gray-500 ml-1">/{item.unit}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-600">
                          {item.marketRefPrice ? `€${item.marketRefPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {getDiffDisplay(item.diffPercent, item.diffAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-600">
                          {item.ratePerKm ? `€${item.ratePerKm.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center">
                            {getAdvantageBadge(item.advantage)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !loading && (
              <div className="text-center py-12">
                <Truck className="w-12 h-12 mx-auto text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">输入条件开始分析</h3>
                <p className="mt-2 text-sm text-gray-500">
                  输入起点、终点和预估距离后，点击"开始分析"查看供应商价格对比结果
                </p>
              </div>
            )}
          </div>
        )}

        {/* 报价概览 Tab */}
        {activeTab === 'overview' && (
          <div className="p-6">
            {loadingOverview ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-primary-500 animate-spin" />
                <p className="mt-2 text-gray-500">加载中...</p>
              </div>
            ) : overview.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    共 {overview.length} 条路线有报价记录
                  </h3>
                  <button
                    onClick={loadOverview}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">路线</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">供应商数</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">最低价</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">最高价</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">平均价</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">价差</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">供应商</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {overview.map((route, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 text-sm text-gray-900">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {route.routeFrom} → {route.routeTo}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700">
                              {route.supplierCount}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-green-600 font-medium">
                            €{route.minPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-red-600">
                            €{route.maxPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-gray-900">
                            €{route.avgPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={`text-sm ${route.priceSpread > route.avgPrice * 0.2 ? 'text-amber-600' : 'text-gray-500'}`}>
                              €{route.priceSpread.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1 max-w-[300px]">
                              {route.suppliers.slice(0, 3).map((s: any, i: number) => (
                                <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                  {s.supplierName}
                                </span>
                              ))}
                              {route.suppliers.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{route.suppliers.length - 3} 更多
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">暂无运输报价数据</h3>
                <p className="mt-2 text-sm text-gray-500">
                  请先在供应商管理中录入运输类报价
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 说明卡片 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <h4 className="font-medium mb-1">价格优势评估说明</h4>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li><span className="text-green-600 font-medium">优势明显</span>：供应商报价低于市场参考价 10% 以上</li>
              <li><span className="text-blue-600 font-medium">略有优势</span>：供应商报价低于市场参考价，但差距在 10% 以内</li>
              <li><span className="text-gray-600 font-medium">价格合理</span>：供应商报价与市场参考价差距在 ±10% 以内</li>
              <li><span className="text-red-600 font-medium">价格偏高</span>：供应商报价高于市场参考价 10% 以上</li>
            </ul>
            <p className="mt-2 text-xs text-blue-500">
              * 市场参考价基于欧洲卡车运输行业标准费率计算，包含基础运费、通行费和燃油附加费估算
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
