/**
 * 客户询价模块 - 数据模型
 * 包含：询价管理、卡车类型、报价计算
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 常量定义 ====================

export const INQUIRY_TYPE = {
  CLEARANCE: 'clearance',     // 清关询价
  TRANSPORT: 'transport',     // 运输询价
  COMBINED: 'combined'        // 综合询价（清关+运输）
}

export const INQUIRY_STATUS = {
  PENDING: 'pending',         // 待报价
  QUOTED: 'quoted',           // 已报价
  ACCEPTED: 'accepted',       // 已接受
  REJECTED: 'rejected',       // 已拒绝
  EXPIRED: 'expired',         // 已过期
  CONVERTED: 'converted'      // 已转订单
}

export const TRUCK_CATEGORY = {
  VAN: 'van',                 // 厢式车
  BOX: 'box',                 // 箱式货车
  SEMI: 'semi',               // 半挂车
  REEFER: 'reefer',           // 冷藏车
  FLATBED: 'flatbed',         // 平板车
  HAZMAT: 'hazmat'            // 危险品车
}

// ==================== 询价编号生成 ====================

/**
 * 生成询价编号
 * 格式: INQ + 年份 + 6位序号，如 INQ20250001
 */
export async function generateInquiryNumber() {
  const db = getDatabase()
  const year = new Date().getFullYear()
  
  // 获取并更新序号
  const result = await db.prepare(`
    UPDATE order_sequences 
    SET current_seq = current_seq + 1, updated_at = CURRENT_TIMESTAMP
    WHERE business_type = 'inquiry'
    RETURNING current_seq
  `).get()
  
  const seq = result?.current_seq || 1
  return `INQ${year}${String(seq).padStart(6, '0')}`
}

// ==================== 询价管理 ====================

/**
 * 创建询价
 */
export async function createInquiry(data) {
  const db = getDatabase()
  const id = generateId()
  const inquiryNumber = await generateInquiryNumber()
  
  // 计算有效期（默认7天）
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 7)
  
  await db.prepare(`
    INSERT INTO customer_inquiries (
      id, inquiry_number, customer_id, customer_name, inquiry_type, status,
      clearance_data, transport_data, attachments, notes, valid_until
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `).run(
    id,
    inquiryNumber,
    data.customerId,
    data.customerName,
    data.inquiryType,
    INQUIRY_STATUS.PENDING,
    data.clearanceData ? JSON.stringify(data.clearanceData) : null,
    data.transportData ? JSON.stringify(data.transportData) : null,
    data.attachments ? JSON.stringify(data.attachments) : '[]',
    data.notes || null,
    validUntil.toISOString().split('T')[0]
  )
  
  return { id, inquiryNumber }
}

/**
 * 获取询价列表
 */
export async function getInquiries(params = {}) {
  const db = getDatabase()
  const { customerId, status, inquiryType, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM customer_inquiries WHERE 1=1'
  const queryParams = []
  let paramIndex = 1
  
  if (customerId) {
    query += ` AND customer_id = $${paramIndex++}`
    queryParams.push(customerId)
  }
  
  if (status) {
    query += ` AND status = $${paramIndex++}`
    queryParams.push(status)
  }
  
  if (inquiryType) {
    query += ` AND inquiry_type = $${paramIndex++}`
    queryParams.push(inquiryType)
  }
  
  // 计数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const countResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertInquiryToCamelCase),
    total: countResult?.total || 0,
    page,
    pageSize
  }
}

/**
 * 获取客户的询价列表
 */
export async function getCustomerInquiries(customerId, params = {}) {
  return getInquiries({ ...params, customerId })
}

/**
 * 获取询价详情
 */
export async function getInquiryById(id) {
  const db = getDatabase()
  const inquiry = await db.prepare('SELECT * FROM customer_inquiries WHERE id = $1').get(id)
  return inquiry ? convertInquiryToCamelCase(inquiry) : null
}

/**
 * 根据询价编号获取
 */
export async function getInquiryByNumber(inquiryNumber) {
  const db = getDatabase()
  const inquiry = await db.prepare('SELECT * FROM customer_inquiries WHERE inquiry_number = $1').get(inquiryNumber)
  return inquiry ? convertInquiryToCamelCase(inquiry) : null
}

/**
 * 更新询价
 */
