/**
 * HERE Map Display Component
 * 用于显示运输路线地图
 * 
 * SDK 按需动态加载，避免在不需要地图的页面加载资源
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { MapPin, Navigation, AlertCircle, Loader2 } from 'lucide-react'

// HERE Maps API Key（从环境变量获取）
const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY || ''

// HERE Maps SDK 版本
const HERE_SDK_VERSION = '3.1'
const HERE_SDK_BASE_URL = `https://js.api.here.com/v3/${HERE_SDK_VERSION}`

// 声明全局 H 对象类型
declare global {
  interface Window {
    H: any
    __hereMapsLoading?: Promise<void>
    __hereMapsLoaded?: boolean
  }
}

/**
 * 动态加载单个脚本
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    const existingScript = document.querySelector(`script[src="${src}"]`)
    if (existingScript) {
      resolve()
      return
    }
    
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`加载脚本失败: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * 动态加载 CSS
 */
function loadCSS(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    const existingLink = document.querySelector(`link[href="${href}"]`)
    if (existingLink) {
      resolve()
      return
    }
    
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.type = 'text/css'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`加载样式失败: ${href}`))
    document.head.appendChild(link)
  })
}

/**
 * 动态加载 HERE Maps SDK（单例模式，避免重复加载）
 */
async function loadHereMapsSDK(): Promise<void> {
  // 如果已加载完成，直接返回
  if (window.__hereMapsLoaded && typeof window.H !== 'undefined') {
    return
  }
  
  // 如果正在加载中，等待加载完成
  if (window.__hereMapsLoading) {
    return window.__hereMapsLoading
  }
  
  // 开始加载
  window.__hereMapsLoading = (async () => {
    try {
      // 先加载 CSS
      await loadCSS(`${HERE_SDK_BASE_URL}/mapsjs-ui.css`)
      
      // 按顺序加载 JS（因为有依赖关系）
      await loadScript(`${HERE_SDK_BASE_URL}/mapsjs-core.js`)
      await loadScript(`${HERE_SDK_BASE_URL}/mapsjs-service.js`)
      await loadScript(`${HERE_SDK_BASE_URL}/mapsjs-ui.js`)
      await loadScript(`${HERE_SDK_BASE_URL}/mapsjs-mapevents.js`)
      
      // 验证加载成功
      if (typeof window.H === 'undefined') {
        throw new Error('HERE Maps SDK 加载后 H 对象不可用')
      }
      
      window.__hereMapsLoaded = true
      console.log('HERE Maps SDK 加载成功')
    } catch (error) {
      // 清除加载状态以便重试
      delete window.__hereMapsLoading
      throw error
    }
  })()
  
  return window.__hereMapsLoading
}

interface Location {
  lat: number
  lng: number
  address?: string
  country?: string
}

interface HereMapDisplayProps {
  origin?: Location
  destination?: Location
  waypoints?: Location[]
  polyline?: string | string[]  // 支持单个字符串或字符串数组
  height?: number | string
  showInfo?: boolean
  distance?: number
  duration?: number
  durationFormatted?: string
  hasFerry?: boolean
}

/**
 * 解码 HERE Flexible Polyline
 * 参考: https://github.com/heremaps/flexible-polyline
 */
function decodeFlexiblePolyline(encoded: string): Array<{lat: number, lng: number}> {
  if (!encoded || encoded.length === 0) {
    return []
  }
  
  const DECODING_TABLE = [
    62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
    36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
  ]
  
  const decodeChar = (char: string): number => {
    const charCode = char.charCodeAt(0)
    return DECODING_TABLE[charCode - 45]
  }
  
  const toSigned = (val: number): number => {
    let res = val
    if (res & 1) {
      res = ~res
    }
    res >>= 1
    return res
  }
  
  const result: Array<{lat: number, lng: number}> = []
  let index = 0
  let lat = 0
  let lng = 0
  
  // 跳过头部信息
  let headerValue = 0
  let headerShift = 0
  while (index < encoded.length) {
    const value = decodeChar(encoded[index])
    index++
    headerValue |= (value & 0x1F) << headerShift
    if ((value & 0x20) === 0) {
      break
    }
    headerShift += 5
  }
  
  const precision = headerValue & 0x0F
  const thirdDim = (headerValue >> 4) & 0x07
  const thirdDimPrecision = (headerValue >> 7) & 0x0F
  const multiplier = Math.pow(10, precision)
  
  // 解码坐标
  while (index < encoded.length) {
    // 解码纬度
    let shift = 0
    let delta = 0
    while (index < encoded.length) {
      const value = decodeChar(encoded[index])
      index++
      delta |= (value & 0x1F) << shift
      if ((value & 0x20) === 0) {
        break
      }
      shift += 5
    }
    lat += toSigned(delta)
    
    if (index >= encoded.length) break
    
    // 解码经度
    shift = 0
    delta = 0
    while (index < encoded.length) {
      const value = decodeChar(encoded[index])
      index++
      delta |= (value & 0x1F) << shift
      if ((value & 0x20) === 0) {
        break
      }
      shift += 5
    }
    lng += toSigned(delta)
    
    // 如果有第三维度（高度），跳过
    if (thirdDim !== 0 && index < encoded.length) {
      shift = 0
      while (index < encoded.length) {
        const value = decodeChar(encoded[index])
        index++
        if ((value & 0x20) === 0) {
          break
        }
        shift += 5
      }
    }
    
    result.push({
      lat: lat / multiplier,
      lng: lng / multiplier
    })
  }
  
  return result
}

