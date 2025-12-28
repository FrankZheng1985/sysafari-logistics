/**
 * 基础数据模块 - 控制器
 */

import { getDatabase } from '../../config/database.js'
import { success, badRequest, notFound, conflict, serverError } from '../../utils/response.js'
import * as model from './model.js'

// ==================== 国家相关 ====================

/**
 * 获取国家列表
 */
export async function getCountries(req, res) {
  try {
    const { continent, status, search, page, pageSize } = req.query
    const result = await model.getCountries({
      continent,
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 100
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取国家列表失败:', error)
    return serverError(res, '获取国家列表失败')
  }
}

/**
 * 获取国家大洲列表
 */
export async function getCountryContinents(req, res) {
  try {
    const db = getDatabase()
    const continents = await db.prepare(
      "SELECT DISTINCT continent FROM countries WHERE continent IS NOT NULL AND continent != '' ORDER BY continent"
    ).all().map(r => r.continent)
    
    return success(res, continents)
  } catch (error) {
    console.error('获取大洲列表失败:', error)
    return serverError(res, '获取大洲列表失败')
  }
}

/**
 * 获取单个国家
 */
export async function getCountryById(req, res) {
  try {
    const country = await model.getCountryById(req.params.id)
    if (!country) {
      return notFound(res, '国家不存在')
    }
    return success(res, country)
  } catch (error) {
    console.error('获取国家详情失败:', error)
    return serverError(res, '获取国家详情失败')
  }
}

/**
 * 创建国家
 */
export async function createCountry(req, res) {
  try {
    const { countryCode, countryNameCn, countryNameEn } = req.body
    
    if (!countryCode || !countryNameCn || !countryNameEn) {
      return badRequest(res, '国家代码、中文名称和英文名称为必填项')
    }
    
    const existing = await model.getCountryByCode(countryCode)
    if (existing) {
      return conflict(res, '国家代码已存在')
    }
    
    const result = await model.createCountry(req.body)
    const newCountry = await model.getCountryById(result.id)
    
    return success(res, newCountry, '创建成功')
  } catch (error) {
    console.error('创建国家失败:', error)
    return serverError(res, '创建国家失败')
  }
}

/**
 * 更新国家
 */
export async function updateCountry(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getCountryById(id)
    if (!existing) {
      return notFound(res, '国家不存在')
    }
    
    const updated = await model.updateCountry(id, req.body)
    if (!updated) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新国家失败:', error)
    return serverError(res, '更新国家失败')
  }
}

/**
 * 删除国家
 */
export async function deleteCountry(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getCountryById(id)
    if (!existing) {
      return notFound(res, '国家不存在')
    }
    
    await model.deleteCountry(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除国家失败:', error)
    return serverError(res, '删除国家失败')
  }
}

// ==================== 城市相关 ====================

/**
 * 获取城市列表
 */
export async function getCities(req, res) {
  try {
    const { countryCode, parentId, level, status, search, page, pageSize } = req.query
    const result = await model.getCities({
      countryCode,
      parentId: parentId !== undefined ? parseInt(parentId) : undefined,
      level: level ? parseInt(level) : undefined,
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 500
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取城市列表失败:', error)
    return serverError(res, '获取城市列表失败')
  }
}

/**
 * 根据国家获取城市列表（简化版）
 */
export async function getCitiesByCountry(req, res) {
  try {
    const { countryCode } = req.params
    const { search } = req.query
    
    const cities = await model.getCitiesByCountry(countryCode, search || '')
    return success(res, cities)
  } catch (error) {
    console.error('获取国家城市列表失败:', error)
    return serverError(res, '获取国家城市列表失败')
  }
}

/**
 * 获取城市详情
 */
export async function getCityById(req, res) {
  try {
    const { id } = req.params
    const city = await model.getCityById(id)
    
    if (!city) {
      return notFound(res, '城市不存在')
    }
    
    return success(res, city)
  } catch (error) {
    console.error('获取城市详情失败:', error)
    return serverError(res, '获取城市详情失败')
  }
}

/**
 * 创建城市
 */
export async function createCity(req, res) {
  try {
    const { countryCode, cityNameCn } = req.body
    
    if (!countryCode || !cityNameCn) {
      return badRequest(res, '国家代码和城市名称为必填项')
    }
    
    const result = await model.createCity(req.body)
    return success(res, result, '创建成功')
  } catch (error) {
    console.error('创建城市失败:', error)
    return serverError(res, '创建城市失败')
  }
}

/**
 * 批量创建城市
 */
export async function createCitiesBatch(req, res) {
  try {
    const { cities } = req.body
    
    if (!cities || !Array.isArray(cities) || cities.length === 0) {
      return badRequest(res, '请提供城市数据数组')
    }
    
    const results = await model.createCitiesBatch(cities)
    return success(res, { created: results.length, cities: results }, '批量创建成功')
  } catch (error) {
    console.error('批量创建城市失败:', error)
    return serverError(res, '批量创建城市失败')
  }
}

/**
 * 更新城市
 */
export async function updateCity(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getCityById(id)
    if (!existing) {
      return notFound(res, '城市不存在')
    }
    
    await model.updateCity(id, req.body)
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新城市失败:', error)
    return serverError(res, '更新城市失败')
  }
}

/**
 * 删除城市
 */
export async function deleteCity(req, res) {
  try {
    const { id } = req.params
    
    const existing = await model.getCityById(id)
    if (!existing) {
      return notFound(res, '城市不存在')
    }
    
    await model.deleteCity(id)
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除城市失败:', error)
    return serverError(res, '删除城市失败')
  }
}

// ==================== 起运港相关 ====================

export async function getPortsOfLoading(req, res) {
  try {
    const { country, transportType, status, search, page, pageSize, continent } = req.query
    const result = await model.getPortsOfLoading({
      country,
      transportType,
      status,
      search,
      continent,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 100
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取起运港列表失败:', error)
    return serverError(res, '获取起运港列表失败')
  }
}

export async function getPortOfLoadingCountries(req, res) {
  try {
    const db = getDatabase()
    const countries = await db.prepare(
      'SELECT DISTINCT country, country_code FROM ports_of_loading WHERE country IS NOT NULL ORDER BY country'
    ).all().map(r => ({ country: r.country, countryCode: r.country_code }))
    
    return success(res, countries)
  } catch (error) {
    console.error('获取起运港国家列表失败:', error)
    return serverError(res, '获取起运港国家列表失败')
  }
}

export async function getPortOfLoadingById(req, res) {
  try {
    const db = getDatabase()
    const port = await db.prepare('SELECT * FROM ports_of_loading WHERE id = ?').get(req.params.id)
    
    if (!port) {
      return notFound(res, '起运港不存在')
    }
    
    return success(res, model.convertPortToCamelCase(port))
  } catch (error) {
    console.error('获取起运港详情失败:', error)
    return serverError(res, '获取起运港详情失败')
  }
}

export async function createPortOfLoading(req, res) {
  try {
    const { portCode, portNameCn } = req.body
    
    if (!portCode || !portNameCn) {
      return badRequest(res, '港口代码和中文名称为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM ports_of_loading WHERE port_code = ?').get(portCode)
    if (existing) {
      return conflict(res, '港口代码已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO ports_of_loading (
        port_code, port_name_cn, port_name_en, country, country_code,
        transport_type, sort_order, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portCode,
      portNameCn,
      req.body.portNameEn || '',
      req.body.country || '',
      req.body.countryCode || '',
      req.body.transportType || 'sea',
      req.body.sortOrder || 0,
      req.body.description || '',
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建起运港失败:', error)
    return serverError(res, '创建起运港失败')
  }
}

export async function updatePortOfLoading(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM ports_of_loading WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '起运港不存在')
    }
    
    const fields = []
    const values = []
    const fieldMap = {
      portCode: 'port_code',
      portNameCn: 'port_name_cn',
      portNameEn: 'port_name_en',
      country: 'country',
      countryCode: 'country_code',
      transportType: 'transport_type',
      sortOrder: 'sort_order',
      description: 'description',
      status: 'status'
    }
    
    Object.entries(fieldMap).forEach(([jsField, dbField]) => {
      if (req.body[jsField] !== undefined) {
        fields.push(`${dbField} = ?`)
        values.push(req.body[jsField])
      }
    })
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE ports_of_loading SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新起运港失败:', error)
    return serverError(res, '更新起运港失败')
  }
}

export async function deletePortOfLoading(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM ports_of_loading WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '起运港不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除起运港失败:', error)
    return serverError(res, '删除起运港失败')
  }
}

// ==================== 目的港相关 ====================

export async function getDestinationPorts(req, res) {
  try {
    const { country, continent, transportType, status, search, page, pageSize } = req.query
    const result = await model.getDestinationPorts({
      country,
      continent,
      transportType,
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 100
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取目的港列表失败:', error)
    return serverError(res, '获取目的港列表失败')
  }
}

export async function getDestinationPortCountries(req, res) {
  try {
    const db = getDatabase()
    const countries = await db.prepare(
      'SELECT DISTINCT country, country_code FROM destination_ports WHERE country IS NOT NULL ORDER BY country'
    ).all().map(r => ({ country: r.country, countryCode: r.country_code }))
    
    return success(res, countries)
  } catch (error) {
    console.error('获取目的港国家列表失败:', error)
    return serverError(res, '获取目的港国家列表失败')
  }
}

export async function getDestinationPortById(req, res) {
  try {
    const db = getDatabase()
    const port = await db.prepare('SELECT * FROM destination_ports WHERE id = ?').get(req.params.id)
    
    if (!port) {
      return notFound(res, '目的港不存在')
    }
    
    return success(res, model.convertPortToCamelCase(port))
  } catch (error) {
    console.error('获取目的港详情失败:', error)
    return serverError(res, '获取目的港详情失败')
  }
}

export async function createDestinationPort(req, res) {
  try {
    const { portCode, portNameCn } = req.body
    
    if (!portCode || !portNameCn) {
      return badRequest(res, '港口代码和中文名称为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM destination_ports WHERE port_code = ?').get(portCode)
    if (existing) {
      return conflict(res, '港口代码已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO destination_ports (
        port_code, port_name_cn, port_name_en, country, country_code,
        city, transport_type, continent, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portCode,
      portNameCn,
      req.body.portNameEn || '',
      req.body.country || '',
      req.body.countryCode || '',
      req.body.city || '',
      req.body.transportType || 'sea',
      req.body.continent || '',
      req.body.description || '',
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建目的港失败:', error)
    return serverError(res, '创建目的港失败')
  }
}

export async function updateDestinationPort(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM destination_ports WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '目的港不存在')
    }
    
    const fields = []
    const values = []
    const fieldMap = {
      portCode: 'port_code',
      portNameCn: 'port_name_cn',
      portNameEn: 'port_name_en',
      country: 'country',
      countryCode: 'country_code',
      city: 'city',
      transportType: 'transport_type',
      continent: 'continent',
      description: 'description',
      status: 'status'
    }
    
    Object.entries(fieldMap).forEach(([jsField, dbField]) => {
      if (req.body[jsField] !== undefined) {
        fields.push(`${dbField} = ?`)
        values.push(req.body[jsField])
      }
    })
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE destination_ports SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新目的港失败:', error)
    return serverError(res, '更新目的港失败')
  }
}

export async function deleteDestinationPort(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM destination_ports WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '目的港不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除目的港失败:', error)
    return serverError(res, '删除目的港失败')
  }
}

// ==================== 机场相关 ====================

export async function getAirPorts(req, res) {
  try {
    const db = getDatabase()
    const { country, status = 'active', search, continent } = req.query
    
    let query = 'SELECT * FROM air_ports WHERE 1=1'
    const params = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    if (country) {
      query += ' AND country = ?'
      params.push(country)
    }
    
    if (continent) {
      query += ' AND continent = ?'
      params.push(continent)
    }
    
    if (search) {
      query += ' AND (port_name_cn LIKE ? OR port_name_en LIKE ? OR port_code LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    
    query += ' ORDER BY country, port_name_cn'
    
    const list = await db.prepare(query).all(...params)
    return success(res, list.map(model.convertPortToCamelCase))
  } catch (error) {
    console.error('获取机场列表失败:', error)
    return serverError(res, '获取机场列表失败')
  }
}

export async function getAirPortById(req, res) {
  try {
    const db = getDatabase()
    const port = await db.prepare('SELECT * FROM air_ports WHERE id = ?').get(req.params.id)
    
    if (!port) {
      return notFound(res, '机场不存在')
    }
    
    return success(res, model.convertPortToCamelCase(port))
  } catch (error) {
    console.error('获取机场详情失败:', error)
    return serverError(res, '获取机场详情失败')
  }
}

export async function createAirPort(req, res) {
  try {
    const { portCode, portNameCn } = req.body
    
    if (!portCode || !portNameCn) {
      return badRequest(res, '机场代码和中文名称为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM air_ports WHERE port_code = ?').get(portCode)
    if (existing) {
      return conflict(res, '机场代码已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO air_ports (
        port_code, port_name_cn, port_name_en, country, country_code,
        city, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      portCode,
      portNameCn,
      req.body.portNameEn || '',
      req.body.country || '',
      req.body.countryCode || '',
      req.body.city || '',
      req.body.description || '',
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建机场失败:', error)
    return serverError(res, '创建机场失败')
  }
}

export async function updateAirPort(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM air_ports WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '机场不存在')
    }
    
    const fields = []
    const values = []
    
    if (req.body.portCode) { fields.push('port_code = ?'); values.push(req.body.portCode) }
    if (req.body.portNameCn) { fields.push('port_name_cn = ?'); values.push(req.body.portNameCn) }
    if (req.body.portNameEn !== undefined) { fields.push('port_name_en = ?'); values.push(req.body.portNameEn) }
    if (req.body.country !== undefined) { fields.push('country = ?'); values.push(req.body.country) }
    if (req.body.countryCode !== undefined) { fields.push('country_code = ?'); values.push(req.body.countryCode) }
    if (req.body.city !== undefined) { fields.push('city = ?'); values.push(req.body.city) }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description) }
    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status) }
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE air_ports SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新机场失败:', error)
    return serverError(res, '更新机场失败')
  }
}

