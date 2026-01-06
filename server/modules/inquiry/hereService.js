/**
 * HERE Routing API 服务
 * 用于计算欧洲卡车运输路线和费用
 * 
 * 文档: https://developer.here.com/documentation/routing-api/dev_guide/index.html
 * 
 * 地址缓存策略：
 * 1. 输入地址时，先从本地地址缓存库查找匹配
 * 2. 如果缓存没有，再调用 HERE API 获取
 * 3. HERE API 返回的结果会自动保存到缓存库
 * 
 * API 配额管理：
 * - 每次 API 调用前检查配额
 * - 调用后记录使用量
 * - 接近限额时发出警告，达到限额时阻止调用
 */

import fetch from 'node-fetch'
import * as addressCache from './addressCacheModel.js'
import * as hereApiUsage from './hereApiUsageService.js'

// HERE API 配置
const HERE_API_KEY = process.env.HERE_API_KEY || ''
const HERE_ROUTING_URL = 'https://router.hereapi.com/v8/routes'
const HERE_GEOCODING_URL = 'https://geocode.search.hereapi.com/v1/geocode'
const HERE_AUTOSUGGEST_URL = 'https://autosuggest.search.hereapi.com/v1/autosuggest'

// 是否启用地址缓存（可通过环境变量控制）
const ENABLE_ADDRESS_CACHE = process.env.DISABLE_ADDRESS_CACHE !== 'true'

// 欧洲国家通行费率（EUR/km，估算值）
const TOLL_RATES = {
  DE: 0.15,   // 德国
  FR: 0.12,   // 法国
  IT: 0.10,   // 意大利
  ES: 0.08,   // 西班牙
  AT: 0.18,   // 奥地利
  CH: 0.25,   // 瑞士
  BE: 0.10,   // 比利时
  NL: 0.08,   // 荷兰
  PL: 0.06,   // 波兰
  CZ: 0.08,   // 捷克
  HU: 0.07,   // 匈牙利
  DEFAULT: 0.10
}

// 燃油附加费率（根据距离）
const FUEL_SURCHARGE_RATE = 0.15 // EUR/km

/**
 * 地址自动补全 - 返回多个匹配地址建议
 * 先从本地缓存查找，没有再调用 HERE API
 * @param {string} query - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 * @param {boolean} forceApi - 强制使用 API（跳过缓存）
 */
export async function autosuggestAddress(query, limit = 5, forceApi = false) {
  // 1. 先从缓存查找
  if (ENABLE_ADDRESS_CACHE && !forceApi) {
    try {
      const cachedResults = await addressCache.findAutosuggestCache(query, limit)
      if (cachedResults && cachedResults.length > 0) {
        console.log(`[AddressCache] 缓存命中: "${query}", 返回 ${cachedResults.length} 条结果`)
        // 更新命中统计
        for (const result of cachedResults) {
          if (result.id) {
            addressCache.updateHitCount(result.id)
          }
        }
        // 记录缓存命中（不消耗配额）
        hereApiUsage.recordApiCall('autosuggest', true, true).catch(() => {})
        return cachedResults
      }
      console.log(`[AddressCache] 缓存未命中: "${query}", 调用 HERE API`)
    } catch (cacheError) {
      console.error('[AddressCache] 查询缓存出错，降级到 API:', cacheError)
    }
  }
  
  // 2. 检查 API 配额
  const quotaCheck = await hereApiUsage.checkCanCall('autosuggest')
  if (!quotaCheck.allowed) {
    console.error('[HereService] Autosuggest API 配额已用尽')
    throw new Error(quotaCheck.reason)
  }
  if (quotaCheck.warning) {
    console.warn('[HereService]', quotaCheck.reason)
  }
  
  // 3. 调用 HERE API
  if (!HERE_API_KEY) {
    console.error('HERE API Key 未配置')
    throw new Error('HERE API Key 未配置，请在系统设置中配置 HERE_API_KEY')
  }
  
  try {
    // 添加 at 参数（欧洲中心点：德国法兰克福）作为搜索中心，提高搜索准确性
    const url = `${HERE_AUTOSUGGEST_URL}?q=${encodeURIComponent(query)}&apiKey=${HERE_API_KEY}&limit=${limit}&at=50.1109,8.6821&in=countryCode:DEU,FRA,NLD,BEL,ITA,ESP,POL,AUT,CHE,CZE,GBR&lang=en`
    const response = await fetch(url)
    const data = await response.json()
    
    // 记录 API 调用成功
    hereApiUsage.recordApiCall('autosuggest', true, false).catch(() => {})
    
    if (data.items && data.items.length > 0) {
      const results = data.items
        .filter(item => item.address)
        .map(item => ({
          title: item.title,
          address: item.address.label,
          city: item.address.city,
          country: item.address.countryName,
          countryCode: item.address.countryCode,
          postalCode: item.address.postalCode,
          lat: item.position?.lat,
          lng: item.position?.lng
        }))
      
      // 4. 保存到缓存（异步，不阻塞返回）
      if (ENABLE_ADDRESS_CACHE && results.length > 0) {
        addressCache.saveAutosuggestCache(query, results).catch(err => {
          console.error('[AddressCache] 保存缓存失败:', err)
        })
      }
      
      return results
    }
    
    return []
  } catch (error) {
    // 记录 API 调用失败
    hereApiUsage.recordApiCall('autosuggest', false, false).catch(() => {})
    console.error('地址自动补全失败:', error)
    throw error
  }
}

