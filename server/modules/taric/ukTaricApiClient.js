/**
 * UK Trade Tariff API 客户端
 * 从英国政府官方 Trade Tariff API 获取关税数据
 * 
 * API 文档: https://api.trade-tariff.service.gov.uk/
 * 
 * 特点:
 * - 完全免费，无需认证
 * - 返回 JSON 格式数据
 * - 支持 XI (北爱尔兰) 和 UK 两个数据集
 * - 每日更新
 */

import https from 'https'
import { translateMeasureType, translateGeographicalArea } from './measureTranslations.js'
import { translateText } from '../../utils/translate.js'

// ==================== 配置 ====================

// UK Trade Tariff API 基础 URL
const UK_API_BASE = 'https://www.trade-tariff.service.gov.uk/api/v2'
// XI (北爱尔兰，适用 EU 规则) API 基础 URL - 这个对于需要 EU TARIC 数据的用户非常有用
const XI_API_BASE = 'https://www.trade-tariff.service.gov.uk/xi/api/v2'

// 内存缓存
const cache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时缓存

// ==================== 缓存管理 ====================

function getFromCache(key) {
  const item = cache.get(key)
  if (!item) return null
  
  if (Date.now() > item.expiry) {
    cache.delete(key)
    return null
  }
  
  return item.data
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl
  })
}

export function clearCache() {
  cache.clear()
}

export function getCacheStats() {
  let validCount = 0
  let expiredCount = 0
  const now = Date.now()
  
  for (const [, value] of cache) {
    if (now > value.expiry) {
      expiredCount++
    } else {
      validCount++
    }
  }
  
  return { validCount, expiredCount, totalCount: cache.size }
}

// ==================== 翻译缓存与补充翻译 ====================

// 翻译缓存（避免重复调用 Google API）
const translationCache = new Map()
const TRANSLATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7天缓存

function getCachedTranslation(text) {
  const item = translationCache.get(text)
  if (!item) return null
  if (Date.now() > item.expiry) {
    translationCache.delete(text)
    return null
  }
  return item.translation
}

function setCachedTranslation(text, translation) {
  translationCache.set(text, {
    translation,
    expiry: Date.now() + TRANSLATION_CACHE_TTL
  })
}

/**
 * 补充翻译：对预设翻译未覆盖的措施类型和地理区域进行 Google API 翻译
 * @param {Array} measures - 措施列表
 * @returns {Promise<Array>} - 翻译后的措施列表
 */
async function supplementMeasuresTranslation(measures) {
  if (!measures || !Array.isArray(measures) || measures.length === 0) {
    return measures
  }
  
  // 收集需要翻译的文本
  const textsToTranslate = new Set()
  
  for (const measure of measures) {
    if (!measure.typeCn && measure.type && measure.type !== 'Unknown') {
      const cached = getCachedTranslation(measure.type)
      if (!cached) {
        textsToTranslate.add(measure.type)
      }
    }
    if (!measure.geographicalAreaCn && measure.geographicalArea) {
      const cached = getCachedTranslation(measure.geographicalArea)
      if (!cached) {
        textsToTranslate.add(measure.geographicalArea)
      }
    }
  }
  
  // 如果没有需要翻译的文本，直接返回（但填充缓存中的翻译）
  if (textsToTranslate.size === 0) {
    return measures.map(measure => ({
      ...measure,
      typeCn: measure.typeCn || getCachedTranslation(measure.type),
      geographicalAreaCn: measure.geographicalAreaCn || getCachedTranslation(measure.geographicalArea)
    }))
  }
  
  // 批量翻译（限制数量避免请求过多）
  const textsArray = Array.from(textsToTranslate).slice(0, 10)
  
  for (const text of textsArray) {
    try {
      const translated = await translateText(text, 'en', 'zh-CN', 3000)
      if (translated && translated !== text) {
        setCachedTranslation(text, translated)
      }
    } catch (error) {
      console.warn(`UK翻译失败 [${text}]:`, error.message)
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // 更新 measures 的翻译
  return measures.map(measure => ({
    ...measure,
    typeCn: measure.typeCn || getCachedTranslation(measure.type) || null,
    geographicalAreaCn: measure.geographicalAreaCn || getCachedTranslation(measure.geographicalArea) || null
  }))
}

// ==================== HTTP 请求工具 ====================

/**
 * 发送 HTTP GET 请求并返回 JSON
 */
function httpGetJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 30000
    
    const req = https.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SysafariLogistics/1.0',
        ...options.headers
      },
      timeout
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJson(res.headers.location, options).then(resolve).catch(reject)
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        return
      }
      
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('JSON 解析失败'))
        }
      })
      res.on('error', reject)
    })
    
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
  })
}

