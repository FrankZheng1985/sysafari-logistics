/**
 * 基础数据模块 - 数据模型
 * 包含：国家、港口、船公司、运输方式等
 */

import { getDatabase } from '../../config/database.js'

// ==================== 国家相关 ====================

/**
 * 获取国家列表
 */
export async function getCountries(params = {}) {
  const db = getDatabase()
  const { continent, status = 'active', search, page = 1, pageSize = 100 } = params
  
  let query = 'SELECT * FROM countries WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (continent) {
    query += ' AND continent = ?'
    queryParams.push(continent)
  }
  
  if (search) {
    query += ' AND (country_name_cn LIKE ? OR country_name_en LIKE ? OR country_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY country_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertCountryToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取国家
 */
export async function getCountryById(id) {
  const db = getDatabase()
  const country = await db.prepare('SELECT * FROM countries WHERE id = ?').get(id)
  return country ? convertCountryToCamelCase(country) : null
}

/**
 * 根据国家代码获取国家
 */
export async function getCountryByCode(code) {
  const db = getDatabase()
  const country = await db.prepare('SELECT * FROM countries WHERE country_code = ?').get(code.toUpperCase())
  return country ? convertCountryToCamelCase(country) : null
}

/**
 * 创建国家
 */
export async function createCountry(data) {
  const db = getDatabase()
  const result = await db.prepare(`
    INSERT INTO countries (
      country_code, country_name_cn, country_name_en, continent,
      region, capital, currency_code, currency_name, phone_code,
      timezone, description, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.countryCode.toUpperCase(),
    data.countryNameCn,
    data.countryNameEn,
    data.continent || '',
    data.region || '',
    data.capital || '',
    data.currencyCode || '',
    data.currencyName || '',
    data.phoneCode || '',
    data.timezone || '',
    data.description || '',
    data.status || 'active'
  )
  
  return { id: result.lastInsertRowid }
}

/**
 * 更新国家
 */
export async function updateCountry(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const allowedFields = {
    country_code: 'countryCode',
    country_name_cn: 'countryNameCn',
    country_name_en: 'countryNameEn',
    continent: 'continent',
    region: 'region',
    capital: 'capital',
    currency_code: 'currencyCode',
    currency_name: 'currencyName',
    phone_code: 'phoneCode',
    timezone: 'timezone',
    description: 'description',
    status: 'status'
  }
  
  Object.entries(allowedFields).forEach(([dbField, jsField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  const result = await db.prepare(`UPDATE countries SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除国家
 */
export async function deleteCountry(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM countries WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 港口相关 ====================

/**
 * 获取起运港列表
 */
export async function getPortsOfLoading(params = {}) {
  const db = getDatabase()
  const { country, transportType, status = 'active', search, continent, page = 1, pageSize = 100 } = params
  
  let query = 'SELECT * FROM ports_of_loading WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (country) {
    query += ' AND country = ?'
    queryParams.push(country)
  }
  
  if (transportType) {
    query += ' AND transport_type = ?'
    queryParams.push(transportType)
  }
  
  if (continent) {
    query += ' AND continent = ?'
    queryParams.push(continent)
  }
  
  if (search) {
    // 使用 ILIKE 实现不区分大小写搜索（PostgreSQL原生支持）
    query += ' AND (port_name_cn ILIKE ? OR port_name_en ILIKE ? OR port_code ILIKE ? OR city ILIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY sort_order, port_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertPortToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取目的港列表
 */
export async function getDestinationPorts(params = {}) {
  const db = getDatabase()
  const { country, continent, transportType, status = 'active', search, page = 1, pageSize = 100 } = params
  
  let query = 'SELECT * FROM destination_ports WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (country) {
    query += ' AND country = ?'
    queryParams.push(country)
  }
  
  if (continent) {
    query += ' AND continent = ?'
    queryParams.push(continent)
  }
  
  if (transportType) {
    query += ' AND transport_type = ?'
    queryParams.push(transportType)
  }
  
  if (search) {
    query += ' AND (port_name_cn LIKE ? OR port_name_en LIKE ? OR port_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY continent, country, port_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertPortToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

// ==================== 船公司相关 ====================

/**
 * 获取船公司列表
 */
export async function getShippingCompanies(params = {}) {
  const db = getDatabase()
  const { status = 'active', search, page = 1, pageSize = 100 } = params
  
  let query = 'SELECT * FROM shipping_companies WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (company_name LIKE ? OR company_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY company_name LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertShippingCompanyToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

// ==================== 增值税率相关 ====================

/**
 * 获取增值税率列表
 */
export async function getVatRates(params = {}) {
  const db = getDatabase()
  const { status = 'active', search, page = 1, pageSize = 100 } = params
  
  let query = 'SELECT * FROM vat_rates WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (search) {
    query += ' AND (country_name LIKE ? OR country_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY standard_rate DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertVatRateToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据国家代码获取增值税率
 */
export async function getVatRateByCountryCode(countryCode) {
  const db = getDatabase()
  const vatRate = await db.prepare(
    "SELECT * FROM vat_rates WHERE country_code = ? AND status = 'active'"
  ).get(countryCode.toUpperCase())
  
  return vatRate ? convertVatRateToCamelCase(vatRate) : null
}

// ==================== 数据转换函数 ====================

export function convertCountryToCamelCase(row) {
  return {
    id: String(row.id),
    countryCode: row.country_code,
    countryNameCn: row.country_name_cn,
    countryNameEn: row.country_name_en,
    continent: row.continent,
    region: row.region,
    capital: row.capital,
    currencyCode: row.currency_code,
    currencyName: row.currency_name,
    phoneCode: row.phone_code,
    timezone: row.timezone,
    description: row.description,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertPortToCamelCase(row) {
  return {
    id: String(row.id),
    portCode: row.port_code,
    portNameCn: row.port_name_cn,
    portNameEn: row.port_name_en,
    country: row.country,
    countryCode: row.country_code,
    city: row.city,
    transportType: row.transport_type,
    continent: row.continent,
    sortOrder: row.sort_order,
    description: row.description,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertShippingCompanyToCamelCase(row) {
  return {
    id: String(row.id),
    companyCode: row.company_code,
    companyName: row.company_name,
    country: row.country,
    website: row.website,
    description: row.description,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertVatRateToCamelCase(row) {
  return {
    id: String(row.id),
    countryCode: row.country_code,
    countryName: row.country_name,
    standardRate: row.standard_rate,
    reducedRate: row.reduced_rate,
    superReducedRate: row.super_reduced_rate,
    parkingRate: row.parking_rate,
    description: row.description,
    effectiveDate: row.effective_date,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

// ==================== 城市相关 ====================

/**
 * 获取城市列表
 */
export async function getCities(params = {}) {
  const db = getDatabase()
  const { countryCode, parentId, level, status = 'active', search, page = 1, pageSize = 500 } = params
  
  let query = 'SELECT * FROM cities WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (countryCode) {
    query += ' AND country_code = ?'
    queryParams.push(countryCode.toUpperCase())
  }
  
  if (parentId !== undefined) {
    query += ' AND parent_id = ?'
    queryParams.push(parentId)
  }
  
  if (level) {
    query += ' AND level = ?'
    queryParams.push(level)
  }
  
  if (search) {
    query += ' AND (city_name_cn LIKE ? OR city_name_en LIKE ? OR city_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY level, city_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertCityToCamelCase),
    total: totalResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 根据国家代码获取城市列表（简化版，用于下拉选择）
 */
export async function getCitiesByCountry(countryCode, search = '') {
  const db = getDatabase()
  
  let query = 'SELECT * FROM cities WHERE country_code = ? AND status = ?'
  const queryParams = [countryCode.toUpperCase(), 'active']
  
  if (search) {
    query += ' AND (city_name_cn LIKE ? OR city_name_en LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  query += ' ORDER BY level, city_name_cn LIMIT 100'
  
  const list = await db.prepare(query).all(...queryParams)
  return list.map(convertCityToCamelCase)
}

/**
 * 获取城市详情
 */
export async function getCityById(id) {
  const db = getDatabase()
  const city = await db.prepare('SELECT * FROM cities WHERE id = ?').get(id)
  return city ? convertCityToCamelCase(city) : null
}

/**
 * 创建城市
 */
export async function createCity(data) {
  const db = getDatabase()
  const result = await db.prepare(`
    INSERT INTO cities (
      country_code, city_code, city_name_cn, city_name_en,
      parent_id, level, postal_code, latitude, longitude,
      description, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.countryCode.toUpperCase(),
    data.cityCode || null,
    data.cityNameCn,
    data.cityNameEn || '',
    data.parentId || 0,
    data.level || 2,
    data.postalCode || null,
    data.latitude || null,
    data.longitude || null,
    data.description || '',
    data.status || 'active'
  )
  
  return { id: result.id }
}

/**
 * 批量创建城市
 */
export async function createCitiesBatch(cities) {
  const db = getDatabase()
  const results = []
  
  for (const data of cities) {
    const result = await db.prepare(`
      INSERT INTO cities (
        country_code, city_code, city_name_cn, city_name_en,
        parent_id, level, postal_code, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(
      data.countryCode.toUpperCase(),
      data.cityCode || null,
      data.cityNameCn,
      data.cityNameEn || '',
      data.parentId || 0,
      data.level || 2,
      data.postalCode || null,
      data.description || '',
      data.status || 'active'
    )
    results.push({ id: result.id, cityNameCn: data.cityNameCn })
  }
  
  return results
}

/**
 * 更新城市
 */
export async function updateCity(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  if (data.countryCode !== undefined) { fields.push('country_code = ?'); values.push(data.countryCode.toUpperCase()) }
  if (data.cityCode !== undefined) { fields.push('city_code = ?'); values.push(data.cityCode) }
  if (data.cityNameCn !== undefined) { fields.push('city_name_cn = ?'); values.push(data.cityNameCn) }
  if (data.cityNameEn !== undefined) { fields.push('city_name_en = ?'); values.push(data.cityNameEn) }
  if (data.parentId !== undefined) { fields.push('parent_id = ?'); values.push(data.parentId) }
  if (data.level !== undefined) { fields.push('level = ?'); values.push(data.level) }
  if (data.postalCode !== undefined) { fields.push('postal_code = ?'); values.push(data.postalCode) }
  if (data.latitude !== undefined) { fields.push('latitude = ?'); values.push(data.latitude) }
  if (data.longitude !== undefined) { fields.push('longitude = ?'); values.push(data.longitude) }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = NOW()')
  values.push(id)
  
  const result = await db.prepare(`UPDATE cities SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除城市
 */
export async function deleteCity(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM cities WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 城市数据转换
 */
function convertCityToCamelCase(row) {
  return {
    id: row.id,
    countryCode: row.country_code,
    cityCode: row.city_code,
    cityNameCn: row.city_name_cn,
    cityNameEn: row.city_name_en,
    cityNamePinyin: row.city_name_pinyin,
    parentId: row.parent_id,
    level: row.level,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    description: row.description,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export default {
  // 国家
  getCountries,
  getCountryById,
  getCountryByCode,
  createCountry,
  updateCountry,
  deleteCountry,
  
  // 城市
  getCities,
  getCitiesByCountry,
  getCityById,
  createCity,
  createCitiesBatch,
  updateCity,
  deleteCity,
  
  // 港口
  getPortsOfLoading,
  getDestinationPorts,
  
  // 船公司
  getShippingCompanies,
  
  // 增值税率
  getVatRates,
  getVatRateByCountryCode,
  
  // 转换函数
  convertCountryToCamelCase,
  convertPortToCamelCase,
  convertShippingCompanyToCamelCase,
  convertVatRateToCamelCase,
  convertCityToCamelCase
}