export default function HereMapDisplay({
  origin,
  destination,
  waypoints = [],
  polyline,
  height = 300,
  showInfo = true,
  distance,
  duration,
  durationFormatted,
  hasFerry
}: HereMapDisplayProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const mapInitializedRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // 稳定化依赖项 - 只在坐标真正变化时才触发重新初始化
  const locationKey = useMemo(() => {
    if (!origin || !destination) return ''
    return `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng])
  
  // 动态加载 HERE Maps SDK
  useEffect(() => {
    // 如果没有起点和终点，不需要加载 SDK
    if (!origin || !destination) {
      setIsLoading(false)
      return
    }
    
    let cancelled = false
    
    const loadSDK = async () => {
      try {
        // 设置超时（15秒，考虑到网络可能较慢）
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('HERE Maps SDK 加载超时，请检查网络连接')), 15000)
        })
        
        await Promise.race([loadHereMapsSDK(), timeoutPromise])
        
        if (!cancelled) {
          setIsLoaded(true)
          setError(null)
        }
      } catch (err: any) {
        console.error('HERE Maps SDK 加载失败:', err)
        if (!cancelled) {
          setError(err.message || 'HERE Maps SDK 加载失败')
          setIsLoading(false)
        }
      }
    }
    
    loadSDK()
    
    return () => {
      cancelled = true
    }
  }, [origin, destination])
  
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    if (!origin || !destination) {
      setIsLoading(false)
      return
    }
    
    if (!HERE_API_KEY) {
      setError('HERE API Key 未配置')
      setIsLoading(false)
      return
    }
    
    // 防止重复初始化 - 如果已初始化且位置相同则跳过
    if (mapInitializedRef.current && mapInstanceRef.current) {
      setIsLoading(false)
      return
    }
    
    // 如果已有地图实例，先销毁
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.dispose()
      } catch (e) {
        console.warn('销毁旧地图实例失败:', e)
      }
      mapInstanceRef.current = null
    }
    
    try {
      const H = window.H
      
      // 初始化平台
      const platform = new H.service.Platform({
        apikey: HERE_API_KEY
      })
      
      // 获取默认地图图层
      const defaultLayers = platform.createDefaultLayers()
      
      // 计算中心点
      const centerLat = (origin.lat + destination.lat) / 2
      const centerLng = (origin.lng + destination.lng) / 2
      
      // 创建地图
      const map = new H.Map(
        mapRef.current,
        defaultLayers.vector.normal.map,
        {
          zoom: 5,
          center: { lat: centerLat, lng: centerLng },
          engineType: H.Map.EngineType.WEBGL,
        }
      )
      
      mapInstanceRef.current = map
      mapInitializedRef.current = true
      
      // 添加地图交互
      const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map))
      
      // 添加UI控件
      const ui = H.ui.UI.createDefault(map, defaultLayers)
      
      // 创建标记组
      const group = new H.map.Group()
      
      // 添加起点标记
      const originMarker = new H.map.Marker(
        { lat: origin.lat, lng: origin.lng },
        {
          icon: new H.map.Icon(
            `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
              <path fill="#22c55e" d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z"/>
              <circle cx="16" cy="16" r="8" fill="white"/>
              <text x="16" y="20" text-anchor="middle" fill="#22c55e" font-size="12" font-weight="bold">起</text>
            </svg>`,
            { size: { w: 32, h: 40 }, anchor: { x: 16, y: 40 } }
          )
        }
      )
      group.addObject(originMarker)
      
      // 添加终点标记
      const destMarker = new H.map.Marker(
        { lat: destination.lat, lng: destination.lng },
        {
          icon: new H.map.Icon(
            `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
              <path fill="#ef4444" d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z"/>
              <circle cx="16" cy="16" r="8" fill="white"/>
              <text x="16" y="20" text-anchor="middle" fill="#ef4444" font-size="12" font-weight="bold">终</text>
            </svg>`,
            { size: { w: 32, h: 40 }, anchor: { x: 16, y: 40 } }
          )
        }
      )
      group.addObject(destMarker)
      
      // 添加途经点标记
      waypoints.forEach((wp, index) => {
        if (wp.lat && wp.lng) {
          const wpMarker = new H.map.Marker(
            { lat: wp.lat, lng: wp.lng },
            {
              icon: new H.map.Icon(
                `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30">
                  <path fill="#3b82f6" d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12z"/>
                  <circle cx="12" cy="12" r="6" fill="white"/>
                  <text x="12" y="15" text-anchor="middle" fill="#3b82f6" font-size="10" font-weight="bold">${index + 1}</text>
                </svg>`,
                { size: { w: 24, h: 30 }, anchor: { x: 12, y: 30 } }
              )
            }
          )
          group.addObject(wpMarker)
        }
      })
      
      // 将标记组添加到地图
      map.addObject(group)
      
      // 路线需要单独添加到地图（不通过 Group），以确保在 WebGL 模式下正确渲染
      let routeLine: any = null
      
      // 如果有 polyline，绘制路线
      if (polyline) {
        try {
          // 将 polyline 转为数组（支持字符串或数组格式）
          let polylineSegments: string[] = []
          if (Array.isArray(polyline)) {
            polylineSegments = polyline.filter(p => p && p.length > 0)
          } else if (typeof polyline === 'string') {
            polylineSegments = polyline.split('|').filter(p => p.length > 0)
          }
          
          // 合并所有段的点到一个 LineString
          const lineString = new H.geo.LineString()
          let totalPoints = 0
          
          for (const segment of polylineSegments) {
            const routePoints = decodeFlexiblePolyline(segment)
            if (routePoints.length > 0) {
              routePoints.forEach(point => {
                lineString.pushPoint({ lat: point.lat, lng: point.lng })
              })
              totalPoints += routePoints.length
            }
          }
          
          if (totalPoints > 0) {
            // 创建路线 Polyline - 直接添加到地图而不是 Group
            routeLine = new H.map.Polyline(lineString, {
              style: {
                strokeColor: '#2563eb',
                lineWidth: 5
              }
            })
            map.addObject(routeLine)
          } else {
            throw new Error('无法解码 polyline')
          }
        } catch (err) {
          console.error('解码 polyline 失败:', err)
          // 绘制虚线连接
          const lineString = new H.geo.LineString()
          lineString.pushPoint({ lat: origin.lat, lng: origin.lng })
          waypoints.forEach(wp => {
            if (wp.lat && wp.lng) {
              lineString.pushPoint({ lat: wp.lat, lng: wp.lng })
            }
          })
          lineString.pushPoint({ lat: destination.lat, lng: destination.lng })
          
          routeLine = new H.map.Polyline(lineString, {
            style: {
              strokeColor: '#2563eb',
              lineWidth: 3,
              lineDash: [4, 4]
            }
          })
          map.addObject(routeLine)
        }
      } else {
        // 没有 polyline，绘制虚线
        const lineString = new H.geo.LineString()
        lineString.pushPoint({ lat: origin.lat, lng: origin.lng })
        waypoints.forEach(wp => {
          if (wp.lat && wp.lng) {
            lineString.pushPoint({ lat: wp.lat, lng: wp.lng })
          }
        })
        lineString.pushPoint({ lat: destination.lat, lng: destination.lng })
        
        routeLine = new H.map.Polyline(lineString, {
          style: {
            strokeColor: '#2563eb',
            lineWidth: 3,
            lineDash: [4, 4]
          }
        })
        map.addObject(routeLine)
      }
      
      // 自适应视图以显示所有对象（标记 + 路线）
      let bounds = group.getBoundingBox()
      if (routeLine) {
        const routeBounds = routeLine.getBoundingBox()
        if (routeBounds) {
          if (bounds) {
            bounds = bounds.mergeRect(routeBounds)
          } else {
            bounds = routeBounds
          }
        }
      }
      
      // 计算合适的缩放级别的辅助函数
      // 最小缩放级别为6，约对应500公里范围
      const calculateOptimalZoom = (bounds: any): number => {
        if (!bounds) return 6
        
        // 获取边界的跨度
        const latSpan = Math.abs(bounds.getTop() - bounds.getBottom())
        const lngSpan = Math.abs(bounds.getRight() - bounds.getLeft())
        
        // 根据跨度计算缩放级别
        const maxSpan = Math.max(latSpan, lngSpan)
        
        let zoom = 6 // 默认和最小缩放级别（约500公里）
        if (maxSpan < 0.5) zoom = 12
        else if (maxSpan < 1) zoom = 10
        else if (maxSpan < 2) zoom = 9
        else if (maxSpan < 5) zoom = 8
        else if (maxSpan < 10) zoom = 7
        else zoom = 6 // 超过10度跨度也保持在6级（约500公里）
        
        return zoom
      }
      
      // 立即触发 resize 以确保地图容器尺寸正确
      map.getViewPort().resize()
      
      if (bounds) {
        // 计算最佳缩放级别
        const optimalZoom = calculateOptimalZoom(bounds)
        console.log('计算的最佳缩放级别:', optimalZoom)
        
        // 获取边界中心
        const center = bounds.getCenter()
        
        // 直接设置中心和缩放级别，而不是使用 setLookAtData
        map.setCenter(center)
        map.setZoom(optimalZoom)
        
        console.log('初始设置 - 中心:', center, '缩放:', optimalZoom)
      }
      
      // 延迟触发 resize 以确保地图瓦片正确渲染
      setTimeout(() => {
        if (mapInstanceRef.current && mapRef.current) {
          try {
            mapInstanceRef.current.getViewPort().resize()
            const currentZoom = mapInstanceRef.current.getZoom()
            // 最小缩放级别为6（约500公里）
            if (currentZoom < 6) {
              mapInstanceRef.current.setZoom(6)
            }
          } catch (e) {
            console.warn('resize调整失败:', e)
          }
        }
      }, 100)
      
      // 再次延迟，确保动画完成后地图完全渲染
      setTimeout(() => {
        if (mapInstanceRef.current && mapRef.current) {
          try {
            mapInstanceRef.current.getViewPort().resize()
            const finalZoom = mapInstanceRef.current.getZoom()
            // 最小缩放级别为6（约500公里）
            if (finalZoom < 6) {
              mapInstanceRef.current.setZoom(6)
            }
          } catch (e) {
            console.warn('resize调整失败:', e)
          }
        }
      }, 300)
      
      setIsLoading(false)
      
      // 清理函数
      return () => {
        mapInitializedRef.current = false
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.dispose()
          } catch (e) {
            console.warn('清理地图实例失败:', e)
          }
          mapInstanceRef.current = null
        }
      }
    } catch (err: any) {
      console.error('初始化地图失败:', err)
      setError(err.message || '初始化地图失败')
      setIsLoading(false)
    }
  }, [isLoaded, locationKey, polyline])
  
  // 窗口大小变化时重新调整地图
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.getViewPort().resize()
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  if (error) {
    return (
      <div 
        className="flex flex-col items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    )
  }
  
  if (!origin || !destination) {
    return (
      <div 
        className="flex flex-col items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <MapPin className="w-8 h-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">请先设置起点和终点</p>
      </div>
    )
  }
  
  return (
    <div className="relative">
      {/* 地图容器 */}
      <div 
        ref={mapRef}
        className="rounded-lg overflow-hidden"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      />
      
      {/* 加载中遮罩 */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg"
        >
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}
      
      {/* 路线信息卡片 */}
      {showInfo && !isLoading && (distance || duration) && (
        <div className="absolute bottom-3 left-3 bg-white rounded-lg shadow-lg p-3 text-xs">
          <div className="flex items-center gap-4">
            {distance && (
              <div className="flex items-center gap-1">
                <Navigation className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{distance} km</span>
              </div>
            )}
            {(durationFormatted || duration) && (
              <div className="flex items-center gap-1">
                <span className="text-gray-500">约</span>
                <span className="font-medium">{durationFormatted || `${Math.round(duration! / 60)}小时`}</span>
              </div>
            )}
            {hasFerry && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                <span>🚢 含渡轮</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