// ==================== 数据转换工具 ====================

/**
 * 从 UK API 响应中提取关税税率
 */
function extractDutyRate(measures) {
  if (!measures || !Array.isArray(measures)) return null
  
  // 查找第三国关税 (Third country duty, measure_type_id = 103)
  // 优先级：1. ERGA OMNES (1011)  2. Third countries (2005)  3. 任何其他第三国关税
  const thirdCountryMeasures = measures.filter(m => {
    const measureTypeId = m.measure_type_id || m.measure_type?.id
    const measureTypeDesc = m.measure_type?.description || ''
    return measureTypeId === '103' || 
           measureTypeDesc.toLowerCase().includes('third country duty')
  })
  
  if (thirdCountryMeasures.length === 0) return null
  
  // 按优先级排序地理区域
  const priority = { '1011': 1, '2005': 2 }
  thirdCountryMeasures.sort((a, b) => {
    const aGeoId = a.geographical_area_id || a.geographical_area?.id || ''
    const bGeoId = b.geographical_area_id || b.geographical_area?.id || ''
    const aPriority = priority[aGeoId] || 99
    const bPriority = priority[bGeoId] || 99
    return aPriority - bPriority
  })
  
  // 取优先级最高的措施
  const thirdCountryMeasure = thirdCountryMeasures[0]
  
  if (thirdCountryMeasure && thirdCountryMeasure.duty_expression) {
    // UK API 使用 formatted_base，格式如 "<span>6.00</span> %"
    const formattedBase = thirdCountryMeasure.duty_expression.formatted_base || 
                          thirdCountryMeasure.duty_expression.base
    if (formattedBase) {
      // 匹配数字，处理 HTML 标签
      const rateMatch = formattedBase.replace(/<[^>]*>/g, '').match(/(\d+(?:\.\d+)?)\s*%?/)
      if (rateMatch) {
        return parseFloat(rateMatch[1])
      }
    }
  }
  
  // 如果有第三国关税措施但没有税率表达式，返回 0（免税）
  if (thirdCountryMeasures.length > 0) {
    return 0
  }
  
  return null
}

/**
 * 从 UK API 响应中提取反倾销税
 */
function extractAntiDumpingRate(measures, originCountry) {
  if (!measures || !Array.isArray(measures)) return null
  
  // 查找反倾销措施 (measure_type_id: 551, 552 等)
  const antiDumpingMeasure = measures.find(m => {
    const measureTypeId = m.measure_type_id || m.measure_type?.id
    const measureTypeDesc = m.measure_type?.description || ''
    
    const isAntiDumping = 
      measureTypeId === '551' || // Anti-dumping duty
      measureTypeId === '552' || // Provisional anti-dumping duty
      measureTypeId === '553' || // Definitive anti-dumping duty
      measureTypeDesc.toLowerCase().includes('anti-dumping')
    
    if (!isAntiDumping) return false
    
    // 检查地理区域匹配
    const geoAreaId = m.geographical_area_id || m.geographical_area?.id
    if (originCountry) {
      return geoAreaId === originCountry || geoAreaId === '1011'
    }
    
    return true
  })
  
  if (antiDumpingMeasure && antiDumpingMeasure.duty_expression) {
    const formattedBase = antiDumpingMeasure.duty_expression.formatted_base || 
                          antiDumpingMeasure.duty_expression.base
    if (formattedBase) {
      const rateMatch = formattedBase.replace(/<[^>]*>/g, '').match(/(\d+(?:\.\d+)?)\s*%?/)
      if (rateMatch) {
        return parseFloat(rateMatch[1])
      }
    }
  }
  
  return null
}

/**
 * 从 UK API 响应中提取 VAT 税率
 * 注意：UK API 可能返回多个 VAT 措施（0% 和 20%），需要优先选择标准税率
 */