export async function deleteAirPort(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM air_ports WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '机场不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除机场失败:', error)
    return serverError(res, '删除机场失败')
  }
}

/**
 * 获取机场国家列表
 * @description 获取所有机场所属国家的去重列表
 */
export async function getAirPortCountries(req, res) {
  try {
    const db = getDatabase()
    const countries = await db.prepare(
      'SELECT DISTINCT country, country_code FROM air_ports WHERE country IS NOT NULL AND country != \'\' ORDER BY country'
    ).all()
    
    const result = countries.map(r => ({ country: r.country, countryCode: r.country_code }))
    return success(res, result)
  } catch (error) {
    console.error('获取机场国家列表失败:', error)
    return serverError(res, '获取机场国家列表失败')
  }
}

// ==================== 船公司相关 ====================

export async function getShippingCompanies(req, res) {
  try {
    const { status, search, page, pageSize } = req.query
    const result = await model.getShippingCompanies({
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 100
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取船公司列表失败:', error)
    return serverError(res, '获取船公司列表失败')
  }
}

export async function getShippingCompanyById(req, res) {
  try {
    const db = getDatabase()
    const company = await db.prepare('SELECT * FROM shipping_companies WHERE id = ?').get(req.params.id)
    
    if (!company) {
      return notFound(res, '船公司不存在')
    }
    
    return success(res, model.convertShippingCompanyToCamelCase(company))
  } catch (error) {
    console.error('获取船公司详情失败:', error)
    return serverError(res, '获取船公司详情失败')
  }
}

export async function createShippingCompany(req, res) {
  try {
    const { companyCode, companyName } = req.body
    
    if (!companyCode || !companyName) {
      return badRequest(res, '公司代码和公司名称为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM shipping_companies WHERE company_code = ?').get(companyCode)
    if (existing) {
      return conflict(res, '公司代码已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO shipping_companies (company_code, company_name, country, website, description, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      companyCode,
      companyName,
      req.body.country || '',
      req.body.website || '',
      req.body.description || '',
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建船公司失败:', error)
    return serverError(res, '创建船公司失败')
  }
}

export async function updateShippingCompany(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM shipping_companies WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '船公司不存在')
    }
    
    const fields = []
    const values = []
    
    if (req.body.companyCode) { fields.push('company_code = ?'); values.push(req.body.companyCode) }
    if (req.body.companyName) { fields.push('company_name = ?'); values.push(req.body.companyName) }
    if (req.body.country !== undefined) { fields.push('country = ?'); values.push(req.body.country) }
    if (req.body.website !== undefined) { fields.push('website = ?'); values.push(req.body.website) }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description) }
    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status) }
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE shipping_companies SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新船公司失败:', error)
    return serverError(res, '更新船公司失败')
  }
}