/**
 * 地理编码 - 将地址转换为坐标
 * 先从本地缓存查找，没有再调用 HERE API
 * @param {string} address - 地址
 * @param {boolean} forceApi - 强制使用 API（跳过缓存）
 */
export async function geocodeAddress(address, forceApi = false) {
  // 1. 先从缓存查找
  if (ENABLE_ADDRESS_CACHE && !forceApi) {
    try {
      const cachedResult = await addressCache.findGeocodeCache(address)
      if (cachedResult) {
        console.log(`[AddressCache] 地理编码缓存命中: "${address}"`)
        if (cachedResult.id) {
          addressCache.updateHitCount(cachedResult.id)
        }
        // 记录缓存命中（不消耗配额）
        hereApiUsage.recordApiCall('geocoding', true, true).catch(() => {})
        return cachedResult
      }
      console.log(`[AddressCache] 地理编码缓存未命中: "${address}", 调用 HERE API`)
    } catch (cacheError) {
      console.error('[AddressCache] 查询地理编码缓存出错，降级到 API:', cacheError)
    }
  }
  
  // 2. 检查 API 配额
  const quotaCheck = await hereApiUsage.checkCanCall('geocoding')
  if (!quotaCheck.allowed) {
    console.error('[HereService] Geocoding API 配额已用尽')
    throw new Error(quotaCheck.reason)
  }
  if (quotaCheck.warning) {
    console.warn('[HereService]', quotaCheck.reason)
  }
  
  // 3. 调用 HERE API
  if (!HERE_API_KEY) {
    console.error('HERE API Key 未配置')
    throw new Error('HERE API Key 未配置，请在系统设置中配置 HERE_API_KEY')
  }
  
  try {
    const url = `${HERE_GEOCODING_URL}?q=${encodeURIComponent(address)}&apiKey=${HERE_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    
    // 记录 API 调用成功
    hereApiUsage.recordApiCall('geocoding', true, false).catch(() => {})
    
    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      const result = {
        lat: item.position.lat,
        lng: item.position.lng,
        address: item.address.label,
        country: item.address.countryCode,
        city: item.address.city,
        postalCode: item.address.postalCode
      }
      
      // 4. 保存到缓存（异步，不阻塞返回）
      if (ENABLE_ADDRESS_CACHE) {
        addressCache.saveGeocodeCache(address, result).catch(err => {
          console.error('[AddressCache] 保存地理编码缓存失败:', err)
        })
      }
      
      return result
    }
    
    return null
  } catch (error) {
    // 记录 API 调用失败
    hereApiUsage.recordApiCall('geocoding', false, false).catch(() => {})
    console.error('地理编码失败:', error)
    throw error
  }
}

/**
 * 计算卡车路线
 * @param {Object} params
 * @param {Object} params.origin - 起点 {lat, lng} 或 {address}
 * @param {Object} params.destination - 终点 {lat, lng} 或 {address}
 * @param {Array} params.waypoints - 途经点（多点卸货）
 * @param {Object} params.truck - 卡车参数
 */
export async function calculateTruckRoute(params) {
  const { origin, destination, waypoints = [], truck = {} } = params
  
  if (!HERE_API_KEY) {
    console.error('HERE API Key 未配置')
    throw new Error('HERE API Key 未配置，请在系统设置中配置 HERE_API_KEY')
  }
  
  // 检查 Routing API 配额
  const quotaCheck = await hereApiUsage.checkCanCall('routing')
  if (!quotaCheck.allowed) {
    console.error('[HereService] Routing API 配额已用尽')
    throw new Error(quotaCheck.reason)
  }
  if (quotaCheck.warning) {
    console.warn('[HereService]', quotaCheck.reason)
  }
  
  // 处理地址到坐标的转换（这会消耗 Geocoding 配额，已在 geocodeAddress 中处理）
  let originCoords = origin.lat ? origin : await geocodeAddress(origin.address)
  let destCoords = destination.lat ? destination : await geocodeAddress(destination.address)
  
  if (!originCoords || !destCoords) {
    throw new Error('无法解析起点或终点地址')
  }
  
  // 处理途经点
  const waypointCoords = []
  for (const wp of waypoints) {
    const coords = wp.lat ? wp : await geocodeAddress(wp.address)
    if (coords) {
      waypointCoords.push(coords)
    }
  }
  
  try {
    // 构建 HERE API 请求
    let url = `${HERE_ROUTING_URL}?`
    url += `transportMode=truck`
    url += `&origin=${originCoords.lat},${originCoords.lng}`
    url += `&destination=${destCoords.lat},${destCoords.lng}`
    
    // 添加途经点
    waypointCoords.forEach((wp, i) => {
      url += `&via=${wp.lat},${wp.lng}`
    })
    
    // 卡车参数
    if (truck.grossWeight) {
      url += `&truck[grossWeight]=${truck.grossWeight}`
    }
    if (truck.height) {
      url += `&truck[height]=${Math.round(truck.height * 100)}` // 转换为厘米
    }
    if (truck.width) {
      url += `&truck[width]=${Math.round(truck.width * 100)}`
    }
    if (truck.length) {
      url += `&truck[length]=${Math.round(truck.length * 100)}`
    }
    if (truck.axleCount) {
      url += `&truck[axleCount]=${truck.axleCount}`
    }
    
    // 允许渡轮路线（对于岛屿目的地很重要）
    // 不设置 avoid[features]=ferry，默认允许渡轮
    
    // 返回详细信息，包括渡轮段信息
    url += `&return=summary,polyline,actions,turnByTurnActions,typicalDuration`
    url += `&apiKey=${HERE_API_KEY}`
    
    console.log('[HERE API] 请求路线:', {
      origin: `${originCoords.lat},${originCoords.lng}`,
      destination: `${destCoords.lat},${destCoords.lng}`,
      originAddress: originCoords.address,
      destAddress: destCoords.address
    })
    
    const response = await fetch(url)
    const data = await response.json()
    
    // 记录 Routing API 调用成功
    hereApiUsage.recordApiCall('routing', true, false).catch(() => {})
    
    // 记录 API 返回的路段数量
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]
      console.log('[HERE API] 返回路线信息:', {
        sectionsCount: route.sections?.length || 0,
        sections: route.sections?.map((s, i) => ({
          index: i,
          transport: s.transport?.mode,
          distance: s.summary?.length,
          duration: s.summary?.duration
        }))
      })
    }
    
    if (data.routes && data.routes.length > 0) {
      return parseHereRouteResponse(data.routes[0], originCoords, destCoords, waypointCoords, truck)
    }
    
    throw new Error('未找到可用路线')
  } catch (error) {
    // 记录 API 调用失败
    hereApiUsage.recordApiCall('routing', false, false).catch(() => {})
    console.error('HERE API 调用失败:', error)
    throw error
  }
}

/**
 * 解析 HERE API 返回的路线数据
 * 注意：需要累加所有 sections 的距离和时间（特别是涉及渡轮的路线）
 */
function parseHereRouteResponse(route, origin, destination, waypoints, truck) {
  const sections = route.sections
  
  // 累加所有 sections 的距离和时间
  let totalLength = 0      // 总距离（米）
  let totalDurationSec = 0 // 总时间（秒）
  let roadDistance = 0     // 陆路距离（米）
  let ferryDistance = 0    // 渡轮距离（米）
  let hasFerry = false     // 是否包含渡轮
  const polylines = []     // 收集所有路段的 polyline
  
  for (const section of sections) {
    const summary = section.summary
    totalLength += summary.length || 0
    totalDurationSec += summary.duration || 0
    
    // 检测渡轮段
    if (section.transport && section.transport.mode === 'ferry') {
      hasFerry = true
      ferryDistance += summary.length || 0
    } else {
      roadDistance += summary.length || 0
    }
    
    if (section.polyline) {
      polylines.push(section.polyline)
    }
  }
  
  // 转换单位
  const totalDistance = totalLength / 1000       // 公里
  const totalDuration = totalDurationSec / 60    // 分钟
  const roadDistanceKm = roadDistance / 1000     // 陆路公里
  const ferryDistanceKm = ferryDistance / 1000   // 渡轮公里
  
  // 估算通行费（仅基于陆路距离）
  const estimatedTolls = estimateTolls(roadDistanceKm, origin.country, destination.country)
  
  // 估算燃油附加费（仅基于陆路距离）
  const fuelSurcharge = roadDistanceKm * FUEL_SURCHARGE_RATE
  
  // 渡轮费用估算（如果有渡轮段）
  // 巴塞罗那到 Mallorca 渡轮大约 80-150 EUR/卡车
  const ferryEstimate = hasFerry ? estimateFerryFee(ferryDistanceKm, truck) : 0
  
  return {
    origin: {
      lat: origin.lat,
      lng: origin.lng,
      address: origin.address,
      country: origin.country
    },
    destination: {
      lat: destination.lat,
      lng: destination.lng,
      address: destination.address,
      country: destination.country
    },
    waypoints: waypoints.map(wp => ({
      lat: wp.lat,
      lng: wp.lng,
      address: wp.address
    })),
    route: {
      distance: Math.round(totalDistance),
      duration: Math.round(totalDuration),
      durationFormatted: formatDuration(totalDuration),
      polyline: polylines.join('|'), // 合并所有路段的 polyline，用 | 分隔
      polylines: polylines,          // 保留原始数组供前端使用
      segments: sections.length,     // 路段数量
      roadDistance: Math.round(roadDistanceKm),   // 陆路距离
      ferryDistance: Math.round(ferryDistanceKm), // 渡轮距离
      hasFerry: hasFerry             // 是否包含渡轮
    },
    costs: {
      tolls: Math.round(estimatedTolls * 100) / 100,
      fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
      ferryFee: Math.round(ferryEstimate * 100) / 100,
      currency: 'EUR'
    },
    truck: truck
  }
}

/**
 * 估算渡轮费用
 * 基于渡轮距离和卡车类型
 */
function estimateFerryFee(ferryDistanceKm, truck) {
  // 基础费率：约 0.8 EUR/km（渡轮比陆路贵很多）
  // 巴塞罗那-Mallorca 约 200km，费用约 100-200 EUR
  const baseFerryRate = 0.8
  
  // 根据卡车重量调整费率
  let weightMultiplier = 1
  if (truck.grossWeight) {
    if (truck.grossWeight > 30000) {
      weightMultiplier = 1.5  // 重型卡车
    } else if (truck.grossWeight > 12000) {
      weightMultiplier = 1.2  // 中型卡车
    }
  }
  
  // 最低渡轮费用 80 EUR
  const ferryFee = Math.max(80, ferryDistanceKm * baseFerryRate * weightMultiplier)
  
  return ferryFee
}

/**
 * 估算通行费
 */
function estimateTolls(distance, originCountry, destCountry) {
  // 简化计算：使用平均费率
  const originRate = TOLL_RATES[originCountry] || TOLL_RATES.DEFAULT
  const destRate = TOLL_RATES[destCountry] || TOLL_RATES.DEFAULT
  const avgRate = (originRate + destRate) / 2
  
  // 假设约60%的路程需要付费
  return distance * avgRate * 0.6
}

/**
 * 格式化时间
 */
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`
  }
  return `${mins}分钟`
}

