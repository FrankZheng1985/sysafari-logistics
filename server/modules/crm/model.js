/**
 * CRM客户关系管理模块 - 数据模型
 * 包含：客户管理、联系人管理、客户分类、沟通记录、跟进管理
 */

import { getDatabase, generateId } from '../../config/database.js'

// ==================== 常量定义 ====================

export const CUSTOMER_TYPE = {
  SHIPPER: 'shipper',       // 发货人
  CONSIGNEE: 'consignee',   // 收货人
  BOTH: 'both'              // 两者都是
}

export const CUSTOMER_LEVEL = {
  VIP: 'vip',               // VIP客户
  IMPORTANT: 'important',   // 重要客户
  NORMAL: 'normal',         // 普通客户
  POTENTIAL: 'potential'    // 潜在客户
}

export const CUSTOMER_STATUS = {
  ACTIVE: 'active',         // 活跃
  INACTIVE: 'inactive',     // 不活跃
  BLACKLIST: 'blacklist'    // 黑名单
}

export const FOLLOW_UP_TYPE = {
  PHONE: 'phone',           // 电话
  EMAIL: 'email',           // 邮件
  MEETING: 'meeting',       // 会议
  VISIT: 'visit',           // 拜访
  OTHER: 'other'            // 其他
}

// ==================== 扩展常量 ====================

export const OPPORTUNITY_STAGE = {
  LEAD: 'lead',                     // 线索
  QUALIFICATION: 'qualification',   // 资格确认
  PROPOSAL: 'proposal',             // 方案报价
  NEGOTIATION: 'negotiation',       // 谈判
  CLOSED_WON: 'closed_won',         // 成交
  CLOSED_LOST: 'closed_lost'        // 失败
}

export const QUOTATION_STATUS = {
  DRAFT: 'draft',           // 草稿
  SENT: 'sent',             // 已发送
  ACCEPTED: 'accepted',     // 已接受
  REJECTED: 'rejected',     // 已拒绝
  EXPIRED: 'expired'        // 已过期
}

export const CONTRACT_STATUS = {
  DRAFT: 'draft',           // 草稿
  PENDING: 'pending',       // 待签署
  ACTIVE: 'active',         // 生效中
  EXPIRED: 'expired',       // 已过期
  TERMINATED: 'terminated'  // 已终止
}

export const FEEDBACK_TYPE = {
  COMPLAINT: 'complaint',   // 投诉
  SUGGESTION: 'suggestion', // 建议
  INQUIRY: 'inquiry',       // 咨询
  PRAISE: 'praise'          // 表扬
}

export const FEEDBACK_STATUS = {
  OPEN: 'open',             // 待处理
  PROCESSING: 'processing', // 处理中
  RESOLVED: 'resolved',     // 已解决
  CLOSED: 'closed'          // 已关闭
}

export const FEEDBACK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
}

// ==================== 客户管理 ====================

/**
 * 获取客户列表
 */
export async function getCustomers(params = {}) {
  const db = getDatabase()
  const { 
    type, level, status = 'active', search, 
    countryCode, assignedTo,
    page = 1, pageSize = 20 
  } = params
  
  let query = 'SELECT * FROM customers WHERE 1=1'
  const queryParams = []
  
  if (type) {
    query += ' AND customer_type = ?'
    queryParams.push(type)
  }
  
  if (level) {
    query += ' AND customer_level = ?'
    queryParams.push(level)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (countryCode) {
    query += ' AND country_code = ?'
    queryParams.push(countryCode)
  }
  
  if (assignedTo) {
    query += ' AND assigned_to = ?'
    queryParams.push(assignedTo)
  }
  
  if (search) {
    query += ` AND (
      customer_name LIKE ? OR 
      customer_code LIKE ? OR 
      company_name LIKE ? OR 
      contact_person LIKE ? OR 
      contact_phone LIKE ? OR
      contact_email LIKE ?
    )`
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertCustomerToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取客户统计
 */
export async function getCustomerStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN customer_level = 'vip' THEN 1 ELSE 0 END) as vip,
      SUM(CASE WHEN customer_level = 'important' THEN 1 ELSE 0 END) as important,
      SUM(CASE WHEN customer_level = 'normal' THEN 1 ELSE 0 END) as normal,
      SUM(CASE WHEN customer_level = 'potential' THEN 1 ELSE 0 END) as potential,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN customer_type = 'shipper' THEN 1 ELSE 0 END) as shippers,
      SUM(CASE WHEN customer_type = 'consignee' THEN 1 ELSE 0 END) as consignees
    FROM customers
  `).get()
  
  return {
    total: stats.total || 0,
    byLevel: {
      vip: stats.vip || 0,
      important: stats.important || 0,
      normal: stats.normal || 0,
      potential: stats.potential || 0
    },
    byStatus: {
      active: stats.active || 0,
      inactive: stats.inactive || 0
    },
    byType: {
      shippers: stats.shippers || 0,
      consignees: stats.consignees || 0
    }
  }
}

/**
 * 根据ID获取客户
 */
export async function getCustomerById(id) {
  const db = getDatabase()
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
  return customer ? convertCustomerToCamelCase(customer) : null
}

/**
 * 根据客户代码获取客户
 */
export async function getCustomerByCode(code) {
  const db = getDatabase()
  const customer = await db.prepare('SELECT * FROM customers WHERE customer_code = ?').get(code)
  return customer ? convertCustomerToCamelCase(customer) : null
}

/**
 * 创建客户
 */
export async function createCustomer(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = await db.prepare(`
    INSERT INTO customers (
      id, customer_code, customer_name, company_name, customer_type,
      customer_level, country_code, province, city, address, postal_code,
      contact_person, contact_phone, contact_email, tax_number,
      bank_name, bank_account, credit_limit, payment_terms,
      assigned_to, assigned_name, tags, notes, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.customerCode,
    data.customerName,
    data.companyName || '',
    data.customerType || 'shipper',
    data.customerLevel || 'normal',
    data.countryCode || '',
    data.province || '',
    data.city || '',
    data.address || '',
    data.postalCode || '',
    data.contactPerson || '',
    data.contactPhone || '',
    data.contactEmail || '',
    data.taxNumber || '',
    data.bankName || '',
    data.bankAccount || '',
    data.creditLimit || 0,
    data.paymentTerms || '',
    data.assignedTo || null,
    data.assignedName || '',
    data.tags ? JSON.stringify(data.tags) : '[]',
    data.notes || '',
    data.status || 'active'
  )
  
  return { id }
}

/**
 * 更新客户
 */