function extractVatRate(measures) {
  if (!measures || !Array.isArray(measures)) return 20 // UK 标准 VAT
  
  // 找出所有 VAT 措施
  const vatMeasures = measures.filter(m => {
    const measureTypeId = m.measure_type_id || m.measure_type?.id
    const measureTypeDesc = m.measure_type?.description || ''
    
    return measureTypeId === '305' || // VAT
           measureTypeDesc.toLowerCase().includes('value added tax') ||
           measureTypeDesc.toLowerCase().includes('vat')
  })
  
  if (vatMeasures.length === 0) return 20 // UK 标准 VAT
  
  // 提取所有 VAT 税率
  const vatRates = vatMeasures.map(m => {
    if (m.duty_expression) {
      const formattedBase = m.duty_expression.formatted_base || m.duty_expression.base
      if (formattedBase) {
        const rateMatch = formattedBase.replace(/<[^>]*>/g, '').match(/(\d+(?:\.\d+)?)\s*%?/)
        if (rateMatch) {
          return parseFloat(rateMatch[1])
        }
      }
    }
    return null
  }).filter(r => r !== null)
  
  if (vatRates.length === 0) return 20
  
  // 优先返回标准 VAT 税率（20%），如果没有则返回最高的税率
  // 因为 0% 通常是特殊豁免情况
  if (vatRates.includes(20)) return 20
  
  // 返回最高的 VAT 税率（排除特殊豁免的 0%）
  const nonZeroRates = vatRates.filter(r => r > 0)
  if (nonZeroRates.length > 0) {
    return Math.max(...nonZeroRates)
  }
  
  // 如果全是 0%，返回 0%（确实免 VAT 的商品）
  return 0
}

/**
 * 从 UK API 响应中提取反补贴税
 */
function extractCountervailingRate(measures, originCountry) {
  if (!measures || !Array.isArray(measures)) return null
  
  // 查找反补贴措施 (measure_type_id: 554, 555 等)
  const countervailingMeasure = measures.find(m => {
    const measureTypeId = m.measure_type_id || m.measure_type?.id
    const measureTypeDesc = m.measure_type?.description || ''
    
    const isCountervailing = 
      measureTypeId === '554' || // Countervailing duty
      measureTypeId === '555' || // Provisional countervailing duty
      measureTypeId === '556' || // Definitive countervailing duty
      measureTypeDesc.toLowerCase().includes('countervailing')
    
    if (!isCountervailing) return false
    
    // 检查地理区域匹配
    const geoAreaId = m.geographical_area_id || m.geographical_area?.id
    if (originCountry) {
      return geoAreaId === originCountry || geoAreaId === '1011'
    }
    
    return true
  })
  
  if (countervailingMeasure && countervailingMeasure.duty_expression) {
    const formattedBase = countervailingMeasure.duty_expression.formatted_base || 
                          countervailingMeasure.duty_expression.base
    if (formattedBase) {
      const rateMatch = formattedBase.replace(/<[^>]*>/g, '').match(/(\d+(?:\.\d+)?)\s*%?/)
      if (rateMatch) {
        return parseFloat(rateMatch[1])
      }
    }
  }
  
  return null
}

/**
 * 解析 UK API 商品响应
 */