export async function updateInquiry(id, data) {
  const db = getDatabase()
  
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (data.clearanceData !== undefined) {
    fields.push(`clearance_data = $${paramIndex++}`)
    values.push(JSON.stringify(data.clearanceData))
  }
  if (data.transportData !== undefined) {
    fields.push(`transport_data = $${paramIndex++}`)
    values.push(JSON.stringify(data.transportData))
  }
  if (data.transportQuote !== undefined) {
    fields.push(`transport_quote = $${paramIndex++}`)
    values.push(JSON.stringify(data.transportQuote))
  }
  if (data.estimatedDuty !== undefined) {
    fields.push(`estimated_duty = $${paramIndex++}`)
    values.push(data.estimatedDuty)
  }
  if (data.estimatedVat !== undefined) {
    fields.push(`estimated_vat = $${paramIndex++}`)
    values.push(data.estimatedVat)
  }
  if (data.estimatedOtherTax !== undefined) {
    fields.push(`estimated_other_tax = $${paramIndex++}`)
    values.push(data.estimatedOtherTax)
  }
  if (data.clearanceFee !== undefined) {
    fields.push(`clearance_fee = $${paramIndex++}`)
    values.push(data.clearanceFee)
  }
  if (data.transportFee !== undefined) {
    fields.push(`transport_fee = $${paramIndex++}`)
    values.push(data.transportFee)
  }
  if (data.totalQuote !== undefined) {
    fields.push(`total_quote = $${paramIndex++}`)
    values.push(data.totalQuote)
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIndex++}`)
    values.push(data.status)
  }
  if (data.quotedAt !== undefined) {
    fields.push(`quoted_at = $${paramIndex++}`)
    values.push(data.quotedAt)
  }
  if (data.quotedBy !== undefined) {
    fields.push(`quoted_by = $${paramIndex++}`)
    values.push(data.quotedBy)
  }
  if (data.quotedByName !== undefined) {
    fields.push(`quoted_by_name = $${paramIndex++}`)
    values.push(data.quotedByName)
  }
  if (data.crmOpportunityId !== undefined) {
    fields.push(`crm_opportunity_id = $${paramIndex++}`)
    values.push(data.crmOpportunityId)
  }
  if (data.billId !== undefined) {
    fields.push(`bill_id = $${paramIndex++}`)
    values.push(data.billId)
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`)
    values.push(data.notes)
  }
  if (data.validUntil !== undefined) {
    fields.push(`valid_until = $${paramIndex++}`)
    values.push(data.validUntil)
  }
  if (data.attachments !== undefined) {
    fields.push(`attachments = $${paramIndex++}`)
    values.push(JSON.stringify(data.attachments))
  }
  
  if (fields.length === 0) return false
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  await db.prepare(`
    UPDATE customer_inquiries 
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
  `).run(...values)
  
  return true
}

/**
 * 更新询价状态
 */
export async function updateInquiryStatus(id, status) {
  const db = getDatabase()
  await db.prepare(`
    UPDATE customer_inquiries 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `).run(status, id)
  return true
}

/**
 * 设置询价报价
 */
export async function setInquiryQuote(id, quoteData) {
  const db = getDatabase()
  
  await db.prepare(`
    UPDATE customer_inquiries 
    SET 
      estimated_duty = $1,
      estimated_vat = $2,
      estimated_other_tax = $3,
      clearance_fee = $4,
      transport_fee = $5,
      transport_quote = $6,
      total_quote = $7,
      status = 'quoted',
      quoted_at = CURRENT_TIMESTAMP,
      quoted_by = $8,
      quoted_by_name = $9,
      valid_until = $10,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
  `).run(
    quoteData.estimatedDuty || 0,
    quoteData.estimatedVat || 0,
    quoteData.estimatedOtherTax || 0,
    quoteData.clearanceFee || 0,
    quoteData.transportFee || 0,
    quoteData.transportQuote ? JSON.stringify(quoteData.transportQuote) : null,
    quoteData.totalQuote || 0,
    quoteData.quotedBy || null,
    quoteData.quotedByName || null,
    quoteData.validUntil || null,
    id
  )
  
  return true
}

// ==================== 卡车类型管理 ====================

/**
 * 获取所有卡车类型
 */
export async function getTruckTypes(params = {}) {
  const db = getDatabase()
  const { category, isActive = true } = params
  
  let query = 'SELECT * FROM truck_types WHERE 1=1'
  const queryParams = []
  let paramIndex = 1
  
  if (isActive !== undefined && isActive !== null) {
    query += ` AND is_active = $${paramIndex++}`
    queryParams.push(isActive)
  }
  
  if (category) {
    query += ` AND category = $${paramIndex++}`
    queryParams.push(category)
  }
  
  query += ' ORDER BY sort_order, name'
  
  const list = await db.prepare(query).all(...queryParams)
  return list.map(convertTruckTypeToCamelCase)
}