export async function deleteShippingCompany(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM shipping_companies WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '船公司不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除船公司失败:', error)
    return serverError(res, '删除船公司失败')
  }
}

// ==================== 柜号相关 ====================

export async function getContainerCodes(req, res) {
  try {
    const db = getDatabase()
    const { shippingCompanyId, status = 'active' } = req.query
    
    let query = `
      SELECT cc.*, sc.company_name as shipping_company_name 
      FROM container_codes cc
      LEFT JOIN shipping_companies sc ON cc.shipping_company_id = sc.id
      WHERE 1=1
    `
    const params = []
    
    if (status) {
      query += ' AND cc.status = ?'
      params.push(status)
    }
    
    if (shippingCompanyId) {
      query += ' AND cc.shipping_company_id = ?'
      params.push(shippingCompanyId)
    }
    
    query += ' ORDER BY cc.container_code'
    
    const list = await db.prepare(query).all(...params)
    return success(res, list.map(r => ({
      id: String(r.id),
      shippingCompanyId: r.shipping_company_id,
      shippingCompanyName: r.shipping_company_name,
      containerCode: r.container_code,
      description: r.description,
      status: r.status
    })))
  } catch (error) {
    console.error('获取柜号列表失败:', error)
    return serverError(res, '获取柜号列表失败')
  }
}

