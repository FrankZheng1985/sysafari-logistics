/**
 * Transport Quote Calculator Component
 * 运输报价计算弹窗
 * 
 * 功能：
 * 1. 显示地图和路线
 * 2. 显示费用列表（HERE估算 + 供应商报价）
 * 3. 用户勾选需要的费用项
 * 4. 利润设置功能（支持固定金额和百分比）
 * 5. 实时计算成本/利润/销售价
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { 
  X, 
  MapPin, 
  Navigation, 
  Truck, 
  Calculator, 
  Check, 
  Loader2,
  AlertCircle,
  Ship,
  Percent,
  Plus
} from 'lucide-react'
import HereMapDisplay from './HereMapDisplay'

const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * 销售价取整函数
 * 规则：
 * - 1-49 取整到 50
 * - 51-99 取整到 100
 * - 50 和 100 的整数不变
 */
function roundSalesPrice(value: number): number {
  const lastTwoDigits = Math.round(value) % 100
  const base = Math.floor(value / 100) * 100
  
  if (lastTwoDigits === 0 || lastTwoDigits === 50) {
    return Math.round(value)
  }
  
  if (lastTwoDigits >= 1 && lastTwoDigits <= 49) {
    return base + 50
  }
  
  // lastTwoDigits >= 51 && lastTwoDigits <= 99
  return base + 100
}

// 费用项接口
interface CostItem {
  id?: string
  source: 'HERE' | 'supplier'
  supplierName?: string
  supplierId?: string
  name: string
  nameEn?: string
  category: string
  costPrice: number
  salesPrice?: number
  currency: string
  unit: string
  quantity: number
  selected: boolean
  remark?: string
}

// 路线信息接口
interface RouteInfo {
  origin: {
    lat: number
    lng: number
    address?: string
    country?: string
  }
  destination: {
    lat: number
    lng: number
    address?: string
    country?: string
  }
  waypoints?: Array<{
    lat: number
    lng: number
    address?: string
  }>
  distance: number
  roadDistance?: number
  ferryDistance?: number
  duration: number
  durationFormatted?: string
  hasFerry?: boolean
  polyline?: string[]  // 修改为数组类型
}

// 组件属性接口
interface TransportQuoteCalculatorProps {
  visible: boolean
  onClose: () => void
  onConfirm: (data: {
    items: Array<{
      name: string
      nameEn: string
      description: string
      quantity: number
      unit: string
      costPrice: number
      price: number  // 销售价
      amount: number
    }>
    route: RouteInfo
    profitSettings: {
      type: 'fixed' | 'percent'
      value: number
      roundingProfit?: number  // 取整产生的利润
      totalProfit?: number     // 总利润（设定+取整）
      roundedSalesPrice?: number  // 取整后的销售价
    }
  }) => void
  // 询价数据
  transportData: {
    origin: string
    destination: string
    transportMode?: 'container' | 'truck'
    containerType?: string
    returnLocation?: 'same' | 'different'
    returnAddress?: string
  }
}

