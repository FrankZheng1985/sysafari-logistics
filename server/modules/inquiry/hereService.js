/**
 * HERE Routing API 服务
 * 用于计算欧洲卡车运输路线和费用
 * 
 * 文档: https://developer.here.com/documentation/routing-api/dev_guide/index.html
 */

import fetch from 'node-fetch'

// HERE API 配置
const HERE_API_KEY = process.env.HERE_API_KEY || ''
const HERE_ROUTING_URL = 'https://router.hereapi.com/v8/routes'
const HERE_GEOCODING_URL = 'https://geocode.search.hereapi.com/v1/geocode'
const HERE_AUTOSUGGEST_URL = 'https://autosuggest.search.hereapi.com/v1/autosuggest'

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
 * @param {string} query - 搜索关键词
 * @param {number} limit - 返回结果数量限制
 */
export async function autosuggestAddress(query, limit = 5) {
  if (!HERE_API_KEY) {
    console.error('HERE API Key 未配置')
    throw new Error('HERE API Key 未配置，请在系统设置中配置 HERE_API_KEY')
  }
  
  try {
    const url = `${HERE_AUTOSUGGEST_URL}?q=${encodeURIComponent(query)}&apiKey=${HERE_API_KEY}&limit=${limit}&in=countryCode:DEU,FRA,NLD,BEL,ITA,ESP,POL,AUT,CHE,CZE,GBR&lang=en`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.items && data.items.length > 0) {
      return data.items
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
    }
    
    return []
  } catch (error) {
    console.error('地址自动补全失败:', error)
    throw error
  }
}

/**
 * 地理编码 - 将地址转换为坐标
 */
export async function geocodeAddress(address) {
  if (!HERE_API_KEY) {
    console.error('HERE API Key 未配置')
    throw new Error('HERE API Key 未配置，请在系统设置中配置 HERE_API_KEY')
  }
  
  try {
    const url = `${HERE_GEOCODING_URL}?q=${encodeURIComponent(address)}&apiKey=${HERE_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      return {
        lat: item.position.lat,
        lng: item.position.lng,
        address: item.address.label,
        country: item.address.countryCode,
        city: item.address.city,
        postalCode: item.address.postalCode
      }
    }
    
    return null
  } catch (error) {
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
  
  // 处理地址到坐标的转换
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
    
    // 返回详细信息
    url += `&return=summary,polyline,actions,turnByTurnActions`
    url += `&apiKey=${HERE_API_KEY}`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.routes && data.routes.length > 0) {
      return parseHereRouteResponse(data.routes[0], originCoords, destCoords, waypointCoords, truck)
    }
    
    throw new Error('未找到可用路线')
  } catch (error) {
    console.error('HERE API 调用失败:', error)
    throw error
  }
}

/**
 * 解析 HERE API 返回的路线数据
 */
function parseHereRouteResponse(route, origin, destination, waypoints, truck) {
  const section = route.sections[0]
  const summary = section.summary
  
  // 计算总距离和时间
  const totalDistance = summary.length / 1000 // 转换为公里
  const totalDuration = summary.duration / 60 // 转换为分钟
  
  // 估算通行费（基于距离和国家）
  const estimatedTolls = estimateTolls(totalDistance, origin.country, destination.country)
  
  // 估算燃油附加费
  const fuelSurcharge = totalDistance * FUEL_SURCHARGE_RATE
  
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
      polyline: section.polyline
    },
    costs: {
      tolls: Math.round(estimatedTolls * 100) / 100,
      fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
      currency: 'EUR'
    },
    truck: truck
  }
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
  const { distance } = routeData.route
  const { tolls, fuelSurcharge } = routeData.costs
  
  // 基础运费 = 距离 × 费率
  const baseCost = distance * truckType.baseRatePerKm
  
  // 应用最低收费
  const transportCost = Math.max(baseCost, truckType.minCharge)
  
  // 总费用 = 运费 + 通行费 + 燃油附加费
  const totalCost = transportCost + tolls + fuelSurcharge
  
  return {
    baseCost: Math.round(baseCost * 100) / 100,
    transportCost: Math.round(transportCost * 100) / 100,
    tolls: Math.round(tolls * 100) / 100,
    fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    currency: 'EUR',
    breakdown: {
      distance,
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

export default {
  autosuggestAddress,
  geocodeAddress,
  calculateTruckRoute,
  calculateTransportCost,
  getCityByPostalCode,
  batchGetCities,
  TOLL_RATES,
  FUEL_SURCHARGE_RATE
}

