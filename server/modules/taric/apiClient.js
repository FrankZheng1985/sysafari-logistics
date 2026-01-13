/**
 * EU TARIC API 客户端（升级版）
 * 
 * 数据源优先级：
 * 1. UK XI API（北爱尔兰，遵循 EU TARIC 规则）- 最可靠
 * 2. 本地常用税率数据库 - 快速备用
 * 3. 中国反倾销税数据库 - 特定数据
 * 4. 欧盟官方网站爬虫 - 最后手段
 * 
 * 特点：
 * - 智能编码匹配：自动尝试多种编码格式
 * - 多数据源融合：确保数据完整性
 * - 24小时缓存：减少重复请求
 */

import https from 'https'
import http from 'http'
import { findDutyRate } from './commonDutyRates.js'
import { findChinaAntiDumpingRate } from './chinaAntiDumpingRates.js'
import { translateMeasureType, translateGeographicalArea } from './measureTranslations.js'
import { translateText } from '../../utils/translate.js'

// ==================== 配置 ====================

// UK Trade Tariff API - XI (北爱尔兰) 使用 EU TARIC 规则
const XI_API_BASE = 'https://www.trade-tariff.service.gov.uk/xi/api/v2'
const UK_API_BASE = 'https://www.trade-tariff.service.gov.uk/api/v2'
const TARIC_BASE_URL = 'https://ec.europa.eu/taxation_customs/dds2/taric'

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
    // 如果没有中文翻译且有英文文本，需要翻译
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
  
  // 如果没有需要翻译的文本，直接返回
  if (textsToTranslate.size === 0) {
    // 但仍需填充缓存中的翻译
    return measures.map(measure => ({
      ...measure,
      typeCn: measure.typeCn || getCachedTranslation(measure.type),
      geographicalAreaCn: measure.geographicalAreaCn || getCachedTranslation(measure.geographicalArea)
    }))
  }
  
  // 批量翻译（限制数量避免请求过多）
  const textsArray = Array.from(textsToTranslate).slice(0, 10) // 最多翻译10个
  
  for (const text of textsArray) {
    try {
      const translated = await translateText(text, 'en', 'zh-CN', 3000) // 3秒超时
      if (translated && translated !== text) {
        setCachedTranslation(text, translated)
      }
    } catch (error) {
      console.warn(`翻译失败 [${text}]:`, error.message)
    }
    // 添加小延迟避免请求过快
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

function httpGetJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const timeout = options.timeout || 30000
    
    const req = protocol.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SysafariLogistics/1.0',
        ...options.headers
      },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJson(res.headers.location, options).then(resolve).catch(reject)
      }
      
      if (res.statusCode === 404) {
        resolve(null) // 返回 null 表示未找到
        return
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

function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const timeout = options.timeout || 30000
    
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        ...options.headers
      },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject)
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        return
      }
      
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
    
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
  })
}

// ==================== XI API 数据解析 ====================

/**
 * 从 XI API 响应中提取关税税率
 */