export async function updateCustomer(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    customerName: 'customer_name',
    companyName: 'company_name',
    customerType: 'customer_type',
    customerLevel: 'customer_level',
    countryCode: 'country_code',
    province: 'province',
    city: 'city',
    address: 'address',
    postalCode: 'postal_code',
    contactPerson: 'contact_person',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    taxNumber: 'tax_number',
    bankName: 'bank_name',
    bankAccount: 'bank_account',
    creditLimit: 'credit_limit',
    paymentTerms: 'payment_terms',
    assignedTo: 'assigned_to',
    assignedName: 'assigned_name',
    notes: 'notes',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  // 特殊处理tags
  if (data.tags !== undefined) {
    fields.push('tags = ?')
    values.push(JSON.stringify(data.tags))
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除客户
 */
export async function deleteCustomer(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM customers WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 更新客户状态
 */
export async function updateCustomerStatus(id, status) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE customers SET status = ?, updated_at = NOW() WHERE id = ?
  `).run(status, id)
  return result.changes > 0
}

/**
 * 分配客户给业务员
 */
export async function assignCustomer(id, assignedTo, assignedName) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE customers 
    SET assigned_to = ?, assigned_name = ?, updated_at = NOW() 
    WHERE id = ?
  `).run(assignedTo, assignedName, id)
  return result.changes > 0
}

// ==================== 联系人管理 ====================

/**
 * 获取客户联系人列表
 */
export async function getContacts(customerId) {
  const db = getDatabase()
  const contacts = await db.prepare(`
    SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_primary DESC, created_at DESC
  `).all(customerId)
  
  return contacts.map(convertContactToCamelCase)
}

/**
 * 获取联系人详情
 */
export async function getContactById(id) {
  const db = getDatabase()
  const contact = await db.prepare('SELECT * FROM customer_contacts WHERE id = ?').get(id)
  return contact ? convertContactToCamelCase(contact) : null
}

/**
 * 创建联系人
 */
export async function createContact(data) {
  const db = getDatabase()
  const id = generateId()
  
  // 如果是主要联系人，先取消其他主要联系人
  if (data.isPrimary) {
    await db.prepare('UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?').run(data.customerId)
  }
  
  const result = await db.prepare(`
    INSERT INTO customer_contacts (
      id, customer_id, contact_name, position, department,
      phone, mobile, email, wechat, qq,
      is_primary, is_decision_maker, notes, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.customerId,
    data.contactName,
    data.position || '',
    data.department || '',
    data.phone || '',
    data.mobile || '',
    data.email || '',
    data.wechat || '',
    data.qq || '',
    data.isPrimary ? 1 : 0,
    data.isDecisionMaker ? 1 : 0,
    data.notes || '',
    data.status || 'active'
  )
  
  return { id }
}

/**
 * 更新联系人
 */
export async function updateContact(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    contactName: 'contact_name',
    position: 'position',
    department: 'department',
    phone: 'phone',
    mobile: 'mobile',
    email: 'email',
    wechat: 'wechat',
    qq: 'qq',
    notes: 'notes',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  // 布尔值处理
  if (data.isPrimary !== undefined) {
    // 如果设为主要联系人，先取消其他的
    if (data.isPrimary) {
      const contact = getContactById(id)
      if (contact) {
        await db.prepare('UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?').run(contact.customerId)
      }
    }
    fields.push('is_primary = ?')
    values.push(data.isPrimary ? 1 : 0)
  }
  
  if (data.isDecisionMaker !== undefined) {
    fields.push('is_decision_maker = ?')
    values.push(data.isDecisionMaker ? 1 : 0)
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE customer_contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除联系人
 */
export async function deleteContact(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM customer_contacts WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 跟进记录管理 ====================

/**
 * 获取跟进记录列表
 */
export async function getFollowUps(params = {}) {
  const db = getDatabase()
  const { customerId, type, operatorId, startDate, endDate, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM customer_follow_ups WHERE 1=1'
  const queryParams = []
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (type) {
    query += ' AND follow_up_type = ?'
    queryParams.push(type)
  }
  
  if (operatorId) {
    query += ' AND operator_id = ?'
    queryParams.push(operatorId)
  }
  
  if (startDate) {
    query += ' AND follow_up_time >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND follow_up_time <= ?'
    queryParams.push(endDate)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ' ORDER BY follow_up_time DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertFollowUpToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 创建跟进记录
 */
export async function createFollowUp(data) {
  const db = getDatabase()
  const id = generateId()
  
  const result = await db.prepare(`
    INSERT INTO customer_follow_ups (
      id, customer_id, contact_id, follow_up_type, follow_up_time,
      content, result, next_follow_up_time, next_action,
      operator_id, operator_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.customerId,
    data.contactId || null,
    data.followUpType || 'other',
    data.followUpTime || new Date().toISOString(),
    data.content,
    data.result || '',
    data.nextFollowUpTime || null,
    data.nextAction || '',
    data.operatorId || null,
    data.operatorName || ''
  )
  
  // 更新客户最后跟进时间
  await db.prepare(`
    UPDATE customers SET last_follow_up_time = NOW(), updated_at = NOW() WHERE id = ?
  `).run(data.customerId)
  
  return { id }
}

/**
 * 更新跟进记录
 */
export async function updateFollowUp(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    followUpType: 'follow_up_type',
    followUpTime: 'follow_up_time',
    content: 'content',
    result: 'result',
    nextFollowUpTime: 'next_follow_up_time',
    nextAction: 'next_action'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE customer_follow_ups SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除跟进记录
 */
export async function deleteFollowUp(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM customer_follow_ups WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 客户订单统计 ====================

/**
 * 获取客户订单统计
 */
export async function getCustomerOrderStats(customerId) {
  const db = getDatabase()
  
  // 根据客户ID关联提单统计
  const customer = await getCustomerById(customerId)
  if (!customer) return null
  
  const searchPattern = `%${customer.customerName}%`
  
  // 统计该客户相关的所有订单（通过customer_id或名称匹配）
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN delivery_status = '已送达' OR delivery_status = '已完成' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN delivery_status NOT IN ('已送达', '已完成') OR delivery_status IS NULL THEN 1 ELSE 0 END) as active_orders,
      COALESCE(SUM(pieces), 0) as total_pieces,
      COALESCE(SUM(weight), 0) as total_weight,
      COALESCE(SUM(volume), 0) as total_volume
    FROM bills_of_lading
    WHERE (is_void = 0 OR is_void IS NULL)
      AND (
        customer_id = ? OR 
        shipper LIKE ? OR 
        consignee LIKE ?
      )
  `).get(customerId, searchPattern, searchPattern)
  
  return {
    totalOrders: Number(stats?.total_orders || 0),
    activeOrders: Number(stats?.active_orders || 0),
    completedOrders: Number(stats?.completed_orders || 0),
    totalPieces: Number(stats?.total_pieces || 0),
    totalWeight: Number(stats?.total_weight || 0),
    totalVolume: Number(stats?.total_volume || 0)
  }
}

/**
 * 获取客户相关订单列表
 */
export async function getCustomerOrders(customerId, params = {}) {
  const db = getDatabase()
  const { page = 1, pageSize = 10, search, status } = params
  
  const customer = await getCustomerById(customerId)
  if (!customer) return { list: [], total: 0, page, pageSize }
  
  // 优先通过customer_id查找，同时也支持通过shipper/consignee名称匹配（兼容历史数据）
  let query = `
    SELECT * FROM bills_of_lading 
    WHERE is_void = 0 AND (
      customer_id = ? OR 
      shipper LIKE ? OR 
      consignee LIKE ?
    )
  `
  const searchPattern = `%${customer.customerName}%`
  const queryParams = [customerId, searchPattern, searchPattern]
  
  // 关键词搜索
  if (search) {
    query += ` AND (bill_number LIKE ? OR container_number LIKE ?)`
    const searchQuery = `%${search}%`
    queryParams.push(searchQuery, searchQuery)
  }
  
  // 状态筛选
  if (status) {
    query += ` AND status = ?`
    queryParams.push(status)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  // 分页
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(row => ({
      id: row.id,
      billNumber: row.bill_number,
      containerNumber: row.container_number,
      shipper: row.shipper,
      consignee: row.consignee,
      status: row.status,
      shipStatus: row.ship_status,
      customsStatus: row.customs_status,
      inspection: row.inspection,
      deliveryStatus: row.delivery_status,
      pieces: row.pieces,
      weight: row.weight,
      eta: row.eta,
      portOfLoading: row.port_of_loading,
      portOfDischarge: row.port_of_discharge,
      customerId: row.customer_id,
      customerName: row.customer_name,
      createTime: row.created_at
    })),
    total: totalResult.total,
    page,
    pageSize
  }
}

// ==================== 客户地址管理 ====================

/**
 * 获取客户地址列表
 */
export async function getCustomerAddresses(customerId) {
  const db = getDatabase()
  const rows = await db.prepare(`
    SELECT * FROM customer_addresses 
    WHERE customer_id = ? 
    ORDER BY is_default DESC, created_at DESC
  `).all(customerId)
  
  return rows.map(row => ({
    id: row.id,
    customerId: row.customer_id,
    addressCode: row.address_code,
    companyName: row.company_name,
    contactPerson: row.contact_person,
    phone: row.phone,
    country: row.country,
    city: row.city,
    address: row.address,
    postalCode: row.postal_code,
    isDefault: row.is_default === 1,
    addressType: row.address_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * 创建客户地址
 */
export async function createCustomerAddress(customerId, data) {
  const db = getDatabase()
  
  // 如果设为默认，先取消其他默认
  if (data.isDefault) {
    await db.prepare(`
      UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?
    `).run(customerId)
  }
  
  const result = await db.prepare(`
    INSERT INTO customer_addresses (
      customer_id, address_code, company_name, contact_person, phone,
      country, city, address, postal_code, is_default, address_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    customerId,
    data.addressCode || null,
    data.companyName,
    data.contactPerson || null,
    data.phone || null,
    data.country || null,
    data.city || null,
    data.address,
    data.postalCode || null,
    data.isDefault ? 1 : 0,
    data.addressType || 'both'
  )
  
  return { id: result.id }
}

/**
 * 更新客户地址
 */
export async function updateCustomerAddress(addressId, data) {
  const db = getDatabase()
  
  // 获取当前地址信息
  const current = await db.prepare('SELECT customer_id FROM customer_addresses WHERE id = ?').get(addressId)
  if (!current) return null
  
  // 如果设为默认，先取消其他默认
  if (data.isDefault) {
    await db.prepare(`
      UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?
    `).run(current.customer_id)
  }
  
  await db.prepare(`
    UPDATE customer_addresses SET
      address_code = COALESCE(?, address_code),
      company_name = COALESCE(?, company_name),
      contact_person = COALESCE(?, contact_person),
      phone = COALESCE(?, phone),
      country = COALESCE(?, country),
      city = COALESCE(?, city),
      address = COALESCE(?, address),
      postal_code = COALESCE(?, postal_code),
      is_default = ?,
      address_type = COALESCE(?, address_type),
      updated_at = NOW()
    WHERE id = ?
  `).run(
    data.addressCode,
    data.companyName,
    data.contactPerson,
    data.phone,
    data.country,
    data.city,
    data.address,
    data.postalCode,
    data.isDefault ? 1 : 0,
    data.addressType,
    addressId
  )
  
  return { id: addressId }
}

/**
 * 删除客户地址
 */
export async function deleteCustomerAddress(addressId) {
  const db = getDatabase()
  await db.prepare('DELETE FROM customer_addresses WHERE id = ?').run(addressId)
  return { success: true }
}

// ==================== 客户税号管理 ====================

/**
 * 获取客户税号列表
 */
export async function getCustomerTaxNumbers(customerId) {
  const db = getDatabase()
  const rows = await db.prepare(`
    SELECT * FROM customer_tax_numbers 
    WHERE customer_id = ? 
    ORDER BY is_default DESC, created_at DESC
  `).all(customerId)
  
  return rows.map(row => ({
    id: row.id,
    customerId: row.customer_id,
    taxType: row.tax_type,
    taxNumber: row.tax_number,
    country: row.country,
    companyShortName: row.company_short_name,
    companyName: row.company_name,
    companyAddress: row.company_address,
    isVerified: row.is_verified === 1,
    verifiedAt: row.verified_at,
    verificationData: row.verification_data ? JSON.parse(row.verification_data) : null,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * 创建客户税号
 */
export async function createCustomerTaxNumber(customerId, data) {
  const db = getDatabase()
  
  // 检查VAT或EORI号码是否在该客户下已存在（同一客户下不能重复）
  if (data.taxType === 'vat' || data.taxType === 'eori') {
    const existing = await db.prepare(`
      SELECT id FROM customer_tax_numbers 
      WHERE customer_id = ? AND tax_type = ? AND tax_number = ?
    `).get(customerId, data.taxType, data.taxNumber)
    
    if (existing) {
      const taxTypeName = data.taxType === 'vat' ? 'VAT税号' : 'EORI号码'
      throw new Error(`该客户已存在相同的${taxTypeName}`)
    }
  }
  
  // 如果设为默认，先取消同类型的其他默认
  if (data.isDefault) {
    await db.prepare(`
      UPDATE customer_tax_numbers SET is_default = 0 
      WHERE customer_id = ? AND tax_type = ?
    `).run(customerId, data.taxType)
  }
  
  const result = await db.prepare(`
    INSERT INTO customer_tax_numbers (
      customer_id, tax_type, tax_number, country, 
      company_short_name, company_name, company_address, is_verified, verified_at, verification_data,
      is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    customerId,
    data.taxType,
    data.taxNumber,
    data.country || null,
    data.companyShortName || null,
    data.companyName || null,
    data.companyAddress || null,
    data.isVerified ? 1 : 0,
    data.verifiedAt || null,
    data.verificationData ? JSON.stringify(data.verificationData) : null,
    data.isDefault ? 1 : 0
  )
  
  return { id: result.id }
}

/**
 * 更新客户税号
 */
export async function updateCustomerTaxNumber(taxId, data) {
  const db = getDatabase()
  
  // 获取当前税号信息
  const current = await db.prepare('SELECT customer_id, tax_type, tax_number FROM customer_tax_numbers WHERE id = ?').get(taxId)
  if (!current) return null
  
  // 如果修改了税号，检查VAT或EORI号码是否在该客户下已存在（排除当前记录）
  const newTaxType = data.taxType || current.tax_type
  const newTaxNumber = data.taxNumber || current.tax_number
  if ((newTaxType === 'vat' || newTaxType === 'eori') && newTaxNumber !== current.tax_number) {
    const existing = await db.prepare(`
      SELECT id FROM customer_tax_numbers 
      WHERE customer_id = ? AND tax_type = ? AND tax_number = ? AND id != ?
    `).get(current.customer_id, newTaxType, newTaxNumber, taxId)
    
    if (existing) {
      const taxTypeName = newTaxType === 'vat' ? 'VAT税号' : 'EORI号码'
      throw new Error(`该客户已存在相同的${taxTypeName}`)
    }
  }
  
  // 如果设为默认，先取消同类型的其他默认
  if (data.isDefault) {
    await db.prepare(`
      UPDATE customer_tax_numbers SET is_default = 0 
      WHERE customer_id = ? AND tax_type = ?
    `).run(current.customer_id, data.taxType || current.tax_type)
  }
  
  await db.prepare(`
    UPDATE customer_tax_numbers SET
      tax_type = COALESCE(?, tax_type),
      tax_number = COALESCE(?, tax_number),
      country = COALESCE(?, country),
      company_short_name = COALESCE(?, company_short_name),
      company_name = COALESCE(?, company_name),
      company_address = COALESCE(?, company_address),
      is_verified = COALESCE(?, is_verified),
      verified_at = COALESCE(?, verified_at),
      verification_data = COALESCE(?, verification_data),
      is_default = ?,
      updated_at = NOW()
    WHERE id = ?
  `).run(
    data.taxType,
    data.taxNumber,
    data.country,
    data.companyShortName,
    data.companyName,
    data.companyAddress,
    data.isVerified !== undefined ? (data.isVerified ? 1 : 0) : null,
    data.verifiedAt,
    data.verificationData ? JSON.stringify(data.verificationData) : null,
    data.isDefault ? 1 : 0,
    taxId
  )
  
  return { id: taxId }
}

/**
 * 删除客户税号
 */
export async function deleteCustomerTaxNumber(taxId) {
  const db = getDatabase()
  await db.prepare('DELETE FROM customer_tax_numbers WHERE id = ?').run(taxId)
  return { success: true }
}

// ==================== 共享税号管理（公司级税号库） ====================

/**
 * 获取共享税号列表
 */
export async function getSharedTaxNumbers(params = {}) {
  const db = getDatabase()
  const { taxType, search, status = 'active', page = 1, pageSize = 50 } = params
  
  let query = 'SELECT * FROM shared_tax_numbers WHERE 1=1'
  const queryParams = []
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (taxType) {
    query += ' AND tax_type = ?'
    queryParams.push(taxType)
  }
  
  if (search) {
    query += ' AND (tax_number LIKE ? OR company_name LIKE ? OR company_short_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const countResult = await db.prepare(countQuery).get(...queryParams)
  const total = countResult?.total || 0
  
  // 分页
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const rows = await db.prepare(query).all(...queryParams)
  
  return {
    list: rows.map(row => ({
      id: row.id,
      taxType: row.tax_type,
      taxNumber: row.tax_number,
      country: row.country,
      companyShortName: row.company_short_name,
      companyName: row.company_name,
      companyAddress: row.company_address,
      isVerified: row.is_verified === 1,
      verifiedAt: row.verified_at,
      verificationData: row.verification_data ? JSON.parse(row.verification_data) : null,
      status: row.status,
      remark: row.remark,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取共享税号
 */
export async function getSharedTaxNumberById(id) {
  const db = getDatabase()
  const row = await db.prepare('SELECT * FROM shared_tax_numbers WHERE id = ?').get(id)
  if (!row) return null
  
  return {
    id: row.id,
    taxType: row.tax_type,
    taxNumber: row.tax_number,
    country: row.country,
    companyShortName: row.company_short_name,
    companyName: row.company_name,
    companyAddress: row.company_address,
    isVerified: row.is_verified === 1,
    verifiedAt: row.verified_at,
    verificationData: row.verification_data ? JSON.parse(row.verification_data) : null,
    status: row.status,
    remark: row.remark,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * 创建共享税号
 */
export async function createSharedTaxNumber(data) {
  const db = getDatabase()
  
  // 检查税号是否已存在
  const existing = await db.prepare(`
    SELECT id FROM shared_tax_numbers WHERE tax_number = ?
  `).get(data.taxNumber)
  
  if (existing) {
    throw new Error('该税号已存在于共享库中')
  }
  
  const result = await db.prepare(`
    INSERT INTO shared_tax_numbers (
      tax_type, tax_number, country, company_short_name, company_name, company_address,
      is_verified, verified_at, verification_data, status, remark, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).get(
    data.taxType,
    data.taxNumber,
    data.country || null,
    data.companyShortName || null,
    data.companyName || null,
    data.companyAddress || null,
    data.isVerified ? 1 : 0,
    data.verifiedAt || null,
    data.verificationData ? JSON.stringify(data.verificationData) : null,
    data.status || 'active',
    data.remark || null,
    data.createdBy || null
  )
  
  return { id: result.id }
}

/**
 * 更新共享税号
 */
export async function updateSharedTaxNumber(id, data) {
  const db = getDatabase()
  
  // 如果修改了税号，检查是否与其他记录冲突
  if (data.taxNumber) {
    const existing = await db.prepare(`
      SELECT id FROM shared_tax_numbers WHERE tax_number = ? AND id != ?
    `).get(data.taxNumber, id)
    
    if (existing) {
      throw new Error('该税号已存在于共享库中')
    }
  }
  
  await db.prepare(`
    UPDATE shared_tax_numbers SET
      tax_type = COALESCE(?, tax_type),
      tax_number = COALESCE(?, tax_number),
      country = COALESCE(?, country),
      company_short_name = COALESCE(?, company_short_name),
      company_name = COALESCE(?, company_name),
      company_address = COALESCE(?, company_address),
      is_verified = COALESCE(?, is_verified),
      verified_at = COALESCE(?, verified_at),
      verification_data = COALESCE(?, verification_data),
      status = COALESCE(?, status),
      remark = COALESCE(?, remark),
      updated_at = NOW()
    WHERE id = ?
  `).run(
    data.taxType,
    data.taxNumber,
    data.country,
    data.companyShortName,
    data.companyName,
    data.companyAddress,
    data.isVerified !== undefined ? (data.isVerified ? 1 : 0) : null,
    data.verifiedAt,
    data.verificationData ? JSON.stringify(data.verificationData) : null,
    data.status,
    data.remark,
    id
  )
  
  return { id }
}

/**
 * 删除共享税号
 */
export async function deleteSharedTaxNumber(id) {
  const db = getDatabase()
  await db.prepare('DELETE FROM shared_tax_numbers WHERE id = ?').run(id)
  return { success: true }
}

// ==================== 销售机会管理 ====================

/**
 * 获取销售机会列表
 */
export async function getOpportunities(params = {}) {
  const db = getDatabase()
  const { customerId, stage, assignedTo, startDate, endDate, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM sales_opportunities WHERE 1=1'
  const queryParams = []
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (stage) {
    query += ' AND stage = ?'
    queryParams.push(stage)
  }
  
  if (assignedTo) {
    query += ' AND assigned_to = ?'
    queryParams.push(assignedTo)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ' AND (opportunity_name LIKE ? OR description LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertOpportunityToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取销售机会统计
 */
export async function getOpportunityStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN stage = 'lead' THEN 1 ELSE 0 END) as lead,
      SUM(CASE WHEN stage = 'qualification' THEN 1 ELSE 0 END) as qualification,
      SUM(CASE WHEN stage = 'proposal' THEN 1 ELSE 0 END) as proposal,
      SUM(CASE WHEN stage = 'negotiation' THEN 1 ELSE 0 END) as negotiation,
      SUM(CASE WHEN stage IN ('closed_won', 'won') THEN 1 ELSE 0 END) as closed_won,
      SUM(CASE WHEN stage IN ('closed_lost', 'lost') THEN 1 ELSE 0 END) as closed_lost,
      COALESCE(SUM(CASE WHEN stage NOT IN ('closed_won', 'closed_lost', 'won', 'lost') THEN expected_amount ELSE 0 END), 0) as pipeline_value,
      COALESCE(SUM(CASE WHEN stage IN ('closed_won', 'won') THEN expected_amount ELSE 0 END), 0) as won_value
    FROM sales_opportunities
  `).get()
  
  return {
    total: stats.total || 0,
    byStage: {
      lead: stats.lead || 0,
      qualification: stats.qualification || 0,
      proposal: stats.proposal || 0,
      negotiation: stats.negotiation || 0,
      closedWon: stats.closed_won || 0,
      closedLost: stats.closed_lost || 0
    },
    pipelineValue: stats.pipeline_value || 0,
    wonValue: stats.won_value || 0,
    winRate: stats.total > 0 ? ((stats.closed_won || 0) / stats.total * 100).toFixed(1) : 0
  }
}

/**
 * 根据ID获取销售机会
 */
export async function getOpportunityById(id) {
  const db = getDatabase()
  const opportunity = await db.prepare('SELECT * FROM sales_opportunities WHERE id = ?').get(id)
  return opportunity ? convertOpportunityToCamelCase(opportunity) : null
}

/**
 * 创建销售机会
 */
export async function createOpportunity(data) {
  const db = getDatabase()
  const id = generateId()
  
  await db.prepare(`
    INSERT INTO sales_opportunities (
      id, opportunity_name, customer_id, customer_name, contact_id, contact_name,
      stage, expected_amount, probability, expected_close_date,
      source, description, assigned_to, assigned_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    data.opportunityName,
    data.customerId || null,
    data.customerName || '',
    data.contactId || null,
    data.contactName || '',
    data.stage || 'lead',
    data.expectedAmount || 0,
    data.probability || 0,
    data.expectedCloseDate || null,
    data.source || '',
    data.description || '',
    data.assignedTo || null,
    data.assignedName || ''
  )
  
  return { id }
}

/**
 * 更新销售机会
 */
export async function updateOpportunity(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    opportunityName: 'opportunity_name',
    customerId: 'customer_id',
    customerName: 'customer_name',
    contactId: 'contact_id',
    contactName: 'contact_name',
    stage: 'stage',
    expectedAmount: 'expected_amount',
    probability: 'probability',
    expectedCloseDate: 'expected_close_date',
    source: 'source',
    description: 'description',
    assignedTo: 'assigned_to',
    assignedName: 'assigned_name',
    lostReason: 'lost_reason'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE sales_opportunities SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除销售机会
 */
export async function deleteOpportunity(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM sales_opportunities WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * 更新销售机会阶段
 */
export async function updateOpportunityStage(id, stage, lostReason = '') {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE sales_opportunities 
    SET stage = ?, lost_reason = ?, updated_at = NOW()
    WHERE id = ?
  `).run(stage, stage === 'closed_lost' ? lostReason : '', id)
  return result.changes > 0
}

// ==================== 报价管理 ====================

/**
 * 获取报价列表
 */
export async function getQuotations(params = {}) {
  const db = getDatabase()
  const { customerId, opportunityId, status, startDate, endDate, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM quotations WHERE 1=1'
  const queryParams = []
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (opportunityId) {
    query += ' AND opportunity_id = ?'
    queryParams.push(opportunityId)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (startDate) {
    query += ' AND quote_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND quote_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ' AND (quote_number LIKE ? OR customer_name LIKE ? OR subject LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY quote_date DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertQuotationToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取报价
 */
export async function getQuotationById(id) {
  const db = getDatabase()
  const quotation = await db.prepare('SELECT * FROM quotations WHERE id = ?').get(id)
  return quotation ? convertQuotationToCamelCase(quotation) : null
}

/**
 * 生成报价单号
 */
async function generateQuoteNumber() {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  const result = await db.prepare(`
    SELECT quote_number FROM quotations 
    WHERE quote_number LIKE ? 
    ORDER BY quote_number DESC LIMIT 1
  `).get(`QT${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.quote_number.slice(-4))
    seq = lastSeq + 1
  }
  
  return `QT${date}${String(seq).padStart(4, '0')}`
}

/**
 * 创建报价
 */
export async function createQuotation(data) {
  const db = getDatabase()
  const id = generateId()
  const quoteNumber = await generateQuoteNumber()
  
  await db.prepare(`
    INSERT INTO quotations (
      id, quote_number, customer_id, customer_name, opportunity_id,
      contact_id, contact_name, subject, quote_date, valid_until,
      subtotal, discount, tax_amount, total_amount, currency,
      terms, notes, items, status, created_by, created_by_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    quoteNumber,
    data.customerId || null,
    data.customerName || '',
    data.opportunityId || null,
    data.contactId || null,
    data.contactName || '',
    data.subject || '',
    data.quoteDate || new Date().toISOString().split('T')[0],
    data.validUntil || null,
    data.subtotal || 0,
    data.discount || 0,
    data.taxAmount || 0,
    data.totalAmount || 0,
    data.currency || 'CNY',
    data.terms || '',
    data.notes || '',
    data.items ? JSON.stringify(data.items) : '[]',
    data.status || 'draft',
    data.createdBy || null,
    data.createdByName || ''
  )
  
  return { id, quoteNumber }
}

/**
 * 更新报价
 */
export async function updateQuotation(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    subject: 'subject',
    quoteDate: 'quote_date',
    validUntil: 'valid_until',
    subtotal: 'subtotal',
    discount: 'discount',
    taxAmount: 'tax_amount',
    totalAmount: 'total_amount',
    currency: 'currency',
    terms: 'terms',
    notes: 'notes',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (data.items !== undefined) {
    fields.push('items = ?')
    values.push(JSON.stringify(data.items))
  }
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE quotations SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除报价
 */
export async function deleteQuotation(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM quotations WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 合同管理 ====================

/**
 * 获取合同列表
 */
export async function getContracts(params = {}) {
  const db = getDatabase()
  const { customerId, status, startDate, endDate, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM contracts WHERE 1=1'
  const queryParams = []
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (startDate) {
    query += ' AND start_date >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND end_date <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ' AND (contract_number LIKE ? OR contract_name LIKE ? OR customer_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertContractToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 根据ID获取合同
 */
export async function getContractById(id) {
  const db = getDatabase()
  const contract = await db.prepare('SELECT * FROM contracts WHERE id = ?').get(id)
  return contract ? convertContractToCamelCase(contract) : null
}

/**
 * 生成合同编号
 */
async function generateContractNumber() {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  const result = await db.prepare(`
    SELECT contract_number FROM contracts 
    WHERE contract_number LIKE ? 
    ORDER BY contract_number DESC LIMIT 1
  `).get(`CT${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.contract_number.slice(-4))
    seq = lastSeq + 1
  }
  
  return `CT${date}${String(seq).padStart(4, '0')}`
}

/**
 * 创建合同
 */
export async function createContract(data) {
  const db = getDatabase()
  const id = generateId()
  const contractNumber = await generateContractNumber()
  
  await db.prepare(`
    INSERT INTO contracts (
      id, contract_number, contract_name, customer_id, customer_name,
      quotation_id, opportunity_id, contract_type, contract_amount, currency,
      start_date, end_date, sign_date, terms, notes, status,
      created_by, created_by_name,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    contractNumber,
    data.contractName,
    data.customerId || null,
    data.customerName || '',
    data.quotationId || null,
    data.opportunityId || null,
    data.contractType || 'service',
    data.contractAmount || 0,
    data.currency || 'CNY',
    data.startDate || null,
    data.endDate || null,
    data.signDate || null,
    data.terms || '',
    data.notes || '',
    data.status || 'draft',
    data.createdBy || null,
    data.createdByName || ''
  )
  
  return { id, contractNumber }
}

/**
 * 更新合同
 */
export async function updateContract(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    contractName: 'contract_name',
    contractType: 'contract_type',
    contractAmount: 'contract_amount',
    currency: 'currency',
    startDate: 'start_date',
    endDate: 'end_date',
    signDate: 'sign_date',
    terms: 'terms',
    notes: 'notes',
    status: 'status'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 删除合同
 */
export async function deleteContract(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM contracts WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 客户反馈/投诉管理 ====================

/**
 * 获取客户反馈列表
 */
export async function getFeedbacks(params = {}) {
  const db = getDatabase()
  const { customerId, type, status, priority, assignedTo, startDate, endDate, search, page = 1, pageSize = 20 } = params
  
  let query = 'SELECT * FROM customer_feedbacks WHERE 1=1'
  const queryParams = []
  
  if (customerId) {
    query += ' AND customer_id = ?'
    queryParams.push(customerId)
  }
  
  if (type) {
    query += ' AND feedback_type = ?'
    queryParams.push(type)
  }
  
  if (status) {
    query += ' AND status = ?'
    queryParams.push(status)
  }
  
  if (priority) {
    query += ' AND priority = ?'
    queryParams.push(priority)
  }
  
  if (assignedTo) {
    query += ' AND assigned_to = ?'
    queryParams.push(assignedTo)
  }
  
  if (startDate) {
    query += ' AND created_at >= ?'
    queryParams.push(startDate)
  }
  
  if (endDate) {
    query += ' AND created_at <= ?'
    queryParams.push(endDate)
  }
  
  if (search) {
    query += ' AND (subject LIKE ? OR content LIKE ? OR customer_name LIKE ?)'
    const searchPattern = `%${search}%`
    queryParams.push(searchPattern, searchPattern, searchPattern)
  }
  
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total')
  const totalResult = await db.prepare(countQuery).get(...queryParams)
  
  query += " ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC LIMIT ? OFFSET ?"
  queryParams.push(pageSize, (page - 1) * pageSize)
  
  const list = await db.prepare(query).all(...queryParams)
  
  return {
    list: list.map(convertFeedbackToCamelCase),
    total: totalResult.total,
    page,
    pageSize
  }
}

/**
 * 获取反馈统计
 */
export async function getFeedbackStats() {
  const db = getDatabase()
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN feedback_type = 'complaint' THEN 1 ELSE 0 END) as complaint,
      SUM(CASE WHEN feedback_type = 'suggestion' THEN 1 ELSE 0 END) as suggestion,
      SUM(CASE WHEN feedback_type = 'inquiry' THEN 1 ELSE 0 END) as inquiry,
      SUM(CASE WHEN feedback_type = 'praise' THEN 1 ELSE 0 END) as praise,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN priority = 'urgent' OR priority = 'high' THEN 1 ELSE 0 END) as high_priority
    FROM customer_feedbacks
  `).get()
  
  return {
    total: stats.total || 0,
    byType: {
      complaint: stats.complaint || 0,
      suggestion: stats.suggestion || 0,
      inquiry: stats.inquiry || 0,
      praise: stats.praise || 0
    },
    byStatus: {
      open: stats.open || 0,
      processing: stats.processing || 0,
      resolved: stats.resolved || 0
    },
    highPriority: stats.high_priority || 0
  }
}

/**
 * 根据ID获取反馈
 */
export async function getFeedbackById(id) {
  const db = getDatabase()
  const feedback = await db.prepare('SELECT * FROM customer_feedbacks WHERE id = ?').get(id)
  return feedback ? convertFeedbackToCamelCase(feedback) : null
}

/**
 * 生成反馈单号
 */
async function generateFeedbackNumber() {
  const db = getDatabase()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  const result = await db.prepare(`
    SELECT feedback_number FROM customer_feedbacks 
    WHERE feedback_number LIKE ? 
    ORDER BY feedback_number DESC LIMIT 1
  `).get(`FB${date}%`)
  
  let seq = 1
  if (result) {
    const lastSeq = parseInt(result.feedback_number.slice(-4))
    seq = lastSeq + 1
  }
  
  return `FB${date}${String(seq).padStart(4, '0')}`
}

/**
 * 创建反馈
 */
export async function createFeedback(data) {
  const db = getDatabase()
  const id = generateId()
  const feedbackNumber = await generateFeedbackNumber()
  
  await db.prepare(`
    INSERT INTO customer_feedbacks (
      id, feedback_number, customer_id, customer_name, contact_id, contact_name,
      feedback_type, subject, content, priority, source,
      bill_id, bill_number, assigned_to, assigned_name, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `).run(
    id,
    feedbackNumber,
    data.customerId || null,
    data.customerName || '',
    data.contactId || null,
    data.contactName || '',
    data.feedbackType || 'inquiry',
    data.subject,
    data.content,
    data.priority || 'medium',
    data.source || '',
    data.billId || null,
    data.billNumber || '',
    data.assignedTo || null,
    data.assignedName || '',
    data.status || 'open'
  )
  
  return { id, feedbackNumber }
}

/**
 * 更新反馈
 */
export async function updateFeedback(id, data) {
  const db = getDatabase()
  const fields = []
  const values = []
  
  const fieldMap = {
    feedbackType: 'feedback_type',
    subject: 'subject',
    content: 'content',
    priority: 'priority',
    assignedTo: 'assigned_to',
    assignedName: 'assigned_name',
    status: 'status',
    resolution: 'resolution',
    resolvedAt: 'resolved_at'
  }
  
  Object.entries(fieldMap).forEach(([jsField, dbField]) => {
    if (data[jsField] !== undefined) {
      fields.push(`${dbField} = ?`)
      values.push(data[jsField])
    }
  })
  
  if (fields.length === 0) return false
  
  fields.push("updated_at = NOW()")
  values.push(id)
  
  const result = await db.prepare(`UPDATE customer_feedbacks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

/**
 * 解决反馈
 */
export async function resolveFeedback(id, resolution) {
  const db = getDatabase()
  const result = await db.prepare(`
    UPDATE customer_feedbacks 
    SET status = 'resolved', resolution = ?, resolved_at = NOW(), updated_at = NOW()
    WHERE id = ?
  `).run(resolution, id)
  return result.changes > 0
}

/**
 * 删除反馈
 */
export async function deleteFeedback(id) {
  const db = getDatabase()
  const result = await db.prepare('DELETE FROM customer_feedbacks WHERE id = ?').run(id)
  return result.changes > 0
}

// ==================== 客户分析统计 ====================

/**
 * 获取客户价值分析
 */
export async function getCustomerValueAnalysis(customerId) {
  const db = getDatabase()
  
  const customer = getCustomerById(customerId)
  if (!customer) return null
  
  // 订单统计
  const orderStats = getCustomerOrderStats(customerId)
  
  // 合同统计
  const contractStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_contracts,
      COALESCE(SUM(contract_amount), 0) as total_value,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts
    FROM contracts WHERE customer_id = ?
  `).get(customerId)
  
  // 报价统计
  const quoteStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_quotes,
      SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotes,
      COALESCE(SUM(CASE WHEN status = 'accepted' THEN total_amount ELSE 0 END), 0) as accepted_value
    FROM quotations WHERE customer_id = ?
  `).get(customerId)
  
  // 反馈统计
  const feedbackStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_feedbacks,
      SUM(CASE WHEN feedback_type = 'complaint' THEN 1 ELSE 0 END) as complaints,
      SUM(CASE WHEN feedback_type = 'praise' THEN 1 ELSE 0 END) as praises
    FROM customer_feedbacks WHERE customer_id = ?
  `).get(customerId)
  
  // 跟进统计
  const followUpStats = await db.prepare(`
    SELECT COUNT(*) as total_follow_ups FROM customer_follow_ups WHERE customer_id = ?
  `).get(customerId)
  
  return {
    customer: {
      id: customer.id,
      name: customer.customerName,
      level: customer.customerLevel,
      status: customer.status
    },
    orders: orderStats,
    contracts: {
      total: contractStats.total_contracts || 0,
      active: contractStats.active_contracts || 0,
      totalValue: contractStats.total_value || 0
    },
    quotations: {
      total: quoteStats.total_quotes || 0,
      accepted: quoteStats.accepted_quotes || 0,
      acceptedValue: quoteStats.accepted_value || 0,
      conversionRate: quoteStats.total_quotes > 0 
        ? ((quoteStats.accepted_quotes / quoteStats.total_quotes) * 100).toFixed(1) 
        : 0
    },
    feedbacks: {
      total: feedbackStats.total_feedbacks || 0,
      complaints: feedbackStats.complaints || 0,
      praises: feedbackStats.praises || 0
    },
    engagement: {
      followUps: followUpStats.total_follow_ups || 0,
      lastFollowUp: customer.lastFollowUpTime
    }
  }
}

/**
 * 获取销售漏斗数据
 */
export async function getSalesFunnel() {
  const db = getDatabase()
  
  const funnel = await db.prepare(`
    SELECT 
      stage,
      COUNT(*) as count,
      COALESCE(SUM(expected_amount), 0) as value
    FROM sales_opportunities
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
    ORDER BY CASE stage 
      WHEN 'lead' THEN 1 
      WHEN 'qualification' THEN 2 
      WHEN 'proposal' THEN 3 
      WHEN 'negotiation' THEN 4 
    END
  `).all()
  
  return funnel.map(f => ({
    stage: f.stage,
    count: f.count,
    value: f.value
  }))
}

/**
 * 获取客户活跃度排行
 */
export async function getCustomerActivityRanking(limit = 10) {
  const db = getDatabase()
  
  const ranking = await db.prepare(`
    SELECT 
      c.id,
      c.customer_name,
      c.customer_level,
      COUNT(DISTINCT f.id) as follow_up_count,
      COUNT(DISTINCT o.id) as opportunity_count,
      COUNT(DISTINCT ct.id) as contract_count,
      c.last_follow_up_time
    FROM customers c
    LEFT JOIN customer_follow_ups f ON c.id = f.customer_id
    LEFT JOIN sales_opportunities o ON c.id = o.customer_id
    LEFT JOIN contracts ct ON c.id = ct.customer_id
    WHERE c.status = 'active'
    GROUP BY c.id
    ORDER BY follow_up_count DESC, opportunity_count DESC
    LIMIT ?
  `).all(limit)
  
  return ranking.map(r => ({
    id: r.id,
    customerName: r.customer_name,
    customerLevel: r.customer_level,
    followUpCount: r.follow_up_count,
    opportunityCount: r.opportunity_count,
    contractCount: r.contract_count,
    lastFollowUpTime: r.last_follow_up_time
  }))
}

// ==================== 数据转换函数 ====================

export function convertCustomerToCamelCase(row) {
  let tags = []
  if (row.tags) {
    try {
      tags = JSON.parse(row.tags)
    } catch (e) {
      tags = []
    }
  }
  
  return {
    id: row.id,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    companyName: row.company_name,
    customerType: row.customer_type,
    customerLevel: row.customer_level,
    countryCode: row.country_code,
    province: row.province,
    city: row.city,
    address: row.address,
    postalCode: row.postal_code,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    taxNumber: row.tax_number,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    creditLimit: row.credit_limit,
    paymentTerms: row.payment_terms,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    tags,
    notes: row.notes,
    status: row.status,
    lastFollowUpTime: row.last_follow_up_time,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertContactToCamelCase(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    contactName: row.contact_name,
    position: row.position,
    department: row.department,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    wechat: row.wechat,
    qq: row.qq,
    isPrimary: row.is_primary === 1,
    isDecisionMaker: row.is_decision_maker === 1,
    notes: row.notes,
    status: row.status,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertFollowUpToCamelCase(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    contactId: row.contact_id,
    followUpType: row.follow_up_type,
    followUpTime: row.follow_up_time,
    content: row.content,
    result: row.result,
    nextFollowUpTime: row.next_follow_up_time,
    nextAction: row.next_action,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertOpportunityToCamelCase(row) {
  return {
    id: row.id,
    opportunityName: row.opportunity_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    contactId: row.contact_id,
    contactName: row.contact_name,
    stage: row.stage,
    expectedAmount: row.expected_amount,
    probability: row.probability,
    expectedCloseDate: row.expected_close_date,
    source: row.source,
    description: row.description,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    lostReason: row.lost_reason,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertQuotationToCamelCase(row) {
  let items = []
  if (row.items) {
    try {
      items = JSON.parse(row.items)
    } catch (e) {
      items = []
    }
  }
  
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    opportunityId: row.opportunity_id,
    contactId: row.contact_id,
    contactName: row.contact_name,
    subject: row.subject,
    quoteDate: row.quote_date,
    validUntil: row.valid_until,
    subtotal: row.subtotal,
    discount: row.discount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    currency: row.currency,
    terms: row.terms,
    notes: row.notes,
    items,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertContractToCamelCase(row) {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    contractName: row.contract_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    quotationId: row.quotation_id,
    opportunityId: row.opportunity_id,
    contractType: row.contract_type,
    contractAmount: row.contract_amount,
    currency: row.currency,
    startDate: row.start_date,
    endDate: row.end_date,
    signDate: row.sign_date,
    terms: row.terms,
    notes: row.notes,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export function convertFeedbackToCamelCase(row) {
  return {
    id: row.id,
    feedbackNumber: row.feedback_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    contactId: row.contact_id,
    contactName: row.contact_name,
    feedbackType: row.feedback_type,
    subject: row.subject,
    content: row.content,
    priority: row.priority,
    source: row.source,
    billId: row.bill_id,
    billNumber: row.bill_number,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_name,
    status: row.status,
    resolution: row.resolution,
    resolvedAt: row.resolved_at,
    createTime: row.created_at,
    updateTime: row.updated_at
  }
}

export default {
  // 常量
  CUSTOMER_TYPE,
  CUSTOMER_LEVEL,
  CUSTOMER_STATUS,
  FOLLOW_UP_TYPE,
  OPPORTUNITY_STAGE,
  QUOTATION_STATUS,
  CONTRACT_STATUS,
  FEEDBACK_TYPE,
  FEEDBACK_STATUS,
  FEEDBACK_PRIORITY,
  
  // 客户管理
  getCustomers,
  getCustomerStats,
  getCustomerById,
  getCustomerByCode,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerStatus,
  assignCustomer,
  
  // 联系人管理
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  
  // 跟进记录
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  
  // 客户订单
  getCustomerOrderStats,
  getCustomerOrders,
  
  // 客户地址
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  
  // 客户税号
  getCustomerTaxNumbers,
  createCustomerTaxNumber,
  updateCustomerTaxNumber,
  deleteCustomerTaxNumber,
  
  // 共享税号（公司级税号库）
  getSharedTaxNumbers,
  getSharedTaxNumberById,
  createSharedTaxNumber,
  updateSharedTaxNumber,
  deleteSharedTaxNumber,
  
  // 销售机会
  getOpportunities,
  getOpportunityStats,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  updateOpportunityStage,
  
  // 报价管理
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  
  // 合同管理
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  
  // 客户反馈
  getFeedbacks,
  getFeedbackStats,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  resolveFeedback,
  deleteFeedback,
  
  // 客户分析
  getCustomerValueAnalysis,
  getSalesFunnel,
  getCustomerActivityRanking,
  
  // 转换函数
  convertCustomerToCamelCase,
  convertContactToCamelCase,
  convertFollowUpToCamelCase,
  convertOpportunityToCamelCase,
  convertQuotationToCamelCase,
  convertContractToCamelCase,
  convertFeedbackToCamelCase
}