export async function createContainerCode(req, res) {
  try {
    const { shippingCompanyId, containerCode } = req.body
    
    if (!shippingCompanyId || !containerCode) {
      return badRequest(res, '船公司ID和柜号为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM container_codes WHERE container_code = ?').get(containerCode)
    if (existing) {
      return conflict(res, '柜号已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO container_codes (shipping_company_id, container_code, description, status)
      VALUES (?, ?, ?, ?)
    `).run(
      shippingCompanyId,
      containerCode,
      req.body.description || '',
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建柜号失败:', error)
    return serverError(res, '创建柜号失败')
  }
}

export async function updateContainerCode(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM container_codes WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '柜号不存在')
    }
    
    const fields = []
    const values = []
    
    if (req.body.shippingCompanyId) { fields.push('shipping_company_id = ?'); values.push(req.body.shippingCompanyId) }
    if (req.body.containerCode) { fields.push('container_code = ?'); values.push(req.body.containerCode) }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description) }
    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status) }
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE container_codes SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新柜号失败:', error)
    return serverError(res, '更新柜号失败')
  }
}

export async function deleteContainerCode(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM container_codes WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '柜号不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除柜号失败:', error)
    return serverError(res, '删除柜号失败')
  }
}

// ==================== 增值税率相关 ====================

export async function getVatRates(req, res) {
  try {
    const { status, search, page, pageSize } = req.query
    const result = await model.getVatRates({
      status,
      search,
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 100
    })
    
    return success(res, result.list)
  } catch (error) {
    console.error('获取增值税率列表失败:', error)
    return serverError(res, '获取增值税率列表失败')
  }
}

export async function getVatRateByCountryCode(req, res) {
  try {
    const vatRate = await model.getVatRateByCountryCode(req.params.countryCode)
    
    if (!vatRate) {
      return success(res, {
        countryCode: req.params.countryCode,
        countryName: '默认',
        standardRate: 19,
        reducedRate: 0,
        isDefault: true
      })
    }
    
    return success(res, vatRate)
  } catch (error) {
    console.error('获取增值税率失败:', error)
    return serverError(res, '获取增值税率失败')
  }
}

export async function getVatRateById(req, res) {
  try {
    const db = getDatabase()
    const vatRate = await db.prepare('SELECT * FROM vat_rates WHERE id = ?').get(req.params.id)
    
    if (!vatRate) {
      return notFound(res, '增值税率不存在')
    }
    
    return success(res, model.convertVatRateToCamelCase(vatRate))
  } catch (error) {
    console.error('获取增值税率详情失败:', error)
    return serverError(res, '获取增值税率详情失败')
  }
}

export async function createVatRate(req, res) {
  try {
    const { countryCode, countryName, standardRate } = req.body
    
    if (!countryCode || !countryName || standardRate === undefined) {
      return badRequest(res, '国家代码、国家名称和标准税率为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM vat_rates WHERE country_code = ?').get(countryCode)
    if (existing) {
      return conflict(res, '该国家的增值税率已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO vat_rates (
        country_code, country_name, standard_rate, reduced_rate,
        super_reduced_rate, parking_rate, description, effective_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      countryCode.toUpperCase(),
      countryName,
      standardRate,
      req.body.reducedRate || 0,
      req.body.superReducedRate || 0,
      req.body.parkingRate || 0,
      req.body.description || '',
      req.body.effectiveDate || null,
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建增值税率失败:', error)
    return serverError(res, '创建增值税率失败')
  }
}

export async function updateVatRate(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM vat_rates WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '增值税率不存在')
    }
    
    const fields = []
    const values = []
    
    if (req.body.countryCode) { fields.push('country_code = ?'); values.push(req.body.countryCode.toUpperCase()) }
    if (req.body.countryName) { fields.push('country_name = ?'); values.push(req.body.countryName) }
    if (req.body.standardRate !== undefined) { fields.push('standard_rate = ?'); values.push(req.body.standardRate) }
    if (req.body.reducedRate !== undefined) { fields.push('reduced_rate = ?'); values.push(req.body.reducedRate) }
    if (req.body.superReducedRate !== undefined) { fields.push('super_reduced_rate = ?'); values.push(req.body.superReducedRate) }
    if (req.body.parkingRate !== undefined) { fields.push('parking_rate = ?'); values.push(req.body.parkingRate) }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description) }
    if (req.body.effectiveDate !== undefined) { fields.push('effective_date = ?'); values.push(req.body.effectiveDate) }
    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status) }
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE vat_rates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新增值税率失败:', error)
    return serverError(res, '更新增值税率失败')
  }
}

export async function deleteVatRate(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM vat_rates WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '增值税率不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除增值税率失败:', error)
    return serverError(res, '删除增值税率失败')
  }
}

// ==================== 运输方式相关 ====================

export async function getTransportMethods(req, res) {
  try {
    const db = getDatabase()
    const { status = 'active' } = req.query
    
    let query = 'SELECT * FROM transport_methods WHERE 1=1'
    const params = []
    
    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    
    query += ' ORDER BY sort_order, name'
    
    const list = await db.prepare(query).all(...params)
    return success(res, list.map(r => ({
      id: String(r.id),
      name: r.name,
      code: r.code,
      description: r.description,
      icon: r.icon,
      sortOrder: r.sort_order,
      status: r.status
    })))
  } catch (error) {
    console.error('获取运输方式列表失败:', error)
    return serverError(res, '获取运输方式列表失败')
  }
}

export async function createTransportMethod(req, res) {
  try {
    const { name, code } = req.body
    
    if (!name || !code) {
      return badRequest(res, '名称和代码为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM transport_methods WHERE code = ?').get(code)
    if (existing) {
      return conflict(res, '代码已存在')
    }
    
    const result = await db.prepare(`
      INSERT INTO transport_methods (name, code, description, icon, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name,
      code,
      req.body.description || '',
      req.body.icon || '',
      req.body.sortOrder || 0,
      req.body.status || 'active'
    )
    
    return success(res, { id: result.lastInsertRowid }, '创建成功')
  } catch (error) {
    console.error('创建运输方式失败:', error)
    return serverError(res, '创建运输方式失败')
  }
}

export async function updateTransportMethod(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM transport_methods WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '运输方式不存在')
    }
    
    const fields = []
    const values = []
    
    if (req.body.name) { fields.push('name = ?'); values.push(req.body.name) }
    if (req.body.code) { fields.push('code = ?'); values.push(req.body.code) }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description) }
    if (req.body.icon !== undefined) { fields.push('icon = ?'); values.push(req.body.icon) }
    if (req.body.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(req.body.sortOrder) }
    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status) }
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE transport_methods SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新运输方式失败:', error)
    return serverError(res, '更新运输方式失败')
  }
}