export default function TransportQuoteCalculator({
  visible,
  onClose,
  onConfirm,
  transportData
}: TransportQuoteCalculatorProps) {
  // 状态
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [costItems, setCostItems] = useState<CostItem[]>([])
  const [supplierPrices, setSupplierPrices] = useState<CostItem[]>([])
  
  // 利润设置
  const [profitType, setProfitType] = useState<'fixed' | 'percent'>('percent')
  const [profitValue, setProfitValue] = useState<number>(15) // 默认15%利润
  
  // 用于防止重复加载的ref
  const loadedRef = useRef(false)
  const prevTransportDataRef = useRef<string>('')
  
  // 计算选中的成本总额
  const totalCost = useMemo(() => {
    const selectedItems = [...costItems, ...supplierPrices].filter(item => item.selected)
    return selectedItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)
  }, [costItems, supplierPrices])
  
  // 计算利润金额
  const profitAmount = useMemo(() => {
    if (profitType === 'percent') {
      return totalCost * (profitValue / 100)
    }
    return profitValue
  }, [totalCost, profitType, profitValue])
  
  // 计算销售价总额（未取整）
  const rawSalesPrice = useMemo(() => {
    return totalCost + profitAmount
  }, [totalCost, profitAmount])
  
  // 取整后的销售价
  const roundedSalesPrice = useMemo(() => {
    return roundSalesPrice(rawSalesPrice)
  }, [rawSalesPrice])
  
  // 取整产生的额外利润
  const roundingProfit = useMemo(() => {
    return roundedSalesPrice - rawSalesPrice
  }, [roundedSalesPrice, rawSalesPrice])
  
  // 总利润（设定利润 + 取整利润）
  const totalProfit = useMemo(() => {
    return profitAmount + roundingProfit
  }, [profitAmount, roundingProfit])
  
  // 加载数据 - 使用稳定的序列化字符串作为依赖
  const transportDataKey = useMemo(() => {
    if (!transportData) return ''
    return JSON.stringify({
      origin: transportData.origin,
      destination: transportData.destination
    })
  }, [transportData?.origin, transportData?.destination])
  
  useEffect(() => {
    // 只有在 visible 且数据变化时才加载
    if (visible && transportData && transportDataKey) {
      // 检查是否需要重新加载（数据发生变化或首次加载）
      if (transportDataKey !== prevTransportDataRef.current) {
        prevTransportDataRef.current = transportDataKey
        loadedRef.current = false
      }
      
      // 防止重复加载
      if (!loadedRef.current) {
        loadedRef.current = true
        loadData()
      }
    }
    
    // 组件关闭时重置加载状态
    if (!visible) {
      loadedRef.current = false
      prevTransportDataRef.current = ''
    }
  }, [visible, transportDataKey])
  
  // 加载路线和费用数据
  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // 并行调用两个API
      const [routeResponse, supplierResponse] = await Promise.all([
        // 调用运输报价计算API
        fetch(`${API_BASE}/api/inquiry/transport/quote-calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { address: transportData.origin },
            destination: { address: transportData.destination }
          })
        }),
        // 调用供应商报价匹配API
        fetch(`${API_BASE}/api/prices/match?destination=${encodeURIComponent(transportData.destination)}`)
      ])
      
      const routeData = await routeResponse.json()
      const supplierData = await supplierResponse.json()
      
      // 处理路线数据
      if (routeData.errCode === 200 && routeData.data) {
        console.log('API 返回的路线数据:', routeData.data.route)
        console.log('Polyline 字段:', routeData.data.route.polyline)
        setRoute(routeData.data.route)
        // 设置HERE估算的费用项
        setCostItems(routeData.data.costItems.map((item: any, index: number) => ({
          ...item,
          id: `here-${index}`,
          source: 'HERE' as const
        })))
      } else {
        throw new Error(routeData.errMsg || '获取路线失败')
      }
      
      // 处理供应商报价数据
      if (supplierData.errCode === 200 && supplierData.data) {
        setSupplierPrices(supplierData.data.map((item: any) => ({
          id: `supplier-${item.id}`,
          source: 'supplier' as const,
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          name: item.feeName,
          nameEn: item.feeNameEn,
          category: item.feeCategory,
          costPrice: item.price,
          currency: item.currency || 'EUR',
          unit: item.unit || '趟',
          quantity: 1,
          selected: false,
          remark: item.remark
        })))
      }
    } catch (err: any) {
      console.error('加载数据失败:', err)
      setError(err.message || '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 切换费用项选中状态
  const toggleItemSelection = (itemId: string, isSupplier: boolean) => {
    if (isSupplier) {
      setSupplierPrices(prev => prev.map(item => 
        item.id === itemId ? { ...item, selected: !item.selected } : item
      ))
    } else {
      setCostItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, selected: !item.selected } : item
      ))
    }
  }
  
  // 确认并生成报价
  const handleConfirm = () => {
    // 获取选中的费用项
    const selectedItems = [...costItems, ...supplierPrices].filter(item => item.selected)
    
    if (selectedItems.length === 0) {
      setError('请至少选择一个费用项')
      return
    }
    
    // 使用取整后的总利润（包含设定利润+取整利润）
    const totalProfitToDistribute = totalProfit
    
    // 计算每个费用项的销售价（按比例分配总利润）
    const items = selectedItems.map(item => {
      const itemCost = item.costPrice * item.quantity
      const itemProfitRatio = totalCost > 0 ? itemCost / totalCost : 1 / selectedItems.length
      const itemProfit = totalProfitToDistribute * itemProfitRatio
      const itemSalesPrice = (itemCost + itemProfit) / item.quantity
      
      return {
        name: item.name,
        nameEn: item.nameEn || '',
        description: item.source === 'supplier' 
          ? `供应商: ${item.supplierName}` 
          : 'HERE 路线计算',
        quantity: item.quantity,
        unit: item.unit,
        costPrice: item.costPrice,
        price: Math.round(itemSalesPrice * 100) / 100,  // 销售价（含分摊的利润）
        amount: Math.round((itemCost + itemProfit) * 100) / 100
      }
    })
    
    onConfirm({
      items,
      route: route!,
      profitSettings: {
        type: profitType,
        value: profitValue,
        roundingProfit: roundingProfit,  // 记录取整产生的利润
        totalProfit: totalProfitToDistribute,  // 记录总利润
        roundedSalesPrice: roundedSalesPrice  // 记录取整后的销售价
      }
    })
  }
  
  if (!visible) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        {/* 弹窗内容 */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">运输报价计算</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* 内容区域 */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500">正在计算路线和费用...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  重新计算
                </button>
              </div>
            ) : (
              <>
                {/* 地图显示 */}
                {route && (
                  <div className="mb-6">
                    <HereMapDisplay
                      origin={route.origin}
                      destination={route.destination}
                      waypoints={route.waypoints}
                      polyline={route.polyline}
                      distance={route.distance}
                      duration={route.duration}
                      durationFormatted={route.durationFormatted}
                      hasFerry={route.hasFerry}
                      height={500}
                    />
                  </div>
                )}
                
                {/* 路线信息 */}
                {route && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">路线信息</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                        <div>
                          <div className="text-gray-500">起点</div>
                          <div className="font-medium text-gray-900">{route.origin.address || transportData.origin}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                        </div>
                        <div>
                          <div className="text-gray-500">终点</div>
                          <div className="font-medium text-gray-900">{route.destination.address || transportData.destination}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Navigation className="w-4 h-4 text-blue-500" />
                        <span className="text-gray-600">距离:</span>
                        <span className="font-medium">{route.distance} km</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <span className="text-gray-600">时间:</span>
                        <span className="font-medium">{route.durationFormatted || `约${Math.round(route.duration / 60)}小时`}</span>
                      </div>
                      {route.hasFerry && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          <Ship className="w-4 h-4" />
                          <span>含渡轮</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 费用估算表格 */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">费用估算（成本价）</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-10">选择</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">来源</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">费用项</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">成本价</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">单位</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {/* HERE 估算费用 */}
                        {costItems.map(item => (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-gray-50 cursor-pointer ${item.selected ? 'bg-blue-50' : ''}`}
                            onClick={() => toggleItemSelection(item.id!, false)}
                          >
                            <td className="px-4 py-2">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                item.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                              }`}>
                                {item.selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                HERE 估算
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              {item.nameEn && <div className="text-xs text-gray-500">{item.nameEn}</div>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <span className="font-medium text-gray-900">€{item.costPrice.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-2 text-center text-sm text-gray-500">{item.unit}</td>
                          </tr>
                        ))}
                        
                        {/* 分隔行 */}
                        {supplierPrices.length > 0 && (
                          <tr className="bg-gray-100">
                            <td colSpan={5} className="px-4 py-2 text-xs font-medium text-gray-500">
                              供应商报价
                            </td>
                          </tr>
                        )}
                        
                        {/* 供应商报价 */}
                        {supplierPrices.map(item => (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-gray-50 cursor-pointer ${item.selected ? 'bg-blue-50' : ''}`}
                            onClick={() => toggleItemSelection(item.id!, true)}
                          >
                            <td className="px-4 py-2">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                item.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                              }`}>
                                {item.selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                                {item.supplierName}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              {item.nameEn && <div className="text-xs text-gray-500">{item.nameEn}</div>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <span className="font-medium text-gray-900">€{item.costPrice.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-2 text-center text-sm text-gray-500">{item.unit}</td>
                          </tr>
                        ))}
                        
                        {/* 空状态 */}
                        {costItems.length === 0 && supplierPrices.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              暂无费用数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 成本合计 */}
                  <div className="mt-3 flex justify-end">
                    <div className="text-sm">
                      <span className="text-gray-500">已选成本合计: </span>
                      <span className="text-lg font-bold text-gray-900">€{totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* 利润设置区域 */}
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-amber-600" />
                    利润设置
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    {/* 左侧：利润类型和值 */}
                    <div className="space-y-4">
                      {/* 利润类型选择 */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">利润类型:</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="profitType"
                            checked={profitType === 'fixed'}
                            onChange={() => setProfitType('fixed')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Plus className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">固定金额</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="profitType"
                            checked={profitType === 'percent'}
                            onChange={() => setProfitType('percent')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <Percent className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">百分比</span>
                        </label>
                      </div>
                      
                      {/* 利润值输入 */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">利润值:</span>
                        <div className="relative">
                          <input
                            type="number"
                            value={profitValue}
                            onChange={(e) => setProfitValue(parseFloat(e.target.value) || 0)}
                            min="0"
                            step={profitType === 'percent' ? '1' : '10'}
                            className="w-28 px-3 py-1.5 border rounded-lg text-right pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                            {profitType === 'percent' ? '%' : '€'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 右侧：计算结果 */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">成本合计:</span>
                        <span className="font-medium">€{totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">
                          设定利润:
                          {profitType === 'percent' && (
                            <span className="text-gray-400 ml-1">({profitValue}%)</span>
                          )}
                        </span>
                        <span className="font-medium text-amber-600">+€{profitAmount.toFixed(2)}</span>
                      </div>
                      {roundingProfit > 0 && (
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">
                            取整利润:
                            <span className="text-gray-400 ml-1 text-xs">(1-49→50, 51-99→100)</span>
                          </span>
                          <span className="font-medium text-green-600">+€{roundingProfit.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">总利润:</span>
                          <span className="font-bold text-amber-600">€{totalProfit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">销售价合计:</span>
                          <span className="text-xl font-bold text-blue-600">€{roundedSalesPrice.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !route || totalCost === 0}
              className="px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              确认并生成报价
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

