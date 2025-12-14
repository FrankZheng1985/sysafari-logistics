/**
 * 基础数据模块 - 数据模型
 * 包含：国家、港口、船公司、运输方式等
 */

import { getDatabase } from '../../config/database.js'

// ==================== 国家相关 ====================

/**
 * 获取国家列表
 */
export function getCountries(params = {}) {
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
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY country_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
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
export function getCountryById(id) {
  const db = getDatabase()
  const country = db.prepare('SELECT * FROM countries WHERE id = ?').get(id)
  return country ? convertCountryToCamelCase(country) : null
}

/**
 * 根据国家代码获取国家
 */
export function getCountryByCode(code) {
  const db = getDatabase()
  const country = db.prepare('SELECT * FROM countries WHERE country_code = ?').get(code.toUpperCase())
  return country ? convertCountryToCamelCase(country) : null
}

/**
 * 创建国家
 */
export function createCountry(data) {
  const db = getDatabase()
  const result = db.prepare(`
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
export function updateCountry(id, data) {
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
  
  const result = db.prepare(`UPDATE countries SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除国家
 */
export function deleteCountry(id) {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM countries WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 港口相关 ====================

/**
 * 获取起运港列表
 */
export function getPortsOfLoading(params = {}) {
  const db = getDatabase()
  const { country, transportType, status = 'active', search, page = 1, pageSize = 100 } = params
  
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
  
  if (search) {
    query += ' AND (port_name_cn LIKE ? OR port_name_en LIKE ? OR port_code LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY sort_order, port_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
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
export function getDestinationPorts(params = {}) {
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
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY continent, country, port_name_cn LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
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
export function getShippingCompanies(params = {}) {
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
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY company_name LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
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
export function getVatRates(params = {}) {
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
  const totalResult = db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY standard_rate DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = db.prepare(query).all(...queryParams)
  
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
export function getVatRateByCountryCode(countryCode) {
  const db = getDatabase()
  const vatRate = db.prepare(
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

export default {
  // 国家
  getCountries,
  getCountryById,
  getCountryByCode,
  createCountry,
  updateCountry,
  deleteCountry,
  
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
  convertVatRateToCamelCase
}