function parseCommodityResponse(data, originCountry) {
  if (!data || !data.data) {
    return null
  }
  
  const commodity = data.data
  const included = data.included || []
  
  // 建立 ID -> 对象 的映射表，用于快速查找关联数据
  const includedMap = new Map()
  for (const item of included) {
    includedMap.set(`${item.type}_${item.id}`, item)
  }
  
  // 从 included 中提取 measures
  const measures = included.filter(item => item.type === 'measure')
  
  // 增强 measures 数据 - 解析 JSON:API relationships
  const enhancedMeasures = measures.map(measure => {
    const measureTypeRel = measure.relationships?.measure_type?.data
    const geoAreaRel = measure.relationships?.geographical_area?.data
    const dutyExprRel = measure.relationships?.duty_expression?.data
    
    // 从 includedMap 中查找关联对象
    const measureType = measureTypeRel ? 
      includedMap.get(`measure_type_${measureTypeRel.id}`) : null
    const geoArea = geoAreaRel ? 
      includedMap.get(`geographical_area_${geoAreaRel.id}`) : null
    const dutyExpr = dutyExprRel ? 
      includedMap.get(`duty_expression_${dutyExprRel.id}`) : null
    
    return {
      id: measure.id,
      // 保存 measure_type 的 id 和 attributes
      measure_type_id: measureTypeRel?.id,
      measure_type: measureType ? {
        id: measureType.id,
        ...measureType.attributes
      } : null,
      // 保存 geographical_area 的 id 和 attributes
      geographical_area_id: geoAreaRel?.id,
      geographical_area: geoArea ? {
        id: geoArea.id,
        ...geoArea.attributes
      } : null,
      // 保存 duty_expression 的 attributes
      duty_expression: dutyExpr?.attributes || null,
      ...measure.attributes
    }
  })
  
  // 筛选指定原产国的措施
  let filteredMeasures = enhancedMeasures
  if (originCountry) {
    filteredMeasures = enhancedMeasures.filter(m => {
      const geoId = m.geographical_area_id
      // 包含：无地理区域限制、指定原产国、ERGA OMNES (1011)、第三国 (2005)
      return !geoId || geoId === originCountry || geoId === '1011' || geoId === '2005'
    })
  }
  
  return {
    hsCode: commodity.attributes?.goods_nomenclature_item_id?.substring(0, 8),
    hsCode10: commodity.attributes?.goods_nomenclature_item_id,
    goodsDescription: commodity.attributes?.description,
    formattedDescription: commodity.attributes?.formatted_description,
    originCountryCode: originCountry || null,
    dutyRate: extractDutyRate(enhancedMeasures), // 使用全部措施计算，确保能找到 ERGA OMNES 的第三国关税
    thirdCountryDuty: extractDutyRate(enhancedMeasures),
    antiDumpingRate: extractAntiDumpingRate(filteredMeasures, originCountry),
    countervailingRate: extractCountervailingRate(filteredMeasures, originCountry),
    vatRate: extractVatRate(enhancedMeasures),
    measures: enhancedMeasures.map(m => {
      const type = m.measure_type?.description || 'Unknown'
      const geographicalArea = m.geographical_area?.description || null
      return {
        type,
        typeCn: translateMeasureType(type),
        typeId: m.measure_type_id,
        geographicalArea,
        geographicalAreaCn: translateGeographicalArea(geographicalArea),
        geographicalAreaId: m.geographical_area_id,
        dutyExpression: m.duty_expression?.formatted_base || m.duty_expression?.base,
        startDate: m.effective_start_date,
        endDate: m.effective_end_date
      }
    }),
    totalMeasures: enhancedMeasures.length
  }
}

// ==================== UK Trade Tariff API 方法 ====================

/**
 * 查询 UK 商品编码
 * @param {string} hsCode - HS 编码（8-10位）
 * @param {string} originCountry - 原产国代码（如 CN）
 * @param {string} region - 'uk' 或 'xi'（北爱尔兰，适用 EU 规则）
 * @returns {Promise<Object>} 税率信息
 */