function extractDutyRateFromXI(measures) {
  if (!measures || !Array.isArray(measures)) return null
  
  // 查找第三国关税 (Third country duty, measure_type_id = 103)
  const thirdCountryMeasure = measures.find(m => {
    const isThirdCountryDuty = m.measure_type_id === '103' || 
      (m.measure_type && m.measure_type.id === '103')
    const isErgaOmnes = m.geographical_area_id === '1011' || 
      (m.geographical_area && m.geographical_area.id === '1011')
    return isThirdCountryDuty && isErgaOmnes
  })
  
  if (thirdCountryMeasure && thirdCountryMeasure.duty_expression) {
    const formattedBase = thirdCountryMeasure.duty_expression.formatted_base || 
                          thirdCountryMeasure.duty_expression.base
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
 * 从 XI API 响应中提取反倾销税
 */
function extractAntiDumpingRateFromXI(measures, originCountry) {
  if (!measures || !Array.isArray(measures)) return null
  
  const antiDumpingMeasure = measures.find(m => {
    const measureTypeId = m.measure_type_id || m.measure_type?.id
    const measureTypeDesc = m.measure_type?.description || ''
    
    const isAntiDumping = 
      measureTypeId === '551' || measureTypeId === '552' || measureTypeId === '553' ||
      measureTypeDesc.toLowerCase().includes('anti-dumping')
    
    if (!isAntiDumping) return false
    
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
 * 从 XI API 响应中提取反补贴税
 */
function extractCountervailingRateFromXI(measures, originCountry) {
  if (!measures || !Array.isArray(measures)) return null
  
  const countervailingMeasure = measures.find(m => {
    const measureTypeId = m.measure_type_id || m.measure_type?.id
    const measureTypeDesc = m.measure_type?.description || ''
    
    const isCountervailing = 
      measureTypeId === '554' || measureTypeId === '555' || measureTypeId === '556' ||
      measureTypeDesc.toLowerCase().includes('countervailing')
    
    if (!isCountervailing) return false
    
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
 * 解析 XI API 商品响应
 */
function parseXICommodityResponse(data, originCountry) {
  if (!data || !data.data) {
    return null
  }
  
  const commodity = data.data
  const included = data.included || []
  
  // 建立 ID -> 对象 的映射表
  const includedMap = new Map()
  for (const item of included) {
    includedMap.set(`${item.type}_${item.id}`, item)
  }
  
  // 从 included 中提取 measures
  const measures = included.filter(item => item.type === 'measure')
  
  // 增强 measures 数据
  const enhancedMeasures = measures.map(measure => {
    const measureTypeRel = measure.relationships?.measure_type?.data
    const geoAreaRel = measure.relationships?.geographical_area?.data
    const dutyExprRel = measure.relationships?.duty_expression?.data
    
    const measureType = measureTypeRel ? 
      includedMap.get(`measure_type_${measureTypeRel.id}`) : null
    const geoArea = geoAreaRel ? 
      includedMap.get(`geographical_area_${geoAreaRel.id}`) : null
    const dutyExpr = dutyExprRel ? 
      includedMap.get(`duty_expression_${dutyExprRel.id}`) : null
    
    return {
      id: measure.id,
      measure_type_id: measureTypeRel?.id,
      measure_type: measureType ? { id: measureType.id, ...measureType.attributes } : null,
      geographical_area_id: geoAreaRel?.id,
      geographical_area: geoArea ? { id: geoArea.id, ...geoArea.attributes } : null,
      duty_expression: dutyExpr?.attributes || null,
      ...measure.attributes
    }
  })
  
  // 筛选指定原产国的措施
  let filteredMeasures = enhancedMeasures
  if (originCountry) {
    filteredMeasures = enhancedMeasures.filter(m => {
      const geoId = m.geographical_area_id
      return !geoId || geoId === originCountry || geoId === '1011' || geoId === '2005'
    })
  }
  
  const thirdCountryDuty = extractDutyRateFromXI(enhancedMeasures)
  
  return {
    hsCode: commodity.attributes?.goods_nomenclature_item_id?.substring(0, 8),
    hsCode10: commodity.attributes?.goods_nomenclature_item_id,
    goodsDescription: commodity.attributes?.description,
    formattedDescription: commodity.attributes?.formatted_description,
    originCountryCode: originCountry || null,
    dutyRate: thirdCountryDuty,
    thirdCountryDuty: thirdCountryDuty,
    antiDumpingRate: extractAntiDumpingRateFromXI(filteredMeasures, originCountry),
    countervailingRate: extractCountervailingRateFromXI(filteredMeasures, originCountry),
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
    totalMeasures: enhancedMeasures.length,
    dataSource: 'xi_api'
  }
}

/**
 * 从 XI API 查询商品编码
 */
async function lookupFromXIApi(hsCode, originCountry = '') {
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  
  // 尝试多种编码格式
  const codesToTry = [
    normalizedCode,                                    // 完整 10 位
    normalizedCode.substring(0, 8).padEnd(10, '0'),   // 8 位 + 00
    normalizedCode.substring(0, 6).padEnd(10, '0'),   // 6 位 + 0000
  ]
  
  for (const code of codesToTry) {
    try {
      let url = `${XI_API_BASE}/commodities/${code}`
      if (originCountry) {
        url += `?filter%5Bgeographical_area_id%5D=${originCountry}`
      }
      
      const data = await httpGetJson(url)
      
      if (data) {
        const result = parseXICommodityResponse(data, originCountry)
        if (result && (result.thirdCountryDuty !== null || result.totalMeasures > 0)) {
          return {
            ...result,
            originalHsCode: normalizedCode,
            matchedHsCode: code,
            exactMatch: code === normalizedCode
          }
        }
      }
    } catch (error) {
      // 继续尝试下一个编码
      if (!error.message.includes('404')) {
        console.warn(`XI API 查询失败 [${code}]:`, error.message)
      }
    }
  }
  
  // 尝试 heading 级别
  try {
    const headingCode = normalizedCode.substring(0, 4)
    const headingUrl = `${XI_API_BASE}/headings/${headingCode}`
    const headingData = await httpGetJson(headingUrl)
    
    if (headingData && headingData.data) {
      const heading = headingData.data
      const included = headingData.included || []
      
      // 找到所有匹配的可申报编码
      const declarableCommodities = included.filter(item => 
        item.type === 'commodity' && 
        item.attributes?.declarable === true &&
        item.attributes?.goods_nomenclature_item_id?.startsWith(normalizedCode.substring(0, 6))
      )
      
      if (declarableCommodities.length > 0) {
        // 优先选择"通用/其他"类别的编码（以90结尾的编码，通常是标准关税）
        // 避免选择航空器专用等特殊用途编码（如 xxxx10 结尾）
        let bestCommodity = declarableCommodities.find(item => {
          const code = item.attributes?.goods_nomenclature_item_id || ''
          return code.endsWith('90')  // 通用类别通常以90结尾
        })
        
        // 如果没有以90结尾的，选择最后一个（通常是"其他"类别）
        if (!bestCommodity) {
          bestCommodity = declarableCommodities[declarableCommodities.length - 1]
        }
        
        // 查询找到的编码
        const foundCode = bestCommodity.attributes.goods_nomenclature_item_id
        const foundUrl = `${XI_API_BASE}/commodities/${foundCode}`
        const foundData = await httpGetJson(foundUrl)
        
        if (foundData) {
          const result = parseXICommodityResponse(foundData, originCountry)
          if (result) {
            return {
              ...result,
              originalHsCode: normalizedCode,
              matchedHsCode: foundCode,
              exactMatch: false,
              note: `EU 系统中未找到精确编码 ${normalizedCode}，使用最接近的编码 ${foundCode}`
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('XI API heading 查询失败:', error.message)
  }
  
  return null
}

// ==================== 主查询函数 ====================

/**
 * 从 TARIC 系统查询 HS 编码的税率信息
 * @param {string} hsCode - HS 编码（8-10位）
 * @param {string} originCountry - 原产国代码（如 CN）
 * @returns {Promise<Object>} 税率信息
 */
export async function lookupTaricCode(hsCode, originCountry = '') {
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  
  // 检查缓存
  const cacheKey = `taric_${normalizedCode}_${originCountry || 'ALL'}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  // 先从本地数据库查找（快速响应）
  const localRate = findDutyRate(normalizedCode)
  
  // 如果是中国原产地，查找反倾销税数据
  let chinaAntiDumping = null
  if (originCountry && originCountry.toUpperCase() === 'CN') {
    chinaAntiDumping = findChinaAntiDumpingRate(normalizedCode)
  }
  
  // 初始化结果（本地数据作为基础）
  let result = {
    hsCode: normalizedCode.substring(0, 8),
    hsCode10: normalizedCode,
    originCountryCode: originCountry || null,
    measures: [],
    dutyRate: chinaAntiDumping?.dutyRate ?? localRate?.dutyRate ?? null,
    thirdCountryDuty: localRate?.thirdCountryDuty ?? null,
    preferentialRates: [],
    antiDumpingRate: chinaAntiDumping?.antiDumpingRate ?? null,
    antiDumpingRateRange: chinaAntiDumping?.antiDumpingRateRange ?? null,
    countervailingRate: chinaAntiDumping?.countervailingRate ?? null,
    additionalCodes: [],
    restrictions: [],
    quotas: [],
    goodsDescription: chinaAntiDumping?.description || localRate?.description || null,
    goodsDescriptionCn: chinaAntiDumping?.descriptionCn || localRate?.descriptionCn || null,
    dataSource: chinaAntiDumping ? 'china_anti_dumping_database' : (localRate ? 'local_database' : 'xi_api'),
    note: chinaAntiDumping?.note || localRate?.note || null,
    regulationId: chinaAntiDumping?.regulationId || null,
    validFrom: chinaAntiDumping?.validFrom || null,
    totalDutyRate: chinaAntiDumping?.totalDutyRate ?? null,
    queryTime: new Date().toISOString(),
    hasAntiDumping: !!chinaAntiDumping?.antiDumpingRate,
    hasCountervailing: !!chinaAntiDumping?.countervailingRate
  }
  
  // 尝试从 XI API 获取更准确的数据
  try {
    const xiResult = await lookupFromXIApi(normalizedCode, originCountry)
    
    if (xiResult) {
      // XI API 数据优先
      result = {
        ...result,
        hsCode: xiResult.hsCode || result.hsCode,
        hsCode10: xiResult.matchedHsCode || xiResult.hsCode10 || result.hsCode10,
        originalHsCode: normalizedCode,
        matchedHsCode: xiResult.matchedHsCode,
        exactMatch: xiResult.exactMatch,
        goodsDescription: xiResult.goodsDescription || result.goodsDescription,
        formattedDescription: xiResult.formattedDescription,
        // XI 数据覆盖本地数据（如果有）
        dutyRate: xiResult.thirdCountryDuty ?? result.dutyRate,
        thirdCountryDuty: xiResult.thirdCountryDuty ?? result.thirdCountryDuty,
        // 反倾销税：优先使用中国数据库（更准确），否则用 XI 数据
        antiDumpingRate: result.antiDumpingRate ?? xiResult.antiDumpingRate,
        countervailingRate: result.countervailingRate ?? xiResult.countervailingRate,
        measures: xiResult.measures || result.measures,
        totalMeasures: xiResult.totalMeasures || result.totalMeasures,
        dataSource: 'xi_api',
        note: xiResult.note || result.note,
        hasAntiDumping: result.hasAntiDumping || !!xiResult.antiDumpingRate,
        hasCountervailing: result.hasCountervailing || !!xiResult.countervailingRate
      }
    }
  } catch (error) {
    console.warn(`XI API 查询失败 [${hsCode}]:`, error.message)
    // 如果 XI API 失败，使用本地数据
    if (!localRate && !chinaAntiDumping) {
      result.note = '无法从 EU TARIC 系统获取数据，请稍后重试'
    }
  }
  
  // 补充翻译：对预设翻译未覆盖的内容进行 Google API 翻译
  if (result.measures && result.measures.length > 0) {
    try {
      result.measures = await supplementMeasuresTranslation(result.measures)
    } catch (error) {
      console.warn('措施翻译补充失败:', error.message)
    }
  }
  
  // 翻译商品描述（如果没有中文描述）
  if (result.goodsDescription && !result.goodsDescriptionCn) {
    try {
      // 先检查翻译缓存
      const cachedDescCn = getCachedTranslation(result.goodsDescription)
      if (cachedDescCn) {
        result.goodsDescriptionCn = cachedDescCn
      } else {
        // 调用 Google API 翻译
        const translatedDesc = await translateText(result.goodsDescription, 'en', 'zh-CN', 5000)
        if (translatedDesc && translatedDesc !== result.goodsDescription) {
          result.goodsDescriptionCn = translatedDesc
          setCachedTranslation(result.goodsDescription, translatedDesc)
        }
      }
    } catch (error) {
      console.warn('商品描述翻译失败:', error.message)
    }
  }
  
  // 缓存结果
  setCache(cacheKey, result)
  
  return { ...result, fromCache: false }
}

/**
 * 获取 HS 编码的详细措施信息
 */
export async function getMeasureDetails(hsCode, originCountry = '') {
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  
  try {
    // 使用 XI API 获取详细措施
    let url = `${XI_API_BASE}/commodities/${normalizedCode}`
    if (originCountry) {
      url += `?filter%5Bgeographical_area_id%5D=${originCountry}`
    }
    
    const data = await httpGetJson(url)
    
    if (data) {
      const result = parseXICommodityResponse(data, originCountry)
      return { measures: result?.measures || [] }
    }
    
    return { measures: [] }
  } catch (error) {
    console.error(`获取措施详情失败 [${hsCode}]:`, error.message)
    return { measures: [] }
  }
}

/**
 * 批量查询多个 HS 编码
 */
export async function batchLookup(hsCodes, originCountry = '', options = {}) {
  const { concurrency = 3, delay = 300 } = options
  const results = []
  const errors = []
  
  for (let i = 0; i < hsCodes.length; i += concurrency) {
    const batch = hsCodes.slice(i, i + concurrency)
    
    const batchResults = await Promise.allSettled(
      batch.map(code => lookupTaricCode(code, originCountry))
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
    
    if (i + concurrency < hsCodes.length && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return { results, errors, totalCount: hsCodes.length }
}

/**
 * 获取国家/地区代码列表
 */
export async function getCountryCodes() {
  const cacheKey = 'taric_country_codes'
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { countries: cached, fromCache: true }
  }
  
  try {
    // 使用 XI API 获取地理区域列表
    const url = `${XI_API_BASE}/geographical_areas`
    const data = await httpGetJson(url)
    
    if (data && data.data) {
      const countries = data.data
        .filter(area => area.attributes?.geographical_area_id?.length === 2)
        .map(area => ({
          code: area.attributes.geographical_area_id,
          name: area.attributes.description,
          type: 'C'
        }))
      
      setCache(cacheKey, countries, 7 * 24 * 60 * 60 * 1000)
      return { countries, fromCache: false }
    }
  } catch (error) {
    console.warn('从 XI API 获取国家代码失败:', error.message)
  }
  
  // 返回常用国家代码（备用）
  const defaultCountries = [
    { code: 'CN', name: 'China', type: 'C' },
    { code: 'US', name: 'United States', type: 'C' },
    { code: 'JP', name: 'Japan', type: 'C' },
    { code: 'KR', name: 'South Korea', type: 'C' },
    { code: 'IN', name: 'India', type: 'C' },
    { code: 'VN', name: 'Vietnam', type: 'C' },
    { code: 'TH', name: 'Thailand', type: 'C' },
    { code: 'MY', name: 'Malaysia', type: 'C' },
    { code: 'ID', name: 'Indonesia', type: 'C' },
    { code: 'TW', name: 'Taiwan', type: 'C' },
    { code: 'HK', name: 'Hong Kong', type: 'C' },
    { code: 'SG', name: 'Singapore', type: 'C' },
    { code: 'PH', name: 'Philippines', type: 'C' },
    { code: 'BD', name: 'Bangladesh', type: 'C' },
    { code: 'PK', name: 'Pakistan', type: 'C' },
    { code: 'TR', name: 'Turkey', type: 'C' },
    { code: 'MX', name: 'Mexico', type: 'C' },
    { code: 'BR', name: 'Brazil', type: 'C' },
    { code: 'RU', name: 'Russia', type: 'C' },
    { code: 'UA', name: 'Ukraine', type: 'C' },
  ]
  
  setCache(cacheKey, defaultCountries, 24 * 60 * 60 * 1000)
  return { countries: defaultCountries, fromCache: false }
}

/**
 * 检查 API 可用性
 */
export async function checkApiHealth() {
  try {
    const startTime = Date.now()
    
    // 测试 XI API
    const testUrl = `${XI_API_BASE}/chapters/01`
    await httpGetJson(testUrl, { timeout: 10000 })
    
    const responseTime = Date.now() - startTime
    
    return {
      available: true,
      responseTime,
      apiSource: 'xi_api',
      timestamp: new Date().toISOString(),
      cacheStats: getCacheStats()
    }
  } catch (error) {
    return {
      available: false,
      error: error.message,
      apiSource: 'xi_api',
      timestamp: new Date().toISOString(),
      cacheStats: getCacheStats()
    }
  }
}

// ==================== HS 编码验证 ====================

/**
 * 验证 HS 编码的有效性
 * @param {string} hsCode - HS 编码
 * @returns {Promise<Object>} 验证结果
 */
export async function validateHsCode(hsCode) {
  const normalizedCode = hsCode.replace(/\D/g, '')
  
  // 检查缓存
  const cacheKey = `validate_${normalizedCode}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  const result = {
    inputCode: hsCode,
    normalizedCode,
    isValid: false,
    isDeclarable: false,
    level: null,           // chapter/heading/subheading/cn/taric
    hasChildren: false,
    childCount: 0,
    description: null,
    descriptionCn: null,
    parentCode: null,
    parentDescription: null,
    breadcrumb: [],
    error: null
  }
  
  // 确定编码长度和层级
  const codeLength = normalizedCode.length
  if (codeLength < 2) {
    result.error = 'HS编码长度不能少于2位'
    return result
  }
  
  // 根据编码长度确定层级
  if (codeLength === 2) {
    result.level = 'chapter'
  } else if (codeLength <= 4) {
    result.level = 'heading'
  } else if (codeLength <= 6) {
    result.level = 'subheading'
  } else if (codeLength <= 8) {
    result.level = 'cn'
  } else {
    result.level = 'taric'
  }
  
  try {
    // 尝试查询编码
    if (codeLength <= 2) {
      // 章节级别
      const chapterCode = normalizedCode.padStart(2, '0')
      const url = `${XI_API_BASE}/chapters/${chapterCode}`
      const data = await httpGetJson(url)
      
      if (data && data.data) {
        result.isValid = true
        result.hasChildren = true
        result.description = data.data.attributes?.description
        result.childCount = (data.included || []).filter(i => i.type === 'heading').length
        
        // 翻译描述
        if (result.description) {
          const cachedCn = getCachedTranslation(result.description)
          if (cachedCn) {
            result.descriptionCn = cachedCn
          } else {
            try {
              const translated = await translateText(result.description, 'en', 'zh-CN', 3000)
              if (translated && translated !== result.description) {
                result.descriptionCn = translated
                setCachedTranslation(result.description, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
        }
        
        result.breadcrumb = [{
          code: chapterCode,
          description: result.description,
          descriptionCn: result.descriptionCn,
          level: 'chapter'
        }]
      }
    } else if (codeLength <= 4) {
      // 品目（heading）级别
      const headingCode = normalizedCode.substring(0, 4)
      const url = `${XI_API_BASE}/headings/${headingCode}`
      const data = await httpGetJson(url)
      
      if (data && data.data) {
        result.isValid = true
        result.hasChildren = true
        result.description = data.data.attributes?.description
        result.parentCode = headingCode.substring(0, 2)
        
        // 统计子编码数量
        const commodities = (data.included || []).filter(i => i.type === 'commodity')
        const declarableCommodities = commodities.filter(i => i.attributes?.declarable === true)
        result.childCount = commodities.length
        result.declarableCount = declarableCommodities.length
        
        // 翻译描述
        if (result.description) {
          const cachedCn = getCachedTranslation(result.description)
          result.descriptionCn = cachedCn || null
          if (!cachedCn) {
            try {
              const translated = await translateText(result.description, 'en', 'zh-CN', 3000)
              if (translated && translated !== result.description) {
                result.descriptionCn = translated
                setCachedTranslation(result.description, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
        }
        
        // 构建面包屑
        const chapter = (data.included || []).find(i => i.type === 'chapter')
        result.breadcrumb = [
          {
            code: result.parentCode,
            description: chapter?.attributes?.description || `Chapter ${result.parentCode}`,
            level: 'chapter'
          },
          {
            code: headingCode,
            description: result.description,
            descriptionCn: result.descriptionCn,
            level: 'heading'
          }
        ]
      }
    } else {
      // 子目（subheading）或更细的编码
      const fullCode = normalizedCode.padEnd(10, '0')
      const url = `${XI_API_BASE}/commodities/${fullCode}`
      const data = await httpGetJson(url)
      
      if (data && data.data) {
        result.isValid = true
        result.isDeclarable = data.data.attributes?.declarable === true
        result.hasChildren = !result.isDeclarable
        result.description = data.data.attributes?.description
        
        // 翻译描述
        if (result.description) {
          const cachedCn = getCachedTranslation(result.description)
          result.descriptionCn = cachedCn || null
          if (!cachedCn) {
            try {
              const translated = await translateText(result.description, 'en', 'zh-CN', 3000)
              if (translated && translated !== result.description) {
                result.descriptionCn = translated
                setCachedTranslation(result.description, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
        }
        
        // 构建面包屑
        const ancestors = (data.included || []).filter(i => 
          i.type === 'chapter' || i.type === 'heading' || i.type === 'commodity'
        )
        
        result.breadcrumb = ancestors
          .filter(a => a.type === 'chapter' || a.type === 'heading')
          .sort((a, b) => {
            const aLen = (a.attributes?.goods_nomenclature_item_id || a.id || '').length
            const bLen = (b.attributes?.goods_nomenclature_item_id || b.id || '').length
            return aLen - bLen
          })
          .map(a => ({
            code: a.attributes?.goods_nomenclature_item_id || a.id,
            description: a.attributes?.description,
            level: a.type
          }))
        
        // 添加当前编码到面包屑
        result.breadcrumb.push({
          code: fullCode,
          description: result.description,
          descriptionCn: result.descriptionCn,
          level: result.isDeclarable ? 'taric' : 'cn'
        })
        
        // 如果不是可申报编码，获取子编码数量
        if (!result.isDeclarable) {
          // 查询 heading 获取所有子编码
          const headingCode = normalizedCode.substring(0, 4)
          const headingUrl = `${XI_API_BASE}/headings/${headingCode}`
          const headingData = await httpGetJson(headingUrl)
          
          if (headingData && headingData.included) {
            const prefix = normalizedCode.substring(0, Math.min(normalizedCode.length, 6))
            const children = headingData.included.filter(i => 
              i.type === 'commodity' && 
              i.attributes?.goods_nomenclature_item_id?.startsWith(prefix) &&
              i.attributes?.goods_nomenclature_item_id !== fullCode
            )
            result.childCount = children.length
            result.declarableCount = children.filter(c => c.attributes?.declarable === true).length
          }
        }
      } else {
        // 编码不存在，但可能有相似的编码
        result.isValid = false
        result.error = `编码 ${normalizedCode} 在 EU TARIC 系统中不存在`
        
        // 尝试查找父级编码
        const headingCode = normalizedCode.substring(0, 4)
        const headingUrl = `${XI_API_BASE}/headings/${headingCode}`
        const headingData = await httpGetJson(headingUrl)
        
        if (headingData && headingData.data) {
          result.parentCode = headingCode
          result.parentDescription = headingData.data.attributes?.description
          
          // 获取相似的可申报编码
          const prefix6 = normalizedCode.substring(0, 6)
          const similarCodes = (headingData.included || []).filter(i =>
            i.type === 'commodity' &&
            i.attributes?.declarable === true &&
            i.attributes?.goods_nomenclature_item_id?.startsWith(prefix6)
          ).slice(0, 10)
          
          result.similarCodes = similarCodes.map(c => ({
            code: c.attributes?.goods_nomenclature_item_id,
            description: c.attributes?.description
          }))
        }
      }
    }
  } catch (error) {
    result.error = `验证编码时出错: ${error.message}`
  }
  
  // 缓存结果（1小时）
  setCache(cacheKey, result, 60 * 60 * 1000)
  
  return result
}

// ==================== HS 编码层级树查询 ====================

/**
 * 获取 HS 编码的层级树（含分组子编码）
 * 升级版：支持完整的祖先链、Section 信息、材质分级
 * @param {string} prefixCode - 编码前缀
 * @param {string} originCountry - 原产国代码（可选）
 * @returns {Promise<Object>} 层级树结果
 */
export async function getHsCodeHierarchy(prefixCode, originCountry = '') {
  const normalizedCode = prefixCode.replace(/\D/g, '')
  
  // 检查缓存
  const cacheKey = `hierarchy_v2_${normalizedCode}_${originCountry || 'ALL'}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  const result = {
    code: normalizedCode,
    description: null,
    descriptionCn: null,
    level: null,
    section: null,        // Section 信息
    breadcrumb: [],       // 完整祖先链
    childGroups: [],      // 分组子编码
    children: [],         // 简单子编码列表
    totalChildren: 0,
    declarableCount: 0,
    isDeclarable: false,
    hasMore: false
  }
  
  try {
    const codeLength = normalizedCode.length
    
    // 对于 6 位及以上的编码，需要综合 commodity 和 heading 数据构建完整层级
    if (codeLength >= 6) {
      const fullCode = normalizedCode.padEnd(10, '0')
      const headingCode = normalizedCode.substring(0, 4)
      
      // 并行获取 commodity 和 heading 数据
      const [commodityData, headingData] = await Promise.all([
        httpGetJson(`${XI_API_BASE}/commodities/${fullCode}`),
        httpGetJson(`${XI_API_BASE}/headings/${headingCode}`)
      ])
      
      if (commodityData && commodityData.data) {
        const commodity = commodityData.data
        const included = commodityData.included || []
        
        result.description = commodity.attributes?.description
        result.isDeclarable = commodity.attributes?.declarable === true
        result.level = result.isDeclarable ? 'taric' : 'cn'
        
        // 提取 Section 信息
        const section = included.find(i => i.type === 'section')
        if (section) {
          result.section = {
            number: parseInt(section.id) || section.attributes?.numeral,
            title: section.attributes?.title || section.attributes?.description,
            titleCn: null
          }
          // 翻译 Section 标题
          if (result.section.title) {
            const cachedCn = getCachedTranslation(result.section.title)
            if (cachedCn) {
              result.section.titleCn = cachedCn
            } else {
              try {
                const translated = await translateText(result.section.title, 'en', 'zh-CN', 3000)
                if (translated && translated !== result.section.title) {
                  result.section.titleCn = translated
                  setCachedTranslation(result.section.title, translated)
                }
              } catch (e) { /* 忽略翻译错误 */ }
            }
          }
        }
        
        // 提取 Chapter 信息
        const chapter = included.find(i => i.type === 'chapter')
        
        // 提取 Heading 信息
        const heading = included.find(i => i.type === 'heading')
        
        // 从 heading 数据中获取完整的 commodity 列表用于构建祖先链
        // 重要：必须保持 API 原始顺序，因为祖先关系是基于位置和 indent 确定的
        const allCommodities = headingData?.included?.filter(i => i.type === 'commodity') || []
        
        // 使用 indent 字段构建正确的祖先链
        // 找到当前编码在列表中的位置和 indent
        // 注意：同一个编码可能出现两次（一次是分类节点 declarable=false，一次是可申报编码 declarable=true）
        // 需要找到 declarable=true 且编码匹配的记录
        let currentIndex = -1
        let currentIndent = 0
        
        for (let i = 0; i < allCommodities.length; i++) {
          const item = allCommodities[i]
          if (item.attributes?.goods_nomenclature_item_id === fullCode && 
              item.attributes?.declarable === true) {
            currentIndex = i
            currentIndent = item.attributes?.number_indents || 0
            break
          }
        }
        
        // 如果没找到 declarable=true 的记录，尝试查找任何匹配的记录
        if (currentIndex === -1) {
          for (let i = 0; i < allCommodities.length; i++) {
            const item = allCommodities[i]
            if (item.attributes?.goods_nomenclature_item_id === fullCode) {
              currentIndex = i
              currentIndent = item.attributes?.number_indents || 0
              break
            }
          }
        }
        
        // 构建祖先链：向前查找 indent 更小的编码（材质分级）
        // 祖先必须是 declarable=false（分类节点），不是可申报编码
        const ancestors = []
        if (currentIndex >= 0) {
          let targetIndent = currentIndent - 1
          
          // 从当前位置向前查找
          for (let i = currentIndex - 1; i >= 0 && targetIndent >= 1; i--) {
            const item = allCommodities[i]
            const itemIndent = item.attributes?.number_indents || 0
            const itemDeclarable = item.attributes?.declarable
            
            // 找到目标 indent 的祖先（必须是分类节点 declarable=false/null）
            if (itemIndent === targetIndent && !itemDeclarable) {
              ancestors.unshift({
                code: item.attributes?.goods_nomenclature_item_id,
                description: item.attributes?.description,
                indent: itemIndent,
                declarable: itemDeclarable
              })
              targetIndent--
            }
          }
        }
        
        // 构建完整的面包屑
        const breadcrumb = []
        
        // 添加 Section
        if (result.section) {
          breadcrumb.push({
            code: `S${result.section.number}`,
            description: result.section.title,
            descriptionCn: result.section.titleCn,
            level: 'section'
          })
        }
        
        // 添加 Chapter
        if (chapter) {
          const chapterDesc = chapter.attributes?.description
          let chapterDescCn = getCachedTranslation(chapterDesc)
          if (!chapterDescCn && chapterDesc) {
            try {
              const translated = await translateText(chapterDesc, 'en', 'zh-CN', 3000)
              if (translated && translated !== chapterDesc) {
                chapterDescCn = translated
                setCachedTranslation(chapterDesc, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
          breadcrumb.push({
            code: chapter.attributes?.goods_nomenclature_item_id?.substring(0, 2) || chapter.id,
            description: chapterDesc,
            descriptionCn: chapterDescCn,
            level: 'chapter'
          })
        }
        
        // 添加 Heading
        if (heading) {
          const headingDesc = heading.attributes?.description
          let headingDescCn = getCachedTranslation(headingDesc)
          if (!headingDescCn && headingDesc) {
            try {
              const translated = await translateText(headingDesc, 'en', 'zh-CN', 3000)
              if (translated && translated !== headingDesc) {
                headingDescCn = translated
                setCachedTranslation(headingDesc, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
          breadcrumb.push({
            code: heading.attributes?.goods_nomenclature_item_id?.substring(0, 4) || heading.id,
            description: headingDesc,
            descriptionCn: headingDescCn,
            level: 'heading'
          })
        }
        
        // 添加祖先 commodity（材质分级等中间层级）
        for (const ancestor of ancestors) {
          const ancestorDesc = ancestor.description
          let ancestorDescCn = getCachedTranslation(ancestorDesc)
          if (!ancestorDescCn && ancestorDesc) {
            try {
              const translated = await translateText(ancestorDesc, 'en', 'zh-CN', 3000)
              if (translated && translated !== ancestorDesc) {
                ancestorDescCn = translated
                setCachedTranslation(ancestorDesc, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
          
          breadcrumb.push({
            code: ancestor.code,
            description: ancestorDesc,
            descriptionCn: ancestorDescCn,
            level: 'subheading',
            indent: ancestor.indent
          })
        }
        
        // 添加当前编码到面包屑
        let currentDescCn = getCachedTranslation(result.description)
        if (!currentDescCn && result.description) {
          try {
            const translated = await translateText(result.description, 'en', 'zh-CN', 3000)
            if (translated && translated !== result.description) {
              currentDescCn = translated
              setCachedTranslation(result.description, translated)
            }
          } catch (e) { /* 忽略翻译错误 */ }
        }
        result.descriptionCn = currentDescCn
        
        breadcrumb.push({
          code: fullCode,
          description: result.description,
          descriptionCn: currentDescCn,
          level: result.isDeclarable ? 'taric' : 'cn'
        })
        
        result.breadcrumb = breadcrumb
        
        // 如果是可申报编码，没有子编码
        if (result.isDeclarable) {
          result.totalChildren = 0
          result.declarableCount = 0
        } else {
          // 获取子编码
          if (headingData && headingData.included) {
            const prefix6 = normalizedCode.substring(0, Math.min(normalizedCode.length, 6))
            const childCommodities = headingData.included.filter(i =>
              i.type === 'commodity' &&
              i.attributes?.goods_nomenclature_item_id?.startsWith(prefix6) &&
              i.attributes?.goods_nomenclature_item_id !== fullCode
            )
            
            // 按 8 位编码分组
            const groupMap = new Map()
            
            for (const child of childCommodities) {
              const childCode = child.attributes?.goods_nomenclature_item_id
              if (!child.attributes?.declarable) continue
              
              const groupKey = childCode?.substring(0, 8)
              
              // 找到分组的父级描述
              const parentNode = childCommodities.find(c =>
                !c.attributes?.declarable &&
                childCode?.startsWith(c.attributes?.goods_nomenclature_item_id?.substring(0, 8))
              )
              
              const groupTitle = parentNode?.attributes?.description || 'Other'
              
              if (!groupMap.has(groupKey)) {
                let groupTitleCn = getCachedTranslation(groupTitle)
                groupMap.set(groupKey, {
                  groupCode: groupKey,
                  groupTitle,
                  groupTitleCn,
                  children: []
                })
              }
              
              let childDescCn = getCachedTranslation(child.attributes?.description)
              
              groupMap.get(groupKey).children.push({
                code: childCode,
                description: child.attributes?.description,
                descriptionCn: childDescCn,
                declarable: true,
                vatRate: null,
                thirdCountryDuty: null,
                supplementaryUnit: null
              })
            }
            
            result.childGroups = Array.from(groupMap.values()).filter(g => g.children.length > 0)
            result.totalChildren = childCommodities.filter(c => c.attributes?.declarable).length
            result.declarableCount = result.totalChildren
            
            // 如果传入了原产国，获取子编码的税率信息（并行获取，最多处理20个）
            if (originCountry && result.childGroups.length > 0) {
              const allChildren = result.childGroups.flatMap(g => g.children)
              const childrenToFetch = allChildren.slice(0, 20) // 限制数量避免过多请求
              
              // 并行获取税率
              const ratePromises = childrenToFetch.map(async (child) => {
                try {
                  const rateData = await lookupTaricCode(child.code, originCountry)
                  // 使用 ?? 运算符处理 0 值（0% 税率是有效值）
                  return {
                    code: child.code,
                    thirdCountryDuty: rateData?.thirdCountryDuty ?? null,
                    vatRate: rateData?.vatRate ?? null,
                    supplementaryUnit: rateData?.supplementaryUnit ?? null,
                    antiDumpingRate: rateData?.antiDumpingRate ?? null
                  }
                } catch (e) {
                  return { code: child.code, thirdCountryDuty: null, vatRate: null }
                }
              })
              
              const rateResults = await Promise.all(ratePromises)
              const rateMap = new Map(rateResults.map(r => [r.code, r]))
              
              // 更新子编码税率信息
              for (const group of result.childGroups) {
                for (const child of group.children) {
                  const rate = rateMap.get(child.code)
                  if (rate) {
                    child.thirdCountryDuty = rate.thirdCountryDuty
                    child.vatRate = rate.vatRate
                    child.supplementaryUnit = rate.supplementaryUnit
                    child.antiDumpingRate = rate.antiDumpingRate
                  }
                }
              }
            }
          }
        }
        
        // 缓存结果
        setCache(cacheKey, result, 30 * 60 * 1000)
        return result
      }
    }
    
    // 章节级别（2位）
    if (codeLength <= 2) {
      const chapterCode = normalizedCode.padStart(2, '0')
      const url = `${XI_API_BASE}/chapters/${chapterCode}`
      const data = await httpGetJson(url)
      
      if (data && data.data) {
        result.description = data.data.attributes?.description
        result.level = 'chapter'
        
        // 获取 Section 信息
        const section = (data.included || []).find(i => i.type === 'section')
        if (section) {
          result.section = {
            number: parseInt(section.id) || section.attributes?.numeral,
            title: section.attributes?.title || section.attributes?.description,
            titleCn: null
          }
        }
        
        // 翻译描述
        if (result.description) {
          const cachedCn = getCachedTranslation(result.description)
          result.descriptionCn = cachedCn || null
          if (!cachedCn) {
            try {
              const translated = await translateText(result.description, 'en', 'zh-CN', 3000)
              if (translated && translated !== result.description) {
                result.descriptionCn = translated
                setCachedTranslation(result.description, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
        }
        
        // 获取所有 headings
        const headings = (data.included || []).filter(i => i.type === 'heading')
        result.children = headings.map(h => ({
          code: h.attributes?.goods_nomenclature_item_id || h.id,
          description: h.attributes?.description,
          level: 'heading',
          hasChildren: true
        }))
        result.totalChildren = result.children.length
        
        // 构建面包屑
        result.breadcrumb = []
        if (result.section) {
          result.breadcrumb.push({
            code: `S${result.section.number}`,
            description: result.section.title,
            descriptionCn: result.section.titleCn,
            level: 'section'
          })
        }
        result.breadcrumb.push({
          code: chapterCode,
          description: result.description,
          descriptionCn: result.descriptionCn,
          level: 'chapter'
        })
      }
    } 
    // 品目级别（4位）
    else if (codeLength <= 4) {
      const headingCode = normalizedCode.substring(0, 4)
      const url = `${XI_API_BASE}/headings/${headingCode}`
      const data = await httpGetJson(url)
      
      if (data && data.data) {
        result.description = data.data.attributes?.description
        result.level = 'heading'
        
        // 翻译描述
        if (result.description) {
          const cachedCn = getCachedTranslation(result.description)
          result.descriptionCn = cachedCn || null
          if (!cachedCn) {
            try {
              const translated = await translateText(result.description, 'en', 'zh-CN', 3000)
              if (translated && translated !== result.description) {
                result.descriptionCn = translated
                setCachedTranslation(result.description, translated)
              }
            } catch (e) { /* 忽略翻译错误 */ }
          }
        }
        
        // 获取章节和 Section 信息
        const chapter = (data.included || []).find(i => i.type === 'chapter')
        const section = (data.included || []).find(i => i.type === 'section')
        
        if (section) {
          result.section = {
            number: parseInt(section.id) || section.attributes?.numeral,
            title: section.attributes?.title || section.attributes?.description,
            titleCn: null
          }
        }
        
        // 构建面包屑
        result.breadcrumb = []
        if (result.section) {
          result.breadcrumb.push({
            code: `S${result.section.number}`,
            description: result.section.title,
            descriptionCn: result.section.titleCn,
            level: 'section'
          })
        }
        
        if (chapter) {
          let chapterDescCn = getCachedTranslation(chapter.attributes?.description)
          result.breadcrumb.push({
            code: headingCode.substring(0, 2),
            description: chapter.attributes?.description || `Chapter ${headingCode.substring(0, 2)}`,
            descriptionCn: chapterDescCn,
            level: 'chapter'
          })
        }
        
        result.breadcrumb.push({
          code: headingCode,
          description: result.description,
          descriptionCn: result.descriptionCn,
          level: 'heading'
        })
        
        // 获取所有商品编码并按子目分组
        const commodities = (data.included || []).filter(i => i.type === 'commodity')
        
        // 按6位子目分组
        const subheadingGroups = new Map()
        
        for (const commodity of commodities) {
          const code10 = commodity.attributes?.goods_nomenclature_item_id
          if (!code10) continue
          
          const subheading6 = code10.substring(0, 6)
          
          if (!subheadingGroups.has(subheading6)) {
            // 查找该子目的父级描述作为分组标题
            const parentCommodity = commodities.find(c => 
              c.attributes?.goods_nomenclature_item_id?.startsWith(subheading6) &&
              !c.attributes?.declarable
            )
            
            const groupTitle = parentCommodity?.attributes?.description || `Subheading ${subheading6}`
            let groupTitleCn = getCachedTranslation(groupTitle)
            
            subheadingGroups.set(subheading6, {
              groupCode: subheading6,
              groupTitle,
              groupTitleCn,
              children: []
            })
          }
          
          // 只添加可申报编码到子列表
          if (commodity.attributes?.declarable) {
            let childDescCn = getCachedTranslation(commodity.attributes?.description)
            subheadingGroups.get(subheading6).children.push({
              code: code10,
              description: commodity.attributes?.description,
              descriptionCn: childDescCn,
              declarable: true,
              vatRate: null,
              thirdCountryDuty: null,
              supplementaryUnit: null,
              antiDumpingRate: null
            })
          }
        }
        
        result.childGroups = Array.from(subheadingGroups.values()).filter(g => g.children.length > 0)
        result.totalChildren = commodities.filter(c => c.attributes?.declarable).length
        result.declarableCount = result.totalChildren
        
        // 如果传入了原产国，获取子编码的税率信息（并行获取，最多处理30个）
        if (originCountry && result.childGroups.length > 0) {
          const allChildren = result.childGroups.flatMap(g => g.children)
          const childrenToFetch = allChildren.slice(0, 30) // 限制数量避免过多请求
          
          // 并行获取税率
          const ratePromises = childrenToFetch.map(async (child) => {
            try {
              const rateData = await lookupTaricCode(child.code, originCountry)
              // 使用 ?? 运算符处理 0 值（0% 税率是有效值）
              return {
                code: child.code,
                thirdCountryDuty: rateData?.thirdCountryDuty ?? null,
                vatRate: rateData?.vatRate ?? null,
                supplementaryUnit: rateData?.supplementaryUnit ?? null,
                antiDumpingRate: rateData?.antiDumpingRate ?? null
              }
            } catch (e) {
              return { code: child.code, thirdCountryDuty: null, vatRate: null }
            }
          })
          
          const rateResults = await Promise.all(ratePromises)
          const rateMap = new Map(rateResults.map(r => [r.code, r]))
          
          // 更新子编码税率信息
          for (const group of result.childGroups) {
            for (const child of group.children) {
              const rate = rateMap.get(child.code)
              if (rate) {
                child.thirdCountryDuty = rate.thirdCountryDuty
                child.vatRate = rate.vatRate
                child.supplementaryUnit = rate.supplementaryUnit
                child.antiDumpingRate = rate.antiDumpingRate
              }
            }
          }
        }
      }
    }
  } catch (error) {
    result.error = `获取层级树失败: ${error.message}`
  }
  
  // 缓存结果（30分钟）
  setCache(cacheKey, result, 30 * 60 * 1000)
  
  return result
}

// ==================== 商品描述搜索 ====================

/**
 * 搜索商品描述
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Promise<Object>} 搜索结果
 */
export async function searchHsCodes(query, options = {}) {
  const { chapter, page = 1, pageSize = 20, originCountry } = options
  
  // 检查缓存
  const cacheKey = `search_${query}_${chapter || 'ALL'}_${page}_${pageSize}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  const result = {
    query,
    total: 0,
    chapterStats: [],
    results: [],
    page,
    pageSize,
    hasMore: false
  }
  
  try {
    // 使用 XI API 的搜索功能
    const searchUrl = `${XI_API_BASE}/search?q=${encodeURIComponent(query)}`
    const searchData = await httpGetJson(searchUrl)
    
    if (searchData && searchData.data) {
      // 检查是否是精确匹配（搜索纯编码时会返回 exact_search 类型）
      if (searchData.data.type === 'exact_search') {
        const exactMatch = searchData.data.attributes || {}
        if (exactMatch.type === 'exact_match' && exactMatch.entry) {
          const entry = exactMatch.entry
          const matchedCode = entry.id
          
          // 获取该编码的详细信息
          try {
            const detailUrl = `${XI_API_BASE}/${entry.endpoint}/${matchedCode}`
            const detailData = await httpGetJson(detailUrl)
            
            if (detailData && detailData.data) {
              const commodity = detailData.data
              const included = detailData.included || []
              const chapter = included.find(i => i.type === 'chapter')
              const section = included.find(i => i.type === 'section')
              
              // 翻译描述
              let descriptionCn = getCachedTranslation(commodity.attributes?.description)
              if (!descriptionCn && commodity.attributes?.description) {
                try {
                  descriptionCn = await translateText(commodity.attributes.description, 'en', 'zh-CN', 3000)
                  if (descriptionCn && descriptionCn !== commodity.attributes.description) {
                    setCachedTranslation(commodity.attributes.description, descriptionCn)
                  }
                } catch (e) { /* ignore */ }
              }
              
              result.total = 1
              result.results = [{
                hsCode: matchedCode,
                description: commodity.attributes?.description,
                descriptionCn: descriptionCn,
                declarable: commodity.attributes?.declarable === true,
                chapter: chapter?.attributes?.goods_nomenclature_item_id?.substring(0, 2),
                chapterDescription: chapter?.attributes?.description,
                section: section?.attributes?.numeral,
                sectionTitle: section?.attributes?.title,
                isExactMatch: true
              }]
              
              // 章节统计
              if (chapter) {
                result.chapterStats = [{
                  chapter: chapter.attributes?.goods_nomenclature_item_id?.substring(0, 2),
                  description: chapter.attributes?.description,
                  count: 1
                }]
              }
              
              setCache(cacheKey, result, 30 * 60 * 1000)
              return result
            }
          } catch (e) {
            // 如果获取详情失败，继续正常流程
            console.error('获取精确匹配详情失败:', e.message)
          }
        }
      }
      
      // 新版 API 响应格式：data.attributes.goods_nomenclature_match.commodities
      const attributes = searchData.data.attributes || {}
      const goodsMatch = attributes.goods_nomenclature_match || {}
      const referenceMatch = attributes.reference_match || {}
      
      // 合并商品匹配和引用匹配的结果
      const commodities = goodsMatch.commodities || []
      const headings = [...(goodsMatch.headings || []), ...(referenceMatch.headings || [])]
      
      // 从 commodities 提取结果
      const allResults = commodities.map(item => {
        const source = item._source || {}
        return {
          hsCode: source.goods_nomenclature_item_id,
          description: source.description,
          descriptionIndexed: source.description_indexed,
          ancestorDescriptions: source.ancestor_descriptions || [],
          declarable: source.declarable === true,
          chapter: source.chapter,
          heading: source.heading,
          section: source.section,
          score: item._score
        }
      })
      
      // 从 headings 补充结果
      for (const heading of headings) {
        const source = heading._source || {}
        const ref = source.reference || {}
        if (ref.goods_nomenclature_item_id && !allResults.find(r => r.hsCode === ref.goods_nomenclature_item_id)) {
          allResults.push({
            hsCode: ref.goods_nomenclature_item_id,
            description: ref.description,
            descriptionIndexed: ref.description_indexed,
            ancestorDescriptions: [],
            declarable: ref.class !== 'Heading', // Heading 通常不能直接申报
            chapter: ref.chapter,
            heading: null,
            section: ref.section,
            score: heading._score
          })
        }
      }
      
      // 按章节统计
      const chapterMap = new Map()
      
      for (const item of allResults) {
        const code = item.hsCode || ''
        const chapterCode = code.substring(0, 2)
        
        if (!chapterMap.has(chapterCode)) {
          const chapterDesc = item.chapter?.description || `Chapter ${chapterCode}`
          chapterMap.set(chapterCode, {
            chapter: chapterCode,
            description: chapterDesc,
            count: 0
          })
        }
        chapterMap.get(chapterCode).count++
      }
      
      result.chapterStats = Array.from(chapterMap.values())
        .sort((a, b) => b.count - a.count)
      
      // 过滤结果（按章节）
      let filteredResults = allResults
      if (chapter) {
        filteredResults = allResults.filter(item => {
          const code = item.hsCode || ''
          return code.startsWith(chapter)
        })
      }
      
      // 按相关度排序
      filteredResults.sort((a, b) => (b.score || 0) - (a.score || 0))
      
      result.total = filteredResults.length
      
      // 分页
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const pagedResults = filteredResults.slice(startIndex, endIndex)
      
      result.hasMore = endIndex < filteredResults.length
      
      // 格式化结果
      result.results = pagedResults.map(item => ({
        hsCode: item.hsCode,
        description: item.description,
        descriptionCn: null,
        declarable: item.declarable,
        chapter: (item.hsCode || '').substring(0, 2),
        keywords: item.ancestorDescriptions?.slice(0, 3) || [],
        dutyRate: null, // 需要单独查询
        links: {
          detail: `/hs/${item.hsCode}`,
        }
      }))
      
      // 翻译描述（限制数量）
      for (const item of result.results.slice(0, 10)) {
        if (item.description) {
          const cachedCn = getCachedTranslation(item.description)
          if (cachedCn) {
            item.descriptionCn = cachedCn
          }
        }
      }
    }
  } catch (error) {
    result.error = `搜索失败: ${error.message}`
  }
  
  // 缓存结果（10分钟）
  setCache(cacheKey, result, 10 * 60 * 1000)
  
  return result
}

// ==================== 改进的编码查询 ====================

/**
 * 改进的 TARIC 编码查询（V2版本）
 * 不自动替换，返回验证结果和候选列表
 * @param {string} hsCode - HS 编码
 * @param {string} originCountry - 原产国代码
 * @returns {Promise<Object>} 查询结果
 */
export async function lookupTaricCodeV2(hsCode, originCountry = '') {
  const normalizedCode = hsCode.replace(/\D/g, '').padEnd(10, '0').substring(0, 10)
  
  // 检查缓存
  const cacheKey = `lookup_v2_${normalizedCode}_${originCountry || 'ALL'}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  const result = {
    inputCode: hsCode,
    normalizedCode,
    matchStatus: '',         // exact / parent_node / not_found / partial_match
    exactMatch: null,        // 精确匹配结果
    validation: null,        // 编码验证信息
    hierarchy: null,         // 层级树（如果是父节点）
    candidates: [],          // 候选编码列表（如果未找到）
    suggestion: '',          // 建议信息
    warning: null,           // 警告信息
    queryTime: new Date().toISOString()
  }
  
  try {
    // 1. 验证编码
    const validation = await validateHsCode(hsCode)
    result.validation = validation
    
    if (validation.isValid && validation.isDeclarable) {
      // 精确匹配 - 编码存在且可申报
      result.matchStatus = 'exact'
      result.exactMatch = await lookupTaricCode(normalizedCode, originCountry)
      result.suggestion = `编码 ${normalizedCode} 是有效的可申报编码`
      
    } else if (validation.isValid && !validation.isDeclarable) {
      // 父节点 - 编码存在但不可申报，需要选择子编码
      result.matchStatus = 'parent_node'
      result.hierarchy = await getHsCodeHierarchy(hsCode, originCountry)
      result.suggestion = `编码 ${hsCode} 是分类编码（${validation.level}级），包含 ${validation.childCount || 0} 个子编码，请选择具体的可申报编码`
      result.warning = '该编码不能直接用于报关申报，请选择具体的商品编码'
      
    } else {
      // 编码不存在
      result.matchStatus = 'not_found'
      
      // 获取候选编码
      const prefix6 = normalizedCode.substring(0, 6)
      const prefix4 = normalizedCode.substring(0, 4)
      
      // 尝试从 heading 获取候选
      try {
        const headingUrl = `${XI_API_BASE}/headings/${prefix4}`
        const headingData = await httpGetJson(headingUrl)
        
        if (headingData && headingData.included) {
          const declarables = headingData.included.filter(i =>
            i.type === 'commodity' &&
            i.attributes?.declarable === true &&
            i.attributes?.goods_nomenclature_item_id?.startsWith(prefix6)
          )
          
          result.candidates = declarables.slice(0, 10).map(c => ({
            code: c.attributes?.goods_nomenclature_item_id,
            description: c.attributes?.description,
            matchScore: calculateMatchScore(normalizedCode, c.attributes?.goods_nomenclature_item_id)
          }))
          
          // 按匹配度排序
          result.candidates.sort((a, b) => b.matchScore - a.matchScore)
        }
      } catch (e) {
        // 忽略错误
      }
      
      result.suggestion = `编码 ${hsCode} 在 EU TARIC 系统中不存在`
      if (result.candidates.length > 0) {
        result.suggestion += `，以下是 ${prefix6} 下的可申报编码供参考`
      }
      result.warning = '请勿使用不存在的编码进行报关申报，这可能导致清关延误或罚款'
      
      // 如果有相似编码，添加说明
      if (validation.similarCodes && validation.similarCodes.length > 0) {
        result.candidates = validation.similarCodes.map(c => ({
          ...c,
          matchScore: calculateMatchScore(normalizedCode, c.code)
        }))
      }
    }
  } catch (error) {
    result.error = `查询失败: ${error.message}`
    result.matchStatus = 'error'
  }
  
  // 缓存结果（15分钟）
  setCache(cacheKey, result, 15 * 60 * 1000)
  
  return result
}

/**
 * 计算编码匹配度分数
 */
function calculateMatchScore(inputCode, candidateCode) {
  if (!inputCode || !candidateCode) return 0
  
  let score = 0
  const minLen = Math.min(inputCode.length, candidateCode.length)
  
  for (let i = 0; i < minLen; i++) {
    if (inputCode[i] === candidateCode[i]) {
      score += 10 - i // 前面位置权重更高
    } else {
      break
    }
  }
  
  return score
}

/**
 * 获取前缀下的所有可申报编码
 * @param {string} prefix - 编码前缀（4-8位）
 * @param {string} originCountry - 原产国代码
 * @returns {Promise<Array>} 可申报编码列表
 */
export async function getDeclarableCodes(prefix, originCountry = '') {
  const normalizedPrefix = prefix.replace(/\D/g, '')
  
  // 检查缓存
  const cacheKey = `declarable_${normalizedPrefix}_${originCountry || 'ALL'}`
  const cached = getFromCache(cacheKey)
  if (cached) {
    return cached
  }
  
  const results = []
  
  try {
    const headingCode = normalizedPrefix.substring(0, 4)
    const url = `${XI_API_BASE}/headings/${headingCode}`
    const data = await httpGetJson(url)
    
    if (data && data.included) {
      const declarables = data.included.filter(i =>
        i.type === 'commodity' &&
        i.attributes?.declarable === true &&
        i.attributes?.goods_nomenclature_item_id?.startsWith(normalizedPrefix)
      )
      
      for (const commodity of declarables) {
        const code = commodity.attributes?.goods_nomenclature_item_id
        let rateInfo = null
        
        // 可选：获取税率信息
        if (originCountry) {
          try {
            rateInfo = await lookupTaricCode(code, originCountry)
          } catch (e) {
            // 忽略单个查询错误
          }
        }
        
        results.push({
          code,
          description: commodity.attributes?.description,
          declarable: true,
          dutyRate: rateInfo?.dutyRate,
          thirdCountryDuty: rateInfo?.thirdCountryDuty,
          antiDumpingRate: rateInfo?.antiDumpingRate
        })
      }
    }
  } catch (error) {
    console.warn(`获取可申报编码失败 [${prefix}]:`, error.message)
  }
  
  // 缓存结果（30分钟）
  setCache(cacheKey, results, 30 * 60 * 1000)
  
  return results
}

// ==================== 导出 ====================

export { 
  findChinaAntiDumpingRate,
  getAllChinaAntiDumpingRates,
  getAntiDumpingHsCodes,
  hasAntiDumpingDuty,
  getAntiDumpingSummary
} from './chinaAntiDumpingRates.js'

export default {
  lookupTaricCode,
  getMeasureDetails,
  batchLookup,
  getCountryCodes,
  checkApiHealth,
  clearCache,
  getCacheStats,
  findChinaAntiDumpingRate,
  // 新增 V2 功能
  validateHsCode,
  getHsCodeHierarchy,
  searchHsCodes,
  lookupTaricCodeV2,
  getDeclarableCodes
}
