/**
 * Transport Inquiry Form Component
 * 运输询价表单组件 - 用于 CRM 人员代客户创建运输询价
 */

import { useState, useEffect, useRef } from 'react'
import { 
  X, 
  MapPin, 
  Truck, 
  Package,
  Loader2,
  Search,
  Plus,
  Container,
  Trash2,
  CircleDot
} from 'lucide-react'
import { getApiBaseUrl, getAuthHeaders } from '../utils/api'

const API_BASE = getApiBaseUrl()

// 客户接口
interface Customer {
  id: string
  customerName: string
}

// 地址建议接口
interface AddressSuggestion {
  id: string
  address: string
  title: string
  city?: string
  country?: string
  countryCode?: string
  position?: {
    lat: number
    lng: number
  }
}

// 组件属性接口
interface TransportInquiryFormProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  customers: Customer[]
}

// 柜型选项
const containerTypes = [
  { value: '20GP', label: '20尺普柜', labelEn: "20' Standard", dimensions: '尺寸: 5.9×2.35×2.39m' },
  { value: '40GP', label: '40尺普柜', labelEn: "40' Standard", dimensions: '尺寸: 12×2.35×2.39m' },
  { value: '40HC', label: '40尺高柜', labelEn: "40' High Cube", dimensions: '尺寸: 12×2.35×2.69m' },
  { value: '45HC', label: '45尺高柜', labelEn: "45' High Cube", dimensions: '尺寸: 13.5×2.35×2.69m' }
]

// 卡车类型选项 - 按欧洲物流行业标准分类
// 注意：价格信息已隐藏，实际价格从供应商报价系统获取
const truckTypeCategories = [
  {
    category: 'distribution',
    label: '厢式配送车',
    labelEn: 'Distribution Vehicles',
    description: '适合城市配送和区域运输',
    types: [
      { value: 'sprinter', label: 'Sprinter', labelEn: 'Mercedes Sprinter (3.5t)', spec: '载重: 1.2t | 容积: 14m³' },
      { value: 'small_van', label: '小型厢式车', labelEn: 'Small Van (7.5t)', spec: '载重: 3t | 容积: 20m³' },
      { value: 'medium_van', label: '中型厢式车', labelEn: 'Medium Van (12t)', spec: '载重: 6t | 容积: 40m³' },
      { value: 'large_van', label: '大型厢式车', labelEn: 'Large Van (18t)', spec: '载重: 10t | 容积: 55m³' }
    ]
  },
  {
    category: 'semi_trailer',
    label: '半挂车/公路运输',
    labelEn: 'Semi-trailers',
    description: '适合长途干线运输',
    types: [
      { value: 'curtainsider', label: '篷布半挂车', labelEn: 'Curtainsider (Tautliner)', spec: '载重: 24t | 容积: 86m³' },
      { value: 'semi_40', label: '40尺标准半挂', labelEn: 'Standard Semi (40ft)', spec: '载重: 25t | 容积: 76m³' },
      { value: 'mega_trailer', label: 'Mega半挂车', labelEn: 'Mega Trailer (45ft)', spec: '载重: 24t | 容积: 100m³' },
      { value: 'double_deck', label: '双层半挂车', labelEn: 'Double Deck Trailer', spec: '载重: 22t | 容积: 120m³' }
    ]
  },
  {
    category: 'special',
    label: '特种车辆',
    labelEn: 'Special Vehicles',
    description: '特殊货物运输需求',
    types: [
      { value: 'reefer_small', label: '冷藏车(小)', labelEn: 'Reefer Van (7.5t)', spec: '载重: 2.5t | 温控: -25°C~+25°C' },
      { value: 'reefer_large', label: '冷藏半挂', labelEn: 'Reefer Semi-trailer', spec: '载重: 22t | 温控: -25°C~+25°C' },
      { value: 'flatbed', label: '平板车', labelEn: 'Flatbed Trailer', spec: '载重: 28t | 长度: 13.6m' },
      { value: 'lowloader', label: '低板车', labelEn: 'Low Loader', spec: '载重: 40t | 适合超高货物' },
      { value: 'hazmat', label: 'ADR危险品车', labelEn: 'ADR Hazmat Truck', spec: '载重: 22t | ADR认证' },
      { value: 'tanker', label: '罐车', labelEn: 'Tanker Truck', spec: '容量: 30,000L | 液体运输' }
    ]
  }
]