export async function lookupUkTaricCode(hsCode, originCountry = '', region = 'uk') {
  // 规范化 HS 编码
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  
  // 检查缓存
  const cacheKey = `uk_taric_${region}_${normalizedCode}_${originCountry || 'ALL'}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  // 选择 API 基础 URL
  const baseUrl = region === 'xi' ? XI_API_BASE : UK_API_BASE
  
  // 尝试不同长度的编码（10位、8位、6位、4位）
  const codesToTry = [
    normalizedCode,                                    // 10位完整编码
    normalizedCode.substring(0, 8).padEnd(10, '0'),   // 8位编码
    normalizedCode.substring(0, 6).padEnd(10, '0'),   // 6位编码
  ]
  
  let lastError = null
  let attemptedCodes = []
  
  for (const code of codesToTry) {
    try {
      // 构建查询 URL
      let url = `${baseUrl}/commodities/${code}`
      if (originCountry) {
        url += `?filter%5Bgeographical_area_id%5D=${originCountry}`
      }
      
      attemptedCodes.push(code)
      
      // 发送请求
      const data = await httpGetJson(url)
      
      // 解析响应
      const result = parseCommodityResponse(data, originCountry)
      
      if (!result) {
        continue // 尝试下一个编码
      }
      
      // 补充翻译
      if (result.measures && result.measures.length > 0) {
        try {
          result.measures = await supplementMeasuresTranslation(result.measures)
        } catch (err) {
          console.warn('UK措施翻译补充失败:', err.message)
        }
      }
      
      // 翻译商品描述
      if (result.goodsDescription && !result.goodsDescriptionCn) {
        try {
          const cachedDescCn = getCachedTranslation(result.goodsDescription)
          if (cachedDescCn) {
            result.goodsDescriptionCn = cachedDescCn
          } else {
            const translatedDesc = await translateText(result.goodsDescription, 'en', 'zh-CN', 5000)
            if (translatedDesc && translatedDesc !== result.goodsDescription) {
              result.goodsDescriptionCn = translatedDesc
              setCachedTranslation(result.goodsDescription, translatedDesc)
            }
          }
        } catch (err) {
          console.warn('UK商品描述翻译失败:', err.message)
        }
      }
      
      // 添加元数据
      const finalResult = {
        ...result,
        originalHsCode: normalizedCode,
        matchedHsCode: code,
        exactMatch: code === normalizedCode,
        dataSource: region === 'xi' ? 'uk_xi_api' : 'uk_api',
        region: region,
        regionName: region === 'xi' ? '北爱尔兰 (EU规则)' : '英国',
        queryTime: new Date().toISOString(),
        fromCache: false,
        note: code !== normalizedCode ? `注意：UK系统中未找到精确的编码 ${normalizedCode}，返回最接近的父级编码 ${code} 的数据` : null
      }
      
      // 缓存结果
      setCache(cacheKey, finalResult)
      
      return finalResult
    } catch (error) {
      lastError = error
      // 如果是 404 错误，尝试下一个编码
      if (error.message.includes('404')) {
        continue
      }
      // 其他错误直接抛出
      throw error
    }
  }
  
  // 如果所有编码都失败，尝试获取 heading（4位编码）
  try {
    const headingCode = normalizedCode.substring(0, 4)
    const headingUrl = `${baseUrl}/headings/${headingCode}`
    const headingData = await httpGetJson(headingUrl)
    
    if (headingData && headingData.data) {
      const heading = headingData.data
      const included = headingData.included || []
      
      // 从 included 中找到可申报的 commodities
      // 优先匹配逻辑：
      // 1. 编码以 "90" 结尾（通常表示 "Other" 类别）
      // 2. 编码前缀与查询编码匹配
      // 3. 描述包含 "Other"
      const declarableCommodities = included
        .filter(item => item.type === 'commodity' && item.attributes?.declarable === true)
        .sort((a, b) => {
          const aCode = a.attributes?.goods_nomenclature_item_id || ''
          const bCode = b.attributes?.goods_nomenclature_item_id || ''
          const aDesc = (a.attributes?.description || '').toLowerCase()
          const bDesc = (b.attributes?.description || '').toLowerCase()
          
          // 优先级 1: 以 "90" 结尾的编码（其他类）
          const aEnds90 = aCode.endsWith('90') || aCode.endsWith('99') ? 0 : 1
          const bEnds90 = bCode.endsWith('90') || bCode.endsWith('99') ? 0 : 1
          if (aEnds90 !== bEnds90) return aEnds90 - bEnds90
          
          // 优先级 2: 描述包含 "Other"
          const aIsOther = aDesc === 'other' || aDesc.startsWith('other ') ? 0 : 1
          const bIsOther = bDesc === 'other' || bDesc.startsWith('other ') ? 0 : 1
          if (aIsOther !== bIsOther) return aIsOther - bIsOther
          
          // 优先级 3: 编码前缀匹配
          const aMatch = aCode.startsWith(normalizedCode.substring(0, 6)) ? 0 : 1
          const bMatch = bCode.startsWith(normalizedCode.substring(0, 6)) ? 0 : 1
          if (aMatch !== bMatch) return aMatch - bMatch
          
          return aCode.localeCompare(bCode)
        })
      
      const declarableCommodity = declarableCommodities[0]
      
      // 🔥 关键改进：如果找到了可申报的商品编码，自动查询该编码获取完整税率数据
      if (declarableCommodity) {
        const suggestedCode = declarableCommodity.attributes?.goods_nomenclature_item_id
        console.log(`UK API: 未找到精确编码 ${normalizedCode}，自动查询建议编码 ${suggestedCode}`)
        
        try {
          // 查询建议编码的完整数据
          let suggUrl = `${baseUrl}/commodities/${suggestedCode}`
          if (originCountry) {
            suggUrl += `?filter%5Bgeographical_area_id%5D=${originCountry}`
          }
          
          const suggData = await httpGetJson(suggUrl)
          const suggResult = parseCommodityResponse(suggData, originCountry)
          
          if (suggResult && (suggResult.thirdCountryDuty !== null || suggResult.dutyRate !== null)) {
            // 补充翻译
            if (suggResult.measures && suggResult.measures.length > 0) {
              try {
                suggResult.measures = await supplementMeasuresTranslation(suggResult.measures)
              } catch (err) {
                console.warn('UK建议编码措施翻译补充失败:', err.message)
              }
            }
            
            // 翻译商品描述
            if (suggResult.goodsDescription && !suggResult.goodsDescriptionCn) {
              try {
                const cachedDescCn = getCachedTranslation(suggResult.goodsDescription)
                if (cachedDescCn) {
                  suggResult.goodsDescriptionCn = cachedDescCn
                } else {
                  const translatedDesc = await translateText(suggResult.goodsDescription, 'en', 'zh-CN', 5000)
                  if (translatedDesc && translatedDesc !== suggResult.goodsDescription) {
                    suggResult.goodsDescriptionCn = translatedDesc
                    setCachedTranslation(suggResult.goodsDescription, translatedDesc)
                  }
                }
              } catch (err) {
                console.warn('UK建议编码商品描述翻译失败:', err.message)
              }
            }
            
            // 成功获取到税率数据
            const finalResult = {
              ...suggResult,
              originalHsCode: normalizedCode,
              matchedHsCode: suggestedCode,
              exactMatch: false,
              dataSource: region === 'xi' ? 'uk_xi_api' : 'uk_api',
              region: region,
              regionName: region === 'xi' ? '北爱尔兰 (EU规则)' : '英国',
              queryTime: new Date().toISOString(),
              fromCache: false,
              note: `UK系统中未找到精确的编码 ${normalizedCode}，已自动使用最接近的编码 ${suggestedCode} 的税率数据。`,
              suggestedCodes: declarableCommodities.slice(0, 10).map(item => ({
                code: item.attributes?.goods_nomenclature_item_id,
                description: item.attributes?.description
              }))
            }
            
            // 缓存结果
            setCache(cacheKey, finalResult, 4 * 60 * 60 * 1000)
            return { ...finalResult, fromCache: false }
          }
        } catch (suggError) {
          console.warn(`查询建议编码 ${suggestedCode} 失败:`, suggError.message)
        }
      }
      
      // 如果没有成功获取建议编码的税率，返回 heading 级别信息
      const result = {
        hsCode: normalizedCode.substring(0, 8),
        hsCode10: declarableCommodity?.attributes?.goods_nomenclature_item_id || heading.attributes?.goods_nomenclature_item_id,
        originalHsCode: normalizedCode,
        goodsDescription: declarableCommodity?.attributes?.description || heading.attributes?.description,
        formattedDescription: declarableCommodity?.attributes?.formatted_description || heading.attributes?.formatted_description,
        originCountryCode: originCountry || null,
        dutyRate: null,
        thirdCountryDuty: null,
        antiDumpingRate: null,
        vatRate: null,
        countervailingRate: null,
        measures: [],
        totalMeasures: 0,
        exactMatch: false,
        dataSource: region === 'xi' ? 'uk_xi_api' : 'uk_api',
        region: region,
        regionName: region === 'xi' ? '北爱尔兰 (EU规则)' : '英国',
        queryTime: new Date().toISOString(),
        fromCache: false,
        note: `UK系统中未找到精确的编码 ${normalizedCode}，仅找到 heading ${headingCode} 级别的信息。请从下方建议编码中选择一个进行查询。`,
        suggestedCodes: declarableCommodities.slice(0, 10).map(item => ({
          code: item.attributes?.goods_nomenclature_item_id,
          description: item.attributes?.description
        }))
      }
      
      // 缓存结果（较短的TTL，因为这不是精确匹配）
      setCache(cacheKey, result, 4 * 60 * 60 * 1000) // 4小时缓存
      
      return { ...result, fromCache: false }
    }
  } catch (headingError) {
    console.warn('获取 heading 也失败:', headingError.message)
  }
  
  // 所有尝试都失败
  console.error(`UK Trade Tariff API 查询失败 [${hsCode}]:`, lastError?.message)
  throw new Error(`UK系统中未找到编码 ${normalizedCode} 或其父级编码 (尝试了: ${attemptedCodes.join(', ')})`)
}

/**
 * 批量查询 UK 商品编码
 * @param {string[]} hsCodes - HS 编码数组
 * @param {string} originCountry - 原产国代码
 * @param {string} region - 'uk' 或 'xi'
 * @param {Object} options - 选项
 */
export async function batchLookupUk(hsCodes, originCountry = '', region = 'uk', options = {}) {
  const { concurrency = 5, delay = 200 } = options
  const results = []
  const errors = []
  
  for (let i = 0; i < hsCodes.length; i += concurrency) {
    const batch = hsCodes.slice(i, i + concurrency)
    
    const batchResults = await Promise.allSettled(
      batch.map(code => lookupUkTaricCode(code, originCountry, region))
    )
    
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]
      const code = batch[j]
      
      if (result.status === 'fulfilled') {
        results.push({ hsCode: code, data: result.value })
      } else {
        errors.push({ hsCode: code, error: result.reason.message })
      }
    }
    
    // 添加延迟以避免请求过快
    if (i + concurrency < hsCodes.length && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return { results, errors, totalCount: hsCodes.length }
}

/**
 * 搜索 UK 商品编码
 * @param {string} query - 搜索关键词
 * @param {string} region - 'uk' 或 'xi'
 */
export async function searchUkCommodities(query, region = 'uk') {
  const baseUrl = region === 'xi' ? XI_API_BASE : UK_API_BASE
  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}`
  
  try {
    const data = await httpGetJson(url)
    return {
      results: data.data || [],
      meta: data.meta,
      dataSource: region === 'xi' ? 'uk_xi_api' : 'uk_api'
    }
  } catch (error) {
    console.error('UK Trade Tariff 搜索失败:', error.message)
    throw error
  }
}

