/**
 * HERE Map Display Component
 * 用于显示运输路线地图
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation, AlertCircle, Loader2 } from 'lucide-react'

// HERE Maps API Key（从环境变量获取）
const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY || ''

// 声明全局 H 对象类型
declare global {
  interface Window {
    H: any
  }
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
  polyline?: string
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
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // 检查 HERE SDK 是否加载
    const checkHereSDK = () => {
      if (typeof window.H !== 'undefined') {
        setIsLoaded(true)
        return true
      }
      return false
    }
    
    if (checkHereSDK()) {
      return
    }
    
    // 等待 SDK 加载
    const interval = setInterval(() => {
      if (checkHereSDK()) {
        clearInterval(interval)
      }
    }, 100)
    
    // 5秒超时
    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!isLoaded) {
        setError('HERE Maps SDK 加载超时')
        setIsLoading(false)
      }
    }, 5000)
    
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])
  
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
          center: { lat: centerLat, lng: centerLng }
        }
      )
      
      mapInstanceRef.current = map
      
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
      
      // 如果有 polyline，绘制路线
      if (polyline) {
        try {
          const routePoints = decodeFlexiblePolyline(polyline)
          
          if (routePoints.length > 0) {
            const lineString = new H.geo.LineString()
            routePoints.forEach(point => {
              lineString.pushPoint({ lat: point.lat, lng: point.lng })
            })
            
            const routeLine = new H.map.Polyline(lineString, {
              style: {
                strokeColor: '#2563eb',
                lineWidth: 4
              }
            })
            group.addObject(routeLine)
          }
        } catch (err) {
          console.error('解码 polyline 失败:', err)
          // 绘制直线连接
          const lineString = new H.geo.LineString()
          lineString.pushPoint({ lat: origin.lat, lng: origin.lng })
          waypoints.forEach(wp => {
            if (wp.lat && wp.lng) {
              lineString.pushPoint({ lat: wp.lat, lng: wp.lng })
            }
          })
          lineString.pushPoint({ lat: destination.lat, lng: destination.lng })
          
          const routeLine = new H.map.Polyline(lineString, {
            style: {
              strokeColor: '#2563eb',
              lineWidth: 3,
              lineDash: [4, 4]
            }
          })
          group.addObject(routeLine)
        }
      } else {
        // 没有 polyline，绘制直线
        const lineString = new H.geo.LineString()
        lineString.pushPoint({ lat: origin.lat, lng: origin.lng })
        waypoints.forEach(wp => {
          if (wp.lat && wp.lng) {
            lineString.pushPoint({ lat: wp.lat, lng: wp.lng })
          }
        })
        lineString.pushPoint({ lat: destination.lat, lng: destination.lng })
        
        const routeLine = new H.map.Polyline(lineString, {
          style: {
            strokeColor: '#2563eb',
            lineWidth: 3,
            lineDash: [4, 4]
          }
        })
        group.addObject(routeLine)
      }
      
      // 将组添加到地图
      map.addObject(group)
      
      // 自适应视图以显示所有标记
      map.getViewModel().setLookAtData({
        bounds: group.getBoundingBox()
      })
      
      setIsLoading(false)
      
      // 清理函数
      return () => {
        map.dispose()
      }
    } catch (err: any) {
      console.error('初始化地图失败:', err)
      setError(err.message || '初始化地图失败')
      setIsLoading(false)
    }
  }, [isLoaded, origin, destination, waypoints, polyline])
  
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