/**
 * 计算运输费用
 */
export function calculateTransportCost(routeData, truckType) {
  const { distance, roadDistance, ferryDistance, hasFerry } = routeData.route
  const { tolls, fuelSurcharge, ferryFee } = routeData.costs
  
  // 基础运费 = 陆路距离 × 费率（渡轮段单独计算）
  const effectiveDistance = roadDistance || distance
  const baseCost = effectiveDistance * truckType.baseRatePerKm
  
  // 应用最低收费
  const transportCost = Math.max(baseCost, truckType.minCharge)
  
  // 总费用 = 运费 + 通行费 + 燃油附加费 + 渡轮费
  const totalFerryFee = ferryFee || 0
  const totalCost = transportCost + tolls + fuelSurcharge + totalFerryFee
  
  return {
    baseCost: Math.round(baseCost * 100) / 100,
    transportCost: Math.round(transportCost * 100) / 100,
    tolls: Math.round(tolls * 100) / 100,
    fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
    ferryFee: Math.round(totalFerryFee * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    currency: 'EUR',
    breakdown: {
      distance,
      roadDistance: roadDistance || distance,
      ferryDistance: ferryDistance || 0,
      hasFerry: hasFerry || false,
      ratePerKm: truckType.baseRatePerKm,
      minCharge: truckType.minCharge,
      truckType: truckType.name
    }
  }
}


/**
 * Haversine 公式计算两点间距离（公里）
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // 地球半径（公里）
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * 根据邮编获取城市名
 * @param {string} postalCode - 邮编，格式如 "DE-41751" 或 "41751"
 * @param {string} countryCode - 国家代码，如 "DE", "FR"
 */
export async function getCityByPostalCode(postalCode, countryCode = '') {
  // 解析邮编格式
  let code = postalCode
  let country = countryCode
  
  // 如果邮编格式是 "DE-41751"，提取国家代码和数字部分
  const match = postalCode.match(/^([A-Z]{2})-?(\d+)/)
  if (match) {
    country = match[1]
    code = match[2]
  }
  
  if (!country || !code) {
    return null
  }
  
  // 构建搜索查询
  const searchQuery = `${code}, ${country}`
  
  try {
    const result = await geocodeAddress(searchQuery)
    if (result && result.city) {
      return {
        postalCode: postalCode,
        city: result.city,
        country: result.country,
        fullAddress: result.address
      }
    }
    return null
  } catch (error) {
    console.error('获取城市失败:', error)
    return null
  }
}

/**
 * 批量获取邮编对应的城市
 * @param {Array<string>} postalCodes - 邮编数组
 */
export async function batchGetCities(postalCodes) {
  const results = {}
  const uniqueCodes = [...new Set(postalCodes.filter(Boolean))]
  
  // 并行请求，但限制并发数
  const batchSize = 5
  for (let i = 0; i < uniqueCodes.length; i += batchSize) {
    const batch = uniqueCodes.slice(i, i + batchSize)
    const promises = batch.map(code => getCityByPostalCode(code))
    const batchResults = await Promise.all(promises)
    
    batch.forEach((code, index) => {
      if (batchResults[index]) {
        results[code] = batchResults[index].city
      }
    })
  }
  
  return results
}

// 导出地址缓存相关功能
export { addressCache }

// 导出 API 使用量监控功能
export { hereApiUsage }

/**
 * 获取 HERE API 使用统计
 * 用于前端显示和管理监控
 */
export async function getApiUsageStats() {
  return await hereApiUsage.getAllUsageStats()
}

/**
 * 获取 API 使用历史
 */
export async function getApiUsageHistory(months = 6) {
  return await hereApiUsage.getUsageHistory(months)
}

/**
 * 手动同步 API 调用次数
 * 可用于从 HERE 控制台同步实际使用量
 */
export async function syncApiCallCount(apiType, count) {
  return await hereApiUsage.setCallCount(apiType, count)
}

export default {
  autosuggestAddress,
  geocodeAddress,
  calculateTruckRoute,
  calculateTransportCost,
  getCityByPostalCode,
  batchGetCities,
  addressCache,       // 导出缓存模块
  hereApiUsage,       // 导出使用量监控模块
  getApiUsageStats,   // 获取使用统计
  getApiUsageHistory, // 获取使用历史
  syncApiCallCount,   // 同步调用次数
  TOLL_RATES,
  FUEL_SURCHARGE_RATE
}