export async function deleteTransportMethod(req, res) {
  try {
    const db = getDatabase()
    const result = await db.prepare('DELETE FROM transport_methods WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return notFound(res, '运输方式不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除运输方式失败:', error)
    return serverError(res, '删除运输方式失败')
  }
}

// ==================== 服务费类别相关 ====================

export async function getServiceFeeCategories(req, res) {
  try {
    const db = getDatabase()
    const { status, tree } = req.query
    
    let query = 'SELECT * FROM service_fee_categories WHERE 1=1'
    const params = []
    
    // 只有明确指定status时才过滤，否则返回全部
    if (status && status !== 'all') {
      query += ' AND status = ?'
      params.push(status)
    }
    
    query += ' ORDER BY COALESCE(parent_id, 0), sort_order, name'
    
    const list = await db.prepare(query).all(...params)
    const mappedList = list.map(r => ({
      id: String(r.id),
      name: r.name,
      nameEn: r.name_en,
      code: r.code,
      description: r.description,
      sortOrder: r.sort_order,
      status: r.status,
      parentId: r.parent_id ? String(r.parent_id) : null,
      level: r.level || 1,
      createTime: r.created_at
    }))
    
    // 如果请求树形结构，则构建树
    if (tree === 'true') {
      const treeData = buildCategoryTree(mappedList)
      return success(res, treeData)
    }
    
    return success(res, mappedList)
  } catch (error) {
    console.error('获取服务费类别列表失败:', error)
    return serverError(res, '获取服务费类别列表失败')
  }
}

// 构建分类树形结构
function buildCategoryTree(list) {
  const map = {}
  const roots = []
  
  // 先建立 id -> item 的映射
  list.forEach(item => {
    map[item.id] = { ...item, children: [] }
  })
  
  // 构建树
  list.forEach(item => {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(map[item.id])
    } else {
      roots.push(map[item.id])
    }
  })
  
  return roots
}