// 扁平化的卡车类型列表（用于查找）
const allTruckTypes = truckTypeCategories.flatMap(cat => cat.types)

export default function TransportInquiryForm({
  visible,
  onClose,
  onSuccess,
  customers
}: TransportInquiryFormProps) {
  // 表单数据
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    transportMode: 'container' as 'container' | 'truck',
    containerType: '40GP',
    truckType: 'curtainsider', // 默认篷布半挂车（欧洲最常用）
    returnLocation: 'same' as 'same' | 'different',
    returnAddress: '',
    origin: '',
    destination: '',
    waypoints: [] as string[], // 途径点数组
    cargoWeight: '',
    cargoVolume: '',
    notes: ''
  })
  
  // 地址自动补全状态
  const [originSuggestions, setOriginSuggestions] = useState<AddressSuggestion[]>([])
  const [destSuggestions, setDestSuggestions] = useState<AddressSuggestion[]>([])
  const [returnSuggestions, setReturnSuggestions] = useState<AddressSuggestion[]>([])
  const [waypointSuggestions, setWaypointSuggestions] = useState<{ [key: number]: AddressSuggestion[] }>({})
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false)
  const [showDestSuggestions, setShowDestSuggestions] = useState(false)
  const [showReturnSuggestions, setShowReturnSuggestions] = useState(false)
  const [showWaypointSuggestions, setShowWaypointSuggestions] = useState<{ [key: number]: boolean }>({})
  const [loadingOrigin, setLoadingOrigin] = useState(false)
  const [loadingDest, setLoadingDest] = useState(false)
  const [loadingReturn, setLoadingReturn] = useState(false)
  const [loadingWaypoint, setLoadingWaypoint] = useState<{ [key: number]: boolean }>({})
  
  // 提交状态
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 防抖定时器
  const originTimerRef = useRef<NodeJS.Timeout | null>(null)
  const destTimerRef = useRef<NodeJS.Timeout | null>(null)
  const returnTimerRef = useRef<NodeJS.Timeout | null>(null)
  const waypointTimerRefs = useRef<{ [key: number]: NodeJS.Timeout | null }>({})
  
  // 客户搜索状态
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  
  // 点击外部关闭建议列表
  const originRef = useRef<HTMLDivElement>(null)
  const destRef = useRef<HTMLDivElement>(null)
  const returnRef = useRef<HTMLDivElement>(null)
  const waypointRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const customerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (originRef.current && !originRef.current.contains(event.target as Node)) {
        setShowOriginSuggestions(false)
      }
      if (destRef.current && !destRef.current.contains(event.target as Node)) {
        setShowDestSuggestions(false)
      }
      if (returnRef.current && !returnRef.current.contains(event.target as Node)) {
        setShowReturnSuggestions(false)
      }
      if (customerRef.current && !customerRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
      // 处理途径点建议列表
      Object.keys(waypointRefs.current).forEach(key => {
        const index = parseInt(key)
        const ref = waypointRefs.current[index]
        if (ref && !ref.contains(event.target as Node)) {
          setShowWaypointSuggestions(prev => ({ ...prev, [index]: false }))
        }
      })
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // 重置表单
  useEffect(() => {
    if (!visible) {
      setFormData({
        customerId: '',
        customerName: '',
        transportMode: 'container',
        containerType: '40GP',
        truckType: 'curtainsider',
        returnLocation: 'same',
        returnAddress: '',
        origin: '',
        destination: '',
        waypoints: [],
        cargoWeight: '',
        cargoVolume: '',
        notes: ''
      })
      setError(null)
      setWaypointSuggestions({})
      setShowWaypointSuggestions({})
      setLoadingWaypoint({})
      setCustomerSearch('')
      setShowCustomerDropdown(false)
    }
  }, [visible])
  
  // 地址自动补全
  const fetchAddressSuggestions = async (
    query: string, 
    type: 'origin' | 'destination' | 'return' | 'waypoint',
    waypointIndex?: number
  ) => {
    if (query.length < 2) {
      if (type === 'origin') setOriginSuggestions([])
      else if (type === 'destination') setDestSuggestions([])
      else if (type === 'return') setReturnSuggestions([])
      else if (type === 'waypoint' && waypointIndex !== undefined) {
        setWaypointSuggestions(prev => ({ ...prev, [waypointIndex]: [] }))
      }
      return
    }
    
    if (type === 'waypoint' && waypointIndex !== undefined) {
      setLoadingWaypoint(prev => ({ ...prev, [waypointIndex]: true }))
    } else {
      const setLoading = type === 'origin' ? setLoadingOrigin : 
                         type === 'destination' ? setLoadingDest : setLoadingReturn
      setLoading(true)
    }
    
    try {
      const response = await fetch(
        `${API_BASE}/api/inquiry/autosuggest?query=${encodeURIComponent(query)}&limit=5`,
        { headers: getAuthHeaders() }
      )
      const data = await response.json()
      
      if (data.errCode === 200 && data.data) {
        if (type === 'waypoint' && waypointIndex !== undefined) {
          setWaypointSuggestions(prev => ({ ...prev, [waypointIndex]: data.data }))
        } else {
          const setSuggestions = type === 'origin' ? setOriginSuggestions : 
                                type === 'destination' ? setDestSuggestions : setReturnSuggestions
          setSuggestions(data.data)
        }
      }
    } catch (err) {
      console.error('地址自动补全失败:', err)
    } finally {
      if (type === 'waypoint' && waypointIndex !== undefined) {
        setLoadingWaypoint(prev => ({ ...prev, [waypointIndex]: false }))
      } else {
        const setLoading = type === 'origin' ? setLoadingOrigin : 
                           type === 'destination' ? setLoadingDest : setLoadingReturn
        setLoading(false)
      }
    }
  }
  
  // 处理地址输入变化（带防抖）
  const handleAddressChange = (value: string, type: 'origin' | 'destination' | 'return' | 'waypoint', waypointIndex?: number) => {
    if (type === 'waypoint' && waypointIndex !== undefined) {
      // 更新途径点值
      setFormData(prev => {
        const newWaypoints = [...prev.waypoints]
        newWaypoints[waypointIndex] = value
        return { ...prev, waypoints: newWaypoints }
      })
      
      // 清除之前的定时器
      if (waypointTimerRefs.current[waypointIndex]) {
        clearTimeout(waypointTimerRefs.current[waypointIndex]!)
      }
      
      // 设置新的防抖定时器
      waypointTimerRefs.current[waypointIndex] = setTimeout(() => {
        fetchAddressSuggestions(value, 'waypoint', waypointIndex)
        setShowWaypointSuggestions(prev => ({ ...prev, [waypointIndex]: true }))
      }, 300)
      return
    }
    
    const timerRef = type === 'origin' ? originTimerRef : 
                     type === 'destination' ? destTimerRef : returnTimerRef
    const setShow = type === 'origin' ? setShowOriginSuggestions : 
                    type === 'destination' ? setShowDestSuggestions : setShowReturnSuggestions
    
    if (type === 'origin') {
      setFormData(prev => ({ ...prev, origin: value }))
    } else if (type === 'destination') {
      setFormData(prev => ({ ...prev, destination: value }))
    } else {
      setFormData(prev => ({ ...prev, returnAddress: value }))
    }
    
    // 清除之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    
    // 设置新的防抖定时器
    timerRef.current = setTimeout(() => {
      fetchAddressSuggestions(value, type)
      setShow(true)
    }, 300)
  }
  
  // 选择地址建议
  const selectAddress = (suggestion: AddressSuggestion, type: 'origin' | 'destination' | 'return' | 'waypoint', waypointIndex?: number) => {
    const address = suggestion.address || suggestion.title
    
    if (type === 'origin') {
      setFormData(prev => ({ ...prev, origin: address }))
      setShowOriginSuggestions(false)
    } else if (type === 'destination') {
      setFormData(prev => ({ ...prev, destination: address }))
      setShowDestSuggestions(false)
    } else if (type === 'waypoint' && waypointIndex !== undefined) {
      setFormData(prev => {
        const newWaypoints = [...prev.waypoints]
        newWaypoints[waypointIndex] = address
        return { ...prev, waypoints: newWaypoints }
      })
      setShowWaypointSuggestions(prev => ({ ...prev, [waypointIndex]: false }))
    } else {
      setFormData(prev => ({ ...prev, returnAddress: address }))
      setShowReturnSuggestions(false)
    }
  }
  
  // 添加途径点
  const addWaypoint = () => {
    setFormData(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }))
  }
  
  // 删除途径点
  const removeWaypoint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter((_, i) => i !== index)
    }))
    // 清理相关状态
    setWaypointSuggestions(prev => {
      const newSuggestions = { ...prev }
      delete newSuggestions[index]
      return newSuggestions
    })
    setShowWaypointSuggestions(prev => {
      const newShow = { ...prev }
      delete newShow[index]
      return newShow
    })
    setLoadingWaypoint(prev => {
      const newLoading = { ...prev }
      delete newLoading[index]
      return newLoading
    })
  }
  
  // 提交表单
  const handleSubmit = async () => {
    // 验证
    if (!formData.customerId) {
      setError('请选择客户')
      return
    }
    if (!formData.origin) {
      setError('请输入起点地址')
      return
    }
    if (!formData.destination) {
      setError('请输入终点地址')
      return
    }
    if (formData.transportMode === 'container' && formData.returnLocation === 'different' && !formData.returnAddress) {
      setError('请输入还柜地址')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE}/api/inquiry/inquiries`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          customerName: formData.customerName,
          inquiryType: 'transport',
          transportData: {
            origin: formData.origin,
            destination: formData.destination,
            waypoints: formData.waypoints.filter(w => w.trim()), // 过滤空的途径点
            transportMode: formData.transportMode,
            containerType: formData.transportMode === 'container' ? formData.containerType : undefined,
            truckType: formData.transportMode === 'truck' ? formData.truckType : undefined,
            returnLocation: formData.transportMode === 'container' ? formData.returnLocation : undefined,
            returnAddress: formData.transportMode === 'container' && formData.returnLocation === 'different' 
              ? formData.returnAddress : undefined,
            cargoWeight: formData.cargoWeight ? parseFloat(formData.cargoWeight) : undefined,
            cargoVolume: formData.cargoVolume ? parseFloat(formData.cargoVolume) : undefined
          },
          notes: formData.notes,
          source: 'crm' // 标记来源为 CRM
        })
      })
      
      const data = await response.json()
      
      if (data.errCode === 200) {
        onSuccess()
        onClose()
      } else {
        setError(data.msg || '创建询价失败')
      }
    } catch (err: any) {
      console.error('创建询价失败:', err)
      setError(err.message || '创建询价失败')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (!visible) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        {/* 弹窗内容 */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">新建运输询价</h2>
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
            {/* 错误提示 */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
            
            {/* 客户选择 */}
            <div className="mb-6" ref={customerRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                客户 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.customerId ? formData.customerName : customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      // 清除已选择的客户
                      if (formData.customerId) {
                        setFormData(prev => ({ ...prev, customerId: '', customerName: '' }))
                      }
                      setShowCustomerDropdown(true)
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="搜索客户名称..."
                    className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {formData.customerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, customerId: '', customerName: '' }))
                        setCustomerSearch('')
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* 客户下拉列表 */}
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customers
                      .filter(c => 
                        !customerSearch || 
                        c.customerName.toLowerCase().includes(customerSearch.toLowerCase())
                      )
                      .length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          未找到匹配的客户
                        </div>
                      ) : (
                        customers
                          .filter(c => 
                            !customerSearch || 
                            c.customerName.toLowerCase().includes(customerSearch.toLowerCase())
                          )
                          .map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  customerId: c.id,
                                  customerName: c.customerName
                                }))
                                setCustomerSearch('')
                                setShowCustomerDropdown(false)
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-0 ${
                                formData.customerId === c.id ? 'bg-blue-50 text-blue-600' : ''
                              }`}
                            >
                              {c.customerName}
                            </button>
                          ))
                      )}
                  </div>
                )}
              </div>
            </div>
            
            {/* 路线信息 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                <MapPin className="w-4 h-4 text-blue-500" />
                路线信息
              </h3>
              
              <div className="space-y-4">
                {/* 起点地址 */}
                <div ref={originRef} className="relative">
                  <label className="block text-xs text-gray-600 mb-1">
                    起点地址 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    <input
                      type="text"
                      value={formData.origin}
                      onChange={(e) => handleAddressChange(e.target.value, 'origin')}
                      onFocus={() => formData.origin.length >= 2 && setShowOriginSuggestions(true)}
                      placeholder="输入起点地址（如：Hamburg, Germany）"
                      className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {loadingOrigin && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                  
                  {/* 建议列表 */}
                  {showOriginSuggestions && originSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {originSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id || index}
                          type="button"
                          onClick={() => selectAddress(suggestion, 'origin')}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-0"
                        >
                          <div className="font-medium text-gray-900 truncate">
                            {suggestion.title || suggestion.address}
                          </div>
                          {suggestion.city && (
                            <div className="text-xs text-gray-500">
                              {suggestion.city}, {suggestion.country}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* 途径点列表 */}
                {formData.waypoints.map((waypoint, index) => (
                  <div 
                    key={index} 
                    ref={el => waypointRefs.current[index] = el} 
                    className="relative"
                  >
                    <label className="block text-xs text-gray-600 mb-1">
                      途径点 {index + 1}
                    </label>
                    <div className="relative flex gap-2">
                      <div className="flex-1 relative">
                        <CircleDot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                        <input
                          type="text"
                          value={waypoint}
                          onChange={(e) => handleAddressChange(e.target.value, 'waypoint', index)}
                          onFocus={() => waypoint.length >= 2 && setShowWaypointSuggestions(prev => ({ ...prev, [index]: true }))}
                          placeholder={`输入途径点地址（如：Frankfurt, Germany）`}
                          className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        {loadingWaypoint[index] && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeWaypoint(index)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除途径点"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* 建议列表 */}
                    {showWaypointSuggestions[index] && waypointSuggestions[index]?.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {waypointSuggestions[index].map((suggestion, sIndex) => (
                          <button
                            key={suggestion.id || sIndex}
                            type="button"
                            onClick={() => selectAddress(suggestion, 'waypoint', index)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-0"
                          >
                            <div className="font-medium text-gray-900 truncate">
                              {suggestion.title || suggestion.address}
                            </div>
                            {suggestion.city && (
                              <div className="text-xs text-gray-500">
                                {suggestion.city}, {suggestion.country}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* 添加途径点按钮 */}
                <button
                  type="button"
                  onClick={addWaypoint}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors w-full justify-center"
                >
                  <Plus className="w-4 h-4" />
                  添加途径点
                </button>
                
                {/* 终点地址 */}
                <div ref={destRef} className="relative">
                  <label className="block text-xs text-gray-600 mb-1">
                    终点地址 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) => handleAddressChange(e.target.value, 'destination')}
                      onFocus={() => formData.destination.length >= 2 && setShowDestSuggestions(true)}
                      placeholder="输入终点地址（如：Munich, Germany）"
                      className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {loadingDest && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                  
                  {/* 建议列表 */}
                  {showDestSuggestions && destSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {destSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id || index}
                          type="button"
                          onClick={() => selectAddress(suggestion, 'destination')}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-0"
                        >
                          <div className="font-medium text-gray-900 truncate">
                            {suggestion.title || suggestion.address}
                          </div>
                          {suggestion.city && (
                            <div className="text-xs text-gray-500">
                              {suggestion.city}, {suggestion.country}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 运输方式 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                <Truck className="w-4 h-4 text-blue-500" />
                运输方式 <span className="text-red-500">*</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* 集装箱原柜 */}
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, transportMode: 'container' }))}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.transportMode === 'container'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.transportMode === 'container' ? 'border-blue-500' : 'border-gray-300'
                    }`}>
                      {formData.transportMode === 'container' && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <Container className={`w-5 h-5 ${formData.transportMode === 'container' ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">集装箱原柜</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">整柜从港口直接拖运到目的地，适合大批量货物</p>
                  <p className="text-xs text-blue-600 ml-6 mt-1">FCL / Full Container Load</p>
                </button>
                
                {/* 卡车运输 */}
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, transportMode: 'truck' }))}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.transportMode === 'truck'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.transportMode === 'truck' ? 'border-blue-500' : 'border-gray-300'
                    }`}>
                      {formData.transportMode === 'truck' && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <Truck className={`w-5 h-5 ${formData.transportMode === 'truck' ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">卡车运输</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">拆柜后用卡车配送，适合散货或多地址分发</p>
                  <p className="text-xs text-blue-600 ml-6 mt-1">LTL / Less than Truckload</p>
                </button>
              </div>
            </div>
            
            {/* 柜型选择（仅集装箱模式显示） */}
            {formData.transportMode === 'container' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                  <Package className="w-4 h-4 text-blue-500" />
                  柜型选择
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {containerTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, containerType: type.value }))}
                      className={`p-3 border-2 rounded-lg text-left transition-all ${
                        formData.containerType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                          formData.containerType === type.value ? 'border-blue-500' : 'border-gray-300'
                        }`}>
                          {formData.containerType === type.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <span className="font-medium text-sm">{type.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 ml-5">{type.labelEn}</p>
                      <p className="text-xs text-blue-600 ml-5">{type.dimensions}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 卡车类型选择（仅卡车模式显示） */}
            {formData.transportMode === 'truck' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                  <Truck className="w-4 h-4 text-blue-500" />
                  卡车类型
                </h3>
                
                {/* 分类显示卡车类型 */}
                <div className="space-y-4">
                  {truckTypeCategories.map(category => (
                    <div key={category.category}>
                      {/* 分类标题 */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1 h-4 rounded ${
                          category.category === 'distribution' ? 'bg-green-500' :
                          category.category === 'semi_trailer' ? 'bg-blue-500' : 'bg-amber-500'
                        }`} />
                        <span className="text-xs font-semibold text-gray-700">{category.label}</span>
                        <span className="text-xs text-gray-400">({category.labelEn})</span>
                        <span className="text-xs text-gray-400 ml-auto">{category.description}</span>
                      </div>
                      
                      {/* 该分类下的卡车类型 */}
                      <div className="grid grid-cols-2 gap-2">
                        {category.types.map(type => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, truckType: type.value }))}
                            className={`p-2.5 border-2 rounded-lg text-left transition-all ${
                              formData.truckType === type.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center ${
                                  formData.truckType === type.value ? 'border-blue-500' : 'border-gray-300'
                                }`}>
                                  {formData.truckType === type.value && (
                                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                                  )}
                                </div>
                                <span className="font-medium text-xs">{type.label}</span>
                              </div>
                              {formData.truckType === type.value && (
                                <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 ml-4">{type.labelEn}</p>
                            <p className="text-[10px] text-gray-400 ml-4">{type.spec}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 还柜方式（仅集装箱模式显示） */}
            {formData.transportMode === 'container' && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  还柜方式
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* 同地还柜 */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, returnLocation: 'same', returnAddress: '' }))}
                    className={`p-3 border-2 rounded-lg text-left transition-all ${
                      formData.returnLocation === 'same'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        formData.returnLocation === 'same' ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {formData.returnLocation === 'same' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <span className="font-medium text-sm">同地还柜</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-5">在目的地卸货后，空柜返回起运港堆场</p>
                  </button>
                  
                  {/* 异地还柜 */}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, returnLocation: 'different' }))}
                    className={`p-3 border-2 rounded-lg text-left transition-all ${
                      formData.returnLocation === 'different'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        formData.returnLocation === 'different' ? 'border-blue-500' : 'border-gray-300'
                      }`}>
                        {formData.returnLocation === 'different' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <span className="font-medium text-sm">异地还柜</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-5">空柜返回其他指定堆场（可能产生额外费用）</p>
                  </button>
                </div>
                
                {/* 异地还柜地址输入 */}
                {formData.returnLocation === 'different' && (
                  <div ref={returnRef} className="relative mt-3">
                    <label className="block text-xs text-gray-600 mb-1">
                      还柜地址 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      <input
                        type="text"
                        value={formData.returnAddress}
                        onChange={(e) => handleAddressChange(e.target.value, 'return')}
                        onFocus={() => formData.returnAddress.length >= 2 && setShowReturnSuggestions(true)}
                        placeholder="输入还柜地址"
                        className="w-full pl-9 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      {loadingReturn && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    
                    {/* 建议列表 */}
                    {showReturnSuggestions && returnSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {returnSuggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.id || index}
                            type="button"
                            onClick={() => selectAddress(suggestion, 'return')}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b last:border-0"
                          >
                            <div className="font-medium text-gray-900 truncate">
                              {suggestion.title || suggestion.address}
                            </div>
                            {suggestion.city && (
                              <div className="text-xs text-gray-500">
                                {suggestion.city}, {suggestion.country}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* 货物信息 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                <Package className="w-4 h-4 text-blue-500" />
                货物信息（可选）
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">货物重量 (kg)</label>
                  <input
                    type="number"
                    value={formData.cargoWeight}
                    onChange={(e) => setFormData(prev => ({ ...prev, cargoWeight: e.target.value }))}
                    placeholder="输入货物重量"
                    min="0"
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">货物体积 (m³)</label>
                  <input
                    type="number"
                    value={formData.cargoVolume}
                    onChange={(e) => setFormData(prev => ({ ...prev, cargoVolume: e.target.value }))}
                    placeholder="输入货物体积"
                    min="0"
                    step="0.1"
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
            
            {/* 备注 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="输入其他需求或备注信息"
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>
          </div>
          
          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  创建询价
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