/**
 * 获取 UK Trade Tariff API 章节列表
 * @param {string} region - 'uk' 或 'xi'
 */
export async function getUkChapters(region = 'uk') {
  const cacheKey = `uk_chapters_${region}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { chapters: cached, fromCache: true }
  }
  
  const baseUrl = region === 'xi' ? XI_API_BASE : UK_API_BASE
  const url = `${baseUrl}/chapters`
  
  try {
    const data = await httpGetJson(url)
    const chapters = data.data?.map(ch => ({
      id: ch.id,
      code: ch.attributes?.goods_nomenclature_item_id,
      description: ch.attributes?.description,
      formattedDescription: ch.attributes?.formatted_description
    })) || []
    
    setCache(cacheKey, chapters, 7 * 24 * 60 * 60 * 1000) // 缓存 7 天
    
    return { chapters, fromCache: false }
  } catch (error) {
    console.error('获取 UK 章节列表失败:', error.message)
    throw error
  }
}

/**
 * 获取指定章节下的标题列表
 * @param {string} chapterId - 章节 ID（2位数字）
 * @param {string} region - 'uk' 或 'xi'
 */
export async function getUkHeadings(chapterId, region = 'uk') {
  const baseUrl = region === 'xi' ? XI_API_BASE : UK_API_BASE
  const url = `${baseUrl}/chapters/${chapterId}/headings`
  
  try {
    const data = await httpGetJson(url)
    return {
      headings: data.data || [],
      meta: data.meta
    }
  } catch (error) {
    console.error('获取 UK 标题列表失败:', error.message)
    throw error
  }
}

/**
 * 检查 UK Trade Tariff API 健康状态
 */
export async function checkUkApiHealth() {
  try {
    const startTime = Date.now()
    
    // 测试 UK API
    await httpGetJson(`${UK_API_BASE}/chapters/01`, { timeout: 10000 })
    const ukResponseTime = Date.now() - startTime
    
    // 测试 XI API
    const xiStartTime = Date.now()
    await httpGetJson(`${XI_API_BASE}/chapters/01`, { timeout: 10000 })
    const xiResponseTime = Date.now() - xiStartTime
    
    return {
      available: true,
      uk: {
        available: true,
        responseTime: ukResponseTime
      },
      xi: {
        available: true,
        responseTime: xiResponseTime
      },
      timestamp: new Date().toISOString(),
      cacheStats: getCacheStats()
    }
  } catch (error) {
    return {
      available: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      cacheStats: getCacheStats()
    }
  }
}

// ==================== 导出 ====================

export default {
  lookupUkTaricCode,
  batchLookupUk,
  searchUkCommodities,
  getUkChapters,
  getUkHeadings,
  checkUkApiHealth,
  clearCache,
  getCacheStats
}