/**
 * 获取卡车类型详情
 */
export async function getTruckTypeById(id) {
  const db = getDatabase()
  const truck = await db.prepare('SELECT * FROM truck_types WHERE id = $1').get(id)
  return truck ? convertTruckTypeToCamelCase(truck) : null
}

/**
 * 根据代码获取卡车类型
 */
export async function getTruckTypeByCode(code) {
  const db = getDatabase()
  const truck = await db.prepare('SELECT * FROM truck_types WHERE code = $1').get(code)
  return truck ? convertTruckTypeToCamelCase(truck) : null
}

/**
 * 根据载重和容积推荐卡车类型
 */
export async function recommendTruckType(weight, volume) {
  const db = getDatabase()
  
  // 查找满足条件的最小卡车
  const trucks = await db.prepare(`
    SELECT * FROM truck_types 
    WHERE is_active = true 
      AND max_weight >= $1
      AND (max_volume IS NULL OR max_volume >= $2)
    ORDER BY max_weight, sort_order
    LIMIT 3
  `).all(weight, volume || 0)
  
  return trucks.map(convertTruckTypeToCamelCase)
}

// ==================== 数据转换 ====================

function convertInquiryToCamelCase(row) {
  // 解析 JSON 字段
  let clearanceData = null
  let transportData = null
  let transportQuote = null
  let attachments = []
  
  try {
    if (row.clearance_data) {
      clearanceData = typeof row.clearance_data === 'string' 
        ? JSON.parse(row.clearance_data) 
        : row.clearance_data
    }
    if (row.transport_data) {
      transportData = typeof row.transport_data === 'string' 
        ? JSON.parse(row.transport_data) 
        : row.transport_data
    }
    if (row.transport_quote) {
      transportQuote = typeof row.transport_quote === 'string' 
        ? JSON.parse(row.transport_quote) 
        : row.transport_quote
    }
    if (row.attachments) {
      attachments = typeof row.attachments === 'string' 
        ? JSON.parse(row.attachments) 
        : row.attachments
    }
  } catch (e) {
    // 解析失败保持原值
  }
  
  return {
    id: row.id,
    inquiryNumber: row.inquiry_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    inquiryType: row.inquiry_type,
    status: row.status,
    
    // 清关数据
    clearanceData,
    estimatedDuty: parseFloat(row.estimated_duty) || 0,
    estimatedVat: parseFloat(row.estimated_vat) || 0,
    estimatedOtherTax: parseFloat(row.estimated_other_tax) || 0,
    clearanceFee: parseFloat(row.clearance_fee) || 0,
    
    // 运输数据
    transportData,
    transportQuote,
    transportFee: parseFloat(row.transport_fee) || 0,
    
    // 报价
    totalQuote: parseFloat(row.total_quote) || 0,
    currency: row.currency || 'EUR',
    validUntil: row.valid_until,
    quotedAt: row.quoted_at,
    quotedBy: row.quoted_by,
    quotedByName: row.quoted_by_name,
    
    // 关联
    crmOpportunityId: row.crm_opportunity_id,
    billId: row.bill_id,
    
    attachments,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function convertTruckTypeToCamelCase(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameEn: row.name_en,
    category: row.category,
    description: row.description,
    maxWeight: parseFloat(row.max_weight) || 0,
    maxVolume: row.max_volume ? parseFloat(row.max_volume) : null,
    length: parseFloat(row.length) || 0,
    width: parseFloat(row.width) || 0,
    height: parseFloat(row.height) || 0,
    axleCount: row.axle_count || 2,
    emissionClass: row.emission_class || 'EURO6',
    baseRatePerKm: parseFloat(row.base_rate_per_km) || 0,
    minCharge: parseFloat(row.min_charge) || 0,
    isActive: row.is_active,
    sortOrder: row.sort_order
  }
}

export default {
  // 常量
  INQUIRY_TYPE,
  INQUIRY_STATUS,
  TRUCK_CATEGORY,
  
  // 询价
  generateInquiryNumber,
  createInquiry,
  getInquiries,
  getCustomerInquiries,
  getInquiryById,
  getInquiryByNumber,
  updateInquiry,
  updateInquiryStatus,
  setInquiryQuote,
  
  // 卡车类型
  getTruckTypes,
  getTruckTypeById,
  getTruckTypeByCode,
  recommendTruckType
}

