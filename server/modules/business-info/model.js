/**
 * 工商信息管理 - 数据库模型
 * 
 * 提供工商信息的CRUD操作和缓存管理
 */

import { getDatabase } from '../../config/database.js'
import { generateId } from '../../utils/id.js'

// ==================== 工商信息 CRUD ====================

/**
 * 获取工商信息列表
 * @param {Object} params - 查询参数
 */
export async function getBusinessInfoList(params = {}) {
  const db = getDatabase()
  const { 
    search, 
    source, 
    operatingStatus,
    page = 1, 
    pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM business_info WHERE 1=1'
  const queryParams = []
  
  if (search) {
    query += ` AND (
      company_name LIKE ? OR 
      credit_code LIKE ? OR 
      legal_person LIKE ?
    )`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  if (source) {
    query += ' AND source = ?'
    queryParams.push(source)
  }
  
  if (operatingStatus) {
    query += ' AND operating_status = ?'
    queryParams.push(operatingStatus)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页并按使用次数和更新时间排序
  query += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取工商信息
 */
export async function getBusinessInfoById(id) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM business_info WHERE id = ?').get(id)
  return row ? convertToCamelCase(row) : null
}

/**
 * 根据统一社会信用代码获取工商信息
 */
export async function getBusinessInfoByCreditCode(creditCode) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM business_info WHERE credit_code = ?').get(creditCode)
  return row ? convertToCamelCase(row) : null
}

/**
 * 根据公司名称精确匹配获取工商信息
 */
export async function getBusinessInfoByCompanyName(companyName) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM business_info WHERE company_name = ?').get(companyName)
  return row ? convertToCamelCase(row) : null
}

/**
 * 搜索本地工商信息（模糊匹配）
 */
export async function searchLocalBusinessInfo(keyword, limit = 10) {
  const db = getDatabase()
  const searchPattern = `%${keyword}%`
  
  const list = await db.prepare(`
    SELECT * FROM business_info 
    WHERE company_name LIKE ? OR credit_code LIKE ?
    ORDER BY usage_count DESC, updated_at DESC
    LIMIT ?
  `).all(searchPattern, searchPattern, limit)
  
  return list.map(convertToCamelCase)
}

/**
 * 创建工商信息
 */
export async function createBusinessInfo(data) {
  const db = getDatabase()
  const id = generateId()
  
  await db.prepare(`
    INSERT INTO business_info (
      id, credit_code, company_name, company_name_en, legal_person,
      registered_capital, paid_capital, establishment_date, business_scope,
      address, province, city, district, company_type, operating_status,
      industry, registration_authority, approval_date, 
      business_term_start, business_term_end, former_names,
      phone, email, website, source, source_id, raw_data,
      usage_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.creditCode || null,
    data.companyName,
    data.companyNameEn || null,
    data.legalPerson || null,
    data.registeredCapital || null,
    data.paidCapital || null,
    data.establishmentDate || null,
    data.businessScope || null,
    data.address || null,
    data.province || null,
    data.city || null,
    data.district || null,
    data.companyType || null,
    data.operatingStatus || null,
    data.industry || null,
    data.registrationAuthority || null,
    data.approvalDate || null,
    data.businessTermStart || null,
    data.businessTermEnd || null,
    data.formerNames ? JSON.stringify(data.formerNames) : null,
    data.phone || null,
    data.email || null,
    data.website || null,
    data.source || 'manual',
    data.sourceId || null,
    data.rawData ? JSON.stringify(data.rawData) : null,
    0
  )
  
  return { id }
}

/**
 * 更新工商信息
 */
export async function updateBusinessInfo(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    creditCode: 'credit_code',
    companyName: 'company_name',
    companyNameEn: 'company_name_en',
    legalPerson: 'legal_person',
    registeredCapital: 'registered_capital',
    paidCapital: 'paid_capital',
    establishmentDate: 'establishment_date',
    businessScope: 'business_scope',
    address: 'address',
    province: 'province',
    city: 'city',
    district: 'district',
    companyType: 'company_type',
    operatingStatus: 'operating_status',
    industry: 'industry',
    registrationAuthority: 'registration_authority',
    approvalDate: 'approval_date',
    businessTermStart: 'business_term_start',
    businessTermEnd: 'business_term_end',
    phone: 'phone',
    email: 'email',
    website: 'website',
    source: 'source',
    sourceId: 'source_id'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  // 特殊处理 formerNames 和 rawData
  if (data.formerNames !== undefined) {
    fields.push('former_names = ?')
    values.push(data.formerNames ? JSON.stringify(data.formerNames) : null)
  }
  
  if (data.rawData !== undefined) {
    fields.push('raw_data = ?')
    values.push(data.rawData ? JSON.stringify(data.rawData) : null)
  }
  
  if (fields.length === 0) return
  
  fields.push('updated_at = NOW()')
  values.push(id)
  
  await db.prepare(`
    UPDATE business_info SET ${fields.join(', ')} WHERE id = ?
  `).run(...values)
}

/**
 * 删除工商信息
 */
export async function deleteBusinessInfo(id) {
  const db = getDatabase()
  
  // 检查是否有客户关联
  const linkedCustomers = await db.prepare(
    'SELECT COUNT(*) as count FROM customers WHERE business_info_id = ?'
  ).get(id)
  
  if (linkedCustomers.count > 0) {
    throw new Error(`该工商信息已被 ${linkedCustomers.count} 个客户关联，无法删除`)
  }
  
  await db.prepare('DELETE FROM business_info WHERE id = ?').run(id)
}

/**
 * 增加使用次数（当工商信息被客户引用时调用）
 */
export async function incrementUsageCount(id) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE business_info 
    SET usage_count = usage_count + 1, last_used_at = NOW(), updated_at = NOW()
    WHERE id = ?
  `).run(id)
}

/**
 * 保存或更新工商信息（用于API缓存）
 * 如果信用代码已存在则更新，否则新建
 */
export async function upsertBusinessInfo(data) {
  if (data.creditCode) {
    const existing = await getBusinessInfoByCreditCode(data.creditCode)
    if (existing) {
      await updateBusinessInfo(existing.id, data)
      return { id: existing.id, isNew: false }
    }
  }
  
  const result = await createBusinessInfo(data)
  return { id: result.id, isNew: true }
}

/**
 * 获取统计信息
 */
export async function getBusinessInfoStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN source = 'qichacha' THEN 1 ELSE 0 END) as fromQichacha,
      SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END) as fromManual,
      SUM(CASE WHEN source = 'ocr' THEN 1 ELSE 0 END) as fromOcr,
      SUM(usage_count) as totalUsage
    FROM business_info
  `).get()
  
  return stats
}

// ==================== 数据转换函数 ====================

function convertToCamelCase(row) {
  if (!row) return null
  
  let formerNames = []
  if (row.former_names) {
    try {
      formerNames = JSON.parse(row.former_names)
    } catch (e) {
      formerNames = []
    }
  }
  
  let rawData = null
  if (row.raw_data) {
    try {
      rawData = JSON.parse(row.raw_data)
    } catch (e) {
      rawData = null
    }
  }
  
  return {
    id: row.id,
    creditCode: row.credit_code,
    companyName: row.company_name,
    companyNameEn: row.company_name_en,
    legalPerson: row.legal_person,
    registeredCapital: row.registered_capital,
    paidCapital: row.paid_capital,
    establishmentDate: row.establishment_date,
    businessScope: row.business_scope,
    address: row.address,
    province: row.province,
    city: row.city,
    district: row.district,
    companyType: row.company_type,
    operatingStatus: row.operating_status,
    industry: row.industry,
    registrationAuthority: row.registration_authority,
    approvalDate: row.approval_date,
    businessTermStart: row.business_term_start,
    businessTermEnd: row.business_term_end,
    formerNames,
    phone: row.phone,
    email: row.email,
    website: row.website,
    source: row.source,
    sourceId: row.source_id,
    rawData,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export default {
  getBusinessInfoList,
  getBusinessInfoById,
  getBusinessInfoByCreditCode,
  getBusinessInfoByCompanyName,
  searchLocalBusinessInfo,
  createBusinessInfo,
  updateBusinessInfo,
  deleteBusinessInfo,
  incrementUsageCount,
  upsertBusinessInfo,
  getBusinessInfoStats
}