// 获取顶级分类列表（用于选择父级）
export async function getTopLevelCategories(req, res) {
  try {
    const db = getDatabase()
    const { status = 'active' } = req.query
    
    let query = 'SELECT * FROM service_fee_categories WHERE (parent_id IS NULL OR parent_id = 0)'
    const params = []
    
    if (status && status !== 'all') {
      query += ' AND status = ?'
      params.push(status)
    }
    
    query += ' ORDER BY sort_order, name'
    
    const list = await db.prepare(query).all(...params)
    return success(res, list.map(r => ({
      id: String(r.id),
      name: r.name,
      nameEn: r.name_en,
      code: r.code,
      description: r.description,
      sortOrder: r.sort_order,
      status: r.status,
      parentId: null,
      level: 1
    })))
  } catch (error) {
    console.error('获取顶级分类列表失败:', error)
    return serverError(res, '获取顶级分类列表失败')
  }
}

export async function createServiceFeeCategory(req, res) {
  try {
    const { name, code, parentId } = req.body
    
    if (!name || !code) {
      return badRequest(res, '名称和代码为必填项')
    }
    
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id FROM service_fee_categories WHERE code = ?').get(code)
    if (existing) {
      return conflict(res, '代码已存在')
    }
    
    // 确定层级：如果有父级则为父级层级+1，否则为1
    let level = 1
    let sortOrder = req.body.sortOrder || 0
    
    if (parentId) {
      const parent = await db.prepare('SELECT level FROM service_fee_categories WHERE id = ?').get(parentId)
      if (parent) {
        level = (parent.level || 1) + 1
      }
      
      // 子分类自动计算排序：查询该父级下已有子分类的最大排序值 + 1
      const maxSortResult = await db.prepare(
        'SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM service_fee_categories WHERE parent_id = ?'
      ).get(parentId)
      sortOrder = (maxSortResult?.max_sort || 0) + 1
    }
    
    const result = await db.prepare(`
      INSERT INTO service_fee_categories (name, name_en, code, description, sort_order, status, parent_id, level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(
      name,
      req.body.nameEn || '',
      code,
      req.body.description || '',
      sortOrder,
      req.body.status || 'active',
      parentId || null,
      level
    )
    
    return success(res, { id: result?.id, sortOrder }, '创建成功')
  } catch (error) {
    console.error('创建服务费类别失败:', error)
    return serverError(res, '创建服务费类别失败')
  }
}

export async function updateServiceFeeCategory(req, res) {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const existing = await db.prepare('SELECT id, parent_id FROM service_fee_categories WHERE id = ?').get(id)
    if (!existing) {
      return notFound(res, '服务费类别不存在')
    }
    
    const fields = []
    const values = []
    
    if (req.body.name) { fields.push('name = ?'); values.push(req.body.name) }
    if (req.body.nameEn !== undefined) { fields.push('name_en = ?'); values.push(req.body.nameEn) }
    if (req.body.code) { fields.push('code = ?'); values.push(req.body.code) }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description) }
    if (req.body.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(req.body.sortOrder) }
    if (req.body.status !== undefined) { fields.push('status = ?'); values.push(req.body.status) }
    
    // 处理父级分类变更
    if (req.body.parentId !== undefined) {
      // 防止设置自己为父级
      if (req.body.parentId && String(req.body.parentId) === String(id)) {
        return badRequest(res, '不能将自己设为父级分类')
      }
      
      // 防止设置子级为父级（避免循环引用）
      if (req.body.parentId) {
        const children = await db.prepare(
          'SELECT id FROM service_fee_categories WHERE parent_id = ?'
        ).all(id)
        const childIds = children.map(c => String(c.id))
        if (childIds.includes(String(req.body.parentId))) {
          return badRequest(res, '不能将子级分类设为父级')
        }
      }
      
      fields.push('parent_id = ?')
      values.push(req.body.parentId || null)
      
      // 更新层级
      let level = 1
      if (req.body.parentId) {
        const parent = await db.prepare('SELECT level FROM service_fee_categories WHERE id = ?').get(req.body.parentId)
        if (parent) {
          level = (parent.level || 1) + 1
        }
      }
      fields.push('level = ?')
      values.push(level)
    }
    
    if (fields.length === 0) {
      return badRequest(res, '没有需要更新的字段')
    }
    
    fields.push('updated_at = NOW()')
    values.push(id)
    
    await db.prepare(`UPDATE service_fee_categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    return success(res, null, '更新成功')
  } catch (error) {
    console.error('更新服务费类别失败:', error)
    return serverError(res, '更新服务费类别失败')
  }
}

export async function deleteServiceFeeCategory(req, res) {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    // 检查是否有子分类
    const children = await db.prepare(
      'SELECT COUNT(*) as count FROM service_fee_categories WHERE parent_id = ?'
    ).get(id)
    
    if (children && children.count > 0) {
      return badRequest(res, `该分类下有 ${children.count} 个子分类，请先删除子分类`)
    }
    
    const result = await db.prepare('DELETE FROM service_fee_categories WHERE id = ?').run(id)
    
    if (result.changes === 0) {
      return notFound(res, '服务费类别不存在')
    }
    
    return success(res, null, '删除成功')
  } catch (error) {
    console.error('删除服务费类别失败:', error)
    return serverError(res, '删除服务费类别失败')
  }
}
