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
      
      // 找到最接近的可申报编码
      const declarableCommodity = included.find(item => 
        item.type === 'commodity' && 
        item.attributes?.declarable === true &&
        item.attributes?.goods_nomenclature_item_id?.startsWith(normalizedCode.substring(0, 6))
      )
      
      if (declarableCommodity) {
        // 查询找到的编码
        const foundCode = declarableCommodity.attributes.goods_nomenclature_item_id
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
  findChinaAntiDumpingRate
}
